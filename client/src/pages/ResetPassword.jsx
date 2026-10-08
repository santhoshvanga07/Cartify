import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { setUser } from '../features/auth/authSlice';
import PasswordField from '../components/PasswordField';

const ResetPassword = () => {
  const { token } = useParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (password !== confirm) return toast.error('The two passwords do not match');

    setLoading(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password });
      dispatch(setUser(data.user)); // the server signed us in
      toast.success('Password updated');
      navigate('/', { replace: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Could not reset the password';
      if (err.response?.status === 400 && /invalid or has expired/.test(message)) setFailed(true);
      else toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (failed) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <h1 className="display text-4xl text-ink">Link expired</h1>
        <p className="mt-3 text-sm text-body">
          Reset links work once and expire after 30 minutes. Request a new one to continue.
        </p>
        <Link to="/forgot-password" className="btn btn-primary mt-8">
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="display text-4xl text-ink">Choose a new password</h1>
      <p className="mt-2 text-sm text-body">This signs you out on every other device.</p>

      <form onSubmit={submit} className="mt-10 space-y-5">
        <PasswordField
          label="New password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
          hint="At least 8 characters"
        />
        <PasswordField
          label="Confirm new password"
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </div>
  );
};

export default ResetPassword;
