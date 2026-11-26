/**
 * Mô-đun tính toán chiết khấu và báo giá dịch vụ đặt hộ Jollibee
 */

export const DEFAULT_PRICING_CONFIG = {
  discountStep: 100000,
  discountPerStep: 15000,
  freeshipThreshold: 200000,
  standardShippingFee: 10000
};

/**
 * Tính số tiền giảm giá dựa trên tổng tiền gốc ban đầu
 * Quy tắc: Cứ mỗi 100.000đ giảm 15.000đ
 * @param {number} originalTotal - Tổng tiền gốc
 * @param {number} [step=100000] - Bước nhảy mệnh giá
 * @param {number} [discountPerStep=15000] - Số tiền giảm mỗi bước
 * @returns {number} Số tiền được giảm
 */
export function calculateDiscount(
  originalTotal,
  step = DEFAULT_PRICING_CONFIG.discountStep,
  discountPerStep = DEFAULT_PRICING_CONFIG.discountPerStep
) {
  if (!originalTotal || originalTotal <= 0) return 0;
  const count = Math.floor(originalTotal / step);
  return count * discountPerStep;
}

/**
 * Tính phí giao hàng dựa trên giá gốc ban đầu và hình thức nhận
 * Quy tắc:
 * - Ăn tại quán hoặc giỏ rỗng: 0đ
 * - Giao tận nơi: Giá gốc >= 200.000đ miễn phí (0đ); dưới 200.000đ là 10.000đ
 * @param {number} originalTotal - Tổng tiền gốc ban đầu
 * @param {'delivery' | 'dinein'} orderType - Hình thức đặt hàng
 * @param {number} [freeshipThreshold=200000] - Ngưỡng miễn phí ship
 * @param {number} [standardFee=10000] - Phí ship tiêu chuẩn
 * @returns {number} Phí ship
 */
export function calculateShippingFee(
  originalTotal,
  orderType,
  freeshipThreshold = DEFAULT_PRICING_CONFIG.freeshipThreshold,
  standardFee = DEFAULT_PRICING_CONFIG.standardShippingFee
) {
  if (orderType !== 'delivery' || !originalTotal || originalTotal <= 0) {
    return 0;
  }
  return originalTotal >= freeshipThreshold ? 0 : standardFee;
}

/**
 * Tính toán toàn bộ chi phí đơn hàng
 * @param {Array<{price: number, quantity: number}>} items - Danh sách món ăn kèm giá và số lượng
 * @param {'delivery' | 'dinein'} [orderType='delivery'] - Hình thức đặt
 * @param {object} [config=DEFAULT_PRICING_CONFIG] - Cấu hình giá
 * @returns {{originalTotal: number, discountAmount: number, shippingFee: number, finalTotal: number}}
 */
export function calculateOrderPricing(items = [], orderType = 'delivery', config = DEFAULT_PRICING_CONFIG) {
  const step = config.discountStep ?? DEFAULT_PRICING_CONFIG.discountStep;
  const discountPerStep = config.discountPerStep ?? DEFAULT_PRICING_CONFIG.discountPerStep;
  const freeshipThreshold = config.freeshipThreshold ?? DEFAULT_PRICING_CONFIG.freeshipThreshold;
  const standardFee = config.standardShippingFee ?? DEFAULT_PRICING_CONFIG.standardShippingFee;

  const originalTotal = (items || []).reduce((sum, item) => {
    const p = Number(item.price) || 0;
    const q = Number(item.quantity) || 1;
    return sum + p * q;
  }, 0);

  if (originalTotal <= 0) {
    return {
      originalTotal: 0,
      discountAmount: 0,
      shippingFee: 0,
      finalTotal: 0
    };
  }

  const discountAmount = calculateDiscount(originalTotal, step, discountPerStep);
  const shippingFee = calculateShippingFee(originalTotal, orderType, freeshipThreshold, standardFee);
  const finalTotal = Math.max(0, originalTotal - discountAmount + shippingFee);

  return {
    originalTotal,
    discountAmount,
    shippingFee,
    finalTotal
  };
}
