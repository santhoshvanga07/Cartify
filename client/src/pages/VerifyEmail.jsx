import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import api from '../api/axios';
import { loadUser } from '../features/auth/authSlice';
import usePageTitle from '../hooks/usePageTitle';

/** Opened from the "Confirm my email" link in the welcome email. */
const VerifyEmail = () => {
  usePageTitle('Confirm your email');
  const { token } = useParams();
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const [state, setState] = useState({ status: 'working', message: '' });
  // The link is single-use: React's development double-render must not spend it twice.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    api
      .post(`/auth/verify-email/${token}`)
      .then(({ data }) => {
        setState({ status: 'done', message: data.message });
        dispatch(loadUser()); // refresh the signed-in user's emailVerified flag
      })
      .catch((err) =>
        setState({ status: 'failed', message: err.response?.data?.message || 'Could not confirm your email' })
      );
  }, [token, dispatch]);

  return (
    <div className="mx-auto max-w-lg px-6 py-24 text-center">
      {state.status === 'working' && <p className="text-sm text-muted">Confirming your email…</p>}
      {state.status === 'done' && (
        <>
          <p className="text-xs uppercase tracking-[0.2em] text-accent">Confirmed</p>
          <h1 className="display mt-4 text-4xl text-ink">You are all set</h1>
          <p className="mt-3 text-sm text-body">{state.message}</p>
          <Link to={user ? '/products' : '/login'} className="btn btn-primary mt-10 inline-block">
            {user ? 'Start shopping' : 'Sign in'}
          </Link>
        </>
      )}
      {state.status === 'failed' && (
        <>
          <h1 className="display text-4xl text-ink">Link not valid</h1>
          <p className="mt-3 text-sm text-body">{state.message}</p>
          <Link to={user ? '/profile' : '/login'} className="btn btn-ghost mt-10 inline-block">
            {user ? 'Go to your account' : 'Sign in'}
          </Link>
        </>
      )}
    </div>
  );
};

export default VerifyEmail;
