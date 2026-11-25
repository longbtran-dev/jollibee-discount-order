/**
 * Các hàm tiện ích hỗ trợ an toàn, A11y và tương thích trình duyệt
 */

/**
 * Ảnh dự phòng SVG nội tuyến siêu nhẹ (0 HTTP request, không bao giờ 404 hay phụ thuộc domain bên thứ 3)
 */
export const FALLBACK_FOOD_IMAGE =
  "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' rx='20' fill='%23fffaf0'/%3E%3Ctext x='50%25' y='52%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-weight='800' font-size='16' fill='%23d71920'%3EJollibee%3C/text%3E%3C/svg%3E";

/**
 * Mã hóa an toàn chuỗi văn bản chống tấn công XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, match => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
}

/**
 * Kiểm tra & làm sạch URL ảnh an toàn (chặn javascript: URI và thay thế khi rỗng)
 * @param {string} url
 * @returns {string}
 */
export function safeImageUrl(url) {
  if (!url || typeof url !== 'string') return FALLBACK_FOOD_IMAGE;
  const trimmed = url.trim();
  if (!trimmed) return FALLBACK_FOOD_IMAGE;
  if (/^(javascript:|vbscript:|data:(?!image\/))/i.test(trimmed)) {
    return FALLBACK_FOOD_IMAGE;
  }
  return escapeHtml(trimmed);
}

/**
 * Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, chuyển đ -> d, quy đồng mỳ/mì phục vụ tìm kiếm thông minh
 * @param {string} str
 * @returns {string}
 */
export function normalizeVietnamese(str) {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/\bmy\b/g, 'mi')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Kiểm tra cài đặt giảm chuyển động (prefers-reduced-motion) của hệ điều hành
 * @returns {boolean}
 */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return Boolean(window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

/**
 * Kiểm tra định dạng số điện thoại di động Việt Nam (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09)
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidVietnamesePhone(phone) {
  if (!phone) return false;
  const cleanPhone = String(phone).replace(/\s+/g, '');
  return /^(0)(3|5|7|8|9)[0-9]{8}$/.test(cleanPhone);
}

/**
 * Hàm hạn chế tần suất gọi hàm (Debounce)
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export function debounce(fn, delay = 200) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, delay);
  };
}

// ============================================================================
// Quản lý tập trung ngăn xếp Modal (LIFO Modal Stack) & Khóa cuộn Body an toàn
// ============================================================================
let activeModalCount = 0;
const openModalStack = []; // [{ id: string, onEscape: Function }]
let boundEscDoc = null;

function syncBodyOverflowClass() {
  if (typeof document === 'undefined' || !document.body || !document.body.classList) return;
  if (activeModalCount + openModalStack.length > 0) {
    document.body.classList.add('overflow-hidden');
  } else {
    document.body.classList.remove('overflow-hidden');
  }
}

function handleGlobalEscape(e) {
  if (!e || e.key !== 'Escape' || openModalStack.length === 0) return;
  if (typeof e.preventDefault === 'function') e.preventDefault();
  if (typeof e.stopPropagation === 'function') e.stopPropagation();

  const topModal = openModalStack[openModalStack.length - 1];
  if (topModal && typeof topModal.onEscape === 'function') {
    topModal.onEscape();
  }
}

/**
 * Đăng ký một Modal vào ngăn xếp LIFO theo định danh duy nhất (chống cộng dồn khi chạm đúp)
 * và đảm bảo nhấn phím Escape chỉ đóng đúng Modal đang nằm trên đỉnh.
 * @param {string} id
 * @param {Function} [onEscape]
 */
export function registerOpenModal(id, onEscape) {
  if (!id) return;
  const existingIdx = openModalStack.findIndex(m => m.id === id);
  if (existingIdx !== -1) {
    openModalStack.splice(existingIdx, 1);
  }
  openModalStack.push({ id, onEscape });

  syncBodyOverflowClass();

  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function' && boundEscDoc !== document) {
    if (boundEscDoc && typeof boundEscDoc.removeEventListener === 'function') {
      boundEscDoc.removeEventListener('keydown', handleGlobalEscape);
    }
    document.addEventListener('keydown', handleGlobalEscape);
    boundEscDoc = document;
  }
}

/**
 * Hủy đăng ký Modal khỏi ngăn xếp và chỉ mở lại cuộn trang khi toàn bộ Modal đã đóng
 * @param {string} id
 */
export function unregisterOpenModal(id) {
  const idx = openModalStack.findIndex(m => m.id === id);
  if (idx !== -1) {
    openModalStack.splice(idx, 1);
  }
  syncBodyOverflowClass();
}

/**
 * Khóa cuộn trang Body an toàn theo bộ đếm modal mở
 */
export function lockBodyScroll() {
  activeModalCount++;
  syncBodyOverflowClass();
}

/**
 * Mở khóa cuộn trang Body chỉ khi không còn bất kỳ modal nào active
 */
export function unlockBodyScroll() {
  activeModalCount = Math.max(0, activeModalCount - 1);
  syncBodyOverflowClass();
}

/**
 * Lấy tổng số lượng modal đang mở hiện tại
 */
export function getActiveModalCount() {
  return activeModalCount + openModalStack.length;
}

/**
 * Reset bộ đếm & ngăn xếp modal (hỗ trợ kiểm thử cô lập)
 */
export function resetActiveModalCount() {
  activeModalCount = 0;
  openModalStack.length = 0;
  if (boundEscDoc && typeof boundEscDoc.removeEventListener === 'function') {
    boundEscDoc.removeEventListener('keydown', handleGlobalEscape);
  }
  boundEscDoc = null;
}

/**
 * Tiện ích bẫy tiêu điểm bàn phím (Focus Trap) bên trong Modal/Drawer và khôi phục Focus khi đóng
 * @param {HTMLElement} modalEl
 * @param {object} [options]
 * @param {boolean} [options.autoFocus=true]
 * @returns {Function} Hàm dọn dẹp & trả lại Focus ban đầu
 */
export function trapFocusInModal(modalEl, { autoFocus = true } = {}) {
  if (
    typeof document === 'undefined' ||
    !modalEl ||
    typeof modalEl.querySelectorAll !== 'function' ||
    typeof modalEl.addEventListener !== 'function'
  ) {
    return () => {};
  }

  const previousFocused = document.activeElement;
  const focusableSelector =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const getFocusable = () =>
    Array.from(modalEl.querySelectorAll(focusableSelector)).filter(el => {
      if (el.offsetParent !== null) return true;
      if (typeof el.getClientRects === 'function' && el.getClientRects().length > 0) return true;
      return false;
    });

  if (autoFocus) {
    const initialList = getFocusable();
    if (initialList.length > 0 && typeof initialList[0].focus === 'function') {
      initialList[0].focus();
    }
  }

  const onKeyDown = (e) => {
    if (!e || e.key !== 'Tab') return;
    const focusables = getFocusable();
    if (focusables.length === 0) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof last.focus === 'function') last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof first.focus === 'function') first.focus();
    }
  };

  modalEl.addEventListener('keydown', onKeyDown);

  return () => {
    if (typeof modalEl.removeEventListener === 'function') {
      modalEl.removeEventListener('keydown', onKeyDown);
    }
    if (previousFocused && typeof previousFocused.focus === 'function') {
      try {
        previousFocused.focus();
      } catch {
        // Bỏ qua nếu phần tử gốc không còn trong DOM
      }
    }
  };
}

/**
 * Sao chép văn bản vào bộ nhớ tạm với cơ chế Fallback tương thích unsecure HTTP
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && (typeof window === 'undefined' || window.isSecureContext)) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard thất bại, chuyển sang fallback:', err);
    }
  }

  // Fallback qua textarea và document.execCommand
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return false;
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('execCommand copy thất bại:', err);
    return false;
  }
}

/**
 * Định dạng mô tả món ăn / combo: nếu có chứa dấu "+" thì tự động tách thành danh sách từng món xuống dòng rõ ràng
 * @param {string} description
 * @returns {string} Chuỗi HTML hiển thị
 */
export function formatDescriptionHtml(description) {
  if (!description) {
    return `<p class="text-xs text-gray-500 mt-1 leading-relaxed">Hương vị giòn rụm thơm ngon đặc trưng của Jollibee</p>`;
  }

  if (description.includes('+')) {
    const parts = description.split('+').map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      const itemsHtml = parts.map(part => `
        <li class="flex items-start gap-1.5 text-xs text-gray-800 font-semibold leading-snug">
          <span class="text-[#d71920] font-black text-xs leading-none mt-0.5" aria-hidden="true">•</span>
          <span class="break-words">${escapeHtml(part)}</span>
        </li>
      `).join('');

      return `
        <div class="mt-1.5 p-2 sm:p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/60 shadow-sm">
          <div class="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[#d71920] flex-shrink-0" aria-hidden="true"></span>
            <span>Combo bao gồm:</span>
          </div>
          <ul class="space-y-1">
            ${itemsHtml}
          </ul>
        </div>
      `;
    }
  }

  return `<p class="text-xs text-gray-500 mt-1 leading-relaxed">${escapeHtml(description)}</p>`;
}
