# Frontend Audit Fixes and UX Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Khắc phục triệt để các lỗi Logic, Bảo mật, A11y và UI đã phát hiện trong kiểm toán, đồng thời triển khai Nâng cấp UX #2 (Undo Toast khi thêm món) và Nâng cấp UX #3 (Persistence giỏ hàng & thông tin khách qua LocalStorage).

**Architecture:** Mở rộng các hàm tiện ích (`utils.js`) để bổ sung `debounce`, `isValidVietnamesePhone`, Modal Scroll Lock Stack, và Storage helpers. Nâng cấp `Cart` (`cart.js`) hỗ trợ đồng bộ `localStorage` và `undo`. Cải tiến `CartDrawer`, `ComboModal`, `ImageModal` và `app.js` để triệt tiêu lỗi bất đồng bộ Safari, chống XSS, giữ vị trí cuộn giỏ, xử lý phím `Escape`, chuẩn hóa hiển thị chiết khấu minh bạch và cung cấp Undo Toast.

**Tech Stack:** Vanilla JavaScript ES Modules, HTML5 Semantic, Tailwind CSS v3, Node.js Test Runner (`node --test`).

**Spec:** [docs/superpowers/specs/2026-11-23-jollibee-ordering-website-design.md](file:///e:/D%E1%BB%B1%20%C3%A1n%20%C4%91%E1%BA%B7t%20h%E1%BB%99%20Jollibee/docs/superpowers/specs/2026-11-23-jollibee-ordering-website-design.md) & Báo cáo kiểm toán toàn diện mã nguồn Frontend.

## Global Constraints
- Không sử dụng thêm bất kỳ thư viện bên ngoài nặng (zero external npm runtime dependencies).
- Giữ vững 100% tương thích với cấu trúc web tĩnh chạy trên GitHub Pages.
- Tất cả 32 unit/integration tests hiện tại trong `tests/` phải tiếp tục vượt qua (pass), và bổ sung tests mới cho các tiện ích mới.
- Khả năng tiếp cận: Loại bỏ hoàn toàn việc chặn pinch-to-zoom trên mobile.

## Review Focus
1. **iOS Safari Popup Blocker:** Không được dùng `await` trước khi mở đường dẫn Zalo/Messenger; ưu tiên chuyển hướng an toàn `window.location.href`.
2. **Attribute Injection / XSS:** Mọi chuỗi do người dùng nhập hoặc từ dữ liệu tùy biến phải được xử lý qua `escapeHtml()` trước khi đưa vào template literals.
3. **Mất dữ liệu form khi đóng giỏ:** Lắng nghe sự kiện `input` real-time và lưu ngay vào `localStorage`.
4. **Scroll Jump trong giỏ hàng:** Khi tăng giảm số lượng món, giữ nguyên `scrollTop` của danh sách món.
5. **Định giá minh bạch:** Món dưới 100k hiển thị rõ giá món thực tế, ghi rõ điều kiện gộp đơn từ 100k để giảm 15k/100k, tránh gây hiểu lầm.

---

### Task 1: Tiện ích mở rộng trong `utils.js` và Unit Tests
**Files:**
- Modify: `js/utils.js`
- Modify: `tests/utils.test.js`

**Interfaces:**
- Produces:
  - `debounce(fn, delay)`: Hàm hạn chế tần suất gọi hàm.
  - `isValidVietnamesePhone(phone)`: Kiểm tra định dạng số điện thoại Việt Nam (10 số, bắt đầu 03/05/07/08/09).
  - `lockBodyScroll()` & `unlockBodyScroll()`: Quản lý đếm modal đang mở để khóa/mở cuộn `body` an toàn không xung đột.

- [ ] **Step 1: Viết test cho `isValidVietnamesePhone` và `debounce` trong `tests/utils.test.js`**
- [ ] **Step 2: Chạy test để xác nhận test mới thất bại (FAIL)**
- [ ] **Step 3: Cập nhật `js/utils.js` bổ sung các hàm mới**
- [ ] **Step 4: Chạy lại test suite để xác nhận PASS**
- [ ] **Step 5: Commit task 1**

---

### Task 2: Persistence Giỏ Hàng & Khôi Phục trong `cart.js` (Nâng cấp UX #3)
**Files:**
- Modify: `js/cart.js`
- Modify: `tests/cart_and_message.test.js`

**Interfaces:**
- Produces:
  - `cart.saveToStorage()` & `cart.loadFromStorage()`: Tự động lưu/khôi phục giỏ hàng qua key `jb_cart_items`.
  - `cart.undoLastAdd()`: Hỗ trợ hoàn tác món vừa thêm gần nhất.

- [ ] **Step 1: Viết test cho `loadFromStorage` và `saveToStorage` trong `tests/cart_and_message.test.js`**
- [ ] **Step 2: Chạy test để xác nhận FAIL**
- [ ] **Step 3: Triển khai các phương thức lưu trữ an toàn trong `js/cart.js`**
- [ ] **Step 4: Chạy test suite để xác nhận PASS**
- [ ] **Step 5: Commit task 2**

---

### Task 3: Cải thiện `CartDrawer`: Sửa Popup Blocker Safari, XSS, Scroll Reset, SĐT & Phím Esc
**Files:**
- Modify: `js/components/cart-drawer.js`
- Modify: `tests/cart_and_message.test.js`

**Interfaces:**
- Consumes: `isValidVietnamesePhone`, `escapeHtml`, `lockBodyScroll`, `unlockBodyScroll` từ `utils.js`.
- Produces: `CartDrawer` an toàn, không bị giật cuộn, tự động lưu thông tin khách vào `localStorage`, bắt phím `Escape`.

- [ ] **Step 1: Viết test xác thực validateForm với số điện thoại Việt Nam hợp lệ/không hợp lệ**
- [ ] **Step 2: Chạy test xác nhận FAIL**
- [ ] **Step 3: Cập nhật `CartDrawer`**
  - Chống XSS bằng `escapeHtml` cho mọi input value.
  - Lắng nghe sự kiện `input` real-time lưu vào `this.customerInfo` và `localStorage`.
  - Giữ nguyên `scrollTop` khi tăng/giảm số lượng món.
  - Sửa `btn-send-zalo` và `btn-send-messenger` điều hướng an toàn cho iOS Safari.
  - Thêm listener phím `Escape` để đóng giỏ hàng.
- [ ] **Step 4: Chạy test suite để xác nhận PASS**
- [ ] **Step 5: Commit task 3**

---

### Task 4: Cải thiện `ComboModal` & `ImageModal`: Khóa cuộn đa tầng, Phím Esc, Sửa nhãn giá
**Files:**
- Modify: `js/components/combo-modal.js`
- Modify: `js/components/image-modal.js`
- Modify: `tests/combo_modal.test.js`

**Interfaces:**
- Consumes: `lockBodyScroll`, `unlockBodyScroll` từ `utils.js`.
- Produces: Modal đóng bằng `Escape`, không gây đè cuộn body, footer combo hiển thị giá gốc và chú thích rõ ràng.

- [ ] **Step 1: Cập nhật `combo-modal.js` và `image-modal.js` dùng `lockBodyScroll`/`unlockBodyScroll`**
- [ ] **Step 2: Thêm hỗ trợ phím `Escape` cho `ComboModal`**
- [ ] **Step 3: Cập nhật nhãn giá trong `ComboModal` để minh bạch chính sách giá**
- [ ] **Step 4: Chạy test suite để xác nhận PASS**
- [ ] **Step 5: Commit task 4**

---

### Task 5: Cải thiện `app.js` & `index.html`: Undo Toast (#2), Search Debounce, ProductMap, A11y & Tailwind Fixes
**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

**Interfaces:**
- Consumes: `debounce`, `lockBodyScroll`, `unlockBodyScroll` từ `utils.js`.
- Produces:
  - Khôi phục giỏ hàng và thông tin khách từ `localStorage` khi khởi chạy app.
  - Tìm kiếm mượt mà với debounce 200ms.
  - Truy vấn món ăn tốc độ $O(1)$ qua `productMap`.
  - Toast thông báo có nút `[Hoàn tác]` (Undo) trong 4 giây khi thêm món.
  - Viewport đạt chuẩn WCAG (cho phép zoom).
  - Chuẩn hóa các class Tailwind v3.

- [ ] **Step 1: Cập nhật `index.html` sửa viewport meta tag và class Tailwind v3**
- [ ] **Step 2: Cập nhật `app.js` với `productMap`, search debounce, hiển thị giá rõ ràng và Undo Toast**
- [ ] **Step 3: Kiểm tra toàn bộ test suite `node --test tests/*.test.js`**
- [ ] **Step 4: Commit task 5**

---

### Task 6: Kiểm thử E2E tổng hợp và Nghiệm thu hoàn thiện
**Files:**
- Modify: `tests/e2e_flow.test.js`

- [ ] **Step 1: Bổ sung bài test luồng khôi phục LocalStorage và Undo món ăn**
- [ ] **Step 2: Chạy toàn bộ test runner và kiểm tra kết quả 100% pass**
- [ ] **Step 3: Commit và nghiệm thu**
