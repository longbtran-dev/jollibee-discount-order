/**
 * Cấu hình hệ thống đặt hộ Jollibee (longbtran.shop)
 * Chủ cửa hàng chỉ cần chỉnh sửa tại file duy nhất này để cập nhật thông tin, chính sách,
 * thứ tự món ưu tiên và nhãn "Bán chạy" mà không sợ bị mất khi cập nhật lại thực đơn.
 */
window.JOLLIBEE_CONFIG = {
  // 1. Thông tin cửa hàng & kênh liên hệ
  shopName: "longbtran.shop - Đặt Hộ Jollibee Giá Rẻ",
  shopSubtitle: "Chiết khấu cao - Đặt nhanh qua Zalo & Facebook",
  zaloPhone: "0900000000",
  zaloLink: "https://zalo.me/0900000000",
  facebookMessengerUrl: "https://m.me/",
  hotline: "0900.000.000",

  // 2. Chính sách giảm giá & phí giao hàng
  discountStep: 100000,
  discountPerStep: 15000,
  freeshipThreshold: 200000, // Miễn phí ship nếu tổng món gốc >= 200k
  standardShippingFee: 10000, // Phí ship 10k nếu tổng món gốc < 200k

  // 3. Thông báo đầu trang & chính sách đơn tối thiểu
  bannerNotice: "Giảm 15.000đ cho mỗi 100k tiền gốc Jollibee • Đơn từ 200k Freeship!",
  minOrderNotice: "Lưu ý: Đơn hàng phải từ 100.000đ trở lên shop mới có thể hỗ trợ đặt giảm giá giúp bạn được nhé!",

  // 4. Tuỳ chỉnh tên hiển thị của danh mục (slug danh mục : Tên hiển thị mới)
  categoryTitleOverrides: {
    "mon-moi-mon-ngon": "Combo Bán Chạy Nhất"
  },

  // 5. Thứ tự ưu tiên món trong danh mục (mã ID liệt kê trước sẽ tự động đẩy lên đầu)
  priorityProductIds: [
    "158", // #1: Cặp Đôi Ăn Ý (145k -> 130k)
    "680", // #2: Càng Cay Càng Mê (157k -> 142k)
    "143", // #3: Cả Nhà No Nê (185k -> 170k)
    "679", // #4: Một Mình Hít Hà (80k)
    "36"   // #5: Một Mình Ăn Ngon (73k)
  ],

  // 6. Nhãn nổi bật gắn trên thẻ món (mã ID món : nội dung nhãn; để "" nếu muốn ẩn nhãn)
  productBadges: {
    "158": "Bán chạy #1",
    "680": "Khách hay gọi",
    "143": "Khách hay gọi"
  }
};
