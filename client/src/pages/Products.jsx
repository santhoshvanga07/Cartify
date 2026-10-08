import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import ProductCard from '../components/ProductCard';
import { fetchProducts, fetchCategories } from '../features/products/productSlice';
import VoiceButton from '../components/VoiceButton';

const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: low to high' },
  { value: 'price-desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Top rated' },
];

const Products = () => {
  // Read the initial category from the URL so /products?category=laptops works
  // and the page stays shareable and bookmarkable.
  const [searchParams] = useSearchParams();

  const [filters, setFilters] = useState({
    q: '',
    category: searchParams.get('category') || '',
    maxPrice: '',
    sort: 'newest',
    page: 1,
  });

  const dispatch = useDispatch();
  const { items, categories, total, pages, page, loading, error } = useSelector(
    (state) => state.products
  );

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  /* Debounce: wait 350ms after the last change so typing "laptop" sends one
     request instead of six, and responses cannot arrive out of order. */
  useEffect(() => {
    const timer = setTimeout(() => dispatch(fetchProducts(filters)), 350);
    return () => clearTimeout(timer);
  }, [filters, dispatch]);

  // Any filter change resets to page 1, or you land on an empty page 3.
  const set = (key, value) =>
    setFilters((f) => ({ ...f, [key]: value, page: key === 'page' ? value : 1 }));

  const activeCount = [filters.q, filters.category, filters.maxPrice].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="display text-4xl text-ink">Shop</h1>
      <p className="mt-2 text-sm text-body">
        {loading ? 'Loading…' : `${total} ${total === 1 ? 'item' : 'items'}`}
        {activeCount > 0 && !loading && ' matching your filters'}
      </p>

      <div className="mt-10 grid gap-10 md:grid-cols-[200px_1fr]">
        {/* Filters — quiet, no boxes, just labelled controls */}
        <aside className="h-fit space-y-5">
          <div>
            <label className="label" htmlFor="shop-search">
              Search
            </label>
            <div className="relative">
              <input
                id="shop-search"
                className="field pr-10"
                placeholder="Name or brand"
                value={filters.q}
                onChange={(e) => set('q', e.target.value)}
              />
              <VoiceButton
                onResult={(text) => set('q', text)}
                className="absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2"
              />
            </div>
          </div>

          <div>
            <label className="label">Category</label>
            <select
              className="field"
              value={filters.category}
              onChange={(e) => set('category', e.target.value)}
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c._id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Max price</label>
            <input
              className="field"
              type="number"
              placeholder="Any"
              value={filters.maxPrice}
              onChange={(e) => set('maxPrice', e.target.value)}
            />
          </div>

          <div>
            <label className="label">Sort</label>
            <select
              className="field"
              value={filters.sort}
              onChange={(e) => set('sort', e.target.value)}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {activeCount > 0 && (
            <button
              onClick={() => setFilters({ q: '', category: '', maxPrice: '', sort: 'newest', page: 1 })}
              className="text-xs text-muted underline underline-offset-4 hover:text-ink"
            >
              Clear filters
            </button>
          )}
        </aside>

        <section>
          {error && <p className="text-sm text-red-600">{error}</p>}

          {loading && items.length === 0 && (
            <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
              ))}
            </div>
          )}

          {!loading && items.length === 0 && !error && (
            <div className="py-24 text-center">
              <p className="display text-2xl text-ink">Nothing here yet</p>
              <p className="mt-2 text-sm text-body">Try a wider price range or another category.</p>
            </div>
          )}

          {items.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-3">
                {items.map((p) => (
                  <ProductCard key={p._id} product={p} />
                ))}
              </div>

              {pages > 1 && (
                <div className="mt-14 flex items-center justify-center gap-6 text-sm">
                  <button
                    disabled={page <= 1}
                    onClick={() => set('page', page - 1)}
                    className="text-body disabled:opacity-30 hover:text-accent"
                  >
                    &larr; Previous
                  </button>
                  <span className="text-muted">
                    {page} / {pages}
                  </span>
                  <button
                    disabled={page >= pages}
                    onClick={() => set('page', page + 1)}
                    className="text-body disabled:opacity-30 hover:text-accent"
                  >
                    Next &rarr;
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Products;
