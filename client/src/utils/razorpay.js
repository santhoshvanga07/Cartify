/**
 * Loads Razorpay's checkout widget on demand and opens it.
 *
 * The script is only fetched when someone actually pays online, so shoppers
 * paying cash never download it.
 */
let loading = null;

const loadScript = () => {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => {
      loading = null; // allow a retry
      reject(new Error('Could not load the payment window. Check your connection.'));
    };
    document.body.appendChild(s);
  });
  return loading;
};

/**
 * @param {{ orderId, amount, currency, keyId }} razorpay  from our API
 * @param {{ name, email }} customer
 * @param {string} description
 * @returns {Promise<object>} Razorpay's success payload; rejects with
 *   { dismissed: true } if the shopper closed the window.
 */
export const openRazorpay = async (razorpay, customer, description) => {
  await loadScript();

  return new Promise((resolve, reject) => {
    const widget = new window.Razorpay({
      key: razorpay.keyId,
      order_id: razorpay.orderId,
      amount: razorpay.amount,
      currency: razorpay.currency,
      name: 'Cartify',
      description,
      prefill: { name: customer?.name, email: customer?.email },
      theme: { color: '#1f8a5b' },
      handler: resolve,
      modal: { ondismiss: () => reject({ dismissed: true }) },
    });
    widget.on('payment.failed', (resp) => reject(new Error(resp.error?.description || 'Payment failed')));
    widget.open();
  });
};
