const RAZORPAY_CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '')).replace(/\/$/, '');

let checkoutLoader = null;

async function postJson(path, payload) {
  if (!API_BASE_URL) {
    throw new Error('Payments backend is not configured. Set VITE_API_BASE_URL to your deployed backend before using Razorpay.');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.details || 'Razorpay request failed.');
  }

  return data;
}

export function loadRazorpayCheckout() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay checkout can only run in the browser.'));
  }

  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (checkoutLoader) return checkoutLoader;

  checkoutLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_URL;
    script.async = true;
    script.onload = () => {
      if (window.Razorpay) {
        resolve(window.Razorpay);
        return;
      }
      reject(new Error('Razorpay checkout script loaded, but Razorpay is unavailable.'));
    };
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout.'));
    document.body.appendChild(script);
  });

  return checkoutLoader;
}

export function createRazorpayOrder(payload) {
  return postJson('/payments/razorpay/order', payload);
}

export function verifyRazorpayPayment(payload) {
  return postJson('/payments/razorpay/verify', payload);
}

export async function openRazorpayCheckout({ order, payment, user }) {
  const RazorpayCheckout = await loadRazorpayCheckout();

  return new Promise((resolve, reject) => {
    const checkout = new RazorpayCheckout({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: order.name || 'Soulvest Commune',
      description: order.description || payment?.title || 'Resident payment',
      order_id: order.orderId,
      prefill: {
        name: user?.name || 'Resident',
        email: user?.email || '',
        contact: user?.mobile || '',
      },
      notes: {
        flat: user?.flat || '',
        paymentId: payment?.id || '',
        ...(order.notes || {}),
      },
      theme: {
        color: '#8a5c1e',
      },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Razorpay checkout was closed before payment completion.')),
      },
    });

    checkout.on('payment.failed', (event) => {
      reject(new Error(event?.error?.description || 'Razorpay payment failed.'));
    });

    checkout.open();
  });
}
