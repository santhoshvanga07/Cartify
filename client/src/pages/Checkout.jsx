import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchCart } from '../features/cart/cartSlice';
import { placeOrder, clearPlaced, verifyPayment } from '../features/orders/orderSlice';
import { openRazorpay } from '../utils/razorpay';
import { inr } from '../components/ProductCard';
import api from '../api/axios';

const BLANK = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

const Checkout = () => {
  const [address, setAddress] = useState(BLANK);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [code, setCode] = useState('');
  // { coupon, totals } from the server's preview. Only a preview - the order
  // endpoint re-checks the coupon when the order is actually placed.
  const [preview, setPreview] = useState(null);
  const [applying, setApplying] = useState(false);
  const [onlineEnabled, setOnlineEnabled] = useState(false);
  const [codEnabled, setCodEnabled] = useState(true);
  const [paying, setPaying] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, totals } = useSelector((state) => state.cart);
  const { loading, placed } = useSelector((state) => state.orders);
  const cartLoading = useSelector((state) => state.cart.loading);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(fetchCart());
    if (user) setAddress((a) => ({ ...a, fullName: a.fullName || user.name }));
  }, [dispatch, user]);

  // Leaving the page (by any link) ends the confirmation. Without this, the
  // next visit to /checkout would show the old "Thank you" screen.
  useEffect(() => () => dispatch(clearPlaced()), [dispatch]);

  // Online payment is offered only when the server has Razorpay keys.
  useEffect(() => {
    api
      .get('/payments/config')
      .then(({ data }) => {
        setOnlineEnabled(data.razorpay);
        setCodEnabled(data.cod !== false);
        // If cash on delivery is switched off, start on the method that works.
        if (data.cod === false && data.razorpay) setPaymentMethod('razorpay');
      })
      .catch(() => {});
  }, []);

  const set = (e) => setAddress({ ...address, [e.target.name]: e.target.value });

  // A preview is only good for the bag it was made against. If the bag
  // changes, the discount shown would be stale - so ignore it.
  const applied = preview?.forSubtotal === totals.subtotal ? preview : null;

  const applyCoupon = async () => {
    if (!code.trim()) return;
    setApplying(true);
    try {
      const { data } = await api.post('/coupons/apply', { code });
      setPreview({ coupon: data.coupon, totals: data.totals, forSubtotal: totals.subtotal });
      toast.success(`${data.coupon.code} applied`);
    } catch (err) {
      setPreview(null);
      toast.error(err.response?.data?.message || 'Could not apply coupon');
    } finally {
      setApplying(false);
    }
  };

  const shown = applied?.totals || totals;

  const submit = async (e) => {
    e.preventDefault();
    const result = await dispatch(
      placeOrder({ shippingAddress: address, paymentMethod, couponCode: applied?.coupon.code })
    );
    if (!placeOrder.fulfilled.match(result)) return toast.error(result.payload);
    dispatch(fetchCart()); // the server emptied it

    const order = result.payload;
    if (order.paymentMethod !== 'razorpay') return toast.success('Order placed');
    if (!order.razorpay) return toast.warn('Order placed, but payment could not start. Pay from the order page.');

    setPaying(true);
    try {
      const payment = await openRazorpay(order.razorpay, user, `Order ${order.orderNumber}`, {
        onAttemptFailed: (m) => toast.error(`${m} - you can try again in the payment window`),
      });
      const verified = await dispatch(verifyPayment({ id: order._id, payment }));
      if (verifyPayment.fulfilled.match(verified)) toast.success('Payment received');
      else toast.error(verified.payload);
    } catch (err) {
      // Closing the window is not an error - the order waits for payment.
      if (err?.dismissed) toast.info('Payment not completed. You can pay from the order page.');
      else toast.error(err.message);
    } finally {
      setPaying(false);
    }
  };

  /* ---------- Confirmation ---------- */
  if (paying) {
    return <p className="px-6 py-24 text-center text-sm text-muted">Waiting for payment…</p>;
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Confirmed</p>
        <h1 className="display mt-4 text-4xl text-ink">Thank you</h1>
        <p className="mt-3 text-sm text-body">
          Order <span className="text-ink">{placed.orderNumber}</span> is placed.
          {placed.paymentMethod === 'cod' && ' Pay in cash when it arrives.'}
          {placed.paymentMethod === 'razorpay' &&
            (placed.paymentStatus === 'paid' ? ' Payment received.' : ' Payment is still pending.')}
        </p>
        <p className="mt-1 text-sm text-body">Total {inr(placed.pricing.total)}</p>

        <div className="mt-10 flex justify-center gap-3">
          <Link
            to={`/orders/${placed._id}`}
            onClick={() => dispatch(clearPlaced())}
            className="btn btn-primary"
          >
            View order
          </Link>
          <button
            onClick={() => {
              dispatch(clearPlaced());
              navigate('/products');
            }}
            className="btn btn-ghost"
          >
            Keep shopping
          </button>
        </div>
      </div>
    );
  }

  // On a refresh the bag is still loading - do not flash "your bag is empty".
  if (items.length === 0 && cartLoading) {
    return <p className="px-6 py-24 text-center text-sm text-muted">Loading…</p>;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="display text-3xl text-ink">Your bag is empty</h1>
        <Link to="/products" className="btn btn-primary mt-6">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="display text-4xl text-ink">Checkout</h1>

      <form onSubmit={submit} className="mt-10 grid gap-12 md:grid-cols-[1fr_320px]">
        <div>
          <h2 className="text-sm font-medium text-ink">Delivery address</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Full name</label>
              <input name="fullName" value={address.fullName} onChange={set} required className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Mobile number</label>
              <input
                name="phone"
                value={address.phone}
                onChange={set}
                required
                inputMode="numeric"
                placeholder="10 digits"
                className="field"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Address</label>
              <input name="line1" value={address.line1} onChange={set} required className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Apartment, landmark (optional)</label>
              <input name="line2" value={address.line2} onChange={set} className="field" />
            </div>
            <div>
              <label className="label">City</label>
              <input name="city" value={address.city} onChange={set} required className="field" />
            </div>
            <div>
              <label className="label">State</label>
              <input name="state" value={address.state} onChange={set} required className="field" />
            </div>
            <div>
              <label className="label">PIN code</label>
              <input
                name="pincode"
                value={address.pincode}
                onChange={set}
                required
                inputMode="numeric"
                placeholder="6 digits"
                className="field"
              />
            </div>
          </div>

          <h2 className="mt-10 text-sm font-medium text-ink">Payment</h2>
          <div className="mt-4 space-y-3">
            <label
              className={`flex items-start gap-3 rounded-xl bg-surface p-4 ${
                codEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <input
                type="radio"
                name="pay"
                disabled={!codEnabled}
                checked={paymentMethod === 'cod'}
                onChange={() => setPaymentMethod('cod')}
                className="mt-1 accent-current text-accent"
              />
              <span>
                <span className="block text-sm text-ink">Cash on delivery</span>
                <span className="block text-xs text-body">
                  {codEnabled ? 'Pay when your order arrives.' : 'Currently unavailable.'}
                </span>
              </span>
            </label>

            <label
              className={`flex items-start gap-3 rounded-xl bg-surface p-4 ${
                onlineEnabled ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
              }`}
            >
              <input
                type="radio"
                name="pay"
                disabled={!onlineEnabled}
                checked={paymentMethod === 'razorpay'}
                onChange={() => setPaymentMethod('razorpay')}
                className="mt-1"
              />
              <span>
                <span className="block text-sm text-ink">Pay online (Razorpay)</span>
                <span className="block text-xs text-body">
                  {onlineEnabled ? 'UPI, cards, net banking and wallets.' : 'Add your Razorpay test keys to enable.'}
                </span>
              </span>
            </label>
          </div>
        </div>

        {/* Summary — every figure recalculated by the server */}
        <aside className="h-fit">
          <div className="card">
            <h2 className="text-sm font-medium text-ink">Your order</h2>

            <ul className="mt-4 space-y-2.5 text-sm">
              {items.map(({ product, quantity, lineTotal }) => (
                <li key={product._id} className="flex justify-between gap-3">
                  <span className="text-body">
                    {product.name} <span className="text-muted">× {quantity}</span>
                  </span>
                  <span className="shrink-0 text-ink">{inr(lineTotal)}</span>
                </li>
              ))}
            </ul>

            {/* Coupon */}
            <div className="mt-5 border-t border-line pt-5">
              {applied ? (
                <div className="flex items-center justify-between gap-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">
                  <span>
                    <span className="font-medium text-accent">{applied.coupon.code}</span>
                    {applied.coupon.description && (
                      <span className="block text-xs text-body">{applied.coupon.description}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setPreview(null);
                      setCode('');
                    }}
                    className="text-xs text-body hover:text-ink"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault(); // do not submit the order form
                        applyCoupon();
                      }
                    }}
                    placeholder="Coupon code"
                    aria-label="Coupon code"
                    className="field"
                  />
                  <button
                    type="button"
                    onClick={applyCoupon}
                    disabled={applying || !code.trim()}
                    className="btn btn-ghost shrink-0"
                  >
                    {applying ? '…' : 'Apply'}
                  </button>
                </div>
              )}
            </div>

            <dl className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-body">Subtotal</dt>
                <dd className="text-ink">{inr(shown.subtotal)}</dd>
              </div>
              {shown.discount > 0 && (
                <div className="flex justify-between">
                  <dt className="text-body">Discount</dt>
                  <dd className="text-accent">−{inr(shown.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-body">GST ({shown.gstRate ?? 18}%)</dt>
                <dd className="text-ink">{inr(shown.gst)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-body">Shipping</dt>
                <dd className="text-ink">{shown.shipping === 0 ? 'Free' : inr(shown.shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2.5">
                <dt className="text-ink">Total</dt>
                <dd className="text-base font-medium text-ink">{inr(shown.total)}</dd>
              </div>
            </dl>

            <button type="submit" disabled={loading} className="btn btn-primary mt-6 w-full">
              {loading ? 'Placing order…' : `Place order · ${inr(shown.total)}`}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
};

export default Checkout;
