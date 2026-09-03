import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../../api/axios';

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({ name: '', description: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) await api.put(`/categories/${editingId}`, form);
      else await api.post('/categories', form);
      toast.success(editingId ? 'Category updated' : 'Category created');
      setForm({ name: '', description: '' });
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (c) => {
    try {
      await api.delete(`/categories/${c._id}`);
      toast.success('Category removed');
      load();
    } catch (err) {
      // The server refuses to orphan products - show that reason verbatim.
      toast.error(err.response?.data?.message || 'Could not remove');
    }
  };

  return (
    <div>
      <form onSubmit={save} className="card">
        <h2 className="text-sm font-medium text-ink">
          {editingId ? 'Edit category' : 'New category'}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="field"
            />
          </div>
          <div>
            <label className="label">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="field"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm({ name: '', description: '' });
              }}
              className="btn btn-ghost"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 space-y-2">
        {categories.map((c) => (
          <div key={c._id} className="flex items-center gap-4 rounded-xl bg-surface px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{c.name}</p>
              <p className="text-xs text-muted">
                /{c.slug}
                {c.description && ` · ${c.description}`}
              </p>
            </div>
            <div className="flex gap-3 text-xs">
              <button
                onClick={() => {
                  setEditingId(c._id);
                  setForm({ name: c.name, description: c.description || '' });
                }}
                className="text-body hover:text-ink"
              >
                Edit
              </button>
              <button onClick={() => remove(c)} className="text-body hover:text-red-600">
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminCategories;
