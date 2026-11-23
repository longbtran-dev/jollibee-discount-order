import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/utils.js';

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
});
