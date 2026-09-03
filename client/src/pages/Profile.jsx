import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

/* Rendered only through ProtectedRoute. */
const Profile = () => {
  const { user } = useSelector((state) => state.auth);

  const rows = [
    ['Name', user.name],
    ['Email', user.email],
    ['Role', user.role],
    ['Member since', new Date(user.createdAt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'long', year: 'numeric',
    })],
  ];

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="display text-4xl text-ink">Your account</h1>

      <dl className="mt-10">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-line py-4 text-sm">
            <dt className="text-muted">{label}</dt>
            <dd className="text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-12">
        <h2 className="display text-2xl text-ink">Orders</h2>
        <p className="mt-2 text-sm text-body">Track deliveries and download invoices.</p>
        <Link to="/orders" className="btn btn-ghost mt-5">View your orders</Link>
      </div>
    </div>
  );
};

export default Profile;
