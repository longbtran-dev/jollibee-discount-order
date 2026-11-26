import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../js/cart.js';
import { formatOrderText, generateZaloUrl, generateMessengerUrl } from '../js/order-message.js';
import { CartDrawer } from '../js/components/cart-drawer.js';
import { ImageModal } from '../js/components/image-modal.js';
import { getActiveModalCount, resetActiveModalCount } from '../js/utils.js';

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

  it('quản lý số lượng và xóa món khỏi giỏ hàng', () => {
    const cart = new Cart();
    const item = cart.addItem({ id: 'p1', name: 'Mì Ý', price: 35000 });
    cart.updateQuantity(item.cartItemId, 2); // số lượng thành 3
    assert.equal(cart.getItems()[0].quantity, 3);
    assert.equal(cart.getTotals('dinein').originalTotal, 105000);

    cart.removeItem(item.cartItemId);
    assert.equal(cart.getItems().length, 0);
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
    assert.ok(msg.includes('HÌNH THỨC: [GIAO TẬN NƠI]'));
    assert.ok(!msg.includes('ĐƠN ĐẶT HỘ JOLLIBEE'));
    assert.ok(!msg.includes('Shop vui lòng kiểm tra'));
    assert.ok(msg.includes('Nguyễn Văn A'));
    assert.ok(msg.includes('0987654321'));
    assert.ok(msg.includes('123 Cầu Giấy, HN'));
    assert.ok(msg.includes('Mì Ý Lớn (Up)'));
    assert.ok(msg.includes('110.000đ'));
  });

  it('định dạng tin nhắn cho Ăn tại quán không bắt buộc và không hiển thị thông tin khách nếu không có', () => {
    const customer = {}; // Trống hoàn toàn vì khách ăn tại quán không cần nhập
    const items = [{
      name: 'Combo Gà Giòn Cay',
      unitPrice: 105000,
      quantity: 1
    }];
    const pricing = { originalTotal: 105000, discountAmount: 15000, shippingFee: 0, finalTotal: 90000 };

    const msg = formatOrderText(customer, items, pricing, 'dinein');
    assert.ok(msg.includes('ĂN TẠI QUÁN'));
    assert.ok(!msg.includes('Khách hàng:'));
    assert.ok(!msg.includes('Số điện thoại:'));
    assert.ok(!msg.includes('Địa chỉ giao hàng:'));
    assert.ok(msg.includes('Combo Gà Giòn Cay'));
    assert.ok(msg.includes('90.000đ'));
  });

  it('hiển thị lưu ý đơn hàng dưới 100k khi chưa đạt mốc giảm giá tối thiểu', () => {
    const customer = { name: 'Khách test', phone: '0900000000', address: 'HN' };
    const items = [{ name: 'Kem Vani', unitPrice: 10000, quantity: 1 }];
    const pricing = { originalTotal: 10000, discountAmount: 0, shippingFee: 10000, finalTotal: 20000 };

    const msg = formatOrderText(customer, items, pricing, 'delivery');
    assert.ok(msg.includes('Lưu ý: Đơn hàng dưới 100k'));
  });

  it('tạo đường dẫn Zalo và Messenger chuẩn mã hóa URI', () => {
    const zaloUrl = generateZaloUrl('0901234567', 'Xin chào, tôi muốn đặt hàng');
    assert.ok(zaloUrl.startsWith('https://zalo.me/0901234567'));
    assert.ok(zaloUrl.includes(encodeURIComponent('Xin chào, tôi muốn đặt hàng')));

    const fbUrl = generateMessengerUrl('https://m.me/shopjollibee', 'Xin chào');
    assert.ok(fbUrl.startsWith('https://m.me/shopjollibee'));
    assert.ok(fbUrl.includes(encodeURIComponent('Xin chào')));
  });

  it('validateForm chặn và báo lỗi qua in-app toast khi đơn hàng dưới 100k (không dùng alert)', () => {
    let toastMsg = '';
    const cart = new Cart();
    cart.addItem({ id: 'p1', name: 'Mì Ý', price: 35000 }); // 35k < 100k
    const drawer = new CartDrawer(cart, {});
    drawer.showToast = (msg) => { toastMsg = msg; };
    const isValid = drawer.validateForm();
    assert.equal(isValid, false);
    assert.ok(toastMsg.includes('100.000đ') || (drawer.lastValidationError && drawer.lastValidationError.includes('100.000đ')));
  });

  it('validateForm cho phép đơn >= 100k ở chế độ Ăn tại quán', () => {
    let toastMsg = '';
    const cart = new Cart();
    cart.addItem({ id: 'c1', name: 'Combo 105k', price: 105000 });
    const drawer = new CartDrawer(cart, {});
    drawer.showToast = (msg) => { toastMsg = msg; };
    drawer.orderType = 'dinein';
    const isValid = drawer.validateForm();
    assert.equal(isValid, true);
    assert.equal(toastMsg, '');
    assert.equal(drawer.lastValidationError, null);
  });

  it('validateForm từ chối khi số điện thoại giao hàng không đúng định dạng', () => {
    let toastOrAlertMsg = '';
    global.alert = (msg) => { toastOrAlertMsg = msg; };
    const cart = new Cart();
    cart.addItem({ id: 'c1', name: 'Combo 105k', price: 105000 });
    const drawer = new CartDrawer(cart, {});
    drawer.orderType = 'delivery';
    drawer.showToast = (msg) => { toastOrAlertMsg = msg; };
    drawer.customerInfo = { name: 'Nguyễn Văn A', phone: '12345', address: '123 Cầu Giấy' };
    const isValid = drawer.validateForm();
    assert.equal(isValid, false);
    assert.ok(toastOrAlertMsg.includes('Số điện thoại'));
  });

  it('validateForm chấp nhận khi số điện thoại và địa chỉ giao hàng hợp lệ', () => {
    let toastOrAlertMsg = '';
    global.alert = (msg) => { toastOrAlertMsg = msg; };
    const cart = new Cart();
    cart.addItem({ id: 'c1', name: 'Combo 105k', price: 105000 });
    const drawer = new CartDrawer(cart, {});
    drawer.orderType = 'delivery';
    drawer.showToast = (msg) => { toastOrAlertMsg = msg; };
    drawer.customerInfo = { name: 'Nguyễn Văn A', phone: '0987654321', address: '123 Cầu Giấy' };
    const isValid = drawer.validateForm();
    assert.equal(isValid, true);
    assert.equal(toastOrAlertMsg, '');
  });

  it('tự động lưu giỏ hàng vào localStorage và khôi phục khi khởi tạo', () => {
    const storageMap = new Map();
    global.localStorage = {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear()
    };

    const cart1 = new Cart();
    cart1.addItem({ id: 'p1', name: 'Gà Giòn', price: 35000 });
    assert.ok(storageMap.has('jb_cart_items'));

    // Giỏ hàng mới tự động nạp từ storage
    const cart2 = new Cart();
    cart2.loadFromStorage();
    assert.equal(cart2.getItems().length, 1);
    assert.equal(cart2.getItems()[0].name, 'Gà Giòn');
    assert.equal(cart2.getItems()[0].unitPrice, 35000);
  });

  it('undoLastAdd hoàn tác món vừa được thêm vào giỏ hàng', () => {
    const cart = new Cart();
    cart.addItem({ id: 'p1', name: 'Gà Giòn', price: 35000 });
    cart.addItem({ id: 'p2', name: 'Kem Vani', price: 10000 });
    assert.equal(cart.getItems().length, 2);

    const undone = cart.undoLastAdd();
    assert.ok(undone);
    assert.equal(undone.name, 'Kem Vani');
    assert.equal(cart.getItems().length, 1);
    assert.equal(cart.getItems()[0].name, 'Gà Giòn');
  });

  it('CartDrawer khởi tạo chưa chọn mặc định hình thức nhận hàng (orderType = null)', () => {
    const cart = new Cart();
    const drawer = new CartDrawer(cart, {});
    assert.equal(typeof drawer._debouncedSaveStorage, 'function');
    assert.equal(drawer.orderType, null);
  });

  it('CartDrawer render lần đầu tạo modal shell và re-render giữ nguyên panel tránh chớp trắng', () => {
    let innerHtml = '';
    const mockInner = {
      innerHTML: '',
      querySelectorAll: () => []
    };
    const mockPanel = {
      id: 'cart-drawer-panel',
      classList: {
        remove: () => {}
      },
      addEventListener: () => {},
      querySelector: (selector) => {
        if (selector === '#cart-drawer-inner') return mockInner;
        return null;
      }
    };
    let currentPanelInDOM = null;
    const mockContainer = {
      id: 'cart-drawer-container',
      get innerHTML() { return innerHtml; },
      set innerHTML(val) {
        innerHtml = val;
        if (val.includes('cart-drawer-panel')) {
          currentPanelInDOM = mockPanel;
        } else {
          currentPanelInDOM = null;
        }
      },
      querySelector: (selector) => {
        if (selector === '#cart-drawer-panel') return currentPanelInDOM;
        if (selector === '.drawer-scroll-body') return null;
        return null;
      },
      querySelectorAll: () => []
    };

    global.document = {
      body: {
        classList: { add: () => {}, remove: () => {} },
        appendChild: () => {}
      },
      getElementById: (id) => (id === 'cart-drawer-container' ? mockContainer : null),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    if (global.localStorage && typeof global.localStorage.clear === 'function') {
      global.localStorage.clear();
    }
    const cart = new Cart();
    cart.addItem({ id: 'p1', name: 'Gà Giòn', price: 35000 });
    const drawer = new CartDrawer(cart, {});

    // Lần 1: Render lần đầu khi mở giỏ -> Container tạo shell modal
    drawer.render();
    assert.ok(mockContainer.innerHTML.includes('cart-drawer-backdrop'));
    assert.ok(mockContainer.innerHTML.includes('cart-drawer-panel'));
    assert.equal(currentPanelInDOM, mockPanel);

    // Lần 2: Giả lập tăng số lượng -> render() lần 2
    // mockContainer.innerHTML không bị gán lại (giữ nguyên modal shell)
    const initialHtml = mockContainer.innerHTML;
    cart.updateQuantity(cart.getItems()[0].cartItemId, 1);
    drawer.render();

    // mockContainer.innerHTML không bị ghi đè, mà mockInner.innerHTML được cập nhật
    assert.equal(mockContainer.innerHTML, initialHtml);
    assert.ok(mockInner.innerHTML.includes('x 2'));

    // Đóng drawer dọn dẹp sạch sẽ
    drawer.close();
    assert.equal(mockContainer.innerHTML, '');
  });

  it('showConfirmDialog gọi hàm onConfirm an toàn khi được xác nhận', () => {
    const cart = new Cart();
    const drawer = new CartDrawer(cart, {});
    let confirmed = false;
    drawer.showConfirmDialog({
      title: 'Xóa giỏ hàng?',
      message: 'Bạn có chắc chắn?',
      onConfirm: () => { confirmed = true; }
    });
    // Trong môi trường Node không có document, showConfirmDialog tự động thực thi callback
    assert.equal(confirmed, true);
  });

  it('_highlightFieldError thêm class báo lỗi và thông báo lỗi bên dưới ô input', () => {
    const cart = new Cart();
    const drawer = new CartDrawer(cart, {});
    const classes = new Set();
    const mockInput = {
      classList: {
        add: (...cls) => cls.forEach(c => classes.add(c)),
        remove: (...cls) => cls.forEach(c => classes.delete(c)),
        contains: (c) => classes.has(c)
      },
      parentElement: null,
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    drawer._highlightFieldError(mockInput, 'Vui lòng nhập tên');
    assert.ok(mockInput.classList.contains('border-red-500'));
    assert.ok(mockInput.classList.contains('ring-red-200'));
  });

  it('kéo thả chuột từ bên trong ô input ra ngoài backdrop không làm tắt giỏ hàng', () => {
    const cart = new Cart();
    const drawer = new CartDrawer(cart, {});
    let isClosed = false;
    drawer.close = () => { isClosed = true; };

    const listeners = {};
    const mockBackdrop = {
      id: 'cart-drawer-backdrop',
      addEventListener: (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); }
    };
    const mockInput = { id: 'customer-name' };

    global.document = {
      getElementById: (id) => (id === 'cart-drawer-backdrop' ? mockBackdrop : null),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    drawer._bindGlobalDrawerEvents();

    // Giả lập người dùng bôi đen chọn chữ: mousedown trên input, mouseup/click trên backdrop
    // 1. mousedown bắt đầu trên ô input (hoặc panel bên trong)
    listeners['mousedown']?.forEach(fn => fn({ target: mockInput }));

    // 2. Kéo chuột ra ngoài và nhả chuột tạo sự kiện click trên backdrop
    listeners['click']?.forEach(fn => fn({ target: mockBackdrop }));

    // Giỏ hàng KHÔNG ĐƯỢC PHÉP đóng
    assert.equal(isClosed, false);

    // Ngược lại: nếu người dùng cố ý click chuột trực tiếp trên backdrop:
    // 1. mousedown trên backdrop
    listeners['mousedown']?.forEach(fn => fn({ target: mockBackdrop }));
    // 2. click trên backdrop
    listeners['click']?.forEach(fn => fn({ target: mockBackdrop }));

    // Giỏ hàng được đóng an toàn
    assert.equal(isClosed, true);
  });

  it('loadFromStorage lọc bỏ dữ liệu hỏng (NaN, âm, sai cấu trúc) chống lỗi NaN đ', () => {
    const storageMap = new Map();
    storageMap.set('jb_cart_items', JSON.stringify([
      null,
      { cartItemId: '', name: 'Rỗng ID', unitPrice: 30000, quantity: 1 },
      { cartItemId: 'bad_price', name: 'Sai giá', unitPrice: 'abc', quantity: 1 },
      { cartItemId: 'neg_qty', name: 'Số lượng âm', unitPrice: 30000, quantity: -2 },
      { cartItemId: 'valid_1', productId: 'p1', name: 'Gà Giòn', unitPrice: '35000', quantity: '2', selectedOptions: 'bad' }
    ]));

    global.localStorage = {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear()
    };

    const cart = new Cart();
    assert.equal(cart.getItems().length, 1);
    assert.equal(cart.getItems()[0].cartItemId, 'valid_1');
    assert.equal(cart.getItems()[0].unitPrice, 35000);
    assert.equal(cart.getItems()[0].quantity, 2);
    assert.deepEqual(cart.getItems()[0].selectedOptions, []);
    assert.equal(cart.getTotals('delivery').originalTotal, 70000);
  });

  it('removeItem dọn sạch historyStack và updateItemOptions cập nhật cấu hình Combo tại chỗ', () => {
    if (global.localStorage && typeof global.localStorage.clear === 'function') {
      global.localStorage.clear();
    }
    const cart = new Cart();
    cart.addItem({ id: 'p1', name: 'Gà Giòn', price: 35000 });
    const comboProduct = { id: 'c1', name: 'Combo Đôi', base_price: 100000, price: 100000, is_combo: true };
    const addedCombo = cart.addItem(comboProduct, [{ group_name: 'Nước', option_id: 'pepsi', option_name: 'Pepsi vừa', extra_price: 0 }], 2);

    // Xóa p1 thủ công -> historyStack chỉ còn lại c1
    cart.removeItem('p1_base');
    assert.equal(cart.getProductQuantity('p1'), 0);

    // Đổi tùy chọn nước của Combo sang Pepsi lớn (+5.000đ) -> giữ nguyên số lượng 2
    const updated = cart.updateItemOptions(addedCombo.cartItemId, comboProduct, [
      { group_name: 'Nước', option_id: 'pepsi_l', option_name: 'Pepsi lớn', extra_price: 5000 }
    ]);
    assert.ok(updated);
    assert.equal(updated.quantity, 2);
    assert.equal(updated.unitPrice, 105000);
    assert.equal(cart.getItems().length, 1);
  });

  it('formatOrderText xử lý chuẩn Combo có 1 tùy chọn chứa dấu phẩy mà không cắt vỡ chuỗi', () => {
    const items = [{
      name: '1 Mì Ý + 1 Nước',
      unitPrice: 55000,
      quantity: 1,
      selectedOptions: [
        { option_name: 'Pepsi lớn, ít đá, thêm chanh', extra_price: 5000 }
      ],
      optionsText: 'Pepsi lớn, ít đá, thêm chanh (+5.000đ)'
    }];
    const pricing = { originalTotal: 55000, discountAmount: 0, shippingFee: 0, finalTotal: 55000 };
    const msg = formatOrderText({}, items, pricing, 'dinein');
    assert.ok(msg.includes('• Pepsi lớn, ít đá, thêm chanh (+5.000đ)'));
  });

  it('chạm đúp open() không làm kẹt overflow-hidden và bấm Escape khi xem ảnh không làm sập CartDrawer', () => {
    resetActiveModalCount();
    const bodyClasses = new Set();
    const keyHandlers = [];
    const containers = {
      'cart-drawer-container': { id: 'cart-drawer-container', innerHTML: '', querySelector: () => null, querySelectorAll: () => [] },
      'image-modal-container': { id: 'image-modal-container', innerHTML: '', querySelector: () => null, querySelectorAll: () => [] }
    };

    global.document = {
      body: {
        classList: {
          add: (c) => bodyClasses.add(c),
          remove: (c) => bodyClasses.delete(c),
          contains: (c) => bodyClasses.has(c)
        },
        appendChild: () => {}
      },
      getElementById: (id) => containers[id] || null,
      addEventListener: (ev, fn) => { if (ev === 'keydown') keyHandlers.push(fn); },
      removeEventListener: () => {}
    };

    const cart = new Cart([{
      cartItemId: 'c1_opt',
      productId: 'c1',
      name: 'Combo Gà Giòn',
      isCombo: true,
      unitPrice: 80000,
      quantity: 1,
      selectedOptions: [{ option_name: 'Pepsi vừa', extra_price: 0 }]
    }]);
    const imageModal = new ImageModal();
    const drawer = new CartDrawer(cart, {}, null, null, imageModal, {
      getUpsellSuggestions: () => [{ id: 's1', name: 'Bánh Xoài Đào', price: 20000, image: '' }]
    });

    // Chạm đúp mở giỏ 2 lần liên tiếp
    drawer.open();
    drawer.open();
    assert.equal(getActiveModalCount(), 1);
    assert.ok(containers['cart-drawer-container'].innerHTML.includes('btn-cart-edit-combo'));
    assert.ok(containers['cart-drawer-container'].innerHTML.includes('Tùy chỉnh combo'));
    assert.ok(!containers['cart-drawer-container'].innerHTML.includes('<span>Đổi món</span>'));
    assert.ok(containers['cart-drawer-container'].innerHTML.includes('Sắp nhận ưu đãi'));
    assert.ok(!containers['cart-drawer-container'].innerHTML.includes('Báo lỗi'));
    assert.ok(containers['cart-drawer-container'].innerHTML.includes('Giỏ Hàng & Ưu Đãi'));
    assert.ok(containers['cart-drawer-container'].innerHTML.includes('Chi Tiết Ưu Đãi Đơn Hàng'));
    assert.ok(containers['cart-drawer-container'].innerHTML.includes('Sao Chép Đơn & Gửi Shop Đặt Ngay'));
    assert.ok(containers['cart-drawer-container'].innerHTML.includes('Bánh Xoài Đào'));
    assert.ok(containers['cart-drawer-container'].innerHTML.includes('btn-copy-order'));
    assert.ok(!containers['cart-drawer-container'].innerHTML.includes('btn-send-zalo'));
    assert.ok(!containers['cart-drawer-container'].innerHTML.includes('btn-send-messenger'));

    // Mở xem ảnh phóng to chồng lên trên giỏ hàng
    imageModal.open({ title: 'Combo Gà Giòn', image: '' });
    assert.equal(getActiveModalCount(), 2);

    // Nhấn phím Escape 1 lần -> CHỈ tắt ImageModal, CartDrawer vẫn mở!
    keyHandlers.forEach(fn => fn({ key: 'Escape', preventDefault() {}, stopPropagation() {} }));
    assert.equal(imageModal._isOpen, false);
    assert.equal(drawer._isOpen, true);
    assert.equal(getActiveModalCount(), 1);
    assert.equal(bodyClasses.has('overflow-hidden'), true);

    // Đóng giỏ hàng -> trả bộ đếm về 0 và gỡ sạch overflow-hidden
    drawer.close();
    assert.equal(getActiveModalCount(), 0);
    assert.equal(bodyClasses.has('overflow-hidden'), false);
  });

  it('bắt buộc khách chủ động chọn Giao Tận Nơi hoặc Ăn Tại Quán trong giỏ trước khi sao chép đơn', () => {
    const mockInner = { innerHTML: '', querySelectorAll: () => [] };
    const mockPanel = {
      id: 'cart-drawer-panel',
      classList: { remove: () => {} },
      addEventListener: () => {},
      querySelector: (sel) => (sel === '#cart-drawer-inner' ? mockInner : null),
      querySelectorAll: () => []
    };
    let currentPanel = null;
    const mockContainer = {
      id: 'cart-drawer-container',
      _html: '',
      get innerHTML() { return this._html; },
      set innerHTML(val) {
        this._html = val;
        currentPanel = val.includes('cart-drawer-panel') ? mockPanel : null;
      },
      querySelector: (sel) => (sel === '#cart-drawer-panel' ? currentPanel : null),
      querySelectorAll: () => []
    };

    global.document = {
      body: { classList: { add: () => {}, remove: () => {} }, appendChild: () => {} },
      getElementById: (id) => (id === 'cart-drawer-container' ? mockContainer : null),
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    const cart = new Cart();
    cart.clear();
    cart.addItem({ id: '158', name: 'Cặp Đôi Ăn Ý', price: 145000 });
    const drawer = new CartDrawer(cart, {});
    let toastMsg = '';
    drawer.showToast = (msg) => { toastMsg = msg; };

    drawer.open();
    // 1. Chưa chọn hình thức nhận hàng -> hiện thẻ order-type-selector-card, ẩn form địa chỉ
    assert.ok(mockContainer.innerHTML.includes('order-type-selector-card'));
    assert.ok(!mockContainer.innerHTML.includes('id="customer-name"'));

    // 2. Bấm sao chép đơn khi chưa chọn -> chặn và nhắc chọn hình thức nhận hàng
    assert.equal(drawer.validateForm(), false);
    assert.ok(toastMsg.includes('Giao Tận Nơi') || toastMsg.includes('Ăn Tại Quán'));

    // 3. Khi chọn Giao Tận Nơi -> hiện form địa chỉ giao hàng & thông điệp Freeship tận nơi (không phải toàn quốc)
    drawer.setOrderType('delivery');
    assert.ok(mockInner.innerHTML.includes('id="customer-name"'));
    assert.ok(mockInner.innerHTML.includes('FREESHIP tận nơi'));
    assert.ok(!mockInner.innerHTML.includes('toàn quốc'));

    // 4. Khi chọn Ăn Tại Quán -> ẩn form địa chỉ và cho phép chốt đơn ngay
    drawer.setOrderType('dinein');
    assert.ok(!mockInner.innerHTML.includes('id="customer-name"'));
    assert.equal(drawer.validateForm(), true);

    drawer.close();
  });
});
