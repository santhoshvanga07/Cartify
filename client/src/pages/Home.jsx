import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts, fetchCategories } from '../features/products/productSlice';
import ProductCard from '../components/ProductCard';
import { ProductShelf } from '../components/Recommendations';
import { getRecentlyViewed } from '../utils/recentlyViewed';
import usePageTitle from '../hooks/usePageTitle';

const SHELF = 'border-t border-line py-14';

const Home = () => {
  usePageTitle(null);
  const dispatch = useDispatch();
  const { items, categories, loading } = useSelector((state) => state.products);
  const user = useSelector((state) => state.auth.user);
  const [recent] = useState(() => getRecentlyViewed().slice(0, 4));

  useEffect(() => {
    dispatch(fetchCategories());
    dispatch(fetchProducts({ sort: 'rating', limit: 4 }));
  }, [dispatch]);

  return (
    <div className="mx-auto max-w-6xl px-6">
      {/* Hero */}
      <section className="py-20 sm:py-28">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          {user ? `Welcome back, ${user.name.split(' ')[0]}` : 'Shop smart. AI guides.'}
        </p>
        <h1 className="display mt-5 max-w-2xl text-5xl text-ink sm:text-6xl">
          Find the right thing,
          <br />
          <span className="italic text-accent">not just any thing.</span>
        </h1>
        <p className="mt-6 max-w-md text-base leading-relaxed text-body">
          Describe what you need in plain words. Cartify understands budget, use case and
          features, then shows you what actually fits.
        </p>
        <div className="mt-9 flex items-center gap-3">
          <Link to="/products" className="btn btn-primary">
            Browse the shop
          </Link>
          {/* Signed-in visitors are already customers - offering them a
              sign-up button is confusing and looks broken. */}
          {user ? (
            <Link to="/assistant" className="btn btn-ghost">
              Ask the assistant
            </Link>
          ) : (
            <Link to="/register" className="btn btn-ghost">
              Create an account
            </Link>
          )}
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="border-t border-line py-14">
          <div className="flex flex-wrap gap-2.5">
            {categories.map((c) => (
              <Link
                key={c._id}
                to={`/products?category=${c.slug}`}
                className="rounded-full bg-surface px-4 py-2 text-sm text-body transition-colors hover:text-accent"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Highest rated - hidden on a brand-new store with nothing listed yet */}
      {(loading || items.length > 0) && (
      <section className="border-t border-line py-14">
        <div className="flex items-end justify-between">
          <h2 className="display text-3xl text-ink">Highest rated</h2>
          <Link to="/products" className="text-sm text-body hover:text-accent">
            View all &rarr;
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 lg:grid-cols-4">
          {loading && items.length === 0
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-surface" />
              ))
            : items.slice(0, 4).map((p) => <ProductCard key={p._id} product={p} />)}
        </div>
      </section>
      )}

      <ProductShelf title="Trending now" endpoint="/ai/trending" className={SHELF} titleSize="text-3xl" />

      {/* Keyed on the user so signing in or out swaps the shelf immediately. */}
      {user && <ProductShelf key={user._id} title="Picked for you" endpoint="/ai/for-you" className={SHELF} titleSize="text-3xl" />}

      {recent.length > 0 && (
        <ProductShelf
          title="Recently viewed"
          endpoint="/ai/by-slugs"
          params={{ slugs: recent.join(',') }}
          className={SHELF}
          titleSize="text-3xl"
        />
      )}

      <footer className="border-t border-line py-10 text-xs text-muted">
        Cartify &middot; Software Engineering Lab project
      </footer>
    </div>
  );
};

export default Home;
