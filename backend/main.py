from contextlib import asynccontextmanager
import sqlite3
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from .auth import current_user, owner_only, DEMO_USERS
from .ai_parser import parse_command
from .database import get_connection, init_db


@asynccontextmanager
async def lifespan(_app):
    init_db()
    yield


app = FastAPI(title="Secure Inventory Assistant", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "https://secure-inventory-assistant.vercel.app"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


class LoginRequest(BaseModel):
    name: str = "Asha Rao"


class ProductRequest(BaseModel):
    name: str
    unit: str
    quantity: float = Field(ge=0)
    reorder_threshold: float = Field(ge=0)


class InventoryRequest(BaseModel):
    product_id: int = Field(gt=0)
    quantity: float = Field(gt=0)
    user_id: int = Field(gt=0)


VALID_UNITS = {"Pieces", "Kg", "Bags", "Cartons", "Boxes", "Dozens", "Litres", "Quintals"}


class VoiceRequest(BaseModel):
    text: str
    language: str = "en-IN"


class VoiceParseRequest(BaseModel):
    text: str = Field(min_length=1)


def products():
    with get_connection() as connection:
        return [dict(row) for row in connection.execute("SELECT id, name, unit, quantity, reorder_threshold FROM products ORDER BY name").fetchall()]


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/auth/login")
def login(request: LoginRequest):
    is_owner = request.name.lower() not in {"ravi", "ravi kumar", "staff"}
    token = "owner-demo-token" if is_owner else "staff-demo-token"
    return {"token": token, "user": DEMO_USERS[token], "prototype_notice": "Voice verification is a demo reference flow, not biometric security."}


@app.post("/api/auth/verify")
def verify(user=Depends(current_user)):
    return {"verified": True, "user": user, "method": "prototype enrollment reference"}


@app.get("/api/products")
def list_products(_user=Depends(current_user)):
    return products()


@app.post("/api/products")
def create_product(request: ProductRequest, _user=Depends(owner_only)):
    if request.unit not in VALID_UNITS:
        raise HTTPException(status_code=400, detail=f"Unit must be one of: {', '.join(sorted(VALID_UNITS))}.")
    try:
        with get_connection() as connection:
            cursor = connection.execute("INSERT INTO products (name, unit, quantity, reorder_threshold) VALUES (?, ?, ?, ?)", (request.name.strip(), request.unit, request.quantity, request.reorder_threshold))
            product_id = cursor.lastrowid
    except sqlite3.IntegrityError as error:
        raise HTTPException(status_code=400, detail="That product already exists or is invalid.") from error
    with get_connection() as connection:
        product = connection.execute("SELECT id, name, unit, quantity, reorder_threshold FROM products WHERE id = ?", (product_id,)).fetchone()
    return dict(product)


def change_stock(request: InventoryRequest, action: str, user):
    if request.user_id != user["id"]:
        raise HTTPException(status_code=403, detail="The user_id must match the authenticated user.")
    with get_connection() as connection:
        product = connection.execute("SELECT * FROM products WHERE id = ?", (request.product_id,)).fetchone()
        if not product:
            raise HTTPException(status_code=404, detail=f"Product with id {request.product_id} was not found.")
        if product["unit"] not in VALID_UNITS:
            raise HTTPException(status_code=400, detail=f"{product['name']} has an invalid unit.")
        new_quantity = product["quantity"] + request.quantity if action == "ADD" else product["quantity"] - request.quantity
        if new_quantity < 0:
            raise HTTPException(status_code=400, detail=f"Not enough {product['name']} in stock.")
        connection.execute("UPDATE products SET quantity = ? WHERE id = ?", (new_quantity, product["id"]))
        connection.execute("INSERT INTO transactions (product_id, user_id, action, quantity, unit) VALUES (?, ?, ?, ?, ?)", (product["id"], user["id"], action, request.quantity, product["unit"]))
    updated = next(item for item in products() if item["id"] == product["id"])
    return {"message": f"{'Added' if action == 'ADD' else 'Removed'} {request.quantity:g} {product['unit']} of {product['name']}", "product": updated}


@app.post("/api/inventory/add")
def add_inventory(request: InventoryRequest, user=Depends(current_user)):
    return change_stock(request, "ADD", user)


@app.post("/api/inventory/remove")
def remove_inventory(request: InventoryRequest, user=Depends(current_user)):
    return change_stock(request, "REMOVE", user)


@app.get("/api/inventory/history")
def history(_user=Depends(current_user)):
    with get_connection() as connection:
        return [dict(row) for row in connection.execute("SELECT t.*, p.name AS product_name, u.name AS user_name FROM transactions t JOIN products p ON p.id=t.product_id JOIN users u ON u.id=t.user_id ORDER BY t.timestamp DESC, t.id DESC LIMIT 30").fetchall()]


@app.get("/api/stock/low")
def low_stock(_user=Depends(current_user)):
    with get_connection() as connection:
        return [dict(row) for row in connection.execute("SELECT * FROM products WHERE quantity <= reorder_threshold ORDER BY quantity").fetchall()]


@app.post("/api/voice/parse")
def parse_voice_command(request: VoiceParseRequest):
    return parse_command(request.text)


@app.get("/api/analytics/sales")
def sales(_user=Depends(current_user)):
    with get_connection() as connection:
        rows = [dict(row) for row in connection.execute("SELECT p.name AS product, SUM(t.quantity) AS quantity FROM transactions t JOIN products p ON p.id=t.product_id WHERE t.action='REMOVE' GROUP BY p.id ORDER BY quantity DESC").fetchall()]
        total = sum(row["quantity"] for row in rows)
    return {"total_sold": total, "by_product": rows}


@app.get("/api/analytics/top-products")
def top_products(_user=Depends(current_user)):
    return sales(_user)


@app.post("/api/voice/command")
def voice_command(request: VoiceRequest, user=Depends(current_user)):
    parsed = parse_command(request.text)
    intent = parsed.get("action") or parsed.get("intent")
    if parsed.get("needs_clarification") or intent == "CLARIFICATION_REQUIRED":
        return {"status": "clarification", "parsed": parsed, "message": "Please include a product, quantity, and unit."}
    if intent in {"LOW_STOCK", "SALES_ANALYSIS"}:
        return {"status": "ok", "parsed": parsed, "message": "Ask the dashboard to show that report."}
    if intent == "CHECK":
        with get_connection() as connection:
            product = connection.execute("SELECT * FROM products WHERE name = ? COLLATE NOCASE", (parsed.get("product"),)).fetchone()
        if not product:
            return {"status": "error", "parsed": parsed, "message": "I could not find that product."}
        return {"status": "ok", "parsed": parsed, "message": f"{product['name']} has {product['quantity']:g} {product['unit']} in stock."}
    try:
        with get_connection() as connection:
            product = connection.execute("SELECT id FROM products WHERE name = ? COLLATE NOCASE", (parsed["product"],)).fetchone()
        if not product:
            return {"status": "error", "parsed": parsed, "message": "I could not find that product."}
        result = change_stock(InventoryRequest(product_id=product["id"], quantity=parsed["quantity"], user_id=user["id"]), intent, user)
        return {"status": "ok", "parsed": parsed, **result}
    except KeyError:
        return {"status": "clarification", "parsed": parsed, "message": "Please include a product, quantity, and unit."}
