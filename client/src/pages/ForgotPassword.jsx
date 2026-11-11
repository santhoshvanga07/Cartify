import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';
import usePageTitle from '../hooks/usePageTitle';

const ForgotPassword = () => {
  usePageTitle('Forgot password');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send the email');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-md px-6 py-20">
        <h1 className="display text-4xl text-ink">Check your inbox</h1>
        {/* Same wording whether or not the account exists - see the server. */}
        <p className="mt-3 text-sm text-body">
          If <span className="text-ink">{email}</span> has a Cartify account, we have sent a link to
          reset the password. It expires in 30 minutes.
        </p>
        <Link to="/login" className="btn btn-ghost mt-8">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="display text-4xl text-ink">Forgot your password?</h1>
      <p className="mt-2 text-sm text-body">Enter your email and we will send you a reset link.</p>

      <form onSubmit={submit} className="mt-10 space-y-5">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="field"
          />
        </div>
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-8 text-sm text-body">
        Remembered it?{' '}
        <Link to="/login" className="text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};

export default ForgotPassword;
