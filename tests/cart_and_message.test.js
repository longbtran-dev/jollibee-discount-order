import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Cart } from '../js/cart.js';
import { formatOrderText, generateZaloUrl, generateMessengerUrl } from '../js/order-message.js';

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

  it('tạo đường dẫn Zalo và Messenger chuẩn mã hóa URI', () => {
    const zaloUrl = generateZaloUrl('0901234567', 'Xin chào, tôi muốn đặt hàng');
    assert.ok(zaloUrl.startsWith('https://zalo.me/0901234567'));
    assert.ok(zaloUrl.includes(encodeURIComponent('Xin chào, tôi muốn đặt hàng')));

    const fbUrl = generateMessengerUrl('https://m.me/shopjollibee', 'Xin chào');
    assert.ok(fbUrl.startsWith('https://m.me/shopjollibee'));
    assert.ok(fbUrl.includes(encodeURIComponent('Xin chào')));
  });
});
