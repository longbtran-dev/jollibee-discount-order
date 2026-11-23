# Fast Food Order & Discount Calculation Web App

Giao diện web tĩnh hỗ trợ tính toán chiết khấu đơn hàng đồ ăn nhanh, tự động áp dụng ưu đãi theo bậc và xuất đơn gửi qua Zalo / Messenger.

## Tính Năng Chính
- **Thực đơn trực quan**: Hiển thị danh mục món ăn kèm tùy biến combo.
- **Tùy chỉnh Combo**: Hỗ trợ chọn món, nước uống, kích cỡ và hiển thị giá cập nhật theo thời gian thực.
- **Báo giá tự động**:
  - Áp dụng chiết khấu theo bậc đơn hàng (mỗi 100.000đ giảm 15.000đ).
  - Miễn phí giao hàng cho đơn từ 200.000đ.
  - Phân loại đơn giao tận nơi hoặc ăn tại quán.
- **Tạo đơn hàng 1 chạm**: Tự động soạn sẵn tin nhắn đơn hàng có cấu trúc để gửi qua Zalo hoặc Messenger.
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
Dự án tích hợp sẵn các bài kiểm thử tự động với Node.js test runner:
```bash
node --test tests/*.test.js
```

## Triển Khai
Đây là ứng dụng web tĩnh thuần túy (Static Web App), có thể triển khai miễn phí qua GitHub Pages, Vercel hoặc máy chủ Nginx.
