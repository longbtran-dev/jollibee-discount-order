import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Cart } from '../js/cart.js';
import { calculateDiscount, calculateShippingFee, calculateOrderPricing } from '../js/pricing.js';
import { formatOrderText, generateZaloUrl, generateMessengerUrl } from '../js/order-message.js';

describe('End-to-End System Integration Flow', () => {
  const menuRaw = fs.readFileSync('data/menu.json', 'utf8');
  const menuData = JSON.parse(menuRaw);

  it('toàn bộ luồng khách hàng từ duyệt menu -> chọn combo có upsize -> tính báo giá -> xuất tin nhắn Zalo', () => {
    const cart = new Cart();

    // 1. Khách chọn 1 Mì Ý Sốt Bò Bằm (35.000đ)
    const catMiY = menuData.categories.find(c => c.slug === 'mi-y-sot-bo-bam');
    assert.ok(catMiY, 'Phải tìm thấy danh mục Mì Ý');
    const miY = catMiY.products[0];
    cart.addItem(miY, [], 1);

    // 2. Khách chọn 1 Combo Càng Cay Càng Mê hoặc combo bất kỳ có upsize
    const catMonMoi = menuData.categories.find(c => c.slug === 'mon-moi-mon-ngon');
    const combo = catMonMoi.products.find(p => p.is_combo);
    assert.ok(combo, 'Phải tìm thấy sản phẩm combo');

    // Giả lập khách chọn 1 option upsize +10k
    const selectedOptions = [
      {
        group_name: combo.option_groups[0].group_name,
        option_id: combo.option_groups[0].options[0].option_id,
        option_name: combo.option_groups[0].options[0].name,
        extra_price: 10000
      }
    ];
    cart.addItem(combo, selectedOptions, 1);

    // 3. Khách mua thêm 2 phần khoai tây chiên (mỗi phần ví dụ 20.000đ hoặc tương đương)
    const expectedBaseTotal = miY.price + (combo.price + 10000);
    const totals = cart.getTotals('delivery');

    assert.equal(totals.originalTotal, expectedBaseTotal);
    assert.equal(totals.discountAmount, Math.floor(expectedBaseTotal / 100000) * 15000);
    assert.equal(totals.shippingFee, expectedBaseTotal >= 200000 ? 0 : 10000);
    assert.equal(totals.finalTotal, expectedBaseTotal - totals.discountAmount + totals.shippingFee);

    // 4. Xuất đơn hàng gửi cho chủ shop
    const customer = {
      name: 'Trần Thị Mai',
      phone: '0912345678',
      address: 'Số 15 Lê Lợi, Quận 1, TP.HCM',
      note: 'Giao lúc 11h30 trưa nay giúp em'
    };
    const orderText = formatOrderText(customer, cart.getItems(), totals, 'delivery');

    assert.ok(orderText.includes('HÌNH THỨC: [GIAO TẬN NƠI]'));
    assert.ok(!orderText.includes('ĐƠN ĐẶT HỘ JOLLIBEE GIÁ RẺ'));
    assert.ok(!orderText.includes('Shop vui lòng kiểm tra'));
    assert.ok(orderText.includes('Trần Thị Mai'));
    assert.ok(orderText.includes('0912345678'));
    assert.ok(orderText.includes('Số 15 Lê Lợi, Quận 1, TP.HCM'));
    assert.ok(orderText.includes(combo.name));
    assert.ok(orderText.includes('(+10.000đ)'));

    // 5. Kiểm tra URL gửi Zalo & Messenger
    const zaloUrl = generateZaloUrl('https://zalo.me/0909999999', orderText);
    assert.ok(zaloUrl.startsWith('https://zalo.me/0909999999?text='));
    assert.ok(zaloUrl.includes(encodeURIComponent('Trần Thị Mai')));

    const fbUrl = generateMessengerUrl('https://m.me/jollibeedatho', orderText);
    assert.ok(fbUrl.startsWith('https://m.me/jollibeedatho?text='));
  });

  it('kiểm tra Review Focus #1 & #2: Mốc biên giảm giá và Freeship tính trên giá gốc ban đầu', () => {
    // Giá gốc 205.000đ -> Giảm 30.000đ -> Còn 175.000đ -> VẪN ĐƯỢC FREESHIP (0đ)
    const items = [{ price: 205000, quantity: 1 }];
    const pricing = calculateOrderPricing(items, 'delivery');
    assert.equal(pricing.originalTotal, 205000);
    assert.equal(pricing.discountAmount, 30000);
    assert.equal(pricing.shippingFee, 0, 'Phải được freeship vì giá gốc >= 200k dù tiền sau giảm là 175k');
    assert.equal(pricing.finalTotal, 175000);

    // Giá gốc 199.000đ -> Giảm 15.000đ -> Phí ship 10.000đ -> Khách trả 194.000đ
    const itemsSub200 = [{ price: 199000, quantity: 1 }];
    const pricingSub200 = calculateOrderPricing(itemsSub200, 'delivery');
    assert.equal(pricingSub200.originalTotal, 199000);
    assert.equal(pricingSub200.discountAmount, 15000);
    assert.equal(pricingSub200.shippingFee, 10000);
    assert.equal(pricingSub200.finalTotal, 194000);
  });

  it('toàn bộ luồng nâng cấp UX #2 & #3: thêm món -> lưu trữ localStorage -> hoàn tác -> xác thực đơn hợp lệ', () => {
    const mockStorage = new Map();
    global.localStorage = {
      getItem: (k) => mockStorage.get(k) || null,
      setItem: (k, v) => mockStorage.set(k, String(v)),
      removeItem: (k) => mockStorage.delete(k),
      clear: () => mockStorage.clear()
    };

    const cart = new Cart();
    // 1. Thêm 1 Gà giòn 35k
    cart.addItem({ id: 'p1', name: 'Gà Giòn Vui Vẻ', price: 35000 });
    // 2. Thêm nhầm 1 Mì Ý 40k
    cart.addItem({ id: 'p2', name: 'Mì Ý Thơm Ngon', price: 40000 });
    assert.equal(cart.getItems().length, 2);
    assert.ok(mockStorage.has('jb_cart_items'), 'Dữ liệu giỏ hàng phải được tự động lưu vào storage');

    // 3. Khách bấm nút [Hoàn tác] trên Toast
    const undone = cart.undoLastAdd();
    assert.equal(undone.name, 'Mì Ý Thơm Ngon');
    assert.equal(cart.getItems().length, 1);
    assert.equal(cart.getItems()[0].name, 'Gà Giòn Vui Vẻ');

    // 4. Thêm combo 105k để đủ điều kiện đặt đơn >= 100k
    cart.addItem({ id: 'c1', name: 'Combo No Nê', price: 105000 });
    const totals = cart.getTotals('delivery');
    assert.equal(totals.originalTotal, 140000); // 35k + 105k
    assert.equal(totals.discountAmount, 15000); // 140k giảm 15k
    assert.equal(totals.finalTotal, 135000);   // 140k - 15k + 10k ship

    // 5. Kiểm tra tính bền vững: tạo instance giỏ mới khôi phục đúng từ storage
    const restoredCart = new Cart();
    restoredCart.loadFromStorage();
    assert.equal(restoredCart.getItems().length, 2);
    assert.equal(restoredCart.getTotals('delivery').finalTotal, 135000);
  });
});
