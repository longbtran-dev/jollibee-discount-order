/**
/**
 * Quản lý các hiệu ứng thị giác mượt mà & siêu nhẹ cho ứng dụng:
 * 1. Nổ pháo giấy confetti (canvas-confetti) khi đạt mốc Freeship hoặc chốt đơn
 * 2. Hiệu ứng bay món ăn vào giỏ (Fly to Cart)
 * 3. Hiệu ứng nảy giỏ hàng (Cart Bounce)
 * 4. Hiệu ứng rung nhẹ / nhấp nháy thu hút sự chú ý
 */

let confettiInstance = null;

// Khởi tạo an toàn cho confetti
export function initConfetti() {
  if (typeof window === 'undefined') return null;
  if (window.confetti) {
    confettiInstance = window.confetti;
    return confettiInstance;
  }
  return null;
}

/**
 * Hiệu ứng nổ pháo hoa rực rỡ khi hoàn tất đặt đơn
 */
export function fireOrderCelebration() {
  if (typeof window === 'undefined') return;
  const confetti = window.confetti || confettiInstance;
  if (!confetti) return;

  const count = 200;
  const defaults = {
    origin: { y: 0.7 },
    zIndex: 99999
  };

  function fire(particleRatio, opts) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio)
    });
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
    colors: ['#d71920', '#ffc72c', '#ffffff']
  });
  fire(0.2, {
    spread: 60,
    colors: ['#ffc72c', '#d71920', '#10b981']
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    colors: ['#ffc72c', '#ffffff', '#ef4444'],
    scalar: 1.2
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45
  });
}

/**
 * Hiệu ứng pháo bông nhẹ 2 bên hông khi đạt mốc Freeship
 */
export function fireFreeshipMilestone() {
  if (typeof window === 'undefined') return;
  const confetti = window.confetti || confettiInstance;
  if (!confetti) return;

  // Pháo bắn từ góc trái
  confetti({
    particleCount: 40,
    angle: 60,
    spread: 55,
    origin: { x: 0, y: 0.85 },
    colors: ['#10b981', '#ffc72c', '#ffffff'],
    zIndex: 99999
  });
  // Pháo bắn từ góc phải
  confetti({
    particleCount: 40,
    angle: 120,
    spread: 55,
    origin: { x: 1, y: 0.85 },
    colors: ['#10b981', '#ffc72c', '#ffffff'],
    zIndex: 99999
  });
}

/**
 * Hiệu ứng viên tròn bay từ vị trí nút bấm vào giỏ hàng
 * @param {HTMLElement} sourceEl - Nút vừa bấm
 * @param {HTMLElement} targetEl - Icon giỏ hàng mục tiêu
 */
export function flyToCart(sourceEl, targetEl) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!sourceEl || !targetEl) {
    bounceCartBadge();
    return;
  }

  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();

  // Tạo đốm bay tạm thời
  const flyer = document.createElement('div');
  flyer.className = 'fixed z-50 pointer-events-none rounded-full flex items-center justify-center shadow-lg';
  flyer.style.width = '24px';
  flyer.style.height = '24px';
  flyer.style.backgroundColor = '#d71920';
  flyer.style.color = '#ffffff';
  flyer.style.fontSize = '12px';
  flyer.style.fontWeight = 'bold';
  flyer.style.left = `${sourceRect.left + sourceRect.width / 2 - 12}px`;
  flyer.style.top = `${sourceRect.top + sourceRect.height / 2 - 12}px`;
  flyer.style.transition = 'transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.45s ease-in, scale 0.45s ease-in';
  flyer.innerHTML = `<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>`;

  document.body.appendChild(flyer);

  // Kích hoạt animation tới đích
  requestAnimationFrame(() => {
    const deltaX = (targetRect.left + targetRect.width / 2) - (sourceRect.left + sourceRect.width / 2);
    const deltaY = (targetRect.top + targetRect.height / 2) - (sourceRect.top + sourceRect.height / 2);

    flyer.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(0.4)`;
    flyer.style.opacity = '0.3';
  });

  // Khi tới đích -> Rung nảy giỏ hàng & xóa flyer
  setTimeout(() => {
    if (flyer.parentNode) {
      flyer.parentNode.removeChild(flyer);
    }
    bounceCartBadge(targetEl);
  }, 460);
}

/**
 * Tạo hiệu ứng nảy giỏ hàng và đốm số lượng
 */
export function bounceCartBadge(badgeEl) {
  if (typeof document === 'undefined') return;
  const target = badgeEl || document.getElementById('floating-cart-badge');
  const cartIcon = document.querySelector('#btn-open-cart-info > div');

  if (target) {
    target.classList.remove('animate-cart-bounce');
    void target.offsetWidth; // force reflow
    target.classList.add('animate-cart-bounce');
  }

  if (cartIcon) {
    cartIcon.classList.remove('animate-cart-bounce');
    void cartIcon.offsetWidth; // force reflow
    cartIcon.classList.add('animate-cart-bounce');
  }
}
