import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { useSettings } from '../utils/settings';
import { inr } from '../components/ProductCard';
import usePageTitle from '../hooks/usePageTitle';

/**
 * Store policies and contact. Every number in them (return window, shipping
 * fee, free-shipping threshold, company name, GSTIN) comes from the platform
 * settings, so the pages always match what checkout and the server enforce.
 *
 * Payment gateways (Razorpay included) ask for exactly these pages before they
 * activate live payments.
 */

const Page = ({ title, updated = 'November 2026', children }) => {
  usePageTitle(title);
  return (
    <article className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="display text-4xl text-ink">{title}</h1>
      <p className="mt-2 text-xs text-muted">Last updated {updated}</p>
      <div className="mt-10 space-y-8 text-sm leading-relaxed text-body [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-medium [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  );
};

const Mail = ({ to }) => (
  <a href={`mailto:${to}`} className="text-accent hover:underline">
    {to}
  </a>
);

export const Shipping = () => {
  const s = useSettings();
  return (
    <Page title="Shipping policy">
      <section>
        <h2>Where we deliver</h2>
        <p>We deliver to every serviceable pincode in India. Your pincode is checked when you place the order.</p>
      </section>
      <section>
        <h2>Shipping charges</h2>
        <ul>
          <li>Free shipping on orders of {inr(s.freeShippingAbove)} or more (after any coupon).</li>
          <li>Below that, a flat {inr(s.shippingFlat)} per order.</li>
          <li>The exact amount is shown at checkout before you pay, and on your invoice.</li>
        </ul>
      </section>
      <section>
        <h2>When it ships and arrives</h2>
        <ul>
          <li>Orders are packed within 1–2 working days of confirmation.</li>
          <li>Delivery usually takes 3–7 working days after dispatch, depending on your location.</li>
          <li>When your order ships we email you the courier name, tracking number and expected delivery date. You can also see them on your order page.</li>
        </ul>
      </section>
      <section>
        <h2>Cash on delivery</h2>
        <p>
          {s.codEnabled
            ? 'Cash on delivery is available. Please keep the exact amount ready; the order is marked paid when it is delivered.'
            : 'Cash on delivery is currently unavailable. Please pay online at checkout.'}
        </p>
      </section>
      <section>
        <h2>Questions</h2>
        <p>
          Write to <Mail to={s.supportEmail} /> or use our <Link to="/contact" className="text-accent hover:underline">contact form</Link>.
        </p>
      </section>
    </Page>
  );
};

export const Returns = () => {
  const s = useSettings();
  return (
    <Page title="Returns & refunds">
      <section>
        <h2>Returning an item</h2>
        <ul>
          <li>You can request a return within {s.returnWindowDays} days of delivery, from the order page (Your orders → the order → “Return this order”).</li>
          <li>Tell us briefly why. We will arrange a pick-up or tell you where to send it.</li>
          <li>Items should be unused, with their original packaging and tags.</li>
        </ul>
      </section>
      <section>
        <h2>Cancelling an order</h2>
        <p>You can cancel an order yourself until it has shipped. Online orders that are not paid within 30 minutes are cancelled automatically.</p>
      </section>
      <section>
        <h2>Refunds</h2>
        <ul>
          <li>Online payments are refunded to the original payment method as soon as a cancellation or return is accepted. Banks usually take 5–7 working days to show it.</li>
          <li>Cash-on-delivery orders are refunded once the returned item reaches us.</li>
          <li>You get an email at every step, including the refunded amount.</li>
        </ul>
      </section>
      <section>
        <h2>Damaged or wrong item?</h2>
        <p>
          Write to <Mail to={s.supportEmail} /> within 48 hours of delivery with your order number and a photo, and we will replace or refund it.
        </p>
      </section>
    </Page>
  );
};

export const Terms = () => {
  const s = useSettings();
  return (
    <Page title="Terms of use">
      <section>
        <h2>Who we are</h2>
        <p>
          {s.storeName} is operated by {s.legalName}
          {s.address && `, ${s.address}`}
          {s.gstin && ` (GSTIN ${s.gstin})`}. By using this site you agree to these terms.
        </p>
      </section>
      <section>
        <h2>Your account</h2>
        <ul>
          <li>Keep your password private. You are responsible for activity on your account.</li>
          <li>We email you every time your account is signed in to, so you can act quickly if it was not you.</li>
          <li>We may suspend accounts used for fraud or abuse.</li>
        </ul>
      </section>
      <section>
        <h2>Prices and orders</h2>
        <ul>
          <li>Prices are in Indian rupees and include GST where shown. The amount you pay is calculated by our server at checkout and shown before you pay.</li>
          <li>An order is a request to buy. We may cancel it if an item turns out to be unavailable or mispriced, and refund anything you paid.</li>
          <li>Coupons have their own conditions (minimum order, expiry, one use per customer).</li>
        </ul>
      </section>
      <section>
        <h2>Reviews and questions</h2>
        <p>Reviews and answers must be honest and about the product. We remove spam, abuse and personal information. Reviews marked “Verified purchase” come from customers who received the item.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          <Mail to={s.supportEmail} />
        </p>
      </section>
    </Page>
  );
};

export const Privacy = () => {
  const s = useSettings();
  return (
    <Page title="Privacy policy">
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>Your name, email address and password (stored only as a secure hash, never readable).</li>
          <li>Delivery addresses and phone numbers you give us at checkout or save to your account.</li>
          <li>Your orders, wishlist, reviews and questions.</li>
          <li>The time, device and IP address of sign-ins, to protect your account.</li>
        </ul>
      </section>
      <section>
        <h2>Payments</h2>
        <p>Online payments are handled by Razorpay. Your card or UPI details go to Razorpay directly; we never see or store them.</p>
      </section>
      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To deliver your orders and send order, payment, shipping and refund emails.</li>
          <li>To keep your account secure (sign-in alerts, password reset).</li>
          <li>To show recommendations based on what you viewed and bought on this site.</li>
        </ul>
        <p className="mt-2">We do not sell your data. We share delivery details only with the courier delivering your order.</p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>We use one essential cookie to keep you signed in. It cannot be read by scripts on the page. Recently viewed products are remembered in your own browser.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can edit your name and saved addresses on your profile. To get a copy of your data or close your account, write to <Mail to={s.supportEmail} />.
        </p>
      </section>
    </Page>
  );
};

export const Contact = () => {
  const s = useSettings();
  const user = useSelector((state) => state.auth.user);
  // name/email stay null until typed, so a signed-in customer's details fill in
  // even when they load after the page (a direct visit or a refresh).
  const [typed, setForm] = useState({ name: null, email: null, orderNumber: '', message: '' });
  const form = { ...typed, name: typed.name ?? user?.name ?? '', email: typed.email ?? user?.email ?? '' };
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const set = (e) => setForm({ ...typed, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data } = await api.post('/contact', form);
      toast.success(data.message);
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send your message');
    } finally {
      setSending(false);
    }
  };

  return (
    <Page title="Contact us">
      <section>
        <p>
          Questions about an order, a product or a refund? Write to <Mail to={s.supportEmail} /> or use the form below. We usually reply within one working day.
        </p>
        {s.address && <p className="mt-2">{s.legalName}, {s.address}</p>}
      </section>

      {sent ? (
        <div className="card">
          <p className="text-ink">Thanks, we have your message.</p>
          <p className="mt-1">A copy has been sent to {form.email}.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="contact-name">Your name</label>
              <input id="contact-name" name="name" value={form.name} onChange={set} required maxLength={60} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="contact-email">Email</label>
              <input id="contact-email" name="email" type="email" value={form.email} onChange={set} required className="field" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="contact-order">Order number (optional)</label>
            <input id="contact-order" name="orderNumber" value={form.orderNumber} onChange={set} maxLength={40} className="field" placeholder="CFY-…" />
          </div>
          <div>
            <label className="label" htmlFor="contact-message">Message</label>
            <textarea id="contact-message" name="message" value={form.message} onChange={set} required minLength={10} maxLength={2000} rows={5} className="field" />
          </div>
          <button type="submit" disabled={sending} className="btn btn-primary">
            {sending ? 'Sending…' : 'Send message'}
          </button>
        </form>
      )}
    </Page>
  );
};
