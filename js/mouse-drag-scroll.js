export function bindMouseDragScroll(row) {
  if (!row) return;
  let drag = null;

  row.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || row.scrollWidth <= row.clientWidth) return;
    drag = { pointerId: e.pointerId, startX: e.clientX, scrollLeft: row.scrollLeft, active: false };
  });

  row.addEventListener('pointermove', (e) => {
    if (drag?.pointerId !== e.pointerId) return;
    const distance = e.clientX - drag.startX;

    if (!drag.active) {
      if (Math.abs(distance) < 5) return;
      // Chỉ giữ con trỏ sau khi kéo để lượt nhấp thường vẫn đến nút.
      row.setPointerCapture(e.pointerId);
      row.classList.add('is-dragging');
      drag.active = true;
    }

    row.scrollLeft = drag.scrollLeft - distance;
  });

  const endDrag = (e) => {
    if (drag?.pointerId !== e.pointerId) return;
    drag = null;
    row.classList.remove('is-dragging');
  };

  for (const event of ['pointerup', 'pointercancel', 'pointerleave', 'lostpointercapture']) {
    row.addEventListener(event, endDrag);
  }
}
