import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import api from '../../api/axios';
import { inr } from '../../components/ProductCard';

/* Compact rupee formatting for axis ticks: 1244000 -> "12.4L" */
const short = (n) =>
  n >= 10000000 ? `${(n / 10000000).toFixed(1)}Cr`
  : n >= 100000 ? `${(n / 100000).toFixed(1)}L`
  : n >= 1000 ? `${(n / 1000).toFixed(0)}k`
  : String(n);

const Stat = ({ label, value, hint, tone }) => (
  <div className="card">
    <p className="text-xs uppercase tracking-widest text-muted">{label}</p>
    <p className={`display mt-2 text-3xl ${tone === 'warn' ? 'text-red-600' : 'text-ink'}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-body">{hint}</p>}
  </div>
);

const AdminOverview = () => {
  const [data, setData] = useState(null);
  const [sales, setSales] = useState([]);
  const [top, setTop] = useState([]);
  const [cats, setCats] = useState([]);
  const [growth, setGrowth] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get('/analytics/overview'),
      api.get('/analytics/sales?days=30'),
      api.get('/analytics/top-products'),
      api.get('/analytics/category-sales'),
      api.get('/analytics/customer-growth'),
      api.get('/analytics/order-status'),
    ])
      .then(([o, s, t, c, g, st]) => {
        setData(o.data);
        setSales(s.data.series);
        setTop(t.data.products);
        setCats(c.data.categories);
        setGrowth(g.data.series);
        setStatuses(st.data.statuses);
      })
      .catch((e) => setError(e.response?.data?.message || 'Could not load analytics'));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
    );
  }

  const t = data.totals;

  // Recharts needs a plain array of objects; these come straight from the API.
  const salesData = sales.map((d) => ({
    date: d.date.slice(5), // "09-02"
    revenue: d.revenue,
    orders: d.orders,
  }));

  const tooltipStyle = {
    background: 'white',
    border: '1px solid var(--color-line)',
    borderRadius: 10,
    fontSize: 12,
  };

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={inr(t.revenue)} hint={`${t.orders} orders`} />
        <Stat label="Avg order" value={inr(t.avgOrderValue)} />
        <Stat label="Customers" value={t.customers} />
        <Stat
          label="Needs attention"
          value={t.pending}
          hint={`${t.lowStock} products low on stock`}
          tone={t.pending > 0 ? 'warn' : undefined}
        />
      </div>

      {/* Revenue over time */}
      <div className="card">
        <h2 className="text-sm font-medium text-ink">Revenue, last 30 days</h2>
        <div className="mt-5 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesData} margin={{ left: -12, right: 8, top: 4 }}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={short} tick={{ fontSize: 11, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                formatter={(value, name) => (name === 'revenue' ? inr(value) : value)}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--color-accent)"
                strokeWidth={2}
                fill="url(#rev)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Category sales */}
        <div className="card">
          <h2 className="text-sm font-medium text-ink">Revenue by category</h2>
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cats} layout="vertical" margin={{ left: 20, right: 8 }}>
                <CartesianGrid stroke="var(--color-line)" horizontal={false} />
                <XAxis type="number" tickFormatter={short} tick={{ fontSize: 11, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: 'var(--color-body)' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => inr(v)} />
                <Bar dataKey="revenue" fill="var(--color-accent)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top products */}
        <div className="card">
          <h2 className="text-sm font-medium text-ink">Best sellers</h2>
          <ol className="mt-4 space-y-3">
            {top.slice(0, 6).map((p, i) => (
              <li key={p._id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 gap-3">
                  <span className="text-muted">{i + 1}</span>
                  <Link to={`/products/${p.slug}`} className="truncate text-ink hover:text-accent">
                    {p.name}
                  </Link>
                </span>
                <span className="shrink-0 text-right">
                  <span className="text-ink">{inr(p.revenue)}</span>
                  <span className="ml-2 text-xs text-muted">{p.units}u</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Customer growth */}
        <div className="card">
          <h2 className="text-sm font-medium text-ink">New customers per month</h2>
          {growth.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No customers yet.</p>
          ) : (
            <div className="mt-5 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growth} margin={{ left: -20, right: 8, top: 4 }}>
                  <CartesianGrid stroke="var(--color-line)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name) => [value, name === 'newCustomers' ? 'New customers' : name]}
                    labelFormatter={(month) => {
                      const row = growth.find((r) => r.month === month);
                      return row ? `${month} · ${row.total} customers in total` : month;
                    }}
                  />
                  <Bar dataKey="newCustomers" fill="var(--color-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Orders by status */}
        <div className="card">
          <h2 className="text-sm font-medium text-ink">Orders by status</h2>
          {statuses.length === 0 ? (
            <p className="mt-4 text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {statuses.map((s) => (
                <li key={s.status} className="flex items-baseline justify-between text-sm">
                  <Link to="/admin/orders" className="capitalize text-body hover:text-ink">
                    {s.status.replace('_', ' ')}
                  </Link>
                  <span className="text-ink">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent orders */}
      <div className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-ink">Recent orders</h2>
          <Link to="/admin/orders" className="text-xs text-accent hover:underline">
            All orders
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {data.recentOrders.map((o) => (
            <Link
              key={o._id}
              to={`/orders/${o._id}`}
              className="flex items-baseline justify-between gap-3 border-b border-line pb-3 text-sm last:border-0"
            >
              <span className="min-w-0">
                <span className="text-ink">{o.orderNumber}</span>
                <span className="ml-3 text-xs text-muted">{o.user?.name}</span>
              </span>
              <span className="shrink-0">
                <span className="text-ink">{inr(o.pricing.total)}</span>
                <span className="ml-3 text-xs text-muted">{o.status}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
