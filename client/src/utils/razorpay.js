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
 * @param {{ onAttemptFailed?: (message: string) => void }} [options]
 * @returns {Promise<object>} Razorpay's success payload; rejects with
 *   { dismissed: true } if the shopper closed the window.
 *
 * A declined card does NOT end the payment: Razorpay keeps its window open so
 * the shopper can try another card or UPI. So a failed attempt only reports
 * itself (onAttemptFailed); the promise settles when a payment succeeds or the
 * window is closed. Rejecting on the first failure would mean a later
 * successful attempt is never sent to our server - money taken, order unpaid.
 */
export const openRazorpay = async (razorpay, customer, description, { onAttemptFailed } = {}) => {
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
    widget.on('payment.failed', (resp) => onAttemptFailed?.(resp.error?.description || 'Payment failed'));
    widget.open();
  });
};
