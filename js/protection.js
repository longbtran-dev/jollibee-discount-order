/**
 * Lớp bảo vệ giao diện & chống mở công cụ kiểm tra mã nguồn (F12 / View Source / Chuột phải / Kéo ảnh)
 * - Chặn F12, Ctrl+Shift+I/J/C/K (Cmd+Option+I/J/C/K), Ctrl+U, Ctrl+S
 * - Chặn chuột phải (contextmenu) ngoài vùng nhập liệu, nhưng GIỮ NGUYÊN chuột phải/nhấn giữ Dán (Paste) trong <input> và <textarea> để khách điền SĐT & địa chỉ thuận tiện
 * - Chặn kéo thả lưu ảnh món ăn (dragstart)
 * - Cho phép chủ shop tắt nhanh bằng enableContentProtection: false trong config.js khi cần tự kiểm tra
 */

let activeCleanup = null;

function isEditableElement(target) {
  if (!target || typeof target !== 'object') return false;
  if (typeof target.closest === 'function') {
    return Boolean(target.closest('input, textarea, [contenteditable="true"]'));
  }
  const tag = String(target.tagName || '').toUpperCase();
  return tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable === true;
}

/**
 * Kiểm tra sự kiện bàn phím có phải tổ hợp mở DevTools / Xem mã nguồn / Lưu trang hay không
 * @param {KeyboardEvent} e
 * @returns {boolean}
 */
export function isBlockedShortcut(e) {
  if (!e) return false;
  const key = String(e.key || '').toUpperCase();
  const keyCode = Number(e.keyCode || 0);

  // Phím F12
  if (key === 'F12' || keyCode === 123) return true;

  const ctrlOrCmd = Boolean(e.ctrlKey || e.metaKey);
  const shiftOrAlt = Boolean(e.shiftKey || (e.metaKey && e.altKey));

  // Ctrl+Shift+I / J / C / K hoặc Cmd+Option+I / J / C / K (Inspect, Console, Element Picker)
  if (ctrlOrCmd && shiftOrAlt && (key === 'I' || key === 'J' || key === 'C' || key === 'K')) {
    return true;
  }

  // Ctrl+U / Cmd+Option+U (View Source) và Ctrl+S / Cmd+S (Save Webpage)
  if (ctrlOrCmd && !e.shiftKey && (key === 'U' || key === 'S')) {
    return true;
  }
  if (e.metaKey && e.altKey && key === 'U') {
    return true;
  }

  return false;
}

/**
 * Kích hoạt bảo vệ chống F12 & chuột phải trên toàn trang
 * @param {object} [config={}]
 * @returns {{ destroy: () => void }}
 */
export function initContentProtection(config = {}) {
  if (activeCleanup) {
    activeCleanup();
    activeCleanup = null;
  }

  if (config && config.enableContentProtection === false) {
    return { destroy() {} };
  }

  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    return { destroy() {} };
  }

  const onKeyDown = (e) => {
    if (isBlockedShortcut(e)) {
      e.preventDefault?.();
      e.stopPropagation?.();
      return false;
    }
  };

  const onContextMenu = (e) => {
    if (isEditableElement(e?.target)) return;
    e?.preventDefault?.();
  };

  const onDragStart = (e) => {
    const target = e?.target;
    if (!target) return;
    const isImg =
      String(target.tagName || '').toUpperCase() === 'IMG' ||
      Boolean(typeof target.closest === 'function' && target.closest('img'));
    if (isImg) {
      e.preventDefault?.();
    }
  };

  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('contextmenu', onContextMenu, true);
  document.addEventListener('dragstart', onDragStart, true);

  const cleanup = () => {
    if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      document.removeEventListener('dragstart', onDragStart, true);
    }
    if (activeCleanup === cleanup) {
      activeCleanup = null;
    }
  };

  activeCleanup = cleanup;
  return { destroy: cleanup };
}
