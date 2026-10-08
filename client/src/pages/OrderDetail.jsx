import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchOrder, cancelOrder } from '../features/orders/orderSlice';
import { inr } from '../components/ProductCard';
import { STATUS_LABEL, statusClass } from './Orders';

const TRACK = ['placed', 'confirmed', 'shipped', 'delivered'];

const OrderDetail = () => {
  const { id } = useParams();
  const dispatch = useDispatch();
  const { current: order, loading, error } = useSelector((state) => state.orders);

  useEffect(() => {
    dispatch(fetchOrder(id));
  }, [id, dispatch]);

  if (loading && !order) return <p className="px-6 py-20 text-center text-sm text-muted">Loading…</p>;

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <p className="display text-3xl text-ink">{error}</p>
        <Link to="/orders" className="mt-6 inline-block text-sm text-accent hover:underline">
          Your orders
        </Link>
      </div>
    );
  }

  if (!order) return null;

  const canCancel = ['placed', 'confirmed'].includes(order.status);
  const stepIndex = TRACK.indexOf(order.status);
  const isCancelled = ['cancelled', 'returned'].includes(order.status);

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
        <span className={`text-sm ${statusClass(order.status)}`}>{STATUS_LABEL[order.status]}</span>
      </div>

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
            <li key={i.slug} className="flex justify-between gap-4 border-b border-line py-4 text-sm">
              <div>
                <p className="text-[11px] uppercase tracking-widest text-muted">{i.brand}</p>
                <Link to={`/products/${i.slug}`} className="text-ink hover:text-accent">
                  {i.name}
                </Link>
                <p className="mt-0.5 text-xs text-body">
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
              {order.paymentMethod === 'cod' ? 'Cash on delivery' : 'Paid online'} ·{' '}
              {order.paymentStatus}
            </p>
          </dl>
        </section>
      </div>

      {canCancel && (
        <button onClick={handleCancel} disabled={loading} className="btn btn-ghost mt-10">
          Cancel this order
        </button>
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
