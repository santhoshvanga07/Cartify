import nodemailer from 'nodemailer';

/**
 * Outgoing email.
 *
 * Like the other integrations it stays stubbed until configured: without
 * SMTP credentials each message is printed to the console instead, so every
 * flow (including password reset) still works on a laptop with no mail server.
 *
 * Sending is FIRE-AND-FORGET from the caller's point of view. A mail server
 * being slow or down must never fail a checkout - the order is what matters,
 * the email is a courtesy.
 */

export const isEmailConfigured = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

let transporter = null;
/** The one SMTP connection the app sends through (also used by npm run check:email). */
export const getTransporter = () => {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
};

/** Messages "sent" while unconfigured, newest last. Lets tests read the reset link. */
export const outbox = [];

/** Escapes text before it goes into an HTML email - names and addresses are user input. */
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const layout = (title, bodyHtml) => `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#2b2a27">
  <p style="font-family:Georgia,serif;font-size:26px;margin:0 0 24px">Cartify</p>
  <h1 style="font-size:18px;font-weight:600;margin:0 0 12px">${esc(title)}</h1>
  ${bodyHtml}
  <p style="margin-top:32px;font-size:12px;color:#8a877f">You are receiving this because you have a Cartify account.</p>
</div>`;

/**
 * @param {{ to, subject, title?, html, text }} message
 * @returns {Promise<void>} never rejects
 */
export const sendEmail = async ({ to, subject, title, html, text }) => {
  const message = {
    from: process.env.EMAIL_FROM || 'Cartify <no-reply@cartify.com>',
    to,
    subject,
    text,
    html: layout(title || subject, html),
  };

  if (!isEmailConfigured()) {
    outbox.push(message);
    if (outbox.length > 50) outbox.shift();
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[email stub] to=${to} subject="${subject}"\n${text}\n`);
    }
    return;
  }

  try {
    await getTransporter().sendMail(message);
  } catch (err) {
    console.error(`Email to ${to} failed: ${err.message}`);
  }
};

/** Same, but the caller does not wait. */
export const queueEmail = (message) => {
  sendEmail(message);
};
