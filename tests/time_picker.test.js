import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeDefaultPickupTime, parsePickupTime, openTimeWheelPicker } from '../js/components/time-picker.js';
import { getActiveModalCount, resetActiveModalCount } from '../js/utils.js';

describe('Scrollable Time Wheel Picker', () => {
  it('computeDefaultPickupTime tính mặc định giờ hiện tại + 30 phút làm tròn lên bội số 5 phút', () => {
    // 15:39 + 30p = 16:09 -> làm tròn lên 16:10
    const d1 = new Date(2026, 10, 26, 15, 39, 0);
    assert.deepEqual(computeDefaultPickupTime(d1), { hour: '16', minute: '10' });

    // 06:00 sáng -> giới hạn trong khung mở cửa 08:30
    const d2 = new Date(2026, 10, 26, 6, 0, 0);
    assert.deepEqual(computeDefaultPickupTime(d2), { hour: '08', minute: '30' });
  });

  it('parsePickupTime tách chuẩn chuỗi HH:MM hôm nay hoặc HHhMM', () => {
    assert.deepEqual(parsePickupTime('18:35 hôm nay'), { hour: '18', minute: '35' });
    assert.deepEqual(parsePickupTime('12h05 hôm nay'), { hour: '12', minute: '05' });
    assert.equal(parsePickupTime(''), null);
  });

  it('openTimeWheelPicker tích hợp Modal Stack và trả về chuỗi giờ nhận hôm nay khi bấm xác nhận', () => {
    resetActiveModalCount();
    const listeners = {};
    let appendedModal = null;

    const createMockBtn = (id) => ({
      id,
      addEventListener: (ev, fn) => {
        listeners[`${id}:${ev}`] = fn;
      }
    });

    const mockHourCol = { scrollTop: 0, scrollTo() {}, addEventListener() {}, querySelectorAll: () => [] };
    const mockMinCol = { scrollTop: 0, scrollTo() {}, addEventListener() {}, querySelectorAll: () => [] };
    const mockConfirmBtn = createMockBtn('btn-time-wheel-confirm');
    const mockCloseBtn = createMockBtn('btn-time-wheel-close');

    global.document = {
      body: {
        classList: { add() {}, remove() {} },
        appendChild(el) { appendedModal = el; }
      },
      addEventListener() {},
      removeEventListener() {},
      createElement() {
        return {
          id: '',
          className: '',
          innerHTML: '',
          classList: { add() {}, remove() {} },
          setAttribute() {},
          addEventListener() {},
          remove() { appendedModal = null; },
          querySelector(sel) {
            if (sel === '#time-wheel-hour') return mockHourCol;
            if (sel === '#time-wheel-minute') return mockMinCol;
            if (sel === '#btn-time-wheel-confirm') return mockConfirmBtn;
            if (sel === '#btn-time-wheel-close') return mockCloseBtn;
            return null;
          },
          querySelectorAll() { return []; }
        };
      }
    };

    let selectedText = '';
    openTimeWheelPicker({
      initialValue: '18:30 hôm nay',
      onSelect: (val) => { selectedText = val; }
    });

    assert.ok(appendedModal);
    assert.equal(getActiveModalCount(), 1);

    // Giả lập khách bấm nút xác nhận giờ trên vòng cuộn
    listeners['btn-time-wheel-confirm:click']?.();
    assert.equal(selectedText, '18:30 hôm nay');
    assert.equal(getActiveModalCount(), 0);
  });
});
