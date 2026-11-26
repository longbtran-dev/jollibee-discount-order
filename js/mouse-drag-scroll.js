/**
 * Hỗ trợ kéo chuột cuộn ngang (Mouse Drag-to-Scroll) mượt mà trên máy tính:
 * - Không bị ngắt quãng bởi pointerleave khi tay người dùng lệch dọc vài pixel
 * - Chặn sự kiện click tổng hợp sau khi kéo để không bấm nhầm vào tab / nút bên trong
 * - Giữ nguyên cuộn cảm ứng tự nhiên trên thiết bị di động (pointerType !== 'mouse')
 */
export function bindMouseDragScroll(row) {
  if (!row || typeof row.addEventListener !== 'function' || row._mouseDragBound) return;
  row._mouseDragBound = true;

  let drag = null;
  let suppressNextClick = false;

  const cleanupWindowListeners = () => {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('pointerup', endDrag);
      window.removeEventListener('pointercancel', endDrag);
    }
  };

  const endDrag = (e) => {
    if (!drag || (e && e.pointerId !== undefined && drag.pointerId !== e.pointerId)) return;
    drag = null;
    row.classList?.remove?.('is-dragging');
    cleanupWindowListeners();
  };

  row.addEventListener('pointerdown', (e) => {
    suppressNextClick = false;
    if (e.pointerType !== 'mouse' || e.button !== 0 || row.scrollWidth <= row.clientWidth) return;
    drag = {
      pointerId: e.pointerId,
      startX: e.clientX,
      scrollLeft: row.scrollLeft,
      active: false
    };
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    }
  });

  row.addEventListener('pointermove', (e) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const distance = e.clientX - drag.startX;

    if (!drag.active) {
      if (Math.abs(distance) < 5) return;
      try {
        row.setPointerCapture?.(e.pointerId);
      } catch {
        // Bỏ qua nếu môi trường kiểm thử hoặc con trỏ không hỗ trợ capture
      }
      row.classList?.add?.('is-dragging');
      drag.active = true;
      suppressNextClick = true;
    }

    row.scrollLeft = drag.scrollLeft - distance;
  });

  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    row.addEventListener(event, endDrag);
  }

  // Chặn pha Capture của sự kiện click ngay sau thao tác kéo để không kích hoạt nhầm nút con
  row.addEventListener(
    'click',
    (e) => {
      if (!suppressNextClick) return;
      suppressNextClick = false;
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    },
    true
  );
}
