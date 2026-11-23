import unittest

from scripts.scrape_jollibee import (
    clean_text,
    original_image_url,
    parse_bundle_detail,
    parse_listing_product,
)


class ScrapeJollibeeTests(unittest.TestCase):
    def test_clean_text_collapses_whitespace_without_losing_vietnamese(self):
        self.assertEqual(clean_text("  Gà\n  Giòn   Vui Vẻ "), "Gà Giòn Vui Vẻ")

    def test_original_image_url_removes_magento_cache_segment(self):
        cached = (
            "https://jollibee.com.vn/media/catalog/product/cache/"
            "9011257231b13517d19d9bae81fd87cc/6/6/66k_-_2_cjoy.png"
        )
        self.assertEqual(
            original_image_url(cached),
            "https://jollibee.com.vn/media/catalog/product/6/6/66k_-_2_cjoy.png",
        )

    def test_parse_listing_product_reads_simple_product_price_and_image(self):
        html = """
        <li class="product-item product-item_simple" data-product-item="1810003" data-type="simple">
          <div class="product-item-info" data-id="544">
            <img class="product-image-photo" src="https://img.example/ga.png">
            <span class="product-item-name-text">2 miếng Gà Giòn Vui Vẻ</span>
            <div class="product-item-description">2 miếng Gà + 2 Tương</div>
            <span data-price-amount="66000"><span class="price">66,000 ₫</span></span>
          </div>
        </li>
        """
        product = parse_listing_product(html, "ga-gion-vui-ve", "Gà Giòn Vui Vẻ")
        self.assertEqual(product["sku"], "1810003")
        self.assertEqual(product["display_price_vnd"], 66000)
        self.assertEqual(product["price_to_vnd"], 66000)
        self.assertEqual(product["listing_image_url"], "https://img.example/ga.png")

    def test_parse_listing_product_reads_bundle_range_and_detail_url(self):
        html = """
        <li class="product-item product-item_bundle" data-product-item="2810016" data-type="bundle">
          <div class="product-item-info" data-id="24">
            <img class="product-image-photo" src="https://img.example/combo.png">
            <span class="product-item-name-text">Combo Gà</span>
            <div class="product-item-description">2 Gà + Khoai + Nước</div>
            <span data-price-amount="91000">91,000 ₫</span>
            <span data-price-amount="150000">150,000 ₫</span>
            <span class="js-quickview-trigger" data-mage-init='{
              "Levinci_Catalog/js/popup-product-view": {
                "action": "https://jollibee.com.vn/combo-ga.html", "product_id": 24
              }}'></span>
          </div>
        </li>
        """
        product = parse_listing_product(html, "ga-gion-vui-ve", "Gà Giòn Vui Vẻ")
        self.assertEqual(product["price_from_vnd"], 91000)
        self.assertEqual(product["price_to_vnd"], 150000)
        self.assertEqual(product["product_url"], "https://jollibee.com.vn/combo-ga.html")

    def test_parse_bundle_detail_reads_default_selection_and_price_delta(self):
        html = """
        <form id="product_addtocart_form">
          <script type="text/x-magento-init">{
            "#product_addtocart_form": {"priceBundle": {"optionConfig": {
              "options": {
                "13": {"title": "Chọn Khoai", "position": 0, "isMulti": false,
                  "selections": {
                    "35": {"qty": 1, "optionId": "7", "name": "Khoai tây chiên vừa",
                      "prices": {"finalPrice": {"amount": 0}}},
                    "1229": {"qty": 1, "optionId": "110", "name": "Khoai tây chiên lớn (up)",
                      "prices": {"finalPrice": {"amount": 10000}}}
                  }},
                "14": {"title": "Chọn nước", "position": 1, "isMulti": false,
                  "selections": {
                    "1232": {"qty": 1, "optionId": "95", "name": "Pepsi lớn (up)",
                      "prices": {"finalPrice": {"amount": 5000}}},
                    "36": {"qty": 1, "optionId": "9", "name": "Pepsi vừa",
                      "prices": {"finalPrice": {"amount": 0}}}
                  }}
              },
              "selected": {"13": ["35"], "14": ["1232"]},
              "prices": {"finalPrice": {"amount": 86000}}
            }}}
          }</script>
          <div class="field option required">
            <input id="bundle-option-13-35" name="bundle_option[13]" type="radio" data-validate="required">
            <label for="bundle-option-13-35"><img src="https://img.example/fries-medium.png"></label>
            <input id="bundle-option-13-1229" name="bundle_option[13]" type="radio">
            <label for="bundle-option-13-1229"><img src="https://img.example/fries-large.png"></label>
          </div>
          <div class="field option required">
            <input id="bundle-option-14-1232" name="bundle_option[14]" type="radio" data-validate="required">
            <label for="bundle-option-14-1232"><img src="https://img.example/pepsi-large.png"></label>
            <input id="bundle-option-14-36" name="bundle_option[14]" type="radio">
            <label for="bundle-option-14-36"><img src="https://img.example/pepsi-medium.png"></label>
          </div>
        </form>
        """
        parsed = parse_bundle_detail(html)
        self.assertEqual(parsed["base_price_vnd"], 86000)
        self.assertEqual(parsed["default_price_calculated_vnd"], 91000)
        self.assertEqual([group["title"] for group in parsed["option_groups"]], ["Chọn Khoai", "Chọn nước"])
        large_fries = parsed["option_groups"][0]["selections"][1]
        self.assertEqual(large_fries["price_delta_vnd"], 10000)
        self.assertFalse(large_fries["selected_by_default"])
        self.assertEqual(large_fries["image_url"], "https://img.example/fries-large.png")
        self.assertTrue(parsed["option_groups"][0]["is_required"])


if __name__ == "__main__":
    unittest.main()
