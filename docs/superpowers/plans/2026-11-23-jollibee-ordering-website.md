# Kế Hoạch Triển Khai Website Đặt Hộ & Báo Giá Jollibee

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng website chọn món, tùy biến combo và tính giá chiết khấu trực tiếp cho dịch vụ đặt hộ Jollibee, hỗ trợ xuất đơn gửi qua Zalo và Facebook Messenger tối ưu cho người dùng ít rành công nghệ.

**Architecture:** Ứng dụng Single Page Application (SPA) hoàn toàn client-side bằng HTML5, Tailwind CSS và JavaScript ES6 theo chuẩn mô-đun hóa, dữ liệu thực đơn và hình ảnh món ăn được tĩnh hoá cục bộ từ dữ liệu Jollibee chính thức đã thu thập. Phân tách rõ ràng giữa tầng logic tính toán (pricing, cart, message) có kiểm thử tự động độc lập và tầng giao diện hiển thị (modal combo, drawer giỏ hàng, navigation).

**Tech Stack:** HTML5, Tailwind CSS, JavaScript (ES6 Modules), Node.js (cho bộ unit test chạy `node --test`).

**Spec:** `docs/superpowers/specs/2026-11-23-jollibee-ordering-website-design.md`

## Global Constraints

- Nhận diện thương hiệu Jollibee: Màu Đỏ (`#d71920`), Vàng (`#ffc72c`), Kem (`#fffaf0`), Nền trắng `#ffffff`, Chữ `#241f20`.
- Thiết kế chuẩn Mobile-First, thân thiện tối đa với người dùng phổ thông ("low-tech").
- Công thức giảm giá: Cứ mỗi 100.000đ giá gốc Jollibee giảm 15.000đ (`Math.floor(totalOriginal / 100000) * 15000`).
- Công thức phí ship: Tính trên **Tổng tiền món gốc ban đầu**: Đơn giao tận nơi từ 200.000đ trở lên được miễn phí ship (0đ); dưới 200.000đ phí ship 10.000đ; Đơn ăn tại quán luôn có phí ship 0đ.
- Tuyệt đối không để lộ thông tin voucher UrBox hay phương pháp săn mã giảm giá của chủ dịch vụ.
- Cấu hình cửa hàng (SĐT Zalo, Facebook, mức giảm giá, phí ship) được tập trung tại tập tin `config.js` để chủ shop dễ dàng tùy biến mà không cần chỉnh sửa mã nguồn.

## Review Focus

1. **Tổng tiền gốc chạm ngưỡng biên giảm giá** (ví dụ 99.000đ, 100.000đ, 199.000đ, 200.000đ): Phải tính chính xác 99k giảm 0đ, 100k giảm 15k, 199k giảm 15k, 200k giảm 30k.
2. **Ngưỡng miễn phí ship tính trên giá gốc ban đầu**: Đơn có giá gốc 205.000đ, sau giảm 30.000đ còn 175.000đ thì vẫn phải được MIỄN PHÍ ship (0đ) vì giá gốc >= 200.000đ.
3. **Phụ thu tùy chọn combo cộng dồn chính xác**: Khi khách upsize Mì Ý lớn (+10k) hoặc đổi nước ngọt (+4k), giá combo phải tăng tương ứng và được tính gộp vào tổng tiền gốc để xét giảm giá và freeship.
4. **Mã hóa liên kết Zalo và Messenger an toàn**: Nội dung tin nhắn chứa dấu xuống dòng, tiếng Việt có dấu, ký tự đặc biệt phải được mã hóa chuẩn (`encodeURIComponent`) để khi bấm mở app không bị lỗi đường dẫn.
5. **Dữ liệu hình ảnh fallback khi tải trang**: Trường hợp hình ảnh món ăn bị thiếu hoặc lỗi mạng, hệ thống phải tự hiển thị ảnh giữ chỗ (placeholder) chuẩn thay vì bị vỡ layout thẻ sản phẩm.

---

### Task 1: Thiết Lập Mô-đun Tính Giá & Bộ Kiểm Thử Độc Lập (`js/pricing.js`)

**Files:**
- Create: `js/pricing.js`
- Create: `tests/pricing.test.js`

**Interfaces:**
- Produces:
  - `calculateDiscount(originalTotal: number, step?: number, discountPerStep?: number): number`
  - `calculateShippingFee(originalTotal: number, orderType: 'delivery' | 'dinein', freeshipThreshold?: number, standardFee?: number): number`
  - `calculateOrderPricing(items: Array<{price: number, quantity: number}>, orderType: 'delivery' | 'dinein', config?: object): PricingResult`
  - `PricingResult: { originalTotal: number, discountAmount: number, shippingFee: number, finalTotal: number }`

- [ ] **Step 1: Viết bài kiểm thử thất bại cho logic tính giá (`tests/pricing.test.js`)**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDiscount, calculateShippingFee, calculateOrderPricing } from '../js/pricing.js';

describe('Pricing Module', () => {
  it('tính chiết khấu theo bậc 100k giảm 15k chuẩn xác', () => {
    assert.equal(calculateDiscount(0), 0);
    assert.equal(calculateDiscount(99000), 0);
    assert.equal(calculateDiscount(100000), 15000);
    assert.equal(calculateDiscount(199000), 15000);
    assert.equal(calculateDiscount(200000), 30000);
    assert.equal(calculateDiscount(350000), 45000);
  });

  it('tính phí ship dựa trên giá gốc ban đầu', () => {
    // Đơn giao tận nơi: < 200k tính 10k, >= 200k miễn phí
    assert.equal(calculateShippingFee(190000, 'delivery'), 10000);
    assert.equal(calculateShippingFee(200000, 'delivery'), 0);
    assert.equal(calculateShippingFee(250000, 'delivery'), 0);

    // Đơn ăn tại quán luôn 0đ ship
    assert.equal(calculateShippingFee(50000, 'dinein'), 0);
    assert.equal(calculateShippingFee(250000, 'dinein'), 0);
  });

  it('tính toàn bộ đơn hàng: giá gốc 210k giảm 30k, freeship, khách trả 180k', () => {
    const items = [
      { price: 150000, quantity: 1 },
      { price: 30000, quantity: 2 }
    ]; // tổng gốc = 210.000đ
    const result = calculateOrderPricing(items, 'delivery');
    assert.deepEqual(result, {
      originalTotal: 210000,
      discountAmount: 30000,
      shippingFee: 0,
      finalTotal: 180000
    });
  });

  it('tính đơn hàng dưới 200k: giá gốc 140k giảm 15k, ship 10k, khách trả 135k', () => {
    const items = [{ price: 140000, quantity: 1 }];
    const result = calculateOrderPricing(items, 'delivery');
    assert.deepEqual(result, {
      originalTotal: 140000,
      discountAmount: 15000,
      shippingFee: 10000,
      finalTotal: 135000
    });
  });
});
```

- [ ] **Step 2: Chạy kiểm thử để xác nhận thất bại**

Run: `node --test tests/pricing.test.js`
Expected: FAIL với lỗi không tìm thấy mô-đun `js/pricing.js`.

- [ ] **Step 3: Cài đặt logic tính giá trong `js/pricing.js`**

Xây dựng các hàm `calculateDiscount`, `calculateShippingFee`, và `calculateOrderPricing` hỗ trợ truyền tham số mặc định từ cấu hình hoặc giá trị mặc định chuẩn (step = 100000, discount = 15000, freeship = 200000, shipFee = 10000).

- [ ] **Step 4: Chạy lại kiểm thử để xác nhận vượt qua**

Run: `node --test tests/pricing.test.js`
Expected: PASS (toàn bộ 4 test suites đều vượt qua).

- [ ] **Step 5: Lưu lại kết quả**

Kiểm tra cú pháp và đảm bảo hàm xuất khẩu ES module tương thích với cả Node test và trình duyệt.

---

### Task 2: Chuẩn Hóa Dữ Liệu Thực Đơn & Tập Tin Cấu Hình Cửa Hàng

**Files:**
- Create: `config.js`
- Create: `scripts/prepare_menu_data.py`
- Create: `data/menu.json`
- Test: `tests/menu_data.test.js`

**Interfaces:**
- Produces:
  - `config.js`: Đối tượng `window.JOLLIBEE_CONFIG` chứa cấu hình cửa hàng.
  - `data/menu.json`: Mảng các danh mục (categories), mỗi danh mục chứa danh sách sản phẩm đầy đủ thông tin (id, name, price, image, description, is_combo, option_groups).

- [ ] **Step 1: Viết test kiểm tra cấu trúc dữ liệu thực đơn (`tests/menu_data.test.js`)**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Menu Data Schema', () => {
  it('data/menu.json tồn tại và có đầy đủ 8 danh mục Jollibee', () => {
    const raw = fs.readFileSync('data/menu.json', 'utf8');
    const data = JSON.parse(raw);
    assert.ok(Array.isArray(data.categories));
    assert.equal(data.categories.length, 8);
  });

  it('các sản phẩm combo có cấu trúc option_groups hợp lệ', () => {
    const raw = fs.readFileSync('data/menu.json', 'utf8');
    const data = JSON.parse(raw);
    const combos = data.categories.flatMap(c => c.products).filter(p => p.is_combo);
    assert.ok(combos.length > 0);
    const sample = combos[0];
    assert.ok(Array.isArray(sample.option_groups));
    assert.ok(sample.option_groups.length > 0);
    assert.ok(sample.option_groups[0].group_name);
    assert.ok(Array.isArray(sample.option_groups[0].options));
  });
});
```

- [ ] **Step 2: Chạy kiểm thử để xác nhận thất bại**

Run: `node --test tests/menu_data.test.js`
Expected: FAIL vì `data/menu.json` chưa được tạo.

- [ ] **Step 3: Viết script `scripts/prepare_menu_data.py` và tạo `config.js`**

Script đọc từ `outputs/jollibee_menu_2026-11-23/jollibee_menu.json`, chuẩn hóa đường dẫn ảnh tương đối sang `images/`, làm sạch tên món ăn, tạo các nhóm option và xuất ra `data/menu.json`. Đồng thời copy thư mục ảnh từ `outputs/jollibee_menu_2026-11-23/images` sang thư mục web `images/`.

Tạo `config.js`:
```javascript
window.JOLLIBEE_CONFIG = {
  shopName: "Dịch Vụ Đặt Hộ Jollibee Giá Rẻ",
  zaloPhone: "0900000000",
  zaloLink: "https://zalo.me/0900000000",
  facebookMessengerUrl: "https://m.me/jollibee.datho",
  discountStep: 100000,
  discountPerStep: 15000,
  freeshipThreshold: 200000,
  standardShippingFee: 10000,
  bannerNotice: "🔥 Giảm 15k cho mỗi 100k tiền gốc Jollibee! Đơn từ 200k Miễn Phí Giao Hàng toàn quốc!"
};
```

- [ ] **Step 4: Chạy script và chạy kiểm thử để xác nhận vượt qua**

Run: `python scripts/prepare_menu_data.py && node --test tests/menu_data.test.js`
Expected: Tạo `data/menu.json`, đồng bộ ảnh vào `images/`, test PASS.

---

### Task 3: Mô-đun Quản Lý Giỏ Hàng & Định Dạng Tin Nhắn Đơn Hàng

**Files:**
- Create: `js/cart.js`
- Create: `js/order-message.js`
- Create: `tests/cart_and_message.test.js`

**Interfaces:**
- Consumes: `PricingResult` từ `js/pricing.js`
- Produces:
  - `Cart`:
    - `addItem(product: object, selectedOptions?: array, quantity?: number): void`
    - `removeItem(cartItemId: string): void`
    - `updateQuantity(cartItemId: string, delta: number): void`
    - `getItems(): array`
    - `clear(): void`
    - `getTotals(orderType: string, config?: object): PricingResult`
  - `OrderMessage`:
    - `formatOrderText(customerInfo: object, cartItems: array, pricing: PricingResult, orderType: string): string`
    - `generateZaloUrl(phoneOrLink: string, messageText: string): string`
    - `generateMessengerUrl(fbLink: string, messageText: string): string`

- [ ] **Step 1: Viết test cho Giỏ hàng và Tin nhắn đặt hàng (`tests/cart_and_message.test.js`)**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../js/cart.js';
import { formatOrderText, generateZaloUrl } from '../js/order-message.js';

describe('Cart & Order Message Formatter', () => {
  it('thêm món đơn và combo có phụ thu tính đúng tổng giá mục giỏ hàng', () => {
    const cart = new Cart();
    // Món đơn 35k
    cart.addItem({ id: 'p1', name: 'Mì Ý Sốt Bò Bằm', price: 35000 });
    // Combo 105k có upsize +10k
    cart.addItem(
      { id: 'c1', name: 'Combo Càng Cay Càng Mê', price: 105000 },
      [{ group_name: 'CHỌN MỲ Ý', option_name: 'Mì Ý Lớn (Up)', extra_price: 10000 }]
    );

    const items = cart.getItems();
    assert.equal(items.length, 2);
    assert.equal(items[0].unitPrice, 35000);
    assert.equal(items[1].unitPrice, 115000); // 105k + 10k

    const totals = cart.getTotals('delivery');
    assert.equal(totals.originalTotal, 150000); // 35k + 115k
    assert.equal(totals.discountAmount, 15000); // 150k giảm 15k
    assert.equal(totals.shippingFee, 10000);   // < 200k ship 10k
    assert.equal(totals.finalTotal, 145000);
  });

  it('định dạng tin nhắn chứa đầy đủ thông tin khách và chi tiết món', () => {
    const customer = { name: 'Nguyễn Văn A', phone: '0987654321', address: '123 Cầu Giấy, HN' };
    const items = [{
      name: 'Combo Càng Cay Càng Mê',
      unitPrice: 115000,
      quantity: 1,
      optionsText: 'Mì Ý Lớn (Up) (+10.000đ)'
    }];
    const pricing = { originalTotal: 115000, discountAmount: 15000, shippingFee: 10000, finalTotal: 110000 };

    const msg = formatOrderText(customer, items, pricing, 'delivery');
    assert.ok(msg.includes('ĐƠN ĐẶT HỘ JOLLIBEE'));
    assert.ok(msg.includes('Nguyễn Văn A'));
    assert.ok(msg.includes('0987654321'));
    assert.ok(msg.includes('123 Cầu Giấy, HN'));
    assert.ok(msg.includes('Mì Ý Lớn (Up)'));
    assert.ok(msg.includes('110.000đ'));
  });

  it('tạo đường dẫn Zalo chuẩn mã hóa URI', () => {
    const url = generateZaloUrl('0901234567', 'Xin chào, tôi muốn đặt hàng');
    assert.ok(url.startsWith('https://zalo.me/0901234567'));
    assert.ok(url.includes(encodeURIComponent('Xin chào, tôi muốn đặt hàng')));
  });
});
```

- [ ] **Step 2: Chạy kiểm thử để xác nhận thất bại**

Run: `node --test tests/cart_and_message.test.js`
Expected: FAIL vì các file chưa tồn tại.

- [ ] **Step 3: Cài đặt `js/cart.js` và `js/order-message.js`**

Triển khai đầy đủ lớp `Cart` và các hàm tạo tin nhắn định dạng văn bản đẹp mắt, có phân cách emoji, dễ nhìn khi gửi qua Zalo/Messenger.

- [ ] **Step 4: Chạy kiểm thử xác nhận vượt qua**

Run: `node --test tests/cart_and_message.test.js`
Expected: PASS.

---

### Task 4: Giao Diện Modal Tùy Biến Combo (Accordion & Option Selector)

**Files:**
- Create: `js/components/combo-modal.js`
- Test: `tests/combo_modal.test.js`

**Interfaces:**
- Consumes: `product` object từ `data/menu.json`
- Produces:
  - `ComboModal`:
    - `open(product: object, onConfirm: (configuredProduct) => void): void`
    - `close(): void`
    - `getSelectedOptions(): array`
    - `calculateCurrentPrice(): number`

- [ ] **Step 1: Viết test logic cho component ComboModal (`tests/combo_modal.test.js`)**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createComboState } from '../js/components/combo-modal.js';

describe('Combo State Logic', () => {
  const mockProduct = {
    id: 'combo_1',
    name: 'Combo Gà Sốt Cay',
    price: 90000,
    option_groups: [
      {
        group_id: 'g1',
        group_name: 'CHỌN GÀ 1',
        options: [
          { option_id: 'opt1', name: 'Gà sốt cay', extra_price: 0 },
          { option_id: 'opt2', name: 'Gà giòn vui vẻ', extra_price: 0 }
        ]
      },
      {
        group_id: 'g2',
        group_name: 'CHỌN NƯỚC',
        options: [
          { option_id: 'opt3', name: 'Nước ngọt vừa', extra_price: 0 },
          { option_id: 'opt4', name: 'Nước ngọt lớn (Up)', extra_price: 4000 }
        ]
      }
    ]
  };

  it('khởi tạo mặc định chọn option đầu tiên của mỗi nhóm', () => {
    const state = createComboState(mockProduct);
    assert.equal(state.selected['g1'].option_id, 'opt1');
    assert.equal(state.selected['g2'].option_id, 'opt3');
    assert.equal(state.getTotalPrice(), 90000);
  });

  it('thay đổi option có phụ thu sẽ tính lại giá tức thì', () => {
    const state = createComboState(mockProduct);
    state.selectOption('g2', mockProduct.option_groups[1].options[1]); // chọn upsize +4k
    assert.equal(state.getTotalPrice(), 94000);
  });
});
```

- [ ] **Step 2: Chạy kiểm thử để xác nhận thất bại**

Run: `node --test tests/combo_modal.test.js`
Expected: FAIL.

- [ ] **Step 3: Cài đặt logic trạng thái và render HTML của ComboModal trong `js/components/combo-modal.js`**

Triển khai logic chọn option, accordion đóng/mở từng nhóm theo đúng mẫu ảnh chụp Jollibee thật của khách, cập nhật tổng giá combo tức thì theo lựa chọn.

- [ ] **Step 4: Chạy kiểm thử để xác nhận vượt qua**

Run: `node --test tests/combo_modal.test.js`
Expected: PASS.

---

### Task 5: Xây Dựng Giao Diện Chính & Bộ Lọc Thực Đơn Danh Mục (`index.html`, `js/app.js`)

**Files:**
- Create: `index.html`
- Create: `js/app.js`

**Interfaces:**
- Consumes: `window.JOLLIBEE_CONFIG`, `data/menu.json`, `Cart`, `ComboModal`
- Produces: Trải nghiệm người dùng hoàn chỉnh trên trình duyệt di động và máy tính.

- [ ] **Step 1: Xây dựng cấu trúc HTML chuẩn (`index.html`)**

- Bao gồm Header mang nhận diện thương hiệu Jollibee (Logo/Tên shop, hotline, banner thông báo ưu đãi).
- Thanh phân loại danh mục dính (Sticky category tabs) với 8 danh mục có icon/ảnh nhỏ, cuộn mượt khi bấm chọn.
- Lưới hiển thị món ăn (Product Cards) với ảnh chất lượng cao, tên món, mô tả thành phần, giá gốc nổi bật, nút "Thêm món" hoặc "Chọn combo".
- Thanh giỏ hàng nổi cố định ở đáy màn hình (Floating Bottom Bar) hiển thị số lượng món, số tiền tạm tính, số tiền được giảm giá và nút "Xem đơn hàng".

- [ ] **Step 2: Cài đặt logic kết nối và khởi tạo tại `js/app.js`**

- Tải `data/menu.json`, render toàn bộ sản phẩm theo từng nhóm danh mục.
- Bắt sự kiện bấm "Thêm món" cho món đơn hoặc mở `ComboModal` cho combo.
- Cập nhật số lượng và trạng thái thanh giỏ hàng nổi ở đáy màn hình mỗi khi giỏ hàng thay đổi.

- [ ] **Step 3: Kiểm tra hiển thị và kiểm thử giao diện**

Mở và kiểm tra cấu trúc DOM qua trình duyệt hoặc test render để xác nhận hiển thị đầy đủ danh mục và các thẻ sản phẩm.

---

### Task 6: Giao Diện Giỏ Hàng, Chuyển Đổi Ăn Tại Quán / Giao Hàng & Xuất Đơn

**Files:**
- Create: `js/components/cart-drawer.js`
- Modify: `js/app.js`
- Modify: `index.html`

**Interfaces:**
- Consumes: `Cart`, `OrderMessage`, `JOLLIBEE_CONFIG`
- Produces: Drawer/Modal chốt đơn hiển thị 4 dòng báo giá, form thông tin khách hàng và các nút gửi Zalo, Messenger, Sao chép đơn.

- [ ] **Step 1: Cài đặt CartDrawer Component (`js/components/cart-drawer.js`)**

- Hiển thị danh sách các món trong giỏ: Tên, tùy chọn combo chi tiết, nút tăng/giảm số lượng (`+`, `-`), nút xóa.
- Nút chuyển tab: **"Giao tận nơi"** vs **"Ăn tại quán / Tới lấy"**.
- Biểu mẫu nhập liệu:
  - Giao tận nơi: Họ tên (bắt buộc), Số điện thoại (bắt buộc), Địa chỉ giao hàng (bắt buộc), Ghi chú thêm.
  - Ăn tại quán: Họ tên (bắt buộc), Số điện thoại (bắt buộc), Ghi chú (chi nhánh dự kiến ghé ăn nếu có).
- Khung hiển thị báo giá minh bạch 4 dòng:
  1. Tổng tiền món gốc Jollibee: `XXX.000đ`
  2. Giảm giá dịch vụ: `-YY.000đ`
  3. Phí giao hàng: `10.000đ` hoặc `Miễn phí (đơn từ 200k)` (Ăn tại quán: `0đ`)
  4. **Tổng thanh toán thực tế: `ZZZ.000đ`**
- Hộp cảnh báo thân thiện: *"Nếu Jollibee có gửi mã xác nhận OTP qua tin nhắn SMS, bạn vui lòng gửi lại mã đó cho shop để hoàn tất đặt nhé!"*
- 3 nút hành động tiện lợi:
  - Nút lớn: **"Gửi đơn qua Zalo"** (mở Zalo chat)
  - Nút lớn: **"Gửi qua Facebook Messenger"** (mở Messenger chat)
  - Nút phụ: **"Sao chép nội dung đơn hàng"** (kèm thông báo Toast "Đã sao chép đơn thành công!").

- [ ] **Step 2: Kết nối CartDrawer vào `js/app.js` và `index.html`**

Bấm vào thanh giỏ hàng nổi ở chân trang sẽ kích hoạt mở Drawer giỏ hàng; xử lý kiểm tra điền đủ SĐT/địa chỉ trước khi kích hoạt nút gửi tin nhắn.

---

### Task 7: Kiểm Thử Toàn Diện (End-to-End Verification) & Hướng Dẫn Triển Khai

**Files:**
- Create: `tests/e2e_flow.test.js`
- Create: `README.md` (Hướng dẫn đưa lên VPS/web server chỉ với 1 bước)

- [ ] **Step 1: Viết bài kiểm tra tích hợp toàn trình (`tests/e2e_flow.test.js`)**

Mô phỏng toàn bộ hành trình khách hàng:
1. Chọn món đơn và combo có tùy chọn upsize.
2. Kiểm tra bảng tính giá tự động: Giá gốc, chiết khấu (-15k/100k), freeship khi gốc >= 200k.
3. Nhập thông tin khách hàng giao tận nơi.
4. Kiểm tra chuỗi tin nhắn xuất ra chứa đầy đủ danh mục, tổng tiền, link liên hệ.

- [ ] **Step 2: Chạy toàn bộ test suites của dự án**

Run: `node --test tests/*.test.js`
Expected: Toàn bộ test suites đều PASS 100%.

- [ ] **Step 3: Viết hướng dẫn triển khai cực dễ trong `README.md`**

Mô tả cách đặt thư mục dự án lên VPS (chỉ cần trỏ Nginx hoặc chạy máy chủ web tĩnh bất kỳ), cách đổi số Zalo/Facebook trong `config.js`.
