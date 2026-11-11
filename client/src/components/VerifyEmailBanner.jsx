import { useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import api from '../api/axios';
import { useSettings } from '../utils/settings';

/**
 * Shown to customers who have not confirmed their email yet. Ordering needs a
 * confirmed email, so they should know before they reach checkout.
 */
const VerifyEmailBanner = () => {
  const user = useSelector((state) => state.auth.user);
  const [sending, setSending] = useState(false);
  const { emailVerificationRequired } = useSettings();
  if (!emailVerificationRequired || !user || user.role !== 'customer' || user.emailVerified !== false) return null;

  const resend = async () => {
    setSending(true);
    try {
      const { data } = await api.post('/auth/verify-email/resend');
      toast.success(data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send the link');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-amber-50 print:hidden">
      <p className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-6 py-2.5 text-sm text-amber-900">
        Please confirm your email - we sent a link to {user.email}. You need it to place orders.
        <button onClick={resend} disabled={sending} className="font-medium underline">
          {sending ? 'Sending…' : 'Send a new link'}
        </button>
      </p>
    </div>
  );
};

export default VerifyEmailBanner;
