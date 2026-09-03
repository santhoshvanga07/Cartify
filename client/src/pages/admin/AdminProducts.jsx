import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { inr } from '../../components/ProductCard';
import ProductImages from '../../components/admin/ProductImages';

const BLANK = {
  name: '', brand: '', description: '', price: '', mrp: '', category: '', stock: '',
};

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      api.get('/products', { params: { limit: 50, q: q || undefined } }),
      api.get('/categories'),
    ]);
    setProducts(p.data.products);
    setCategories(c.data.categories);
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => load().catch(() => toast.error('Could not load products')), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const set = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const startEdit = (p) => {
    setEditingId(p._id);
    setEditingProduct(p);
    setForm({
      name: p.name, brand: p.brand, description: p.description,
      price: p.price, mrp: p.mrp, category: p.category?._id || '', stock: p.stock,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancel = () => {
    setEditingId(null);
    setEditingProduct(null);
    setForm(BLANK);
    setShowForm(false);
  };

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        mrp: Number(form.mrp),
        stock: Number(form.stock),
      };
      if (editingId) await api.put(`/products/${editingId}`, payload);
      else await api.post('/products', payload);

      toast.success(editingId ? 'Product updated' : 'Product created');
      cancel();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    // Soft delete on the server - orders keep pointing at it.
    try {
      await api.delete(`/products/${p._id}`);
      toast.success(`${p.name} removed`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="field max-w-xs"
          placeholder="Search products"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          onClick={() => (showForm ? cancel() : setShowForm(true))}
          className={`btn ${showForm ? 'btn-ghost' : 'btn-primary'}`}
        >
          {showForm ? 'Cancel' : 'Add product'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="card mt-5">
          <h2 className="text-sm font-medium text-ink">
            {editingId ? 'Edit product' : 'New product'}
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">Name</label>
              <input name="name" value={form.name} onChange={set} required className="field" />
            </div>
            <div>
              <label className="label">Brand</label>
              <input name="brand" value={form.brand} onChange={set} required className="field" />
            </div>
            <div>
              <label className="label">Category</label>
              <select name="category" value={form.category} onChange={set} required className="field">
                <option value="">Choose</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Price (₹)</label>
              <input name="price" type="number" min="0" value={form.price} onChange={set} required className="field" />
            </div>
            <div>
              <label className="label">MRP (₹)</label>
              <input name="mrp" type="number" min="0" value={form.mrp} onChange={set} required className="field" />
            </div>
            <div>
              <label className="label">Stock</label>
              <input name="stock" type="number" min="0" value={form.stock} onChange={set} required className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Description</label>
              <textarea name="description" value={form.description} onChange={set} required rows={3} className="field" />
            </div>

            {/* Images need a product id, so they appear only when editing.
                Create the product first, then add pictures to it. */}
            {editingProduct && (
              <div className="sm:col-span-2">
                <ProductImages product={editingProduct} onChange={() => load()} />
              </div>
            )}
          </div>

          <button type="submit" disabled={saving} className="btn btn-primary mt-5">
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}
          </button>
        </form>
      )}

      <div className="mt-6 space-y-2">
        {products.map((p) => (
          <div key={p._id} className="flex flex-wrap items-center gap-4 rounded-xl bg-surface px-4 py-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-page">
              {p.images?.[0]?.url ? (
                <img src={p.images[0].url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs text-muted">
                  {p.brand.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link to={`/products/${p.slug}`} className="text-sm text-ink hover:text-accent">
                {p.name}
              </Link>
              <p className="text-xs text-muted">
                {p.brand} · {p.category?.name}
              </p>
            </div>

            <span className="text-sm text-ink">{inr(p.price)}</span>

            <span
              className={`w-20 text-right text-xs ${
                p.stock === 0 ? 'text-red-600' : p.stock <= 5 ? 'text-amber-600' : 'text-muted'
              }`}
            >
              {p.stock === 0 ? 'Sold out' : `${p.stock} in stock`}
            </span>

            <div className="flex gap-3 text-xs">
              <button onClick={() => startEdit(p)} className="text-body hover:text-ink">Edit</button>
              <button onClick={() => remove(p)} className="text-body hover:text-red-600">Remove</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminProducts;
