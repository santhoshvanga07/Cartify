import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { loginUser, clearError } from '../features/auth/authSlice';
import PasswordField from '../components/PasswordField';
import usePageTitle from '../hooks/usePageTitle';

const Login = () => {
  usePageTitle('Sign in');
  const [form, setForm] = useState({ email: '', password: '' });

  const { user, loading, error } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Where ProtectedRoute was sending them before it redirected here
  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (user) navigate(from, { replace: true });
  }, [user, navigate, from]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault(); // stop the browser's default full-page reload
    dispatch(loginUser(form));
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-20">
      <h1 className="display text-4xl text-ink">Welcome back</h1>
      <p className="mt-2 text-sm text-body">Sign in to continue shopping.</p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5">
        <div>
          <label className="label">Email</label>
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
            className="field"
          />
        </div>

        <PasswordField
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={handleChange}
          required
        />
        <p className="-mt-2 text-right text-xs">
          <Link to="/forgot-password" className="text-body hover:text-ink">
            Forgot password?
          </Link>
        </p>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-8 text-sm text-body">
        No account?{' '}
        <Link to="/register" className="text-accent hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
};

export default Login;
