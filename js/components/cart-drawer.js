/**
 * Thành phần Drawer / Modal Giỏ Hàng & Chốt Đơn
 * Tối ưu hóa:
 * - Quản lý ngăn xếp LIFO Modal Stack & Focus Trap an toàn tuyệt đối
 * - Event Delegation tập trung (0 rò rỉ bộ nhớ khi re-render) & bảo toàn Focus nút +/-
 * - Kích thước vùng chạm >= 36px (chuẩn Mobile A11y) & độ tương phản WCAG AA
 * - Hỗ trợ nút "Đổi món" cho Combo ngay trong giỏ & Gợi ý "Món Bù Đủ Mốc 1 Chạm"
 */
import { formatOrderText, formatCurrency } from '../order-message.js';
import { bindMouseDragScroll } from '../mouse-drag-scroll.js';
import {
  copyToClipboard,
  escapeHtml,
  safeImageUrl,
  FALLBACK_FOOD_IMAGE,
  isValidVietnamesePhone,
  registerOpenModal,
  unregisterOpenModal,
  trapFocusInModal,
  debounce
} from '../utils.js';
import { fireOrderCelebration } from '../effects.js';
import {
  showToast as uiShowToast,
  showConfirmDialog as uiShowConfirmDialog,
  showCopyFallbackModal as uiShowCopyFallbackModal,
  showOrderCopiedModal as uiShowOrderCopiedModal
} from './ui-feedback.js';
import { getPickupDate, isPickupTimeValid, openTimeWheelPicker } from './time-picker.js?v=3.0';
import {
  IconShoppingBag,
  IconX,
  IconChevronDown,
  IconMinus,
  IconPlus,
  IconTrash,
  IconSliders,
  IconBike,
  IconUtensils,
  IconClock,
  IconFileText,
  IconReceipt,
  IconSparkles,
  IconCheckCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconCopy
} from '../icons.js';

export const CUSTOMER_STORAGE_KEY = 'jb_customer_info';

export class CartDrawer {
  constructor(cart, config = {}, onCartChanged = null, onOrderTypeChanged = null, imageModal = null, extraOptions = {}) {
    this.cart = cart;
    this.config = config;
    this.onCartChanged = onCartChanged;
    this.onOrderTypeChanged = onOrderTypeChanged;
    this.imageModal = imageModal;
    this.onEditCombo = extraOptions.onEditCombo || null;
    this.getUpsellSuggestions = extraOptions.getUpsellSuggestions || null;
    this.onQuickAddUpsell = extraOptions.onQuickAddUpsell || null;

    this.orderType = null; // Khách chủ động chọn 'delivery' hoặc 'dinein' khi mở giỏ hàng
    this.containerId = 'cart-drawer-container';
    this._isOpen = false;
    this._releaseFocusTrap = null;
    this.lastValidationError = null;

    this.customerInfo = {
      lastName: '',
      firstName: '',
      phone: '',
      address: '',
      pickupTime: '',
      pickupDate: '',
      note: ''
    };

    this._debouncedSaveStorage = debounce(() => {
      this._saveCustomerInfoToStorage();
    }, 250);

    this._loadCustomerInfoFromStorage();
  }

  _loadCustomerInfoFromStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const data = localStorage.getItem(CUSTOMER_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          let lastName = typeof parsed.lastName === 'string' ? parsed.lastName : '';
          let firstName = typeof parsed.firstName === 'string' ? parsed.firstName : '';

          // Tự động chuyển đổi dữ liệu cũ (name gộp) sang Họ + Tên tách rời
          if (!lastName && !firstName && typeof parsed.name === 'string' && parsed.name.trim()) {
            const parts = parsed.name.trim().split(/\s+/);
            if (parts.length > 1) {
              firstName = parts.pop();
              lastName = parts.join(' ');
            } else {
              firstName = parts[0];
            }
          }

          this.customerInfo = {
            lastName,
            firstName,
            phone: typeof parsed.phone === 'string' ? parsed.phone : '',
            address: typeof parsed.address === 'string' ? parsed.address : '',
            pickupTime: parsed.pickupDate === getPickupDate() && typeof parsed.pickupTime === 'string' ? parsed.pickupTime : '',
            pickupDate: typeof parsed.pickupDate === 'string' ? parsed.pickupDate : '',
            note: typeof parsed.note === 'string' ? parsed.note : ''
          };
        }
      }
    } catch (e) {
      console.warn('Không thể đọc thông tin khách hàng từ localStorage:', e);
    }
  }

  _saveCustomerInfoToStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(this.customerInfo));
    } catch (e) {
      console.warn('Không thể lưu thông tin khách hàng vào localStorage:', e);
    }
  }

  setOrderType(type) {
    if (this._isOpen) {
      this._saveFormInputs();
    }
    this.orderType = type;
    const container = typeof document !== 'undefined' ? document.getElementById(this.containerId) : null;
    if (this._isOpen || (container && container.innerHTML && container.innerHTML.trim())) {
      this.render();
    }
  }

  getContainer() {
    let el = document.getElementById(this.containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = this.containerId;
      document.body.appendChild(el);
    }
    return el;
  }

  open() {
    if (!this._isOpen) {
      this._isOpen = true;
      registerOpenModal('cart-drawer', () => {
        this._saveFormInputs();
        this.close();
      });
    }
    this.render();
  }

  close() {
    this._saveFormInputs();
    if (this._releaseFocusTrap) {
      this._releaseFocusTrap();
      this._releaseFocusTrap = null;
    }
    if (this._isOpen) {
      this._isOpen = false;
      unregisterOpenModal('cart-drawer');
    }
    const container = this.getContainer();
    container.innerHTML = '';
  }

  showToast(message, type = 'info') {
    uiShowToast(message, type);
  }

  showConfirmDialog(options) {
    uiShowConfirmDialog(options);
  }

  showCopyFallbackModal(orderText) {
    uiShowCopyFallbackModal(orderText, (msg, type) => this.showToast(msg, type));
  }

  _highlightFieldError(input, errorText) {
    if (!input) return;

    const parent = input.parentElement;
    parent?.querySelectorAll('.field-error-msg').forEach(el => el.remove());

    input.classList.remove('border-gray-300');
    input.classList.add('border-red-500', 'ring-2', 'ring-red-200', 'bg-red-50/50', 'animate-shake');
    if (typeof input.setAttribute === 'function') {
      input.setAttribute('aria-invalid', 'true');
    }

    if (parent && errorText && typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const errorEl = document.createElement('p');
      errorEl.setAttribute('role', 'alert');
      errorEl.className = 'field-error-msg text-[11px] font-bold text-red-600 mt-1 flex items-center gap-1';
      errorEl.innerHTML = `${IconAlertTriangle('w-3.5 h-3.5 flex-shrink-0')} <span>${escapeHtml(errorText)}</span>`;
      parent.appendChild(errorEl);
    }

    setTimeout(() => {
      input.classList.remove('animate-shake');
    }, 400);

    const onInput = () => {
      input.classList.remove('border-red-500', 'ring-2', 'ring-red-200', 'bg-red-50/50');
      input.classList.add('border-gray-300');
      if (typeof input.removeAttribute === 'function') {
        input.removeAttribute('aria-invalid');
      }
      parent?.querySelectorAll('.field-error-msg').forEach(el => el.remove());
      input.removeEventListener('input', onInput);
    };
    input.addEventListener('input', onInput);
  }

  _getUsablePickupTime(now = new Date()) {
    const { pickupTime, pickupDate } = this.customerInfo;
    if (pickupDate && pickupDate !== getPickupDate(now)) return '';
    return isPickupTimeValid(pickupTime, now) ? pickupTime : '';
  }

  validateForm(now = new Date()) {
    const pricing = this.cart.getTotals(this.orderType, this.config);
    if (pricing.originalTotal < 100000) {
      const needed = 100000 - pricing.originalTotal;
      const msg = `Đơn cần tối thiểu 100.000đ để đặt hộ (cần thêm ${formatCurrency(needed)})`;
      this.lastValidationError = msg;
      this.showToast(msg, 'warning');

      if (typeof document !== 'undefined') {
        const warningEl =
          document.getElementById('min-order-notice-card') ||
          (typeof document.querySelector === 'function' ? document.querySelector('.drawer-scroll-body') : null);
        if (warningEl && typeof warningEl.scrollIntoView === 'function') {
          warningEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          warningEl.classList.add('animate-shake');
          setTimeout(() => warningEl.classList.remove('animate-shake'), 400);
        }
      }
      return false;
    }

    if (!this.orderType) {
      const msg = 'Vui lòng chọn "Giao Tận Nơi" hoặc "Ăn Tại Quán" để tiếp tục!';
      this.lastValidationError = msg;
      this.showToast(msg, 'warning');

      if (typeof document !== 'undefined') {
        const selectorCard = document.getElementById('order-type-selector-card');
        if (selectorCard) {
          if (typeof selectorCard.scrollIntoView === 'function') {
            selectorCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          selectorCard.classList?.add('animate-shake', 'ring-2', 'ring-red-400', 'border-red-400');
          setTimeout(() => {
            selectorCard.classList?.remove('animate-shake', 'ring-2', 'ring-red-400', 'border-red-400');
          }, 800);
        }
      }
      return false;
    }

    if (!this.customerInfo.lastName || !this.customerInfo.lastName.trim()) {
      const msg = 'Vui lòng nhập Họ của bạn!';
      this.lastValidationError = msg;
      this.showToast(msg, 'warning');
      if (typeof document !== 'undefined') {
        const input = document.getElementById('customer-lastname');
        if (input) {
          if (typeof input.scrollIntoView === 'function') input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => input.focus?.(), 250);
          this._highlightFieldError(input, msg);
        }
      }
      return false;
    }

    if (!this.customerInfo.firstName || !this.customerInfo.firstName.trim()) {
      const msg = 'Vui lòng nhập Tên của bạn!';
      this.lastValidationError = msg;
      this.showToast(msg, 'warning');
      if (typeof document !== 'undefined') {
        const input = document.getElementById('customer-firstname');
        if (input) {
          if (typeof input.scrollIntoView === 'function') input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => input.focus?.(), 250);
          this._highlightFieldError(input, msg);
        }
      }
      return false;
    }

    if (!this.customerInfo.phone || !this.customerInfo.phone.trim()) {
      const msg = 'Vui lòng nhập Số điện thoại liên hệ!';
      this.lastValidationError = msg;
      this.showToast(msg, 'warning');
      if (typeof document !== 'undefined') {
        const input = document.getElementById('customer-phone');
        if (input) {
          if (typeof input.scrollIntoView === 'function') input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => input.focus?.(), 250);
          this._highlightFieldError(input, msg);
        }
      }
      return false;
    }

    if (!isValidVietnamesePhone(this.customerInfo.phone)) {
      const msg = 'Số điện thoại không hợp lệ (cần 10 chữ số, VD: 0912345678)!';
      this.lastValidationError = msg;
      this.showToast(msg, 'warning');
      if (typeof document !== 'undefined') {
        const input = document.getElementById('customer-phone');
        if (input) {
          if (typeof input.scrollIntoView === 'function') input.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => input.focus?.(), 250);
          this._highlightFieldError(input, msg);
        }
      }
      return false;
    }

    if (this.orderType === 'delivery') {
      if (!this.customerInfo.address || !this.customerInfo.address.trim()) {
        const msg = 'Vui lòng nhập Địa chỉ giao hàng chi tiết!';
        this.lastValidationError = msg;
        this.showToast(msg, 'warning');
        if (typeof document !== 'undefined') {
          const input = document.getElementById('customer-address');
          if (input) {
            if (typeof input.scrollIntoView === 'function') input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => input.focus?.(), 250);
            this._highlightFieldError(input, msg);
          }
        }
        return false;
      }
    } else if (this.orderType === 'dinein') {
      if (!this._getUsablePickupTime(now)) {
        const msg = this.customerInfo.pickupTime?.trim()
          ? 'Giờ nhận đã chọn không còn khả dụng. Vui lòng chọn lại giờ còn ít nhất 30 phút chuẩn bị!'
          : 'Vui lòng chạm chọn Thời gian nhận món hôm nay!';
        this.lastValidationError = msg;
        this.showToast(msg, 'warning');
        if (typeof document !== 'undefined') {
          const input = document.getElementById('customer-pickup-time');
          if (input) {
            if (typeof input.scrollIntoView === 'function') input.scrollIntoView({ behavior: 'smooth', block: 'center' });
            this._highlightFieldError(input, msg);
          }
        }
        return false;
      }
    }

    this.lastValidationError = null;
    return true;
  }

  /**
   * Tạo danh sách gợi ý "Món Bù Đủ Mốc 1 Chạm" ngay dưới thanh tiến trình chiết khấu
   */
  _generateUpsellChipsHtml(neededAmount) {
    if (typeof this.getUpsellSuggestions !== 'function' || neededAmount <= 0) return '';
    const suggestions = this.getUpsellSuggestions(neededAmount);
    if (!Array.isArray(suggestions) || suggestions.length === 0) return '';

    const chips = suggestions
      .slice(0, 3)
      .map(p => {
        const safeName = escapeHtml(p.name);
        const safeId = escapeHtml(p.id);
        const imgUrl = safeImageUrl(p.image);
        return `
          <div class="flex-shrink-0 w-44 bg-white/95 border border-amber-200 rounded-xl p-2 flex items-center gap-2 shadow-sm">
            <img src="${imgUrl}" alt="${safeName}" width="36" height="36" loading="lazy" decoding="async" draggable="false"
              class="w-9 h-9 rounded-lg object-contain bg-amber-50/60 p-0.5 flex-shrink-0"
              onerror="this.onerror=null; this.src='${FALLBACK_FOOD_IMAGE}'">
            <div class="min-w-0 flex-1">
              <div class="text-[11px] font-bold text-gray-800 truncate" title="${safeName}">${safeName}</div>
              <div class="flex items-center justify-between gap-1 mt-0.5">
                <span class="text-[11px] font-black text-[#d71920]">${formatCurrency(p.price)}</span>
                <button type="button" class="btn-upsell-quick-add bg-[#d71920] hover:bg-[#b81218] text-white text-[10px] font-extrabold px-2 py-1 rounded-lg flex items-center gap-0.5 active:scale-95 transition"
                  data-product-id="${safeId}" aria-label="Thêm nhanh ${safeName}">
                  ${IconPlus('w-2.5 h-2.5')}
                  <span>Thêm</span>
                </button>
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="pt-2 mt-1 border-t border-amber-200/70">
        <div class="text-[10px] font-extrabold uppercase tracking-wider text-amber-900 mb-1.5 flex items-center gap-1">
          <span>⚡ Gợi ý thêm nhanh cho đủ mốc:</span>
        </div>
        <div class="mouse-drag-scroll flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          ${chips}
        </div>
      </div>
    `;
  }

  /**
   * Tạo khối kích thích mua thêm & nấc thang ưu đãi (Smart Upsell Milestones)
   */
  _generateUpsellBlock(pricing) {
    const total = pricing.originalTotal;
    const isDelivery = this.orderType === 'delivery';

    if (total < 100000) {
      const needed = 100000 - total;
      const progressPercent = Math.min(100, Math.max(8, Math.round((total / 100000) * 100)));
      return `
        <div class="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl shadow-sm space-y-2">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <span class="text-amber-600 flex items-center">${IconSparkles('w-3.5 h-3.5')}</span>
              <span>Mốc ưu đãi đầu tiên: <b>100.000đ</b></span>
            </span>
            <span class="text-[10px] font-extrabold bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
              Sắp được giảm 15k!
            </span>
          </div>
          <p class="text-xs text-amber-950 leading-snug">
            Chọn thêm <b>${formatCurrency(needed)}</b> nữa để kích hoạt ưu đãi <b>Giảm ngay 15.000đ</b>! 🔥
          </p>
          <div class="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ đạt mốc 100.000đ">
            <div class="h-full bg-gradient-to-r from-amber-400 to-[#d71920] rounded-full transition-all duration-500 ease-out" style="width: ${progressPercent}%"></div>
          </div>
          <div class="flex justify-between text-[10px] text-gray-600 font-semibold">
            <span>Đã chọn: ${formatCurrency(total)}</span>
            <span class="text-red-700 font-bold">Mốc 100k (Giảm 15k)</span>
          </div>
          ${this._generateUpsellChipsHtml(needed)}
        </div>
      `;
    }

    if (total < 200000) {
      const needed = 200000 - total;
      const progressPercent = Math.min(100, Math.max(8, Math.round(((total - 100000) / 100000) * 100)));
      return `
        <div class="p-3 bg-gradient-to-r from-amber-50 to-red-50 border border-amber-300/80 rounded-2xl shadow-sm space-y-2">
          <div class="flex items-center justify-between">
            <span class="flex items-center gap-1.5 text-xs font-extrabold text-red-900">
              <span class="text-[#d71920] flex items-center">${IconSparkles('w-3.5 h-3.5 animate-pulse')}</span>
              <span>Mốc siêu hời kế tiếp: <b>200.000đ</b></span>
            </span>
            <span class="text-[10px] font-black bg-gradient-to-r from-amber-500 to-red-600 text-white px-2 py-0.5 rounded-full shadow-sm">
              ${isDelivery ? 'Giảm 30k + Freeship' : 'Giảm 30.000đ'}
            </span>
          </div>
          <p class="text-xs text-gray-800 leading-snug">
            ${isDelivery
              ? `Mua thêm chỉ <b>${formatCurrency(needed)}</b> ➔ <b>Giảm thêm 15k (Tổng giảm 30k)</b> + <b>FREESHIP tận nơi</b>! 🎁 <span class="text-green-700 font-bold block mt-0.5">(Tiết kiệm thêm 25.000đ so với hiện tại)</span>`
              : `Mua thêm chỉ <b>${formatCurrency(needed)}</b> ➔ <b>Giảm thêm 15.000đ (Tổng giảm 30.000đ)</b>! Đặt càng nhiều càng rẻ! 🔥`
            }
          </p>
          <div class="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ đạt mốc 200.000đ">
            <div class="h-full bg-gradient-to-r from-amber-400 to-[#d71920] rounded-full transition-all duration-500 ease-out" style="width: ${progressPercent}%"></div>
          </div>
          <div class="flex justify-between text-[10px] text-gray-600 font-semibold">
            <span>Mốc 100k (Đã giảm 15k)</span>
            <span class="text-red-700 font-bold">Mốc 200k (${isDelivery ? 'Giảm 30k + Freeship' : 'Giảm 30k'})</span>
          </div>
          ${this._generateUpsellChipsHtml(needed)}
        </div>
      `;
    }

    const currentStep = Math.floor(total / 100000);
    const nextStep = (currentStep + 1) * 100000;
    const needed = nextStep - total;
    const nextTotalDiscount = (currentStep + 1) * 15000;
    const progressInStep = total - currentStep * 100000;
    const progressPercent = Math.min(100, Math.max(8, Math.round((progressInStep / 100000) * 100)));

    return `
      <div class="p-3 bg-gradient-to-r from-emerald-50 via-teal-50 to-green-50 border border-emerald-300/80 rounded-2xl shadow-sm space-y-2">
        <div class="flex items-center justify-between">
          <span class="flex items-center gap-1.5 text-xs font-extrabold text-emerald-950">
            <span class="text-emerald-600 flex items-center">${IconSparkles('w-3.5 h-3.5')}</span>
            <span>Mục tiêu tiếp theo: <b>${formatCurrency(nextStep)}</b></span>
          </span>
          <span class="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-sm">
            ${isDelivery ? 'Freeship 100%' : 'Ưu đãi lớn'}
          </span>
        </div>
        <p class="text-xs text-gray-800 leading-snug">
          Thêm <b>${formatCurrency(needed)}</b> nữa để được <b>Giảm thêm 15.000đ</b> (Tổng tiết kiệm lên tới <b>${formatCurrency(nextTotalDiscount)}</b>)! Mua càng nhiều, chiết khấu càng sâu! 🎉
        </p>
        <div class="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden" role="progressbar" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100" aria-label="Tiến độ đạt mốc ưu đãi kế tiếp">
          <div class="h-full bg-gradient-to-r from-emerald-400 to-green-600 rounded-full transition-all duration-500 ease-out" style="width: ${progressPercent}%"></div>
        </div>
        <div class="flex justify-between text-[10px] text-gray-600 font-semibold">
          <span>Mốc ${Math.round((currentStep * 100000) / 1000)}k (Đã giảm ${Math.round(pricing.discountAmount / 1000)}k)</span>
          <span class="text-emerald-700 font-extrabold">Mốc ${Math.round(nextStep / 1000)}k (Giảm ${Math.round(nextTotalDiscount / 1000)}k)</span>
        </div>
        ${this._generateUpsellChipsHtml(needed)}
      </div>
    `;
  }

  render(focusRestoreInfo = null) {
    const container = this.getContainer();
    const existingScrollEl = container.querySelector('.drawer-scroll-body');
    const prevScrollTop = existingScrollEl ? existingScrollEl.scrollTop : 0;

    const items = this.cart.getItems();
    const pricing = this.cart.getTotals(this.orderType, this.config);

    let itemsListHtml = '';
    if (items.length === 0) {
      itemsListHtml = `
        <div class="text-center py-12 text-gray-500">
          <div class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            ${IconShoppingBag('w-8 h-8')}
          </div>
          <p class="font-bold text-gray-700 text-sm">Giỏ hàng của bạn đang trống</p>
          <p class="text-xs text-gray-500 mt-1">Hãy chọn món ăn ngon để xem báo giá ưu đãi nhé!</p>
        </div>
      `;
    } else {
      items.forEach(item => {
        const itemTotal = item.unitPrice * item.quantity;
        const escapedItemName = escapeHtml(item.name);
        const escapedCartItemId = escapeHtml(item.cartItemId);
        const safeThumb = safeImageUrl(item.image);

        let optionsDetailsHtml = '';
        if (item.selectedOptions && item.selectedOptions.length > 0) {
          const listItems = item.selectedOptions
            .map(opt => `
              <li class="flex items-center gap-1.5 text-xs text-gray-700 font-medium leading-snug">
                <span class="text-[#d71920] font-bold text-[10px] flex-shrink-0" aria-hidden="true">•</span>
                <div class="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                  <span class="break-words">${escapeHtml(opt.option_name || opt.name)}</span>
                  ${opt.extra_price > 0 ? `<span class="inline-flex items-center text-red-700 font-extrabold text-[10px] bg-red-100/90 px-1.5 py-0.5 rounded-md leading-none flex-shrink-0">(+${formatCurrency(opt.extra_price)})</span>` : ''}
                </div>
              </li>
            `)
            .join('');

          optionsDetailsHtml = `
            <div class="mt-1.5 p-2 bg-amber-50/70 rounded-xl border border-amber-200/60 shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-[#d71920] flex-shrink-0" aria-hidden="true"></span>
                <span>Chi tiết món đã chọn:</span>
              </div>
              <ul class="space-y-1">
                ${listItems}
              </ul>
            </div>
          `;
        } else if (item.optionsText) {
          const parts = item.optionsText.split(',').map(s => s.trim()).filter(Boolean);
          const listItems = parts
            .map(part => `
              <li class="flex items-center gap-1.5 text-xs text-gray-700 font-medium leading-snug">
                <span class="text-[#d71920] font-bold text-[10px] flex-shrink-0" aria-hidden="true">•</span>
                <span class="break-words flex-1 min-w-0">${escapeHtml(part)}</span>
              </li>
            `)
            .join('');

          optionsDetailsHtml = `
            <div class="mt-1.5 p-2 bg-amber-50/70 rounded-xl border border-amber-200/60 shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-[#d71920] flex-shrink-0" aria-hidden="true"></span>
                <span>Tùy chọn:</span>
              </div>
              <ul class="space-y-1">
                ${listItems}
              </ul>
            </div>
          `;
        } else if (item.description && item.description.includes('+')) {
          const parts = item.description.split('+').map(s => s.trim()).filter(Boolean);
          const listItems = parts
            .map(part => `
              <li class="flex items-center gap-1.5 text-xs text-gray-700 font-medium leading-snug">
                <span class="text-[#d71920] font-bold text-[10px] flex-shrink-0" aria-hidden="true">•</span>
                <span class="break-words flex-1 min-w-0">${escapeHtml(part)}</span>
              </li>
            `)
            .join('');

          optionsDetailsHtml = `
            <div class="mt-1.5 p-2 bg-amber-50/70 rounded-xl border border-amber-200/60 shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-[#d71920] flex-shrink-0" aria-hidden="true"></span>
                <span>Combo bao gồm:</span>
              </div>
              <ul class="space-y-1">
                ${listItems}
              </ul>
            </div>
          `;
        }

        itemsListHtml += `
          <div class="py-3 border-b border-gray-100 last:border-b-0 flex gap-2.5 sm:gap-3 items-start">
            ${item.image ? `
              <button type="button" class="btn-cart-img-preview cursor-zoom-in relative group w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-amber-50/60 p-1 border border-amber-100 flex-shrink-0 overflow-hidden flex items-center justify-center self-start mt-0.5 focus:outline-none active:scale-95 transition" 
                data-img="${safeThumb}" 
                data-name="${escapedItemName}" 
                data-price="${item.unitPrice}" 
                aria-label="Phóng to ảnh ${escapedItemName}"
                title="Nhấn để xem ảnh phóng to">
                <img src="${safeThumb}" alt="${escapedItemName}" width="56" height="56" loading="lazy" decoding="async" class="w-full h-full object-contain transform group-hover:scale-105 transition" onerror="this.onerror=null; this.src='${FALLBACK_FOOD_IMAGE}'">
              </button>
            ` : ''}

            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <h4 class="font-extrabold text-sm text-gray-900 leading-snug break-words">${escapedItemName}</h4>
                  ${item.isCombo ? `
                    <button type="button" class="btn-cart-edit-combo mt-1 inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg transition active:scale-95"
                      data-id="${escapedCartItemId}" aria-label="Tùy chỉnh vị và thức uống trong ${escapedItemName}">
                      ${IconSliders('w-3 h-3')}
                      <span>Tùy chỉnh combo</span>
                    </button>
                  ` : ''}
                </div>
                <button type="button" class="w-9 h-9 -mr-1 -mt-1 flex items-center justify-center text-gray-500 hover:text-red-600 rounded-xl hover:bg-red-50 btn-cart-remove flex-shrink-0 transition active:scale-95"
                  data-id="${escapedCartItemId}" aria-label="Xóa ${escapedItemName} khỏi giỏ" title="Xóa món">
                  ${IconTrash('w-4 h-4')}
                </button>
              </div>

              ${optionsDetailsHtml}

              <div class="flex items-center justify-between mt-2.5 pt-1.5 border-t border-gray-100">
                <div class="flex items-baseline gap-1.5 flex-wrap">
                  <span class="text-[11px] text-gray-600">Đơn giá:</span>
                  <span class="font-bold text-sm text-red-600">${formatCurrency(item.unitPrice)}</span>
                  ${item.quantity > 1 ? `<span class="text-xs text-gray-600 font-medium whitespace-nowrap">x ${item.quantity} = <b class="text-red-700">${formatCurrency(itemTotal)}</b></span>` : ''}
                </div>

                <div class="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shadow-sm flex-shrink-0">
                  <button type="button" class="w-9 h-9 flex items-center justify-center text-gray-700 hover:bg-gray-200 active:scale-95 transition btn-cart-minus" data-id="${escapedCartItemId}" aria-label="Giảm số lượng ${escapedItemName}">
                    ${IconMinus('w-3.5 h-3.5')}
                  </button>
                  <span class="w-7 text-center text-xs font-extrabold text-gray-900" aria-live="polite">${item.quantity}</span>
                  <button type="button" class="w-9 h-9 flex items-center justify-center text-gray-700 hover:bg-gray-200 active:scale-95 transition btn-cart-plus" data-id="${escapedCartItemId}" aria-label="Tăng số lượng ${escapedItemName}">
                    ${IconPlus('w-3.5 h-3.5')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      });
    }

    const isDelivery = this.orderType === 'delivery';
    const isDinein = this.orderType === 'dinein';
    const freeshipThreshold = this.config?.freeshipThreshold || 200000;
    const deliveryFeeHint =
      pricing.originalTotal >= freeshipThreshold ? 'Miễn phí ship (0đ)' : 'Ship 10k • ≥200k Freeship';

    const orderTypeSelectorHtml = items.length > 0 ? `
      <div id="order-type-selector-card" class="rounded-2xl border-2 p-3.5 shadow-sm transition-all duration-300 ${
        !this.orderType
          ? 'bg-amber-50/70 border-amber-300'
          : 'bg-white border-gray-200'
      }" role="group" aria-label="Chọn hình thức nhận đơn">
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <span class="text-xs font-extrabold text-gray-900 uppercase tracking-wide">
            ${!this.orderType ? 'Bạn muốn nhận đơn theo cách nào?' : 'Hình thức nhận đơn'}
          </span>
          <span class="text-[10px] font-black px-2 py-0.5 rounded-full flex-shrink-0 ${
            !this.orderType
              ? 'bg-red-100 text-[#d71920]'
              : 'bg-green-100 text-green-800'
          }">
            ${!this.orderType ? 'Bắt buộc chọn *' : 'Đã chọn'}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <button type="button" id="btn-type-delivery" aria-pressed="${isDelivery ? 'true' : 'false'}"
            class="relative rounded-xl border-2 p-3 text-left transition active:scale-95 flex flex-col gap-1.5 ${
              isDelivery
                ? 'border-[#d71920] bg-red-50/70 ring-2 ring-red-200/70 shadow-sm'
                : 'border-gray-200 bg-white hover:border-red-300 hover:bg-red-50/20'
            }">
            <div class="flex items-center justify-between w-full">
              <span class="w-8 h-8 rounded-lg flex items-center justify-center ${
                isDelivery ? 'bg-[#d71920] text-white' : 'bg-red-50 text-[#d71920]'
              }">
                ${IconBike('w-4 h-4')}
              </span>
              ${isDelivery ? `<span class="text-[#d71920]">${IconCheckCircle('w-4 h-4')}</span>` : ''}
            </div>
            <div>
              <div class="font-black text-xs sm:text-sm text-gray-900 leading-tight">Giao Tận Nơi</div>
              <div class="text-[10px] font-bold mt-0.5 ${
                pricing.originalTotal >= freeshipThreshold ? 'text-green-700' : 'text-gray-600'
              }">${deliveryFeeHint}</div>
            </div>
          </button>

          <button type="button" id="btn-type-dinein" aria-pressed="${isDinein ? 'true' : 'false'}"
            class="relative rounded-xl border-2 p-3 text-left transition active:scale-95 flex flex-col gap-1.5 ${
              isDinein
                ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200/80 shadow-sm'
                : 'border-gray-200 bg-white hover:border-amber-300 hover:bg-amber-50/30'
            }">
            <div class="flex items-center justify-between w-full">
              <span class="w-8 h-8 rounded-lg flex items-center justify-center ${
                isDinein ? 'bg-[#ffc72c] text-gray-950' : 'bg-amber-50 text-amber-800'
              }">
                ${IconUtensils('w-4 h-4')}
              </span>
              ${isDinein ? `<span class="text-amber-700">${IconCheckCircle('w-4 h-4')}</span>` : ''}
            </div>
            <div>
              <div class="font-black text-xs sm:text-sm text-gray-900 leading-tight">Ăn Tại Quán</div>
              <div class="text-[10px] font-bold text-green-700 mt-0.5">0đ phí ship • Tới quầy lấy</div>
            </div>
          </button>
        </div>
      </div>
    ` : '';

    let shippingRowText = 'Chọn hình thức nhận ở trên';
    let shippingRowClass = 'text-amber-800';
    if (isDinein) {
      shippingRowText = '0đ (Ăn tại quán)';
      shippingRowClass = 'text-green-700';
    } else if (isDelivery) {
      shippingRowText = pricing.shippingFee === 0 ? 'Miễn phí (Freeship)' : formatCurrency(pricing.shippingFee);
      shippingRowClass = pricing.shippingFee === 0 ? 'text-green-700' : 'text-gray-800';
    }

    const innerContentHtml = `
      <!-- Drawer Body Scrollable -->
      <div class="drawer-scroll-body flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
        
        ${orderTypeSelectorHtml}

        <!-- Items List -->
        <div class="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-gray-100 mb-1">
            <span class="text-xs font-bold text-gray-600 uppercase tracking-wider">Món đã chọn (${this.cart.getTotalItemCount()})</span>
            ${items.length > 0 ? `<button type="button" id="btn-clear-cart" class="text-xs font-bold text-red-600 hover:text-red-700 hover:underline px-2 py-1 rounded-lg">Xóa tất cả</button>` : ''}
          </div>
          <div>${itemsListHtml}</div>
        </div>

        ${items.length > 0 ? `
          ${isDelivery ? `
            <div class="bg-amber-50/40 rounded-2xl border border-amber-200/80 p-3.5 shadow-sm space-y-3">
              <div class="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                <span class="text-amber-700">${IconFileText('w-4 h-4')}</span>
                <span>Thông Tin Giao Hàng</span>
              </div>
              <div class="p-2.5 bg-amber-100/80 border border-amber-300 rounded-xl text-[11px] sm:text-xs text-amber-950 flex items-start gap-2 leading-snug">
                <span class="text-[#d71920] flex-shrink-0 mt-0.5">${IconClock('w-4 h-4')}</span>
                <span><b>Lưu ý:</b> Thời gian chuẩn bị đơn hàng <b>ít nhất 30 phút</b> tính từ lúc đặt hàng thành công.</span>
              </div>
              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label for="customer-lastname" class="block text-[11px] font-bold text-gray-700 mb-1">Họ *</label>
                  <input type="text" id="customer-lastname" value="${escapeHtml(this.customerInfo.lastName)}" placeholder="VD: Nguyễn *" autocomplete="family-name"
                    class="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white transition">
                </div>
                <div>
                  <label for="customer-firstname" class="block text-[11px] font-bold text-gray-700 mb-1">Tên *</label>
                  <input type="text" id="customer-firstname" value="${escapeHtml(this.customerInfo.firstName)}" placeholder="VD: Văn A *" autocomplete="given-name"
                    class="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white transition">
                </div>
              </div>
              <div>
                <label for="customer-phone" class="block text-[11px] font-bold text-gray-700 mb-1">Số điện thoại nhận hàng *</label>
                <input type="tel" id="customer-phone" value="${escapeHtml(this.customerInfo.phone)}" placeholder="VD: 0912345678 *" autocomplete="tel"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white transition">
              </div>
              <div>
                <label for="customer-address" class="block text-[11px] font-bold text-gray-700 mb-1">Địa chỉ giao hàng chi tiết *</label>
                <input type="text" id="customer-address" value="${escapeHtml(this.customerInfo.address)}" placeholder="Số nhà, ngõ/đường, phường, quận/huyện *" autocomplete="street-address"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white transition">
              </div>
              <div>
                <label for="customer-note" class="block text-[11px] font-bold text-gray-700 mb-1">Ghi chú cho shipper (nếu có)</label>
                <input type="text" id="customer-note" value="${escapeHtml(this.customerInfo.note)}" placeholder="Ví dụ: Gọi trước khi giao, gửi bảo vệ..." 
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white transition">
              </div>
            </div>
          ` : isDinein ? `
            <div class="bg-amber-50/50 rounded-2xl border border-amber-200/90 p-3.5 shadow-sm space-y-3">
              <div class="flex items-center justify-between gap-2">
                <div class="text-xs font-extrabold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span class="text-amber-700">${IconUtensils('w-4 h-4')}</span>
                  <span>Thông Tin Ăn Tại Quán / Tới Lấy</span>
                </div>
                <span class="text-[10px] font-black bg-green-100 text-green-800 px-2 py-0.5 rounded-full">0đ phí ship</span>
              </div>
              <div class="p-2.5 bg-amber-100/80 border border-amber-300 rounded-xl text-[11px] sm:text-xs text-amber-950 flex items-start gap-2 leading-snug">
                <span class="text-[#d71920] flex-shrink-0 mt-0.5">${IconClock('w-4 h-4')}</span>
                <span><b>Lưu ý quan trọng:</b> Thời gian chuẩn bị đơn hàng <b>ít nhất 30 phút</b> tính từ lúc đặt hàng thành công.</span>
              </div>
              <div class="grid grid-cols-2 gap-2.5">
                <div>
                  <label for="customer-lastname" class="block text-[11px] font-bold text-gray-700 mb-1">Họ *</label>
                  <input type="text" id="customer-lastname" value="${escapeHtml(this.customerInfo.lastName)}" placeholder="VD: Nguyễn *" autocomplete="family-name"
                    class="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white transition">
                </div>
                <div>
                  <label for="customer-firstname" class="block text-[11px] font-bold text-gray-700 mb-1">Tên *</label>
                  <input type="text" id="customer-firstname" value="${escapeHtml(this.customerInfo.firstName)}" placeholder="VD: Văn A *" autocomplete="given-name"
                    class="w-full px-3 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white transition">
                </div>
              </div>
              <div>
                <label for="customer-phone" class="block text-[11px] font-bold text-gray-700 mb-1">Số điện thoại liên hệ *</label>
                <input type="tel" id="customer-phone" value="${escapeHtml(this.customerInfo.phone)}" placeholder="VD: 0912345678 *" autocomplete="tel"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white transition">
              </div>
              <div>
                <label for="customer-pickup-time" class="block text-[11px] font-bold text-gray-700 mb-1">Thời gian nhận hôm nay (lúc mấy giờ) *</label>
                <div id="btn-open-time-picker" class="relative cursor-pointer group">
                  <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#d71920] flex items-center">
                    ${IconClock('w-4 h-4')}
                  </span>
                  <input type="text" id="customer-pickup-time" readonly value="${escapeHtml(this._getUsablePickupTime())}" placeholder="Chạm để cuộn chọn giờ nhận... *"
                    class="w-full pl-10 pr-24 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-900 placeholder-gray-400 placeholder:font-normal focus:ring-2 focus:ring-red-500 focus:outline-none bg-white cursor-pointer transition">
                  <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 bg-amber-100 group-hover:bg-amber-200 text-amber-950 text-[11px] font-extrabold px-2.5 py-1 rounded-lg border border-amber-300 flex items-center gap-1 transition">
                    <span>Chọn giờ</span>
                    ${IconChevronDown('w-3 h-3')}
                  </span>
                </div>
              </div>
              <div>
                <label for="customer-note" class="block text-[11px] font-bold text-gray-700 mb-1">Ghi chú thêm (nếu có)</label>
                <input type="text" id="customer-note" value="${escapeHtml(this.customerInfo.note)}" placeholder="Ví dụ: Ăn tại chỗ hay đóng gói mang về..." 
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white transition">
              </div>
            </div>
          ` : ''}

          <!-- Price Breakdown Card -->
          <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-2.5">
            <div class="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center justify-between pb-1 border-b border-gray-100">
              <span class="flex items-center gap-1.5">
                <span class="text-gray-600">${IconReceipt('w-4 h-4')}</span>
                <span>Chi Tiết Ưu Đãi Đơn Hàng</span>
              </span>
              ${pricing.discountAmount > 0 ? `
                <span class="text-green-800 bg-green-50 px-2 py-0.5 rounded-full font-black text-[10px] border border-green-200">
                  TIẾT KIỆM ${formatCurrency(pricing.discountAmount)}
                </span>
              ` : ''}
            </div>

            <div class="flex justify-between text-xs sm:text-sm text-gray-600">
              <span>Tổng giá gốc tại Jollibee:</span>
              <span class="font-semibold line-through">${formatCurrency(pricing.originalTotal)}</span>
            </div>

            <div class="flex justify-between text-xs sm:text-sm text-green-700 font-bold">
              <span>Chiết khấu đặt hộ (-15k/100k):</span>
              <span>-${formatCurrency(pricing.discountAmount)}</span>
            </div>

            <div class="flex justify-between text-xs sm:text-sm text-gray-700">
              <span>Phí giao hàng:</span>
              <span class="font-bold ${shippingRowClass}">
                ${shippingRowText}
              </span>
            </div>

            <!-- Khối Kích Thích Mua Thêm & Nâng Hạng Chiết Khấu -->
            <div class="pt-1">
              ${this._generateUpsellBlock(pricing)}
            </div>

            <div class="pt-2 border-t border-gray-200 flex justify-between items-baseline">
              <div>
                <span class="font-extrabold text-sm text-gray-900">${this.orderType ? 'Khách thực trả:' : 'Tạm tính sau giảm:'}</span>
                <p class="text-[10px] text-gray-500">${this.orderType ? 'Cam kết không phát sinh phụ phí' : 'Chưa tính phí ship (nếu giao hàng < 200k)'}</p>
              </div>
              <span class="font-black text-2xl text-red-600">${formatCurrency(pricing.finalTotal)}</span>
            </div>
          </div>

          ${pricing.originalTotal < 100000 ? `
            <div id="min-order-notice-card" class="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start gap-3 shadow-sm transition-all duration-300">
              <div class="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                ${IconSparkles('w-4 h-4')}
              </div>
              <div class="flex-1">
                <div class="font-black text-[#d71920] text-sm flex items-center justify-between gap-2">
                  <span>Chọn thêm ${formatCurrency(100000 - pricing.originalTotal)} để mở khóa giảm 15.000đ!</span>
                  <span class="bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded text-[10px] font-extrabold flex-shrink-0">Sắp nhận ưu đãi</span>
                </div>
                <div class="mt-1 leading-relaxed text-gray-700">
                  Ưu đãi đặt hộ giảm <b>15.000đ</b> áp dụng cho đơn từ <b>100.000đ</b> trở lên.
                  <div class="mt-1.5 text-red-700 font-extrabold flex items-center gap-1.5">
                    <span class="text-red-700 flex items-center">${IconArrowRight('w-3.5 h-3.5')}</span>
                    <span>Gợi ý: Thêm 1 món ăn kèm hoặc nước ngọt là nhận giá hời ngay!</span>
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div class="p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl text-xs text-green-900 flex items-start gap-2.5 shadow-sm">
              <span class="text-green-600 flex-shrink-0 mt-0.5">${IconCheckCircle('w-4 h-4')}</span>
              <div class="flex-1 leading-snug">
                <span class="font-extrabold text-green-800">Đã kích hoạt đặt hộ & giảm ngay -${formatCurrency(pricing.discountAmount)}${pricing.shippingFee === 0 && isDelivery ? ' (Freeship)' : ''}!</span>
                <span class="text-green-700 block text-[11px] mt-0.5">
                  💡 <b>Mẹo tiết kiệm</b>: Thêm <b>${formatCurrency(((Math.floor(pricing.originalTotal / 100000) + 1) * 100000) - pricing.originalTotal)}</b> nữa để được giảm thêm <b>15.000đ</b> (Tổng giảm ${formatCurrency((Math.floor(pricing.originalTotal / 100000) + 1) * 15000)})!
                </span>
              </div>
            </div>
          `}
        ` : ''}

      </div>

      <!-- Drawer Footer Action Buttons -->
      ${items.length > 0 ? `
        <div class="p-4 bg-white border-t border-gray-200 shadow-xl space-y-2 flex-shrink-0">
          ${pricing.originalTotal < 100000 ? `
            <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-950 font-extrabold flex items-center justify-center gap-1.5 shadow-sm">
              ${IconSparkles('w-4 h-4 text-amber-600')}
              <span>Chọn thêm ${formatCurrency(100000 - pricing.originalTotal)} để mở khóa giảm 15.000đ</span>
            </div>
          ` : !this.orderType ? `
            <div class="p-2 bg-amber-50 border border-amber-200 rounded-xl text-center text-[11px] text-amber-950 font-extrabold flex items-center justify-center gap-1.5">
              <span>👆 Chọn "Giao Tận Nơi" hoặc "Ăn Tại Quán" ở trên để chốt đơn</span>
            </div>
          ` : ''}
          <button type="button" id="btn-copy-order" class="w-full ${pricing.originalTotal < 100000 ? 'bg-red-400 opacity-85' : 'bg-[#d71920] hover:bg-[#b81218]'} text-white font-extrabold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition text-sm whitespace-nowrap truncate">
            ${IconCopy('w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0')}
            <span class="truncate">Sao Chép Đơn & Gửi Shop Đặt Ngay</span>
          </button>
        </div>
      ` : ''}
    `;

    let panel = container.querySelector('#cart-drawer-panel');

    if (!panel) {
      container.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 bg-black/60 animate-backdrop" id="cart-drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
          <div id="cart-drawer-panel" class="relative w-full sm:max-w-md h-[94vh] sm:h-full bg-white rounded-t-3xl sm:rounded-none flex flex-col shadow-2xl overflow-hidden animate-drawer-panel transform-gpu will-change-transform">
            
            <!-- Drawer Header -->
            <div class="flex items-center justify-between p-3.5 sm:p-4 bg-[#d71920] text-white flex-shrink-0">
              <div class="flex items-center gap-2 min-w-0 pr-2">
                <span class="flex-shrink-0">${IconShoppingBag('w-5 h-5')}</span>
                <h3 id="cart-drawer-title" class="font-extrabold text-base sm:text-lg truncate">Giỏ Hàng & Ưu Đãi</h3>
              </div>
              <button type="button" id="cart-drawer-close-btn" class="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition flex-shrink-0 active:scale-95" aria-label="Đóng giỏ hàng">${IconX('w-4 h-4')}</button>
            </div>

            <!-- Vùng nội dung động -->
            <div id="cart-drawer-inner" class="flex-1 flex flex-col min-h-0 overflow-hidden">
              ${innerContentHtml}
            </div>

          </div>
        </div>
      `;

      panel = container.querySelector('#cart-drawer-panel');
      if (panel) {
        panel.addEventListener(
          'animationend',
          () => {
            panel.classList.remove('animate-drawer-panel');
          },
          { once: true }
        );
      }

      if (this._releaseFocusTrap) {
        this._releaseFocusTrap();
      }
      this._releaseFocusTrap = trapFocusInModal(panel || container);

      this._bindGlobalDrawerEvents();
      this._bindDelegatedPanelEvents(panel);
    } else {
      const innerContainer = panel.querySelector('#cart-drawer-inner');
      if (innerContainer) {
        innerContainer.innerHTML = innerContentHtml;
      }
    }

    const newScrollEl = container.querySelector('.drawer-scroll-body');
    if (newScrollEl && prevScrollTop > 0) {
      newScrollEl.scrollTop = prevScrollTop;
    }

    if (typeof container.querySelectorAll === 'function') {
      container.querySelectorAll('.mouse-drag-scroll').forEach(el => bindMouseDragScroll(el));
    } else if (typeof container.querySelector === 'function') {
      bindMouseDragScroll(container.querySelector('.mouse-drag-scroll'));
    }

    // Khôi phục tiêu điểm bàn phím cho nút vừa bấm (VD: nhấn liên tiếp Enter trên nút +)
    if (focusRestoreInfo && panel && typeof panel.querySelectorAll === 'function') {
      const candidates = Array.from(panel.querySelectorAll(focusRestoreInfo.btnClass));
      const matched = candidates.find(el => el.dataset?.id === focusRestoreInfo.cartItemId);
      if (matched && typeof matched.focus === 'function') {
        matched.focus();
      }
    }
  }

  _saveFormInputs() {
    if (typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
    const lastEl = document.getElementById('customer-lastname');
    if (lastEl && lastEl.value !== undefined) this.customerInfo.lastName = lastEl.value;

    const firstEl = document.getElementById('customer-firstname');
    if (firstEl && firstEl.value !== undefined) this.customerInfo.firstName = firstEl.value;

    const phoneEl = document.getElementById('customer-phone');
    if (phoneEl && phoneEl.value !== undefined) this.customerInfo.phone = phoneEl.value;

    const addrEl = document.getElementById('customer-address');
    if (addrEl && addrEl.value !== undefined) this.customerInfo.address = addrEl.value;

    const pickupEl = document.getElementById('customer-pickup-time');
    if (pickupEl && pickupEl.value !== undefined) this.customerInfo.pickupTime = pickupEl.value;

    const noteEl = document.getElementById('customer-note');
    if (noteEl && noteEl.value !== undefined) this.customerInfo.note = noteEl.value;

    this._saveCustomerInfoToStorage();
  }

  _bindGlobalDrawerEvents() {
    const handleClose = () => {
      this._saveFormInputs();
      this.close();
    };

    document.getElementById('cart-drawer-close-btn')?.addEventListener('click', handleClose);

    const backdrop = document.getElementById('cart-drawer-backdrop');
    if (backdrop) {
      let isMouseDownOnBackdrop = false;

      backdrop.addEventListener('mousedown', (e) => {
        isMouseDownOnBackdrop = (e.target === backdrop);
      });

      backdrop.addEventListener('touchstart', (e) => {
        isMouseDownOnBackdrop = (e.target === backdrop);
      }, { passive: true });

      backdrop.addEventListener('click', (e) => {
        if (isMouseDownOnBackdrop && e.target === backdrop) {
          handleClose();
        }
        isMouseDownOnBackdrop = false;
      });
    }
  }

  /**
   * Ủy quyền sự kiện tập trung (Event Delegation) trên Panel: gắn 1 lần duy nhất khi mở giỏ
   */
  _bindDelegatedPanelEvents(panel) {
    if (!panel || typeof panel.addEventListener !== 'function') return;

    const inputMap = {
      'customer-lastname': 'lastName',
      'customer-firstname': 'firstName',
      'customer-phone': 'phone',
      'customer-address': 'address',
      'customer-pickup-time': 'pickupTime',
      'customer-note': 'note'
    };

    const triggerTimePicker = () => {
      openTimeWheelPicker({
        initialValue: this._getUsablePickupTime(),
        onSelect: (selectedTime, pickupDate) => {
          this.customerInfo.pickupTime = selectedTime;
          this.customerInfo.pickupDate = pickupDate;
          this._saveCustomerInfoToStorage();
          const pickupInput = typeof document !== 'undefined' ? document.getElementById('customer-pickup-time') : null;
          if (pickupInput) {
            pickupInput.value = selectedTime;
            pickupInput.classList?.remove('border-red-500', 'ring-2', 'ring-red-200', 'bg-red-50/50');
            pickupInput.classList?.add('border-gray-300');
            pickupInput.removeAttribute?.('aria-invalid');
            pickupInput.parentElement?.querySelectorAll('.field-error-msg').forEach(el => el.remove());
          }
        }
      });
    };

    panel.addEventListener('keydown', (e) => {
      if (e.target && e.target.id === 'customer-pickup-time' && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        triggerTimePicker();
      }
    });

    panel.addEventListener('input', (e) => {
      const target = e.target;
      if (!target || !target.id) return;
      const key = inputMap[target.id];
      if (key) {
        this.customerInfo[key] = target.value;
        this._debouncedSaveStorage();
      }
    });

    panel.addEventListener('click', async (e) => {
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;

      // 1. Chuyển hình thức Giao hàng / Ăn tại quán
      if (target.closest('#btn-type-delivery')) {
        this._saveFormInputs();
        this.orderType = 'delivery';
        if (this.onOrderTypeChanged) this.onOrderTypeChanged('delivery');
        this.render();
        return;
      }

      if (target.closest('#btn-type-dinein')) {
        this._saveFormInputs();
        this.orderType = 'dinein';
        if (this.onOrderTypeChanged) this.onOrderTypeChanged('dinein');
        this.render();
        return;
      }

      if (target.closest('#btn-open-time-picker') || target.closest('#customer-pickup-time')) {
        triggerTimePicker();
        return;
      }

      // 2. Xem ảnh phóng to món trong giỏ
      const previewBtn = target.closest('.btn-cart-img-preview');
      if (previewBtn) {
        const img = previewBtn.dataset.img;
        const name = previewBtn.dataset.name;
        const price = Number(previewBtn.dataset.price) || 0;
        if (this.imageModal && img) {
          this.imageModal.open({ title: name, image: img, price });
        }
        return;
      }

      // 3. Đổi món / Sửa tùy chọn Combo ngay trong giỏ
      const editComboBtn = target.closest('.btn-cart-edit-combo');
      if (editComboBtn) {
        this._saveFormInputs();
        const cartItemId = editComboBtn.dataset.id;
        const item = this.cart.getItems().find(i => i.cartItemId === cartItemId);
        if (item && typeof this.onEditCombo === 'function') {
          this.onEditCombo(item);
        }
        return;
      }

      // 4. Giảm / Tăng số lượng (bảo toàn tiêu điểm bàn phím)
      const minusBtn = target.closest('.btn-cart-minus');
      if (minusBtn) {
        this._saveFormInputs();
        const cartItemId = minusBtn.dataset.id;
        this.cart.updateQuantity(cartItemId, -1);
        if (this.onCartChanged) this.onCartChanged();
        this.render({ btnClass: '.btn-cart-minus', cartItemId });
        return;
      }

      const plusBtn = target.closest('.btn-cart-plus');
      if (plusBtn) {
        this._saveFormInputs();
        const cartItemId = plusBtn.dataset.id;
        this.cart.updateQuantity(cartItemId, 1);
        if (this.onCartChanged) this.onCartChanged();
        this.render({ btnClass: '.btn-cart-plus', cartItemId });
        return;
      }

      // 5. Xóa 1 món
      const removeBtn = target.closest('.btn-cart-remove');
      if (removeBtn) {
        this._saveFormInputs();
        const cartItemId = removeBtn.dataset.id;
        const itemToRemove = this.cart.getItems().find(i => i.cartItemId === cartItemId);
        this.cart.removeItem(cartItemId);
        if (this.onCartChanged) this.onCartChanged();
        this.render();
        if (itemToRemove) {
          this.showToast(`Đã bỏ "${itemToRemove.name}" khỏi giỏ hàng`, 'info');
        }
        return;
      }

      // 6. Thêm nhanh món gợi ý 1 chạm (Smart Upsell Chip)
      const upsellBtn = target.closest('.btn-upsell-quick-add');
      if (upsellBtn) {
        this._saveFormInputs();
        const pid = upsellBtn.dataset.productId;
        if (pid && typeof this.onQuickAddUpsell === 'function') {
          const addedProduct = this.onQuickAddUpsell(pid);
          if (addedProduct) {
            this.render();
            this.showToast(`Đã thêm "${addedProduct.name}" vào giỏ!`, 'success');
          }
        }
        return;
      }

      // 7. Xóa tất cả món trong giỏ
      if (target.closest('#btn-clear-cart')) {
        this.showConfirmDialog({
          title: 'Xác nhận xóa giỏ hàng',
          message: 'Bạn có chắc chắn muốn xóa tất cả món đã chọn khỏi giỏ hàng không? Bạn sẽ cần chọn món lại từ đầu.',
          confirmText: 'Xác nhận xóa',
          cancelText: 'Giữ lại món',
          onConfirm: () => {
            this.cart.clear();
            if (this.onCartChanged) this.onCartChanged();
            this.render();
            this.showToast('Đã xóa toàn bộ món trong giỏ hàng', 'info');
          }
        });
        return;
      }

      // 8. Sao chép nội dung đơn hàng
      if (target.closest('#btn-copy-order')) {
        this._saveFormInputs();
        if (!this.validateForm()) return;

        fireOrderCelebration();
        const pricing = this.cart.getTotals(this.orderType, this.config);
        const orderText = formatOrderText(this.customerInfo, this.cart.getItems(), pricing, this.orderType);

        const success = await copyToClipboard(orderText);
        if (success) {
          this.showToast('Đã sao chép nội dung đơn hàng! Bạn có thể dán gửi cho shop.', 'success');
          uiShowOrderCopiedModal({
            zaloLink: this.config?.zaloLink || 'https://zalo.me/0985194873',
            facebookUrl: this.config?.facebookUrl || 'https://www.facebook.com/trnblng',
            hotline: this.config?.hotline || '0985194873'
          });
        } else {
          this.showCopyFallbackModal(orderText);
        }
      }
    });
  }
}
