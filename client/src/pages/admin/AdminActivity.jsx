import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';

const GROUPS = [
  ['', 'Everything'],
  ['auth', 'Sign-ins'],
  ['order', 'Orders'],
  ['product', 'Products'],
  ['category', 'Categories'],
  ['coupon', 'Coupons'],
  ['user', 'Users'],
  ['review', 'Reviews'],
  ['question', 'Q&A'],
  ['settings', 'Settings'],
  ['report', 'Exports'],
];

const LABEL = {
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.login_blocked': 'Blocked sign-in',
  'auth.password_change': 'Changed password',
  'auth.password_reset': 'Reset password',
};
const describe = (action) => LABEL[action] || action.replace('.', ' · ').replace(/_/g, ' ');
const isAlarm = (action) => ['auth.login_failed', 'auth.login_blocked', 'user.suspend'].includes(action);

/* Super Admin only: the platform's audit trail. Read-only by design. */
const AdminActivity = () => {
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ logs: [], total: 0, pages: 1 });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/settings/activity', { params: { action: group, page } });
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load activity');
    }
  }, [group, page]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {GROUPS.map(([key, label]) => (
          <button
            key={key || 'all'}
            onClick={() => {
              setGroup(key);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
              group === key ? 'bg-ink text-white' : 'bg-surface text-body hover:text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted">{data.total} events · kept for 180 days</p>

      <div className="mt-3 overflow-x-auto rounded-xl bg-surface">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="px-4 py-3 font-normal">When</th>
              <th className="px-4 py-3 font-normal">Who</th>
              <th className="px-4 py-3 font-normal">What</th>
              <th className="px-4 py-3 font-normal">On</th>
              <th className="px-4 py-3 font-normal">From</th>
            </tr>
          </thead>
          <tbody>
            {data.logs.map((l) => (
              <tr key={l._id} className="border-b border-line align-top last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                  {new Date(l.at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </td>
                <td className="px-4 py-3">
                  {l.actorName ? (
                    <>
                      <p className="text-ink">{l.actorName}</p>
                      <p className="text-xs text-muted">{l.actorRole}</p>
                    </>
                  ) : (
                    <span className="text-muted">Anonymous</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <p className={isAlarm(l.action) ? 'text-red-600' : 'text-ink'}>{describe(l.action)}</p>
                  {l.details && <p className="mt-0.5 max-w-xs break-words text-xs text-body">{l.details}</p>}
                </td>
                <td className="px-4 py-3 text-body">{l.target?.label || '—'}</td>
                <td className="px-4 py-3 text-xs text-muted">{l.ip || '—'}</td>
              </tr>
            ))}
            {data.logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  Nothing recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.pages > 1 && (
        <div className="mt-4 flex items-center gap-3 text-sm">
          <button onClick={() => setPage((p) => p - 1)} disabled={page === 1} className="btn btn-ghost !py-1.5">
            Newer
          </button>
          <span className="text-muted">
            Page {page} of {data.pages}
          </span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.pages} className="btn btn-ghost !py-1.5">
            Older
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminActivity;
