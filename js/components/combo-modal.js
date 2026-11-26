/**
 * Logic trạng thái và thành phần giao diện Modal tùy chỉnh Combo
 * Hỗ trợ Modal Stack LIFO, Focus Trap, A11y Accordion & nạp lại cấu hình khi Đổi món trong giỏ.
 */

import { formatCurrency } from '../order-message.js';
import { IconX, IconChevronDown, IconPlus, IconMinus, IconShoppingBag, IconCheck } from '../icons.js';
import {
  formatDescriptionHtml,
  escapeHtml,
  safeImageUrl,
  FALLBACK_FOOD_IMAGE,
  registerOpenModal,
  unregisterOpenModal,
  trapFocusInModal
} from '../utils.js';

/**
 * Khởi tạo bộ quản lý trạng thái chọn option cho Combo
 * @param {object} product
 * @param {Array|null} [initialSelectedOptions=null] - Danh sách option đã chọn trước đó (khi sửa Combo trong giỏ)
 */
export function createComboState(product, initialSelectedOptions = null) {
  const basePrice = Number(product.base_price !== undefined ? product.base_price : product.price) || 0;
  const groups = product.option_groups || [];
  const selected = {};
  const usedPresetIndices = new Set();

  groups.forEach(group => {
    if (group.options && group.options.length > 0) {
      let chosenOpt = null;

      // Nếu truyền vào danh sách option đã lưu trước đó -> ưu tiên khôi phục đúng lựa chọn của khách
      if (Array.isArray(initialSelectedOptions) && initialSelectedOptions.length > 0) {
        const presetIdx = initialSelectedOptions.findIndex((preset, idx) => {
          if (usedPresetIndices.has(idx) || !preset) return false;
          const groupMatches =
            (preset.group_id && String(preset.group_id) === String(group.group_id)) ||
            (!preset.group_id && preset.group_name && preset.group_name === group.group_name);
          if (!groupMatches && preset.group_name && preset.group_name !== group.group_name) return false;

          return group.options.some(
            o =>
              (preset.option_id && String(o.option_id) === String(preset.option_id)) ||
              (preset.option_name && o.name === preset.option_name)
          );
        });

        if (presetIdx !== -1) {
          usedPresetIndices.add(presetIdx);
          const preset = initialSelectedOptions[presetIdx];
          chosenOpt = group.options.find(
            o =>
              (preset.option_id && String(o.option_id) === String(preset.option_id)) ||
              (preset.option_name && o.name === preset.option_name)
          );
        }
      }

      if (!chosenOpt) {
        chosenOpt = group.options.find(o => o.is_default) || group.options[0];
      }

      selected[group.group_id] = {
        ...chosenOpt,
        group_id: group.group_id,
        group_name: group.group_name
      };
    }
  });

  return {
    selected,
    selectOption(groupId, option) {
      const group = groups.find(g => String(g.group_id) === String(groupId));
      const groupName = group ? group.group_name : '';
      selected[groupId] = { ...option, group_id: groupId, group_name: groupName };
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
          group_id: opt.group_id,
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
  constructor(containerId = 'combo-modal-container', imageModal = null) {
    this.containerId = containerId;
    this.imageModal = imageModal;
    this.currentProduct = null;
    this.state = null;
    this.onConfirmCallback = null;
    this.submitLabel = 'Thêm Vào Giỏ';
    this.isEditing = false;
    this._releaseFocusTrap = null;
    this._isOpen = false;
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

  open(product, onConfirm, options = {}) {
    if (this._isOpen) {
      this.close();
    }
    this.currentProduct = product;
    this.state = createComboState(product, options.initialSelectedOptions || null);
    this.onConfirmCallback = onConfirm;
    this.submitLabel = options.submitLabel || 'Thêm Vào Giỏ';
    this.isEditing = Boolean(options.initialSelectedOptions);
    this._isOpen = true;
    registerOpenModal('combo-modal', () => this.close());
    this.render();
  }

  close() {
    if (this._releaseFocusTrap) {
      this._releaseFocusTrap();
      this._releaseFocusTrap = null;
    }
    if (!this._isOpen) return;
    this._isOpen = false;
    const container = this.getContainer();
    container.innerHTML = '';
    unregisterOpenModal('combo-modal');
  }

  _getComboDiscountNoteHtml(price) {
    if (price >= 100000) {
      const disc = Math.floor(price / 100000) * 15000;
      return `<span class="text-green-700">🔥 Combo này được giảm ngay ${formatCurrency(disc)} khi chốt đơn!</span>`;
    }
    return `<span class="text-amber-800">Đơn từ 100k giảm ngay 15.000đ</span>`;
  }

  render() {
    const container = this.getContainer();

    const product = this.currentProduct;
    const state = this.state;
    const currentPrice = state.getTotalPrice();

    let groupsHtml = '';
    (product.option_groups || []).forEach((group, groupIdx) => {
      const isFirst = groupIdx === 0;
      const currentSelected = state.selected[group.group_id];
      const safeDomGroupId = `combo-group-body-${groupIdx}`;
      const escapedGroupId = escapeHtml(group.group_id);

      let optionsListHtml = '';
      (group.options || []).forEach(opt => {
        const isChecked = currentSelected && String(currentSelected.option_id) === String(opt.option_id);
        const isNone = (opt.option_id && String(opt.option_id).startsWith('none_')) || opt.name.toLowerCase().includes('không thêm');

        const extraLabel = isNone
          ? `<span class="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">+0 đ</span>`
          : (opt.extra_price > 0 ? `<span class="text-sm font-bold text-red-600">+${formatCurrency(opt.extra_price)}</span>` : '');

        const iconHtml = isNone
          ? `<div class="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-500 font-bold border border-gray-200 flex-shrink-0">${IconMinus('w-5 h-5')}</div>`
          : (opt.image
              ? `<img src="${safeImageUrl(opt.image)}" alt="${escapeHtml(opt.name)}" width="48" height="48" loading="lazy" decoding="async" class="w-12 h-12 object-contain rounded bg-white p-1 border border-amber-100 flex-shrink-0" onerror="this.onerror=null; this.src='${FALLBACK_FOOD_IMAGE}'">`
              : `<div class="w-12 h-12 rounded bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-100 flex-shrink-0">${IconShoppingBag('w-6 h-6')}</div>`);

        optionsListHtml += `
          <label class="flex items-center justify-between p-3.5 border-b border-amber-100/60 last:border-b-0 cursor-pointer hover:bg-amber-50/60 transition ${isChecked ? 'bg-amber-50/80 font-medium' : ''}">
            <div class="flex items-center gap-3 min-w-0 pr-2">
              ${iconHtml}
              <div class="flex flex-col min-w-0">
                <span class="text-sm sm:text-base text-gray-800 break-words ${isNone ? 'font-semibold text-gray-700' : ''}">${escapeHtml(opt.name)}</span>
                ${isNone ? `<span class="text-[11px] text-gray-500">Giữ nguyên theo combo chuẩn (không gọi thêm)</span>` : ''}
              </div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0">
              ${extraLabel}
              <input type="radio" name="opt_group_${groupIdx}" value="${escapeHtml(opt.option_id)}" 
                class="w-5 h-5 text-red-600 focus:ring-red-500 border-gray-300"
                ${isChecked ? 'checked' : ''}
                data-group-id="${escapedGroupId}"
                data-option-id="${escapeHtml(opt.option_id)}">
            </div>
          </label>
        `;
      });

      groupsHtml += `
        <div class="mb-3 rounded-xl overflow-hidden border border-amber-200/80 bg-white shadow-sm">
          <button type="button"
            class="w-full bg-[#ffc72c] hover:bg-[#ffbf1a] text-gray-900 font-extrabold px-4 py-3 flex items-center justify-between text-left text-sm uppercase tracking-wide group-accordion-btn transition select-none"
            data-target="${safeDomGroupId}"
            aria-expanded="${isFirst ? 'true' : 'false'}"
            aria-controls="${safeDomGroupId}">
            <div class="flex items-center gap-2 min-w-0 pr-2">
              <span class="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" aria-hidden="true"></span>
              <span class="truncate">${escapeHtml(group.group_name)}</span>
              <span class="text-[11px] font-bold text-gray-800 bg-white/85 px-2 py-0.5 rounded-full border border-amber-300 truncate max-w-[130px] sm:max-w-[180px]" data-badge-for="${escapedGroupId}">
                ${currentSelected ? escapeHtml(currentSelected.name) : ''}
              </span>
            </div>
            <span class="transform transition-transform group-arrow ${isFirst ? 'rotate-180' : ''} flex items-center">${IconChevronDown('w-4 h-4')}</span>
          </button>
          <div id="${safeDomGroupId}" class="group-options-body ${isFirst ? 'block' : 'hidden'} bg-amber-50/20">
            ${optionsListHtml}
          </div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 animate-backdrop" id="combo-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="combo-modal-title">
        <div id="combo-modal-panel" class="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-modal-panel transform-gpu will-change-transform">
          
          <!-- Modal Header -->
          <div class="flex items-center justify-between p-3.5 sm:p-4 bg-[#d71920] text-white">
            <h3 id="combo-modal-title" class="font-extrabold text-sm sm:text-lg line-clamp-1 pr-2">${escapeHtml(product.name)}</h3>
            <button type="button" id="combo-modal-close-btn" class="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition flex-shrink-0 active:scale-95" aria-label="Đóng tùy chọn combo">${IconX('w-4 h-4')}</button>
          </div>

          <!-- Product Summary -->
          <div class="p-3 sm:p-4 bg-amber-50/40 border-b border-amber-100 flex items-start gap-3">
            ${product.image ? `
              <button type="button" id="combo-modal-image-preview-btn" class="cursor-zoom-in relative group flex-shrink-0 focus:outline-none active:scale-95 transition" aria-label="Xem ảnh phóng to ${escapeHtml(product.name)}" title="Nhấn để xem ảnh phóng to">
                <img src="${safeImageUrl(product.image)}" alt="${escapeHtml(product.name)}" width="80" height="80" class="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-lg bg-white p-1 border border-amber-200 shadow-sm transform group-hover:scale-105 transition" onerror="this.onerror=null; this.src='${FALLBACK_FOOD_IMAGE}'">
              </button>
            ` : ''}
            <div class="flex-1 min-w-0">
              <div class="text-xs text-red-700 font-semibold mb-0.5">Giá combo: <span id="combo-modal-top-price" class="font-bold">${formatCurrency(currentPrice)}</span></div>
              ${formatDescriptionHtml(product.description)}
            </div>
          </div>

          <!-- Options Scroll Area -->
          <div class="p-3 sm:p-4 overflow-y-auto flex-1 overscroll-contain">
            ${groupsHtml}
          </div>

          <!-- Modal Footer Sticky -->
          <div class="p-3 sm:p-4 bg-white border-t border-gray-100 shadow-lg flex items-center justify-between gap-3">
            <div class="flex-shrink-0">
              <div class="text-[10px] sm:text-[11px] text-gray-600">
                <span>Giá combo đã chọn:</span>
              </div>
              <div class="flex items-baseline gap-1 mt-0.5">
                <span class="text-base sm:text-xl font-black text-red-600" id="combo-modal-price">
                  ${formatCurrency(currentPrice)}
                </span>
              </div>
              <div class="text-[10px] font-bold" id="combo-modal-discount-note">
                ${this._getComboDiscountNoteHtml(currentPrice)}
              </div>
            </div>
            <button type="button" id="combo-modal-confirm-btn" class="flex-1 bg-[#d71920] hover:bg-[#b81218] text-white font-extrabold py-3 px-4 sm:px-6 rounded-xl shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 text-xs sm:text-sm whitespace-nowrap">
              ${this.isEditing ? IconCheck('w-4 h-4') : IconPlus('w-4 h-4')}
              <span>${escapeHtml(this.submitLabel)}</span>
            </button>
          </div>

        </div>
      </div>
    `;

    const panelEl = typeof container.querySelector === 'function' ? container.querySelector('#combo-modal-panel') : null;
    this._releaseFocusTrap = trapFocusInModal(panelEl || container);

    // Gắn sự kiện đóng/mở Accordion kèm cập nhật aria-expanded
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
            btn.setAttribute('aria-expanded', 'true');
          } else {
            bodyEl.classList.remove('block');
            bodyEl.classList.add('hidden');
            arrowEl?.classList.remove('rotate-180');
            btn.setAttribute('aria-expanded', 'false');
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
        const group = (product.option_groups || []).find(g => String(g.group_id) === String(groupId));
        if (group) {
          const opt = group.options.find(o => String(o.option_id) === String(optId));
          if (opt) {
            state.selectOption(group.group_id, opt);
            const price = state.getTotalPrice();

            const priceEl = document.getElementById('combo-modal-price');
            if (priceEl) priceEl.innerText = formatCurrency(price);
            const topPriceEl = document.getElementById('combo-modal-top-price');
            if (topPriceEl) topPriceEl.innerText = formatCurrency(price);
            const noteEl = document.getElementById('combo-modal-discount-note');
            if (noteEl) noteEl.innerHTML = this._getComboDiscountNoteHtml(price);

            // Truy vấn badge an toàn qua dataset (không bao giờ ném DOMException kể cả khi group_id có ký tự đặc biệt)
            const badgeEl = Array.from(container.querySelectorAll('[data-badge-for]')).find(
              el => el.dataset.badgeFor === String(group.group_id)
            );
            if (badgeEl) badgeEl.innerText = opt.name;

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

    // Sự kiện xem ảnh phóng to trong modal
    document.getElementById('combo-modal-image-preview-btn')?.addEventListener('click', () => {
      if (this.imageModal && product.image) {
        this.imageModal.open({
          title: product.name,
          image: product.image,
          price: state.getTotalPrice(),
          originalPrice: product.price,
          isCombo: true
        });
      }
    });

    // Đóng modal an toàn
    const handleClose = () => this.close();
    document.getElementById('combo-modal-close-btn')?.addEventListener('click', handleClose);

    const backdrop = document.getElementById('combo-modal-backdrop');
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

    // Sự kiện xác nhận thêm / cập nhật giỏ
    document.getElementById('combo-modal-confirm-btn')?.addEventListener('click', () => {
      if (typeof this.onConfirmCallback === 'function') {
        this.onConfirmCallback(product, state.getSelectedList());
      }
      this.close();
    });
  }
}
