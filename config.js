/**
 * Cấu hình hệ thống đặt hộ Jollibee (longbtran.shop)
 * Chủ cửa hàng chỉ cần chỉnh sửa tại file duy nhất này để cập nhật thông tin liên hệ,
 * dòng chữ chạy đầu trang, link video hướng dẫn, feedback khách hàng & chính sách.
 */
window.JOLLIBEE_CONFIG = {
  // 1. Thông tin cửa hàng & kênh liên hệ chính thức
  shopName: "longbtran.shop - Đặt Hộ Jollibee Giá Rẻ",
  shopSubtitle: "Chiết khấu cao - Đặt nhanh qua Zalo & Facebook",
  zaloPhone: "0985194873",
  zaloLink: "https://zalo.me/0985194873",
  facebookUrl: "https://www.facebook.com/trnblng",
  facebookMessengerUrl: "https://m.me/trnblng",
  hotline: "0985194873",
  enableContentProtection: true, // Chống F12 / Ctrl+U / Chuột phải sao chép giao diện (đổi thành false khi chủ shop cần tự kiểm tra)

  // 2. Chính sách giảm giá & phí giao hàng
  discountStep: 100000,
  discountPerStep: 15000,
  freeshipThreshold: 200000, // Miễn phí ship nếu tổng món gốc >= 200k
  standardShippingFee: 10000, // Phí ship 10k nếu tổng món gốc < 200k

  // 3. Dòng chữ chạy liên tục từ phải sang trái trên đầu trang (có thể thêm/bớt câu tùy ý)
  bannerNotice: "Giảm 15.000đ cho mỗi 100k tiền gốc Jollibee • Đơn từ 200k Freeship!",
  bannerMessages: [
    "🔥 Giảm ngay 15.000đ cho mỗi 100.000đ tiền gốc Jollibee",
    "🛵 Đơn từ 200.000đ được FREESHIP tận nơi",
    "🍗 Cam kết 100% đặt trực tiếp từ cửa hàng Jollibee chính hãng, nóng giòn",
    "⏱ Thời gian chuẩn bị đơn hàng ít nhất 30 phút tính từ lúc đặt thành công",
    "💬 Hỗ trợ chốt đơn nhanh qua Zalo 0985194873 & Facebook"
  ],
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
  },

  // 7. Link Video hướng dẫn đặt đơn (Khi quay xong video YouTube / Shorts hoặc file .mp4, dán link vào đây là tự hiện!)
  guideVideoUrl: "",

  // 8. Đánh giá / Feedback từ khách hàng cũ (có thể thêm trường image: "images/ten-anh.jpg" nếu muốn đính kèm ảnh bill/chat)
  customerReviews: [
    {
      author: "Nguyễn Minh Anh",
      tag: "Đặt Combo Cặp Đôi Ăn Ý",
      date: "Khách quen qua Zalo",
      rating: 5,
      comment: "Đặt hộ cực nhanh, shipper Jollibee giao tới gà vẫn nóng bỏng tay mà tiết kiệm được hẳn 15k–30k mỗi lần ăn!"
    },
    {
      author: "Trần Quốc Bảo",
      tag: "Đặt đơn nhóm văn phòng 320k",
      date: "Khách đặt qua Facebook",
      rating: 5,
      comment: "Cả phòng gom đơn hơn 300k được giảm tận 45k lại còn Freeship tận sảnh công ty. Chủ shop phản hồi tin nhắn siêu nhiệt tình."
    },
    {
      author: "Lê Thu Hà",
      tag: "Ăn tại quán Jollibee",
      date: "Khách hẹn giờ tới lấy",
      rating: 5,
      comment: "Hẹn giờ trước 30 phút xong ra thẳng quầy Jollibee đọc mã nhận đồ ăn liền, không phải xếp hàng chờ lâu mà giá rẻ hơn mua trực tiếp."
    },
    {
      author: "Phạm Hoàng Nam",
      tag: "Đặt Combo Cả Nhà No Nê",
      date: "Khách quen cuối tuần",
      rating: 5,
      comment: "Web dễ chọn món như app thật, đổi vị gà sốt cay hay nước ngọt đều rõ ràng, bấm sao chép gửi Zalo 1 phút là xong đơn!"
    }
  ],

  // 9. Chính sách đặt hộ & Cam kết uy tín của Shop
  shopPolicies: [
    {
      title: "1. Cam kết 100% Jollibee chính hãng",
      desc: "Mọi đơn hàng đều được shop đặt trực tiếp trên hệ thống chính thức của Jollibee Việt Nam và chuẩn bị mới tại chi nhánh gần bạn nhất."
    },
    {
      title: "2. Chính sách chiết khấu & Phí giao hàng",
      desc: "Áp dụng cho đơn từ 100.000đ trở lên: Cứ mỗi 100.000đ tiền gốc được giảm ngay 15.000đ. Đơn giao tận nơi dưới 200k phí ship chỉ 10.000đ, từ 200.000đ trở lên được FREESHIP 100% (Ăn tại quán luôn 0đ ship)."
    },
    {
      title: "3. Thời gian chuẩn bị đơn hàng (Ít nhất 30 phút)",
      desc: "Để món ăn luôn nóng giòn mới ra lò, thời gian cửa hàng chuẩn bị đơn là ít nhất 30 phút tính từ lúc shop xác nhận đặt hàng thành công."
    },
    {
      title: "4. Hỗ trợ tận tâm & Bảo vệ quyền lợi khách hàng",
      desc: "Shop kiểm tra kỹ từng tùy chọn vị gà, nước uống trước khi lên đơn. Nếu cần hỗ trợ gấp hoặc kiểm tra trạng thái đơn, bạn có thể nhắn Zalo hoặc gọi trực tiếp 0985194873 bất cứ lúc nào."
    }
  ]
};
