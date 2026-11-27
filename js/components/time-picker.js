/**
 * Thành phần Vòng Cuộn Chọn Giờ Nhận Đơn Hôm Nay (Scrollable Time Wheel Picker)
 * Hỗ trợ:
 * - Chặn 100% các giờ và phút đã qua (chỉ cho chọn >= hiện tại + 30 phút chuẩn bị đến 21:00 giờ Việt Nam)
 * - Đồng bộ tâm 200px (80 + 40 + 80) tuyệt đối bằng rAF, không xung đột scroll-snap hay focus trình duyệt
 * - Nút chọn nhanh (+30 phút, +45 phút, +1 tiếng), kéo chuột dọc, cảm ứng & bàn phím
 * - Tích hợp ngăn xếp LIFO Modal Stack & Focus Trap an toàn
 */
import { registerOpenModal, unregisterOpenModal, trapFocusInModal } from '../utils.js';
import { IconClock, IconX, IconCheck } from '../icons.js';

const OPEN_HOUR = 8;
const LAST_PICKUP_HOUR = 21;
const LAST_PICKUP_LABEL = `${LAST_PICKUP_HOUR}:00`;

export const STORE_HOURS = Array.from(
  { length: LAST_PICKUP_HOUR - OPEN_HOUR + 1 },
  (_, i) => String(OPEN_HOUR + i).padStart(2, '0')
);

export const STORE_MINUTES = [
  '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'
];

const ITEM_HEIGHT = 40;
const MIN_PREP_MINUTES = 30;
const TIME_ZONE = 'Asia/Ho_Chi_Minh';

const storeClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

const storeDate = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const presets = [
  [30, '⚡ Sau 30 phút'],
  [45, '+45 phút'],
  [60, '+1 tiếng']
];

/**
 * Cuộn mượt cột vòng quay tới đúng tâm mục targetIdx bằng rAF, tắt tạm scroll-snap tránh kẹt giữa chừng
 */
function animateColumnToIndex(col, targetIdx, immediate = false) {
  if (!col) return;
  const targetTop = Math.max(0, targetIdx) * ITEM_HEIGHT;

  if (col._rafId && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(col._rafId);
    col._rafId = null;
  }
  if (col._progTimer) {
    clearTimeout(col._progTimer);
    col._progTimer = null;
  }

  if (
    immediate ||
    typeof requestAnimationFrame !== 'function' ||
    Math.abs((col.scrollTop || 0) - targetTop) < 1
  ) {
    col._isProgrammatic = true;
    if (col.style) col.style.scrollSnapType = 'y mandatory';
    col.scrollTop = targetTop;
    col._progTimer = setTimeout(() => {
      col._isProgrammatic = false;
      col._progTimer = null;
    }, 50);
    return;
  }

  const startTop = col.scrollTop || 0;
  const distance = targetTop - startTop;
  const duration = 160;
  let startTime = null;

  col._isProgrammatic = true;
  if (col.style) col.style.scrollSnapType = 'none';

  const step = (timestamp) => {
    if (startTime === null) startTime = timestamp;
    const elapsed = timestamp - startTime;
    const progress = Math.min(1, elapsed / duration);
    const easeOut = 1 - Math.pow(1 - progress, 3);

    col.scrollTop = startTop + distance * easeOut;

    if (progress < 1) {
      col._rafId = requestAnimationFrame(step);
    } else {
      col._rafId = null;
      col.scrollTop = targetTop;
      if (col.style) col.style.scrollSnapType = 'y mandatory';
      col._progTimer = setTimeout(() => {
        col._isProgrammatic = false;
        col._progTimer = null;
      }, 50);
    }
  };

  col._rafId = requestAnimationFrame(step);
}

function bindVerticalWheelDrag(col, onSnapIndex) {
  if (!col || typeof col.addEventListener !== 'function') return;
  let startY = 0;
  let startTop = 0;
  let dragging = false;

  col.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    startY = e.clientY;
    startTop = col.scrollTop || 0;
    dragging = false;

    const onMove = (ev) => {
      const dy = ev.clientY - startY;
      if (!dragging && Math.abs(dy) < 5) return;
      if (!dragging) {
        dragging = true;
        col._isDragging = true;
        col.setPointerCapture?.(ev.pointerId);
        if (col.style) col.style.scrollSnapType = 'none';
      }
      ev.preventDefault();
      col.scrollTop = startTop - dy;
    };

    const onUp = () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      }
      if (dragging) {
        col._isDragging = false;
        col._suppressClickUntil = Date.now() + 100;
        const nearestIdx = Math.max(0, Math.round((col.scrollTop || 0) / ITEM_HEIGHT));
        onSnapIndex(nearestIdx);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }
  });
}

export function getPickupDate(now = new Date()) {
  return storeDate.format(now);
}

/** Tính mốc 5 phút đầu tiên đủ thời gian chuẩn bị trong ngày tại Việt Nam (tối đa 21:00). */
export function computeDefaultPickupTime(now = new Date(), addMinutes = MIN_PREP_MINUTES) {
  const [hour, minute] = storeClock.format(now).split(':').map(Number);
  const fraction = (now.getUTCSeconds() * 1000 + now.getUTCMilliseconds()) / 60000;
  const target = Math.max(
    OPEN_HOUR * 60 + 30,
    Math.ceil((hour * 60 + minute + addMinutes + fraction) / 5) * 5
  );
  if (target > LAST_PICKUP_HOUR * 60) return null;

  return {
    hour: String(Math.floor(target / 60)).padStart(2, '0'),
    minute: String(target % 60).padStart(2, '0'),
    dayLabel: 'hôm nay'
  };
}

/**
 * Phân tách chuỗi giờ đã chọn (VD: "18:30 hôm nay" hoặc "12h15 hôm nay")
 * @param {string} value
 * @returns {{ hour: string, minute: string } | null}
 */
export function parsePickupTime(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})\s*[:h]\s*(\d{1,2})(?:\s+hôm nay)?$/i);
  if (!match) return null;
  const hour = match[1].padStart(2, '0');
  const minute = match[2].padStart(2, '0');
  if (!STORE_HOURS.includes(hour) || !STORE_MINUTES.includes(minute)) return null;
  return { hour, minute };
}

export function getAvailableTimeModel(now = new Date()) {
  const earliest = computeDefaultPickupTime(now);
  const hours = earliest ? STORE_HOURS.filter(hour => hour >= earliest.hour) : [];

  return {
    earliest,
    hours,
    getMinutesForHour(hour) {
      if (!hours.includes(hour)) return [];
      if (Number(hour) === LAST_PICKUP_HOUR) return ['00'];
      return hour === earliest.hour
        ? STORE_MINUTES.filter(minute => minute >= earliest.minute)
        : STORE_MINUTES;
    }
  };
}

export function isPickupTimeValid(value, now = new Date()) {
  const time = parsePickupTime(value);
  return Boolean(time && getAvailableTimeModel(now).getMinutesForHour(time.hour).includes(time.minute));
}

/**
 * Mở Modal Vòng Cuộn Chọn Giờ Nhận Đơn Hôm Nay
 * @param {{ initialValue?: string, nowProvider?: () => Date, onSelect?: (formatted: string, date: string) => void }} options
 */
export function openTimeWheelPicker({ initialValue = '', onSelect, nowProvider = () => new Date() } = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;

  const existing = typeof document.getElementById === 'function' ? document.getElementById('time-picker-modal') : null;
  if (existing) {
    unregisterOpenModal('time-picker-modal');
    existing.remove();
  }

  let now = nowProvider();
  let modelDate = getPickupDate(now);
  let model = getAvailableTimeModel(now);
  const hasSavedTime = isPickupTimeValid(initialValue, now);
  let selection = hasSavedTime ? parsePickupTime(initialValue) : model.earliest;
  let activePreset = hasSavedTime ? null : (selection ? MIN_PREP_MINUTES : null);
  const formatCurrentSelection = () => (selection ? `${selection.hour}:${selection.minute} hôm nay` : '');

  const wheelItemClasses = (type, selected) =>
    `time-wheel-${type}-item w-full flex items-center justify-center cursor-pointer select-none transition-colors duration-100 ${
      selected ? 'text-xl font-black text-[#d71920]' : 'text-base font-bold text-gray-400 hover:text-gray-700'
    }`;

  const quickButtonClasses = (selected) =>
    `btn-quick-time flex-1 py-2 px-2 rounded-xl border text-[11px] transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${
      selected
        ? 'bg-[#ffc72c] border-amber-400 text-gray-950 font-black shadow-sm'
        : 'bg-gray-50 hover:bg-amber-50/60 border-gray-200 text-gray-700 font-bold'
    }`;

  const modal = document.createElement('div');
  modal.id = 'time-picker-modal';
  modal.className = 'fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 animate-backdrop';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'time-picker-title');

  modal.innerHTML = `
    <div id="time-picker-panel" class="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 animate-modal-panel transform-gpu">
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3.5 bg-[#d71920] text-white">
        <div class="flex items-center gap-2">
          ${IconClock('w-5 h-5 text-amber-300')}
          <h4 id="time-picker-title" class="font-extrabold text-sm sm:text-base">Chọn Giờ Nhận Hôm Nay</h4>
        </div>
        <button type="button" id="btn-time-wheel-close" aria-label="Đóng bảng chọn giờ" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition active:scale-95">
          ${IconX('w-4 h-4')}
        </button>
      </div>

      <div class="p-4 space-y-3.5">
        <!-- Quick-pick presets -->
        <div class="flex items-center gap-2 justify-center">
          ${presets.map(([mins, label]) => `
            <button type="button" data-quick-mins="${mins}" class="${quickButtonClasses(false)}">${label}</button>
          `).join('')}
        </div>

        <!-- Column Headers -->
        <div class="grid grid-cols-2 text-center text-[10px] font-black uppercase tracking-wider text-gray-500 px-3">
          <span>Cuộn chọn Giờ</span>
          <span>Cuộn chọn Phút</span>
        </div>

        <!-- Outer Frame (tách border khỏi khung 200px bên trong để không lệch 2px tâm cuộn) -->
        <div class="rounded-2xl border border-gray-200 bg-gray-50/70 overflow-hidden select-none">
          <div class="relative w-full" style="height: 200px;">
            <!-- Center Active Highlight Bar (tâm chính xác 80px..120px) -->
            <div class="pointer-events-none absolute inset-x-3 rounded-xl bg-red-50/90 border-y-2 border-[#d71920]/30 flex items-center justify-center z-0"
              style="top: 80px; height: 40px;">
              <span class="font-black text-lg text-[#d71920]">:</span>
            </div>

            <!-- Top & Bottom Fade Masks -->
            <div class="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white via-white/75 to-transparent z-10"></div>
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/75 to-transparent z-10"></div>

            <div class="relative z-20 grid grid-cols-2" style="height: 200px;">
              <!-- Hours Wheel -->
              <div id="time-wheel-hour" role="listbox" tabindex="0" aria-label="Chọn giờ" class="overflow-y-auto no-scrollbar overscroll-contain focus:outline-none" style="height: 200px; scroll-snap-type: y mandatory;"></div>

              <!-- Minutes Wheel -->
              <div id="time-wheel-minute" role="listbox" tabindex="0" aria-label="Chọn phút" class="overflow-y-auto no-scrollbar overscroll-contain focus:outline-none" style="height: 200px; scroll-snap-type: y mandatory;"></div>
            </div>
          </div>
        </div>

        <p id="time-wheel-note" aria-live="polite" class="text-[11px] text-center text-amber-900 bg-amber-50 border border-amber-200/80 rounded-xl py-1.5 px-2.5 font-semibold">
          ⏱ Nhận món đến <b>${LAST_PICKUP_LABEL}</b>. Đơn cần <b>ít nhất 30 phút</b> chuẩn bị tính từ lúc đặt thành công.
        </p>

        <!-- Confirm Button -->
        <button type="button" id="btn-time-wheel-confirm" class="w-full py-3 px-4 bg-[#d71920] hover:bg-[#b81218] text-white font-extrabold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
          ${IconCheck('w-4 h-4')}
          <span id="time-wheel-confirm-label"></span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const panelEl = modal.querySelector('#time-picker-panel');
  const releaseFocusTrap = trapFocusInModal(panelEl || modal, { autoFocus: false });

  const hourCol = modal.querySelector('#time-wheel-hour');
  const minCol = modal.querySelector('#time-wheel-minute');
  const confirmLabelEl = modal.querySelector('#time-wheel-confirm-label');
  const confirmButton = modal.querySelector('#btn-time-wheel-confirm');
  const note = modal.querySelector('#time-wheel-note');
  const quickButtons = Array.from(modal.querySelectorAll('.btn-quick-time'));
  const spacer = '<div style="height: 80px;" class="flex-shrink-0"></div>';
  const hoursWheel = { col: hourCol, type: 'hour', unit: 'giờ', values: [] };
  const minutesWheel = { col: minCol, type: 'min', unit: 'phút', values: [] };

  const syncWheel = (wheel, values, selected, { source = null, immediate = false } = {}) => {
    const { col, type, unit } = wheel;
    if (!col) return;
    const changed = values.length !== wheel.values.length || values.some((value, i) => value !== wheel.values[i]);
    if (changed) {
      wheel.values = [...values];
      if (values.length === 0) {
        col.innerHTML = `${spacer}<div style="height: ${ITEM_HEIGHT}px; line-height: ${ITEM_HEIGHT}px;" class="w-full flex items-center justify-center text-xs font-bold text-gray-400">--</div>${spacer}`;
      } else {
        col.innerHTML =
          spacer +
          values
            .map(
              value => `
            <div role="option" data-value="${value}" aria-selected="${value === selected ? 'true' : 'false'}"
              style="height: ${ITEM_HEIGHT}px; line-height: ${ITEM_HEIGHT}px; scroll-snap-align: center;"
              class="${wheelItemClasses(type, value === selected)}">${value} ${unit}</div>
          `
            )
            .join('') +
          spacer;
      }
    } else {
      col.querySelectorAll('[data-value]').forEach(itemEl => {
        const isSelected = itemEl.dataset.value === selected;
        itemEl.className = wheelItemClasses(type, isSelected);
        itemEl.setAttribute?.('aria-selected', String(isSelected));
      });
    }

    if (values.length > 0 && (col !== source || changed)) {
      const targetIdx = Math.max(0, values.indexOf(selected));
      animateColumnToIndex(col, targetIdx, immediate || changed);
    }
  };

  const syncSelection = ({ source = null, immediate = false } = {}) => {
    syncWheel(hoursWheel, model.hours, selection?.hour, { source, immediate });
    syncWheel(minutesWheel, selection ? model.getMinutesForHour(selection.hour) : [], selection?.minute, { source, immediate });

    if (confirmButton) confirmButton.disabled = !selection;
    if (confirmLabelEl) {
      confirmLabelEl.textContent = selection ? `Xác nhận: ${formatCurrentSelection()}` : 'Hết giờ nhận hôm nay';
    }
    quickButtons.forEach(btn => {
      const mins = Number(btn.dataset.quickMins);
      btn.disabled = !computeDefaultPickupTime(now, mins);
      const selected = !btn.disabled && mins === activePreset;
      btn.className = quickButtonClasses(selected);
      btn.setAttribute?.('aria-pressed', String(selected));
    });
    if (!selection && note) {
      note.textContent = `Hôm nay không còn giờ nhận món đủ 30 phút chuẩn bị trước mốc ${LAST_PICKUP_LABEL}.`;
    }
  };

  const bindWheel = (wheel, select) => {
    const { col } = wheel;
    if (!col) return;

    bindVerticalWheelDrag(col, (nearestIdx) => {
      const clampedIdx = Math.max(0, Math.min(wheel.values.length - 1, nearestIdx));
      if (wheel.values[clampedIdx]) {
        select(wheel.values[clampedIdx], null);
      }
    });

    col.addEventListener('scroll', () => {
      if (col._isProgrammatic || col._isDragging || wheel.values.length === 0) return;
      const index = Math.max(0, Math.min(wheel.values.length - 1, Math.round((col.scrollTop || 0) / ITEM_HEIGHT)));
      select(wheel.values[index], col);
    }, { passive: true });

    col.addEventListener('click', (e) => {
      if (col._suppressClickUntil && Date.now() < col._suppressClickUntil) return;
      const itemEl = e.target?.closest?.('[data-value]');
      if (itemEl?.dataset?.value) {
        select(itemEl.dataset.value, null);
      }
    });

    col.addEventListener('keydown', (e) => {
      if (wheel.values.length === 0) return;
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const currentVal = wheel.type === 'hour' ? selection?.hour : selection?.minute;
      const curIdx = Math.max(0, wheel.values.indexOf(currentVal));
      const nextIdx = Math.max(0, Math.min(wheel.values.length - 1, curIdx + (e.key === 'ArrowDown' ? 1 : -1)));
      if (wheel.values[nextIdx] && wheel.values[nextIdx] !== currentVal) {
        select(wheel.values[nextIdx], null);
      }
    });
  };

  syncSelection({ immediate: true });
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      if (selection) {
        animateColumnToIndex(hourCol, Math.max(0, hoursWheel.values.indexOf(selection.hour)), true);
        animateColumnToIndex(minCol, Math.max(0, minutesWheel.values.indexOf(selection.minute)), true);
      }
    });
  }

  let hourScrollSyncTimer = null;
  bindWheel(hoursWheel, (hour, source) => {
    if (!hour || (source && hour === selection?.hour)) return;
    const minutes = model.getMinutesForHour(hour);
    const minute = minutes.includes(selection?.minute) ? selection.minute : minutes[0];
    selection = { hour, minute };
    activePreset = null;

    if (source) {
      // Khi khách đang tự cuộn cột Giờ, đợi 100ms sau nhịp cuộn để cập nhật cột Phút mượt mà không giật
      syncWheel(hoursWheel, model.hours, selection.hour, { source });
      if (confirmLabelEl) confirmLabelEl.textContent = `Xác nhận: ${formatCurrentSelection()}`;
      quickButtons.forEach(btn => {
        btn.className = quickButtonClasses(false);
        btn.setAttribute?.('aria-pressed', 'false');
      });
      clearTimeout(hourScrollSyncTimer);
      hourScrollSyncTimer = setTimeout(() => {
        syncSelection({ source: hourCol });
      }, 100);
    } else {
      clearTimeout(hourScrollSyncTimer);
      syncSelection({ immediate: false });
    }
  });

  bindWheel(minutesWheel, (minute, source) => {
    if (!minute || !selection || (source && minute === selection?.minute)) return;
    selection = { hour: selection.hour, minute };
    activePreset = null;
    syncSelection({ source, immediate: false });
  });

  const refreshModel = () => {
    modelDate = getPickupDate(now);
    model = getAvailableTimeModel(now);
  };

  quickButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      now = nowProvider();
      refreshModel();
      const mins = Number(btn.dataset.quickMins);
      const target = computeDefaultPickupTime(now, mins);
      selection = target ?? model.earliest;
      activePreset = target ? mins : (selection ? MIN_PREP_MINUTES : null);
      syncSelection({ immediate: false });
    });
  });

  let isClosed = false;
  const close = () => {
    if (isClosed) return;
    isClosed = true;
    clearTimeout(hourScrollSyncTimer);
    if (hourCol?._rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(hourCol._rafId);
    if (minCol?._rafId && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(minCol._rafId);
    unregisterOpenModal('time-picker-modal');
    releaseFocusTrap();
    modal.classList.add('opacity-0', 'transition-opacity', 'duration-150');
    setTimeout(() => modal.remove(), 150);
  };

  registerOpenModal('time-picker-modal', close);

  modal.querySelector('#btn-time-wheel-close')?.addEventListener('click', close);

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

  confirmButton?.addEventListener('click', () => {
    const selectedStr = formatCurrentSelection();
    now = nowProvider();
    if (modelDate !== getPickupDate(now) || !isPickupTimeValid(selectedStr, now)) {
      refreshModel();
      selection = model.earliest;
      activePreset = selection ? MIN_PREP_MINUTES : null;
      if (note && selection) note.textContent = 'Giờ vừa chọn không còn khả dụng. Vui lòng kiểm tra lại giờ mới.';
      syncSelection({ immediate: false });
      return;
    }
    close();
    if (typeof onSelect === 'function') {
      onSelect(selectedStr, modelDate);
    }
  });
}
