import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../../api/axios';

const ROLE_LABEL = { customer: 'Customer', admin: 'Admin', superadmin: 'Super Admin' };

/* Super Admin only. Plain admins never see this link, and the server would
   reject them anyway with 403. */
const AdminUsers = () => {
  const me = useSelector((state) => state.auth.user);
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api
      .get('/users', { params: filter ? { role: filter } : {} })
      .then(({ data }) => setUsers(data.users))
      .catch((e) => toast.error(e.response?.data?.message || 'Could not load users'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const createAdmin = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/users/admins', form);
      toast.success(`${form.name} is now an admin`);
      setForm({ name: '', email: '', password: '' });
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create admin');
    } finally {
      setSaving(false);
    }
  };

  const setRole = async (user, role) => {
    try {
      await api.patch(`/users/${user._id}/role`, { role });
      toast.success(`${user.name} is now ${ROLE_LABEL[role]}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change role');
    }
  };

  const setActive = async (user, isActive) => {
    try {
      const { data } = await api.patch(`/users/${user._id}/status`, { isActive });
      toast.success(data.message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {['', 'customer', 'admin', 'superadmin'].map((r) => (
            <button
              key={r || 'all'}
              onClick={() => setFilter(r)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                filter === r ? 'bg-ink text-white' : 'bg-surface text-body hover:text-ink'
              }`}
            >
              {r ? ROLE_LABEL[r] : 'Everyone'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className={`btn ${showForm ? 'btn-ghost' : 'btn-primary'}`}
        >
          {showForm ? 'Cancel' : 'Create admin'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createAdmin} className="card mt-5">
          <h2 className="text-sm font-medium text-ink">New admin</h2>
          <p className="mt-1 text-xs text-body">
            This is the only way to create an admin. Public registration always produces a customer.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="field"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                className="field"
              />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                className="field"
              />
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn btn-primary mt-4">
            {saving ? 'Creating…' : 'Create admin'}
          </button>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {users.map((u) => {
          const isMe = u._id === me?._id;
          return (
            <div key={u._id} className="flex flex-wrap items-center gap-4 rounded-xl bg-surface px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  {u.name}
                  {isMe && <span className="ml-2 text-xs text-muted">(you)</span>}
                  {!u.isActive && <span className="ml-2 text-xs text-red-600">suspended</span>}
                </p>
                <p className="text-xs text-muted">{u.email}</p>
              </div>

              <span className="text-xs uppercase tracking-wide text-body">{ROLE_LABEL[u.role]}</span>

              {/* Self-actions are hidden: the server rejects them, and offering
                  a button that locks you out of your own platform is cruel. */}
              {!isMe && (
                <div className="flex gap-3 text-xs">
                  {u.role === 'customer' && (
                    <button onClick={() => setRole(u, 'admin')} className="text-body hover:text-ink">
                      Make admin
                    </button>
                  )}
                  {u.role === 'admin' && (
                    <>
                      <button
                        onClick={() =>
                          window.confirm(
                            `Make ${u.name} a Super Admin? They will be able to manage admins, roles and platform settings.`
                          ) && setRole(u, 'superadmin')
                        }
                        className="text-body hover:text-ink"
                      >
                        Make Super Admin
                      </button>
                      <button onClick={() => setRole(u, 'customer')} className="text-body hover:text-ink">
                        Remove admin
                      </button>
                    </>
                  )}
                  {u.role === 'superadmin' && (
                    <button onClick={() => setRole(u, 'admin')} className="text-body hover:text-ink">
                      Make admin
                    </button>
                  )}
                  <button
                    onClick={() => setActive(u, !u.isActive)}
                    className={u.isActive ? 'text-body hover:text-red-600' : 'text-accent'}
                  >
                    {u.isActive ? 'Suspend' : 'Reactivate'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminUsers;
