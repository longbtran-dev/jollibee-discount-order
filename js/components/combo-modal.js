/**
 * Logic trạng thái và thành phần giao diện Modal tùy chỉnh Combo
 */

import { formatCurrency } from '../order-message.js';
import { IconX, IconChevronDown, IconPlus, IconMinus, IconShoppingBag } from '../icons.js';

/**
 * Khởi tạo bộ quản lý trạng thái chọn option cho Combo
 */
export function createComboState(product) {
  const basePrice = Number(product.base_price !== undefined ? product.base_price : product.price) || 0;
  const groups = product.option_groups || [];
  const selected = {};

  // Chọn mặc định cho từng nhóm theo cấu hình cờ is_default
  groups.forEach(group => {
    if (group.options && group.options.length > 0) {
      const defaultOpt = 
        group.options.find(o => o.is_default) ||
        group.options[0];
      selected[group.group_id] = { ...defaultOpt, group_name: group.group_name };
    }
  });

  return {
    selected,
    selectOption(groupId, option) {
      const group = groups.find(g => g.group_id === groupId);
      const groupName = group ? group.group_name : '';
      selected[groupId] = { ...option, group_name: groupName };
    },
    getTotalPrice() {
      let totalExtra = 0;
      Object.values(selected).forEach(opt => {
        totalExtra += Number(opt.extra_price) || 0;
      });
      return basePrice + totalExtra;
    },
    getSelectedList() {
      return Object.values(selected)
        .filter(opt => {
          if (!opt) return false;
          if (opt.option_id && String(opt.option_id).startsWith('none_')) return false;
          if (opt.name && opt.name.toLowerCase().startsWith('không thêm')) return false;
          return true;
        })
        .map(opt => ({
          group_name: opt.group_name,
          option_id: opt.option_id,
          option_name: opt.name,
          name: opt.name,
          extra_price: Number(opt.extra_price) || 0
        }));
    }
  };
}

/**
 * Hiển thị Modal tùy chỉnh Combo trên giao diện
 */
export class ComboModal {
  constructor(containerId = 'combo-modal-container') {
    this.containerId = containerId;
    this.currentProduct = null;
    this.state = null;
    this.onConfirmCallback = null;
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

  open(product, onConfirm) {
    this.currentProduct = product;
    this.state = createComboState(product);
    this.onConfirmCallback = onConfirm;
    this.render();
  }

  close() {
    const container = this.getContainer();
    container.innerHTML = '';
    document.body.classList.remove('overflow-hidden');
  }

  render() {
    const container = this.getContainer();
    document.body.classList.add('overflow-hidden');

    const product = this.currentProduct;
    const state = this.state;
    const currentPrice = state.getTotalPrice();
    const discount = currentPrice >= 100000
      ? Math.floor(currentPrice / 100000) * 15000
      : Math.round((currentPrice * 0.15) / 1000) * 1000;
    const discountedPrice = Math.max(0, currentPrice - discount);

    let groupsHtml = '';
    (product.option_groups || []).forEach((group, groupIdx) => {
      const isFirst = groupIdx === 0;
      const currentSelected = state.selected[group.group_id];

      let optionsListHtml = '';
      (group.options || []).forEach(opt => {
        const isChecked = currentSelected && currentSelected.option_id === opt.option_id;
        const isNone = (opt.option_id && String(opt.option_id).startsWith('none_')) || opt.name.toLowerCase().includes('không thêm');
        
        const extraLabel = isNone
          ? `<span class="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">+0 đ</span>`
          : (opt.extra_price > 0 ? `<span class="text-sm font-bold text-red-600">+${formatCurrency(opt.extra_price)}</span>` : '');

        const iconHtml = isNone
          ? `<div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 font-bold border border-gray-200 flex-shrink-0">${IconMinus('w-5 h-5')}</div>`
          : (opt.image
              ? `<img src="${opt.image}" alt="${opt.name}" class="w-12 h-12 object-contain rounded bg-white p-1 border border-amber-100 flex-shrink-0" onerror="this.style.display='none'">`
              : `<div class="w-12 h-12 rounded bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-100 flex-shrink-0">${IconShoppingBag('w-6 h-6')}</div>`);

        optionsListHtml += `
          <label class="flex items-center justify-between p-3.5 border-b border-amber-100/60 last:border-b-0 cursor-pointer hover:bg-amber-50/60 transition ${isChecked ? 'bg-amber-50/80 font-medium' : ''}">
            <div class="flex items-center gap-3">
              ${iconHtml}
              <div class="flex flex-col">
                <span class="text-sm sm:text-base text-gray-800 ${isNone ? 'font-semibold text-gray-700' : ''}">${opt.name}</span>
                ${isNone ? `<span class="text-[11px] text-gray-400">Không chọn thêm món phụ cho phần này</span>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
              ${extraLabel}
              <input type="radio" name="opt_group_${group.group_id}" value="${opt.option_id}" 
                class="w-5 h-5 text-red-600 focus:ring-red-500 border-gray-300"
                ${isChecked ? 'checked' : ''}
                data-group-id="${group.group_id}"
                data-option-id="${opt.option_id}">
            </div>
          </label>
        `;
      });

      groupsHtml += `
        <div class="mb-3 rounded-xl overflow-hidden border border-amber-200/80 bg-white shadow-sm">
          <button type="button" class="w-full bg-[#ffc72c] hover:bg-[#ffbf1a] text-gray-900 font-extrabold px-4 py-3 flex items-center justify-between text-left text-sm uppercase tracking-wide group-accordion-btn transition select-none" data-target="group-body-${group.group_id}">
            <div class="flex items-center gap-2 min-w-0 pr-2">
              <span class="w-2 h-2 rounded-full bg-red-600 flex-shrink-0"></span>
              <span class="truncate">${group.group_name}</span>
              <span class="text-[11px] font-bold text-gray-800 bg-white/80 px-2 py-0.5 rounded-full border border-amber-300 truncate max-w-[130px] sm:max-w-[180px] group-current-badge-${group.group_id}">
                ${currentSelected ? currentSelected.name : ''}
              </span>
            </div>
            <span class="transform transition-transform group-arrow ${isFirst ? 'rotate-180' : ''} flex items-center">${IconChevronDown('w-4 h-4')}</span>
          </button>
          <div id="group-body-${group.group_id}" class="group-options-body ${isFirst ? 'block' : 'hidden'} bg-amber-50/20">
            ${optionsListHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs transition-opacity" id="combo-modal-backdrop">
        <div class="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
          
          <!-- Modal Header -->
          <div class="flex items-center justify-between p-4 bg-[#d71920] text-white">
            <h3 class="font-extrabold text-base sm:text-lg line-clamp-1">${product.name}</h3>
            <button type="button" id="combo-modal-close-btn" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition">${IconX('w-4 h-4')}</button>
          </div>

          <!-- Product Summary -->
          <div class="p-4 bg-amber-50/40 border-b border-amber-100 flex items-center gap-3">
            ${product.image ? `<img src="${product.image}" alt="${product.name}" class="w-16 h-16 object-contain rounded-lg bg-white p-1 border border-amber-200 shadow-xs flex-shrink-0" onerror="this.style.display='none'">` : ''}
            <div>
              <p class="text-xs text-gray-500 line-clamp-2">${product.description || 'Tùy chọn từng món ăn và nước ngọt theo sở thích của bạn'}</p>
              <p class="text-xs text-red-600 font-semibold mt-1">Giá combo: <span id="combo-modal-top-price">${formatCurrency(currentPrice)}</span></p>
            </div>
          </div>

          <!-- Options Scroll Area -->
          <div class="p-4 overflow-y-auto flex-1 overscroll-contain">
            ${groupsHtml}
          </div>

          <!-- Modal Footer Sticky -->
          <div class="p-4 bg-white border-t border-gray-100 shadow-lg flex items-center justify-between gap-4">
            <div>
              <div class="text-[11px] text-gray-400">
                <span>Giá gốc Jollibee: </span>
                <span id="combo-modal-orig-price" class="line-through font-bold text-gray-500">${formatCurrency(currentPrice)}</span>
              </div>
              <div class="flex items-baseline gap-1 mt-0.5">
                <span class="text-xs font-bold text-red-600">Đặt hộ:</span>
                <span class="text-lg sm:text-xl font-black text-red-600" id="combo-modal-price">
                  ${formatCurrency(discountedPrice)}
                </span>
              </div>
            </div>
            <button type="button" id="combo-modal-confirm-btn" class="flex-1 bg-[#d71920] hover:bg-[#b81218] text-white font-extrabold py-3.5 px-6 rounded-xl shadow-md active:scale-98 transition flex items-center justify-center gap-2">
              ${IconPlus('w-4 h-4')}
              <span>Thêm Vào Giỏ</span>
            </button>
          </div>

        </div>
      </div>
    `;

    // Gắn sự kiện đóng/mở Accordion
    container.querySelectorAll('.group-accordion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const bodyEl = document.getElementById(targetId);
        const arrowEl = btn.querySelector('.group-arrow');
        if (bodyEl) {
          const isHidden = bodyEl.classList.contains('hidden');
          if (isHidden) {
            bodyEl.classList.remove('hidden');
            bodyEl.classList.add('block');
            arrowEl?.classList.add('rotate-180');
          } else {
            bodyEl.classList.remove('block');
            bodyEl.classList.add('hidden');
            arrowEl?.classList.remove('rotate-180');
          }
        }
      });
    });

    // Gắn sự kiện radio change
    const radioInputs = container.querySelectorAll('input[type="radio"]');
    radioInputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const groupId = e.target.dataset.groupId;
        const optId = e.target.dataset.optionId;
        const group = (product.option_groups || []).find(g => g.group_id === groupId);
        if (group) {
          const opt = group.options.find(o => o.option_id === optId);
          if (opt) {
            state.selectOption(groupId, opt);
            // Cập nhật giá hiển thị tức thì
            const price = state.getTotalPrice();
            const disc = price >= 100000
              ? Math.floor(price / 100000) * 15000
              : Math.round((price * 0.15) / 1000) * 1000;
            const finalEst = Math.max(0, price - disc);

            const origEl = document.getElementById('combo-modal-orig-price');
            if (origEl) origEl.innerText = formatCurrency(price);
            const priceEl = document.getElementById('combo-modal-price');
            if (priceEl) priceEl.innerText = formatCurrency(finalEst);
            const topPriceEl = document.getElementById('combo-modal-top-price');
            if (topPriceEl) topPriceEl.innerText = formatCurrency(price);

            // Cập nhật nhãn badge hiển thị lựa chọn hiện tại ở thanh accordion
            const badgeEl = container.querySelector(`.group-current-badge-${groupId}`);
            if (badgeEl) badgeEl.innerText = opt.name;

            // Cập nhật highlight nền vàng cho label vừa chọn
            const groupBody = input.closest('.group-options-body');
            if (groupBody) {
              groupBody.querySelectorAll('label').forEach(lbl => {
                lbl.classList.remove('bg-amber-50/80', 'font-medium');
              });
              const currentLabel = input.closest('label');
              if (currentLabel) {
                currentLabel.classList.add('bg-amber-50/80', 'font-medium');
              }
            }
          }
        }
      });
    });

    // Sự kiện đóng modal
    document.getElementById('combo-modal-close-btn')?.addEventListener('click', () => this.close());
    document.getElementById('combo-modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'combo-modal-backdrop') this.close();
    });

    // Sự kiện xác nhận thêm giỏ
    document.getElementById('combo-modal-confirm-btn')?.addEventListener('click', () => {
      if (typeof this.onConfirmCallback === 'function') {
        this.onConfirmCallback(product, state.getSelectedList());
      }
      this.close();
    });
  }
}
