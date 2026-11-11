import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchMyOrders } from '../features/orders/orderSlice';
import { inr } from '../components/ProductCard';
import usePageTitle from '../hooks/usePageTitle';

/* One place that decides how a status looks, so it is consistent everywhere. */
export const STATUS_LABEL = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  return_requested: 'Return requested',
  returned: 'Returned',
};

export const statusClass = (s) =>
  s === 'delivered'
    ? 'text-accent'
    : s === 'cancelled' || s === 'returned'
    ? 'text-red-600'
    : 'text-body';

const Orders = () => {
  usePageTitle('Your orders');
  const dispatch = useDispatch();
  const { list, loading } = useSelector((state) => state.orders);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, [dispatch]);

  if (loading && list.length === 0) {
    return <p className="px-6 py-20 text-center text-sm text-muted">Loading your orders…</p>;
  }

  if (list.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="display text-4xl text-ink">No orders yet</h1>
        <p className="mt-3 text-sm text-body">When you buy something it will show up here.</p>
        <Link to="/products" className="btn btn-primary mt-8">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="display text-4xl text-ink">Your orders</h1>

      <div className="mt-10 space-y-4">
        {list.map((o) => (
          <Link
            key={o._id}
            to={`/orders/${o._id}`}
            className="block rounded-xl bg-surface p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-ink">{o.orderNumber}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(o.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  {' · '}
                  {o.items.length} {o.items.length === 1 ? 'item' : 'items'}
                  {' · '}
                  {o.paymentMethod === 'cod'
                    ? 'Cash on delivery'
                    : o.paymentStatus === 'paid' ? 'Paid online' : `Online payment ${o.paymentStatus}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-ink">{inr(o.pricing.total)}</p>
                <p className={`mt-1 text-xs ${statusClass(o.status)}`}>{STATUS_LABEL[o.status]}</p>
              </div>
            </div>

            <p className="mt-3 truncate text-xs text-body">
              {o.items.map((i) => `${i.name}${i.variant ? ` (${i.variant})` : ''} × ${i.quantity}`).join(', ')}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Orders;
