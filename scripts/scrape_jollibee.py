from __future__ import annotations

import csv
import hashlib
import json
import mimetypes
import re
import time
import unicodedata
from collections import OrderedDict
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import requests
from bs4 import BeautifulSoup, Tag


BASE_URL = "https://jollibee.com.vn"
CATEGORIES = OrderedDict(
    [
        ("mon-moi-mon-ngon", "Món Mới - Món Ngon"),
        ("ga-gion-vui-ve", "Gà Giòn Vui Vẻ"),
        ("mi-y-sot-bo-bam", "Mì Ý Sốt Bò Bằm"),
        ("ga-sot-cay", "Gà Sốt Cay"),
        ("burger-com", "Burger & Cơm"),
        ("phan-an-phu", "Phần Ăn Phụ"),
        ("mon-trang-mieng", "Món Tráng Miệng"),
        ("thuc-uong", "Thức Uống"),
    ]
)


def clean_text(value: str | None) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def slugify(value: str, max_length: int = 70) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_value = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value).strip("-").lower()
    return (ascii_value or "image")[:max_length].rstrip("-")


def original_image_url(url: str) -> str:
    return re.sub(
        r"/media/catalog/product/cache/[0-9a-f]+/",
        "/media/catalog/product/",
        url,
        flags=re.IGNORECASE,
    )


def parse_json(text: str) -> dict | None:
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None


def as_item(value: str | Tag) -> Tag:
    if isinstance(value, Tag):
        return value
    soup = BeautifulSoup(value, "html.parser")
    item = soup.select_one("li.product-item")
    if not item:
        raise ValueError("Không tìm thấy li.product-item")
    return item


def find_product_url(item: Tag) -> str | None:
    trigger = item.select_one(".js-quickview-trigger[data-mage-init]")
    if trigger:
        config = parse_json(trigger.get("data-mage-init", "")) or {}
        for module_name, module_config in config.items():
            if "popup-product-view" in module_name and isinstance(module_config, dict):
                if module_config.get("action"):
                    return str(module_config["action"])

    button = item.select_one("button[onclick*='addToCartClicked']")
    if button:
        urls = re.findall(r"https://jollibee\.com\.vn/[^'\"]+", button.get("onclick", ""))
        if urls and not urls[-1].endswith("/pilot.html"):
            return urls[-1]
    return None


def parse_listing_product(value: str | Tag, category_slug: str, category_name: str) -> dict:
    item = as_item(value)
    info = item.select_one(".product-item-info")
    name = item.select_one(".product-item-name-text")
    description = item.select_one(".product-item-description")
    image = item.select_one("img.product-image-photo")
    price_nodes = item.select("[data-price-amount]")
    prices = [int(round(float(node.get("data-price-amount", 0)))) for node in price_nodes]

    return {
        "product_id": clean_text(info.get("data-id", "") if info else ""),
        "sku": clean_text(item.get("data-product-item", "")),
        "type": clean_text(item.get("data-type", "")),
        "name": clean_text(name.get_text(" ") if name else ""),
        "description": clean_text(description.get_text(" ") if description else ""),
        "display_price_vnd": prices[0] if prices else None,
        "price_from_vnd": prices[0] if prices else None,
        "price_to_vnd": prices[-1] if prices else None,
        "listing_image_url": image.get("src") if image else None,
        "product_url": find_product_url(item),
        "categories": [{"slug": category_slug, "name": category_name}],
        "gallery_image_urls": [],
        "base_price_vnd": None,
        "default_price_calculated_vnd": None,
        "option_groups": [],
    }


def find_bundle_config(soup: BeautifulSoup) -> dict | None:
    for script in soup.find_all("script", attrs={"type": "text/x-magento-init"}):
        text = script.string or script.get_text()
        if '"priceBundle"' not in text:
            continue
        config = parse_json(text)
        if not config:
            continue
        for target in config.values():
            if isinstance(target, dict) and isinstance(target.get("priceBundle"), dict):
                option_config = target["priceBundle"].get("optionConfig")
                if isinstance(option_config, dict):
                    return option_config
    return None


def find_option_container(field: Tag | None) -> Tag | None:
    node = field
    while node:
        classes = node.get("class", []) if isinstance(node, Tag) else []
        if "field" in classes and "option" in classes:
            return node
        node = node.parent if isinstance(node, Tag) else None
    return None


def extract_gallery_urls(soup: BeautifulSoup) -> list[str]:
    urls: list[str] = []
    for node in soup.select("[data-gallery-role='gallery-placeholder'][data-mage-init]"):
        config = parse_json(node.get("data-mage-init", "")) or {}
        for module_config in config.values():
            if not isinstance(module_config, dict):
                continue
            for image in module_config.get("data", []):
                if not isinstance(image, dict):
                    continue
                candidate = image.get("full") or image.get("img") or image.get("thumb")
                if candidate and candidate not in urls:
                    urls.append(candidate)
    return urls


def parse_bundle_detail(value: str | BeautifulSoup) -> dict:
    soup = value if isinstance(value, BeautifulSoup) else BeautifulSoup(value, "html.parser")
    config = find_bundle_config(soup)
    if not config:
        return {
            "base_price_vnd": None,
            "default_price_calculated_vnd": None,
            "option_groups": [],
            "gallery_image_urls": extract_gallery_urls(soup),
        }

    selected = {
        str(group_id): {str(selection_id) for selection_id in selection_ids}
        for group_id, selection_ids in config.get("selected", {}).items()
    }
    groups: list[dict] = []
    selected_delta = 0

    sorted_groups = sorted(config.get("options", {}).items(), key=lambda pair: pair[1].get("position", 9999))
    for group_id, group_data in sorted_groups:
        group_id = str(group_id)
        field = soup.select_one(f"[name='bundle_option[{group_id}]']")
        container = find_option_container(field)
        is_required = bool(
            field
            and (
                field.has_attr("data-validate")
                or (container and "required" in container.get("class", []))
            )
        )
        selections: list[dict] = []

        for selection_id, selection_data in group_data.get("selections", {}).items():
            selection_id = str(selection_id)
            choice = soup.select_one(f"#bundle-option-{group_id}-{selection_id}")
            label = soup.select_one(f"label[for='bundle-option-{group_id}-{selection_id}']")
            image = label.select_one("img") if label else None
            amount = selection_data.get("prices", {}).get("finalPrice", {}).get("amount", 0)
            price_delta = int(round(float(amount or 0)))
            quantity = int(selection_data.get("qty") or 1)
            is_selected = selection_id in selected.get(group_id, set())
            if is_selected:
                selected_delta += price_delta * quantity
            selections.append(
                {
                    "selection_id": selection_id,
                    "option_product_id": str(selection_data.get("optionId", "")),
                    "name": clean_text(selection_data.get("name", "")),
                    "price_delta_vnd": price_delta,
                    "quantity": quantity,
                    "selected_by_default": is_selected,
                    "image_url": image.get("src") if image else None,
                    "input_type": choice.get("type") if choice else None,
                }
            )

        groups.append(
            {
                "group_id": group_id,
                "title": clean_text(group_data.get("title", "")),
                "position": int(group_data.get("position", 0)),
                "is_required": is_required,
                "is_multi": bool(group_data.get("isMulti", False)),
                "selections": selections,
            }
        )

    amount = config.get("prices", {}).get("finalPrice", {}).get("amount")
    base_price = int(round(float(amount))) if amount is not None else None
    return {
        "base_price_vnd": base_price,
        "default_price_calculated_vnd": base_price + selected_delta if base_price is not None else None,
        "option_groups": groups,
        "gallery_image_urls": extract_gallery_urls(soup),
    }


def extension_for(url: str, content_type: str | None) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix in {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"}:
        return ".jpg" if suffix == ".jpeg" else suffix
    guessed = mimetypes.guess_extension((content_type or "").split(";", 1)[0].strip())
    return ".jpg" if guessed == ".jpe" else (guessed or ".bin")


def download_image(
    session: requests.Session, url: str, output_dir: Path, relative_stem: Path
) -> tuple[str | None, str]:
    candidates: list[str] = []
    for candidate in (original_image_url(url), url):
        if candidate not in candidates:
            candidates.append(candidate)

    last_error = ""
    for candidate in candidates:
        try:
            response = session.get(candidate, timeout=45)
            response.raise_for_status()
            content_type = response.headers.get("Content-Type", "")
            if not content_type.startswith("image/"):
                raise ValueError(f"Unexpected content type: {content_type}")
            relative_path = relative_stem.with_suffix(extension_for(candidate, content_type))
            target = output_dir / relative_path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(response.content)
            return relative_path.as_posix(), candidate
        except Exception as exc:
            last_error = str(exc)
    return None, last_error


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8-sig")
        return
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def scrape(output_dir: Path) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
            "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
        }
    )

    products: OrderedDict[str, dict] = OrderedDict()
    categories: list[dict] = []
    source_urls: list[str] = []

    for category_slug, fallback_name in CATEGORIES.items():
        category_url = f"{BASE_URL}/{category_slug}.html"
        response = session.get(category_url, timeout=45)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        title = soup.select_one("h1.page-title span")
        category_name = clean_text(title.get_text(" ") if title else fallback_name) or fallback_name
        items = soup.select("li.product-item")
        categories.append(
            {"slug": category_slug, "name": category_name, "url": category_url, "listing_count": len(items)}
        )
        source_urls.append(category_url)

        for item in items:
            product = parse_listing_product(item, category_slug, category_name)
            key = product["sku"] or product["product_id"]
            if key in products:
                known = {entry["slug"] for entry in products[key]["categories"]}
                if category_slug not in known:
                    products[key]["categories"].append({"slug": category_slug, "name": category_name})
            else:
                products[key] = product
        time.sleep(0.1)

    for index, product in enumerate(products.values(), start=1):
        if product["type"] == "bundle" and product.get("product_url"):
            response = session.get(product["product_url"], timeout=45)
            response.raise_for_status()
            product.update(parse_bundle_detail(BeautifulSoup(response.text, "html.parser")))
            source_urls.append(product["product_url"])
            time.sleep(0.1)
        print(f"Parsed {index}/{len(products)}: {product['name']}")

    option_image_cache: dict[str, tuple[str | None, str]] = {}
    image_rows: list[dict] = []
    for product in products.values():
        image_url = product.get("listing_image_url")
        if image_url:
            relative_stem = Path("images/products") / (
                f"{slugify(product['sku'], 35)}_{slugify(product['name'], 55)}"
            )
            local_path, resolved = download_image(session, image_url, output_dir, relative_stem)
            product["local_image_path"] = local_path
            product["resolved_image_url"] = resolved if local_path else None
            image_rows.append(
                {
                    "kind": "product",
                    "product_sku": product["sku"],
                    "product_name": product["name"],
                    "group_title": "",
                    "option_name": "",
                    "source_url": image_url,
                    "downloaded_url": resolved if local_path else "",
                    "local_path": local_path or "",
                    "status": "ok" if local_path else resolved,
                }
            )

        for group in product.get("option_groups", []):
            for selection in group["selections"]:
                option_url = selection.get("image_url")
                if not option_url:
                    selection["local_image_path"] = None
                    continue
                cache_key = selection.get("option_product_id") or hashlib.sha1(
                    option_url.encode("utf-8")
                ).hexdigest()[:12]
                if cache_key not in option_image_cache:
                    relative_stem = Path("images/options") / (
                        f"{slugify(cache_key, 24)}_{slugify(selection['name'], 65)}"
                    )
                    option_image_cache[cache_key] = download_image(
                        session, option_url, output_dir, relative_stem
                    )
                local_path, resolved = option_image_cache[cache_key]
                selection["local_image_path"] = local_path
                selection["resolved_image_url"] = resolved if local_path else None
                image_rows.append(
                    {
                        "kind": "option",
                        "product_sku": product["sku"],
                        "product_name": product["name"],
                        "group_title": group["title"],
                        "option_name": selection["name"],
                        "source_url": option_url,
                        "downloaded_url": resolved if local_path else "",
                        "local_path": local_path or "",
                        "status": "ok" if local_path else resolved,
                    }
                )

    product_rows: list[dict] = []
    option_rows: list[dict] = []
    for product in products.values():
        product_rows.append(
            {
                "product_id": product["product_id"],
                "sku": product["sku"],
                "type": product["type"],
                "name": product["name"],
                "description": product["description"],
                "categories": " | ".join(entry["name"] for entry in product["categories"]),
                "display_price_vnd": product["display_price_vnd"],
                "base_price_vnd": product["base_price_vnd"],
                "default_price_calculated_vnd": product["default_price_calculated_vnd"],
                "price_from_vnd": product["price_from_vnd"],
                "price_to_vnd": product["price_to_vnd"],
                "option_group_count": len(product["option_groups"]),
                "option_count": sum(len(group["selections"]) for group in product["option_groups"]),
                "product_url": product.get("product_url") or "",
                "image_url": product.get("resolved_image_url") or product.get("listing_image_url") or "",
                "local_image_path": product.get("local_image_path") or "",
            }
        )
        for group in product["option_groups"]:
            for selection in group["selections"]:
                option_rows.append(
                    {
                        "product_id": product["product_id"],
                        "product_sku": product["sku"],
                        "product_name": product["name"],
                        "group_id": group["group_id"],
                        "group_title": group["title"],
                        "group_position": group["position"],
                        "group_required": group["is_required"],
                        "group_multi": group["is_multi"],
                        "selection_id": selection["selection_id"],
                        "option_product_id": selection["option_product_id"],
                        "option_name": selection["name"],
                        "price_delta_vnd": selection["price_delta_vnd"],
                        "quantity": selection["quantity"],
                        "selected_by_default": selection["selected_by_default"],
                        "image_url": selection.get("resolved_image_url") or selection.get("image_url") or "",
                        "local_image_path": selection.get("local_image_path") or "",
                        "product_url": product.get("product_url") or "",
                    }
                )

    captured_at = datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).isoformat(timespec="seconds")
    payload = {
        "source": BASE_URL,
        "captured_at": captured_at,
        "currency": "VND",
        "category_count": len(categories),
        "unique_product_count": len(products),
        "bundle_product_count": sum(1 for product in products.values() if product["type"] == "bundle"),
        "option_row_count": len(option_rows),
        "categories": categories,
        "products": list(products.values()),
        "source_urls": list(OrderedDict.fromkeys(source_urls)),
        "notes": [
            "Giá có thể thay đổi theo thời điểm, khu vực và cửa hàng được chọn.",
            "display_price_vnd là giá hiển thị trên trang danh mục; base_price_vnd của combo chưa gồm phụ thu option mặc định.",
            "price_delta_vnd là phần chênh lệch công khai cho từng lựa chọn.",
        ],
    }
    (output_dir / "jollibee_menu.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_csv(output_dir / "products.csv", product_rows)
    write_csv(output_dir / "options.csv", option_rows)
    write_csv(output_dir / "images.csv", image_rows)

    summary = {
        "captured_at": captured_at,
        "categories": len(categories),
        "listing_rows": sum(category["listing_count"] for category in categories),
        "unique_products": len(products),
        "bundle_products": sum(1 for product in products.values() if product["type"] == "bundle"),
        "option_groups": sum(len(product["option_groups"]) for product in products.values()),
        "option_rows": len(option_rows),
        "product_images_downloaded": sum(
            1 for row in image_rows if row["kind"] == "product" and row["status"] == "ok"
        ),
        "unique_option_images_downloaded": sum(1 for local, _ in option_image_cache.values() if local),
        "image_failures": sum(1 for row in image_rows if row["status"] != "ok"),
    }
    (output_dir / "scrape_summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return summary


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    output_dir = root / "outputs" / "jollibee_menu_2026-11-23"
    summary = scrape(output_dir)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
