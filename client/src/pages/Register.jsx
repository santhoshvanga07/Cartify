import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { registerUser, clearError } from '../features/auth/authSlice';
import PasswordField from '../components/PasswordField';

const Register = () => {
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  const { user, loading, error } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      toast.success(`Welcome, ${user.name}`);
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(registerUser(form));
  };

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-20">
      <h1 className="display text-4xl text-ink">Create your account</h1>
      <p className="mt-2 text-sm text-body">It takes less than a minute.</p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5">
        <div>
          <label className="label">Name</label>
          <input name="name" value={form.name} onChange={handleChange} required className="field" />
        </div>

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
          autoComplete="new-password"
          value={form.password}
          onChange={handleChange}
          required
          minLength={8}
          hint="At least 8 characters."
        />

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="mt-8 text-sm text-body">
        Already have one?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default Register;
