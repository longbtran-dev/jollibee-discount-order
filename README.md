# Website Báo Giá & Đặt Hộ Jollibee Giá Rẻ

Website phục vụ dịch vụ đặt đồ ăn Jollibee chiết khấu cao, thiết kế chuẩn nhận diện thương hiệu Jollibee (Đỏ - Vàng - Kem), tối ưu hóa trải nghiệm trên điện thoại thông minh (Mobile First) cho đối tượng khách hàng bình dân ("low-tech").

---

## 🌟 Tính Năng Nổi Bật

1. **Thực đơn đầy đủ 8 danh mục chính hãng:**
   - Combo Bán Chạy, Gà Giòn Vui Vẻ, Mì Ý Jolly, Gà Sốt Cay, Burger & Cơm, Phần Ăn Phụ, Món Tráng Miệng, Thức Uống.
   - Hình ảnh sắc nét, mô tả thành phần món ăn rõ ràng.

2. **Bộ tùy biến Combo đa tầng (Accordion Modal):**
   - Cho phép khách chọn từng món trong combo (chọn miếng gà, đổi vị khoai, upsize mì ý, đổi nước ngọt).
   - Tự động cộng tiền phụ thu và cập nhật tổng giá combo tức thì theo thời gian thực.

3. **Báo giá tự động & Minh bạch theo chính sách:**
   - **Chiết khấu:** Cứ mỗi 100.000đ giá gốc Jollibee sẽ được giảm 15.000đ (100k giảm 15k, 200k giảm 30k, 300k giảm 45k,...).
   - **Phí giao hàng (Tính trên giá gốc ban đầu):**
     - Đơn giao tận nơi từ 200.000đ trở lên: **Miễn Phí Ship (0đ)** (kể cả sau giảm giá tiền thanh toán dưới 200k).
     - Đơn giao tận nơi dưới 200.000đ: **Phí ship 10.000đ**.
     - Đơn ăn tại quán: **Phí ship 0đ**.
   - Bảng báo giá hiển thị rõ ràng 4 dòng: Tiền gốc - Chiết khấu - Phí ship - Khách thực thanh toán.

4. **Chuyển đổi linh hoạt 2 hình thức nhận hàng:**
   - **Giao tận nơi:** Nhập Họ tên, Số điện thoại và Địa chỉ giao hàng.
   - **Ăn tại quán / Tới lấy:** Nhập Họ tên, Số điện thoại và Ghi chú (chủ shop chủ động nhắn tin xác nhận chi nhánh).

5. **Xuất đơn tiện lợi chỉ với 1 chạm:**
   - Nút **"Gửi Qua Zalo"**: Tự động mở khung chat Zalo kèm tin nhắn soạn sẵn chi tiết từng món.
   - Nút **"Gửi Messenger"**: Tự động mở chat Facebook Messenger với fanpage của bạn.
   - Nút **"Sao Chép Đơn"**: Sao chép nội dung vào bộ nhớ tạm kèm thông báo Toast.

---

## ⚙️ Hướng Dẫn Tùy Chỉnh Thông Tin (`config.js`)

Mọi thông tin liên hệ và chính sách giá được đặt tập trung trong file `config.js` ở thư mục gốc:

```javascript
window.JOLLIBEE_CONFIG = {
  shopName: "Dịch Vụ Đặt Hộ Jollibee Giá Rẻ",
  shopSubtitle: "Chiết khấu cao - Đặt nhanh qua Zalo & Facebook",
  zaloPhone: "0900000000",                        // SĐT Zalo nhận đơn
  zaloLink: "https://zalo.me/0900000000",         // Link Zalo của bạn
  facebookMessengerUrl: "https://m.me/yourpage",  // Link Facebook Messenger của bạn
  hotline: "0900.000.000",                        // Số hotline hiển thị trên web
  
  discountStep: 100000,                           // Mức mệnh giá tính giảm (100.000đ)
  discountPerStep: 15000,                         // Số tiền giảm mỗi bước (15.000đ)
  freeshipThreshold: 200000,                      // Ngưỡng freeship theo giá gốc (200.000đ)
  standardShippingFee: 10000                      // Phí ship nếu dưới ngưỡng (10.000đ)
};
```

---

## 🚀 Hướng Dẫn Triển Khai Lên VPS (Chỉ Cần 1 Bước)

Website được xây dựng theo kiến trúc **Web Tĩnh Hoàn Thuần (Static Web App)** không cần cơ sở dữ liệu hay cài đặt Node.js runtime phức tạp trên VPS.

### Cách 1: Dùng Nginx trên VPS
Chỉ cần copy toàn bộ thư mục này vào thư mục web của Nginx (ví dụ `/var/www/jollibee`):
```nginx
server {
    listen 80;
    server_name yourdomain.com; # hoặc địa chỉ IP của VPS
    root /var/www/jollibee;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Cách 2: Chạy nhanh máy chủ Python
```bash
python -m http.server 8080
```
Sau đó truy cập: `http://localhost:8080` (hoặc `http://<IP_VPS>:8080`).

---

## 🧪 Chạy Bộ Kiểm Thử Tự Động (Unit & Integration Tests)

Dự án bao gồm 16 bài kiểm thử tự động độc lập chạy trực tiếp qua Node.js test runner:
```bash
node --test tests/*.test.js
```
Kết quả kiểm tra đảm bảo:
- Mốc biên giảm giá (99k, 100k, 199k, 200k,...) chính xác 100%.
- Freeship tính trên giá gốc ban đầu.
- Tùy chọn combo tính đúng phụ thu upsize.
- Mã hóa đường dẫn Zalo / Messenger an toàn.
