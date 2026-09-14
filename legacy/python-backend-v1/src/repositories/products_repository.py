import json
from datetime import datetime
from pathlib import Path

from src.database.models import Product
from src.repositories.storage import database_session_scope, should_use_json_storage

DEFAULT_PRODUCTS_FILE = Path("outputs/products.json")
PRODUCTS_FILE = DEFAULT_PRODUCTS_FILE


def _use_json_storage() -> bool:
    return should_use_json_storage(PRODUCTS_FILE, DEFAULT_PRODUCTS_FILE)


def normalize_product_record(product: dict) -> dict:
    return {
        "active_ingredient": None,
        "main_target": None,
        "default_defense_days": None,
        "notes": None,
        "is_active": True,
        "created_at": None,
        "updated_at": None,
        **product,
    }


def _product_to_dict(product: Product) -> dict:
    return {
        "id": product.id,
        "name": product.name,
        "product_type": product.product_type,
        "active_ingredient": product.active_ingredient,
        "main_target": product.main_target,
        "default_defense_days": product.default_defense_days,
        "notes": product.notes,
        "is_active": product.is_active,
        "created_at": product.created_at,
        "updated_at": product.updated_at,
    }


def _product_from_dict(product: dict) -> Product:
    product = normalize_product_record(product)

    return Product(
        id=product["id"],
        name=product["name"],
        product_type=product["product_type"],
        active_ingredient=product.get("active_ingredient"),
        main_target=product.get("main_target"),
        default_defense_days=product.get("default_defense_days"),
        notes=product.get("notes"),
        is_active=product.get("is_active", True),
        created_at=product.get("created_at"),
        updated_at=product.get("updated_at"),
    )


def _load_products_json() -> list[dict]:
    if not PRODUCTS_FILE.exists():
        return []

    with open(PRODUCTS_FILE, "r", encoding="utf-8") as file:
        return json.load(file)


def _save_products_json(products: list[dict]) -> None:
    PRODUCTS_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(PRODUCTS_FILE, "w", encoding="utf-8") as file:
        json.dump(products, file, ensure_ascii=False, indent=2)


def list_products(active_only: bool = False) -> list[dict]:
    if _use_json_storage():
        products = [normalize_product_record(product) for product in _load_products_json()]
    else:
        with database_session_scope() as session:
            query = session.query(Product)

            if active_only:
                query = query.filter(Product.is_active.is_(True))

            products = [_product_to_dict(product) for product in query.all()]

    if active_only:
        products = [product for product in products if product.get("is_active", True)]

    return products


def get_product(product_id: str) -> dict | None:
    if _use_json_storage():
        for product in list_products():
            if product["id"] == product_id:
                return normalize_product_record(product)

        return None

    with database_session_scope() as session:
        product = session.get(Product, product_id)

        if product is None:
            return None

        return _product_to_dict(product)


def create_product(product: dict) -> dict:
    product = normalize_product_record(product)

    if _use_json_storage():
        products = list_products()
        products.append(product)
        _save_products_json(products)
        return product

    with database_session_scope() as session:
        session.add(_product_from_dict(product))

    return product


def update_product(product_id: str, updated_product: dict) -> dict | None:
    updated_product = normalize_product_record(updated_product)

    if _use_json_storage():
        products = list_products()

        for index, product in enumerate(products):
            if product["id"] == product_id:
                products[index] = updated_product
                _save_products_json(products)
                return updated_product

        return None

    with database_session_scope() as session:
        current_product = session.get(Product, product_id)

        if current_product is None:
            return None

        session.merge(_product_from_dict(updated_product))
        return updated_product


def deactivate_product(product_id: str) -> dict | None:
    current_product = get_product(product_id)

    if current_product is None:
        return None

    updated_product = {
        **current_product,
        "is_active": False,
        "updated_at": datetime.now().isoformat(timespec="seconds"),
    }

    return update_product(product_id, updated_product)
