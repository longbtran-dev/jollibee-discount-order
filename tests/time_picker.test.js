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
  it('làm tròn theo giây và chỉ nhận món đến 21:00 giờ Việt Nam', () => {
    assert.deepEqual(computeDefaultPickupTime(new Date('2026-11-26T07:10:01Z')), {
      hour: '14', minute: '45', dayLabel: 'hôm nay'
    });
    const lastOrder = new Date('2026-11-26T13:30:00Z');
    assert.deepEqual(computeDefaultPickupTime(lastOrder), { hour: '21', minute: '00', dayLabel: 'hôm nay' });
    assert.equal(computeDefaultPickupTime(new Date('2026-11-26T13:30:01Z')), null);
    assert.deepEqual(getAvailableTimeModel(new Date('2026-11-26T13:30:01Z')).hours, []);
    assert.equal(computeDefaultPickupTime(new Date('2026-11-26T14:01:00Z')), null);
  });

  it('computeDefaultPickupTime tính đúng +30p, +45p, +60p và khóa mốc sau giờ đóng cửa', () => {
    // 15:39 + 30p = 16:09 -> làm tròn lên 16:10 hôm nay
    const d1 = new Date('2026-11-26T15:39:00+07:00');
    assert.deepEqual(computeDefaultPickupTime(d1, 30), { hour: '16', minute: '10', dayLabel: 'hôm nay' });

    const evening = new Date('2026-11-26T20:15:00+07:00');
    assert.deepEqual(computeDefaultPickupTime(evening, 30), { hour: '20', minute: '45', dayLabel: 'hôm nay' });
    assert.deepEqual(computeDefaultPickupTime(evening, 45), { hour: '21', minute: '00', dayLabel: 'hôm nay' });
    assert.equal(computeDefaultPickupTime(evening, 60), null);

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
    assert.deepEqual(model.getMinutesForHour('21'), ['00']);
    assert.deepEqual(model.getMinutesForHour('22'), []);
  });

  it('isPickupTimeValid chặn giờ đã qua trong quá khứ và chấp nhận giờ hợp lệ >= +30 phút', () => {
    const now = new Date('2026-11-26T18:15:00+07:00');
    assert.equal(isPickupTimeValid('17:30 hôm nay', now), false, '17:30 đã qua phải bị chặn');
    assert.equal(isPickupTimeValid('18:20 hôm nay', now), false, '18:20 chưa đủ 30 phút chuẩn bị phải bị chặn');
    assert.equal(isPickupTimeValid('18:45 hôm nay', now), true, '18:45 đủ 30 phút phải hợp lệ');
    assert.equal(isPickupTimeValid('21:00 hôm nay', now), true);
    assert.equal(isPickupTimeValid('21:05 hôm nay', now), false);
    assert.equal(isPickupTimeValid('22:00 hôm nay', now), false);
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
      addEventListener(ev, fn) { listeners[`hourCol:${ev}`] = fn; },
      querySelectorAll: () => []
    };
    const mockMinCol = {
      scrollTop: 0,
      style: {},
      innerHTML: '',
      addEventListener(ev, fn) { listeners[`minCol:${ev}`] = fn; },
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

    // Chạm trực tiếp vào mục 16 giờ trên vòng cuộn -> đồng bộ tâm scrollTop = index * 40
    listeners['hourCol:click']?.({
      target: { closest: () => ({ dataset: { value: '16' } }) }
    });
    assert.ok(mockConfirmLabel.textContent.includes('16:10 hôm nay'));

    // Chạm quay lại 14 giờ (giờ đầu tiên) -> phút 10 đã qua ở 14 giờ nên tự đẩy lên 14:40 hợp lệ!
    listeners['hourCol:click']?.({
      target: { closest: () => ({ dataset: { value: '14' } }) }
    });
    assert.ok(mockConfirmLabel.textContent.includes('14:40 hôm nay'));

    // Xác nhận chọn
    listeners['confirm:click']?.();
    assert.equal(selectedText, '14:40 hôm nay');
    assert.equal(getActiveModalCount(), 0);
  });
});
