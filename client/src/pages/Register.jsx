import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { setUser } from '../features/auth/authSlice';
import api from '../api/axios';
import PasswordField from '../components/PasswordField';
import usePageTitle from '../hooks/usePageTitle';

/**
 * Sign-up in two steps:
 *  1. name, email, password -> the server checks the address can receive mail
 *     and emails a 6-digit code (no account yet);
 *  2. the code -> the account is created, already confirmed, and signed in.
 * If email checking is switched off on the server, step 1 creates the account directly.
 */
const Register = () => {
  usePageTitle('Create account');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [step, setStep] = useState('details'); // 'details' | 'code'
  const [pendingEmail, setPendingEmail] = useState('');
  const [code, setCode] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const { user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      toast.success(`Welcome, ${user.name}! Your account is ready.`);
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // "Resend code" unlocks after 30 seconds, like the server's limit.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === 'email') setSuggestion(null);
  };

  const fail = (err, fallback) => {
    toast.error(err.response?.data?.message || fallback);
    return err.response?.data;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setSuggestion(null);
    try {
      const { data } = await api.post('/auth/register', form);
      if (data.pending) {
        setPendingEmail(data.email);
        setStep('code');
        setCode('');
        setCooldown(30);
        toast.info(data.message);
      } else {
        dispatch(setUser(data.user)); // email checking is off on this server
      }
    } catch (err) {
      const body = fail(err, 'Could not create your account');
      if (body?.suggestion) setSuggestion(body.suggestion);
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register/verify', { email: pendingEmail, code });
      dispatch(setUser(data.user));
    } catch (err) {
      fail(err, 'Could not check the code');
      if (/sign up again/i.test(err.response?.data?.message || '')) setStep('details');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/register/resend', { email: pendingEmail });
      toast.success(data.message);
      setCooldown(30);
    } catch (err) {
      fail(err, 'Could not send a new code');
      if (/start signing up again/i.test(err.response?.data?.message || '')) setStep('details');
    } finally {
      setBusy(false);
    }
  };

  if (step === 'code') {
    return (
      <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-20">
        <h1 className="display text-4xl text-ink">Check your email</h1>
        <p className="mt-2 text-sm text-body">
          We sent a 6-digit code to <span className="text-ink">{pendingEmail}</span>. It expires in 10 minutes.
          Can't find it? Look in your spam folder.
        </p>

        <form onSubmit={handleVerify} className="mt-10 space-y-5">
          <div>
            <label className="label" htmlFor="signup-code">6-digit code</label>
            <input
              id="signup-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              required
              autoFocus
              className="field text-center text-2xl tracking-[0.5em]"
            />
          </div>
          <button type="submit" disabled={busy || code.length !== 6} className="btn btn-primary w-full">
            {busy ? 'Checking…' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm">
          <button onClick={resend} disabled={busy || cooldown > 0} className="text-accent hover:underline disabled:text-muted disabled:no-underline">
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
          <button onClick={() => setStep('details')} className="text-body hover:text-ink">
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col justify-center px-6 py-20">
      <h1 className="display text-4xl text-ink">Create your account</h1>
      <p className="mt-2 text-sm text-body">It takes less than a minute. We will email you a code to confirm your address.</p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5">
        <div>
          <label className="label" htmlFor="register-name">Name</label>
          <input id="register-name" name="name" value={form.name} onChange={handleChange} required maxLength={50} className="field" />
        </div>

        <div>
          <label className="label" htmlFor="register-email">Email</label>
          <input
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            required
            className="field"
          />
          {suggestion && (
            <button
              type="button"
              onClick={() => {
                setForm({ ...form, email: suggestion });
                setSuggestion(null);
              }}
              className="mt-2 text-sm text-accent hover:underline"
            >
              Use {suggestion} instead
            </button>
          )}
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

        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy ? 'Checking your email…' : 'Continue'}
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
