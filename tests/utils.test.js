import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  escapeHtml,
  formatDescriptionHtml,
  isValidVietnamesePhone,
  debounce,
  lockBodyScroll,
  unlockBodyScroll,
  getActiveModalCount,
  resetActiveModalCount,
  registerOpenModal,
  unregisterOpenModal,
  trapFocusInModal,
  normalizeVietnamese,
  safeImageUrl,
  FALLBACK_FOOD_IMAGE
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

  it('registerOpenModal & unregisterOpenModal quản lý Modal Stack LIFO và chỉ đóng modal trên cùng khi bấm Escape', () => {
    resetActiveModalCount();
    const mockClassList = new Set();
    const keyListeners = [];

    global.document = {
      body: {
        classList: {
          add: (cls) => mockClassList.add(cls),
          remove: (cls) => mockClassList.delete(cls),
          contains: (cls) => mockClassList.has(cls)
        }
      },
      addEventListener: (ev, fn) => {
        if (ev === 'keydown') keyListeners.push(fn);
      },
      removeEventListener: () => {}
    };

    let drawerClosed = 0;
    let imageModalClosed = 0;

    // Mở CartDrawer 2 lần liên tiếp (chạm đúp) -> chỉ đăng ký 1 định danh duy nhất
    registerOpenModal('cart-drawer', () => {
      drawerClosed++;
      unregisterOpenModal('cart-drawer');
    });
    registerOpenModal('cart-drawer', () => {
      drawerClosed++;
      unregisterOpenModal('cart-drawer');
    });
    assert.equal(getActiveModalCount(), 1);
    assert.equal(mockClassList.has('overflow-hidden'), true);

    // Mở chồng ImageModal bên trên CartDrawer
    registerOpenModal('image-modal', () => {
      imageModalClosed++;
      unregisterOpenModal('image-modal');
    });
    assert.equal(getActiveModalCount(), 2);

    // Nhấn phím Escape lần 1 -> CHỈ đóng ImageModal, CartDrawer vẫn mở!
    keyListeners.forEach(fn => fn({ key: 'Escape', preventDefault() {}, stopPropagation() {} }));
    assert.equal(imageModalClosed, 1);
    assert.equal(drawerClosed, 0);
    assert.equal(getActiveModalCount(), 1);
    assert.equal(mockClassList.has('overflow-hidden'), true);

    // Nhấn phím Escape lần 2 -> đóng nốt CartDrawer và gỡ overflow-hidden
    keyListeners.forEach(fn => fn({ key: 'Escape', preventDefault() {}, stopPropagation() {} }));
    assert.equal(drawerClosed, 1);
    assert.equal(getActiveModalCount(), 0);
    assert.equal(mockClassList.has('overflow-hidden'), false);
  });

  it('normalizeVietnamese bỏ dấu tiếng Việt, quy đồng đ/d và mỳ/mì chính xác', () => {
    assert.equal(normalizeVietnamese('Gà Giòn Vui Vẻ'), 'ga gion vui ve');
    assert.equal(normalizeVietnamese('Đùi Gà Sốt Đậm Đà'), 'dui ga sot dam da');
    assert.equal(normalizeVietnamese('Mỳ Ý Sốt Bò Bằm'), normalizeVietnamese('Mì Ý Sốt Bò Bằm'));
    assert.equal(normalizeVietnamese('  my   y  '), 'mi y');
    assert.equal(normalizeVietnamese(null), '');
  });

  it('safeImageUrl chặn javascript: URI độc hại và trả về SVG dự phòng nội tuyến khi rỗng', () => {
    assert.equal(safeImageUrl(''), FALLBACK_FOOD_IMAGE);
    assert.equal(safeImageUrl(null), FALLBACK_FOOD_IMAGE);
    assert.equal(safeImageUrl('javascript:alert(1)'), FALLBACK_FOOD_IMAGE);
    assert.equal(safeImageUrl('  javascript:void(0) '), FALLBACK_FOOD_IMAGE);
    assert.equal(safeImageUrl('data:text/html,<script>alert(1)</script>'), FALLBACK_FOOD_IMAGE);
    assert.equal(safeImageUrl('images/products/ga.jpg'), 'images/products/ga.jpg');
    assert.equal(safeImageUrl('images/a"b.jpg'), 'images/a&quot;b.jpg');
    assert.ok(FALLBACK_FOOD_IMAGE.startsWith('data:image/svg+xml'));
  });

  it('trapFocusInModal giữ vòng lặp phím Tab trong Modal và khôi phục Focus khi đóng', () => {
    let focusedEl = null;
    const openerBtn = { id: 'opener', focus() { focusedEl = this; } };
    focusedEl = openerBtn;

    const btnFirst = { id: 'first', offsetParent: {}, focus() { focusedEl = this; } };
    const btnLast = { id: 'last', offsetParent: {}, focus() { focusedEl = this; } };
    let modalKeyHandler = null;

    const mockModal = {
      querySelectorAll: () => [btnFirst, btnLast],
      addEventListener: (ev, fn) => { if (ev === 'keydown') modalKeyHandler = fn; },
      removeEventListener: (ev, fn) => { if (ev === 'keydown' && modalKeyHandler === fn) modalKeyHandler = null; }
    };

    global.document = {
      get activeElement() { return focusedEl; }
    };

    const release = trapFocusInModal(mockModal);
    // Focus ban đầu nhảy vào phần tử đầu tiên trong Modal
    assert.equal(focusedEl, btnFirst);

    // Shift + Tab ở phần tử đầu tiên -> vòng xuống phần tử cuối cùng
    let prevented = false;
    modalKeyHandler({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(focusedEl, btnLast);

    // Tab ở phần tử cuối cùng -> vòng lại phần tử đầu tiên
    prevented = false;
    modalKeyHandler({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(focusedEl, btnFirst);

    // Giải phóng Focus Trap -> trả focus về nút đã mở Modal
    release();
    assert.equal(focusedEl, openerBtn);
    assert.equal(modalKeyHandler, null);
  });
});
