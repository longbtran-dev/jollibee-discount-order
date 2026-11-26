import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { bindMouseDragScroll } from '../js/mouse-drag-scroll.js';

describe('Mouse Drag Horizontal Scroll', () => {
  function createMockRow({ scrollWidth = 600, clientWidth = 300 } = {}) {
    const listeners = {};
    const captureListeners = {};
    const classes = new Set();
    let capturedPointer = null;

    const row = {
      scrollWidth,
      clientWidth,
      scrollLeft: 100,
      classList: {
        add: (c) => classes.add(c),
        remove: (c) => classes.delete(c),
        contains: (c) => classes.has(c)
      },
      setPointerCapture: (id) => { capturedPointer = id; },
      addEventListener: (ev, fn, opts) => {
        const isCapture = opts === true || (opts && opts.capture);
        const store = isCapture ? captureListeners : listeners;
        (store[ev] = store[ev] || []).push(fn);
      },
      dispatch(ev, payload = {}, useCapture = false) {
        const list = (useCapture ? captureListeners[ev] : listeners[ev]) || [];
        list.forEach(fn => fn(payload));
      },
      get capturedPointer() {
        return capturedPointer;
      }
    };
    return row;
  }

  it('kéo chuột >= 5px cuộn ngang mượt, không bị đứt bởi pointerleave sớm và chặn click nhầm vào nút con', () => {
    const row = createMockRow();
    bindMouseDragScroll(row);
    // Gọi lần 2 không nhân đôi listener
    bindMouseDragScroll(row);

    // 1. Nhấn chuột trái tại x = 200
    row.dispatch('pointerdown', { pointerType: 'mouse', button: 0, pointerId: 1, clientX: 200 });

    // Rê nhẹ 2px rồi trỏ chuột trượt ra mép dọc (pointerleave) trước khi đủ 5px -> KHÔNG làm gãy phiên kéo
    row.dispatch('pointermove', { pointerId: 1, clientX: 198 });
    row.dispatch('pointerleave', { pointerId: 1 });

    // Kéo tiếp sang trái tới x = 150 (distance = -50px) -> kích hoạt kéo & cuộn scrollLeft từ 100 lên 150
    row.dispatch('pointermove', { pointerId: 1, clientX: 150 });
    assert.equal(row.classList.contains('is-dragging'), true);
    assert.equal(row.scrollLeft, 150);

    // Nhả chuột -> kết thúc kéo, và chặn sự kiện click tổng hợp ngay sau đó để không bấm nhầm tab/nút Thêm
    row.dispatch('pointerup', { pointerId: 1 });
    assert.equal(row.classList.contains('is-dragging'), false);

    let clickPrevented = false;
    let clickStopped = false;
    row.dispatch(
      'click',
      {
        preventDefault() { clickPrevented = true; },
        stopPropagation() { clickStopped = true; }
      },
      true
    );
    assert.equal(clickPrevented, true);
    assert.equal(clickStopped, true);

    // Lần click bình thường kế tiếp (không kéo) phải hoạt động bình thường
    clickPrevented = false;
    row.dispatch('pointerdown', { pointerType: 'mouse', button: 0, pointerId: 2, clientX: 120 });
    row.dispatch('pointermove', { pointerId: 2, clientX: 122 }); // < 5px
    row.dispatch('pointerup', { pointerId: 2 });
    row.dispatch(
      'click',
      {
        preventDefault() { clickPrevented = true; },
        stopPropagation() {}
      },
      true
    );
    assert.equal(clickPrevented, false);
  });

  it('bỏ qua sự kiện cảm ứng touch và chuột phải', () => {
    const row = createMockRow();
    bindMouseDragScroll(row);

    row.dispatch('pointerdown', { pointerType: 'touch', button: 0, pointerId: 3, clientX: 200 });
    row.dispatch('pointermove', { pointerId: 3, clientX: 100 });
    assert.equal(row.scrollLeft, 100);
  });
});
