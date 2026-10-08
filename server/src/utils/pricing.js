import { getSettings } from '../services/settings.service.js';

/**
 * All money maths lives here, on the SERVER.
 *
 * The frontend shows these numbers, but it never decides them. If the client
 * could send its own total, anyone could buy a laptop for one rupee by editing
 * a request in DevTools. Checkout recalculates everything from scratch using
 * this same function.
 *
 * The rates (GST, shipping fee, free-shipping threshold) are platform
 * settings the Super Admin can change; see settings.service.js.
 */

/** Rounds to 2 decimals - avoids 1234.5600000000001 in JSON. */
const money = (n) => Math.round(n * 100) / 100;

/**
 * @param {Array<{price:number, quantity:number}>} lines
 * @param {{discount?: number}} options
 */
export const calculateTotals = (lines, { discount = 0 } = {}) => {
  const { gstRate, shippingFlat, freeShippingAbove } = getSettings();
  const subtotal = money(lines.reduce((sum, l) => sum + l.price * l.quantity, 0));

  // Discount can never exceed the subtotal (a coupon must not create a refund).
  const appliedDiscount = money(Math.min(discount, subtotal));
  const taxable = money(subtotal - appliedDiscount);

  const gst = money((taxable * gstRate) / 100);
  const shipping = taxable === 0 || taxable >= freeShippingAbove ? 0 : shippingFlat;
  const total = money(taxable + gst + shipping);

  return {
    subtotal,
    discount: appliedDiscount,
    gst,
    shipping,
    total,
    gstRate, // so the UI can label "GST (18%)" without hard-coding it
    freeShippingAbove,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
  };
};
