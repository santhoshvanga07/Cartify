/**
 * All money maths lives here, on the SERVER.
 *
 * The frontend shows these numbers, but it never decides them. If the client
 * could send its own total, anyone could buy a laptop for one rupee by editing
 * a request in DevTools. Checkout recalculates everything from scratch using
 * this same function.
 */

export const GST_RATE = 0.18; // 18% GST
export const FREE_SHIPPING_ABOVE = 5000; // rupees
export const SHIPPING_FLAT = 99;

/** Rounds to 2 decimals - avoids 1234.5600000000001 in JSON. */
const money = (n) => Math.round(n * 100) / 100;

/**
 * @param {Array<{price:number, quantity:number}>} lines
 * @param {{discount?: number}} options
 */
export const calculateTotals = (lines, { discount = 0 } = {}) => {
  const subtotal = money(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));

  // Discount can never exceed the subtotal (a coupon must not create a refund).
  const appliedDiscount = money(Math.min(discount, subtotal));
  const taxable = money(subtotal - appliedDiscount);

  const gst = money(taxable * GST_RATE);
  const shipping = taxable === 0 || taxable >= FREE_SHIPPING_ABOVE ? 0 : SHIPPING_FLAT;
  const total = money(taxable + gst + shipping);

  return {
    subtotal,
    discount: appliedDiscount,
    gst,
    shipping,
    total,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
  };
};
