/**
 * Module phản hồi giao diện tập trung (UI Feedback):
 * - Toast thông báo chuẩn A11y (role="status", aria-live="polite")
 * - Undo Toast kèm nút Hoàn tác
 * - Confirm Dialog & Copy Fallback Modal tích hợp ngăn xếp Modal Stack & Focus Trap
 */
import { escapeHtml, registerOpenModal, unregisterOpenModal, trapFocusInModal } from '../utils.js';
import {
  IconCheck,
  IconCheckCircle,
  IconAlertCircle,
  IconAlertTriangle,
  IconSparkles,
  IconTrash,
  IconCopy,
  IconX,
  IconRotateCcw
} from '../icons.js';

/**
 * Hiển thị thông báo Toast nhỏ gọn, tự đóng và đạt chuẩn A11y
 * @param {string} message
 * @param {'info' | 'success' | 'warning' | 'error'} [type='info']
 */
export function showToast(message, type = 'info') {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
  const existing = document.getElementById('cart-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'cart-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  let iconSvg = IconCheckCircle('w-4 h-4 text-emerald-400');
  let borderClass = 'border-emerald-500/30';
  const bgBadge = 'bg-gray-950/95';

  if (type === 'warning') {
    iconSvg = IconAlertTriangle('w-4 h-4 text-amber-400');
    borderClass = 'border-amber-500/40';
  } else if (type === 'error') {
    iconSvg = IconAlertCircle('w-4 h-4 text-red-400');
    borderClass = 'border-red-500/40';
  } else if (type === 'success') {
    iconSvg = IconCheckCircle('w-4 h-4 text-emerald-400');
    borderClass = 'border-emerald-500/30';
  } else if (type === 'info') {
    iconSvg = IconSparkles('w-4 h-4 text-sky-400');
    borderClass = 'border-sky-500/30';
  }

  toast.className = `fixed top-4 left-1/2 -translate-x-1/2 z-[200] max-w-[92vw] sm:max-w-md ${bgBadge} text-white px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl text-xs sm:text-sm font-semibold shadow-2xl flex items-center gap-2.5 border ${borderClass} backdrop-blur-md animate-toast-in cursor-pointer select-none`;
  toast.innerHTML = `
    <span class="flex-shrink-0 flex items-center">${iconSvg}</span>
    <span class="leading-snug break-words flex-1">${escapeHtml(message)}</span>
  `;
  document.body.appendChild(toast);

  let isDismissed = false;
  const dismiss = () => {
    if (isDismissed) return;
    isDismissed = true;
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-200');
    setTimeout(() => toast.remove(), 200);
  };

  toast.addEventListener('click', dismiss);
  setTimeout(dismiss, 3500);
}

/**
 * Hiển thị Toast kèm nút Hoàn tác (Undo) khi thêm món vào giỏ
 * @param {string} message
 * @param {Function} onUndo
 */
export function showUndoToast(message, onUndo) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;

  const existing = document.getElementById('global-undo-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'global-undo-toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.className = 'fixed top-5 left-1/2 -translate-x-1/2 z-[180] bg-gray-950 text-white font-medium text-xs sm:text-sm px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 animate-toast-in';
  toast.innerHTML = `
    <span class="text-green-400 flex items-center flex-shrink-0">${IconCheck('w-4 h-4')}</span>
    <span class="truncate max-w-[170px] sm:max-w-[260px]">${escapeHtml(message)}</span>
    <button type="button" id="btn-toast-undo" class="ml-1 bg-amber-400 hover:bg-amber-300 text-gray-950 font-black text-xs px-2.5 py-1.5 sm:px-3 sm:py-1.5 rounded-xl flex items-center gap-1 active:scale-95 transition shadow-sm flex-shrink-0">
      ${IconRotateCcw('w-3.5 h-3.5')}
      <span>Hoàn tác</span>
    </button>
  `;
  document.body.appendChild(toast);

  let isDismissed = false;
  const dismiss = () => {
    if (isDismissed) return;
    isDismissed = true;
    toast.classList.add('opacity-0', 'transition-opacity', 'duration-300');
    setTimeout(() => toast.remove(), 300);
  };

  const timer = setTimeout(dismiss, 4000);

  toast.querySelector('#btn-toast-undo')?.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
    if (typeof onUndo === 'function') {
      onUndo();
    }
  });
}

/**
 * Hộp thoại xác nhận nội bộ tích hợp Modal Stack & Focus Trap (thay thế confirm() của trình duyệt)
 */
export function showConfirmDialog({ title, message, confirmText = 'Xác nhận xóa', cancelText = 'Hủy', onConfirm }) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    if (typeof onConfirm === 'function') onConfirm();
    return;
  }

  const existing = document.getElementById('app-confirm-dialog');
  if (existing) {
    unregisterOpenModal('confirm-dialog');
    existing.remove();
  }

  const dialog = document.createElement('div');
  dialog.id = 'app-confirm-dialog';
  dialog.className = 'fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-backdrop';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'confirm-dialog-title');
  dialog.setAttribute('aria-describedby', 'confirm-dialog-desc');

  dialog.innerHTML = `
    <div id="app-confirm-dialog-panel" class="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl space-y-4 border border-gray-100 animate-modal-panel">
      <div class="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shadow-inner">
        ${IconTrash('w-7 h-7')}
      </div>
      <div class="space-y-1.5">
        <h4 id="confirm-dialog-title" class="text-base sm:text-lg font-black text-gray-900">${escapeHtml(title)}</h4>
        <p id="confirm-dialog-desc" class="text-xs sm:text-sm text-gray-600 leading-relaxed">${escapeHtml(message)}</p>
      </div>
      <div class="flex items-center gap-2.5 pt-2">
        <button type="button" id="btn-dialog-cancel" class="flex-1 py-2.5 px-4 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700 font-bold text-xs sm:text-sm transition active:scale-95">
          ${escapeHtml(cancelText)}
        </button>
        <button type="button" id="btn-dialog-confirm" class="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-red-200 transition active:scale-95">
          ${escapeHtml(confirmText)}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);
  const panelEl = dialog.querySelector('#app-confirm-dialog-panel');
  const releaseFocusTrap = trapFocusInModal(panelEl || dialog);

  let isClosed = false;
  const close = () => {
    if (isClosed) return;
    isClosed = true;
    unregisterOpenModal('confirm-dialog');
    releaseFocusTrap();
    dialog.classList.add('opacity-0', 'transition-opacity', 'duration-150');
    setTimeout(() => dialog.remove(), 150);
  };

  registerOpenModal('confirm-dialog', close);

  dialog.querySelector('#btn-dialog-cancel')?.addEventListener('click', close);

  let isMouseDownOnBackdrop = false;
  dialog.addEventListener('mousedown', (e) => {
    isMouseDownOnBackdrop = (e.target === dialog);
  });
  dialog.addEventListener('touchstart', (e) => {
    isMouseDownOnBackdrop = (e.target === dialog);
  }, { passive: true });
  dialog.addEventListener('click', (e) => {
    if (isMouseDownOnBackdrop && e.target === dialog) close();
    isMouseDownOnBackdrop = false;
  });

  dialog.querySelector('#btn-dialog-confirm')?.addEventListener('click', () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  });
}

/**
 * Modal sao chép thủ công tích hợp Modal Stack & Focus Trap (thay thế prompt() của trình duyệt)
 */
export function showCopyFallbackModal(orderText, notifyFn = showToast) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;

  const existing = document.getElementById('app-copy-modal');
  if (existing) {
    unregisterOpenModal('copy-modal');
    existing.remove();
  }

  const modal = document.createElement('div');
  modal.id = 'app-copy-modal';
  modal.className = 'fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-backdrop';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'copy-modal-title');

  modal.innerHTML = `
    <div id="app-copy-modal-panel" class="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-3.5 border border-gray-100 animate-modal-panel">
      <div class="flex items-center justify-between pb-2 border-b border-gray-100">
        <div id="copy-modal-title" class="flex items-center gap-2 text-gray-900 font-extrabold text-sm sm:text-base">
          <span class="text-amber-500 flex items-center">${IconCopy('w-5 h-5')}</span>
          <span>Sao Chép Nội Dung Đơn Hàng</span>
        </div>
        <button type="button" id="btn-close-copy-modal" aria-label="Đóng hộp thoại sao chép" class="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition active:scale-95">
          ${IconX('w-4 h-4')}
        </button>
      </div>
      <p class="text-xs text-gray-600 leading-snug">
        Vui lòng sao chép toàn bộ nội dung bên dưới để gửi qua Zalo hoặc Facebook Messenger:
      </p>
      <textarea id="copy-modal-textarea" aria-label="Nội dung đơn hàng" readonly class="w-full h-48 p-3 text-xs bg-gray-50 border border-gray-200 rounded-xl font-mono text-gray-800 leading-relaxed focus:outline-none focus:ring-2 focus:ring-red-500 select-all resize-none">${escapeHtml(orderText)}</textarea>
      <div class="flex gap-2 pt-1">
        <button type="button" id="btn-select-all-copy" class="flex-1 py-2.5 px-4 bg-[#d71920] hover:bg-[#b81218] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition active:scale-95 flex items-center justify-center gap-1.5">
          ${IconCopy('w-4 h-4')}
          <span>Chọn Tất Cả & Sao Chép</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  const panelEl = modal.querySelector('#app-copy-modal-panel');
  const releaseFocusTrap = trapFocusInModal(panelEl || modal, { autoFocus: false });

  const textarea = modal.querySelector('#copy-modal-textarea');
  if (textarea) {
    setTimeout(() => {
      textarea.focus();
      textarea.select();
    }, 80);
  }

  let isClosed = false;
  const close = () => {
    if (isClosed) return;
    isClosed = true;
    unregisterOpenModal('copy-modal');
    releaseFocusTrap();
    modal.classList.add('opacity-0', 'transition-opacity', 'duration-150');
    setTimeout(() => modal.remove(), 150);
  };

  registerOpenModal('copy-modal', close);

  modal.querySelector('#btn-close-copy-modal')?.addEventListener('click', close);

  let isMouseDownOnBackdrop = false;
  modal.addEventListener('mousedown', (e) => {
    isMouseDownOnBackdrop = (e.target === modal);
  });
  modal.addEventListener('touchstart', (e) => {
    isMouseDownOnBackdrop = (e.target === modal);
  }, { passive: true });
  modal.addEventListener('click', (e) => {
    if (isMouseDownOnBackdrop && e.target === modal) close();
    isMouseDownOnBackdrop = false;
  });

  modal.querySelector('#btn-select-all-copy')?.addEventListener('click', () => {
    if (textarea) {
      textarea.focus();
      textarea.select();
      try {
        document.execCommand('copy');
        if (typeof notifyFn === 'function') notifyFn('Đã sao chép toàn bộ nội dung đơn!', 'success');
      } catch {
        if (typeof notifyFn === 'function') notifyFn('Vui lòng nhấn giữ nội dung và chọn Sao Chép', 'info');
      }
    }
  });
}
