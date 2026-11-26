import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { InfoModal, resolveVideoEmbed } from '../js/components/info-modal.js';
import { getActiveModalCount, resetActiveModalCount } from '../js/utils.js';

describe('InfoModal (Guide Video, Customer Reviews & Policies)', () => {
  it('resolveVideoEmbed nhận diện chuẩn YouTube, YouTube Shorts, MP4 và chặn URL không an toàn', () => {
    const yt1 = resolveVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.deepEqual(yt1, { type: 'iframe', src: 'https://www.youtube.com/embed/dQw4w9WgXcQ' });

    const ytShorts = resolveVideoEmbed('https://www.youtube.com/shorts/abc123XYZ_-');
    assert.deepEqual(ytShorts, { type: 'iframe', src: 'https://www.youtube.com/embed/abc123XYZ_-' });

    const mp4 = resolveVideoEmbed('videos/huong-dan.mp4');
    assert.deepEqual(mp4, { type: 'video', src: 'videos/huong-dan.mp4' });

    assert.equal(resolveVideoEmbed(''), null);
    assert.equal(resolveVideoEmbed('javascript:alert(1)'), null);
  });

  it('InfoModal mở đúng từng tab (guide, reviews, policy), tích hợp Modal Stack và hiển thị khung chờ khi chưa có video', () => {
    resetActiveModalCount();
    const mockContainer = {
      id: 'info-modal-container',
      innerHTML: '',
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; }
    };

    global.document = {
      body: { classList: { add() {}, remove() {} }, appendChild() {} },
      getElementById: (id) => (id === 'info-modal-container' ? mockContainer : null),
      createElement: () => mockContainer,
      addEventListener() {},
      removeEventListener() {}
    };

    const config = {
      zaloLink: 'https://zalo.me/0985194873',
      facebookUrl: 'https://www.facebook.com/trnblng',
      hotline: '0985194873',
      guideVideoUrl: '',
      customerReviews: [
        { author: 'Minh Anh', tag: 'Đặt Combo Cặp Đôi', rating: 5, comment: 'Gà nóng giòn giao tận tay, rẻ hơn đặt thẳng!' }
      ],
      shopPolicies: [
        { title: 'Chính hãng 100%', desc: 'Đơn đặt trực tiếp trên hệ thống Jollibee Việt Nam.' }
      ]
    };

    const modal = new InfoModal(config);

    // 1. Mở tab Hướng dẫn khi guideVideoUrl đang trống -> hiện hướng dẫn từng bước & khung chờ video
    modal.open('guide');
    assert.equal(getActiveModalCount(), 1);
    assert.ok(mockContainer.innerHTML.includes('Hướng dẫn'));
    assert.ok(mockContainer.innerHTML.includes('https://www.facebook.com/trnblng'));

    // 2. Chuyển sang tab Đánh giá / Feedback
    modal.switchTab('reviews');
    assert.ok(mockContainer.innerHTML.includes('Minh Anh'));
    assert.ok(mockContainer.innerHTML.includes('Gà nóng giòn giao tận tay'));

    // 3. Chuyển sang tab Chính sách
    modal.switchTab('policy');
    assert.ok(mockContainer.innerHTML.includes('Chính hãng 100%'));

    // 4. Khi cấu hình guideVideoUrl có link YouTube -> tự động nhúng iframe video
    modal.config.guideVideoUrl = 'https://youtu.be/dQw4w9WgXcQ';
    modal.switchTab('guide');
    assert.ok(mockContainer.innerHTML.includes('https://www.youtube.com/embed/dQw4w9WgXcQ'));

    modal.close();
    assert.equal(getActiveModalCount(), 0);
    assert.equal(mockContainer.innerHTML, '');
  });

  it('chuyển tab bên trong InfoModal giữ nguyên shell modal (không reload/chớp trắng) và không dùng backdrop-blur gây lag GPU', () => {
    resetActiveModalCount();
    let containerSetCount = 0;
    let htmlValue = '';

    const tabBtns = ['guide', 'reviews', 'policy'].map(tab => ({
      dataset: { tab },
      className: '',
      attrs: {},
      setAttribute(k, v) { this.attrs[k] = v; },
      addEventListener() {}
    }));

    const tabPanels = ['guide', 'reviews', 'policy'].map(tab => {
      const classes = new Set(tab === 'guide' ? ['block'] : ['hidden']);
      return {
        dataset: { tabPanel: tab },
        classList: {
          add: (...c) => c.forEach(x => classes.add(x)),
          remove: (...c) => c.forEach(x => classes.delete(x)),
          contains: (c) => classes.has(c)
        }
      };
    });

    const mockIndicator = { style: { transform: '' } };
    const mockScrollBody = { scrollTop: 120 };
    const mockPanel = {
      id: 'info-modal-panel',
      classList: { remove() {} },
      addEventListener() {},
      querySelector(sel) {
        if (sel === '#info-tab-indicator') return mockIndicator;
        if (sel === '.info-modal-scroll-body') return mockScrollBody;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.info-modal-tab-btn') return tabBtns;
        if (sel === '[data-tab-panel]') return tabPanels;
        return [];
      }
    };

    const mockContainer = {
      id: 'info-modal-container',
      get innerHTML() { return htmlValue; },
      set innerHTML(val) {
        htmlValue = val;
        if (val !== '') containerSetCount++;
      },
      querySelector(sel) {
        if (sel === '#info-modal-panel' && htmlValue.includes('info-modal-panel')) return mockPanel;
        return null;
      },
      querySelectorAll(sel) {
        return mockPanel.querySelectorAll(sel);
      }
    };

    global.document = {
      body: { classList: { add() {}, remove() {} }, appendChild() {} },
      getElementById: (id) => (id === 'info-modal-container' ? mockContainer : null),
      createElement: () => mockContainer,
      addEventListener() {},
      removeEventListener() {}
    };

    const modal = new InfoModal({
      customerReviews: [{ author: 'Khách A', rating: 5, comment: 'Ngon!' }],
      shopPolicies: [{ title: 'Cam kết', desc: 'Uy tín' }]
    });

    modal.open('guide');
    assert.equal(containerSetCount, 1, 'Chỉ gán innerHTML 1 lần duy nhất khi mở modal');
    assert.ok(!htmlValue.includes('backdrop-blur'), 'Không dùng backdrop-blur gây tụt FPS');

    // Chuyển sang tab Feedback & Chính sách KHÔNG được gán lại container.innerHTML (không reload modal)
    modal.switchTab('reviews');
    assert.equal(containerSetCount, 1, 'Chuyển sang tab reviews không được reload lại modal shell');
    assert.equal(tabPanels[0].classList.contains('hidden'), true);
    assert.equal(tabPanels[1].classList.contains('hidden'), false);
    assert.equal(mockIndicator.style.transform, 'translate3d(100%, 0, 0)');
    assert.equal(mockScrollBody.scrollTop, 0);

    modal.switchTab('policy');
    assert.equal(containerSetCount, 1, 'Chuyển sang tab policy không được reload lại modal shell');
    assert.equal(tabPanels[1].classList.contains('hidden'), true);
    assert.equal(tabPanels[2].classList.contains('hidden'), false);
    assert.equal(mockIndicator.style.transform, 'translate3d(200%, 0, 0)');

    modal.close();
  });
});
