import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { aiCompare, clearComparison } from '../features/ai/aiSlice';
import { inr } from '../components/ProductCard';
import api from '../api/axios';

/**
 * Search-as-you-type product picker. A fixed list could only ever offer the
 * first 50 products (the API's page limit); searching reaches all of them.
 */
const ProductPicker = ({ label, value, onChange }) => {
  const [q, setQ] = useState('');
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);

  // Name of a product chosen through the URL (?a=slug), which may not be in the results.
  useEffect(() => {
    if (!value) return;
    let alive = true;
    api.get(`/products/${value}`).then(({ data }) => alive && setSelected(data.product)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [value]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      api
        .get('/products', { params: { q: q.trim() || undefined, limit: 20 } })
        .then(({ data }) => alive && setOptions(data.products))
        .catch(() => {});
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q]);

  const current = selected?.slug === value ? selected : null;
  const list = current && !options.some((o) => o.slug === current.slug) ? [current, ...options] : options;

  return (
    <div className="flex-1">
      <label className="label">{label}</label>
      <input
        className="field"
        placeholder="Search by name or brand"
        aria-label={`${label}: search`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <select
        className="field mt-2"
        aria-label={label}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSelected(list.find((p) => p.slug === e.target.value) || null);
        }}
      >
        <option value="">{list.length ? 'Choose a product' : 'No matches'}</option>
        {list.map((p) => (
          <option key={p._id} value={p.slug}>
            {p.name} — {inr(p.price)}
          </option>
        ))}
      </select>
    </div>
  );
};

const Compare = () => {
  const [params] = useSearchParams();
  const [slugA, setSlugA] = useState(params.get('a') || '');
  const [slugB, setSlugB] = useState(params.get('b') || '');

  const dispatch = useDispatch();
  const { comparison, loading, error } = useSelector((state) => state.ai);

  useEffect(() => () => dispatch(clearComparison()), [dispatch]);

  const run = () => {
    if (slugA && slugB && slugA !== slugB) dispatch(aiCompare({ slugA, slugB }));
  };

  const picker = (value, onChange, label) => <ProductPicker label={label} value={value} onChange={onChange} />;

  const c = comparison?.comparison;
  const A = comparison?.products?.A;
  const B = comparison?.products?.B;

  const column = (product, side, verdict) => (
    <div className={`card ${verdict === side ? 'ring-2 ring-accent' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted">{product.brand}</p>
          <h3 className="display mt-1 text-xl text-ink">{product.name}</h3>
        </div>
        {verdict === side && (
          <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] text-accent">
            Best value
          </span>
        )}
      </div>

      <p className="mt-3 text-lg font-medium text-ink">{inr(product.price)}</p>
      <p className="text-xs text-muted">
        {product.ratingAvg} out of 5 · {product.numReviews} reviews
      </p>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-widest text-accent">Pros</p>
        <ul className="mt-2 space-y-1.5 text-sm text-body">
          {c[side === 'A' ? 'productA' : 'productB'].pros.map((p, i) => (
            <li key={i}>+ {p}</li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <p className="text-xs uppercase tracking-widest text-muted">Cons</p>
        <ul className="mt-2 space-y-1.5 text-sm text-body">
          {c[side === 'A' ? 'productA' : 'productB'].cons.map((p, i) => (
            <li key={i}>− {p}</li>
          ))}
        </ul>
      </div>

      <Link
        to={`/products/${product.slug}`}
        className="mt-6 inline-block text-sm text-accent hover:underline"
      >
        View product
      </Link>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="display text-4xl text-ink">Compare two products</h1>
      <p className="mt-2 text-sm text-body">
        Pick any two. The comparison is generated from their real specifications — never invented.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
        {picker(slugA, setSlugA, 'First product')}
        {picker(slugB, setSlugB, 'Second product')}
        <button
          onClick={run}
          disabled={loading || !slugA || !slugB || slugA === slugB}
          className="btn btn-primary"
        >
          {loading ? 'Comparing…' : 'Compare'}
        </button>
      </div>

      {slugA && slugA === slugB && (
        <p className="mt-3 text-sm text-muted">Pick two different products.</p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {c && (
        <>
          <p className="mt-12 text-base leading-relaxed text-ink">{c.summary}</p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {column(A, 'A', c.bestValue)}
            {column(B, 'B', c.bestValue)}
          </div>

          <div className="mt-8 rounded-xl bg-accent-soft p-6">
            <p className="text-xs uppercase tracking-widest text-accent">Recommendation</p>
            <p className="mt-2 text-sm text-ink">{c.recommendation}</p>
          </div>
        </>
      )}
    </div>
  );
};

export default Compare;
