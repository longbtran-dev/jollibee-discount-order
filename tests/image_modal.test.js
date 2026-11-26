import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ImageModal } from '../js/components/image-modal.js';
import { resetActiveModalCount } from '../js/utils.js';

describe('Image Modal Lightbox Component', () => {
  let mockBody;
  let mockContainer;
  let eventListeners;

  beforeEach(() => {
    resetActiveModalCount();
    eventListeners = {};
    mockBody = {
      classList: {
        classes: new Set(),
        add(cls) { this.classes.add(cls); },
        remove(cls) { this.classes.delete(cls); },
        contains(cls) { return this.classes.has(cls); }
      },
      appendChild(el) {}
    };

    mockContainer = {
      id: 'image-modal-container',
      innerHTML: '',
      querySelector(selector) {
        if (selector === 'h3') return { textContent: 'Gà Giòn Vui Vẻ' };
        if (selector === 'img') return { getAttribute: () => 'https://jollibee.com.vn/media/ga.png' };
        return null;
      }
    };

    global.document = {
      body: mockBody,
      getElementById(id) {
        if (id === 'image-modal-container') return mockContainer;
        if (id === 'image-modal-backdrop') return { id: 'image-modal-backdrop', addEventListener: (ev, fn) => { (eventListeners[ev] = eventListeners[ev] || []).push(fn); } };
        if (id === 'image-modal-close-btn') return { addEventListener: (ev, fn) => { (eventListeners['closeClick'] = eventListeners['closeClick'] || []).push(fn); } };
        if (id === 'image-modal-action-btn') return { addEventListener: (ev, fn) => { (eventListeners['actionClick'] = eventListeners['actionClick'] || []).push(fn); } };
        return null;
      },
      createElement(tag) {
        return mockContainer;
      },
      addEventListener(ev, fn) {
        (eventListeners[ev] = eventListeners[ev] || []).push(fn);
      },
      removeEventListener(ev, fn) {}
    };
  });

  it('khởi tạo ImageModal với container mặc định', () => {
    const modal = new ImageModal();
    assert.equal(modal.containerId, 'image-modal-container');
  });

  it('open() nạp HTML modal và thêm class overflow-hidden vào body', () => {
    const modal = new ImageModal();
    modal.open({
      title: 'Gà Giòn Vui Vẻ',
      image: 'https://jollibee.com.vn/media/ga.png',
      price: 32000,
      originalPrice: 35000,
      isCombo: false
    });

    assert.ok(mockContainer.innerHTML.includes('Gà Giòn Vui Vẻ'));
    assert.ok(mockContainer.innerHTML.includes('image-modal-backdrop'));
    assert.ok(mockContainer.innerHTML.includes('32.000'));
    assert.ok(mockBody.classList.contains('overflow-hidden'));
  });

  it('close() dọn dẹp HTML container và gỡ class overflow-hidden', () => {
    const modal = new ImageModal();
    modal.open({
      title: 'Mì Ý Jolly',
      image: 'https://jollibee.com.vn/media/mi.png'
    });

    assert.ok(mockBody.classList.contains('overflow-hidden'));
    modal.close();

    assert.equal(mockContainer.innerHTML, '');
    assert.equal(mockBody.classList.contains('overflow-hidden'), false);
  });

  it('open() hỗ trợ truyền onAction để hiển thị nút hành động', () => {
    let actionFired = false;
    const modal = new ImageModal();
    modal.open({
      title: 'Combo Hít Hà',
      image: 'https://jollibee.com.vn/media/combo.png',
      price: 68000,
      isCombo: true,
      onAction: () => { actionFired = true; }
    });

    assert.ok(mockContainer.innerHTML.includes('image-modal-action-btn'));
    assert.ok(mockContainer.innerHTML.includes('Tùy Chỉnh Combo'));

    // Trigger action click
    if (eventListeners['actionClick']) {
      eventListeners['actionClick'].forEach(fn => fn());
    }
    assert.equal(actionFired, true);
    assert.equal(mockContainer.innerHTML, '');
  });

  it('chặn URL ảnh độc hại chống XSS và không gọi tới images/placeholder.png gây lỗi 404', () => {
    const modal = new ImageModal();
    modal.open({
      title: 'Test XSS',
      image: 'javascript:alert(1)'
    });
    assert.ok(!mockContainer.innerHTML.includes('javascript:alert'));
    assert.ok(!mockContainer.innerHTML.includes('images/placeholder.png'));
    assert.ok(mockContainer.innerHTML.includes('data:image/svg+xml'));
    modal.close();
  });
});
