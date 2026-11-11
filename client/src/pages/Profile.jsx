import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { setUser } from '../features/auth/authSlice';
import { fetchMyOrders } from '../features/orders/orderSlice';
import { inr } from '../components/ProductCard';
import PasswordField from '../components/PasswordField';
import { STATUS_LABEL, statusClass } from './Orders';
import usePageTitle from '../hooks/usePageTitle';
import AddressBook from '../components/AddressBook';

/* The customer dashboard. Rendered only through ProtectedRoute. */
const Profile = () => {
  usePageTitle('Your account');
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const orders = useSelector((state) => state.orders.list);
  const savedCount = useSelector((state) => state.wishlist.products.length);

  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    dispatch(fetchMyOrders());
  }, [dispatch]);

  // Money actually spent: cancelled, returned and unpaid online orders do not count.
  const spent = orders
    .filter((o) => !['cancelled', 'returned'].includes(o.status))
    .filter((o) => o.paymentMethod !== 'razorpay' || o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + o.pricing.total, 0);
  const active = orders.filter((o) => ['placed', 'confirmed', 'shipped'].includes(o.status)).length;

  const saveName = async (e) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const { data } = await api.put('/auth/me', { name });
      dispatch(setUser(data.user));
      toast.success('Name updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.newPassword !== pw.confirm) return toast.error('The new passwords do not match');
    setSavingPw(true);
    try {
      const { data } = await api.put('/auth/password', {
        currentPassword: pw.currentPassword,
        newPassword: pw.newPassword,
      });
      dispatch(setUser(data.user));
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not change password');
    } finally {
      setSavingPw(false);
    }
  };

  const setPwField = (e) => setPw({ ...pw, [e.target.name]: e.target.value });

  const stats = [
    ['Orders', orders.length, '/orders'],
    ['In progress', active, '/orders'],
    ['Wishlist', savedCount, '/wishlist'],
    ['Total spent', inr(spent), '/orders'],
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="display text-4xl text-ink">Hello, {user.name.split(' ')[0]}</h1>
      <p className="mt-2 text-sm text-body">
        {user.email} · member since{' '}
        {new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value, to]) => (
          <Link key={label} to={to} className="rounded-xl bg-surface px-4 py-4 transition-colors hover:bg-accent-soft">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-xl text-ink">{value}</p>
          </Link>
        ))}
      </div>

      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="display text-2xl text-ink">Recent orders</h2>
          <Link to="/orders" className="text-sm text-accent hover:underline">
            All orders
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="mt-4 text-sm text-body">
            No orders yet.{' '}
            <Link to="/products" className="text-accent hover:underline">
              Start shopping
            </Link>
          </p>
        ) : (
          <ul className="mt-4">
            {orders.slice(0, 3).map((o) => (
              <li key={o._id}>
                <Link
                  to={`/orders/${o._id}`}
                  className="flex items-center justify-between gap-4 border-b border-line py-4 text-sm hover:text-accent"
                >
                  <span>
                    <span className="text-ink">{o.orderNumber}</span>
                    <span className="block text-xs text-muted">
                      {new Date(o.createdAt).toLocaleDateString('en-IN')} · {o.items.length}{' '}
                      {o.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-ink">{inr(o.pricing.total)}</span>
                    <span className={`text-xs ${statusClass(o.status)}`}>{STATUS_LABEL[o.status]}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddressBook />

      <div className="mt-14 grid gap-6 md:grid-cols-2">
        <form onSubmit={saveName} className="card">
          <h2 className="text-sm font-medium text-ink">Your details</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className="label" htmlFor="name">
                Name
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                required
                className="field"
              />
            </div>
            <div>
              <label className="label">Email</label>
              <p className="text-sm text-body">{user.email}</p>
            </div>
          </div>
          <button type="submit" disabled={savingName || name.trim() === user.name} className="btn btn-primary mt-5">
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </form>

        <form onSubmit={savePassword} className="card">
          <h2 className="text-sm font-medium text-ink">Change password</h2>
          <div className="mt-4 space-y-4">
            <PasswordField
              label="Current password"
              name="currentPassword"
              autoComplete="current-password"
              value={pw.currentPassword}
              onChange={setPwField}
              required
            />
            <PasswordField
              label="New password"
              name="newPassword"
              autoComplete="new-password"
              value={pw.newPassword}
              onChange={setPwField}
              minLength={8}
              required
            />
            <PasswordField
              label="Confirm new password"
              name="confirm"
              autoComplete="new-password"
              value={pw.confirm}
              onChange={setPwField}
              required
            />
          </div>
          <button type="submit" disabled={savingPw} className="btn btn-primary mt-5">
            {savingPw ? 'Saving…' : 'Change password'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;
