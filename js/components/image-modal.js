/**
 * Thành phần Lightbox xem ảnh món ăn phóng to (Image Modal)
 */
import { IconX, IconPlus, IconSliders, IconZoomIn } from '../icons.js';
import { formatCurrency } from '../order-message.js';
import { escapeHtml, lockBodyScroll, unlockBodyScroll } from '../utils.js';

export class ImageModal {
  constructor(options = {}) {
    this.containerId = 'image-modal-container';
    this.onActionClick = options.onActionClick || null;
    this._escHandler = null;
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
      this.close(); // Dọn dẹp modal cũ nếu đang mở
    }

    const container = this.getContainer();
    const formattedTitle = escapeHtml(title || 'Món ăn Jollibee');
    const imgSrc = image || 'images/placeholder.png';
    const hasPrice = price !== undefined && price !== null;

    container.innerHTML = `
      <div id="image-modal-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="image-modal-title">
        <div class="relative max-w-sm sm:max-w-md w-full bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-200 border border-gray-100">
          
          <!-- Nút đóng góc phải -->
          <button type="button" id="image-modal-close-btn" class="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition shadow-md active:scale-90" aria-label="Đóng" title="Đóng">
            ${IconX('w-4 h-4')}
          </button>

          <!-- Vùng ảnh lớn -->
          <div class="relative w-full bg-gradient-to-b from-amber-50/60 to-white p-4 sm:p-6 flex items-center justify-center min-h-[240px] max-h-[55vh] overflow-hidden">
            <img src="${imgSrc}" alt="${formattedTitle}" 
              class="max-w-full max-h-[50vh] object-contain drop-shadow-md rounded-xl transition duration-300 hover:scale-105"
              onerror="this.onerror=null; this.src='https://placehold.co/400x300/fffaf0/d71920?text=Jollibee'">
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
                    <span class="text-xs text-gray-400 line-through font-semibold">${formatCurrency(originalPrice)}</span>
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
    lockBodyScroll();

    // Gắn sự kiện đóng modal
    const closeBtn = document.getElementById('image-modal-close-btn');
    const backdrop = document.getElementById('image-modal-backdrop');
    const actionBtn = document.getElementById('image-modal-action-btn');

    const handleClose = () => this.close();
    closeBtn?.addEventListener('click', handleClose);
    backdrop?.addEventListener('click', (e) => {
      if (e.target.id === 'image-modal-backdrop') handleClose();
    });

    this._escHandler = (e) => {
      if (e.key === 'Escape') handleClose();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', this._escHandler);
    }

    if (actionBtn && onAction) {
      actionBtn.addEventListener('click', () => {
        this.close();
        onAction();
      });
    }
  }

  close() {
    if (!this._isOpen) return;
    this._isOpen = false;
    const container = document.getElementById(this.containerId);
    if (container) container.innerHTML = '';
    unlockBodyScroll();
    if (this._escHandler && typeof document !== 'undefined') {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  }
}
