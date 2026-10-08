import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { inr } from '../../components/ProductCard';

const when = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

/** Customer management: who buys, how much, and blocking abusive accounts. */
const AdminCustomers = () => {
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ customers: [], total: 0, pages: 1 });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/users/customers', { params: { q: search, page } });
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load customers');
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Debounce typing so every keystroke is not a query.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const toggle = async (c) => {
    if (c.isActive && !window.confirm(`Block ${c.name}? They will be signed out and cannot sign in.`)) return;
    setBusyId(c._id);
    try {
      const { data } = await api.patch(`/users/${c._id}/status`, { isActive: !c.isActive });
      toast.success(data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search customers"
          className="field max-w-xs"
        />
        <p className="text-xs text-muted">{data.total} customers</p>
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-normal">Customer</th>
              <th className="px-4 py-3 font-normal">Joined</th>
              <th className="px-4 py-3 text-right font-normal">Orders</th>
              <th className="px-4 py-3 text-right font-normal">Spent</th>
              <th className="px-4 py-3 font-normal">Last order</th>
              <th className="px-4 py-3 font-normal" />
            </tr>
          </thead>
          <tbody>
            {data.customers.map((c) => (
              <tr key={c._id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className={c.isActive ? 'text-ink' : 'text-muted line-through'}>{c.name}</p>
                  <p className="text-xs text-muted">{c.email}</p>
                </td>
                <td className="px-4 py-3 text-body">{when(c.createdAt)}</td>
                <td className="px-4 py-3 text-right text-body">
                  {c.orders > 0 ? (
                    <Link to={`/admin/orders?user=${c._id}`} className="text-accent hover:underline">
                      {c.orders}
                    </Link>
                  ) : (
                    0
                  )}
                </td>
                <td className="px-4 py-3 text-right text-ink">{inr(c.spent)}</td>
                <td className="px-4 py-3 text-body">{when(c.lastOrderAt)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => toggle(c)}
                    disabled={busyId === c._id}
                    className={`text-xs ${c.isActive ? 'text-body hover:text-red-600' : 'text-accent hover:underline'}`}
                  >
                    {c.isActive ? 'Block' : 'Unblock'}
                  </button>
                </td>
              </tr>
            ))}
            {data.customers.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  No customers match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn btn-ghost !py-1.5">
            Previous
          </button>
          <span className="text-muted">
            Page {page} of {data.pages}
          </span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.pages} className="btn btn-ghost !py-1.5">
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminCustomers;
