import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { invalidateSettings } from '../../utils/settings';

const FIELDS = [
  'storeName', 'legalName', 'address', 'gstin', 'supportEmail',
  'gstRate', 'shippingFlat', 'freeShippingAbove', 'returnWindowDays', 'codEnabled', 'onlinePaymentEnabled',
];
const NUMBERS = ['gstRate', 'shippingFlat', 'freeShippingAbove', 'returnWindowDays'];

/* Super Admin only. Changes apply to every cart and checkout immediately. */
const AdminSettings = () => {
  const [form, setForm] = useState(null);
  const [razorpayKeys, setRazorpayKeys] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/settings')
      .then(({ data }) => {
        setForm(Object.fromEntries(FIELDS.map((k) => [k, data.settings[k]])));
        setRazorpayKeys(data.integrations.razorpayKeys);
      })
      .catch((err) => toast.error(err.response?.data?.message || 'Could not load settings'));
  }, []);

  if (!form) return <p className="text-sm text-muted">Loading…</p>;

  const set = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = { ...form };
      NUMBERS.forEach((k) => (body[k] = Number(body[k])));
      await api.put('/settings', body);
      invalidateSettings();
      toast.success('Settings saved - they apply to new carts and orders now');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const textField = ({ name, label, ...rest }) => (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input id={name} name={name} value={form[name] ?? ''} onChange={set} className="field" {...rest} />
    </div>
  );

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="card">
        <h2 className="text-sm font-medium text-ink">Store &amp; invoice details</h2>
        <p className="mt-1 text-xs text-muted">Printed on every tax invoice.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {textField({ name: 'storeName', label: 'Store name', required: true, maxLength: 40 })}
          {textField({ name: 'legalName', label: 'Registered business name', required: true })}
          <div className="sm:col-span-2">{textField({ name: 'address', label: 'Registered address' })}</div>
          {textField({ name: 'gstin', label: 'GSTIN', maxLength: 15, className: 'field uppercase' })}
          {textField({ name: 'supportEmail', label: 'Support email', type: 'email' })}
        </div>
      </section>

      <section className="card">
        <h2 className="text-sm font-medium text-ink">Tax &amp; shipping</h2>
        <p className="mt-1 text-xs text-muted">Existing orders keep the rates they were charged.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {textField({ name: 'gstRate', label: 'GST rate (%)', type: 'number', min: 0, max: 28, step: '0.5', required: true })}
          {textField({ name: 'shippingFlat', label: 'Shipping fee (₹)', type: 'number', min: 0, max: 1000, required: true })}
          {textField({ name: 'freeShippingAbove', label: 'Free shipping above (₹)', type: 'number', min: 0, required: true })}
        </div>
      </section>

      <section className="card">
        <h2 className="text-sm font-medium text-ink">Payments &amp; returns</h2>
        <div className="mt-4 space-y-3 text-sm">
          <label className="flex items-center gap-3 text-body">
            <input type="checkbox" name="codEnabled" checked={form.codEnabled} onChange={set} />
            Offer cash on delivery
          </label>
          <label className="flex items-center gap-3 text-body">
            <input type="checkbox" name="onlinePaymentEnabled" checked={form.onlinePaymentEnabled} onChange={set} />
            Offer online payment (Razorpay)
            {!razorpayKeys && <span className="text-xs text-muted">- needs RAZORPAY keys on the server</span>}
          </label>
        </div>
        <div className="mt-4 max-w-xs">
          {textField({ name: 'returnWindowDays', label: 'Return window (days after delivery)', type: 'number', min: 0, max: 30, required: true })}
        </div>
      </section>

      <button type="submit" disabled={saving} className="btn btn-primary">
        {saving ? 'Saving…' : 'Save settings'}
      </button>
    </form>
  );
};

export default AdminSettings;
