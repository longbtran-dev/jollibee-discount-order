/**
 * Quản lý trạng thái giỏ hàng
 */
import { calculateOrderPricing } from './pricing.js';

export const CART_STORAGE_KEY = 'jb_cart_items';

export class Cart {
  constructor(initialItems = []) {
    this.items = [];
    this.historyStack = []; // Lưu lại lịch sử thêm món để hỗ trợ tính năng Hoàn tác (Undo)

    if (Array.isArray(initialItems) && initialItems.length > 0) {
      initialItems.forEach(item => this.items.push(item));
    } else {
      this.loadFromStorage();
    }
  }

  /**
   * Tự động lưu giỏ hàng vào localStorage
   */
  saveToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items));
    } catch (e) {
      console.warn('Không thể lưu giỏ hàng vào localStorage:', e);
    }
  }

  /**
   * Khôi phục giỏ hàng từ localStorage
   */
  loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = localStorage.getItem(CART_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.items = parsed;
        }
      }
    } catch (e) {
      console.warn('Không thể đọc giỏ hàng từ localStorage:', e);
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
    const basePrice = Number(product.base_price !== undefined ? product.base_price : product.price) || 0;
    const unitPrice = basePrice + extraTotal;

    const optionsText = selectedOptions
      .map(opt => {
        const extra = opt.extra_price > 0 ? ` (+${opt.extra_price.toLocaleString('vi-VN')}đ)` : '';
        return `${opt.option_name || opt.name}${extra}`;
      })
      .join(', ');

    let resultItem = null;
    const existingIndex = this.items.findIndex(item => item.cartItemId === cartItemId);
    if (existingIndex >= 0) {
      this.items[existingIndex].quantity += qty;
      resultItem = this.items[existingIndex];
    } else {
      const newItem = {
        cartItemId,
        productId: product.id,
        name: product.name,
        image: product.image || '',
        description: product.description || '',
        isCombo: Boolean(product.is_combo),
        basePrice,
        unitPrice,
        quantity: qty,
        selectedOptions: [...selectedOptions],
        optionsText
      };
      this.items.push(newItem);
      resultItem = newItem;
    }

    this.historyStack.push({ cartItemId, addedQty: qty });
    this.saveToStorage();
    return resultItem;
  }

  /**
   * Hoàn tác món vừa thêm vào giỏ hàng gần nhất (Nâng cấp UX #2)
   * @returns {object|null} Thông tin món đã hoàn tác
   */
  undoLastAdd() {
    if (this.historyStack.length === 0) return null;
    const lastAction = this.historyStack.pop();
    const item = this.items.find(i => i.cartItemId === lastAction.cartItemId);
    if (!item) return null;

    const undoneItem = { ...item };
    item.quantity -= lastAction.addedQty;
    if (item.quantity <= 0) {
      this.items = this.items.filter(i => i.cartItemId !== lastAction.cartItemId);
    }
    this.saveToStorage();
    return undoneItem;
  }

  /**
   * Xóa một mục khỏi giỏ hàng
   */
  removeItem(cartItemId) {
    this.items = this.items.filter(item => item.cartItemId !== cartItemId);
    this.saveToStorage();
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
    } else {
      this.saveToStorage();
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
    this.historyStack = [];
    this.saveToStorage();
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
