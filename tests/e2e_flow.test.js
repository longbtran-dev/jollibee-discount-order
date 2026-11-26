import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Cart } from '../js/cart.js';
import { calculateDiscount, calculateShippingFee, calculateOrderPricing } from '../js/pricing.js';
import { formatOrderText, generateZaloUrl, generateMessengerUrl } from '../js/order-message.js';
import { JollibeeApp } from '../js/app.js';

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

  it('JollibeeApp: không bắn pháo hoa nhầm lúc F5, tìm kiếm không dấu & gợi ý món bù mốc 1 chạm', () => {
    const mockStorage = new Map();
    mockStorage.set('jb_cart_items', JSON.stringify([
      { cartItemId: 'p1_base', productId: 'p1', name: 'Gà Giòn', unitPrice: 240000, quantity: 1 }
    ]));
    global.localStorage = {
      getItem: (k) => mockStorage.get(k) || null,
      setItem: (k, v) => mockStorage.set(k, String(v)),
      removeItem: (k) => mockStorage.delete(k),
      clear: () => mockStorage.clear()
    };

    let confettiFired = 0;
    global.window = {
      JOLLIBEE_CONFIG: {},
      confetti: () => { confettiFired++; }
    };

    const menuContainer = { innerHTML: '', querySelectorAll: () => [] };
    global.document = {
      addEventListener: () => {},
      removeEventListener: () => {},
      getElementById: (id) => (id === 'menu-sections-container' ? menuContainer : null),
      querySelector: () => null,
      querySelectorAll: () => []
    };

    const app = new JollibeeApp();
    // Khởi tạo lastOriginalTotal phải bằng đúng 240.000đ đã lưu, không bắn pháo hoa khi tải trang
    assert.equal(app.lastOriginalTotal, 240000);
    app.updateFloatingCart();
    assert.equal(confettiFired, 0);

    // Nạp thực đơn thật để kiểm thử tìm kiếm không dấu & gợi ý Upsell 1 chạm
    app.menuData = menuData;
    app.productMap = new Map();
    menuData.categories.forEach(c => c.products.forEach(p => app.productMap.set(String(p.id), p)));

    // Tìm kiếm không dấu "ga gion" và "my y" phải ra kết quả
    app.renderMenuSections('ga gion');
    assert.ok(!menuContainer.innerHTML.includes('Không tìm thấy món ăn nào'));
    assert.ok(menuContainer.innerHTML.includes('Gà'));

    app.renderMenuSections('my y');
    assert.ok(!menuContainer.innerHTML.includes('Không tìm thấy món ăn nào'));

    // Gợi ý Upsell khi thiếu 20.000đ trả về tối đa 3 món lẻ hợp lệ
    const suggestions = app.getUpsellSuggestions(20000);
    assert.ok(Array.isArray(suggestions) && suggestions.length > 0 && suggestions.length <= 3);
    suggestions.forEach(item => assert.equal(Boolean(item.is_combo), false));

    // Khi đang lọc từ khóa chỉ còn 1 mục, bấm vào Tab danh mục khác phải tự xóa bộ lọc để cuộn tới mục đó
    const searchEl = { value: 'burger', focus() {} };
    const clearClasses = new Set();
    const clearEl = { classList: { add: c => clearClasses.add(c), remove: c => clearClasses.delete(c) } };
    const mockSection = { getBoundingClientRect: () => ({ top: 300 }) };
    global.window.scrollY = 0;
    global.window.scrollTo = () => {};
    global.document.getElementById = (id) => {
      if (id === 'menu-sections-container') return menuContainer;
      if (id === 'menu-search-input') return searchEl;
      if (id === 'clear-search-btn') return clearEl;
      if (id === 'section-thuc-uong' && searchEl.value === '') return mockSection;
      return null;
    };

    app.renderMenuSections('burger');
    app.scrollToCategory('thuc-uong');
    assert.equal(searchEl.value, '');
    assert.ok(clearClasses.has('hidden'));
    assert.equal(app.activeCategorySlug, 'thuc-uong');

    // Khi kết thúc cuộn lập trình (_finishCategoryScroll), tab vừa bấm không bị ghi đè ngược sang mục cuối trang
    app._finishCategoryScroll();
    assert.equal(app.activeCategorySlug, 'thuc-uong');

    // Mở xem ảnh món >= 100k hiển thị đúng giá sau chiết khấu và giá gốc gạch ngang
    let previewPayload = null;
    app.imageModal = { open: (opts) => { previewPayload = opts; } };
    app.openProductImagePreview({ id: 'c_145', name: 'Combo 145k', price: 145000, image: '', is_combo: true });
    assert.equal(previewPayload.price, 130000);
    assert.equal(previewPayload.originalPrice, 145000);

    // Cấu hình động từ config.js (priorityProductIds, productBadges, categoryTitleOverrides) tự sắp xếp & gắn nhãn
    app.config = {
      categoryTitleOverrides: { 'mon-moi-mon-ngon': 'Combo Bán Chạy Nhất' },
      priorityProductIds: ['158', '680', '143', '679', '36'],
      productBadges: { '158': 'Bán chạy #1', '680': 'Khách hay gọi' }
    };
    const tabsEl = { innerHTML: '' };
    global.document.getElementById = (id) => {
      if (id === 'category-tabs') return tabsEl;
      if (id === 'menu-sections-container') return menuContainer;
      return null;
    };
    app.renderCategoryTabs();
    assert.ok(tabsEl.innerHTML.includes('Combo Bán Chạy Nhất'));

    app.renderMenuSections('');
    assert.ok(menuContainer.innerHTML.includes('Bán chạy #1'));
    assert.ok(menuContainer.innerHTML.includes('Khách hay gọi'));
    const idxCapDoi = menuContainer.innerHTML.indexOf('Cặp Đôi Ăn Ý');
    const idxMotMinh = menuContainer.innerHTML.indexOf('Một Mình Ăn Ngon');
    assert.ok(idxCapDoi !== -1 && idxMotMinh !== -1 && idxCapDoi < idxMotMinh);

    // Tìm kiếm "ban chay" cũng lọc ra đúng các món có gắn nhãn Bán chạy
    app.renderMenuSections('ban chay');
    assert.ok(menuContainer.innerHTML.includes('Cặp Đôi Ăn Ý'));
  });
});
