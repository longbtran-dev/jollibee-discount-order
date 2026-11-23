import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  formatDescriptionHtml,
  isValidVietnamesePhone,
  debounce,
  lockBodyScroll,
  unlockBodyScroll,
  getActiveModalCount
} from '../js/utils.js';

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

  it('isValidVietnamesePhone kiểm tra chuẩn xác số điện thoại di động Việt Nam', () => {
    // Hợp lệ: 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09
    assert.equal(isValidVietnamesePhone('0912345678'), true);
    assert.equal(isValidVietnamesePhone('0381234567'), true);
    assert.equal(isValidVietnamesePhone('0771234567'), true);
    assert.equal(isValidVietnamesePhone('0861234567'), true);
    assert.equal(isValidVietnamesePhone('0561234567'), true);
    assert.equal(isValidVietnamesePhone(' 098 765 4321 '), true); // tự làm sạch khoảng trắng

    // Không hợp lệ
    assert.equal(isValidVietnamesePhone(''), false);
    assert.equal(isValidVietnamesePhone(null), false);
    assert.equal(isValidVietnamesePhone('abc'), false);
    assert.equal(isValidVietnamesePhone('123456'), false);
    assert.equal(isValidVietnamesePhone('0241234567'), false); // máy bàn
    assert.equal(isValidVietnamesePhone('09123456789'), false); // 11 số
    assert.equal(isValidVietnamesePhone('0112345678'), false);
  });

  it('debounce trì hoãn thực thi hàm cho đến khi hết khoảng delay', async () => {
    let callCount = 0;
    let lastArg = '';
    const fn = debounce((arg) => {
      callCount++;
      lastArg = arg;
    }, 50);

    fn('a');
    fn('b');
    fn('c');
    assert.equal(callCount, 0); // Chưa chạy ngay lập tức

    await new Promise(r => setTimeout(r, 70));
    assert.equal(callCount, 1);
    assert.equal(lastArg, 'c');
  });

  it('lockBodyScroll và unlockBodyScroll đếm số modal mở để khóa cuộn an toàn', () => {
    const mockClassList = new Set();
    global.document = {
      body: {
        classList: {
          add: (cls) => mockClassList.add(cls),
          remove: (cls) => mockClassList.delete(cls),
          contains: (cls) => mockClassList.has(cls)
        }
      }
    };

    lockBodyScroll();
    assert.equal(getActiveModalCount(), 1);
    assert.equal(mockClassList.has('overflow-hidden'), true);

    lockBodyScroll(); // Mở modal thứ 2
    assert.equal(getActiveModalCount(), 2);
    assert.equal(mockClassList.has('overflow-hidden'), true);

    unlockBodyScroll(); // Đóng modal thứ 2, modal 1 vẫn mở -> không được gỡ overflow-hidden
    assert.equal(getActiveModalCount(), 1);
    assert.equal(mockClassList.has('overflow-hidden'), true);

    unlockBodyScroll(); // Đóng nốt modal 1 -> gỡ overflow-hidden
    assert.equal(getActiveModalCount(), 0);
    assert.equal(mockClassList.has('overflow-hidden'), false);
  });
});
