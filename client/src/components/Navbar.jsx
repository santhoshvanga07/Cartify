import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { logoutUser } from '../features/auth/authSlice';
import { useSettings } from '../utils/settings';

const Navbar = () => {
  const { user } = useSelector((state) => state.auth);
  const itemCount = useSelector((state) => state.cart.totals.itemCount);
  const savedCount = useSelector((state) => state.wishlist.products.length);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { storeName } = useSettings();

  const handleLogout = async () => {
    await dispatch(logoutUser());
    toast.success('Signed out');
    navigate('/');
  };

  const navLink = (to, label) => (
    <Link
      to={to}
      className={`text-sm transition-colors ${
        pathname === to ? 'text-ink' : 'text-body hover:text-ink'
      }`}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-20 print:hidden border-b border-line bg-page/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <Link to="/" className="display text-2xl text-ink">
            {storeName}
          </Link>
          {navLink('/products', 'Shop')}
          {navLink('/assistant', 'Assistant')}
          {navLink('/compare', 'Compare')}
        </div>

        <div className="flex items-center gap-5">
          {user ? (
            <>
              <Link to="/orders" className="text-sm text-body transition-colors hover:text-ink">
                Orders
              </Link>
              <Link to="/wishlist" className="text-sm text-body transition-colors hover:text-ink">
                Wishlist{savedCount > 0 && <span className="ml-1 text-accent">({savedCount})</span>}
              </Link>
              <Link to="/cart" className="text-sm text-body transition-colors hover:text-ink">
                Bag{itemCount > 0 && <span className="ml-1 text-accent">({itemCount})</span>}
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2.5 text-sm text-body transition-colors hover:text-ink"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-xs font-medium text-accent">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                {user.name}
              </Link>
              {user.role !== 'customer' && (
                <Link to="/admin" className="text-sm text-body transition-colors hover:text-ink">
                  Dashboard
                </Link>
              )}
              <button onClick={handleLogout} className="text-sm text-muted hover:text-ink">
                Sign out
              </button>
            </>
          ) : (
            <>
              {navLink('/login', 'Sign in')}
              <Link to="/register" className="btn btn-primary">
                Create account
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
