import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';
import { inr } from '../../components/ProductCard';
import ProductImages from '../../components/admin/ProductImages';

const BLANK = {
  name: '', brand: '', description: '', price: '', mrp: '', category: '', stock: '',
};

/* Specs are a free-form key/value map on the server; edited here as rows. */
const toRows = (attributes) => {
  const rows = Object.entries(attributes || {}).map(([key, value]) => ({ key, value }));
  return rows.length ? rows : [{ key: '', value: '' }];
};
const toAttributes = (rows) =>
  Object.fromEntries(rows.filter((r) => r.key.trim() && r.value.trim()).map((r) => [r.key.trim(), r.value.trim()]));

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(BLANK);
  const [editingId, setEditingId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState('');
  // The dashboard's own listing: paginated, and removed products can be shown and restored.
  const [status, setStatus] = useState('active');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [specs, setSpecs] = useState(toRows());
  const [uploadsEnabled, setUploadsEnabled] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Is Cloudinary set up? Asked once, so the form can explain instead of failing.
  useEffect(() => {
    api
      .get('/health/integrations')
      .then(({ data }) => setUploadsEnabled(data.integrations.cloudinary))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      api.get('/products/admin/list', { params: { q: q || undefined, status, page } }),
      api.get('/categories'),
    ]);
    setProducts(p.data.products);
    setPages(Math.max(1, p.data.pages));
    setTotal(p.data.total);
    setCategories(c.data.categories);
    setLoaded(true);
  }, [q, status, page]);

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
    setSpecs(toRows(p.attributes));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancel = () => {
    setEditingId(null);
    setEditingProduct(null);
    setForm(BLANK);
    setSpecs(toRows());
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
        attributes: toAttributes(specs),
      };
      // The stock the form started from. The server applies the admin's change
      // as a difference, so sales made while the form was open are not undone.
      if (editingId && editingProduct) payload.stockWas = editingProduct.stock;
      if (!Number.isInteger(payload.stock) || payload.stock < 0) {
        setSaving(false);
        return toast.error('Stock must be a whole number, 0 or more');
      }
      if (Number(payload.mrp) < Number(payload.price)) {
        setSaving(false);
        return toast.error('MRP cannot be lower than the selling price');
      }

      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success('Product updated');
        cancel();
      } else {
        // Photos need a product id, so creating switches the form straight
        // into edit mode with the photo uploader open.
        const { data } = await api.post('/products', payload);
        setEditingId(data.product._id);
        setEditingProduct(data.product);
        toast.success(uploadsEnabled ? 'Product created - now add its photos' : 'Product created');
      }
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!window.confirm(`Remove "${p.name}" from the store? You can restore it later from "Removed".`)) return;
    // Soft delete on the server - orders keep pointing at it.
    try {
      await api.delete(`/products/${p._id}`);
      toast.success(`${p.name} removed`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove');
    }
  };

  const restore = async (p) => {
    try {
      await api.put(`/products/${p._id}`, { isActive: true });
      toast.success(`${p.name} is back in the store`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not restore');
    }
  };

  const setSpec = (i, field, value) => setSpecs(specs.map((r, j) => (j === i ? { ...r, [field]: value } : r)));

  return (
    <div>
      {!uploadsEnabled && (
        <div className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Photo uploads are off: Cloudinary is not configured on the server. Add CLOUDINARY_CLOUD_NAME,
          CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET to server/.env (or your host&apos;s environment
          variables), restart the API, and run <code>npm run check:cloudinary</code> to verify.
        </div>
      )}

      {loaded && categories.length === 0 && (
        <div className="mb-5 rounded-xl bg-accent-soft px-4 py-3 text-sm text-ink">
          Every product belongs to a category, and there are none yet.{' '}
          <Link to="/admin/categories" className="text-accent underline">
            Create your first category
          </Link>{' '}
          then come back here.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          className="field max-w-xs"
          placeholder="Search products"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="field max-w-[10rem]"
          aria-label="Which products"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="active">In the store</option>
          <option value="removed">Removed</option>
          <option value="all">All</option>
        </select>
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

            {/* Specifications feed the spec table, search and the AI comparison. */}
            <div className="sm:col-span-2">
              <label className="label">Specifications (e.g. RAM → 16 GB)</label>
              <div className="space-y-2">
                {specs.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={row.key}
                      onChange={(e) => setSpec(i, 'key', e.target.value)}
                      placeholder="Name"
                      aria-label={`Specification ${i + 1} name`}
                      className="field"
                    />
                    <input
                      value={row.value}
                      onChange={(e) => setSpec(i, 'value', e.target.value)}
                      placeholder="Value"
                      aria-label={`Specification ${i + 1} value`}
                      className="field"
                    />
                    <button
                      type="button"
                      onClick={() => setSpecs(specs.length > 1 ? specs.filter((_, j) => j !== i) : toRows())}
                      aria-label="Remove specification"
                      className="px-2 text-sm text-muted hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setSpecs([...specs, { key: '', value: '' }])}
                className="mt-2 text-xs text-accent hover:underline"
              >
                + Add specification
              </button>
            </div>

            {/* Photos need a product id: they appear once the product exists. */}
            <div className="sm:col-span-2">
              {editingProduct ? (
                <ProductImages
                  key={editingProduct._id}
                  product={editingProduct}
                  enabled={uploadsEnabled}
                  onChange={() => load()}
                />
              ) : (
                <p className="text-xs text-muted">You can add up to 5 photos right after creating the product.</p>
              )}
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create product'}
            </button>
            {editingId && (
              <button type="button" onClick={cancel} className="btn btn-ghost">
                Done
              </button>
            )}
          </div>
        </form>
      )}

      {loaded && products.length === 0 && !q && status === 'active' && (
        <p className="mt-8 text-sm text-muted">No products yet. Use “Add product” to list your first one.</p>
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
                {!p.isActive && <span className="ml-2 text-red-600">Removed</span>}
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
              {p.isActive ? (
                <button onClick={() => remove(p)} className="text-body hover:text-red-600">Remove</button>
              ) : (
                <button onClick={() => restore(p)} className="text-accent hover:underline">Restore</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm text-body">
          <span>
            Page {page} of {pages} · {total} products
          </span>
          <div className="flex gap-2">
            <button className="btn btn-ghost !px-3 !py-1.5 !text-xs" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>
              Previous
            </button>
            <button className="btn btn-ghost !px-3 !py-1.5 !text-xs" disabled={page >= pages} onClick={() => setPage((n) => n + 1)}>
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
