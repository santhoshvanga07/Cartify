import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchOrder, cancelOrder, requestReturn, verifyPayment } from '../features/orders/orderSlice';
import { openRazorpay } from '../utils/razorpay';
import api from '../api/axios';
import { useSettings } from '../utils/settings';
import { inr } from '../components/ProductCard';
import { STATUS_LABEL, statusClass } from './Orders';
import usePageTitle from '../hooks/usePageTitle';

const TRACK = ['placed', 'confirmed', 'shipped', 'delivered'];

const OrderDetail = () => {
  usePageTitle(useSelector((state) => state.orders.current?.orderNumber) || 'Order');
  const { id } = useParams();
  const dispatch = useDispatch();
  const { current, loading, fetchError } = useSelector((state) => state.orders);
  // Only the order for THIS url: never show the previous order (or the previous user's) while loading.
  const order = current?._id === id ? current : null;
  const user = useSelector((state) => state.auth.user);
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState('');
  const [paying, setPaying] = useState(false);
  // The server decides; this only hides a button that would be refused.
  const { returnWindowDays } = useSettings();
  // Read the clock once per visit; render must not call Date.now() directly.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    dispatch(fetchOrder(id));
  }, [id, dispatch]);

  if (fetchError) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="display text-3xl text-ink">{fetchError}</p>
        <Link to="/orders" className="mt-6 inline-block text-sm text-accent hover:underline">
          Your orders
        </Link>
      </div>
    );
  }

  if (!order) return <p className="px-6 py-20 text-center text-sm text-muted">Loading…</p>;

  const canCancel = ['placed', 'confirmed'].includes(order.status);
  const stepIndex = TRACK.indexOf(order.status);
  const isCancelled = ['cancelled', 'returned'].includes(order.status);

  // order.user is usually populated ({ _id, name }), but accept a bare id too.
  const isOwner = (order.user?._id ?? order.user) === user?._id;
  const deliveredAt = order.deliveredAt || order.statusHistory.findLast((h) => h.status === 'delivered')?.at;
  const returnOpen =
    order.status === 'delivered' &&
    deliveredAt &&
    now < new Date(deliveredAt).getTime() + returnWindowDays * 86400000;
  const awaitingPayment =
    order.paymentMethod === 'razorpay' && order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded'
    && !['cancelled', 'abandoned'].includes(order.status);

  const handlePay = async () => {
    setPaying(true);
    try {
      const { data } = await api.post(`/payments/${order._id}/retry`);
      const payment = await openRazorpay(data.razorpay, user, `Order ${order.orderNumber}`, {
        onAttemptFailed: (m) => toast.error(`${m} - you can try again in the payment window`),
      });
      const result = await dispatch(verifyPayment({ id: order._id, payment }));
      if (verifyPayment.fulfilled.match(result)) toast.success('Payment received');
      else {
        toast.error(result.payload);
        dispatch(fetchOrder(order._id)); // show what the server recorded (e.g. a refund)
      }
    } catch (err) {
      if (!err?.dismissed) toast.error(err.response?.data?.message || err.message);
    } finally {
      setPaying(false);
    }
  };

  const handleReturn = async (e) => {
    e.preventDefault();
    const result = await dispatch(requestReturn({ id: order._id, reason }));
    if (requestReturn.fulfilled.match(result)) {
      toast.success('Return requested - we will be in touch');
      setReturning(false);
    } else toast.error(result.payload);
  };

  const handleCancel = async () => {
    const result = await dispatch(cancelOrder(order._id));
    if (cancelOrder.fulfilled.match(result)) toast.success('Order cancelled');
    else toast.error(result.payload);
  };

  const a = order.shippingAddress;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link to="/orders" className="text-sm text-muted hover:text-ink">
        &larr; Your orders
      </Link>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl text-ink">{order.orderNumber}</h1>
          <p className="mt-2 text-sm text-body">
            Placed{' '}
            {new Date(order.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'long', year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className={`text-sm ${statusClass(order.status)}`}>{STATUS_LABEL[order.status]}</span>
          <Link to={`/orders/${order._id}/invoice`} className="btn btn-ghost !px-3 !py-1.5 !text-xs">
            Invoice
          </Link>
        </div>
      </div>

      {/* Courier details once it has shipped */}
      {order.shipment?.shippedAt && ['shipped', 'delivered'].includes(order.status) && (
        <div className="mt-6 rounded-xl bg-surface px-4 py-3 text-sm">
          <p className="text-ink">
            {order.status === 'delivered' ? 'Delivered' : 'On its way'}
            {order.shipment.courier && <> with {order.shipment.courier}</>}
            {order.shipment.trackingNumber && <span className="text-body"> · Tracking {order.shipment.trackingNumber}</span>}
          </p>
          {order.status === 'shipped' && order.shipment.expectedDelivery && (
            <p className="mt-1 text-body">
              Expected by{' '}
              {new Date(order.shipment.expectedDelivery).toLocaleDateString('en-IN', {
                weekday: 'long', day: 'numeric', month: 'long',
              })}
            </p>
          )}
          {order.shipment.trackingUrl && /^https?:\/\//.test(order.shipment.trackingUrl) && (
            <a href={order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-accent hover:underline">
              Track your parcel
            </a>
          )}
        </div>
      )}

      {awaitingPayment && isOwner && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft px-4 py-3">
          <p className="text-sm text-ink">
            {order.status === 'awaiting_payment'
              ? 'Not placed yet - complete the payment to place this order.'
              : order.paymentStatus === 'failed'
              ? 'Your last payment attempt failed.'
              : 'This order is awaiting payment.'}
          </p>
          <button onClick={handlePay} disabled={paying} className="btn btn-primary !py-1.5">
            {paying ? 'Opening…' : `Pay ${inr(order.pricing.total)}`}
          </button>
        </div>
      )}

      {/* Progress track */}
      {!isCancelled && (
        <div className="mt-10 flex gap-1.5">
          {TRACK.map((s, i) => (
            <div key={s} className="flex-1">
              <div className={`h-1 rounded-full ${i <= stepIndex ? 'bg-accent' : 'bg-line'}`} />
              <p className={`mt-2 text-[11px] ${i <= stepIndex ? 'text-ink' : 'text-muted'}`}>
                {STATUS_LABEL[s]}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Items - prices here are the SNAPSHOT taken at purchase time */}
      <section className="mt-12">
        <h2 className="text-sm font-medium text-ink">Items</h2>
        <ul className="mt-4">
          {order.items.map((i) => (
            <li key={`${i.slug}:${i.variant || ''}`} className="flex justify-between gap-4 border-b border-line py-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted">{i.brand}</p>
                <Link to={`/products/${i.slug}`} className="text-ink hover:text-accent">
                  {i.name}
                </Link>
                <p className="mt-0.5 text-xs text-body">
                  {i.variant && `${i.optionName || 'Size'}: ${i.variant} · `}
                  {inr(i.price)} × {i.quantity}
                </p>
              </div>
              <span className="text-ink">{inr(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 grid gap-10 sm:grid-cols-2">
        <section>
          <h2 className="text-sm font-medium text-ink">Delivering to</h2>
          <address className="mt-3 text-sm not-italic leading-relaxed text-body">
            {a.fullName}
            <br />
            {a.line1}
            {a.line2 && (
              <>
                <br />
                {a.line2}
              </>
            )}
            <br />
            {a.city}, {a.state} {a.pincode}
            <br />
            {a.phone}
          </address>
        </section>

        <section>
          <h2 className="text-sm font-medium text-ink">Payment</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-body">Subtotal</dt>
              <dd className="text-ink">{inr(order.pricing.subtotal)}</dd>
            </div>
            {order.pricing.discount > 0 && (
              <div className="flex justify-between">
                <dt className="text-body">Discount{order.coupon?.code && ` (${order.coupon.code})`}</dt>
                <dd className="text-accent">−{inr(order.pricing.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-body">GST</dt>
              <dd className="text-ink">{inr(order.pricing.gst)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-body">Shipping</dt>
              <dd className="text-ink">
                {order.pricing.shipping === 0 ? 'Free' : inr(order.pricing.shipping)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="text-ink">Total</dt>
              <dd className="font-medium text-ink">{inr(order.pricing.total)}</dd>
            </div>
            <p className="pt-1 text-xs text-muted">
              {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Online payment'} ·{' '}
              {order.paymentStatus}
            </p>
          </dl>
        </section>
      </div>

      {canCancel && isOwner && (
        <button onClick={handleCancel} disabled={loading} className="btn btn-ghost mt-10">
          Cancel this order
        </button>
      )}

      {order.returnReason && (
        <p className="mt-10 text-sm text-body">
          <span className="text-ink">Return reason:</span> {order.returnReason}
        </p>
      )}

      {returnOpen && isOwner && !returning && (
        <button onClick={() => setReturning(true)} className="btn btn-ghost mt-10">
          Return this order
        </button>
      )}

      {returning && (
        <form onSubmit={handleReturn} className="card mt-10">
          <label className="label" htmlFor="return-reason">
            Why are you returning it?
          </label>
          <textarea
            id="return-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            minLength={5}
            maxLength={500}
            required
            className="field"
          />
          <p className="mt-2 text-xs text-muted">
            Returns are accepted within {returnWindowDays} days of delivery. Refunds go back to your
            original payment method once we receive the item.
          </p>
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={loading} className="btn btn-primary">
              Request return
            </button>
            <button type="button" onClick={() => setReturning(false)} className="btn btn-ghost">
              Never mind
            </button>
          </div>
        </form>
      )}

      {/* Audit trail */}
      <section className="mt-14 border-t border-line pt-8">
        <h2 className="text-sm font-medium text-ink">History</h2>
        <ol className="mt-4 space-y-3">
          {order.statusHistory.map((h, idx) => (
            <li key={idx} className="flex gap-4 text-sm">
              <span className="w-36 shrink-0 text-xs text-muted">
                {new Date(h.at).toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
              <span className="text-body">{h.note}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};

export default OrderDetail;
