/**
 * Khởi tạo và điều phối giao diện ứng dụng chính
 */
import { Cart } from './cart.js?v=1.5';
import { ComboModal } from './components/combo-modal.js?v=1.5';
import { CartDrawer } from './components/cart-drawer.js?v=1.6';
import { ImageModal } from './components/image-modal.js?v=1.5';
import { showToast, showUndoToast } from './components/ui-feedback.js?v=1.5';
import { formatCurrency } from './order-message.js';
import {
  escapeHtml,
  safeImageUrl,
  FALLBACK_FOOD_IMAGE,
  normalizeVietnamese,
  formatDescriptionHtml,
  debounce
} from './utils.js';
import { IconSliders, IconClock, IconPlus, IconMinus, IconSearch, IconZoomIn } from './icons.js';
import { flyToCart, bounceCartBadge, fireFreeshipMilestone } from './effects.js';

export class JollibeeApp {
  constructor() {
    this.config = typeof window !== 'undefined' && window.JOLLIBEE_CONFIG ? window.JOLLIBEE_CONFIG : {};
    this.menuData = null;
    this.productMap = new Map();
    this.cart = new Cart();
    this.orderType = 'delivery'; // 'delivery' hoặc 'dinein'
    // Khởi tạo theo tổng giỏ hiện có từ localStorage để không nổ pháo hoa nhầm lúc mới tải trang / F5
    this.lastOriginalTotal = this.cart.getTotals(this.orderType, this.config).originalTotal;

    this.imageModal = new ImageModal();
    this.comboModal = new ComboModal('combo-modal-container', this.imageModal);
    this.cartDrawer = new CartDrawer(
      this.cart,
      this.config,
      () => {
        this.updateFloatingCart();
        this.syncProductCardControls();
      },
      newType => this.setOrderType(newType, false),
      this.imageModal,
      {
        onEditCombo: cartItem => this.handleEditComboInCart(cartItem),
        getUpsellSuggestions: needed => this.getUpsellSuggestions(needed),
        onQuickAddUpsell: productId => this.handleQuickAddUpsell(productId)
      }
    );

    this.activeCategorySlug = null;
    this.isProgrammaticScrolling = false;
    this.scrollLockTimer = null;
    this._menuAbortController = null;
    this._globalEventsBound = false;
  }

  setOrderType(type, updateDrawer = true) {
    this.orderType = type;
    this.updateTopSwitcherUI();
    if (updateDrawer) {
      this.cartDrawer.setOrderType(type);
    }
    this.updateFloatingCart();
  }

  updateTopSwitcherUI() {
    const btnDel = document.getElementById('top-btn-delivery');
    const btnDin = document.getElementById('top-btn-dinein');
    const iconDel = document.getElementById('top-icon-delivery');
    const iconDin = document.getElementById('top-icon-dinein');
    if (!btnDel || !btnDin) return;

    const baseClass =
      'w-full min-w-0 py-2 px-1.5 sm:px-3 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 transition active:scale-95';

    if (this.orderType === 'delivery') {
      btnDel.className = `${baseClass} bg-white text-gray-900 shadow-sm`;
      btnDin.className = `${baseClass} text-white hover:bg-white/10`;
      btnDel.setAttribute('aria-pressed', 'true');
      btnDin.setAttribute('aria-pressed', 'false');
      if (iconDel) iconDel.className = 'text-[#d71920] flex items-center flex-shrink-0';
      if (iconDin) iconDin.className = 'text-amber-200/80 flex items-center flex-shrink-0';
    } else {
      btnDel.className = `${baseClass} text-white hover:bg-white/10`;
      btnDin.className = `${baseClass} bg-[#ffc72c] text-gray-950 shadow-sm`;
      btnDel.setAttribute('aria-pressed', 'false');
      btnDin.setAttribute('aria-pressed', 'true');
      if (iconDel) iconDel.className = 'text-white/80 flex items-center flex-shrink-0';
      if (iconDin) iconDin.className = 'text-gray-950 flex items-center flex-shrink-0';
    }
  }

  async init() {
    this.applyConfig();
    this.bindGlobalEvents();
    this.updateFloatingCart();

    const loaded = await this.loadMenu();
    if (loaded) {
      this.cart.syncWithMenu(this.productMap);
      this.lastOriginalTotal = this.cart.getTotals(this.orderType, this.config).originalTotal;
      this.renderCategoryTabs();
      this.renderMenuSections();
      this.updateFloatingCart();
    }
  }

  async retryLoadMenu() {
    const container = document.getElementById('menu-sections-container');
    if (container) {
      container.innerHTML = `
        <div class="animate-pulse space-y-4">
          <div class="h-6 w-40 bg-gray-200 rounded"></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="h-36 bg-gray-200 rounded-2xl"></div>
            <div class="h-36 bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      `;
    }
    const loaded = await this.loadMenu();
    if (loaded) {
      this.cart.syncWithMenu(this.productMap);
      this.lastOriginalTotal = this.cart.getTotals(this.orderType, this.config).originalTotal;
      this.renderCategoryTabs();
      const searchVal = document.getElementById('menu-search-input')?.value || '';
      this.renderMenuSections(searchVal);
      this.updateFloatingCart();
    }
  }

  applyConfig() {
    if (this.config.shopName) {
      const titleSpan = document.getElementById('shop-title')?.querySelector('span');
      if (titleSpan) titleSpan.innerText = this.config.shopName;
    }
    if (this.config.shopSubtitle) {
      const subEl = document.getElementById('shop-subtitle');
      if (subEl) subEl.innerText = this.config.shopSubtitle;
    }
    if (this.config.bannerNotice) {
      const bannerEl = document.getElementById('banner-text');
      if (bannerEl) bannerEl.innerText = this.config.bannerNotice;
    }
    if (this.config.hotline) {
      const hotlineBtn = document.getElementById('header-hotline-btn');
      const hotlineNumber = this.config.hotline.replace(/\D/g, '');
      if (hotlineBtn) {
        hotlineBtn.href = `tel:${hotlineNumber}`;
        const textEl = document.getElementById('header-hotline-text');
        if (textEl) textEl.innerText = this.config.hotline;
      }
    }
  }

  async loadMenu() {
    if (this._menuAbortController) {
      this._menuAbortController.abort();
    }
    this._menuAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = this._menuAbortController
      ? setTimeout(() => this._menuAbortController.abort(), 8000)
      : null;

    try {
      const fetchOpts = this._menuAbortController ? { signal: this._menuAbortController.signal } : {};
      const response = await fetch('data/menu.json', fetchOpts);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.categories)) {
        throw new Error('Cấu trúc data/menu.json không hợp lệ');
      }

      this.menuData = data;
      this.productMap = new Map();
      this.menuData.categories.forEach(cat => {
        (cat.products || []).forEach(p => {
          this.productMap.set(String(p.id), p);
        });
      });
      return true;
    } catch (err) {
      console.error('Lỗi nạp thực đơn:', err);
      const tabsEl = document.getElementById('category-tabs');
      if (tabsEl) tabsEl.innerHTML = '';

      const container = document.getElementById('menu-sections-container');
      if (container) {
        container.innerHTML = `
          <div role="alert" class="p-6 bg-red-50 text-red-700 rounded-2xl border border-red-200 text-center space-y-3">
            <p class="font-extrabold text-sm sm:text-base">Không thể tải thực đơn lúc này</p>
            <p class="text-xs text-gray-600">Kết nối mạng bị gián đoạn hoặc máy chủ phản hồi chậm.</p>
            <button type="button" id="btn-retry-menu" class="bg-[#d71920] hover:bg-[#b81218] text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm active:scale-95 transition">
              Thử tải lại ngay
            </button>
          </div>
        `;
      }
      return false;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  renderCategoryTabs() {
    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer || !this.menuData) return;

    let html = '';
    this.menuData.categories.forEach((cat, index) => {
      const isFirst = index === 0;
      if (isFirst) this.activeCategorySlug = cat.slug;
      const safeSlug = escapeHtml(cat.slug);
      const safeName = escapeHtml(cat.name);
      const count = Array.isArray(cat.products) ? cat.products.length : 0;

      html += `
        <button type="button" 
          class="category-tab-btn px-4 py-2 rounded-full border transition flex-shrink-0 flex items-center gap-1.5 active:scale-95 ${isFirst ? 'bg-[#d71920] text-white border-[#d71920] shadow-sm active-tab' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}"
          aria-current="${isFirst ? 'true' : 'false'}"
          data-slug="${safeSlug}">
          <span>${safeName}</span>
          <span class="text-[10px] opacity-85">(${count})</span>
        </button>
      `;
    });

    tabsContainer.innerHTML = html;
  }

  updateActiveTab(slug) {
    this.activeCategorySlug = slug;
    document.querySelectorAll('.category-tab-btn').forEach(btn => {
      const isMatch = btn.dataset.slug === slug;
      btn.setAttribute('aria-current', isMatch ? 'true' : 'false');
      if (isMatch) {
        btn.className =
          'category-tab-btn px-4 py-2 rounded-full border transition flex-shrink-0 flex items-center gap-1.5 active:scale-95 bg-[#d71920] text-white border-[#d71920] shadow-sm active-tab';
        if (typeof btn.scrollIntoView === 'function') {
          btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      } else {
        btn.className =
          'category-tab-btn px-4 py-2 rounded-full border transition flex-shrink-0 flex items-center gap-1.5 active:scale-95 bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200';
      }
    });
  }

  _getStickyBarOffset() {
    if (typeof document === 'undefined') return 104;
    const stickyEl = document.getElementById('sticky-nav-bar') || document.querySelector('header');
    return stickyEl && stickyEl.offsetHeight ? stickyEl.offsetHeight : 104;
  }

  scrollToCategory(slug) {
    this.isProgrammaticScrolling = true;
    this.updateActiveTab(slug);

    if (this.scrollLockTimer) {
      clearTimeout(this.scrollLockTimer);
    }

    const unlock = () => {
      this.isProgrammaticScrolling = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('scrollend', unlock);
      }
      if (this.scrollLockTimer) {
        clearTimeout(this.scrollLockTimer);
        this.scrollLockTimer = null;
      }
    };

    if (typeof window !== 'undefined' && 'onscrollend' in window) {
      window.addEventListener('scrollend', unlock, { once: true });
    }
    this.scrollLockTimer = setTimeout(unlock, 900);

    const targetSection = document.getElementById(`section-${slug}`);
    if (targetSection && typeof window !== 'undefined') {
      const headerOffset = this._getStickyBarOffset() + 10;
      const elementPosition = targetSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }

  setupScrollSpy() {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;

    if (this._scrollObserver) {
      this._scrollObserver.disconnect();
    }

    if (!this._userScrollListenerBound) {
      this._userScrollListenerBound = true;
      const handleUserScroll = () => {
        if (this.isProgrammaticScrolling) {
          this.isProgrammaticScrolling = false;
          if (this.scrollLockTimer) {
            clearTimeout(this.scrollLockTimer);
            this.scrollLockTimer = null;
          }
        }
      };
      window.addEventListener('wheel', handleUserScroll, { passive: true });
      window.addEventListener('touchstart', handleUserScroll, { passive: true });
    }

    const stickyHeight = this._getStickyBarOffset();

    this._scrollObserver = new IntersectionObserver(
      entries => {
        if (this.isProgrammaticScrolling) return;

        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          visible.sort(
            (a, b) =>
              Math.abs(a.boundingClientRect.top - stickyHeight) -
              Math.abs(b.boundingClientRect.top - stickyHeight)
          );
          const activeId = visible[0].target.id.replace('section-', '');
          this.updateActiveTab(activeId);
        }
      },
      {
        rootMargin: `-${stickyHeight}px 0px -40% 0px`,
        threshold: [0, 0.2, 0.5]
      }
    );

    document.querySelectorAll('#menu-sections-container > section').forEach(section => {
      this._scrollObserver.observe(section);
    });
  }

  /**
   * Tạo HTML cụm nút hành động trên thẻ món:
   * - Món đơn đang có trong giỏ: hiện bộ đếm [- Số lượng +] trực tiếp ngay trên thẻ
   * - Món đơn chưa có trong giỏ: hiện nút [+ Thêm Món]
   * - Món Combo: hiện nút [Tùy Chọn Món] (kèm số phần đã chọn nếu có)
   */
  _buildProductActionHtml(product) {
    const safeId = escapeHtml(product.id);
    const safeName = escapeHtml(product.name);
    const isCombo = Boolean(product.is_combo);
    const qtyInCart = this.cart.getProductQuantity(product.id);

    if (isCombo) {
      return `
        <button type="button" 
          class="btn-select-product bg-[#ffc72c] hover:bg-[#ffbf1a] text-gray-950 border border-amber-300 font-extrabold text-xs sm:text-sm py-2 px-3 sm:px-3.5 rounded-xl active:scale-95 transition flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ml-auto"
          data-id="${safeId}"
          data-is-combo="true">
          ${IconSliders('w-3.5 h-3.5')}
          <span>Tùy Chọn Món${qtyInCart > 0 ? ` (${qtyInCart})` : ''}</span>
        </button>
      `;
    }

    if (qtyInCart > 0) {
      return `
        <div class="inline-flex items-center border-2 border-[#d71920] rounded-xl overflow-hidden bg-red-50/60 shadow-sm ml-auto flex-shrink-0">
          <button type="button" class="btn-card-qty-minus w-9 h-9 flex items-center justify-center text-[#d71920] hover:bg-red-100 active:scale-95 transition font-black"
            data-id="${safeId}" aria-label="Giảm 1 ${safeName}">
            ${IconMinus('w-3.5 h-3.5')}
          </button>
          <span class="min-w-[28px] px-1 text-center text-xs sm:text-sm font-black text-gray-900" aria-live="polite">${qtyInCart}</span>
          <button type="button" class="btn-card-qty-plus w-9 h-9 flex items-center justify-center bg-[#d71920] text-white hover:bg-[#b81218] active:scale-95 transition font-black"
            data-id="${safeId}" aria-label="Thêm 1 ${safeName}">
            ${IconPlus('w-3.5 h-3.5')}
          </button>
        </div>
      `;
    }

    return `
      <button type="button" 
        class="btn-select-product bg-[#d71920] hover:bg-[#b81218] text-white shadow-sm font-extrabold text-xs sm:text-sm py-2 px-3 sm:px-3.5 rounded-xl active:scale-95 transition flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ml-auto"
        data-id="${safeId}"
        data-is-combo="false">
        ${IconPlus('w-3.5 h-3.5')}
        <span>Thêm Món</span>
      </button>
    `;
  }

  /**
   * Đồng bộ tức thì bộ đếm [- Số lượng +] trên toàn bộ thẻ món mà không cần re-render lại thực đơn
   */
  syncProductCardControls() {
    if (typeof document === 'undefined' || !this.productMap) return;
    document.querySelectorAll('[data-action-slot-id]').forEach(slot => {
      const pid = slot.dataset.actionSlotId;
      const product = this.productMap.get(String(pid));
      if (product) {
        slot.innerHTML = this._buildProductActionHtml(product);
      }
    });
  }

  /**
   * Lọc thông minh tối đa 3 món lẻ / ăn kèm để gợi ý bù đủ mốc chiết khấu trong 1 chạm
   */
  getUpsellSuggestions(neededAmount) {
    if (!this.menuData || !Array.isArray(this.menuData.categories) || neededAmount <= 0) return [];
    const seen = new Set();
    const candidates = [];

    this.menuData.categories.forEach(cat => {
      (cat.products || []).forEach(p => {
        const pid = String(p.id);
        const price = Number(p.price) || 0;
        if (!p.is_combo && price >= 5000 && price <= 65000 && !seen.has(pid)) {
          seen.add(pid);
          candidates.push(p);
        }
      });
    });

    // Ưu tiên 1: Món giúp cán mốc ngay trong 1 chạm (price >= neededAmount và chênh lệch nhỏ nhất)
    // Ưu tiên 2: Món ăn kèm/nước ngọt phổ biến có giá gần neededAmount nhất
    candidates.sort((a, b) => {
      const aReaches = a.price >= neededAmount && a.price <= neededAmount + 25000;
      const bReaches = b.price >= neededAmount && b.price <= neededAmount + 25000;
      if (aReaches !== bReaches) return aReaches ? -1 : 1;
      return Math.abs(a.price - neededAmount) - Math.abs(b.price - neededAmount);
    });

    return candidates.slice(0, 3);
  }

  handleQuickAddUpsell(productId) {
    const product = this.productMap.get(String(productId));
    if (!product) return null;
    this.cart.addItem(product, [], 1);
    this.updateFloatingCart();
    this.syncProductCardControls();
    bounceCartBadge(document.getElementById('floating-cart-badge'));
    return product;
  }

  handleEditComboInCart(cartItem) {
    if (!cartItem) return;
    const product = this.productMap.get(String(cartItem.productId));
    if (!product) {
      showToast('Không tìm thấy dữ liệu gốc của Combo này', 'warning');
      return;
    }

    this.comboModal.open(
      product,
      (configuredProduct, newSelectedOptions) => {
        this.cart.updateItemOptions(cartItem.cartItemId, configuredProduct, newSelectedOptions);
        this.updateFloatingCart();
        this.syncProductCardControls();
        this.cartDrawer.render();
        showToast(`Đã cập nhật tùy chọn cho "${configuredProduct.name}"!`, 'success');
      },
      {
        initialSelectedOptions: cartItem.selectedOptions || [],
        submitLabel: 'Lưu Thay Đổi'
      }
    );
  }

  renderMenuSections(filterKeyword = '') {
    const container = document.getElementById('menu-sections-container');
    if (!container || !this.menuData) return;

    const normKeyword = normalizeVietnamese(filterKeyword);
    let totalMatchedProducts = 0;
    let globalCardIndex = 0;
    let html = '';

    this.menuData.categories.forEach(cat => {
      const matchedProducts = (cat.products || []).filter(p => {
        if (!normKeyword) return true;
        const haystack = normalizeVietnamese(`${p.name || ''} ${p.description || ''}`);
        return haystack.includes(normKeyword);
      });

      if (matchedProducts.length === 0) return;
      totalMatchedProducts += matchedProducts.length;

      let cardsHtml = '';
      matchedProducts.forEach(product => {
        const isCombo = Boolean(product.is_combo);
        const safeProductId = escapeHtml(product.id);
        const safeProductName = escapeHtml(product.name);
        const safeImg = safeImageUrl(product.image);

        // Ưu tiên tải sớm 4 ảnh đầu tiên (Above-the-fold) tối ưu LCP, lazy-load từ món thứ 5 trở đi
        const isAboveFold = globalCardIndex < 4;
        const imgLoadingAttr = isAboveFold
          ? 'loading="eager" fetchpriority="high"'
          : 'loading="lazy" decoding="async"';
        globalCardIndex++;

        const originalPrice = Number(product.price) || 0;
        let priceDisplayHtml = '';

        if (originalPrice >= 100000) {
          const discount = Math.floor(originalPrice / 100000) * 15000;
          const discountedPrice = originalPrice - discount;
          priceDisplayHtml = `
            <div class="mt-2 space-y-1">
              <div class="flex items-center gap-1.5 text-xs text-gray-500">
                <span class="text-[11px] font-medium text-gray-600 whitespace-nowrap">Giá gốc:</span>
                <span class="line-through font-bold text-gray-500 whitespace-nowrap">${formatCurrency(originalPrice)}</span>
              </div>
              <div class="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                <div class="flex items-baseline gap-1">
                  <span class="text-xs font-extrabold text-[#d71920] whitespace-nowrap">Giá sau giảm:</span>
                  <span class="text-base sm:text-lg font-black text-red-600 whitespace-nowrap">${formatCurrency(discountedPrice)}</span>
                </div>
                <span class="text-[10px] font-black text-green-800 bg-green-50 px-1.5 py-0.5 rounded-md border border-green-200 whitespace-nowrap">
                  Tiết kiệm -${Math.round(discount / 1000)}k
                </span>
              </div>
            </div>
          `;
        } else {
          priceDisplayHtml = `
            <div class="mt-2 space-y-1">
              <div class="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                <div class="flex items-baseline gap-1">
                  <span class="text-xs font-bold text-gray-700 whitespace-nowrap">Đơn giá:</span>
                  <span class="text-base sm:text-lg font-black text-gray-900 whitespace-nowrap">${formatCurrency(originalPrice)}</span>
                </div>
                <span class="text-[10px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200 whitespace-nowrap">
                  Gộp đơn ≥100k giảm 15%
                </span>
              </div>
            </div>
          `;
        }

        cardsHtml += `
          <div class="product-card bg-white rounded-2xl border border-gray-200/90 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between p-3 sm:p-4">
            <div class="flex gap-2.5 sm:gap-3.5 items-start">
              <button type="button" 
                class="btn-preview-image text-left focus:outline-none relative w-20 h-20 sm:w-28 sm:h-28 rounded-xl bg-amber-50/50 p-1 border border-amber-100 flex-shrink-0 overflow-hidden flex items-center justify-center self-start cursor-zoom-in group active:scale-95 transition"
                data-id="${safeProductId}"
                aria-label="Xem ảnh lớn ${safeProductName}"
                title="Nhấn để xem ảnh to">
                <img src="${safeImg}" 
                  alt="${safeProductName}" 
                  width="112"
                  height="112"
                  ${imgLoadingAttr}
                  class="w-full h-full object-contain transform group-hover:scale-105 transition duration-200"
                  onerror="this.onerror=null; this.src='${FALLBACK_FOOD_IMAGE}'">
                ${isCombo ? `
                  <span class="absolute top-1 left-1 bg-[#d71920] text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-sm uppercase tracking-wide">
                    Combo
                  </span>
                ` : ''}
                <span class="absolute bottom-1 right-1 w-5 h-5 rounded-md bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-sm">
                  ${IconZoomIn('w-3 h-3')}
                </span>
              </button>

              <div class="flex-1 min-w-0">
                <h4 class="font-extrabold text-sm sm:text-base text-gray-900 leading-snug break-words">${safeProductName}</h4>
                ${formatDescriptionHtml(product.description)}
                ${priceDisplayHtml}
              </div>
            </div>

            <div class="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
              <span class="text-[11px] text-gray-600 font-medium flex items-center gap-1 truncate min-w-0">
                ${isCombo ? `${IconSliders('w-3.5 h-3.5 text-amber-600 flex-shrink-0')} <span class="truncate">Đổi vị, upsize</span>` : `${IconClock('w-3.5 h-3.5 text-green-700 flex-shrink-0')} <span class="truncate">Chuẩn bị nhanh</span>`}
              </span>
              <div data-action-slot-id="${safeProductId}" class="ml-auto flex-shrink-0">
                ${this._buildProductActionHtml(product)}
              </div>
            </div>
          </div>
        `;
      });

      const safeCatSlug = escapeHtml(cat.slug);
      const safeCatName = escapeHtml(cat.name);

      html += `
        <section id="section-${safeCatSlug}" class="space-y-3 scroll-mt-28">
          <div class="flex items-center justify-between pb-1.5 border-b-2 border-amber-200">
            <h3 class="font-black text-base sm:text-lg text-gray-900 uppercase tracking-tight flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-[#d71920]" aria-hidden="true"></span>
              <span>${safeCatName}</span>
            </h3>
            <span class="text-xs font-bold text-gray-600">${matchedProducts.length} món</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            ${cardsHtml}
          </div>
        </section>
      `;
    });

    if (totalMatchedProducts === 0) {
      container.innerHTML = `
        <div class="text-center py-16 bg-white rounded-3xl border border-gray-200 shadow-sm px-4">
          <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            ${IconSearch('w-7 h-7')}
          </div>
          <p class="font-bold text-gray-800 text-base">Không tìm thấy món ăn nào phù hợp với từ khóa "${escapeHtml(filterKeyword)}"</p>
          <p class="text-xs text-gray-600 mt-1">Bạn có thể gõ có dấu hoặc không dấu (ví dụ: ga gion, mi y, burger, nuoc)</p>
          <button type="button" id="btn-reset-search" class="mt-4 bg-[#ffc72c] hover:bg-[#ffbf1a] font-extrabold text-xs px-4 py-2.5 rounded-xl text-gray-950 shadow-sm active:scale-95 transition">
            Xem Tất Cả Món Ăn
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = html;
    this.setupScrollSpy();
  }

  openProductImagePreview(product) {
    if (!product) return;
    const isCombo = Boolean(product.is_combo);
    const originalPrice = Number(product.price) || 0;

    this.imageModal.open({
      title: product.name,
      image: product.image,
      price: originalPrice,
      originalPrice: originalPrice,
      isCombo: isCombo,
      onAction: () => {
        this.handleProductClick(product.id, isCombo);
      }
    });
  }

  handleProductClick(productId, isCombo, triggerEl = null) {
    const product = this.productMap ? this.productMap.get(String(productId)) : null;
    if (!product) return;

    if (isCombo) {
      this.comboModal.open(product, (configuredProduct, selectedOptions) => {
        this.cart.addItem(configuredProduct, selectedOptions, 1);
        this.updateFloatingCart();
        this.syncProductCardControls();
        bounceCartBadge(document.getElementById('floating-cart-badge'));

        showUndoToast(`Đã thêm "${product.name}" vào giỏ!`, () => {
          const undone = this.cart.undoLastAdd();
          if (undone) {
            this.updateFloatingCart();
            this.syncProductCardControls();
            bounceCartBadge(document.getElementById('floating-cart-badge'));
            showToast(`Đã hoàn tác: Bỏ "${undone.name}" khỏi giỏ`, 'info');
          }
        });
      });
    } else {
      this.cart.addItem(product, [], 1);
      this.updateFloatingCart();
      this.syncProductCardControls();
      const badgeEl = document.getElementById('floating-cart-badge');
      if (triggerEl) {
        flyToCart(triggerEl, badgeEl);
      } else {
        bounceCartBadge(badgeEl);
      }

      showUndoToast(`Đã thêm "${product.name}" vào giỏ!`, () => {
        const undone = this.cart.undoLastAdd();
        if (undone) {
          this.updateFloatingCart();
          this.syncProductCardControls();
          bounceCartBadge(document.getElementById('floating-cart-badge'));
          showToast(`Đã hoàn tác: Bỏ "${undone.name}" khỏi giỏ`, 'info');
        }
      });
    }
  }

  updateFloatingCart() {
    const totalItems = this.cart.getTotalItemCount();
    const totals = this.cart.getTotals(this.orderType, this.config);
    const freeshipThreshold = this.config.freeshipThreshold || 200000;

    // Chỉ bắn pháo hoa khi người dùng thực sự vừa chạm thêm món vượt qua mốc Freeship
    if (
      this.orderType === 'delivery' &&
      this.lastOriginalTotal < freeshipThreshold &&
      totals.originalTotal >= freeshipThreshold
    ) {
      fireFreeshipMilestone();
    }
    this.lastOriginalTotal = totals.originalTotal;

    const badgeEl = document.getElementById('floating-cart-badge');
    const priceEl = document.getElementById('floating-cart-final-price');
    const hintEl = document.getElementById('floating-cart-discount-hint');
    const origWrapper = document.getElementById('floating-cart-original-wrapper');
    const origPriceEl = document.getElementById('floating-cart-original-price');
    const openCartBtn = document.getElementById('btn-open-cart-drawer');

    if (openCartBtn) {
      if (totalItems > 0) {
        openCartBtn.classList.add('has-items-glow');
      } else {
        openCartBtn.classList.remove('has-items-glow');
      }
    }

    if (badgeEl) badgeEl.innerText = totalItems;
    if (priceEl) priceEl.innerText = formatCurrency(totals.finalTotal);

    if (totalItems > 0 && totals.originalTotal > 0) {
      if (origWrapper) origWrapper.classList.remove('hidden');
      if (origPriceEl) origPriceEl.innerText = formatCurrency(totals.originalTotal);
    } else {
      if (origWrapper) origWrapper.classList.add('hidden');
    }

    if (hintEl) {
      if (totalItems === 0) {
        hintEl.innerText =
          this.orderType === 'dinein' ? '(Ăn tại quán • Chưa chọn món)' : '(Giao tận nơi • Chưa chọn món)';
        hintEl.className = 'text-[11px] text-gray-600 font-semibold truncate mt-0.5';
      } else if (totals.originalTotal < 100000) {
        const needed = 100000 - totals.originalTotal;
        const modeHint = this.orderType === 'dinein' ? ' (Ăn tại quán)' : '';
        hintEl.innerText = `Thêm ${formatCurrency(needed)} để giảm ngay 15k!${modeHint}`;
        hintEl.className = 'text-[11px] text-red-700 font-extrabold truncate mt-0.5';
      } else if (totals.originalTotal < 200000) {
        const needed = 200000 - totals.originalTotal;
        const perk = this.orderType === 'delivery' ? 'giảm 30k & Freeship!' : 'giảm 30k!';
        hintEl.innerText = `Đã giảm 15k • Thêm ${formatCurrency(needed)} để ${perk}`;
        hintEl.className = 'text-[11px] text-green-700 font-extrabold truncate mt-0.5';
      } else {
        const currentStep = Math.floor(totals.originalTotal / 100000);
        const nextStep = (currentStep + 1) * 100000;
        const needed = nextStep - totals.originalTotal;
        const nextDisc = (currentStep + 1) * 15;
        hintEl.innerText = `Đã giảm ${Math.round(totals.discountAmount / 1000)}k • Thêm ${formatCurrency(needed)} để giảm ${nextDisc}k!`;
        hintEl.className = 'text-[11px] text-green-700 font-extrabold truncate mt-0.5';
      }
    }
  }

  bindGlobalEvents() {
    if (this._globalEventsBound) return;
    this._globalEventsBound = true;

    // 1. Chuyển hình thức giao hàng / ăn tại quán ở header
    document.getElementById('top-btn-delivery')?.addEventListener('click', () => {
      this.setOrderType('delivery');
    });
    document.getElementById('top-btn-dinein')?.addEventListener('click', () => {
      this.setOrderType('dinein');
    });

    // 2. Mở drawer giỏ hàng ở footer
    document.getElementById('btn-open-cart-drawer')?.addEventListener('click', () => {
      this.cartDrawer.open();
    });
    document.getElementById('btn-open-cart-info')?.addEventListener('click', () => {
      this.cartDrawer.open();
    });

    // 3. Ủy quyền sự kiện (Event Delegation) cho thanh Category Tabs
    document.getElementById('category-tabs')?.addEventListener('click', e => {
      const tabBtn = e.target?.closest?.('.category-tab-btn');
      if (tabBtn && tabBtn.dataset.slug) {
        this.scrollToCategory(tabBtn.dataset.slug);
      }
    });

    // 4. Ủy quyền 1 listener duy nhất cho toàn bộ danh sách thực đơn (#menu-sections-container)
    const searchInput = document.getElementById('menu-search-input');
    const clearBtn = document.getElementById('clear-search-btn');

    document.getElementById('menu-sections-container')?.addEventListener('click', e => {
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;

      // Nút thử tải lại thực đơn khi lỗi mạng
      if (target.closest('#btn-retry-menu')) {
        this.retryLoadMenu();
        return;
      }

      // Nút đặt lại tìm kiếm (đồng bộ ẩn nút Xóa)
      if (target.closest('#btn-reset-search')) {
        if (searchInput) searchInput.value = '';
        clearBtn?.classList.add('hidden');
        this.renderMenuSections('');
        return;
      }

      // Xem ảnh phóng to
      const previewBtn = target.closest('.btn-preview-image');
      if (previewBtn) {
        const product = this.productMap.get(String(previewBtn.dataset.id));
        if (product) this.openProductImagePreview(product);
        return;
      }

      // Tăng / Giảm trực tiếp trên thẻ món đơn (Inline Stepper)
      const minusCardBtn = target.closest('.btn-card-qty-minus');
      if (minusCardBtn) {
        const pid = String(minusCardBtn.dataset.id);
        this.cart.updateQuantity(`${pid}_base`, -1);
        this.updateFloatingCart();
        this.syncProductCardControls();
        bounceCartBadge(document.getElementById('floating-cart-badge'));
        return;
      }

      const plusCardBtn = target.closest('.btn-card-qty-plus');
      if (plusCardBtn) {
        const pid = String(plusCardBtn.dataset.id);
        const product = this.productMap.get(pid);
        if (product) {
          this.cart.addItem(product, [], 1);
          this.updateFloatingCart();
          this.syncProductCardControls();
          flyToCart(plusCardBtn, document.getElementById('floating-cart-badge'));
        }
        return;
      }

      // Thêm món mới / Mở tùy chọn Combo
      const selectBtn = target.closest('.btn-select-product');
      if (selectBtn) {
        const isCombo = selectBtn.dataset.isCombo === 'true';
        this.handleProductClick(selectBtn.dataset.id, isCombo, selectBtn);
      }
    });

    // 5. Tìm kiếm món ăn thông minh không dấu (Debounce 200ms)
    const debouncedSearch = debounce(val => {
      this.renderMenuSections(val);
    }, 200);

    searchInput?.addEventListener('input', e => {
      const val = e.target.value;
      if (val) {
        clearBtn?.classList.remove('hidden');
      } else {
        clearBtn?.classList.add('hidden');
      }
      debouncedSearch(val);
    });

    clearBtn?.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
      }
      clearBtn.classList.add('hidden');
      this.renderMenuSections('');
    });
  }
}

// Khởi chạy ứng dụng khi DOM sẵn sàng
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new JollibeeApp();
    app.init();
  });
}
