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
});
