/**
 * Khởi tạo và điều phối giao diện ứng dụng chính
 */
import { Cart } from './cart.js';
import { ComboModal } from './components/combo-modal.js';
import { CartDrawer } from './components/cart-drawer.js';
import { ImageModal } from './components/image-modal.js';
import { showToast, showUndoToast } from './components/ui-feedback.js';
import { formatCurrency } from './order-message.js';
import { bindMouseDragScroll } from './mouse-drag-scroll.js';
import {
  escapeHtml,
  safeImageUrl,
  FALLBACK_FOOD_IMAGE,
  normalizeVietnamese,
  formatDescriptionHtml,
  debounce
} from './utils.js';
import { IconSliders, IconClock, IconPlus, IconMinus, IconSearch, IconZoomIn, IconFlame } from './icons.js';
import { flyToCart, bounceCartBadge, fireFreeshipMilestone } from './effects.js';

export class JollibeeApp {
  constructor() {
    this.config = typeof window !== 'undefined' && window.JOLLIBEE_CONFIG ? window.JOLLIBEE_CONFIG : {};
    this.menuData = null;
    this.productMap = new Map();
    this.cart = new Cart();
    this.orderType = null; // null (chưa chọn), 'delivery' hoặc 'dinein'
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
    this._scrollSpyFrame = null;
    this._menuAbortController = null;
    this._globalEventsBound = false;
  }

  setOrderType(type, updateDrawer = true) {
    this.orderType = type;
    if (updateDrawer) {
      this.cartDrawer.setOrderType(type);
    }
    this.updateFloatingCart();
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

  _getCategoryDisplayName(cat) {
    if (!cat) return '';
    const overrides = this.config?.categoryTitleOverrides;
    if (overrides && typeof overrides === 'object' && overrides[cat.slug]) {
      return String(overrides[cat.slug]);
    }
    return cat.name || '';
  }

  _getProductBadge(product) {
    if (!product) return '';
    const pid = String(product.id);
    const badgesMap = this.config?.productBadges;
    if (badgesMap && typeof badgesMap === 'object' && Object.prototype.hasOwnProperty.call(badgesMap, pid)) {
      return badgesMap[pid] ? String(badgesMap[pid]).trim() : '';
    }
    return product.badge ? String(product.badge).trim() : '';
  }

  _getSortedCategoryProducts(products = []) {
    const priorityList = Array.isArray(this.config?.priorityProductIds)
      ? this.config.priorityProductIds.map(id => String(id))
      : [];
    if (priorityList.length === 0) return [...products];

    const rankMap = new Map();
    priorityList.forEach((id, idx) => rankMap.set(id, idx));

    return [...products].sort((a, b) => {
      const rankA = rankMap.has(String(a.id)) ? rankMap.get(String(a.id)) : priorityList.length;
      const rankB = rankMap.has(String(b.id)) ? rankMap.get(String(b.id)) : priorityList.length;
      return rankA - rankB;
    });
  }

  renderCategoryTabs() {
    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer || !this.menuData) return;

    let html = '';
    this.menuData.categories.forEach((cat, index) => {
      const isFirst = index === 0;
      if (isFirst) this.activeCategorySlug = cat.slug;
      const safeSlug = escapeHtml(cat.slug);
      const safeName = escapeHtml(this._getCategoryDisplayName(cat));
      const count = Array.isArray(cat.products) ? cat.products.length : 0;
      const leadingIcon = isFirst ? `<span class="flex items-center flex-shrink-0 text-[#d71920] group-[.active-tab]:text-amber-300">${IconFlame('w-3.5 h-3.5')}</span>` : '';

      html += `
        <button type="button" 
          class="category-tab-btn group px-4 py-2 rounded-full border transition flex-shrink-0 flex items-center gap-1.5 active:scale-95 ${isFirst ? 'bg-[#d71920] text-white border-[#d71920] shadow-sm active-tab' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}"
          aria-current="${isFirst ? 'true' : 'false'}"
          data-slug="${safeSlug}">
          ${leadingIcon}
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
          'category-tab-btn group px-4 py-2 rounded-full border transition flex-shrink-0 flex items-center gap-1.5 active:scale-95 bg-[#d71920] text-white border-[#d71920] shadow-sm active-tab';
        const tabs = btn.parentElement;
        if (typeof tabs?.scrollTo === 'function' && tabs.scrollWidth > tabs.clientWidth) {
          const tabRect = btn.getBoundingClientRect();
          const rowLeft = tabs.getBoundingClientRect().left;
          tabs.scrollTo({
            left: tabs.scrollLeft + tabRect.left - rowLeft + (tabRect.width - tabs.clientWidth) / 2,
            behavior: 'smooth'
          });
        }
      } else {
        btn.className =
          'category-tab-btn group px-4 py-2 rounded-full border transition flex-shrink-0 flex items-center gap-1.5 active:scale-95 bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200';
      }
    });
  }

  _getCategoryScrollOffset() {
    if (typeof document === 'undefined') return 114;
    const stickyEl = document.getElementById('sticky-nav-bar') || document.querySelector('header');
    return (stickyEl?.offsetHeight || 104) + 10;
  }

  _armProgrammaticScrollUnlock(delayMs = 220) {
    clearTimeout(this.scrollLockTimer);
    this.scrollLockTimer = setTimeout(() => this._finishCategoryScroll({ resync: false }), delayMs);
  }

  scrollToCategory(slug) {
    let targetSection = document.getElementById(`section-${slug}`);

    // Nếu đang có từ khóa tìm kiếm khiến danh mục này bị ẩn -> tự động xóa bộ lọc để hiển thị đầy đủ
    if (!targetSection) {
      const searchInput = document.getElementById('menu-search-input');
      if (searchInput && searchInput.value && searchInput.value.trim() !== '') {
        searchInput.value = '';
        document.getElementById('clear-search-btn')?.classList.add('hidden');
        this.renderMenuSections('');
        targetSection = document.getElementById(`section-${slug}`);
      }
    }

    if (!targetSection) return;

    this.isProgrammaticScrolling = true;
    this.updateActiveTab(slug);
    this._armProgrammaticScrollUnlock(320);

    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({
        top: (window.scrollY || 0) + targetSection.getBoundingClientRect().top - this._getCategoryScrollOffset(),
        behavior: 'smooth'
      });
    }
  }

  _finishCategoryScroll({ resync = false } = {}) {
    if (!this.isProgrammaticScrolling) return;
    this.isProgrammaticScrolling = false;
    clearTimeout(this.scrollLockTimer);
    this.scrollLockTimer = null;
    if (resync) {
      this._scheduleActiveCategoryUpdate();
    }
  }

  _scheduleActiveCategoryUpdate() {
    if (this.isProgrammaticScrolling || this._scrollSpyFrame !== null) return;
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;

    this._scrollSpyFrame = window.requestAnimationFrame(() => {
      this._scrollSpyFrame = null;
      if (this.isProgrammaticScrolling) return;

      const sections = document.querySelectorAll('#menu-sections-container > section');
      if (!sections.length) return;

      const scrollRoot = document.scrollingElement;
      const atBottom =
        scrollRoot &&
        scrollRoot.scrollTop > 0 &&
        scrollRoot.scrollTop + scrollRoot.clientHeight >= scrollRoot.scrollHeight - 2;
      let activeSection = sections[sections.length - 1];

      if (!atBottom) {
        const anchor = this._getCategoryScrollOffset() + 2;
        activeSection = sections[0];
        for (const section of sections) {
          if (section.getBoundingClientRect().top > anchor) break;
          activeSection = section;
        }
      }

      const slug = activeSection.id.slice('section-'.length);
      if (slug !== this.activeCategorySlug) this.updateActiveTab(slug);
    });
  }

  setupScrollSpy() {
    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') return;

    if (!this._scrollSpyBound) {
      this._scrollSpyBound = true;
      const onScroll = () => {
        if (this.isProgrammaticScrolling) {
          // Gia hạn khóa cho tới khi cuộn mượt dừng hẳn (kể cả hành trình dài > 1 giây)
          this._armProgrammaticScrollUnlock(180);
          return;
        }
        this._scheduleActiveCategoryUpdate();
      };
      const onNaturalEnd = () => this._finishCategoryScroll({ resync: false });
      const onUserInterrupt = () => this._finishCategoryScroll({ resync: true });

      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', () => this._scheduleActiveCategoryUpdate());
      window.addEventListener('scrollend', onNaturalEnd);
      window.addEventListener('wheel', onUserInterrupt, { passive: true });
      window.addEventListener('touchmove', onUserInterrupt, { passive: true });
    }

    this._finishCategoryScroll({ resync: false });
    this._scheduleActiveCategoryUpdate();
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
          <span>Tùy Chỉnh Combo${qtyInCart > 0 ? ` (${qtyInCart})` : ''}</span>
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
        <span>Thêm Ngay</span>
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
    const minCandidatePrice = neededAmount <= 3000 ? 1000 : 5000;

    this.menuData.categories.forEach(cat => {
      (cat.products || []).forEach(p => {
        const pid = String(p.id);
        const price = Number(p.price) || 0;
        if (!p.is_combo && price >= minCandidatePrice && price <= 65000 && !seen.has(pid)) {
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
        showToast(`Đã lưu tùy chỉnh cho "${configuredProduct.name}"!`, 'success');
      },
      {
        initialSelectedOptions: cartItem.selectedOptions || [],
        submitLabel: 'Lưu Tùy Chỉnh'
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

    this.menuData.categories.forEach((cat, catIdx) => {
      const orderedProducts = this._getSortedCategoryProducts(cat.products || []);
      const matchedProducts = orderedProducts.filter(p => {
        if (!normKeyword) return true;
        const badgeText = this._getProductBadge(p);
        const haystack = normalizeVietnamese(`${p.name || ''} ${p.description || ''} ${badgeText}`);
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
        const badgeText = this._getProductBadge(product);
        const isTopRank = badgeText.includes('#1');

        const badgeHtml = badgeText
          ? `
            <div class="mb-1">
              <span class="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wide ${
                isTopRank
                  ? 'bg-gradient-to-r from-[#d71920] to-orange-500 text-white shadow-sm'
                  : 'bg-amber-100 text-red-800 border border-amber-300'
              }">
                ${IconFlame('w-3 h-3 flex-shrink-0')}
                <span>${escapeHtml(badgeText)}</span>
              </span>
            </div>
          `
          : '';

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
                  <span class="text-xs font-extrabold text-[#d71920] whitespace-nowrap">Chỉ còn:</span>
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
                  <span class="text-xs font-bold text-gray-700 whitespace-nowrap">Giá món:</span>
                  <span class="text-base sm:text-lg font-black text-gray-900 whitespace-nowrap">${formatCurrency(originalPrice)}</span>
                </div>
                <span class="text-[10px] font-bold text-amber-900 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200 whitespace-nowrap">
                  Đơn từ 100k giảm ngay 15k
                </span>
              </div>
            </div>
          `;
        }

        const cardBorderClass = isTopRank
          ? 'border-amber-300 ring-1 ring-amber-200/80'
          : 'border-gray-200/90';

        cardsHtml += `
          <div class="product-card bg-white rounded-2xl border ${cardBorderClass} shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between p-3 sm:p-4">
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
                ${badgeHtml}
                <h4 class="font-extrabold text-sm sm:text-base text-gray-900 leading-snug break-words">${safeProductName}</h4>
                ${formatDescriptionHtml(product.description)}
                ${priceDisplayHtml}
              </div>
            </div>

            <div class="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
              <span class="text-[11px] text-gray-600 font-medium flex items-center gap-1 truncate min-w-0">
                ${isCombo ? `${IconSliders('w-3.5 h-3.5 text-amber-600 flex-shrink-0')} <span class="truncate">Chọn vị gà & nước</span>` : `${IconClock('w-3.5 h-3.5 text-green-700 flex-shrink-0')} <span class="truncate">Nóng giòn chuẩn vị</span>`}
              </span>
              <div data-action-slot-id="${safeProductId}" class="ml-auto flex-shrink-0">
                ${this._buildProductActionHtml(product)}
              </div>
            </div>
          </div>
        `;
      });

      const safeCatSlug = escapeHtml(cat.slug);
      const safeCatName = escapeHtml(this._getCategoryDisplayName(cat));
      const sectionDotHtml =
        catIdx === 0
          ? `<span class="text-[#d71920] flex items-center flex-shrink-0">${IconFlame('w-4 h-4 sm:w-5 sm:h-5')}</span>`
          : `<span class="w-3 h-3 rounded-full bg-[#d71920] flex-shrink-0" aria-hidden="true"></span>`;

      html += `
        <section id="section-${safeCatSlug}" class="space-y-3 scroll-mt-28">
          <div class="flex items-center justify-between pb-1.5 border-b-2 border-amber-200">
            <h3 class="font-black text-base sm:text-lg text-gray-900 uppercase tracking-tight flex items-center gap-2">
              ${sectionDotHtml}
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
    } else {
      container.innerHTML = html;
    }
    this.setupScrollSpy();
  }

  openProductImagePreview(product) {
    if (!product) return;
    const isCombo = Boolean(product.is_combo);
    const originalPrice = Number(product.price) || 0;
    const discount = originalPrice >= 100000 ? Math.floor(originalPrice / 100000) * 15000 : 0;
    const displayPrice = originalPrice - discount;

    this.imageModal.open({
      title: product.name,
      image: product.image,
      price: displayPrice,
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
      this.orderType !== 'dinein' &&
      this.lastOriginalTotal < freeshipThreshold &&
      totals.originalTotal >= freeshipThreshold
    ) {
      fireFreeshipMilestone();
    }
    this.lastOriginalTotal = totals.originalTotal;

    const badgeEl = document.getElementById('floating-cart-badge');
    const labelEl = document.getElementById('floating-cart-price-label');
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
    if (labelEl) labelEl.innerText = this.orderType ? 'Thực trả:' : 'Tạm tính:';
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
          this.orderType === 'dinein'
            ? '(Ăn tại quán • Chưa chọn món)'
            : this.orderType === 'delivery'
              ? '(Giao tận nơi • Chưa chọn món)'
              : '(Chưa chọn món • Giảm 15k mỗi 100k)';
        hintEl.className = 'text-[11px] text-gray-600 font-semibold truncate mt-0.5';
      } else if (totals.originalTotal < 100000) {
        const needed = 100000 - totals.originalTotal;
        const modeHint = this.orderType === 'dinein' ? ' (Ăn tại quán)' : '';
        hintEl.innerText = `Thêm ${formatCurrency(needed)} để giảm ngay 15k!${modeHint}`;
        hintEl.className = 'text-[11px] text-red-700 font-extrabold truncate mt-0.5';
      } else if (totals.originalTotal < 200000) {
        const needed = 200000 - totals.originalTotal;
        const perk = this.orderType === 'dinein' ? 'giảm 30k!' : 'giảm 30k & Freeship!';
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

    // 1. Mở drawer giỏ hàng ở footer
    document.getElementById('btn-open-cart-drawer')?.addEventListener('click', () => {
      this.cartDrawer.open();
    });
    document.getElementById('btn-open-cart-info')?.addEventListener('click', () => {
      this.cartDrawer.open();
    });

    // 3. Ủy quyền sự kiện (Event Delegation) cho thanh Category Tabs
    const categoryTabs = document.getElementById('category-tabs');
    bindMouseDragScroll(categoryTabs);
    categoryTabs?.addEventListener('click', e => {
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
