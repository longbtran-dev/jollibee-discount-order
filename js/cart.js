/**
 * Quản lý trạng thái giỏ hàng an toàn Schema & đồng bộ dữ liệu thực đơn
 */
import { calculateOrderPricing } from './pricing.js';

export const CART_STORAGE_KEY = 'jb_cart_items';

export class Cart {
  constructor(initialItems = []) {
    this.items = [];
    this.historyStack = []; // Lưu lịch sử thêm món hỗ trợ Hoàn tác (Undo)

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
   * Khôi phục & kiểm định Schema chặt chẽ giỏ hàng từ localStorage (chống lỗi NaN đ)
   */
  loadFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = localStorage.getItem(CART_STORAGE_KEY);
      if (!data) return;
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        this.items = parsed
          .filter(item =>
            item &&
            typeof item === 'object' &&
            typeof item.cartItemId === 'string' &&
            item.cartItemId.trim() !== '' &&
            typeof item.name === 'string' &&
            item.name.trim() !== '' &&
            Number.isFinite(Number(item.unitPrice)) &&
            Number(item.unitPrice) >= 0 &&
            Number.isInteger(Number(item.quantity)) &&
            Number(item.quantity) > 0
          )
          .map(item => ({
            ...item,
            productId: item.productId !== undefined ? String(item.productId) : item.cartItemId.split('_')[0],
            basePrice: Number.isFinite(Number(item.basePrice)) ? Number(item.basePrice) : Number(item.unitPrice),
            unitPrice: Number(item.unitPrice),
            quantity: Number(item.quantity),
            isCombo: Boolean(item.isCombo),
            selectedOptions: Array.isArray(item.selectedOptions)
              ? item.selectedOptions
                  .filter(opt => opt && typeof opt === 'object' && (opt.option_name || opt.name))
                  .map(opt => ({
                    ...opt,
                    extra_price: Number.isFinite(Number(opt.extra_price)) ? Number(opt.extra_price) : 0
                  }))
              : [],
            optionsText: typeof item.optionsText === 'string' ? item.optionsText : ''
          }));
      } else {
        this.items = [];
      }
    } catch (e) {
      console.warn('Dữ liệu giỏ hàng lỗi, tiến hành đặt lại:', e);
      this.items = [];
    }
  }

  /**
   * Đồng bộ giá và thông tin món trong giỏ với menu.json mới nhất khi tải trang
   * @param {Map<string, object>} productMap
   */
  syncWithMenu(productMap) {
    if (!productMap || typeof productMap.get !== 'function' || this.items.length === 0) return;
    let changed = false;

    this.items.forEach(item => {
      const product = productMap.get(String(item.productId));
      if (!product) return;

      if (product.name && item.name !== product.name) {
        item.name = product.name;
        changed = true;
      }
      if (product.image && item.image !== product.image) {
        item.image = product.image;
        changed = true;
      }

      if (!item.isCombo) {
        const latestPrice = Number(product.price);
        if (Number.isFinite(latestPrice) && latestPrice >= 0 && item.unitPrice !== latestPrice) {
          item.basePrice = latestPrice;
          item.unitPrice = latestPrice;
          changed = true;
        }
      } else {
        const latestBase = Number(product.base_price !== undefined ? product.base_price : product.price);
        if (Number.isFinite(latestBase) && latestBase >= 0) {
          const allOptionsMap = new Map();
          (product.option_groups || []).forEach(g => {
            (g.options || []).forEach(o => {
              if (o.option_id) allOptionsMap.set(String(o.option_id), o);
            });
          });

          let extraTotal = 0;
          (item.selectedOptions || []).forEach(opt => {
            const matched = opt.option_id ? allOptionsMap.get(String(opt.option_id)) : null;
            if (matched) {
              opt.extra_price = Number(matched.extra_price) || 0;
            }
            extraTotal += Number(opt.extra_price) || 0;
          });

          const newUnitPrice = latestBase + extraTotal;
          if (item.basePrice !== latestBase || item.unitPrice !== newUnitPrice) {
            item.basePrice = latestBase;
            item.unitPrice = newUnitPrice;
            changed = true;
          }
        }
      }
    });

    if (changed) {
      this.saveToStorage();
    }
  }

  /**
   * Tạo mã định danh duy nhất cho sản phẩm trong giỏ (kèm các tùy chọn)
   */
  _generateCartItemId(productId, selectedOptions = []) {
    const optSignature = selectedOptions
      .map(o => `${o.group_name || o.group_id}:${o.option_id || o.option_name || o.name}`)
      .sort()
      .join('|');
    return `${productId}_${optSignature || 'base'}`;
  }

  /**
   * Tạo chuỗi mô tả ngắn gọn các tùy chọn
   */
  _buildOptionsText(selectedOptions = []) {
    return selectedOptions
      .map(opt => {
        const extra = Number(opt.extra_price) > 0 ? ` (+${Number(opt.extra_price).toLocaleString('vi-VN')}đ)` : '';
        return `${opt.option_name || opt.name}${extra}`;
      })
      .join(', ');
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
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const cartItemId = this._generateCartItemId(product.id, selectedOptions);

    const extraTotal = selectedOptions.reduce((sum, opt) => sum + (Number(opt.extra_price) || 0), 0);
    const basePrice = Number(product.base_price !== undefined ? product.base_price : product.price) || 0;
    const unitPrice = basePrice + extraTotal;
    const optionsText = this._buildOptionsText(selectedOptions);

    let resultItem = null;
    const existingIndex = this.items.findIndex(item => item.cartItemId === cartItemId);
    if (existingIndex >= 0) {
      this.items[existingIndex].quantity += qty;
      resultItem = this.items[existingIndex];
    } else {
      const newItem = {
        cartItemId,
        productId: String(product.id),
        name: product.name,
        image: product.image || '',
        description: product.description || '',
        isCombo: Boolean(product.is_combo),
        basePrice,
        unitPrice,
        quantity: qty,
        selectedOptions: selectedOptions.map(o => ({ ...o, extra_price: Number(o.extra_price) || 0 })),
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
   * Cập nhật tùy chọn của một Combo đang có sẵn trong giỏ hàng (UX Đổi món tại chỗ)
   */
  updateItemOptions(oldCartItemId, product, newSelectedOptions = []) {
    const idx = this.items.findIndex(i => i.cartItemId === oldCartItemId);
    if (idx < 0 || !product) return null;

    const currentItem = this.items[idx];
    const newCartItemId = this._generateCartItemId(product.id, newSelectedOptions);
    const extraTotal = newSelectedOptions.reduce((sum, opt) => sum + (Number(opt.extra_price) || 0), 0);
    const basePrice = Number(product.base_price !== undefined ? product.base_price : product.price) || 0;
    const unitPrice = basePrice + extraTotal;
    const optionsText = this._buildOptionsText(newSelectedOptions);
    const normalizedOptions = newSelectedOptions.map(o => ({ ...o, extra_price: Number(o.extra_price) || 0 }));

    // Nếu trùng với một dòng Combo khác đã có sẵn trong giỏ -> gộp số lượng lại
    const duplicateIdx = this.items.findIndex((i, iIdx) => i.cartItemId === newCartItemId && iIdx !== idx);
    if (duplicateIdx >= 0) {
      this.items[duplicateIdx].quantity += currentItem.quantity;
      this.items.splice(idx, 1);
      this.historyStack.forEach(h => {
        if (h.cartItemId === oldCartItemId) h.cartItemId = newCartItemId;
      });
      this.saveToStorage();
      return this.items[duplicateIdx];
    }

    // Cập nhật trực tiếp tại đúng vị trí hiện tại
    currentItem.cartItemId = newCartItemId;
    currentItem.basePrice = basePrice;
    currentItem.unitPrice = unitPrice;
    currentItem.selectedOptions = normalizedOptions;
    currentItem.optionsText = optionsText;

    this.historyStack.forEach(h => {
      if (h.cartItemId === oldCartItemId) h.cartItemId = newCartItemId;
    });

    this.saveToStorage();
    return currentItem;
  }

  /**
   * Hoàn tác món vừa thêm vào giỏ hàng gần nhất
   * @returns {object|null} Thông tin món đã hoàn tác
   */
  undoLastAdd() {
    while (this.historyStack.length > 0) {
      const lastAction = this.historyStack.pop();
      const item = this.items.find(i => i.cartItemId === lastAction.cartItemId);
      if (!item) continue;

      const undoneItem = { ...item };
      item.quantity -= lastAction.addedQty;
      if (item.quantity <= 0) {
        this.items = this.items.filter(i => i.cartItemId !== lastAction.cartItemId);
        this.historyStack = this.historyStack.filter(h => h.cartItemId !== lastAction.cartItemId);
      }
      this.saveToStorage();
      return undoneItem;
    }
    return null;
  }

  /**
   * Xóa một mục khỏi giỏ hàng và dọn dẹp historyStack tương ứng
   */
  removeItem(cartItemId) {
    this.items = this.items.filter(item => item.cartItemId !== cartItemId);
    this.historyStack = this.historyStack.filter(h => h.cartItemId !== cartItemId);
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
   * Lấy tổng số lượng hiện có trong giỏ của một mã sản phẩm
   */
  getProductQuantity(productId) {
    const target = String(productId);
    return this.items.reduce((sum, item) => (String(item.productId) === target ? sum + item.quantity : sum), 0);
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
