/**
 * Thành phần Bảng Thông Tin Shop (InfoModal) — Tối ưu hóa 60fps:
 * - Không dùng backdrop-blur gây nghẽn GPU trên di động
 * - Dựng sẵn 3 tab trong DOM & trượt thanh chọn (Segmented Sliding Pill) bằng GPU translate3d
 * - Chuyển tab tức thì 0ms không reload modal, không chớp trắng, không mất trạng thái Video
 */
import {
  escapeHtml,
  safeImageUrl,
  FALLBACK_FOOD_IMAGE,
  registerOpenModal,
  unregisterOpenModal,
  trapFocusInModal
} from '../utils.js';
import {
  IconX,
  IconPlayCircle,
  IconStar,
  IconShieldCheck,
  IconZalo,
  IconFacebook,
  IconPhone,
  IconCheckCircle
} from '../icons.js';

const TAB_ORDER = ['guide', 'reviews', 'policy'];

/**
 * Phân tích URL video an toàn sang cấu hình nhúng (YouTube, YouTube Shorts, MP4 hoặc link ngoài)
 * @param {string} rawUrl
 * @returns {{ type: 'iframe' | 'video' | 'link', src: string } | null}
 */
export function resolveVideoEmbed(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (!/^(https?:\/\/|videos\/|\.\/videos\/|\/videos\/)/i.test(trimmed) && !/\.(mp4|webm|ogg)(\?.*)?$/i.test(trimmed)) {
    return null;
  }

  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,20})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'iframe',
      src: `https://www.youtube.com/embed/${ytMatch[1]}`
    };
  }

  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(trimmed)) {
    return {
      type: 'video',
      src: trimmed
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return {
      type: 'link',
      src: trimmed
    };
  }

  return null;
}

export class InfoModal {
  constructor(config = {}, containerId = 'info-modal-container') {
    this.config = config || {};
    this.containerId = containerId;
    this.activeTab = 'guide'; // 'guide' | 'reviews' | 'policy'
    this._isOpen = false;
    this._releaseFocusTrap = null;
    this._renderedVideoUrl = null;
  }

  getContainer() {
    let el = document.getElementById(this.containerId);
    if (!el) {
      el = document.createElement('div');
      el.id = this.containerId;
      document.body.appendChild(el);
    }
    return el;
  }

  open(tab = 'guide') {
    this.activeTab = TAB_ORDER.includes(tab) ? tab : 'guide';
    if (!this._isOpen) {
      this._isOpen = true;
      registerOpenModal('info-modal', () => this.close());
    }
    this.render();
  }

  switchTab(tab) {
    if (!TAB_ORDER.includes(tab)) return;
    if (this.activeTab === tab && this._renderedVideoUrl === (this.config?.guideVideoUrl || '')) return;
    this.activeTab = tab;
    if (!this._isOpen) return;

    const container = this.getContainer();
    const panel = typeof container.querySelector === 'function' ? container.querySelector('#info-modal-panel') : null;

    // Nếu guideVideoUrl vừa thay đổi động hoặc môi trường test tối giản chưa giữ panel -> dựng lại 1 lần
    if (!panel || this._renderedVideoUrl !== (this.config?.guideVideoUrl || '')) {
      this.render();
      return;
    }

    this._syncActiveTabDOM(panel);
  }

  _syncActiveTabDOM(panel) {
    const activeIdx = Math.max(0, TAB_ORDER.indexOf(this.activeTab));

    const indicator = typeof panel.querySelector === 'function' ? panel.querySelector('#info-tab-indicator') : null;
    if (indicator && indicator.style) {
      indicator.style.transform = `translate3d(${activeIdx * 100}%, 0, 0)`;
    }

    if (typeof panel.querySelectorAll === 'function') {
      panel.querySelectorAll('.info-modal-tab-btn').forEach(btn => {
        const isMatch = btn.dataset?.tab === this.activeTab;
        btn.setAttribute?.('aria-selected', isMatch ? 'true' : 'false');
        btn.className = `info-modal-tab-btn relative z-10 py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 select-none ${
          isMatch ? 'text-white' : 'text-gray-700 hover:text-gray-950'
        }`;
      });

      panel.querySelectorAll('[data-tab-panel]').forEach(tabPanel => {
        const isMatch = tabPanel.dataset?.tabPanel === this.activeTab;
        if (isMatch) {
          tabPanel.classList.remove('hidden');
          tabPanel.classList.add('block', 'animate-tab-fade');
        } else {
          tabPanel.classList.remove('block', 'animate-tab-fade');
          tabPanel.classList.add('hidden');
        }
      });
    }

    const scrollBody = typeof panel.querySelector === 'function' ? panel.querySelector('.info-modal-scroll-body') : null;
    if (scrollBody) {
      scrollBody.scrollTop = 0;
    }
  }

  close() {
    if (this._releaseFocusTrap) {
      this._releaseFocusTrap();
      this._releaseFocusTrap = null;
    }
    if (!this._isOpen) return;
    this._isOpen = false;
    this._renderedVideoUrl = null;
    const container = typeof document !== 'undefined' ? document.getElementById(this.containerId) : null;
    if (container) container.innerHTML = '';
    unregisterOpenModal('info-modal');
  }

  _buildContactBarHtml() {
    const zaloHref = escapeHtml(this.config.zaloLink || 'https://zalo.me/0985194873');
    const fbHref = escapeHtml(this.config.facebookUrl || 'https://www.facebook.com/trnblng');
    const rawPhone = String(this.config.hotline || '0985194873').replace(/\D/g, '');
    const displayPhone = escapeHtml(this.config.hotline || '0985194873');

    return `
      <div class="p-3.5 bg-gradient-to-r from-slate-50 to-amber-50/50 rounded-2xl border border-gray-200 space-y-2.5">
        <div class="text-xs font-extrabold text-gray-800 text-center">
          Cần tư vấn hoặc gửi đơn đặt hộ ngay? Liên hệ trực tiếp chủ shop:
        </div>
        <div class="grid grid-cols-3 gap-2">
          <a href="${zaloHref}" target="_blank" rel="noopener noreferrer"
            class="py-2.5 px-2 rounded-xl bg-[#0068FF] hover:bg-[#0057d9] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition">
            ${IconZalo('w-5 h-5 flex-shrink-0 rounded-[5px] bg-white p-0.5')}
            <span>Chat Zalo</span>
          </a>
          <a href="${fbHref}" target="_blank" rel="noopener noreferrer"
            class="py-2.5 px-2 rounded-xl bg-[#1877F2] hover:bg-[#1464cc] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition">
            ${IconFacebook('w-4 h-4')}
            <span>Facebook</span>
          </a>
          <a href="tel:${rawPhone}"
            class="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition">
            ${IconPhone('w-3.5 h-3.5')}
            <span class="truncate">${displayPhone}</span>
          </a>
        </div>
      </div>
    `;
  }

  _buildGuideTabHtml() {
    const videoInfo = resolveVideoEmbed(this.config.guideVideoUrl);
    let videoSectionHtml = '';

    if (videoInfo?.type === 'iframe') {
      videoSectionHtml = `
        <div class="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-black aspect-video w-full">
          <iframe src="${escapeHtml(videoInfo.src)}" title="Video hướng dẫn đặt hộ Jollibee"
            class="w-full h-full" frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen loading="lazy"></iframe>
        </div>
      `;
    } else if (videoInfo?.type === 'video') {
      videoSectionHtml = `
        <div class="rounded-2xl overflow-hidden border border-gray-200 shadow-sm bg-black w-full">
          <video src="${escapeHtml(videoInfo.src)}" controls playsinline preload="metadata" class="w-full max-h-[60vh] mx-auto"></video>
        </div>
      `;
    } else if (videoInfo?.type === 'link') {
      videoSectionHtml = `
        <a href="${escapeHtml(videoInfo.src)}" target="_blank" rel="noopener noreferrer"
          class="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[#d71920] to-orange-500 text-white shadow-md hover:opacity-95 active:scale-[0.99] transition">
          <div class="flex items-center gap-3">
            ${IconPlayCircle('w-9 h-9 text-amber-300 flex-shrink-0')}
            <div>
              <div class="font-black text-sm">Xem Video Hướng Dẫn Chi Tiết</div>
              <div class="text-[11px] text-amber-100">Nhấn để mở video hướng dẫn đặt đơn cực dễ</div>
            </div>
          </div>
          <span class="bg-white text-[#d71920] text-xs font-extrabold px-3 py-1.5 rounded-xl flex-shrink-0">Mở xem</span>
        </a>
      `;
    } else {
      videoSectionHtml = `
        <div class="p-4 rounded-2xl bg-gradient-to-br from-amber-50 via-red-50/40 to-orange-50 border border-dashed border-amber-300 flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-2xl bg-[#d71920]/10 text-[#d71920] flex items-center justify-center flex-shrink-0">
            ${IconPlayCircle('w-7 h-7')}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-extrabold text-xs sm:text-sm text-gray-900">Video hướng dẫn thực tế</span>
              <span class="text-[10px] font-black bg-amber-200/80 text-amber-950 px-2 py-0.5 rounded-full">Sắp cập nhật</span>
            </div>
            <p class="text-[11px] text-gray-600 mt-0.5 leading-snug">
              Shop đang hoàn thiện video quay màn hình chi tiết. Trong lúc chờ, bạn xem 3 bước siêu dễ ngay bên dưới nhé!
            </p>
          </div>
        </div>
      `;
    }

    return `
      <div class="space-y-4">
        ${videoSectionHtml}

        <div class="space-y-2.5">
          <h4 class="font-black text-xs sm:text-sm uppercase tracking-wider text-gray-800">
            3 Bước Đặt Jollibee Giá Hời Cực Nhanh
          </h4>

          <div class="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3">
            <span class="w-7 h-7 rounded-full bg-[#d71920] text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <div class="text-xs sm:text-sm text-gray-700 leading-relaxed">
              <b class="text-gray-900">Chọn món yêu thích vào giỏ:</b> Bấm <b>Tùy Chỉnh Combo</b> để tự chọn vị gà (giòn/sốt cay), nước uống theo sở thích. Gom đơn từ <b>100k</b> giảm ngay <b>15k</b> (từ <b>200k</b> giảm <b>30k + Freeship</b>).
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3">
            <span class="w-7 h-7 rounded-full bg-[#d71920] text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <div class="text-xs sm:text-sm text-gray-700 leading-relaxed">
              <b class="text-gray-900">Chọn cách nhận & điền thông tin:</b> Mở <b>Xem Giỏ & Chốt Đơn</b>, chọn <b>Giao Tận Nơi</b> hoặc <b>Ăn Tại Quán</b> (có vòng cuộn hẹn giờ nhận món hôm nay, chuẩn bị đơn ít nhất 30 phút).
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-start gap-3">
            <span class="w-7 h-7 rounded-full bg-[#d71920] text-white font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <div class="text-xs sm:text-sm text-gray-700 leading-relaxed">
              <b class="text-gray-900">Sao chép & gửi Zalo / Facebook shop:</b> Bấm nút <b>Sao Chép Đơn</b> rồi dán gửi qua Zalo <b>0985194873</b> hoặc Facebook của shop để lên đơn Jollibee nóng hổi ngay!
            </div>
          </div>
        </div>

        ${this._buildContactBarHtml()}
      </div>
    `;
  }

  _buildReviewsTabHtml() {
    const reviews = Array.isArray(this.config.customerReviews) ? this.config.customerReviews : [];
    const starsHtml = Array.from({ length: 5 }, () => IconStar('w-3.5 h-3.5 text-amber-400')).join('');

    const cardsHtml = reviews.map(r => {
      const ratingCount = Math.min(5, Math.max(1, Number(r.rating) || 5));
      const itemStars = Array.from({ length: ratingCount }, () => IconStar('w-3 h-3 text-amber-400')).join('');
      const optionalImgHtml = r.image
        ? `<img src="${safeImageUrl(r.image)}" alt="Feedback của ${escapeHtml(r.author || 'khách hàng')}" loading="lazy" class="mt-2.5 rounded-xl border border-gray-200 max-h-56 object-contain bg-gray-50" onerror="this.onerror=null; this.src='${FALLBACK_FOOD_IMAGE}'">`
        : '';

      return `
        <div class="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <div class="font-extrabold text-xs sm:text-sm text-gray-900 flex items-center gap-1.5">
              <span>${escapeHtml(r.author || 'Khách hàng')}</span>
              <span class="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                ${IconCheckCircle('w-2.5 h-2.5')} Đã đặt
              </span>
            </div>
            <div class="flex items-center gap-0.5 flex-shrink-0" aria-label="${ratingCount} trên 5 sao">
              ${itemStars}
            </div>
          </div>
          ${r.tag ? `<div class="text-[11px] font-bold text-[#d71920]">${escapeHtml(r.tag)}${r.date ? ` • <span class="text-gray-500 font-medium">${escapeHtml(r.date)}</span>` : ''}</div>` : ''}
          <p class="text-xs sm:text-sm text-gray-700 leading-relaxed">"${escapeHtml(r.comment || '')}"</p>
          ${optionalImgHtml}
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-4">
        <div class="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex items-center justify-between gap-3">
          <div>
            <div class="text-xs font-extrabold text-amber-950 uppercase tracking-wide">Độ hài lòng khách hàng</div>
            <div class="flex items-center gap-1.5 mt-1">
              <span class="font-black text-2xl text-[#d71920]">5.0</span>
              <div class="flex items-center gap-0.5">${starsHtml}</div>
            </div>
            <p class="text-[11px] text-gray-600 mt-0.5">Hàng trăm đơn đặt hộ thành công nhanh chóng, nóng giòn</p>
          </div>
          <div class="w-12 h-12 rounded-2xl bg-white border border-amber-200 flex items-center justify-center text-amber-500 shadow-sm flex-shrink-0">
            ${IconStar('w-6 h-6')}
          </div>
        </div>

        <div class="space-y-2.5">
          ${cardsHtml}
        </div>

        ${this._buildContactBarHtml()}
      </div>
    `;
  }

  _buildPolicyTabHtml() {
    const policies = Array.isArray(this.config.shopPolicies) ? this.config.shopPolicies : [];
    const listHtml = policies.map(p => `
      <div class="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-1">
        <h4 class="font-extrabold text-xs sm:text-sm text-gray-900 flex items-center gap-1.5">
          <span class="text-emerald-600 flex-shrink-0">${IconShieldCheck('w-4 h-4')}</span>
          <span>${escapeHtml(p.title || '')}</span>
        </h4>
        <p class="text-xs sm:text-sm text-gray-700 leading-relaxed pl-5">${escapeHtml(p.desc || '')}</p>
      </div>
    `).join('');

    return `
      <div class="space-y-4">
        <div class="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-xs text-emerald-950 leading-relaxed flex items-start gap-2.5">
          <span class="text-emerald-600 flex-shrink-0 mt-0.5">${IconShieldCheck('w-5 h-5')}</span>
          <div>
            <b class="font-extrabold">Minh bạch & Uy tín đặt lên hàng đầu:</b> Bạn luôn biết trước chính xác số tiền thực trả trên web, cam kết không phát sinh bất kỳ phụ phí ẩn nào.
          </div>
        </div>

        <div class="space-y-2.5">
          ${listHtml}
        </div>

        ${this._buildContactBarHtml()}
      </div>
    `;
  }

  render() {
    const container = this.getContainer();
    const existingPanel = typeof container.querySelector === 'function' ? container.querySelector('#info-modal-panel') : null;

    if (existingPanel && this._renderedVideoUrl === (this.config?.guideVideoUrl || '')) {
      this._syncActiveTabDOM(existingPanel);
      return;
    }

    this._renderedVideoUrl = this.config?.guideVideoUrl || '';
    const activeIdx = Math.max(0, TAB_ORDER.indexOf(this.activeTab));

    const tabBtnClass = (tabKey) =>
      `info-modal-tab-btn relative z-10 py-2 px-2 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 transition-colors duration-150 select-none ${
        this.activeTab === tabKey ? 'text-white' : 'text-gray-700 hover:text-gray-950'
      }`;

    container.innerHTML = `
      <div id="info-modal-backdrop" class="fixed inset-0 z-[120] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-backdrop" role="dialog" aria-modal="true" aria-labelledby="info-modal-title">
        <div id="info-modal-panel" class="relative w-full max-w-lg max-h-[88vh] bg-gray-50 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-panel transform-gpu will-change-transform border border-gray-100">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3.5 bg-[#d71920] text-white flex-shrink-0">
            <h3 id="info-modal-title" class="font-extrabold text-sm sm:text-base truncate pr-2">
              Thông Tin & Hướng Dẫn Đặt Hộ
            </h3>
            <button type="button" id="info-modal-close-btn" aria-label="Đóng bảng thông tin" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition active:scale-95">
              ${IconX('w-4 h-4')}
            </button>
          </div>

          <!-- Switchable 3-Tab Segmented Control (GPU Sliding Indicator) -->
          <div class="px-3.5 pt-3 pb-2.5 bg-white border-b border-gray-200 flex-shrink-0">
            <div class="relative bg-gray-100 p-1 rounded-2xl grid grid-cols-3" role="tablist" aria-label="Chuyên mục thông tin">
              <div id="info-tab-indicator" aria-hidden="true"
                class="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-xl bg-[#d71920] shadow-sm transition-transform duration-200 ease-out will-change-transform"
                style="transform: translate3d(${activeIdx * 100}%, 0, 0);"></div>

              <button type="button" role="tab" aria-selected="${this.activeTab === 'guide' ? 'true' : 'false'}" data-tab="guide" class="${tabBtnClass('guide')}">
                ${IconPlayCircle('w-3.5 h-3.5 flex-shrink-0')}
                <span>Hướng dẫn</span>
              </button>
              <button type="button" role="tab" aria-selected="${this.activeTab === 'reviews' ? 'true' : 'false'}" data-tab="reviews" class="${tabBtnClass('reviews')}">
                ${IconStar('w-3.5 h-3.5 flex-shrink-0')}
                <span>Feedback</span>
              </button>
              <button type="button" role="tab" aria-selected="${this.activeTab === 'policy' ? 'true' : 'false'}" data-tab="policy" class="${tabBtnClass('policy')}">
                ${IconShieldCheck('w-3.5 h-3.5 flex-shrink-0')}
                <span>Chính sách</span>
              </button>
            </div>
          </div>

          <!-- Pre-mounted 3 Tab Panels (Chuyển tab tức thì không reload DOM) -->
          <div class="info-modal-scroll-body p-4 overflow-y-auto flex-1 overscroll-contain">
            <div data-tab-panel="guide" class="${this.activeTab === 'guide' ? 'block' : 'hidden'}">
              ${this._buildGuideTabHtml()}
            </div>
            <div data-tab-panel="reviews" class="${this.activeTab === 'reviews' ? 'block' : 'hidden'}">
              ${this._buildReviewsTabHtml()}
            </div>
            <div data-tab-panel="policy" class="${this.activeTab === 'policy' ? 'block' : 'hidden'}">
              ${this._buildPolicyTabHtml()}
            </div>
          </div>
        </div>
      </div>
    `;

    const panelEl = typeof container.querySelector === 'function' ? container.querySelector('#info-modal-panel') : null;
    if (panelEl && typeof panelEl.addEventListener === 'function') {
      panelEl.addEventListener(
        'animationend',
        () => {
          panelEl.classList?.remove('animate-modal-panel');
        },
        { once: true }
      );
    }

    if (this._releaseFocusTrap) {
      this._releaseFocusTrap();
    }
    this._releaseFocusTrap = trapFocusInModal(panelEl || container);

    const closeBtn = typeof document.getElementById === 'function' ? document.getElementById('info-modal-close-btn') : null;
    closeBtn?.addEventListener('click', () => this.close());

    const backdrop = typeof document.getElementById === 'function' ? document.getElementById('info-modal-backdrop') : null;
    if (backdrop && typeof backdrop.addEventListener === 'function') {
      let isDownOnBackdrop = false;
      backdrop.addEventListener('mousedown', (e) => { isDownOnBackdrop = e.target === backdrop; });
      backdrop.addEventListener('touchstart', (e) => { isDownOnBackdrop = e.target === backdrop; }, { passive: true });
      backdrop.addEventListener('click', (e) => {
        if (isDownOnBackdrop && e.target === backdrop) this.close();
        isDownOnBackdrop = false;
      });
    }

    if (typeof container.querySelectorAll === 'function') {
      container.querySelectorAll('.info-modal-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.tab) this.switchTab(btn.dataset.tab);
        });
      });
    }
  }
}
