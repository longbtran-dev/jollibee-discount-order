/**
 * Thành phần Drawer / Modal Giỏ Hàng & Chốt Đơn
 */
import { formatOrderText, generateZaloUrl, generateMessengerUrl, formatCurrency } from '../order-message.js';

export class CartDrawer {
  constructor(cart, config = {}, onCartChanged = null) {
    this.cart = cart;
    this.config = config;
    this.onCartChanged = onCartChanged;
    this.orderType = 'delivery'; // 'delivery' hoặc 'dinein'
    this.containerId = 'cart-drawer-container';
    this.customerInfo = {
      name: '',
      phone: '',
      address: '',
      note: ''
    };
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
    this.render();
  }

  close() {
    const container = this.getContainer();
    container.innerHTML = '';
    document.body.classList.remove('overflow-hidden');
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[100] bg-gray-900 text-white font-medium text-sm px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200';
    toast.innerHTML = `<span>✓</span><span>${message}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  validateForm() {
    if (!this.customerInfo.name || !this.customerInfo.name.trim()) {
      alert('Vui lòng nhập Họ và Tên của bạn để shop dễ xưng hô!');
      document.getElementById('customer-name')?.focus();
      return false;
    }
    if (!this.customerInfo.phone || !this.customerInfo.phone.trim()) {
      alert('Vui lòng nhập Số điện thoại nhận hàng!');
      document.getElementById('customer-phone')?.focus();
      return false;
    }
    if (this.orderType === 'delivery') {
      if (!this.customerInfo.address || !this.customerInfo.address.trim()) {
        alert('Vui lòng nhập Địa chỉ giao hàng chi tiết!');
        document.getElementById('customer-address')?.focus();
        return false;
      }
    }
    return true;
  }

  render() {
    const container = this.getContainer();
    document.body.classList.add('overflow-hidden');

    const items = this.cart.getItems();
    const pricing = this.cart.getTotals(this.orderType, this.config);
    const freeshipThreshold = this.config.freeshipThreshold || 200000;

    // Tiến trình đạt freeship
    const remainingToFreeship = Math.max(0, freeshipThreshold - pricing.originalTotal);
    let freeshipNoticeHtml = '';
    if (this.orderType === 'delivery') {
      if (remainingToFreeship === 0) {
        freeshipNoticeHtml = `
          <div class="p-2.5 bg-green-50 border border-green-200 rounded-xl text-xs font-semibold text-green-700 flex items-center gap-2 mb-3">
            <span>🎉</span>
            <span>Tuyệt vời! Đơn hàng của bạn đã đủ điều kiện <b>Miễn Phí Giao Hàng</b>!</span>
          </div>
        `;
      } else {
        freeshipNoticeHtml = `
          <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between mb-3">
            <span>Mua thêm <b>${formatCurrency(remainingToFreeship)}</b> để được <b>Freeship</b>!</span>
            <span class="text-red-600 font-bold">10k Ship</span>
          </div>
        `;
      }
    }

    // Danh sách món trong giỏ
    let itemsListHtml = '';
    if (items.length === 0) {
      itemsListHtml = `
        <div class="text-center py-12 text-gray-400">
          <div class="text-5xl mb-3">🍗</div>
          <p class="font-medium">Giỏ hàng của bạn đang trống</p>
          <p class="text-xs text-gray-400 mt-1">Hãy chọn món ăn ngon để xem báo giá ưu đãi nhé!</p>
        </div>
      `;
    } else {
      items.forEach(item => {
        const itemTotal = item.unitPrice * item.quantity;
        itemsListHtml += `
          <div class="py-3 border-b border-gray-100 flex items-start gap-3">
            <div class="flex-1">
              <h4 class="font-bold text-sm text-gray-900">${item.name}</h4>
              ${item.optionsText ? `<p class="text-xs text-gray-500 mt-0.5">${item.optionsText}</p>` : ''}
              <div class="text-xs font-extrabold text-red-600 mt-1">${formatCurrency(item.unitPrice)}</div>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <div class="flex items-center border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <button type="button" class="w-7 h-7 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 active:scale-95 btn-cart-minus" data-id="${item.cartItemId}">-</button>
                <span class="w-8 text-center text-xs font-bold text-gray-800">${item.quantity}</span>
                <button type="button" class="w-7 h-7 flex items-center justify-center font-bold text-gray-600 hover:bg-gray-200 active:scale-95 btn-cart-plus" data-id="${item.cartItemId}">+</button>
              </div>
              <button type="button" class="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 rounded hover:bg-red-50 btn-cart-remove" data-id="${item.cartItemId}" title="Xóa món">✕</button>
            </div>
          </div>
        `;
      });
    }

    container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-end p-0 sm:p-0 bg-black/60 backdrop-blur-xs transition-opacity" id="cart-drawer-backdrop">
        <div class="relative w-full sm:max-w-md h-[94vh] sm:h-full bg-white rounded-t-3xl sm:rounded-none flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200">
          
          <!-- Drawer Header -->
          <div class="flex items-center justify-between p-4 bg-[#d71920] text-white">
            <div class="flex items-center gap-2">
              <span class="text-xl">🛒</span>
              <h3 class="font-extrabold text-lg">Giỏ Hàng & Báo Giá</h3>
            </div>
            <button type="button" id="cart-drawer-close-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white font-bold transition">✕</button>
          </div>

          <!-- Drawer Body Scrollable -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4 overscroll-contain">
            
            <!-- Type Selector: Delivery vs Dine-in -->
            <div class="bg-gray-100 p-1 rounded-xl flex items-center gap-1 border border-gray-200">
              <button type="button" id="btn-type-delivery" class="flex-1 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${this.orderType === 'delivery' ? 'bg-[#d71920] text-white shadow-xs' : 'text-gray-600 hover:text-gray-900'}">
                <span>🛵</span>
                <span>Giao Tận Nơi</span>
              </button>
              <button type="button" id="btn-type-dinein" class="flex-1 py-2 rounded-lg font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition ${this.orderType === 'dinein' ? 'bg-[#ffc72c] text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'}">
                <span>🍽️</span>
                <span>Ăn Tại Quán / Tới Lấy</span>
              </button>
            </div>

            <!-- Freeship Alert -->
            ${freeshipNoticeHtml}

            <!-- Items List -->
            <div class="bg-white rounded-2xl border border-gray-200 p-3.5 shadow-xs">
              <div class="flex items-center justify-between pb-2 border-b border-gray-100 mb-1">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">Món đã chọn (${this.cart.getTotalItemCount()})</span>
                ${items.length > 0 ? `<button type="button" id="btn-clear-cart" class="text-xs text-red-500 hover:underline">Xóa tất cả</button>` : ''}
              </div>
              <div>${itemsListHtml}</div>
            </div>

            ${items.length > 0 ? `
              <!-- Customer Info Form -->
              <div class="bg-amber-50/40 rounded-2xl border border-amber-200/80 p-3.5 shadow-xs space-y-3">
                <div class="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span>📝</span>
                  <span>Thông Tin Nhận Hàng</span>
                </div>
                <div>
                  <input type="text" id="customer-name" value="${this.customerInfo.name}" placeholder="Họ và tên của bạn *" 
                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-hidden bg-white">
                </div>
                <div>
                  <input type="tel" id="customer-phone" value="${this.customerInfo.phone}" placeholder="Số điện thoại nhận hàng *" 
                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-hidden bg-white">
                </div>
                ${this.orderType === 'delivery' ? `
                  <div>
                    <input type="text" id="customer-address" value="${this.customerInfo.address}" placeholder="Địa chỉ giao hàng (Số nhà, đường, phường, quận/huyện) *" 
                      class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-hidden bg-white">
                  </div>
                ` : ''}
                <div>
                  <input type="text" id="customer-note" value="${this.customerInfo.note}" placeholder="${this.orderType === 'dinein' ? 'Chi nhánh Jollibee dự định ghé ăn hoặc ghi chú...' : 'Ghi chú cho shipper (ví dụ: giao lúc 12h, lấy thêm tương ớt)...'}" 
                    class="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 text-sm focus:ring-2 focus:ring-red-500 focus:outline-hidden bg-white">
                </div>
              </div>

              <!-- Price Breakdown Card -->
              <div class="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-2.5">
                <div class="text-xs font-extrabold text-gray-700 uppercase tracking-wider flex items-center gap-1.5 pb-1 border-b border-gray-100">
                  <span>💰</span>
                  <span>Bảng Báo Giá Chi Tiết</span>
                </div>
                <div class="flex justify-between text-sm text-gray-600">
                  <span>Tổng tiền gốc Jollibee:</span>
                  <span class="font-bold text-gray-800">${formatCurrency(pricing.originalTotal)}</span>
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
                <div class="pt-2 border-t border-gray-200 flex justify-between items-baseline">
                  <span class="font-extrabold text-sm sm:text-base text-gray-900">Khách thực thanh toán:</span>
                  <span class="font-black text-xl text-red-600">${formatCurrency(pricing.finalTotal)}</span>
                </div>
              </div>

              <!-- OTP Reminder Notice -->
              <div class="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <span class="text-base flex-shrink-0">💡</span>
                <span>${this.config.otpReminderNotice || 'Lưu ý: Nếu có tin nhắn mã OTP từ Jollibee gửi về SĐT của bạn, vui lòng gửi mã đó cho shop để hoàn tất đặt nhé!'}</span>
              </div>
            ` : ''}

          </div>

          <!-- Drawer Footer Action Buttons -->
          ${items.length > 0 ? `
            <div class="p-4 bg-white border-t border-gray-200 shadow-xl space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <button type="button" id="btn-send-zalo" class="w-full bg-[#0068ff] hover:bg-[#0058d8] text-white font-extrabold py-3 px-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-98 transition text-xs sm:text-sm">
                  <span>💬</span>
                  <span>Gửi Qua Zalo</span>
                </button>
                <button type="button" id="btn-send-messenger" class="w-full bg-[#0084ff] hover:bg-[#0074e0] text-white font-extrabold py-3 px-3 rounded-xl shadow-md flex items-center justify-center gap-1.5 active:scale-98 transition text-xs sm:text-sm">
                  <span>⚡</span>
                  <span>Gửi Messenger</span>
                </button>
              </div>
              <button type="button" id="btn-copy-order" class="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 active:scale-98 transition text-xs">
                <span>📋</span>
                <span>Sao Chép Nội Dung Đơn Hàng</span>
              </button>
            </div>
          ` : ''}

        </div>
      </div>
    `;

    this._bindEvents();
  }

  _saveFormInputs() {
    this.customerInfo.name = document.getElementById('customer-name')?.value || '';
    this.customerInfo.phone = document.getElementById('customer-phone')?.value || '';
    this.customerInfo.address = document.getElementById('customer-address')?.value || '';
    this.customerInfo.note = document.getElementById('customer-note')?.value || '';
  }

  _bindEvents() {
    const container = this.getContainer();

    // Đóng drawer
    document.getElementById('cart-drawer-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('cart-drawer-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'cart-drawer-backdrop') this.close();
    });

    // Chuyển hình thức giao hàng vs ăn tại quán
    document.getElementById('btn-type-delivery')?.addEventListener('click', () => {
      this._saveFormInputs();
      this.orderType = 'delivery';
      this.render();
    });
    document.getElementById('btn-type-dinein')?.addEventListener('click', () => {
      this._saveFormInputs();
      this.orderType = 'dinein';
      this.render();
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
      if (confirm('Bạn có chắc muốn xóa toàn bộ món trong giỏ hàng?')) {
        this.cart.clear();
        if (this.onCartChanged) this.onCartChanged();
        this.render();
      }
    });

    // Xử lý gửi đơn qua Zalo
    document.getElementById('btn-send-zalo')?.addEventListener('click', () => {
      this._saveFormInputs();
      if (!this.validateForm()) return;

      const pricing = this.cart.getTotals(this.orderType, this.config);
      const orderText = formatOrderText(this.customerInfo, this.cart.getItems(), pricing, this.orderType);
      
      // Tự động sao chép trước
      navigator.clipboard?.writeText(orderText).catch(() => {});

      const zaloTarget = this.config.zaloLink || this.config.zaloPhone || '';
      const url = generateZaloUrl(zaloTarget, orderText);
      window.open(url, '_blank');
      this.showToast('Đang mở Zalo & đã sao chép đơn vào bộ nhớ tạm!');
    });

    // Xử lý gửi qua Messenger
    document.getElementById('btn-send-messenger')?.addEventListener('click', () => {
      this._saveFormInputs();
      if (!this.validateForm()) return;

      const pricing = this.cart.getTotals(this.orderType, this.config);
      const orderText = formatOrderText(this.customerInfo, this.cart.getItems(), pricing, this.orderType);

      navigator.clipboard?.writeText(orderText).catch(() => {});

      const messengerTarget = this.config.facebookMessengerUrl || 'https://m.me/';
      const url = generateMessengerUrl(messengerTarget, orderText);
      window.open(url, '_blank');
      this.showToast('Đang mở Messenger & đã sao chép đơn vào bộ nhớ tạm!');
    });

    // Sao chép nội dung đơn hàng
    document.getElementById('btn-copy-order')?.addEventListener('click', () => {
      this._saveFormInputs();
      if (!this.validateForm()) return;

      const pricing = this.cart.getTotals(this.orderType, this.config);
      const orderText = formatOrderText(this.customerInfo, this.cart.getItems(), pricing, this.orderType);

      if (navigator.clipboard) {
        navigator.clipboard.writeText(orderText).then(() => {
          this.showToast('Đã sao chép nội dung đơn hàng! Bạn có thể dán vào khung chat Zalo/FB.');
        }).catch(() => {
          prompt('Vui lòng sao chép toàn bộ nội dung đơn dưới đây:', orderText);
        });
      } else {
        prompt('Vui lòng sao chép toàn bộ nội dung đơn dưới đây:', orderText);
      }
    });
  }
}
