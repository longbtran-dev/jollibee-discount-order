# Tài Liệu Thiết Kế: Website Báo Giá & Hỗ Trợ Đặt Hộ Jollibee (Giai Đoạn 1)

- **Ngày cập nhật:** 2026-11-23
- **Dự án:** Website đặt hộ Jollibee giá rẻ
- **Trạng thái:** Đã hoàn thiện phản hồi thẩm định & Chờ khách hàng phê duyệt

---

## 1. Bối cảnh & Mục đích (Intent & Why)

Chủ dịch vụ cung cấp giải pháp đặt đồ ăn Jollibee giá rẻ thông qua việc tối ưu và áp dụng các chính sách ưu đãi/tài khoản độc quyền của họ trên ứng dụng Jollibee Việt Nam.

Đối tượng khách hàng mục tiêu bao gồm cả những người ít rành công nghệ ("low-tech"). Khách hàng cần một công cụ đơn giản, dễ thao tác trên điện thoại để:
1. Xem toàn bộ thực đơn Jollibee chính hãng kèm hình ảnh và giá niêm yết chuẩn xác.
2. Tùy chỉnh chi tiết các combo (chọn miếng gà cay/thường, đổi vị khoai lắc, upsize mì ý, nước ngọt với giá cộng thêm minh bạch).
3. Thấy ngay bảng báo giá trực quan theo thời gian thực: Tổng tiền gốc Jollibee, Tiền giảm giá theo chính sách, Phí giao hàng (nếu có), và Số tiền thực tế khách cần thanh toán.
4. Kết xuất thông tin đơn hàng thành tin nhắn mẫu hoàn chỉnh và gửi ngay cho chủ shop qua Zalo hoặc Facebook Messenger chỉ với 1 chạm.

---

## 2. Mục tiêu, Phi mục tiêu & Ranh giới cấm (Goals, Non-Goals & Anti-Goals)

### 2.1. Mục tiêu cốt lõi (Goals)
- **Giao diện chuẩn nhận diện Jollibee:** Tông màu chủ đạo Đỏ (`#d71920`) - Vàng (`#ffc72c`) - Kem (`#fffaf0`), chuẩn Mobile-First (tối ưu hóa 100% cho màn hình điện thoại cảm ứng).
- **Phân loại danh mục trực quan:** Đầy đủ 8 nhóm món ăn chính của Jollibee (Combo bán chạy, Gà giòn vui vẻ, Mì Ý Jolly, Gà sốt cay, Burger/Cơm, Phần ăn phụ, Món tráng miệng, Thức uống).
- **Bộ cấu hình Combo đa tầng (Accordion/Modal):**
  - Cho phép người dùng chọn từng option theo slot combo (ví dụ: Chọn gà 1, Chọn gà 2, Chọn khoai tây, Chọn nước).
  - Tự động cộng tiền chênh lệch (ví dụ: Upsize Mì Ý lớn +10.000đ, Upsize nước +4.000đ, đổi khoai lắc +6.000đ,...).
- **Bảng tính giá tự động minh bạch:**
  - **Quy tắc chiết khấu:** Cứ mỗi 100.000đ tiền gốc Jollibee sẽ được giảm 15.000đ (`Math.floor(Tổng tiền gốc / 100.000) * 15.000`).
  - **Chính sách phí giao hàng (Shipping Fee):**
    - Tính theo **Tổng tiền món gốc ban đầu** (trước khi áp dụng chiết khấu):
      - Đơn giao tận nơi có tổng tiền gốc từ 200.000đ trở lên: **Miễn phí ship (0đ)** (dù sau khi giảm giá khách chỉ trả dưới 200k vẫn được miễn ship).
      - Đơn giao tận nơi có tổng tiền gốc dưới 200.000đ: **Phí ship 10.000đ**.
    - Khách chọn "Ăn tại quán": **Phí ship 0đ**.
  - **Hiển thị 4 dòng chi tiết:**
    1. Tổng tiền món gốc Jollibee
    2. Chiết khấu dịch vụ (-15k mỗi 100k)
    3. Phí giao hàng (+10.000đ hoặc Miễn phí)
    4. **Tổng thanh toán thực tế**
- **Hỗ trợ 2 hình thức phục vụ:**
  - **Giao tận nơi:** Thu thập Họ tên, Số điện thoại (dùng tạo/nhập app Jollibee) và Địa chỉ nhận hàng chi tiết.
  - **Ăn tại quán / Tới lấy:** Thu thập Họ tên, Số điện thoại và Ghi chú (chủ shop sẽ chủ động nhắn tin chốt chi nhánh cụ thể với khách qua Zalo/FB).
- **Lưu ý xác nhận mã OTP thân thiện:** Có thông báo rõ ràng: *"Nếu Jollibee có gửi mã OTP về số điện thoại, bạn vui lòng gửi lại mã đó cho shop qua tin nhắn để hoàn tất đặt nhé!"* để khách low-tech yên tâm hợp tác.
- **Kết nối gửi đơn tiện lợi:**
  - Nút **"Gửi đơn qua Zalo"** (mở trực tiếp liên kết chat `zalo.me/...` kèm nội dung soạn sẵn).
  - Nút **"Gửi đơn qua Facebook"** (mở liên kết chat Messenger `m.me/...`).
  - Nút **"Sao chép đơn hàng"** để người dùng dán vào bất cứ đâu phòng khi mạng chậm.

### 2.2. Phi mục tiêu cho Giai đoạn 1 (Non-Goals)
- Chưa can thiệp hoặc kết nối API trực tiếp vào app Jollibee (để dành nghiên cứu và phát triển ở Giai đoạn 2 sau khi đã có lượng khách ổn định).
- Không yêu cầu cơ sở dữ liệu (Database) phức tạp, không yêu cầu hệ thống đăng nhập/đăng ký tài khoản cho khách hàng.
- Không tích hợp cổng thanh toán trực tuyến tự động (khách thanh toán cho chủ dịch vụ qua tin nhắn chốt đơn).

### 2.3. Ranh giới cấm tuyệt đối (Anti-Goals)
- **Tuyệt đối không hiển thị thông tin về voucher UrBox hay phương pháp săn mã giảm giá:** Mọi quy trình nhập mã, check mã ở hậu trường là bí quyết kinh doanh riêng của chủ shop.
- **Không tạo giao diện rườm rà, phức tạp:** Tránh các biểu mẫu nhiều bước hay popup bắt buộc phiền toái khiến người dùng low-tech bối rối.

---

## 3. Ràng buộc kỹ thuật & Dữ liệu có sẵn (Constraints & Existing Assets)

- **Dữ liệu thực đơn đã chuẩn bị:** Thư mục `outputs/jollibee_menu_2026-11-23` đã chứa sẵn toàn bộ:
  - `jollibee_menu.json` (62 sản phẩm, 24 combo, 104 nhóm lựa chọn, 673 lựa chọn chi tiết).
  - Toàn bộ hình ảnh món ăn và hình ảnh option đã được tải về cục bộ trong thư mục `images/`.
- **Môi trường triển khai:** Chạy trực tiếp trên VPS của chủ shop. Cần là ứng dụng web tĩnh (Single Page Application cực nhẹ với HTML5/Tailwind CSS/Modern JavaScript) tải trang tức thì, không cần cài backend runtime hay database phức tạp.
- **Tập tin cấu hình độc lập (`config.js`):** Cho phép chủ shop dễ dàng thay đổi:
  - Số điện thoại Zalo nhận đơn.
  - Link/ID Facebook Messenger nhận đơn.
  - Mức chiết khấu (mặc định: 15.000đ cho mỗi 100.000đ).
  - Mức miễn phí ship (mặc định: >= 200.000đ) và tiền ship (mặc định: 10.000đ).
  - Tiêu đề, số hotline hỗ trợ.

---

## 4. Các quyết định đã được người dùng chốt (User Decisions)

1. Ưu tiên làm website chọn món và báo giá trước để đưa vào kinh doanh ngay, phần tự động hóa API app Jollibee để lại sau.
2. Với đơn "Ăn tại quán", chủ shop sẽ chủ động nhắn tin hỏi chi nhánh và thống nhất phương án phục vụ (đĩa tại bàn hoặc hộp mang đi) trực tiếp với khách trên Zalo/FB.
3. Phí giao hàng: Đơn có tổng tiền gốc từ 200k trở lên được miễn phí ship (tính trên giá gốc ban đầu trước khi giảm giá); đơn dưới 200k cộng thêm 10.000đ tiền ship.
4. Chủ dịch vụ sẽ là người trực tiếp nhận đơn qua Facebook/Zalo và thao tác đặt trên app Jollibee cho khách.
5. Tách biệt hoàn toàn mã nguồn hệ thống check voucher `e:\MyStore\Jollibee` để đảm bảo bảo mật kinh doanh.

---

## 5. Các quyết định kỹ thuật do người xây dựng đề xuất (Builder's Calls)

1. **Ngăn xếp công nghệ:** Dùng kiến trúc Single Page Application thuần Web Standards (HTML5, Tailwind CSS, ES6 JavaScript) nhẹ dưới 1MB, sẵn sàng chạy ngay trên bất kỳ máy chủ web nào (Nginx, Caddy, Apache trên VPS) mà không cần cài thêm Node.js service hay Redis/MySQL.
2. **Trải nghiệm tương tác UX:**
   - Thanh danh mục cuộn ngang dính ở đỉnh màn hình, nhấp vào danh mục nào sẽ tự cuộn êm đến danh mục đó.
   - Thẻ món ăn hiển thị rõ giá gốc, nút "Thêm món" hoặc "Chọn món" (đối với combo).
   - Modal cấu hình combo: Chia các slot thành dạng Accordion, tự động mở nhóm đầu tiên, chọn radio kèm ảnh minh họa và phụ thu rõ ràng.
   - Thanh giỏ hàng nổi ở chân trang (Sticky Bottom Bar) hiển thị số lượng món, tổng tiền sau giảm, mở Drawer giỏ hàng để điền thông tin và bấm gửi.
3. **Mẫu tin nhắn đơn hàng:** Soạn sẵn rõ ràng: Họ tên, SĐT, Địa chỉ (hoặc ghi chú Ăn tại quán), Danh sách từng món kèm tuỳ chọn combo chi tiết, Tổng tiền Jollibee, Tiền giảm, Phí ship, và Tiền thực thanh toán.
