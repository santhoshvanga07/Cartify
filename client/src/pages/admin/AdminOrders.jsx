import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { inr } from '../../components/ProductCard';

/* Mirrors ALLOWED_TRANSITIONS on the server, so the UI only offers moves that
   will actually be accepted. The server still enforces it - this just avoids
   showing an admin a button that is guaranteed to fail. */
const NEXT = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['return_requested'],
  return_requested: ['returned', 'delivered'],
  returned: [],
  cancelled: [],
};

const FILTERS = ['', 'placed', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders', { params: status ? { status } : {} });
      setOrders(data.orders);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const advance = async (order, next) => {
    setBusyId(order._id);
    try {
      const { data } = await api.patch(`/orders/${order._id}/status`, { status: next });
      setOrders((list) => list.map((o) => (o._id === order._id ? data.order : o)));
      toast.success(`${order.orderNumber} → ${next}`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not update');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f || 'all'}
            onClick={() => setStatus(f)}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              status === f ? 'bg-ink text-white' : 'bg-surface text-body hover:text-ink'
            }`}
          >
            {f || 'All'}
          </button>
        ))}
      </div>

      {loading && <p className="mt-8 text-sm text-muted">Loading…</p>}

      {!loading && orders.length === 0 && (
        <p className="mt-8 text-sm text-muted">No orders with that status.</p>
      )}

      <div className="mt-6 space-y-3">
        {orders.map((o) => (
          <div key={o._id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <Link to={`/orders/${o._id}`} className="text-sm text-ink hover:text-accent">
                  {o.orderNumber}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {o.user?.name} · {o.user?.email}
                </p>
                <p className="mt-1 text-xs text-body">
                  {new Date(o.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  {' · '}
                  {o.items.length} {o.items.length === 1 ? 'item' : 'items'}
                  {' · '}
                  {o.paymentMethod.toUpperCase()} ({o.paymentStatus})
                </p>
              </div>

              <div className="text-right">
                <p className="text-sm text-ink">{inr(o.pricing.total)}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted">{o.status}</p>
              </div>
            </div>

            <p className="mt-3 truncate text-xs text-body">
              {o.items.map((i) => `${i.name} × ${i.quantity}`).join(', ')}
            </p>

            {NEXT[o.status]?.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {NEXT[o.status].map((next) => (
                  <button
                    key={next}
                    disabled={busyId === o._id}
                    onClick={() => advance(o, next)}
                    className={`btn ${next === 'cancelled' ? 'btn-ghost' : 'btn-primary'} !px-3 !py-1.5 !text-xs`}
                  >
                    Mark {next.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminOrders;
