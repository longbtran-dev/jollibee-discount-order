/**
 * Thành phần Lightbox xem ảnh món ăn phóng to (Image Modal)
 * Tích hợp ngăn xếp LIFO Modal Stack, Focus Trap & URL ảnh an toàn chống XSS/404.
 */
import { IconX, IconPlus, IconSliders } from '../icons.js';
import { formatCurrency } from '../order-message.js';
import {
  escapeHtml,
  safeImageUrl,
  FALLBACK_FOOD_IMAGE,
  registerOpenModal,
  unregisterOpenModal,
  trapFocusInModal
} from '../utils.js';

export class ImageModal {
  constructor(options = {}) {
    this.containerId = 'image-modal-container';
    this.onActionClick = options.onActionClick || null;
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

  /**
   * Mở modal xem ảnh phóng to
   * @param {object} params
   * @param {string} params.title - Tên món ăn
   * @param {string} params.image - URL hình ảnh
   * @param {number} [params.price] - Giá đặt hộ
   * @param {number} [params.originalPrice] - Giá gốc
   * @param {boolean} [params.isCombo] - Là combo hay món đơn
   * @param {function} [params.onAction] - Callback khi bấm nút đặt món
   */
  open({ title, image, price, originalPrice, isCombo = false, onAction = null }) {
    if (this._isOpen) {
      this.close();
    }

    const container = this.getContainer();
    const formattedTitle = escapeHtml(title || 'Món ăn Jollibee');
    const imgSrc = safeImageUrl(image);
    const hasPrice = price !== undefined && price !== null;

    container.innerHTML = `
      <div id="image-modal-backdrop" class="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-3 sm:p-4 animate-backdrop" role="dialog" aria-modal="true" aria-labelledby="image-modal-title">
        <div id="image-modal-panel" class="relative max-w-sm sm:max-w-md w-full bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-modal-panel transform-gpu will-change-transform border border-gray-100">
          
          <!-- Nút đóng góc phải (chuẩn vùng chạm >= 36px) -->
          <button type="button" id="image-modal-close-btn" class="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/65 hover:bg-black/85 text-white flex items-center justify-center transition shadow-md active:scale-95" aria-label="Đóng xem ảnh" title="Đóng">
            ${IconX('w-4 h-4')}
          </button>

          <!-- Vùng ảnh lớn -->
          <div class="relative w-full bg-gradient-to-b from-amber-50/60 to-white p-4 sm:p-6 flex items-center justify-center min-h-[240px] max-h-[55vh] overflow-hidden">
            <img src="${imgSrc}" alt="${formattedTitle}" 
              class="max-w-full max-h-[50vh] object-contain drop-shadow-md rounded-xl transition duration-300 hover:scale-105"
              onerror="this.onerror=null; this.src='${FALLBACK_FOOD_IMAGE}'">
            ${isCombo ? `
              <span class="absolute top-3 left-3 bg-[#d71920] text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm uppercase tracking-wide">
                Combo
              </span>
            ` : ''}
          </div>

          <!-- Thông tin món & Nút đặt món -->
          <div class="p-4 bg-white border-t border-gray-100 flex items-center justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h3 id="image-modal-title" class="font-black text-sm sm:text-base text-gray-900 leading-snug line-clamp-2">${formattedTitle}</h3>
              ${hasPrice ? `
                <div class="flex items-baseline gap-2 mt-1">
                  <span class="text-base sm:text-lg font-black text-red-600">${formatCurrency(price)}</span>
                  ${originalPrice && originalPrice > price ? `
                    <span class="text-xs text-gray-500 line-through font-semibold">${formatCurrency(originalPrice)}</span>
                  ` : ''}
                </div>
              ` : ''}
            </div>

            ${onAction ? `
              <button type="button" id="image-modal-action-btn" class="${isCombo ? 'bg-[#ffc72c] hover:bg-[#ffbf1a] text-gray-950 border border-amber-300' : 'bg-[#d71920] hover:bg-[#b81218] text-white'} font-extrabold text-xs sm:text-sm py-2.5 px-4 rounded-xl shadow-md active:scale-95 transition flex items-center gap-1.5 flex-shrink-0 whitespace-nowrap">
                ${isCombo ? `${IconSliders('w-3.5 h-3.5')}<span>Tùy Chọn Món</span>` : `${IconPlus('w-3.5 h-3.5')}<span>Thêm Món</span>`}
              </button>
            ` : ''}
          </div>

        </div>
      </div>
    `;

    this._isOpen = true;
    registerOpenModal('image-modal', () => this.close());

    const panelEl = typeof container.querySelector === 'function' ? container.querySelector('#image-modal-panel') : null;
    this._releaseFocusTrap = trapFocusInModal(panelEl || container);

    const closeBtn = document.getElementById('image-modal-close-btn');
    const backdrop = document.getElementById('image-modal-backdrop');
    const actionBtn = document.getElementById('image-modal-action-btn');

    const handleClose = () => this.close();
    closeBtn?.addEventListener('click', handleClose);

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

    if (actionBtn && onAction) {
      actionBtn.addEventListener('click', () => {
        this.close();
        onAction();
      });
    }
  }

  close() {
    if (this._releaseFocusTrap) {
      this._releaseFocusTrap();
      this._releaseFocusTrap = null;
    }
    if (!this._isOpen) return;
    this._isOpen = false;
    const container = document.getElementById(this.containerId);
    if (container) container.innerHTML = '';
    unregisterOpenModal('image-modal');
  }
}
