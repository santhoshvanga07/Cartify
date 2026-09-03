import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchCart } from '../features/cart/cartSlice';
import { placeOrder, clearPlaced } from '../features/orders/orderSlice';
import { inr } from '../components/ProductCard';

const BLANK = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '' };

const Checkout = () => {
  const [address, setAddress] = useState(BLANK);
  const [paymentMethod, setPaymentMethod] = useState('cod');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { items, totals } = useSelector((state) => state.cart);
  const { loading, error, placed } = useSelector((state) => state.orders);
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(fetchCart());
    if (user) setAddress((a) => ({ ...a, fullName: a.fullName || user.name }));
  }, [dispatch, user]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const set = (e) => setAddress({ ...address, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const result = await dispatch(placeOrder({ shippingAddress: address, paymentMethod }));
    if (placeOrder.fulfilled.match(result)) {
      dispatch(fetchCart()); // the server emptied it
      toast.success('Order placed');
    }
  };

  /* ---------- Confirmation ---------- */
  if (placed) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-accent">Confirmed</p>
        <h1 className="display mt-4 text-4xl text-ink">Thank you</h1>
        <p className="mt-3 text-sm text-body">
          Order <span className="text-ink">{placed.orderNumber}</span> is placed.
          {placed.paymentMethod === 'cod' && ' Pay in cash when it arrives.'}
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
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-surface p-4">
              <input
                type="radio"
                name="pay"
                checked={paymentMethod === 'cod'}
                onChange={() => setPaymentMethod('cod')}
                className="mt-1 accent-current text-accent"
              />
              <span>
                <span className="block text-sm text-ink">Cash on delivery</span>
                <span className="block text-xs text-body">Pay when your order arrives.</span>
              </span>
            </label>

            <label className="flex cursor-not-allowed items-start gap-3 rounded-xl bg-surface p-4 opacity-50">
              <input type="radio" name="pay" disabled className="mt-1" />
              <span>
                <span className="block text-sm text-ink">Pay online (Razorpay)</span>
                <span className="block text-xs text-body">Add your Razorpay test keys to enable.</span>
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

            <dl className="mt-5 space-y-2.5 border-t border-line pt-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-body">Subtotal</dt>
                <dd className="text-ink">{inr(totals.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-body">GST (18%)</dt>
                <dd className="text-ink">{inr(totals.gst)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-body">Shipping</dt>
                <dd className="text-ink">{totals.shipping === 0 ? 'Free' : inr(totals.shipping)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-2.5">
                <dt className="text-ink">Total</dt>
                <dd className="text-base font-medium text-ink">{inr(totals.total)}</dd>
              </div>
            </dl>

            <button type="submit" disabled={loading} className="btn btn-primary mt-6 w-full">
              {loading ? 'Placing order…' : `Place order · ${inr(totals.total)}`}
            </button>
          </div>
        </aside>
      </form>
    </div>
  );
};

export default Checkout;
