/**
 * Khởi tạo và điều phối giao diện ứng dụng chính
 */
import { Cart } from './cart.js';
import { ComboModal } from './components/combo-modal.js';
import { CartDrawer } from './components/cart-drawer.js';
import { formatCurrency } from './order-message.js';
import { escapeHtml, formatDescriptionHtml } from './utils.js?v=1.1';
import { IconSliders, IconClock, IconPlus, IconSearch } from './icons.js';
import { flyToCart, bounceCartBadge, fireFreeshipMilestone } from './effects.js';

class JollibeeApp {
  constructor() {
    this.config = window.JOLLIBEE_CONFIG || {};
    this.menuData = null;
    this.cart = new Cart();
    this.orderType = 'delivery'; // 'delivery' hoặc 'dinein'
    this.lastOriginalTotal = 0;
    this.comboModal = new ComboModal('combo-modal-container');
    this.cartDrawer = new CartDrawer(
      this.cart, 
      this.config, 
      () => this.updateFloatingCart(),
      (newType) => this.setOrderType(newType, false)
    );
    this.activeCategorySlug = null;
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

    if (this.orderType === 'delivery') {
      btnDel.className = 'flex-1 py-2 px-3 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition bg-white text-gray-900 shadow-sm active:scale-98';
      btnDin.className = 'flex-1 py-2 px-3 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition text-white hover:bg-white/10 active:scale-98';
      if (iconDel) iconDel.className = 'text-[#d71920] flex items-center';
      if (iconDin) iconDin.className = 'text-white/70 flex items-center';
    } else {
      btnDel.className = 'flex-1 py-2 px-3 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition text-white hover:bg-white/10 active:scale-98';
      btnDin.className = 'flex-1 py-2 px-3 rounded-lg font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition bg-[#ffc72c] text-gray-950 shadow-sm active:scale-98';
      if (iconDel) iconDel.className = 'text-white/70 flex items-center';
      if (iconDin) iconDin.className = 'text-gray-950 flex items-center';
    }
  }

  async init() {
    this.applyConfig();
    await this.loadMenu();
    this.renderCategoryTabs();
    this.renderMenuSections();
    this.bindGlobalEvents();
    this.updateFloatingCart();
  }

  applyConfig() {
    if (this.config.shopName) {
      document.getElementById('shop-title').querySelector('span').innerText = this.config.shopName;
    }
    if (this.config.shopSubtitle) {
      document.getElementById('shop-subtitle').innerText = this.config.shopSubtitle;
    }
    if (this.config.bannerNotice) {
      document.getElementById('banner-text').innerText = this.config.bannerNotice;
    }
    if (this.config.hotline) {
      const hotlineBtn = document.getElementById('header-hotline-btn');
      const hotlineNumber = this.config.hotline.replace(/\D/g, '');
      if (hotlineBtn) {
        hotlineBtn.href = `tel:${hotlineNumber}`;
        document.getElementById('header-hotline-text').innerText = this.config.hotline;
      }
    }
  }

  async loadMenu() {
    try {
      const response = await fetch('data/menu.json');
      if (!response.ok) throw new Error('Không thể tải file data/menu.json');
      this.menuData = await response.json();
    } catch (err) {
      console.error('Lỗi nạp thực đơn:', err);
      document.getElementById('menu-sections-container').innerHTML = `
        <div class="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-200 text-center">
          <p class="font-bold">Đã có lỗi xảy ra khi tải dữ liệu thực đơn.</p>
          <p class="text-xs mt-1 text-gray-500">Vui lòng kiểm tra lại đường dẫn data/menu.json hoặc làm mới trang.</p>
        </div>
      `;
    }
  }

  renderCategoryTabs() {
    const tabsContainer = document.getElementById('category-tabs');
    if (!tabsContainer || !this.menuData) return;

    let html = '';
    this.menuData.categories.forEach((cat, index) => {
      const isFirst = index === 0;
      if (isFirst) this.activeCategorySlug = cat.slug;

      html += `
        <button type="button" 
          class="category-tab-btn px-4 py-2 rounded-full border transition flex-shrink-0 flex items-center gap-1.5 ${isFirst ? 'bg-[#d71920] text-white border-[#d71920] shadow-xs active-tab' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}"
          data-slug="${cat.slug}">
          <span>${cat.name}</span>
          <span class="text-[10px] opacity-80">(${cat.products.length})</span>
        </button>
      `;
    });

    tabsContainer.innerHTML = html;

    tabsContainer.querySelectorAll('.category-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const slug = e.currentTarget.dataset.slug;
        this.scrollToCategory(slug);
      });
    });
  }

  scrollToCategory(slug) {
    this.activeCategorySlug = slug;
    
    // Đổi active tab style
    document.querySelectorAll('.category-tab-btn').forEach(btn => {
      if (btn.dataset.slug === slug) {
        btn.className = 'category-tab-btn px-4 py-2 rounded-full border transition flex-shrink-0 flex items-center gap-1.5 bg-[#d71920] text-white border-[#d71920] shadow-xs active-tab';
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        btn.className = 'category-tab-btn px-4 py-2 rounded-full border transition flex-shrink-0 flex items-center gap-1.5 bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200';
      }
    });

    // Cuộn đến section
    const targetSection = document.getElementById(`section-${slug}`);
    if (targetSection) {
      const headerOffset = 180;
      const elementPosition = targetSection.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  }

  renderMenuSections(filterKeyword = '') {
    const container = document.getElementById('menu-sections-container');
    if (!container || !this.menuData) return;

    const keyword = filterKeyword.toLowerCase().trim();
    let totalMatchedProducts = 0;
    let html = '';

    this.menuData.categories.forEach(cat => {
      const matchedProducts = cat.products.filter(p => {
        if (!keyword) return true;
        return (
          p.name.toLowerCase().includes(keyword) ||
          p.description.toLowerCase().includes(keyword)
        );
      });

      if (matchedProducts.length === 0) return;
      totalMatchedProducts += matchedProducts.length;

      let cardsHtml = '';
      matchedProducts.forEach(product => {
        const isCombo = product.is_combo;
        const buttonContent = isCombo
          ? `${IconSliders('w-3.5 h-3.5')}<span>Tùy Chọn Món</span>`
          : `${IconPlus('w-3.5 h-3.5')}<span>Thêm Món</span>`;
        const buttonClass = isCombo
          ? 'bg-[#ffc72c] hover:bg-[#ffbf1a] text-gray-900 border border-amber-300'
          : 'bg-[#d71920] hover:bg-[#b81218] text-white shadow-xs';

        const originalPrice = product.price;
        let discountedPrice;
        let savingsBadge = '';

        if (originalPrice >= 100000) {
          const discount = Math.floor(originalPrice / 100000) * 15000;
          discountedPrice = originalPrice - discount;
          savingsBadge = `Tiết kiệm -${Math.round(discount / 1000)}k`;
        } else {
          discountedPrice = Math.round((originalPrice * 0.85) / 1000) * 1000;
          savingsBadge = `Gộp đơn -15%`;
        }

        cardsHtml += `
          <div class="product-card bg-white rounded-2xl border border-gray-200/90 shadow-xs hover:shadow-md transition overflow-hidden flex flex-col justify-between p-3 sm:p-4">
            <div class="flex gap-2.5 sm:gap-3.5 items-start">
              <!-- Food Image with Fallback -->
              <div class="relative w-20 h-20 sm:w-28 sm:h-28 rounded-xl bg-amber-50/50 p-1 border border-amber-100 flex-shrink-0 overflow-hidden flex items-center justify-center self-start">
                <img src="${product.image || 'images/placeholder.png'}" 
                  alt="${product.name}" 
                  loading="lazy"
                  class="w-full h-full object-contain transform hover:scale-105 transition duration-200"
                  onerror="this.onerror=null; this.src='https://placehold.co/150x150/fffaf0/d71920?text=Jollibee'">
                ${isCombo ? `
                  <span class="absolute top-1 left-1 bg-[#d71920] text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow-xs uppercase tracking-wide">
                    Combo
                  </span>
                ` : ''}
              </div>

              <!-- Product Info -->
              <div class="flex-1 min-w-0">
                <h4 class="font-extrabold text-sm sm:text-base text-gray-900 leading-snug break-words">${product.name}</h4>
                ${formatDescriptionHtml(product.description)}
                <div class="mt-2 space-y-1">
                  <!-- Dòng Giá Gốc Jollibee để tiện so sánh -->
                  <div class="flex items-center gap-1.5 text-xs text-gray-400">
                    <span class="text-[11px] font-medium text-gray-500 whitespace-nowrap">Giá gốc Jollibee:</span>
                    <span class="line-through font-bold text-gray-500 whitespace-nowrap">${formatCurrency(originalPrice)}</span>
                  </div>
                  <!-- Dòng Giá Đặt Hộ qua dịch vụ -->
                  <div class="flex items-baseline gap-1.5 sm:gap-2 flex-wrap">
                    <div class="flex items-baseline gap-1">
                      <span class="text-xs font-extrabold text-[#d71920] whitespace-nowrap">Giá đặt hộ:</span>
                      <span class="text-base sm:text-lg font-black text-red-600 whitespace-nowrap">${formatCurrency(discountedPrice)}</span>
                    </div>
                    <span class="text-[10px] font-black text-green-700 bg-green-50 px-1.5 py-0.5 rounded-md border border-green-200 whitespace-nowrap">
                      ${savingsBadge}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Action Button -->
            <div class="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
              <span class="text-[11px] text-gray-500 font-medium flex items-center gap-1 truncate min-w-0">
                ${isCombo ? `${IconSliders('w-3.5 h-3.5 text-amber-500 flex-shrink-0')} <span class="truncate">Đổi vị, upsize</span>` : `${IconClock('w-3.5 h-3.5 text-green-600 flex-shrink-0')} <span class="truncate">Chuẩn bị nhanh</span>`}
              </span>
              <button type="button" 
                class="btn-select-product ${buttonClass} font-extrabold text-xs sm:text-sm py-2 px-3 sm:px-3.5 rounded-xl active:scale-95 transition flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ml-auto"
                data-id="${product.id}"
                data-is-combo="${isCombo}">
                ${buttonContent}
              </button>
            </div>
          </div>
        `;
      });

      html += `
        <section id="section-${cat.slug}" class="space-y-3 scroll-mt-36">
          <div class="flex items-center justify-between pb-1.5 border-b-2 border-amber-200">
            <h3 class="font-black text-base sm:text-lg text-gray-900 uppercase tracking-tight flex items-center gap-2">
              <span class="w-3 h-3 rounded-full bg-[#d71920]"></span>
              <span>${cat.name}</span>
            </h3>
            <span class="text-xs font-bold text-gray-500">${matchedProducts.length} món</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            ${cardsHtml}
          </div>
        </section>
      `;
    });

    if (totalMatchedProducts === 0) {
      container.innerHTML = `
        <div class="text-center py-16 bg-white rounded-3xl border border-gray-200 shadow-xs">
          <div class="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            ${IconSearch('w-7 h-7')}
          </div>
          <p class="font-bold text-gray-700 text-base">Không tìm thấy món ăn nào phù hợp với từ khóa "${escapeHtml(filterKeyword)}"</p>
          <p class="text-xs text-gray-400 mt-1">Vui lòng thử tìm với từ khóa khác (ví dụ: gà, mì ý, burger, nước)</p>
          <button type="button" id="btn-reset-search" class="mt-4 bg-[#ffc72c] font-bold text-xs px-4 py-2 rounded-xl text-gray-900 shadow-xs">
            Xem Tất Cả Món Ăn
          </button>
        </div>
      `;
      document.getElementById('btn-reset-search')?.addEventListener('click', () => {
        document.getElementById('menu-search-input').value = '';
        this.renderMenuSections();
      });
      return;
    }

    container.innerHTML = html;

    // Gắn sự kiện thêm món / mở modal combo
    container.querySelectorAll('.btn-select-product').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const triggerEl = e.currentTarget;
        const pid = triggerEl.dataset.id;
        const isCombo = triggerEl.dataset.isCombo === 'true';
        this.handleProductClick(pid, isCombo, triggerEl);
      });
    });
  }

  handleProductClick(productId, isCombo, triggerEl = null) {
    if (!this.menuData) return;
    
    // Tìm sản phẩm trong tất cả danh mục
    let product = null;
    for (const cat of this.menuData.categories) {
      product = cat.products.find(p => p.id === productId);
      if (product) break;
    }
    if (!product) return;

    if (isCombo) {
      // Mở modal cấu hình combo
      this.comboModal.open(product, (configuredProduct, selectedOptions) => {
        this.cart.addItem(configuredProduct, selectedOptions, 1);
        this.updateFloatingCart();
        bounceCartBadge(document.getElementById('floating-cart-badge'));
        this.cartDrawer.showToast(`Đã thêm "${product.name}" vào giỏ hàng!`);
      });
    } else {
      // Thêm ngay món đơn
      this.cart.addItem(product, [], 1);
      this.updateFloatingCart();
      const badgeEl = document.getElementById('floating-cart-badge');
      if (triggerEl) {
        flyToCart(triggerEl, badgeEl);
      } else {
        bounceCartBadge(badgeEl);
      }
      this.cartDrawer.showToast(`Đã thêm "${product.name}" vào giỏ!`);
    }
  }

  updateFloatingCart() {
    const totalItems = this.cart.getTotalItemCount();
    const totals = this.cart.getTotals(this.orderType, this.config);
    const freeshipThreshold = this.config.freeshipThreshold || 200000;

    // Kích hoạt pháo hoa chúc mừng khi người dùng vừa đạt mốc Freeship
    if (this.orderType === 'delivery' && this.lastOriginalTotal < freeshipThreshold && totals.originalTotal >= freeshipThreshold) {
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
        hintEl.innerText = this.orderType === 'dinein' ? '(Ăn tại quán • Chưa chọn món)' : '(Giao tận nơi • Chưa chọn món)';
        hintEl.className = 'text-[11px] text-gray-400 font-medium';
      } else if (totals.discountAmount > 0) {
        const modeHint = this.orderType === 'dinein' ? ' • Ăn tại quán' : (totals.shippingFee === 0 ? ' • Freeship' : ' • Phí ship 10k');
        hintEl.innerText = `Đã tiết kiệm -${formatCurrency(totals.discountAmount)}${modeHint}`;
        hintEl.className = 'text-[11px] text-green-600 font-extrabold';
      } else {
        const nextStepThreshold = this.config.discountStep || 100000;
        const needed = nextStepThreshold - totals.originalTotal;
        const modeHint = this.orderType === 'dinein' ? ' (Ăn tại quán)' : '';
        hintEl.innerText = `Cần tối thiểu 100k để đặt hộ${modeHint} (Cần thêm ${formatCurrency(needed)})`;
        hintEl.className = 'text-[11px] text-red-600 font-extrabold';
      }
    }
  }

  bindGlobalEvents() {
    // Chuyển hình thức giao hàng / ăn tại quán ở header
    document.getElementById('top-btn-delivery')?.addEventListener('click', () => {
      this.setOrderType('delivery');
    });
    document.getElementById('top-btn-dinein')?.addEventListener('click', () => {
      this.setOrderType('dinein');
    });

    // Mở drawer giỏ hàng khi bấm vào nút nổi ở footer
    document.getElementById('btn-open-cart-drawer')?.addEventListener('click', () => {
      this.cartDrawer.open();
    });
    document.getElementById('btn-open-cart-info')?.addEventListener('click', () => {
      this.cartDrawer.open();
    });

    // Tìm kiếm món ăn
    const searchInput = document.getElementById('menu-search-input');
    const clearBtn = document.getElementById('clear-search-btn');

    searchInput?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (val) {
        clearBtn?.classList.remove('hidden');
      } else {
        clearBtn?.classList.add('hidden');
      }
      this.renderMenuSections(val);
    });

    clearBtn?.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      this.renderMenuSections('');
    });
  }
}

// Khởi chạy ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
  const app = new JollibeeApp();
  app.init();
});
