import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../api/axios';
import AddressFields, { BLANK_ADDRESS, oneLine } from './AddressFields';

/** The profile page's saved addresses: add, make default, delete. Up to five. */
const AddressBook = () => {
  const [addresses, setAddresses] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK_ADDRESS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/auth/addresses').then(({ data }) => setAddresses(data.addresses)).catch(() => {});
  }, []);

  const run = async (request, success) => {
    setBusy(true);
    try {
      const { data } = await request();
      setAddresses(data.addresses);
      if (success) toast.success(success);
      return true;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e) => {
    e.preventDefault();
    if (await run(() => api.post('/auth/addresses', form), 'Address saved')) {
      setAdding(false);
      setForm(BLANK_ADDRESS);
    }
  };

  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-2xl text-ink">Saved addresses</h2>
        {!adding && addresses.length < 5 && (
          <button onClick={() => setAdding(true)} className="text-sm text-accent hover:underline">
            Add address
          </button>
        )}
      </div>

      {addresses.length === 0 && !adding && (
        <p className="mt-4 text-sm text-body">No saved addresses yet. Tick “Save this address” at checkout, or add one here.</p>
      )}

      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {addresses.map((a) => (
          <li key={a._id} className="rounded-xl bg-surface p-4 text-sm">
            <p className="text-ink">
              {a.fullName}
              {a.isDefault && <span className="ml-2 text-xs text-accent">Default</span>}
            </p>
            <p className="mt-1 text-body">{oneLine({ ...a, fullName: '' }).replace(/^, /, '')}</p>
            <p className="text-xs text-muted">{a.phone}</p>
            <div className="mt-3 flex gap-4 text-xs">
              {!a.isDefault && (
                <button disabled={busy} onClick={() => run(() => api.patch(`/auth/addresses/${a._id}/default`), 'Default address updated')} className="text-body hover:text-ink">
                  Make default
                </button>
              )}
              <button disabled={busy} onClick={() => run(() => api.delete(`/auth/addresses/${a._id}`), 'Address deleted')} className="text-body hover:text-red-600">
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      {adding && (
        <form onSubmit={add} className="card mt-4">
          <AddressFields value={form} onChange={setForm} idPrefix="book" />
          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-primary">Save address</button>
            <button type="button" onClick={() => setAdding(false)} className="btn btn-ghost">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
};

export default AddressBook;
