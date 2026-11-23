/**
 * Các hàm tiện ích hỗ trợ an toàn và tương thích trình duyệt
 */

/**
 * Mã hóa an toàn chuỗi văn bản chống tấn công XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, match => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
}

/**
 * Sao chép văn bản vào bộ nhớ tạm với cơ chế Fallback tương thích unsecure HTTP
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard thất bại, chuyển sang fallback:', err);
    }
  }

  // Fallback qua textarea và document.execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('execCommand copy thất bại:', err);
    return false;
  }
}

/**
 * Định dạng mô tả món ăn / combo: nếu có chứa dấu "+" thì tự động tách thành danh sách từng món xuống dòng rõ ràng
 * @param {string} description
 * @returns {string} Chuỗi HTML hiển thị
 */
export function formatDescriptionHtml(description) {
  if (!description) {
    return `<p class="text-xs text-gray-500 mt-1 leading-relaxed">Hương vị giòn rụm thơm ngon đặc trưng của Jollibee</p>`;
  }

  if (description.includes('+')) {
    const parts = description.split('+').map(s => s.trim()).filter(Boolean);
    if (parts.length > 1) {
      const itemsHtml = parts.map(part => `
        <li class="flex items-start gap-1.5 text-xs text-gray-800 font-semibold leading-snug">
          <span class="text-[#d71920] font-black text-xs leading-none mt-0.5">•</span>
          <span class="break-words">${escapeHtml(part)}</span>
        </li>
      `).join('');

      return `
        <div class="mt-1.5 p-2 sm:p-2.5 bg-amber-50/70 rounded-xl border border-amber-200/60 shadow-2xs">
          <div class="text-[10px] font-black uppercase tracking-wider text-amber-900 mb-1 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[#d71920] flex-shrink-0"></span>
            <span>Combo bao gồm:</span>
          </div>
          <ul class="space-y-1">
            ${itemsHtml}
          </ul>
        </div>
      `;
    }
  }

  return `<p class="text-xs text-gray-500 mt-1 leading-relaxed">${escapeHtml(description)}</p>`;
}
