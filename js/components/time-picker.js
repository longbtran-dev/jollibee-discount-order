/**
 * Thành phần Vòng Cuộn Chọn Giờ Nhận Đơn Hôm Nay (Scrollable Time Wheel Picker)
 * Hỗ trợ:
 * - Cuộn cảm ứng (Touch), lăn chuột (Wheel), kéo chuột dọc & chạm chọn trực tiếp (scroll-snap)
 * - Nút chọn nhanh (+30 phút, +45 phút, +1 tiếng) đảm bảo chuẩn bị đơn ít nhất 30 phút
 * - Tích hợp ngăn xếp LIFO Modal Stack & Focus Trap an toàn
 */
import { escapeHtml, registerOpenModal, unregisterOpenModal, trapFocusInModal } from '../utils.js';
import { IconClock, IconX, IconCheck } from '../icons.js';

export const STORE_HOURS = [
  '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22'
];

export const STORE_MINUTES = [
  '00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'
];

const ITEM_HEIGHT = 40;

function bindVerticalWheelDrag(col) {
  if (!col || typeof col.addEventListener !== 'function') return;
  let startY = 0;
  let startTop = 0;
  let dragging = false;

  col.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    startY = e.clientY;
    startTop = col.scrollTop;
    dragging = false;

    const onMove = (ev) => {
      const dy = ev.clientY - startY;
      if (!dragging && Math.abs(dy) < 5) return;
      if (!dragging) {
        dragging = true;
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
        if (col.style) col.style.scrollSnapType = 'y mandatory';
        const nearestIdx = Math.round(col.scrollTop / ITEM_HEIGHT);
        if (typeof col.scrollTo === 'function') {
          col.scrollTo({ top: nearestIdx * ITEM_HEIGHT, behavior: 'smooth' });
        } else {
          col.scrollTop = nearestIdx * ITEM_HEIGHT;
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    }
  });
}

/**
 * Tính giờ nhận mặc định = Thời điểm hiện tại + minLeadMinutes (mặc định 30p), làm tròn lên bội số 5 phút
 * @param {Date} [now=new Date()]
 * @param {number} [addMinutes=30]
 * @returns {{ hour: string, minute: string }}
 */
export function computeDefaultPickupTime(now = new Date(), addMinutes = 30) {
  const target = new Date(now.getTime() + addMinutes * 60 * 1000);
  let h = target.getHours();
  let m = Math.ceil(target.getMinutes() / 5) * 5;

  if (m >= 60) {
    h += 1;
    m = 0;
  }

  if (h < 8 || (h === 8 && m < 30)) {
    return { hour: '08', minute: '30' };
  }
  if (h > 22) {
    return { hour: '22', minute: '00' };
  }

  return {
    hour: String(h).padStart(2, '0'),
    minute: String(m).padStart(2, '0')
  };
}

/**
 * Phân tách chuỗi giờ đã chọn (VD: "18:30 hôm nay" hoặc "12h15 hôm nay")
 * @param {string} value
 * @returns {{ hour: string, minute: string } | null}
 */
export function parsePickupTime(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/(\d{1,2})\s*[:hH]\s*(\d{1,2})/);
  if (!match) return null;

  let h = Math.min(22, Math.max(8, parseInt(match[1], 10)));
  let m = Math.round(parseInt(match[2], 10) / 5) * 5;
  if (m >= 60) m = 55;
  if (m < 0) m = 0;

  return {
    hour: String(h).padStart(2, '0'),
    minute: String(m).padStart(2, '0')
  };
}

/**
 * Mở Modal Vòng Cuộn Chọn Giờ Nhận Đơn Hôm Nay
 * @param {{ initialValue?: string, onSelect?: (formatted: string) => void }} options
 */
export function openTimeWheelPicker({ initialValue = '', onSelect } = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;

  const existing = typeof document.getElementById === 'function' ? document.getElementById('time-picker-modal') : null;
  if (existing) {
    unregisterOpenModal('time-picker-modal');
    existing.remove();
  }

  const initial = parsePickupTime(initialValue) || computeDefaultPickupTime(new Date(), 30);
  let currentHourIdx = Math.max(0, STORE_HOURS.indexOf(initial.hour));
  let currentMinIdx = Math.max(0, STORE_MINUTES.indexOf(initial.minute));

  const formatCurrentSelection = () => `${STORE_HOURS[currentHourIdx]}:${STORE_MINUTES[currentMinIdx]} hôm nay`;

  const modal = document.createElement('div');
  modal.id = 'time-picker-modal';
  modal.className = 'fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 animate-backdrop';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'time-picker-title');

  const hourItemsHtml = STORE_HOURS.map((h, idx) => `
    <button type="button" data-idx="${idx}" style="scroll-snap-align: center;"
      class="time-wheel-hour-item w-full h-10 flex items-center justify-center transition select-none ${
        idx === currentHourIdx ? 'text-xl font-black text-[#d71920]' : 'text-base font-bold text-gray-400 hover:text-gray-700'
      }">
      ${h} giờ
    </button>
  `).join('');

  const minItemsHtml = STORE_MINUTES.map((m, idx) => `
    <button type="button" data-idx="${idx}" style="scroll-snap-align: center;"
      class="time-wheel-min-item w-full h-10 flex items-center justify-center transition select-none ${
        idx === currentMinIdx ? 'text-xl font-black text-[#d71920]' : 'text-base font-bold text-gray-400 hover:text-gray-700'
      }">
      ${m} phút
    </button>
  `).join('');

  modal.innerHTML = `
    <div id="time-picker-panel" class="bg-white rounded-t-3xl sm:rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 animate-modal-panel">
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
          <button type="button" data-quick-mins="30" class="btn-quick-time flex-1 py-1.5 px-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-extrabold text-[11px] transition active:scale-95">
            ⚡ Sau 30 phút
          </button>
          <button type="button" data-quick-mins="45" class="btn-quick-time flex-1 py-1.5 px-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold text-[11px] transition active:scale-95">
            +45 phút
          </button>
          <button type="button" data-quick-mins="60" class="btn-quick-time flex-1 py-1.5 px-2 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-800 font-bold text-[11px] transition active:scale-95">
            +1 tiếng
          </button>
        </div>

        <!-- Column Headers -->
        <div class="grid grid-cols-2 text-center text-[10px] font-black uppercase tracking-wider text-gray-500 px-3">
          <span>Cuộn chọn Giờ</span>
          <span>Cuộn chọn Phút</span>
        </div>

        <!-- 2-Column Scrollable Drum Wheel -->
        <div class="relative h-[200px] bg-gray-50/70 rounded-2xl border border-gray-200 overflow-hidden select-none">
          <!-- Center Active Highlight Bar -->
          <div class="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 h-10 rounded-xl bg-red-50/90 border-y-2 border-[#d71920]/30 flex items-center justify-center z-0">
            <span class="font-black text-lg text-[#d71920]">:</span>
          </div>

          <!-- Top & Bottom Fade Masks -->
          <div class="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white via-white/75 to-transparent z-10"></div>
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/75 to-transparent z-10"></div>

          <div class="relative z-20 grid grid-cols-2 h-full">
            <!-- Hours Wheel -->
            <div id="time-wheel-hour" class="h-[200px] overflow-y-auto no-scrollbar overscroll-contain" style="scroll-snap-type: y mandatory;">
              <div class="h-[80px] flex-shrink-0"></div>
              ${hourItemsHtml}
              <div class="h-[80px] flex-shrink-0"></div>
            </div>

            <!-- Minutes Wheel -->
            <div id="time-wheel-minute" class="h-[200px] overflow-y-auto no-scrollbar overscroll-contain" style="scroll-snap-type: y mandatory;">
              <div class="h-[80px] flex-shrink-0"></div>
              ${minItemsHtml}
              <div class="h-[80px] flex-shrink-0"></div>
            </div>
          </div>
        </div>

        <p class="text-[11px] text-center text-amber-900 bg-amber-50 border border-amber-200/80 rounded-xl py-1.5 px-2.5 font-semibold">
          ⏱ Đơn cần <b>ít nhất 30 phút</b> chuẩn bị tính từ lúc đặt thành công
        </p>

        <!-- Confirm Button -->
        <button type="button" id="btn-time-wheel-confirm" class="w-full py-3 px-4 bg-[#d71920] hover:bg-[#b81218] text-white font-extrabold text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition active:scale-95">
          ${IconCheck('w-4 h-4')}
          <span id="time-wheel-confirm-label">Xác nhận: ${escapeHtml(formatCurrentSelection())}</span>
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const panelEl = modal.querySelector('#time-picker-panel');
  const releaseFocusTrap = trapFocusInModal(panelEl || modal);

  const hourCol = modal.querySelector('#time-wheel-hour');
  const minCol = modal.querySelector('#time-wheel-minute');
  const confirmLabelEl = modal.querySelector('#time-wheel-confirm-label');

  const updateVisualHighlight = () => {
    if (hourCol && typeof hourCol.querySelectorAll === 'function') {
      hourCol.querySelectorAll('.time-wheel-hour-item').forEach((btn, idx) => {
        btn.className = `time-wheel-hour-item w-full h-10 flex items-center justify-center transition select-none ${
          idx === currentHourIdx ? 'text-xl font-black text-[#d71920]' : 'text-base font-bold text-gray-400 hover:text-gray-700'
        }`;
      });
    }
    if (minCol && typeof minCol.querySelectorAll === 'function') {
      minCol.querySelectorAll('.time-wheel-min-item').forEach((btn, idx) => {
        btn.className = `time-wheel-min-item w-full h-10 flex items-center justify-center transition select-none ${
          idx === currentMinIdx ? 'text-xl font-black text-[#d71920]' : 'text-base font-bold text-gray-400 hover:text-gray-700'
        }`;
      });
    }
    if (confirmLabelEl) {
      confirmLabelEl.textContent = `Xác nhận: ${formatCurrentSelection()}`;
    }
  };

  const scrollToIndices = (hIdx, mIdx, behavior = 'auto') => {
    currentHourIdx = Math.min(STORE_HOURS.length - 1, Math.max(0, hIdx));
    currentMinIdx = Math.min(STORE_MINUTES.length - 1, Math.max(0, mIdx));
    if (hourCol) {
      if (typeof hourCol.scrollTo === 'function') {
        hourCol.scrollTo({ top: currentHourIdx * ITEM_HEIGHT, behavior });
      } else {
        hourCol.scrollTop = currentHourIdx * ITEM_HEIGHT;
      }
    }
    if (minCol) {
      if (typeof minCol.scrollTo === 'function') {
        minCol.scrollTo({ top: currentMinIdx * ITEM_HEIGHT, behavior });
      } else {
        minCol.scrollTop = currentMinIdx * ITEM_HEIGHT;
      }
    }
    updateVisualHighlight();
  };

  // Đặt vị trí cuộn ban đầu đúng vào giờ/phút mặc định & hỗ trợ kéo chuột dọc trên Desktop
  scrollToIndices(currentHourIdx, currentMinIdx, 'auto');
  bindVerticalWheelDrag(hourCol);
  bindVerticalWheelDrag(minCol);

  hourCol?.addEventListener('scroll', () => {
    const idx = Math.min(STORE_HOURS.length - 1, Math.max(0, Math.round(hourCol.scrollTop / ITEM_HEIGHT)));
    if (idx !== currentHourIdx) {
      currentHourIdx = idx;
      updateVisualHighlight();
    }
  }, { passive: true });

  minCol?.addEventListener('scroll', () => {
    const idx = Math.min(STORE_MINUTES.length - 1, Math.max(0, Math.round(minCol.scrollTop / ITEM_HEIGHT)));
    if (idx !== currentMinIdx) {
      currentMinIdx = idx;
      updateVisualHighlight();
    }
  }, { passive: true });

  hourCol?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.time-wheel-hour-item');
    if (btn && btn.dataset.idx !== undefined) {
      scrollToIndices(Number(btn.dataset.idx), currentMinIdx, 'smooth');
    }
  });

  minCol?.addEventListener('click', (e) => {
    const btn = e.target?.closest?.('.time-wheel-min-item');
    if (btn && btn.dataset.idx !== undefined) {
      scrollToIndices(currentHourIdx, Number(btn.dataset.idx), 'smooth');
    }
  });

  if (typeof modal.querySelectorAll === 'function') {
    modal.querySelectorAll('.btn-quick-time').forEach(btn => {
      btn.addEventListener('click', () => {
        const mins = Number(btn.dataset.quickMins) || 30;
        const target = computeDefaultPickupTime(new Date(), mins);
        const hIdx = Math.max(0, STORE_HOURS.indexOf(target.hour));
        const mIdx = Math.max(0, STORE_MINUTES.indexOf(target.minute));
        scrollToIndices(hIdx, mIdx, 'smooth');
      });
    });
  }

  let isClosed = false;
  const close = () => {
    if (isClosed) return;
    isClosed = true;
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

  modal.querySelector('#btn-time-wheel-confirm')?.addEventListener('click', () => {
    const selectedStr = formatCurrentSelection();
    close();
    if (typeof onSelect === 'function') {
      onSelect(selectedStr);
    }
  });
}
