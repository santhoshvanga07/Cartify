import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { inr } from '../../components/ProductCard';

const BLANK = {
  code: '', description: '', type: 'percent', value: '', maxDiscount: '', minOrder: '',
  usageLimit: '', expiresAt: '', isActive: true,
};

/** Converts the stored coupon into form strings, and back. */
const toForm = (c) => ({
  ...BLANK,
  ...c,
  maxDiscount: c.maxDiscount || '',
  minOrder: c.minOrder || '',
  usageLimit: c.usageLimit || '',
  expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
});
const toBody = (f) => ({
  code: f.code,
  description: f.description,
  type: f.type,
  value: Number(f.value),
  maxDiscount: Number(f.maxDiscount) || 0,
  minOrder: Number(f.minOrder) || 0,
  usageLimit: Number(f.usageLimit) || 0,
  // End of the chosen day, so "expires 31 Dec" still works on 31 Dec.
  expiresAt: f.expiresAt ? new Date(`${f.expiresAt}T23:59:59`).toISOString() : null,
  isActive: f.isActive,
});

const describe = (c) =>
  c.type === 'percent'
    ? `${c.value}% off${c.maxDiscount ? `, up to ${inr(c.maxDiscount)}` : ''}`
    : `${inr(c.value)} off`;

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/coupons').then(({ data }) => setCoupons(data.coupons)).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const set = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const reset = () => {
    setForm(BLANK);
    setEditingId(null);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) await api.put(`/coupons/${editingId}`, toBody(form));
      else await api.post('/coupons', toBody(form));
      toast.success(editingId ? 'Coupon updated' : 'Coupon created');
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c) => {
    try {
      await api.put(`/coupons/${c._id}`, { isActive: !c.isActive });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete coupon ${c.code}? Past orders keep their discount.`)) return;
    try {
      await api.delete(`/coupons/${c._id}`);
      toast.success('Coupon deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete');
    }
  };

  const expired = (c) => c.expiresAt && new Date(c.expiresAt) < new Date();

  return (
    <div>
      <form onSubmit={save} className="card">
        <h2 className="text-sm font-medium text-ink">{editingId ? 'Edit coupon' : 'New coupon'}</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Code</label>
            <input name="code" value={form.code} onChange={set} required className="field uppercase" />
          </div>
          <div>
            <label className="label">Type</label>
            <select name="type" value={form.type} onChange={set} className="field">
              <option value="percent">Percentage</option>
              <option value="flat">Flat amount</option>
            </select>
          </div>
          <div>
            <label className="label">{form.type === 'percent' ? 'Percent off' : 'Rupees off'}</label>
            <input name="value" type="number" min="1" value={form.value} onChange={set} required className="field" />
          </div>
          <div className="sm:col-span-3">
            <label className="label">Description shown to shoppers</label>
            <input name="description" value={form.description} onChange={set} className="field" />
          </div>
          <div>
            <label className="label">Minimum order (₹)</label>
            <input name="minOrder" type="number" min="0" value={form.minOrder} onChange={set} className="field" />
          </div>
          <div>
            <label className="label">Max discount (₹, blank = no cap)</label>
            <input
              name="maxDiscount"
              type="number"
              min="0"
              value={form.maxDiscount}
              onChange={set}
              disabled={form.type === 'flat'}
              className="field"
            />
          </div>
          <div>
            <label className="label">Total uses (blank = unlimited)</label>
            <input name="usageLimit" type="number" min="0" value={form.usageLimit} onChange={set} className="field" />
          </div>
          <div>
            <label className="label">Expires on</label>
            <input name="expiresAt" type="date" value={form.expiresAt} onChange={set} className="field" />
          </div>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-body">
            <input type="checkbox" name="isActive" checked={form.isActive} onChange={set} />
            Active
          </label>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
          </button>
          {editingId && (
            <button type="button" onClick={reset} className="btn btn-ghost">
              Cancel
            </button>
          )}
        </div>
      </form>

      <p className="mt-6 text-xs text-muted">Each customer may use a coupon once.</p>

      <div className="mt-3 space-y-2">
        {coupons.length === 0 && <p className="text-sm text-muted">No coupons yet.</p>}
        {coupons.map((c) => (
          <div key={c._id} className="flex flex-wrap items-center gap-4 rounded-xl bg-surface px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                <span className="font-medium">{c.code}</span>
                <span className="ml-2 text-body">{describe(c)}</span>
              </p>
              <p className="text-xs text-muted">
                {c.minOrder > 0 && `Min ${inr(c.minOrder)} · `}
                Used {c.usedCount}
                {c.usageLimit > 0 && ` of ${c.usageLimit}`}
                {c.expiresAt &&
                  ` · ${expired(c) ? 'Expired' : 'Expires'} ${new Date(c.expiresAt).toLocaleDateString('en-IN')}`}
              </p>
            </div>
            <span className={`text-xs ${c.isActive && !expired(c) ? 'text-accent' : 'text-muted'}`}>
              {c.isActive ? (expired(c) ? 'Expired' : 'Live') : 'Paused'}
            </span>
            <div className="flex gap-3 text-xs">
              <button onClick={() => toggle(c)} className="text-body hover:text-ink">
                {c.isActive ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={() => {
                  setEditingId(c._id);
                  setForm(toForm(c));
                }}
                className="text-body hover:text-ink"
              >
                Edit
              </button>
              <button onClick={() => remove(c)} className="text-body hover:text-red-600">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminCoupons;
