import { NavLink, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';

/**
 * Shell for every admin screen: one sidebar, one <Outlet /> for the page.
 * Super-Admin-only links are hidden for plain admins - but remember that is
 * only tidiness. The server rejects them regardless of what the menu shows.
 */
const AdminLayout = () => {
  const { user } = useSelector((state) => state.auth);
  const isSuper = user?.role === 'superadmin';

  const links = [
    { to: '/admin', label: 'Overview', end: true },
    { to: '/admin/orders', label: 'Orders' },
    { to: '/admin/products', label: 'Products' },
    { to: '/admin/categories', label: 'Categories' },
    { to: '/admin/customers', label: 'Customers' },
    { to: '/admin/coupons', label: 'Coupons' },
    { to: '/admin/moderation', label: 'Moderation' },
    ...(isSuper ? [{ to: '/admin/users', label: 'Users & admins' }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-baseline justify-between">
        <h1 className="display text-4xl text-ink">Dashboard</h1>
        <span className="text-xs uppercase tracking-widest text-muted">{user?.role}</span>
      </div>

      <div className="mt-8 grid gap-10 md:grid-cols-[170px_1fr]">
        <nav className="h-fit space-y-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? 'bg-surface text-ink' : 'text-body hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
