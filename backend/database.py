import sqlite3
from pathlib import Path

DATABASE_PATH = Path(__file__).parent / "inventory.db"


def get_connection():
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_db():
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                role TEXT NOT NULL CHECK(role IN ('OWNER', 'STAFF')),
                voice_profile TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                unit TEXT NOT NULL,
                quantity REAL NOT NULL DEFAULT 0,
                reorder_threshold REAL NOT NULL DEFAULT 10,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                action TEXT NOT NULL CHECK(action IN ('ADD', 'REMOVE')),
                quantity REAL NOT NULL,
                unit TEXT NOT NULL,
                timestamp TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(product_id) REFERENCES products(id),
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
            """
        )
        if connection.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0:
            connection.execute("INSERT INTO users (name, role) VALUES (?, ?)", ("Asha Rao", "OWNER"))
            connection.execute("INSERT INTO users (name, role) VALUES (?, ?)", ("Ravi Kumar", "STAFF"))
        if connection.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
            products = [("Rice", "Bags", 20, 10), ("Sugar", "Kg", 15, 10), ("Oil", "Litres", 10, 10), ("Biscuits", "Cartons", 5, 10)]
            connection.executemany("INSERT INTO products (name, unit, quantity, reorder_threshold) VALUES (?, ?, ?, ?)", products)
