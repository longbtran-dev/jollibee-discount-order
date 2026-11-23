# Fast Food Order & Discount Calculation Web App (jollibee-discount-order)

Giao diện web tĩnh hỗ trợ tính toán chiết khấu đơn hàng đồ ăn nhanh, tự động áp dụng ưu đãi theo bậc và xuất đơn gửi qua Zalo / Messenger.

> 🚀 **Demo Trực Tiếp:** [https://longbtran-dev.github.io/jollibee-discount-order/](https://longbtran-dev.github.io/jollibee-discount-order/)

## Tính Năng Nổi Bật
- **Thực đơn trực quan & Tùy biến Combo**: Hiển thị danh mục món ăn, hỗ trợ đổi vị, upsize và tính giá tức thì theo thời gian thực.
- **Báo giá tự động & Minh bạch**:
  - Áp dụng chiết khấu theo bậc đơn hàng (mỗi 100.000đ giảm 15.000đ).
  - Tự động miễn phí giao hàng cho đơn từ 200.000đ (tính trên giá gốc ban đầu).
  - Phân loại đơn linh hoạt: Giao tận nơi (kèm địa chỉ) hoặc Ăn tại quán (không cần thông tin khách).
- **Tạo đơn hàng 1 chạm**: Tự động soạn sẵn tin nhắn đơn hàng có cấu trúc để gửi qua Zalo hoặc Messenger.
- **Hiệu ứng mượt mà & Siêu nhẹ (60fps)**:
  - Tích hợp hiệu ứng pháo hoa chúc mừng (Canvas Confetti siêu nhẹ ~10KB) khi chốt đơn và khi đạt mốc Freeship.
  - Hiệu ứng bay món ăn vào giỏ (Fly to Cart) và nảy giỏ hàng (Cart Bounce) tăng trải nghiệm xúc giác.
  - Thanh tiến trình tích lũy nhận Freeship trực quan.
- **Mobile First**: Giao diện tối ưu hoàn toàn cho thiết bị di động.

## Cấu Hình Hệ Thống (`config.js`)
Các tham số cấu hình liên hệ và chính sách giá được đặt tại `config.js`:
```javascript
window.JOLLIBEE_CONFIG = {
  shopName: "Dịch Vụ Đặt Đồ Ăn Giảm Giá",
  shopSubtitle: "Chiết khấu cao - Đặt nhanh qua Zalo & Facebook",
  zaloPhone: "0900000000",
  zaloLink: "https://zalo.me/0900000000",
  facebookMessengerUrl: "https://m.me/",
  hotline: "0900.000.000",
  discountStep: 100000,
  discountPerStep: 15000,
  freeshipThreshold: 200000,
  standardShippingFee: 10000
};
```

## Chạy Kiểm Thử
Dự án tích hợp sẵn 26 bài kiểm thử tự động với Node.js test runner:
```bash
node --test tests/*.test.js
```

## Triển Khai
Đây là ứng dụng web tĩnh thuần túy (Static Web App), có thể triển khai miễn phí vĩnh viễn qua GitHub Pages, Vercel, Netlify hoặc máy chủ Nginx.
