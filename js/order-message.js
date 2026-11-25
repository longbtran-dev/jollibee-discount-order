/**
 * Định dạng nội dung tin nhắn gửi đơn hàng qua Zalo / Facebook Messenger
 */

/**
 * Định dạng số tiền sang định dạng tiền Việt Nam (ví dụ 100.000đ)
 */
export function formatCurrency(amount) {
  const val = Number(amount) || 0;
  return `${val.toLocaleString('vi-VN')}đ`;
}

/**
 * Tạo nội dung tin nhắn gửi đơn hàng chuẩn, đẹp mắt
 * @param {object} customer - Thông tin khách hàng { name, phone, address, note }
 * @param {Array} items - Danh sách món trong giỏ
 * @param {object} pricing - Kết quả tính giá { originalTotal, discountAmount, shippingFee, finalTotal }
 * @param {'delivery' | 'dinein'} orderType - Hình thức nhận hàng
 * @returns {string} Chuỗi văn bản tin nhắn
 */
export function formatOrderText(customer = {}, items = [], pricing = {}, orderType = 'delivery') {
  const typeText = orderType === 'delivery' ? '[GIAO TẬN NƠI]' : '[ĂN TẠI QUÁN / TỚI LẤY]';
  
  const lines = [
    `HÌNH THỨC: ${typeText}`
  ];

  if (orderType === 'delivery') {
    lines.push(`• Khách hàng: ${customer.name || '(Chưa nhập)'}`);
    lines.push(`• Số điện thoại: ${customer.phone || '(Chưa nhập)'}`);
    lines.push(`• Địa chỉ giao hàng: ${customer.address || '(Chưa nhập)'}`);
    if (customer.note && customer.note.trim()) {
      lines.push(`• Ghi chú: ${customer.note.trim()}`);
    }
  } else {
    // Ăn tại quán: không yêu cầu thông tin khách hàng
    if (customer.name && customer.name.trim()) {
      lines.push(`• Khách hàng: ${customer.name.trim()}`);
    }
    if (customer.note && customer.note.trim()) {
      lines.push(`• Ghi chú: ${customer.note.trim()}`);
    }
  }

  lines.push(``);
  lines.push(`DANH SÁCH MÓN ĂN:`);
  lines.push(`--------------------------------`);

  items.forEach((item, index) => {
    const itemTotal = (item.unitPrice || 0) * (item.quantity || 1);
    lines.push(`${index + 1}. ${item.name} x${item.quantity || 1} -> ${formatCurrency(itemTotal)}`);
    if (Array.isArray(item.selectedOptions) && item.selectedOptions.length > 0) {
      lines.push(`   └ Món gồm:`);
      item.selectedOptions.forEach(opt => {
        const extra = opt.extra_price > 0 ? ` (+${formatCurrency(opt.extra_price)})` : '';
        lines.push(`     • ${opt.option_name || opt.name}${extra}`);
      });
    } else if (item.optionsText) {
      const parts = item.optionsText.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length > 1) {
        lines.push(`   └ Món gồm:`);
        parts.forEach(p => lines.push(`     • ${p}`));
      } else {
        lines.push(`   └ Tuỳ chọn: ${item.optionsText}`);
      }
    }
  });

  lines.push(`--------------------------------`);
  lines.push(`BÁO GIÁ CHI TIẾT:`);
  lines.push(`• Tổng tiền gốc Jollibee: ${formatCurrency(pricing.originalTotal)}`);
  lines.push(`• Chiết khấu dịch vụ: -${formatCurrency(pricing.discountAmount)}`);

  if (orderType === 'delivery') {
    const shipText = pricing.shippingFee === 0 ? 'Miễn phí (đơn từ 200k)' : formatCurrency(pricing.shippingFee);
    lines.push(`• Phí giao hàng: ${shipText}`);
  } else {
    lines.push(`• Phí giao hàng: 0đ (Ăn tại quán)`);
  }

  lines.push(`=> TỔNG THANH TOÁN THỰC TẾ: ${formatCurrency(pricing.finalTotal)}`);
  if (pricing.originalTotal < 100000) {
    lines.push(`(Lưu ý: Đơn hàng dưới 100k - Chưa áp dụng chính sách giảm giá)`);
  }

  return lines.join('\n');
}

/**
 * Tạo link mở ứng dụng Zalo gửi tin nhắn
 * @param {string} phoneOrLink - Số điện thoại Zalo hoặc link https://zalo.me/...
 * @param {string} messageText - Nội dung tin nhắn
 */
export function generateZaloUrl(phoneOrLink, messageText) {
  let baseUrl = phoneOrLink || '';
  if (!baseUrl.startsWith('http')) {
    const cleanPhone = baseUrl.replace(/\D/g, '');
    baseUrl = `https://zalo.me/${cleanPhone}`;
  }
  baseUrl = baseUrl.replace(/\/+$/, '');
  const encodedText = encodeURIComponent(messageText);
  return `${baseUrl}?text=${encodedText}`;
}

/**
 * Tạo link mở Facebook Messenger
 * @param {string} fbLink - Đường dẫn Messenger https://m.me/...
 * @param {string} messageText - Nội dung tin nhắn
 */
export function generateMessengerUrl(fbLink, messageText) {
  let baseUrl = fbLink || 'https://m.me/';
  baseUrl = baseUrl.replace(/\/+$/, '');
  const encodedText = encodeURIComponent(messageText);
  return `${baseUrl}?text=${encodedText}`;
}
