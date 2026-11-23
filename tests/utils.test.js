import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, formatDescriptionHtml } from '../js/utils.js';

describe('Utility Functions', () => {
  it('escapeHtml mã hóa an toàn các ký tự độc hại chống XSS', () => {
    assert.equal(
      escapeHtml('<img src=x onerror=alert(1)>'),
      '&lt;img src=x onerror=alert(1)&gt;'
    );
    assert.equal(
      escapeHtml('"hello" & \'world\''),
      '&quot;hello&quot; &amp; &#39;world&#39;'
    );
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(null), '');
  });

  it('formatDescriptionHtml tách combo có dấu "+" thành danh sách từng món xuống dòng', () => {
    const raw = '2 Mì ý sốt cay vừa + 1 Gà Sốt cay + 1 Gà Giòn Vui Vẻ + 2 Nước ngọt + 1 Khoai tây chiên vừa';
    const html = formatDescriptionHtml(raw);
    assert.ok(html.includes('Combo bao gồm:'));
    assert.ok(html.includes('2 Mì ý sốt cay vừa'));
    assert.ok(html.includes('1 Gà Sốt cay'));
    assert.ok(html.includes('1 Gà Giòn Vui Vẻ'));
    assert.ok(html.includes('2 Nước ngọt'));
    assert.ok(html.includes('1 Khoai tây chiên vừa'));
    assert.ok(html.includes('•'));
  });

  it('formatDescriptionHtml giữ nguyên đoạn văn bản khi không có dấu "+"', () => {
    const raw = 'Burger với phi lê gà giòn rụm thơm ngon';
    const html = formatDescriptionHtml(raw);
    assert.ok(html.includes('<p class="text-xs text-gray-500 mt-1 leading-relaxed">'));
    assert.ok(html.includes('Burger với phi lê gà giòn rụm thơm ngon'));
  });
});
