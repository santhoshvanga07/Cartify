import User from '../models/User.js';
import { queueEmail, esc } from './email.service.js';
import { clientUrl } from '../utils/clientUrl.js';

/**
 * Every customer-facing email in one place, so wording and tone stay
 * consistent and controllers only say WHAT happened, not how to phrase it.
 */

const rupees = (n) => `Rs ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#1f8a5b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px">${esc(label)}</a></p>`;

/** The 6-digit code that finishes sign-up. No account exists yet - only this inbox can complete it. */
export const notifySignupCode = ({ name, email }, code, minutes) =>
  queueEmail({
    to: email,
    subject: `${code} is your Cartify sign-up code`,
    title: 'Confirm your email',
    html: `<p>Hi ${esc(name)}, enter this code to finish creating your Cartify account:</p>
      <p style="font-size:32px;letter-spacing:8px;font-weight:600;margin:20px 0">${esc(code)}</p>
      <p style="font-size:13px;color:#6b6860">It expires in ${minutes} minutes. If you did not try to sign up, ignore this email - no account has been created.</p>`,
    text: `Your Cartify sign-up code is ${code}. It expires in ${minutes} minutes.\nIf you did not try to sign up, ignore this email - no account has been created.`,
  });

export const notifyWelcome = (user) =>
  queueEmail({
    to: user.email,
    subject: 'Welcome to Cartify',
    title: 'Welcome to Cartify',
    html: `<p>Hi ${esc(user.name)}, your account is ready.</p>${button(`${clientUrl()}/products`, 'Start shopping')}`,
    text: `Hi ${user.name}, your Cartify account is ready. ${clientUrl()}/products`,
  });

export const notifyPasswordReset = (user, resetUrl, minutes) =>
  queueEmail({
    to: user.email,
    subject: 'Reset your Cartify password',
    html: `<p>Someone (hopefully you) asked to reset the password for ${esc(user.email)}.</p>
      ${button(resetUrl, 'Choose a new password')}
      <p style="font-size:13px;color:#6b6860">The link works once and expires in ${minutes} minutes. If you did not ask for this, ignore this email - your password has not changed.</p>`,
    text: `Reset your Cartify password: ${resetUrl}\nThe link expires in ${minutes} minutes. If you did not ask for this, ignore this email.`,
  });

export const notifyPasswordChanged = (user) =>
  queueEmail({
    to: user.email,
    subject: 'Your Cartify password was changed',
    html: `<p>Hi ${esc(user.name)}, the password on your account was just changed. If this was not you, reset it immediately and contact support.</p>`,
    text: `Hi ${user.name}, your Cartify password was just changed. If this was not you, reset it immediately.`,
  });

/* ------------------------------------------------------------------
 * Sign-in alerts
 * ------------------------------------------------------------------ */

/** "12 Nov 2026, 3:05 pm IST" - customers are in India, servers are not. */
const istTime = (date = new Date()) =>
  `${new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })} IST`;

/** A readable guess at the device from its User-Agent: "Chrome on Windows". */
export const describeDevice = (ua = '') => {
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari'
    : null;
  const os = /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux'
    : null;
  if (!browser && !os) return 'an unknown device';
  return [browser, os].filter(Boolean).join(' on ');
};

const detailRow = (label, value) =>
  `<tr><td style="padding:4px 16px 4px 0;color:#8a877f">${esc(label)}</td><td style="padding:4px 0">${esc(value)}</td></tr>`;

/**
 * Sent on every successful sign-in, so a customer notices at once if someone
 * else is using their password.
 */
export const notifyLogin = (user, { ip, userAgent, at = new Date() } = {}) => {
  const when = istTime(at);
  const device = describeDevice(userAgent);
  queueEmail({
    to: user.email,
    subject: 'New sign-in to your Cartify account',
    title: 'New sign-in',
    html: `<p>Hi ${esc(user.name)}, your Cartify account was just signed in.</p>
      <table style="font-size:14px;border-collapse:collapse">
        ${detailRow('When', when)}${detailRow('Device', device)}${ip ? detailRow('IP address', ip) : ''}
      </table>
      <p style="margin-top:20px">If this was you, there is nothing to do.</p>
      <p><strong>Not you?</strong> Someone may know your password. Reset it now - that also signs out every other device.</p>
      ${button(`${clientUrl()}/forgot-password`, 'Reset my password')}`,
    text: `Hi ${user.name}, your Cartify account was just signed in.\n`
      + `When: ${when}\nDevice: ${device}\n${ip ? `IP address: ${ip}\n` : ''}`
      + `If this was not you, reset your password now: ${clientUrl()}/forgot-password`,
  });
};

/* ------------------------------------------------------------------
 * Order emails - every one carries the full order, so the email alone
 * answers "what did I buy, what did I pay, where is it going?"
 * ------------------------------------------------------------------ */

const PAYMENT_LABEL = {
  cod: { pending: 'Cash on delivery - pay when it arrives', paid: 'Cash on delivery - paid', refunded: 'Cash on delivery - refunded' },
  razorpay: { pending: 'Online - awaiting payment', failed: 'Online - payment failed', paid: 'Online - paid', refunded: 'Online - refunded' },
};
const paymentLabel = (order) =>
  PAYMENT_LABEL[order.paymentMethod]?.[order.paymentStatus] || `${order.paymentMethod} (${order.paymentStatus})`;

const addressLines = (a = {}) =>
  [a.fullName, a.line1, a.line2, `${a.city}, ${a.state} ${a.pincode}`, a.phone && `Phone ${a.phone}`].filter(Boolean);

/** The money lines, in the same order as the invoice. */
const summaryLines = (order) => {
  const p = order.pricing;
  return [
    ['Subtotal', rupees(p.subtotal)],
    ...(p.discount > 0 ? [[`Discount${order.coupon?.code ? ` (${order.coupon.code})` : ''}`, `- ${rupees(p.discount)}`]] : []),
    [`GST (${p.gstRate ?? 18}%)`, rupees(p.gst)],
    ['Shipping', p.shipping === 0 ? 'Free' : rupees(p.shipping)],
  ];
};

const orderDetailsHtml = (order) => {
  const cell = 'padding:8px 0;border-bottom:1px solid #ece9e2;vertical-align:top';
  const items = order.items.map((i) => `<tr>
      <td style="${cell}">${esc(i.name)}<br><span style="font-size:12px;color:#8a877f">${
        i.variant ? `${esc(i.optionName || 'Size')}: ${esc(i.variant)} &middot; ` : ''
      }${i.quantity} &times; ${rupees(i.price)}</span></td>
      <td style="${cell};text-align:right;white-space:nowrap">${rupees(i.price * i.quantity)}</td>
    </tr>`).join('');
  const money = summaryLines(order).map(([label, value]) => `<tr>
      <td style="padding:3px 0;color:#6b6860">${esc(label)}</td><td style="padding:3px 0;text-align:right">${esc(value)}</td>
    </tr>`).join('');
  return `
  <table style="width:100%;font-size:14px;border-collapse:collapse;margin-top:16px">
    <tr><td style="padding:0 0 6px;color:#8a877f;font-size:12px">ORDER ${esc(order.orderNumber)} &middot; ${esc(istTime(order.createdAt))}</td><td></td></tr>
    ${items}
    ${money}
    <tr><td style="padding:8px 0;font-weight:600;border-top:1px solid #2b2a27">Total</td>
        <td style="padding:8px 0;font-weight:600;border-top:1px solid #2b2a27;text-align:right">${rupees(order.pricing.total)}</td></tr>
  </table>
  <table style="width:100%;font-size:14px;margin-top:12px">
    <tr>
      <td style="vertical-align:top;padding-right:16px;width:50%">
        <p style="margin:0 0 4px;color:#8a877f;font-size:12px">PAYMENT</p>
        <p style="margin:0">${esc(paymentLabel(order))}</p>
      </td>
      <td style="vertical-align:top;width:50%">
        <p style="margin:0 0 4px;color:#8a877f;font-size:12px">DELIVERING TO</p>
        <p style="margin:0">${addressLines(order.shippingAddress).map(esc).join('<br>')}</p>
      </td>
    </tr>
  </table>`;
};

const orderDetailsText = (order) =>
  [
    `Order ${order.orderNumber} (${istTime(order.createdAt)})`,
    ...order.items.map((i) => `- ${i.name}${i.variant ? ` (${i.optionName || 'Size'}: ${i.variant})` : ''}: ${i.quantity} x ${rupees(i.price)} = ${rupees(i.price * i.quantity)}`),
    ...summaryLines(order).map(([label, value]) => `${label}: ${value}`),
    `Total: ${rupees(order.pricing.total)}`,
    `Payment: ${paymentLabel(order)}`,
    `Delivering to: ${addressLines(order.shippingAddress).join(', ')}`,
  ].join('\n');

const orderUrl = (order) => `${clientUrl()}/orders/${order._id}`;

export const notifyOrderPlaced = (order, user) => {
  const paidOnline = order.paymentMethod === 'razorpay' && order.paymentStatus === 'paid';
  const intro = paidOnline
    ? `Thanks ${user.name}! We have your order and your payment of ${rupees(order.pricing.total)}. We will let you know when it ships.`
    : `Thanks ${user.name}! We have your order and will let you know when it ships.`;
  queueEmail({
    to: user.email,
    subject: `Order ${order.orderNumber} placed`, // "confirmed" comes later, when the store confirms it
    title: 'Order placed',
    html: `<p>${esc(intro)}</p>${orderDetailsHtml(order)}
      ${button(orderUrl(order), 'Track your order')}${paidOnline ? button(`${orderUrl(order)}/invoice`, 'View invoice') : ''}`,
    text: `${intro}\n\n${orderDetailsText(order)}\n\nTrack it: ${orderUrl(order)}`,
  });
};

export const notifyPaymentReceived = (order, user) =>
  queueEmail({
    to: user.email,
    subject: `Payment received for ${order.orderNumber}`,
    title: 'Payment received',
    html: `<p>Hi ${esc(user.name)}, we received ${rupees(order.pricing.total)} for order ${esc(order.orderNumber)}${
      order.paymentDetails?.razorpayPaymentId ? ` (payment ${esc(order.paymentDetails.razorpayPaymentId)})` : ''
    }. Your order is confirmed.</p>
      ${orderDetailsHtml(order)}
      ${button(`${orderUrl(order)}/invoice`, 'View invoice')}`,
    text: `Payment of ${rupees(order.pricing.total)} received for ${order.orderNumber}.\n\n${orderDetailsText(order)}\n\nInvoice: ${orderUrl(order)}/invoice`,
  });

const STATUS_COPY = {
  confirmed: ['confirmed', 'has been confirmed and is being packed'],
  shipped: ['shipped', 'is on its way'],
  delivered: ['delivered', 'has been delivered. We hope you love it'],
  cancelled: ['cancelled', 'has been cancelled'],
  return_requested: ['return received', 'return request has been received - we will be in touch about pick-up'],
  returned: ['return complete', 'return is complete'],
};

export const notifyStatusChange = (order, user) => {
  if (!STATUS_COPY[order.status]) return;
  const [headline, copy] = STATUS_COPY[order.status];
  // Say WHY when the system cancelled it (e.g. payment not completed in time).
  const lastNote = order.statusHistory?.at(-1)?.note || '';
  const reason = order.status === 'cancelled' && /automatically/i.test(lastNote) ? ` ${lastNote}.` : '';
  const refunded = order.paymentStatus === 'refunded'
    ? ` Your refund of ${rupees(order.pricing.total)} has been issued${
      order.paymentMethod === 'razorpay' ? ' to your original payment method (it can take 5-7 working days to show)' : ''
    }.`
    : '';
  const sentence = `Hi ${user.name}, your order ${order.orderNumber} ${copy}.${reason}${refunded}`;

  // Courier, tracking number and expected date, once it has shipped.
  const s = order.status === 'shipped' ? order.shipment : null;
  const expected = s?.expectedDelivery
    ? new Date(s.expectedDelivery).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })
    : '';
  const shipHtml = s
    ? `<table style="font-size:14px;border-collapse:collapse;margin-top:8px">
        ${s.courier ? detailRow('Courier', s.courier) : ''}${s.trackingNumber ? detailRow('Tracking number', s.trackingNumber) : ''}
        ${expected ? detailRow('Expected delivery', expected) : ''}
      </table>${s.trackingUrl ? button(s.trackingUrl, 'Track your parcel') : ''}`
    : '';
  const shipText = s
    ? [s.courier && `Courier: ${s.courier}`, s.trackingNumber && `Tracking number: ${s.trackingNumber}`,
      expected && `Expected delivery: ${expected}`, s.trackingUrl && `Track it: ${s.trackingUrl}`].filter(Boolean).join('\n')
    : '';

  queueEmail({
    to: user.email,
    subject: `Order ${order.orderNumber} ${headline}`,
    title: `Order ${headline}`,
    html: `<p>${esc(sentence)}</p>${shipHtml}${orderDetailsHtml(order)}${button(orderUrl(order), 'View order')}`,
    text: `${sentence}${shipText ? `\n\n${shipText}` : ''}\n\n${orderDetailsText(order)}\n\n${orderUrl(order)}`,
  });
};

/** Store staff hear about new orders and return requests. */
export const notifyStaff = async (subject, text) => {
  try {
    const staff = await User.find({ role: { $in: ['admin', 'superadmin'] }, isActive: true }).select('email');
    for (const s of staff) {
      queueEmail({ to: s.email, subject: `[Cartify admin] ${subject}`, html: `<p style="white-space:pre-wrap">${esc(text)}</p>`, text });
    }
  } catch (err) {
    console.error(`Staff alert failed: ${err.message}`); // never let an alert break the request
  }
};

/**
 * Contact form: the message goes to the store's staff (reply-to the customer),
 * and the customer gets a copy so they know it arrived.
 */
export const notifyContactMessage = async ({ name, email, orderNumber, message }) => {
  const about = orderNumber ? ` about order ${orderNumber}` : '';
  await notifyStaff(
    `Message from ${name}${about}`,
    `${name} <${email}> wrote${about}:\n\n${message}\n\nReply to them at ${email}.`
  );
  queueEmail({
    to: email,
    subject: 'We have your message',
    title: 'Thanks for getting in touch',
    html: `<p>Hi ${esc(name)}, thanks for writing to us${esc(about)}. We usually reply within one working day.</p>
      <p style="margin-top:16px;color:#8a877f;font-size:13px">Your message:</p>
      <p style="white-space:pre-wrap;border-left:3px solid #ece9e2;padding-left:12px">${esc(message)}</p>`,
    text: `Hi ${name}, thanks for writing to us${about}. We usually reply within one working day.\n\nYour message:\n${message}`,
  });
};
