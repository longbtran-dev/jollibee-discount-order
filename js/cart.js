/**
 * Quản lý trạng thái giỏ hàng
 */
import { calculateOrderPricing } from './pricing.js';

export class Cart {
  constructor(initialItems = []) {
    this.items = [];
    if (Array.isArray(initialItems)) {
      initialItems.forEach(item => this.items.push(item));
    }
  }

  /**
   * Tạo mã định danh duy nhất cho sản phẩm trong giỏ (kèm các tùy chọn)
   */
  _generateCartItemId(productId, selectedOptions = []) {
    const optSignature = selectedOptions
      .map(o => `${o.group_name || o.group_id}:${o.option_id || o.option_name}`)
      .sort()
      .join('|');
    return `${productId}_${optSignature || 'base'}`;
  }

  /**
   * Thêm sản phẩm vào giỏ hàng
   * @param {object} product - Thông tin món ăn
   * @param {Array} [selectedOptions=[]] - Danh sách tùy chọn đã chọn
   * @param {number} [quantity=1] - Số lượng thêm
   * @returns {object} Mục giỏ hàng vừa thêm
   */
  addItem(product, selectedOptions = [], quantity = 1) {
    if (!product) return null;
    const qty = Math.max(1, Number(quantity) || 1);
    const cartItemId = this._generateCartItemId(product.id, selectedOptions);

    const extraTotal = selectedOptions.reduce((sum, opt) => sum + (Number(opt.extra_price) || 0), 0);
    const unitPrice = (Number(product.price) || 0) + extraTotal;

    const optionsText = selectedOptions
      .map(opt => {
        const extra = opt.extra_price > 0 ? ` (+${opt.extra_price.toLocaleString('vi-VN')}đ)` : '';
        return `${opt.option_name || opt.name}${extra}`;
      })
      .join(', ');

    const existingIndex = this.items.findIndex(item => item.cartItemId === cartItemId);
    if (existingIndex >= 0) {
      this.items[existingIndex].quantity += qty;
      return this.items[existingIndex];
    }

    const newItem = {
      cartItemId,
      productId: product.id,
      name: product.name,
      image: product.image || '',
      basePrice: Number(product.price) || 0,
      unitPrice,
      quantity: qty,
      selectedOptions: [...selectedOptions],
      optionsText
    };

    this.items.push(newItem);
    return newItem;
  }

  /**
   * Xóa một mục khỏi giỏ hàng
   */
  removeItem(cartItemId) {
    this.items = this.items.filter(item => item.cartItemId !== cartItemId);
  }

  /**
   * Cập nhật số lượng (+/- delta)
   */
  updateQuantity(cartItemId, delta) {
    const item = this.items.find(i => i.cartItemId === cartItemId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      this.removeItem(cartItemId);
    }
  }

  /**
   * Lấy danh sách món trong giỏ
   */
  getItems() {
    return [...this.items];
  }

  /**
   * Đếm tổng số lượng món
   */
  getTotalItemCount() {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  /**
   * Xóa toàn bộ giỏ
   */
  clear() {
    this.items = [];
  }

  /**
   * Tính toán toàn bộ chi phí theo hình thức nhận hàng
   * @param {'delivery' | 'dinein'} [orderType='delivery']
   * @param {object} [config]
   */
  getTotals(orderType = 'delivery', config) {
    const itemsForPricing = this.items.map(item => ({
      price: item.unitPrice,
      quantity: item.quantity
    }));
    return calculateOrderPricing(itemsForPricing, orderType, config);
  }
}
