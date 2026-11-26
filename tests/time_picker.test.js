import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDefaultPickupTime,
  getAvailableTimeModel,
  isPickupTimeValid,
  parsePickupTime,
  openTimeWheelPicker
} from '../js/components/time-picker.js';
import { getActiveModalCount, resetActiveModalCount } from '../js/utils.js';

describe('Scrollable Time Wheel Picker', () => {
  it('rounds up from seconds and stops at the end of the Vietnam pickup day', () => {
    assert.deepEqual(computeDefaultPickupTime(new Date('2026-11-26T07:10:01Z')), {
      hour: '14', minute: '45', dayLabel: 'hôm nay'
    });
    assert.equal(computeDefaultPickupTime(new Date('2026-11-26T16:25:01Z')), null);
    assert.equal(computeDefaultPickupTime(new Date('2026-11-26T16:10:00Z'), 60), null);
    assert.deepEqual(getAvailableTimeModel(new Date('2026-11-26T16:25:01Z')).hours, []);
  });

  it('computeDefaultPickupTime tính đúng +30p, +45p, +60p kể cả lúc 22:29 tối (không bị kẹt lùi về 22:00 đã qua)', () => {
    // 15:39 + 30p = 16:09 -> làm tròn lên 16:10 hôm nay
    const d1 = new Date('2026-11-26T15:39:00+07:00');
    assert.deepEqual(computeDefaultPickupTime(d1, 30), { hour: '16', minute: '10', dayLabel: 'hôm nay' });

    // 22:29 tối (đúng thời điểm bug thực tế): +30p -> 23:00, +45p -> 23:15, +60p -> 23:30 (không kẹt ở 22:00)
    const lateNight = new Date('2026-11-26T22:29:00+07:00');
    assert.deepEqual(computeDefaultPickupTime(lateNight, 30), { hour: '23', minute: '00', dayLabel: 'hôm nay' });
    assert.deepEqual(computeDefaultPickupTime(lateNight, 45), { hour: '23', minute: '15', dayLabel: 'hôm nay' });
    assert.deepEqual(computeDefaultPickupTime(lateNight, 60), { hour: '23', minute: '30', dayLabel: 'hôm nay' });

    // 06:00 sáng -> giới hạn trong khung mở cửa 08:30 hôm nay
    const earlyMorning = new Date('2026-11-26T06:00:00+07:00');
    assert.deepEqual(computeDefaultPickupTime(earlyMorning, 30), { hour: '08', minute: '30', dayLabel: 'hôm nay' });
  });

  it('getAvailableTimeModel loại bỏ hoàn toàn các giờ và phút đã qua (chỉ cho chọn >= hiện tại + 30 phút)', () => {
    // Lúc 15:20 -> mốc sớm nhất là 15:50
    const now = new Date('2026-11-26T15:20:00+07:00');
    const model = getAvailableTimeModel(now);

    assert.equal(model.hours.includes('14'), false, 'Không cho chọn 14 giờ đã qua');
    assert.equal(model.hours[0], '15', 'Giờ đầu tiên được phép chọn là 15 giờ');
    assert.deepEqual(model.getMinutesForHour('15'), ['50', '55'], 'Ở 15 giờ chỉ cho chọn 50 và 55 phút');
    assert.equal(model.getMinutesForHour('16').length, 12, 'Ở 16 giờ có đủ 12 mốc từ 00 đến 55 phút');
  });

  it('isPickupTimeValid chặn giờ đã qua trong quá khứ và chấp nhận giờ hợp lệ >= +30 phút', () => {
    const now = new Date('2026-11-26T18:15:00+07:00');
    assert.equal(isPickupTimeValid('17:30 hôm nay', now), false, '17:30 đã qua phải bị chặn');
    assert.equal(isPickupTimeValid('18:20 hôm nay', now), false, '18:20 chưa đủ 30 phút chuẩn bị phải bị chặn');
    assert.equal(isPickupTimeValid('18:45 hôm nay', now), true, '18:45 đủ 30 phút phải hợp lệ');
    assert.equal(parsePickupTime('18:35 hôm nay')?.hour, '18');
  });

  it('openTimeWheelPicker bỏ qua initialValue đã qua, đồng bộ chuẩn nút +30p / +45p / +1 tiếng và trả về đúng giờ khi xác nhận', () => {
    resetActiveModalCount();
    const listeners = {};
    const quickButtons = [30, 45, 60].map(mins => ({
      dataset: { quickMins: String(mins) },
      className: '',
      addEventListener: (ev, fn) => {
        listeners[`quick_${mins}:${ev}`] = fn;
      }
    }));

    const mockHourCol = {
      scrollTop: 0,
      style: {},
      innerHTML: '',
      addEventListener() {},
      querySelectorAll: () => []
    };
    const mockMinCol = {
      scrollTop: 0,
      style: {},
      innerHTML: '',
      addEventListener() {},
      querySelectorAll: () => []
    };
    const mockConfirmLabel = { textContent: '' };
    const mockConfirmBtn = {
      addEventListener: (ev, fn) => { listeners[`confirm:${ev}`] = fn; }
    };
    const mockCloseBtn = {
      addEventListener: (ev, fn) => { listeners[`close:${ev}`] = fn; }
    };

    let appendedModal = null;
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
            if (sel === '#time-wheel-confirm-label') return mockConfirmLabel;
            if (sel === '#btn-time-wheel-confirm') return mockConfirmBtn;
            if (sel === '#btn-time-wheel-close') return mockCloseBtn;
            return null;
          },
          querySelectorAll(sel) {
            if (sel === '.btn-quick-time') return quickButtons;
            return [];
          }
        };
      }
    };

    const fixedNow = new Date('2026-11-26T14:10:00+07:00'); // 14:10 -> +30p=14:40, +45p=14:55, +60p=15:10
    let selectedText = '';
    openTimeWheelPicker({
      initialValue: '09:00 hôm nay', // Giờ cũ đã qua -> phải tự động nhảy lên 14:40 hôm nay!
      nowProvider: () => fixedNow,
      onSelect: (val) => { selectedText = val; }
    });

    assert.ok(appendedModal);
    assert.equal(getActiveModalCount(), 1);
    assert.ok(mockConfirmLabel.textContent.includes('14:40 hôm nay'));

    // Bấm nút +45 phút -> phải cập nhật thành 14:55 hôm nay
    listeners['quick_45:click']?.();
    assert.ok(mockConfirmLabel.textContent.includes('14:55 hôm nay'));

    // Bấm nút +1 tiếng -> phải cập nhật thành 15:10 hôm nay
    listeners['quick_60:click']?.();
    assert.ok(mockConfirmLabel.textContent.includes('15:10 hôm nay'));

    // Xác nhận chọn
    listeners['confirm:click']?.();
    assert.equal(selectedText, '15:10 hôm nay');
    assert.equal(getActiveModalCount(), 0);
  });
});
