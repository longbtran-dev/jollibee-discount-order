/**
 * Thành phần Drawer / Modal Giỏ Hàng & Chốt Đơn
 */
import { formatOrderText, generateZaloUrl, generateMessengerUrl, formatCurrency } from '../order-message.js';
import { copyToClipboard, escapeHtml, isValidVietnamesePhone, lockBodyScroll, unlockBodyScroll, debounce } from '../utils.js';
import { fireOrderCelebration } from '../effects.js';
import {
  IconShoppingBag,
  IconX,
  IconMinus,
  IconPlus,
  IconTrash,
  IconBike,
  IconUtensils,
  IconFileText,
  IconReceipt,
  IconSparkles,
  IconCheck,
  IconCheckCircle,
  IconAlertTriangle,
  IconArrowRight,
  IconCopy,
  IconZalo,
  IconMessenger
} from '../icons.js';

export const CUSTOMER_STORAGE_KEY = 'jb_customer_info';

export class CartDrawer {
  constructor(cart, config = {}, onCartChanged = null, onOrderTypeChanged = null, imageModal = null) {
    this.cart = cart;
    this.config = config;
    this.onCartChanged = onCartChanged;
    this.onOrderTypeChanged = onOrderTypeChanged;
    this.imageModal = imageModal;
    this.orderType = 'delivery'; // 'delivery' hoặc 'dinein'
    this.containerId = 'cart-drawer-container';
    this._escHandler = null;
    this.customerInfo = {
      name: '',
      phone: '',
      address: '',
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
          this.customerInfo = { ...this.customerInfo, ...parsed };
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
    this.orderType = type;
    const container = document.getElementById(this.containerId);
    if (container && container.innerHTML.trim()) {
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
    lockBodyScroll();
    this.render();
  }

  close() {
    this._saveFormInputs();
    unlockBodyScroll();
    if (this._escHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    const container = this.getContainer();
    container.innerHTML = '';
  }

  showToast(message) {
    if (typeof document === 'undefined') return;
    const toast = document.createElement('div');
    toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white font-medium text-sm px-5 py-3 rounded-xl shadow-xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-4 duration-200';
    toast.innerHTML = `<span class="text-green-400">${IconCheck('w-4 h-4')}</span><span>${escapeHtml(message)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  validateForm() {
    const pricing = this.cart.getTotals(this.orderType, this.config);
    if (pricing.originalTotal < 100000) {
      const needed = 100000 - pricing.originalTotal;
      const msg = `Đơn hàng của bạn hiện tại là ${formatCurrency(pricing.originalTotal)}.\n\nShop chỉ nhận đặt hộ với đơn hàng từ 100.000đ trở lên (cứ mỗi 100k giảm 15k).\nVui lòng chọn thêm ${formatCurrency(needed)} để đủ điều kiện gửi đơn nhé!`;
      if (typeof alert === 'function') alert(msg);
      this.showToast(`Đơn cần tối thiểu 100.000đ (cần thêm ${formatCurrency(needed)})`);
      return false;
    }

    // Ăn tại quán: Không cần thông tin khách hàng
    if (this.orderType === 'dinein') {
      return true;
    }
    if (!this.customerInfo.name || !this.customerInfo.name.trim()) {
      const msg = 'Vui lòng nhập Họ và Tên của bạn để shop dễ xưng hô!';
      if (typeof alert === 'function') alert(msg);
      this.showToast(msg);
      if (typeof document !== 'undefined') document.getElementById('customer-name')?.focus();
      return false;
    }
    if (!this.customerInfo.phone || !isValidVietnamesePhone(this.customerInfo.phone)) {
      const msg = 'Số điện thoại nhận hàng không hợp lệ (cần 10 chữ số, VD: 0912345678)!';
      if (typeof alert === 'function') alert(msg);
      this.showToast(msg);
      if (typeof document !== 'undefined') document.getElementById('customer-phone')?.focus();
      return false;
    }
    if (this.orderType === 'delivery') {
      if (!this.customerInfo.address || !this.customerInfo.address.trim()) {
        const msg = 'Vui lòng nhập Địa chỉ giao hàng chi tiết!';
        if (typeof alert === 'function') alert(msg);
        this.showToast(msg);
        if (typeof document !== 'undefined') document.getElementById('customer-address')?.focus();
        return false;
      }
    }
    return true;
  }

  /**
   * Tạo khối kích thích mua thêm & nấc thang ưu đãi (Smart Upsell Milestones)
   */
  _generateUpsellBlock(pricing) {
    const total = pricing.originalTotal;
    const isDelivery = this.orderType === 'delivery';

    // Mốc 1: Đơn dưới 100k (Chưa đủ điều kiện đặt hộ, chưa có chiết khấu)
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
          <p class="text-xs text-amber-900 leading-snug">
            Chọn thêm <b>${formatCurrency(needed)}</b> nữa để kích hoạt ưu đãi <b>Giảm ngay 15.000đ</b>! 🔥
          </p>
          <div class="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-amber-400 to-[#d71920] rounded-full transition-all duration-500 ease-out" style="width: ${progressPercent}%"></div>
          </div>
          <div class="flex justify-between text-[10px] text-gray-500 font-semibold">
            <span>Đã chọn: ${formatCurrency(total)}</span>
            <span class="text-red-700 font-bold">Mốc 100k (Giảm 15k)</span>
          </div>
        </div>
      `;
    }

    // Mốc 2: Đơn từ 100k đến dưới 200k (Đã giảm 15k, đích đến tiếp theo là mốc 200k)
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
              ? `Mua thêm chỉ <b>${formatCurrency(needed)}</b> ➔ <b>Giảm thêm 15k (Tổng giảm 30k)</b> + <b>FREESHIP</b> toàn quốc! 🎁 <span class="text-green-700 font-bold block mt-0.5">(Tiết kiệm thêm 25.000đ so với hiện tại)</span>`
              : `Mua thêm chỉ <b>${formatCurrency(needed)}</b> ➔ <b>Giảm thêm 15.000đ (Tổng giảm 30.000đ)</b>! Đặt càng nhiều càng rẻ! 🔥`
            }
          </p>
          <div class="w-full bg-amber-200/60 rounded-full h-2 overflow-hidden">
            <div class="h-full bg-gradient-to-r from-amber-400 to-[#d71920] rounded-full transition-all duration-500 ease-out" style="width: ${progressPercent}%"></div>
          </div>
          <div class="flex justify-between text-[10px] text-gray-500 font-semibold">
            <span>Mốc 100k (Đã giảm 15k)</span>
            <span class="text-red-600 font-bold">Mốc 200k (${isDelivery ? 'Giảm 30k + Freeship' : 'Giảm 30k'})</span>
          </div>
        </div>
      `;
    }

    // Mốc 3: Đơn từ 200k trở lên (Đã Freeship + giảm >= 30k, mốc tiếp theo 300k, 400k, 500k...)
    const currentStep = Math.floor(total / 100000);
    const nextStep = (currentStep + 1) * 100000;
    const needed = nextStep - total;
    const nextTotalDiscount = (currentStep + 1) * 15000;
    const progressInStep = total - (currentStep * 100000);
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
        <div class="w-full bg-emerald-200/60 rounded-full h-2 overflow-hidden">
          <div class="h-full bg-gradient-to-r from-emerald-400 to-green-600 rounded-full transition-all duration-500 ease-out" style="width: ${progressPercent}%"></div>
        </div>
        <div class="flex justify-between text-[10px] text-gray-600 font-semibold">
          <span>Mốc ${Math.round((currentStep * 100000)/1000)}k (Đã giảm ${Math.round(pricing.discountAmount/1000)}k)</span>
          <span class="text-emerald-700 font-extrabold">Mốc ${Math.round(nextStep/1000)}k (Giảm ${Math.round(nextTotalDiscount/1000)}k)</span>
        </div>
      </div>
    `;
  }

  render() {
    const container = this.getContainer();
    // Ghi nhớ vị trí cuộn hiện tại của danh sách món
    const existingScrollEl = container.querySelector('.drawer-scroll-body');
    const prevScrollTop = existingScrollEl ? existingScrollEl.scrollTop : 0;

    const items = this.cart.getItems();
    const pricing = this.cart.getTotals(this.orderType, this.config);

    // Danh sách món trong giỏ
    let itemsListHtml = '';
    if (items.length === 0) {
      itemsListHtml = `
        <div class="text-center py-12 text-gray-400">
          <div class="w-16 h-16 mx-auto mb-3 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
            ${IconShoppingBag('w-8 h-8')}
          </div>
          <p class="font-bold text-gray-600 text-sm">Giỏ hàng của bạn đang trống</p>
          <p class="text-xs text-gray-400 mt-1">Hãy chọn món ăn ngon để xem báo giá ưu đãi nhé!</p>
        </div>
      `;
    } else {
      items.forEach(item => {
        const itemTotal = item.unitPrice * item.quantity;
        const escapedItemName = escapeHtml(item.name);
        const escapedCartItemId = escapeHtml(item.cartItemId);

        // Xây dựng danh sách chi tiết các món/tùy chọn xuống hàng an toàn XSS
        let optionsDetailsHtml = '';
        if (item.selectedOptions && item.selectedOptions.length > 0) {
          const listItems = item.selectedOptions.map(opt => `
            <li class="flex items-center gap-1.5 text-xs text-gray-700 font-medium leading-snug">
              <span class="text-[#d71920] font-bold text-[10px] flex-shrink-0">•</span>
              <div class="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                <span class="break-words">${escapeHtml(opt.option_name || opt.name)}</span>
                ${opt.extra_price > 0 ? `<span class="inline-flex items-center text-red-600 font-extrabold text-[10px] bg-red-100/90 px-1.5 py-0.5 rounded-md leading-none flex-shrink-0">(+${formatCurrency(opt.extra_price)})</span>` : ''}
              </div>
            </li>
          `).join('');

          optionsDetailsHtml = `
            <div class="mt-1.5 p-2 bg-amber-50/70 rounded-xl border border-amber-200/60 shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-[#d71920] flex-shrink-0"></span>
                <span>Chi tiết món đã chọn:</span>
              </div>
              <ul class="space-y-1">
                ${listItems}
              </ul>
            </div>
          `;
        } else if (item.optionsText) {
          const parts = item.optionsText.split(',').map(s => s.trim()).filter(Boolean);
          const listItems = parts.map(part => `
            <li class="flex items-center gap-1.5 text-xs text-gray-700 font-medium leading-snug">
              <span class="text-[#d71920] font-bold text-[10px] flex-shrink-0">•</span>
              <span class="break-words flex-1 min-w-0">${escapeHtml(part)}</span>
            </li>
          `).join('');

          optionsDetailsHtml = `
            <div class="mt-1.5 p-2 bg-amber-50/70 rounded-xl border border-amber-200/60 shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-[#d71920] flex-shrink-0"></span>
                <span>Tùy chọn:</span>
              </div>
              <ul class="space-y-1">
                ${listItems}
              </ul>
            </div>
          `;
        } else if (item.description && item.description.includes('+')) {
          const parts = item.description.split('+').map(s => s.trim()).filter(Boolean);
          const listItems = parts.map(part => `
            <li class="flex items-center gap-1.5 text-xs text-gray-700 font-medium leading-snug">
              <span class="text-[#d71920] font-bold text-[10px] flex-shrink-0">•</span>
              <span class="break-words flex-1 min-w-0">${escapeHtml(part)}</span>
            </li>
          `).join('');

          optionsDetailsHtml = `
            <div class="mt-1.5 p-2 bg-amber-50/70 rounded-xl border border-amber-200/60 shadow-sm">
              <div class="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-[#d71920] flex-shrink-0"></span>
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
            <!-- Thumbnail món ăn -->
            ${item.image ? `
              <button type="button" class="btn-cart-img-preview cursor-zoom-in relative group w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-amber-50/60 p-1 border border-amber-100 flex-shrink-0 overflow-hidden flex items-center justify-center self-start mt-0.5 focus:outline-none active:scale-95 transition" 
                data-img="${escapeHtml(item.image)}" 
                data-name="${escapedItemName}" 
                data-price="${item.unitPrice}" 
                title="Nhấn để xem ảnh phóng to">
                <img src="${escapeHtml(item.image)}" alt="${escapedItemName}" class="w-full h-full object-contain transform group-hover:scale-105 transition" onerror="this.style.display='none'">
              </button>
            ` : ''}

            <!-- Nội dung chính -->
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-2">
                <h4 class="font-extrabold text-sm text-gray-900 leading-snug break-words">${escapedItemName}</h4>
                <button type="button" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 btn-cart-remove flex-shrink-0 transition" data-id="${escapedCartItemId}" title="Xóa món">
                  ${IconTrash('w-3.5 h-3.5')}
                </button>
              </div>

              <!-- Chi tiết từng món dạng xuống dòng -->
              ${optionsDetailsHtml}

              <!-- Đơn giá & Nút điều chỉnh số lượng -->
              <div class="flex items-center justify-between mt-2.5 pt-1.5 border-t border-gray-100">
                <div class="flex items-baseline gap-1.5 flex-wrap">
                  <span class="text-[11px] text-gray-400">Đơn giá:</span>
                  <span class="font-bold text-sm text-red-600">${formatCurrency(item.unitPrice)}</span>
                  ${item.quantity > 1 ? `<span class="text-xs text-gray-500 font-medium whitespace-nowrap">x ${item.quantity} = <b class="text-red-700">${formatCurrency(itemTotal)}</b></span>` : ''}
                </div>

                <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shadow-sm flex-shrink-0">
                  <button type="button" class="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 btn-cart-minus" data-id="${escapedCartItemId}" aria-label="Giảm số lượng">
                    ${IconMinus('w-3 h-3')}
                  </button>
                  <span class="w-7 text-center text-xs font-bold text-gray-800">${item.quantity}</span>
                  <button type="button" class="w-7 h-7 flex items-center justify-center text-gray-600 hover:bg-gray-200 active:scale-95 btn-cart-plus" data-id="${escapedCartItemId}" aria-label="Tăng số lượng">
                    ${IconPlus('w-3 h-3')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        `;
      });
    }

    const innerContentHtml = `
      <!-- Drawer Body Scrollable -->
      <div class="drawer-scroll-body flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
        
        <!-- Type Selector: Delivery vs Dine-in -->
        <div class="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
          <button type="button" id="btn-type-delivery" class="flex-1 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition ${this.orderType === 'delivery' ? 'bg-[#d71920] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
            ${IconBike('w-4 h-4')}
            <span>Giao Tận Nơi</span>
          </button>
          <button type="button" id="btn-type-dinein" class="flex-1 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition ${this.orderType === 'dinein' ? 'bg-[#ffc72c] text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
            ${IconUtensils('w-4 h-4')}
            <span>Ăn Tại Quán / Tới Lấy</span>
          </button>
        </div>

        <!-- Items List -->
        <div class="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-sm">
          <div class="flex items-center justify-between pb-2 border-b border-gray-100 mb-1">
            <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Món đã chọn (${this.cart.getTotalItemCount()})</span>
            ${items.length > 0 ? `<button type="button" id="btn-clear-cart" class="text-xs text-red-500 hover:underline">Xóa tất cả</button>` : ''}
          </div>
          <div>${itemsListHtml}</div>
        </div>

        ${items.length > 0 ? `
          <!-- Customer Info Form / Dine-in Notice -->
          ${this.orderType === 'delivery' ? `
            <div class="bg-amber-50/40 rounded-2xl border border-amber-200/80 p-3.5 shadow-sm space-y-3">
              <div class="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                <span class="text-amber-700">${IconFileText('w-4 h-4')}</span>
                <span>Thông Tin Giao Hàng</span>
              </div>
              <div>
                <label for="customer-name" class="block text-[11px] font-bold text-gray-700 mb-1">Họ và tên của bạn *</label>
                <input type="text" id="customer-name" value="${escapeHtml(this.customerInfo.name)}" placeholder="VD: Nguyễn Văn A *" autocomplete="name"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white">
              </div>
              <div>
                <label for="customer-phone" class="block text-[11px] font-bold text-gray-700 mb-1">Số điện thoại nhận hàng *</label>
                <input type="tel" id="customer-phone" value="${escapeHtml(this.customerInfo.phone)}" placeholder="VD: 0912345678 *" autocomplete="tel"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white">
              </div>
              <div>
                <label for="customer-address" class="block text-[11px] font-bold text-gray-700 mb-1">Địa chỉ giao hàng chi tiết *</label>
                <input type="text" id="customer-address" value="${escapeHtml(this.customerInfo.address)}" placeholder="Số nhà, ngõ/đường, phường, quận/huyện *" autocomplete="street-address"
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white">
              </div>
              <div>
                <label for="customer-note" class="block text-[11px] font-bold text-gray-700 mb-1">Ghi chú cho shipper (nếu có)</label>
                <input type="text" id="customer-note" value="${escapeHtml(this.customerInfo.note)}" placeholder="Ví dụ: Gọi trước khi giao, gửi bảo vệ..." 
                  class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-none bg-white">
              </div>
            </div>
          ` : ''}

          <!-- Price Breakdown Card -->
          <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm space-y-2.5">
            <div class="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center justify-between pb-1 border-b border-gray-100">
              <span class="flex items-center gap-1.5">
                <span class="text-gray-600">${IconReceipt('w-4 h-4')}</span>
                <span>Bảng So Sánh Giá</span>
              </span>
              ${pricing.discountAmount > 0 ? `
                <span class="text-green-700 bg-green-50 px-2 py-0.5 rounded-full font-black text-[10px] border border-green-200">
                  Tiết kiệm ${formatCurrency(pricing.discountAmount)}
                </span>
              ` : ''}
            </div>
            <div class="flex justify-between text-sm text-gray-600">
              <span>Giá gốc tại quán Jollibee:</span>
              <span class="font-bold text-gray-800 line-through">${formatCurrency(pricing.originalTotal)}</span>
            </div>
            <div class="flex justify-between text-sm text-green-600">
              <span>Chiết khấu đặt hộ (-15k/100k):</span>
              <span class="font-extrabold">-${formatCurrency(pricing.discountAmount)}</span>
            </div>
            <div class="flex justify-between text-sm text-gray-600">
              <span>Phí giao hàng:</span>
              <span class="font-bold ${pricing.shippingFee === 0 ? 'text-green-600' : 'text-gray-800'}">
                ${pricing.shippingFee === 0 ? 'Miễn phí (0đ)' : formatCurrency(pricing.shippingFee)}
              </span>
            </div>

            <!-- Khối Kích Thích Mua Thêm & Nâng Hạng Chiết Khấu (Upsell Milestone) -->
            <div class="pt-1">
              ${this._generateUpsellBlock(pricing)}
            </div>

            <div class="pt-2 border-t border-gray-200 flex justify-between items-baseline">
              <div>
                <span class="font-extrabold text-sm sm:text-base text-gray-900 block">Khách thực thanh toán:</span>
                <span class="text-[11px] text-green-700 font-bold">Rẻ hơn mua tại quán Jollibee!</span>
              </div>
              <span class="font-black text-2xl text-red-600">${formatCurrency(pricing.finalTotal)}</span>
            </div>
          </div>

          <!-- Min Order Notice for < 100k vs Qualified Notice With Upsell Tip -->
          ${pricing.originalTotal < 100000 ? `
            <div class="p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl text-xs text-red-950 flex items-start gap-3 shadow-sm">
              <div class="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                ${IconAlertTriangle('w-4 h-4')}
              </div>
              <div class="flex-1">
                <div class="font-black text-red-700 text-sm flex items-center justify-between">
                  <span>Chưa đạt đơn tối thiểu 100.000đ</span>
                  <span class="bg-red-200/80 text-red-800 px-1.5 py-0.5 rounded text-[10px] font-extrabold">Báo lỗi</span>
                </div>
                <div class="mt-1 leading-relaxed text-gray-700">
                  Shop chỉ nhận đặt hộ với đơn từ <b>100.000đ</b> trở lên (cứ mỗi 100k giảm 15k).
                  <div class="mt-1.5 text-red-600 font-extrabold flex items-center gap-1.5">
                    <span class="text-red-600 flex items-center">${IconArrowRight('w-3.5 h-3.5')}</span>
                    <span>Vui lòng chọn thêm <b>${formatCurrency(100000 - pricing.originalTotal)}</b> nữa để gửi đơn nhé!</span>
                  </div>
                </div>
              </div>
            </div>
          ` : `
            <div class="p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl text-xs text-green-900 flex items-start gap-2.5 shadow-sm">
              <span class="text-green-600 flex-shrink-0 mt-0.5">${IconCheckCircle('w-4 h-4')}</span>
              <div class="flex-1 leading-snug">
                <span class="font-extrabold text-green-800">Đã kích hoạt đặt hộ & giảm ngay -${formatCurrency(pricing.discountAmount)}${pricing.shippingFee === 0 && this.orderType === 'delivery' ? ' (Freeship)' : ''}!</span>
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
            <div class="p-2.5 bg-red-50 border border-red-200 rounded-xl text-center text-xs text-red-700 font-extrabold flex items-center justify-center gap-1.5 shadow-sm">
              ${IconAlertTriangle('w-4 h-4 text-red-600')}
              <span>Đơn chưa đạt tối thiểu 100.000đ để đặt hộ</span>
            </div>
          ` : ''}
          <div class="grid grid-cols-2 gap-2">
            <button type="button" id="btn-send-zalo" class="w-full ${pricing.originalTotal < 100000 ? 'bg-blue-400 opacity-80' : 'bg-[#0068ff] hover:bg-[#0058d8]'} text-white font-extrabold py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 sm:gap-2 active:scale-98 transition text-xs sm:text-sm whitespace-nowrap truncate">
              ${IconZalo('w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0')}
              <span class="truncate">Gửi Qua Zalo</span>
            </button>
            <button type="button" id="btn-send-messenger" class="w-full ${pricing.originalTotal < 100000 ? 'bg-sky-400 opacity-80' : 'bg-[#0084ff] hover:bg-[#0074e0]'} text-white font-extrabold py-2.5 sm:py-3 px-2 sm:px-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 sm:gap-2 active:scale-98 transition text-xs sm:text-sm whitespace-nowrap truncate">
              ${IconMessenger('w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0')}
              <span class="truncate">Gửi Messenger</span>
            </button>
          </div>
          <button type="button" id="btn-copy-order" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 active:scale-98 transition text-xs whitespace-nowrap truncate">
            ${IconCopy('w-4 h-4 flex-shrink-0')}
            <span class="truncate">Sao Chép Nội Dung Đơn Hàng</span>
          </button>
        </div>
      ` : ''}
    `;

    let panel = container.querySelector('#cart-drawer-panel');

    if (!panel) {
      // Lần đầu mở: Mount toàn bộ shell modal và kích hoạt animation trượt 1 lần duy nhất
      container.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-0 bg-black/60 animate-backdrop" id="cart-drawer-backdrop" role="dialog" aria-modal="true" aria-labelledby="cart-drawer-title">
          <div id="cart-drawer-panel" class="relative w-full sm:max-w-md h-[94vh] sm:h-full bg-white rounded-t-3xl sm:rounded-none flex flex-col shadow-2xl overflow-hidden animate-drawer-panel transform-gpu will-change-transform">
            
            <!-- Drawer Header (Cố định, không bao giờ bị re-render) -->
            <div class="flex items-center justify-between p-3.5 sm:p-4 bg-[#d71920] text-white flex-shrink-0">
              <div class="flex items-center gap-2 min-w-0 pr-2">
                <span class="flex-shrink-0">${IconShoppingBag('w-5 h-5')}</span>
                <h3 id="cart-drawer-title" class="font-extrabold text-base sm:text-lg truncate">Giỏ Hàng & Báo Giá</h3>
              </div>
              <button type="button" id="cart-drawer-close-btn" class="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition flex-shrink-0" aria-label="Đóng giỏ hàng">${IconX('w-4 h-4')}</button>
            </div>

            <!-- Vùng nội dung động (cập nhật in-place không reload shell) -->
            <div id="cart-drawer-inner" class="flex-1 flex flex-col min-h-0 overflow-hidden">
              ${innerContentHtml}
            </div>

          </div>
        </div>
      `;

      panel = container.querySelector('#cart-drawer-panel');
      if (panel) {
        panel.addEventListener('animationend', () => {
          panel.classList.remove('animate-drawer-panel');
        }, { once: true });
      }

      this._bindGlobalDrawerEvents();
    } else {
      // Panel đã tồn tại: Cập nhật trực tiếp nội dung con, giữ nguyên khung modal -> 0% chớp trắng, 0% reload
      const innerContainer = panel.querySelector('#cart-drawer-inner');
      if (innerContainer) {
        innerContainer.innerHTML = innerContentHtml;
      }
    }

    // Khôi phục lại đúng vị trí cuộn trước khi re-render
    const newScrollEl = container.querySelector('.drawer-scroll-body');
    if (newScrollEl && prevScrollTop > 0) {
      newScrollEl.scrollTop = prevScrollTop;
    }

    this._bindContentEvents();
  }

  _saveFormInputs() {
    const nameEl = document.getElementById('customer-name');
    if (nameEl) this.customerInfo.name = nameEl.value;

    const phoneEl = document.getElementById('customer-phone');
    if (phoneEl) this.customerInfo.phone = phoneEl.value;

    const addrEl = document.getElementById('customer-address');
    if (addrEl) this.customerInfo.address = addrEl.value;

    const noteEl = document.getElementById('customer-note');
    if (noteEl) this.customerInfo.note = noteEl.value;

    this._saveCustomerInfoToStorage();
  }

  _bindGlobalDrawerEvents() {
    const handleClose = () => {
      this._saveFormInputs();
      this.close();
    };
    document.getElementById('cart-drawer-close-btn')?.addEventListener('click', handleClose);
    document.getElementById('cart-drawer-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'cart-drawer-backdrop') handleClose();
    });

    // Bắt phím Escape để đóng giỏ hàng
    if (!this._escHandler && typeof document !== 'undefined') {
      this._escHandler = (e) => {
        if (e.key === 'Escape') handleClose();
      };
      document.addEventListener('keydown', this._escHandler);
    }
  }

  _bindEvents() {
    this._bindGlobalDrawerEvents();
    this._bindContentEvents();
  }

  _bindContentEvents() {
    const container = this.getContainer();
    if (!container) return;

    // Lắng nghe sự kiện input thời gian thực (lưu debounce vào storage tránh nghẽn I/O)
    const bindLiveInput = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', (e) => {
        this.customerInfo[key] = e.target.value;
        this._debouncedSaveStorage();
      });
    };
    bindLiveInput('customer-name', 'name');
    bindLiveInput('customer-phone', 'phone');
    bindLiveInput('customer-address', 'address');
    bindLiveInput('customer-note', 'note');

    // Chuyển hình thức giao hàng vs ăn tại quán
    document.getElementById('btn-type-delivery')?.addEventListener('click', () => {
      this._saveFormInputs();
      this.orderType = 'delivery';
      if (this.onOrderTypeChanged) this.onOrderTypeChanged('delivery');
      this.render();
    });
    document.getElementById('btn-type-dinein')?.addEventListener('click', () => {
      this._saveFormInputs();
      this.orderType = 'dinein';
      if (this.onOrderTypeChanged) this.onOrderTypeChanged('dinein');
      this.render();
    });

    // Sự kiện xem ảnh phóng to trong giỏ hàng
    container.querySelectorAll('.btn-cart-img-preview').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const img = e.currentTarget.dataset.img;
        const name = e.currentTarget.dataset.name;
        const price = Number(e.currentTarget.dataset.price) || 0;
        if (this.imageModal && img) {
          this.imageModal.open({
            title: name,
            image: img,
            price: price
          });
        }
      });
    });

    // Thao tác tăng giảm / xóa món
    container.querySelectorAll('.btn-cart-minus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._saveFormInputs();
        this.cart.updateQuantity(e.currentTarget.dataset.id, -1);
        if (this.onCartChanged) this.onCartChanged();
        this.render();
      });
    });

    container.querySelectorAll('.btn-cart-plus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._saveFormInputs();
        this.cart.updateQuantity(e.currentTarget.dataset.id, 1);
        if (this.onCartChanged) this.onCartChanged();
        this.render();
      });
    });

    container.querySelectorAll('.btn-cart-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this._saveFormInputs();
        this.cart.removeItem(e.currentTarget.dataset.id);
        if (this.onCartChanged) this.onCartChanged();
        this.render();
      });
    });

    document.getElementById('btn-clear-cart')?.addEventListener('click', () => {
      const confirmed = typeof confirm === 'function' ? confirm('Bạn có chắc muốn xóa toàn bộ món trong giỏ hàng?') : true;
      if (confirmed) {
        this.cart.clear();
        if (this.onCartChanged) this.onCartChanged();
        this.render();
      }
    });

    // Xử lý gửi đơn qua Zalo (khắc phục hoàn toàn lỗi Popup Blocker trên iOS Safari)
    document.getElementById('btn-send-zalo')?.addEventListener('click', () => {
      this._saveFormInputs();
      if (!this.validateForm()) return;

      fireOrderCelebration();

      const pricing = this.cart.getTotals(this.orderType, this.config);
      const orderText = formatOrderText(this.customerInfo, this.cart.getItems(), pricing, this.orderType);
      const zaloTarget = this.config.zaloLink || this.config.zaloPhone || '';
      const url = generateZaloUrl(zaloTarget, orderText);

      // 1. Sao chép vào bộ nhớ tạm không chặn luồng
      copyToClipboard(orderText).catch(err => console.warn('Clipboard copy warning:', err));
      this.showToast('Đang chuyển hướng sang Zalo & đã sao chép đơn!');

      // 2. Điều hướng trực tiếp tương thích 100% mobile WebKit / Safari
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = url;
        }
      }, 100);
    });

    // Xử lý gửi qua Messenger (khắc phục lỗi Safari Popup Blocker)
    document.getElementById('btn-send-messenger')?.addEventListener('click', () => {
      this._saveFormInputs();
      if (!this.validateForm()) return;

      fireOrderCelebration();

      const pricing = this.cart.getTotals(this.orderType, this.config);
      const orderText = formatOrderText(this.customerInfo, this.cart.getItems(), pricing, this.orderType);
      const messengerTarget = this.config.facebookMessengerUrl || 'https://m.me/';
      const url = generateMessengerUrl(messengerTarget, orderText);

      copyToClipboard(orderText).catch(err => console.warn('Clipboard copy warning:', err));
      this.showToast('Đang chuyển hướng sang Messenger & đã sao chép đơn!');

      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = url;
        }
      }, 100);
    });

    // Sao chép nội dung đơn hàng
    document.getElementById('btn-copy-order')?.addEventListener('click', async () => {
      this._saveFormInputs();
      if (!this.validateForm()) return;

      fireOrderCelebration();

      const pricing = this.cart.getTotals(this.orderType, this.config);
      const orderText = formatOrderText(this.customerInfo, this.cart.getItems(), pricing, this.orderType);

      const success = await copyToClipboard(orderText);
      if (success) {
        this.showToast('Đã sao chép nội dung đơn hàng! Bạn có thể dán vào khung chat Zalo/FB.');
      } else if (typeof prompt === 'function') {
        prompt('Vui lòng sao chép toàn bộ nội dung đơn dưới đây:', orderText);
      }
    });
  }
}
