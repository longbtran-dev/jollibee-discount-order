import json
import os
import shutil
from pathlib import Path

def main():
    source_dir = Path("outputs/jollibee_menu_2026-11-23")
    source_json_path = source_dir / "jollibee_menu.json"
    source_images_dir = source_dir / "images"

    target_data_dir = Path("data")
    target_data_dir.mkdir(parents=True, exist_ok=True)
    target_json_path = target_data_dir / "menu.json"

    target_images_dir = Path("images")
    if source_images_dir.exists():
        if not target_images_dir.exists():
            shutil.copytree(source_images_dir, target_images_dir)
            print(f"Copied images to {target_images_dir}")

    with open(source_json_path, "r", encoding="utf-8") as f:
        raw_data = json.load(f)

    # Transform all products
    all_products = []
    category_slug_map = {cat.get("slug"): cat.get("name") for cat in raw_data.get("categories", [])}
    category_products_map = {cat_slug: [] for cat_slug in category_slug_map}

    for p in raw_data.get("products", []):
        pid = str(p.get("product_id") or p.get("sku"))
        is_combo = (p.get("type") == "bundle") or bool(p.get("option_groups"))
        
        option_groups = []
        for g in p.get("option_groups", []):
            is_req = bool(g.get("is_required"))
            title = g.get("title", "").strip()
            # Các nhóm Thêm Sốt, Thêm Tương, Thêm Món hoặc không bắt buộc
            is_optional = (not is_req) or title.lower().startswith("thêm")

            options = []
            if is_optional:
                opt_label = "Không thêm (None)"
                if "sốt" in title.lower():
                    opt_label = "Không thêm sốt (None)"
                elif "món" in title.lower():
                    opt_label = "Không thêm món (None)"
                elif "tương" in title.lower():
                    opt_label = "Không thêm tương (None)"

                options.append({
                    "option_id": f"none_{g.get('group_id')}",
                    "name": opt_label,
                    "extra_price": 0,
                    "quantity": 0,
                    "is_default": True,
                    "image": ""
                })

            for sel in g.get("selections", []):
                options.append({
                    "option_id": str(sel.get("selection_id") or sel.get("option_product_id")),
                    "name": sel.get("name", "").strip(),
                    "extra_price": int(sel.get("price_delta_vnd") or 0),
                    "quantity": int(sel.get("quantity") or 1),
                    "is_default": False if is_optional else bool(sel.get("selected_by_default")),
                    "image": sel.get("local_image_path") or ""
                })

            # Đảm bảo chỉ có DUY NHẤT 1 lựa chọn mặc định là option tiêu chuẩn có extra_price == 0
            # Tuyệt đối không để mặc định vào option tăng giá (upsize/phụ thu)
            has_valid_default = False
            for opt in options:
                if opt.get("is_default") and opt.get("extra_price", 0) == 0:
                    has_valid_default = True
                    break

            if not has_valid_default:
                # Xóa toàn bộ flag is_default cũ (tránh trường hợp raw data set default vào option tăng tiền)
                for opt in options:
                    opt["is_default"] = False
                # Đặt mặc định vào option 0đ đầu tiên
                for opt in options:
                    if opt.get("extra_price", 0) == 0:
                        opt["is_default"] = True
                        has_valid_default = True
                        break
                if not has_valid_default and options:
                    options[0]["is_default"] = True
            else:
                # Nếu đã có 1 option 0đ là default, tắt default ở tất cả các option tăng tiền khác
                found_first_default = False
                for opt in options:
                    if opt.get("is_default"):
                        if not found_first_default and opt.get("extra_price", 0) == 0:
                            found_first_default = True
                        else:
                            opt["is_default"] = False
            
            option_groups.append({
                "group_id": str(g.get("group_id")),
                "group_name": title,
                "is_required": bool(g.get("is_required")),
                "is_multi": bool(g.get("is_multi")),
                "options": options
            })

        prod_obj = {
            "id": pid,
            "sku": str(p.get("sku") or ""),
            "name": p.get("name", "").strip(),
            "description": p.get("description", "").strip(),
            "price": int(p.get("display_price_vnd") or p.get("base_price_vnd") or 0),
            "image": p.get("local_image_path") or "",
            "is_combo": is_combo,
            "option_groups": option_groups
        }
        all_products.append(prod_obj)

        for cat in p.get("categories", []):
            c_slug = cat.get("slug")
            if c_slug in category_products_map:
                category_products_map[c_slug].append(prod_obj)

    # Build final categories array
    categories = []
    for cat in raw_data.get("categories", []):
        cat_slug = cat.get("slug")
        cat_name = cat.get("name")
        categories.append({
            "id": cat_slug,
            "slug": cat_slug,
            "name": cat_name,
            "products": category_products_map.get(cat_slug, [])
        })

    output_data = {
        "shop": "Jollibee Vietnam",
        "categories": categories
    }

    with open(target_json_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    total_prods_in_cats = sum(len(c["products"]) for c in categories)
    print(f"Successfully generated {target_json_path} with {len(categories)} categories and {total_prods_in_cats} categorized product items.")

if __name__ == "__main__":
    main()
