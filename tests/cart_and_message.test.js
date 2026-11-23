import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../js/cart.js';
import { formatOrderText, generateZaloUrl, generateMessengerUrl } from '../js/order-message.js';
import { CartDrawer } from '../js/components/cart-drawer.js';

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
    assert.ok(msg.includes('ĐƠN ĐẶT HỘ JOLLIBEE'));
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

  it('validateForm chặn và báo lỗi khi đơn hàng dưới 100k', () => {
    let alertMsg = '';
    global.alert = (msg) => { alertMsg = msg; };
    const cart = new Cart();
    cart.addItem({ id: 'p1', name: 'Mì Ý', price: 35000 }); // 35k < 100k
    const drawer = new CartDrawer(cart, {});
    const isValid = drawer.validateForm();
    assert.equal(isValid, false);
    assert.ok(alertMsg.includes('100.000đ'));
  });

  it('validateForm cho phép đơn >= 100k ở chế độ Ăn tại quán', () => {
    let alertMsg = '';
    global.alert = (msg) => { alertMsg = msg; };
    const cart = new Cart();
    cart.addItem({ id: 'c1', name: 'Combo 105k', price: 105000 });
    const drawer = new CartDrawer(cart, {});
    drawer.orderType = 'dinein';
    const isValid = drawer.validateForm();
    assert.equal(isValid, true);
    assert.equal(alertMsg, '');
  });

  it('validateForm từ chối khi số điện thoại giao hàng không đúng định dạng', () => {
    let toastOrAlertMsg = '';
    global.alert = (msg) => { toastOrAlertMsg = msg; };
    const cart = new Cart();
    cart.addItem({ id: 'c1', name: 'Combo 105k', price: 105000 });
    const drawer = new CartDrawer(cart, {});
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

  it('CartDrawer khởi tạo với debounced save và container chuẩn', () => {
    const cart = new Cart();
    const drawer = new CartDrawer(cart, {});
    assert.equal(typeof drawer._debouncedSaveStorage, 'function');
    assert.equal(drawer.orderType, 'delivery');
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
});
