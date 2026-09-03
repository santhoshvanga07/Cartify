import { useSelector } from 'react-redux';
import { Navigate, Outlet, useLocation, Link } from 'react-router-dom';

/**
 * The frontend mirror of the backend's protect + authorize.
 * Usage: <Route element={<ProtectedRoute roles={['admin']} />}>
 *
 * IMPORTANT: this is UX, not security. Anyone can edit browser code and reach
 * the page shell - but every API call it makes still returns 403, because the
 * real check runs on the server where users cannot touch it.
 */
const ProtectedRoute = ({ roles }) => {
  const { user, initialised } = useSelector((state) => state.auth);
  const location = useLocation();

  // Wait for the first /auth/me check, or we flash the login page on refresh.
  if (!initialised) {
    return <p className="px-6 py-20 text-center text-sm text-muted">Checking your session…</p>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h2 className="display text-3xl text-ink">Not your door</h2>
        <p className="mt-3 text-sm text-body">
          You are signed in as <span className="text-ink">{user.role}</span>. This area needs{' '}
          {roles.join(' or ')}.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm text-accent hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
