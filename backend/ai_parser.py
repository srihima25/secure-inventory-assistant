import json
import os
import re
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

SUPPORTED_ACTIONS = {"ADD", "REMOVE", "CHECK"}
SUPPORTED_UNITS = {"Pieces", "Kg", "Bags", "Cartons", "Boxes", "Dozens", "Litres", "Quintals"}
UNIT_ALIASES = {
    "piece": "Pieces", "pieces": "Pieces", "pc": "Pieces",
    "kg": "Kg", "kilo": "Kg", "kilos": "Kg", "kilogram": "Kg", "kilograms": "Kg",
    "bag": "Bags", "bags": "Bags",
    "carton": "Cartons", "cartons": "Cartons",
    "box": "Boxes", "boxes": "Boxes",
    "dozen": "Dozens", "dozens": "Dozens",
    "litre": "Litres", "litres": "Litres", "liter": "Litres", "liters": "Litres",
    "quintal": "Quintals", "quintals": "Quintals",
}
PRODUCT_ALIASES = {"rice": "Rice", "biyyam": "Rice", "sugar": "Sugar", "oil": "Oil", "biscuits": "Biscuits", "biscuit": "Biscuits"}


def clarification(message="Please specify the product and action."):
    return {"product": None, "action": None, "quantity": None, "unit": None, "needs_clarification": True, "message": message}


def _validated_result(value):
    if not isinstance(value, dict):
        return clarification("I could not understand that command.")
    product = value.get("product")
    action = value.get("action")
    quantity = value.get("quantity")
    unit = value.get("unit")
    if not isinstance(product, str) or not product.strip() or action not in SUPPORTED_ACTIONS:
        return clarification()
    if unit is not None:
        unit = UNIT_ALIASES.get(str(unit).strip().lower(), unit)
        if unit not in SUPPORTED_UNITS:
            return clarification("Please use a supported inventory unit.")
    if quantity is not None:
        try:
            quantity = float(quantity)
        except (TypeError, ValueError):
            return clarification("Quantity must be a positive number.")
        if quantity <= 0:
            return clarification("Quantity must be a positive number.")
        if quantity.is_integer():
            quantity = int(quantity)
    if action in {"ADD", "REMOVE"} and (quantity is None or unit is None):
        return clarification("Please specify the quantity and unit.")
    if action == "CHECK":
        quantity = None
        unit = None
    return {"product": product.strip(), "action": action, "quantity": quantity, "unit": unit, "needs_clarification": False}


def _extract_json(text):
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.IGNORECASE)
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        return json.loads(match.group(0)) if match else None


def _fallback_parse(text):
    lowered = text.lower()
    product = next((canonical for alias, canonical in PRODUCT_ALIASES.items() if re.search(rf"\b{re.escape(alias)}\b", lowered)), None)
    quantity_match = re.search(r"\b(\d+(?:\.\d+)?)\b", lowered)
    unit = next((canonical for alias, canonical in UNIT_ALIASES.items() if re.search(rf"\b{re.escape(alias)}\b", lowered)), None)
    if any(term in lowered for term in ("stock", "inventory", "kitna", "entha")):
        return _validated_result({"product": product, "action": "CHECK", "quantity": None, "unit": None}) if product else clarification()
    if any(term in lowered for term in ("remove", "sell", "sold", "sell chesanu", "nikalo")):
        action = "REMOVE"
    elif any(term in lowered for term in ("add", "vachayi", "vachai", "karo", "cheyyi", "came")):
        action = "ADD"
    else:
        return clarification("Please specify ADD, REMOVE, or CHECK.")
    return _validated_result({
        "product": product,
        "action": action,
        "quantity": float(quantity_match.group(1)) if quantity_match else None,
        "unit": unit,
    }) if product else clarification()


def parse_command(text: str):
    if not isinstance(text, str) or not text.strip():
        return clarification("Please provide a voice command.")
    api_key = os.getenv("GEMINI_API_KEY", "")
    if api_key and not api_key.startswith("your_"):
        try:
            from google import genai

            client = genai.Client(api_key=api_key)
            prompt = f"""You convert multilingual inventory speech into JSON only. Do not call tools or access databases.
Supported actions: ADD, REMOVE, CHECK. Supported units: Pieces, Kg, Bags, Cartons, Boxes, Dozens, Litres, Quintals.
Return exactly these fields: product (string or null), action (ADD, REMOVE, CHECK, or null), quantity (positive number or null), unit (supported unit or null).
Do not invent missing values. For CHECK, quantity and unit must be null.
Examples: Rice 10 bags add cheyyi -> {{"product":"Rice","action":"ADD","quantity":10,"unit":"Bags"}}; Biyyam 5 bags vachayi -> Rice, ADD, 5, Bags; Rice ka stock kitna hai -> Rice, CHECK, null, null.
Input: {text}"""
            response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
            result = _validated_result(_extract_json(response.text))
            if not result.get("needs_clarification"):
                return result
        except Exception:
            pass
    return _fallback_parse(text)
