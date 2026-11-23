/**
 * Cấu hình hệ thống đặt hộ Jollibee
 * Chủ cửa hàng có thể dễ dàng chỉnh sửa thông tin tại đây
 */
window.JOLLIBEE_CONFIG = {
  // Thông tin cửa hàng & kênh liên hệ
  shopName: "Dịch Vụ Đặt Hộ Jollibee Giá Rẻ",
  shopSubtitle: "Chiết khấu cao - Đặt nhanh qua Zalo & Facebook",
  zaloPhone: "0900000000",
  zaloLink: "https://zalo.me/0900000000",
  facebookMessengerUrl: "https://m.me/",
  hotline: "0900.000.000",

  // Chính sách giảm giá & phí giao hàng
  discountStep: 100000,
  discountPerStep: 15000,
  freeshipThreshold: 200000, // Miễn phí ship nếu tổng món gốc >= 200k
  standardShippingFee: 10000, // Phí ship 10k nếu tổng món gốc < 200k

  // Thông báo đầu trang & lưu ý OTP
  bannerNotice: "🔥 Ưu đãi đặt hộ: Giảm 15.000đ cho mỗi 100.000đ tiền gốc Jollibee! Đơn từ 200k Freeship toàn quốc!",
  otpReminderNotice: "Lưu ý: Nếu có tin nhắn mã xác thực OTP từ Jollibee gửi về số điện thoại của bạn, vui lòng gửi lại mã đó cho shop qua tin nhắn để hoàn tất đặt đơn nhé!"
};
