import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { initContentProtection, isBlockedShortcut } from '../js/protection.js';

describe('Security Headers & Anti-F12 Protection', () => {
  it('vercel.json cấu hình đầy đủ HTTP Security Headers chống Clickjacking (X-Frame-Options, CSP frame-ancestors, nosniff, HSTS)', () => {
    const raw = fs.readFileSync('vercel.json', 'utf8');
    const parsed = JSON.parse(raw);
    assert.ok(Array.isArray(parsed.headers), 'vercel.json phải có mảng headers');

    const globalRule = parsed.headers.find(h => h.source === '/(.*)');
    assert.ok(globalRule, 'Phải có rule áp dụng cho toàn bộ đường dẫn /(.*)');

    const headerMap = Object.fromEntries(globalRule.headers.map(h => [h.key, h.value]));
    assert.equal(headerMap['X-Frame-Options'], 'DENY');
    assert.equal(headerMap['X-Content-Type-Options'], 'nosniff');
    assert.ok(headerMap['Strict-Transport-Security']?.includes('max-age='));
    assert.ok(headerMap['Content-Security-Policy']?.includes("frame-ancestors 'none'"));
  });

  it('isBlockedShortcut nhận diện chuẩn F12, Ctrl+Shift+I/J/C, Cmd+Option+I, Ctrl+U, Ctrl+S nhưng không chặn phím gõ thường hay Ctrl+C/Ctrl+V', () => {
    assert.equal(isBlockedShortcut({ key: 'F12' }), true);
    assert.equal(isBlockedShortcut({ keyCode: 123 }), true);
    assert.equal(isBlockedShortcut({ key: 'I', ctrlKey: true, shiftKey: true }), true);
    assert.equal(isBlockedShortcut({ key: 'j', ctrlKey: true, shiftKey: true }), true);
    assert.equal(isBlockedShortcut({ key: 'c', ctrlKey: true, shiftKey: true }), true);
    assert.equal(isBlockedShortcut({ key: 'i', metaKey: true, altKey: true }), true);
    assert.equal(isBlockedShortcut({ key: 'u', ctrlKey: true }), true);
    assert.equal(isBlockedShortcut({ key: 's', ctrlKey: true }), true);

    // Các tổ hợp phím hợp lệ của khách hàng (sao chép Ctrl+C, dán địa chỉ Ctrl+V, chọn hết Ctrl+A, gõ chữ) KHÔNG bị chặn
    assert.equal(isBlockedShortcut({ key: 'c', ctrlKey: true, shiftKey: false }), false);
    assert.equal(isBlockedShortcut({ key: 'v', ctrlKey: true, shiftKey: false }), false);
    assert.equal(isBlockedShortcut({ key: 'a', ctrlKey: true, shiftKey: false }), false);
    assert.equal(isBlockedShortcut({ key: 'Enter' }), false);
    assert.equal(isBlockedShortcut({ key: 'Escape' }), false);
  });

  it('initContentProtection chặn chuột phải trên trang nhưng vẫn cho phép chuột phải/Paste bên trong ô input & textarea của khách', () => {
    const listeners = {};
    global.document = {
      addEventListener: (ev, fn) => { listeners[ev] = fn; },
      removeEventListener: (ev) => { delete listeners[ev]; }
    };

    const handle = initContentProtection({ enableContentProtection: true });

    // 1. Nhấn F12 -> bị chặn preventDefault
    let f12Prevented = false;
    listeners.keydown({
      key: 'F12',
      preventDefault() { f12Prevented = true; },
      stopPropagation() {}
    });
    assert.equal(f12Prevented, true);

    // 2. Chuột phải vào nền web / thẻ món -> bị chặn preventDefault
    let cardMenuPrevented = false;
    listeners.contextmenu({
      target: { tagName: 'DIV', closest: () => null },
      preventDefault() { cardMenuPrevented = true; }
    });
    assert.equal(cardMenuPrevented, true);

    // 3. Chuột phải / nhấn giữ vào ô <input> địa chỉ của khách -> KHÔNG bị chặn (để khách bấm Dán / Paste)
    let inputMenuPrevented = false;
    listeners.contextmenu({
      target: { tagName: 'INPUT', closest: (sel) => (sel.includes('input') ? {} : null) },
      preventDefault() { inputMenuPrevented = true; }
    });
    assert.equal(inputMenuPrevented, false);

    // 4. Kéo ảnh món ăn (dragstart trên IMG) -> bị chặn
    let dragPrevented = false;
    listeners.dragstart({
      target: { tagName: 'IMG', closest: () => ({}) },
      preventDefault() { dragPrevented = true; }
    });
    assert.equal(dragPrevented, true);

    handle.destroy();
    assert.equal(listeners.keydown, undefined);
  });
});
