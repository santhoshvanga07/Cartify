import User from '../models/User.js';
import { queueEmail, esc } from './email.service.js';

/**
 * Every customer-facing email in one place, so wording and tone stay
 * consistent and controllers only say WHAT happened, not how to phrase it.
 */

const clientUrl = () => process.env.CLIENT_URL || 'http://localhost:5173';
const rupees = (n) => `Rs ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const button = (href, label) =>
  `<p style="margin:24px 0"><a href="${href}" style="background:#1f8a5b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:14px">${esc(label)}</a></p>`;

export const notifyWelcome = (user) =>
  queueEmail({
    to: user.email,
    subject: 'Welcome to Cartify',
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

const orderLines = (order) =>
  order.items.map((i) => `<li>${esc(i.name)} &times; ${i.quantity} - ${rupees(i.price * i.quantity)}</li>`).join('');

export const notifyOrderPlaced = (order, user) =>
  queueEmail({
    to: user.email,
    subject: `Order ${order.orderNumber} confirmed`,
    html: `<p>Thanks ${esc(user.name)}! We have your order.</p>
      <ul style="padding-left:18px">${orderLines(order)}</ul>
      <p><strong>Total ${rupees(order.pricing.total)}</strong> &middot; ${order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'}</p>
      ${button(`${clientUrl()}/orders/${order._id}`, 'Track your order')}`,
    text: `Order ${order.orderNumber} confirmed. Total ${rupees(order.pricing.total)}. Track it: ${clientUrl()}/orders/${order._id}`,
  });

export const notifyPaymentReceived = (order, user) =>
  queueEmail({
    to: user.email,
    subject: `Payment received for ${order.orderNumber}`,
    html: `<p>We received ${rupees(order.pricing.total)} for order ${esc(order.orderNumber)}.</p>
      ${button(`${clientUrl()}/orders/${order._id}/invoice`, 'View invoice')}`,
    text: `Payment of ${rupees(order.pricing.total)} received for ${order.orderNumber}. Invoice: ${clientUrl()}/orders/${order._id}/invoice`,
  });

const STATUS_COPY = {
  confirmed: ['confirmed', 'has been confirmed and is being packed'],
  shipped: ['shipped', 'is on its way'],
  delivered: ['delivered', 'has been delivered'],
  cancelled: ['cancelled', 'has been cancelled'],
  return_requested: ['return received', 'return request has been received'],
  returned: ['return complete', 'return is complete'],
};

export const notifyStatusChange = (order, user) => {
  if (!STATUS_COPY[order.status]) return;
  const [headline, copy] = STATUS_COPY[order.status];
  const refunded = order.paymentStatus === 'refunded' ? ' Your refund has been issued.' : '';
  queueEmail({
    to: user.email,
    subject: `Order ${order.orderNumber} ${headline}`,
    html: `<p>Hi ${esc(user.name)}, your order ${esc(order.orderNumber)} ${copy}.${refunded}</p>
      ${button(`${clientUrl()}/orders/${order._id}`, 'View order')}`,
    text: `Your order ${order.orderNumber} ${copy}.${refunded} ${clientUrl()}/orders/${order._id}`,
  });
};

/** Store staff hear about new orders and return requests. */
export const notifyStaff = async (subject, text) => {
  try {
    const staff = await User.find({ role: { $in: ['admin', 'superadmin'] }, isActive: true }).select('email');
    for (const s of staff) {
      queueEmail({ to: s.email, subject: `[Cartify admin] ${subject}`, html: `<p>${esc(text)}</p>`, text });
    }
  } catch (err) {
    console.error(`Staff alert failed: ${err.message}`); // never let an alert break the request
  }
};
