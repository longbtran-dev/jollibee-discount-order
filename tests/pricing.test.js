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

  it('giỏ hàng rỗng có giá gốc = 0 thì phí ship = 0 và tổng tiền = 0', () => {
    assert.equal(calculateShippingFee(0, 'delivery'), 0);
    assert.deepEqual(calculateOrderPricing([], 'delivery'), {
      originalTotal: 0,
      discountAmount: 0,
      shippingFee: 0,
      finalTotal: 0
    });
  });

  it('khi chưa chọn hình thức nhận hàng (orderType = null) thì tạm tính phí ship = 0đ', () => {
    assert.equal(calculateShippingFee(145000, null), 0);
    assert.deepEqual(calculateOrderPricing([{ price: 145000, quantity: 1 }], null), {
      originalTotal: 145000,
      discountAmount: 15000,
      shippingFee: 0,
      finalTotal: 130000
    });
  });
});
