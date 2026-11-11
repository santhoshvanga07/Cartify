import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  awaiting_payment: [],
  abandoned: [],
};

// The last two are online checkouts that are not orders (yet): useful to see abandoned payments.
const FILTERS = ['', 'placed', 'confirmed', 'shipped', 'delivered', 'return_requested', 'returned', 'cancelled', 'awaiting_payment', 'abandoned'];

/** An online order is only fulfilled once paid; until then the server allows cancelling only. */
const movesFor = (o) =>
  o.paymentMethod === 'razorpay' && o.paymentStatus !== 'paid'
    ? (NEXT[o.status] || []).filter((s) => s === 'cancelled')
    : NEXT[o.status] || [];

/* Most moves read as "Mark shipped"; a return decision reads better as a verdict. */
const actionLabel = (from, to) =>
  from === 'return_requested'
    ? to === 'returned' ? 'Accept return' : 'Decline return'
    : `Mark ${to.replace('_', ' ')}`;

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  // ?user=<id> arrives from the customers screen: one customer's orders.
  const [searchParams, setSearchParams] = useSearchParams();
  const userFilter = searchParams.get('user');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (status) params.status = status;
      if (userFilter) params.user = userFilter;
      const { data } = await api.get('/orders', { params });
      setOrders(data.orders);
      setPages(Math.max(1, data.pages));
      setTotal(data.total);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not load orders');
    } finally {
      setLoading(false);
    }
  }, [status, userFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  // "Mark shipped" first asks for the courier details for that one order.
  const COURIERS = ['Delhivery', 'Blue Dart', 'DTDC', 'Ekart', 'India Post', 'Xpressbees', 'Other'];
  const [shipFor, setShipFor] = useState(null);
  const [ship, setShip] = useState({ courier: 'Delhivery', trackingNumber: '', trackingUrl: '', expectedDelivery: '' });
  const setShipField = (e) => setShip({ ...ship, [e.target.name]: e.target.value });

  const advance = async (order, next, shipment) => {
    setBusyId(order._id);
    try {
      const { data } = await api.patch(`/orders/${order._id}/status`, { status: next, ...(shipment && { shipment }) });
      setOrders((list) => list.map((o) => (o._id === order._id ? data.order : o)));
      toast.success(`${order.orderNumber} → ${next}`);
      setShipFor(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not update');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {userFilter && (
        <p className="mb-4 flex items-center gap-3 text-sm text-body">
          Showing orders for {orders[0]?.user?.name || 'one customer'}
          <button
            onClick={() => {
              setSearchParams({});
              setPage(1);
            }}
            className="text-xs text-accent hover:underline">
            Show all
          </button>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f || 'all'}
            onClick={() => {
              setStatus(f);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              status === f ? 'bg-ink text-white' : 'bg-surface text-body hover:text-ink'
            }`}
          >
            {f ? f.replace('_', ' ') : 'All'}
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
                <p className="mt-1 text-xs uppercase tracking-wide text-muted">{o.status.replace('_', ' ')}</p>
              </div>
            </div>

            <p className="mt-3 truncate text-xs text-body">
              {o.items.map((i) => `${i.name}${i.variant ? ` (${i.variant})` : ''} × ${i.quantity}`).join(', ')}
            </p>
            {o.status === 'return_requested' && o.returnReason && (
              <p className="mt-2 text-xs text-ink">Return reason: {o.returnReason}</p>
            )}

            {o.paymentMethod === 'razorpay' && o.paymentStatus !== 'paid' && ['placed', 'confirmed'].includes(o.status) && (
              <p className="mt-2 text-xs text-muted">Awaiting online payment - it can be shipped once paid.</p>
            )}

            {movesFor(o).length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {movesFor(o).map((next) => (
                  <button
                    key={next}
                    disabled={busyId === o._id}
                    onClick={() => {
                      if (next !== 'shipped') return advance(o, next);
                      setShip({ courier: 'Delhivery', trackingNumber: '', trackingUrl: '', expectedDelivery: '' });
                      setShipFor(o._id);
                    }}
                    className={`btn ${next === 'cancelled' || (o.status === 'return_requested' && next === 'delivered') ? 'btn-ghost' : 'btn-primary'} !px-3 !py-1.5 !text-xs`}
                  >
                    {actionLabel(o.status, next)}
                  </button>
                ))}
              </div>
            )}

            {shipFor === o._id && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  advance(o, 'shipped', ship);
                }}
                className="mt-4 grid gap-3 rounded-xl bg-page p-4 sm:grid-cols-2"
              >
                <div>
                  <label className="label" htmlFor={`courier-${o._id}`}>Courier</label>
                  <select id={`courier-${o._id}`} name="courier" value={ship.courier} onChange={setShipField} className="field">
                    {COURIERS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor={`awb-${o._id}`}>Tracking number</label>
                  <input id={`awb-${o._id}`} name="trackingNumber" value={ship.trackingNumber} onChange={setShipField} required maxLength={60} className="field" />
                </div>
                <div>
                  <label className="label" htmlFor={`url-${o._id}`}>Tracking link (optional)</label>
                  <input id={`url-${o._id}`} name="trackingUrl" type="url" placeholder="https://" value={ship.trackingUrl} onChange={setShipField} maxLength={300} className="field" />
                </div>
                <div>
                  <label className="label" htmlFor={`eta-${o._id}`}>Expected delivery</label>
                  <input id={`eta-${o._id}`} name="expectedDelivery" type="date" value={ship.expectedDelivery} onChange={setShipField} className="field" />
                </div>
                <div className="flex gap-2 sm:col-span-2">
                  <button type="submit" disabled={busyId === o._id} className="btn btn-primary !px-3 !py-1.5 !text-xs">
                    Confirm shipped
                  </button>
                  <button type="button" onClick={() => setShipFor(null)} className="btn btn-ghost !px-3 !py-1.5 !text-xs">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm text-body">
          <span>
            Page {page} of {pages} · {total} orders
          </span>
          <div className="flex gap-2">
            <button className="btn btn-ghost !px-3 !py-1.5 !text-xs" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <button className="btn btn-ghost !px-3 !py-1.5 !text-xs" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;
