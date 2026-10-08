import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchWishlist, removeFromWishlist, moveToCart } from '../features/wishlist/wishlistSlice';
import { fetchCart } from '../features/cart/cartSlice';
import { inr } from '../components/ProductCard';

/* Rendered only through ProtectedRoute. */
const Wishlist = () => {
  const dispatch = useDispatch();
  const { products, loading } = useSelector((state) => state.wishlist);

  useEffect(() => {
    dispatch(fetchWishlist());
  }, [dispatch]);

  const move = async (p) => {
    const result = await dispatch(moveToCart(p._id));
    if (moveToCart.fulfilled.match(result)) {
      dispatch(fetchCart()); // the bag count in the navbar changed too
      toast.success('Moved to your bag');
    } else toast.error(result.payload);
  };

  const remove = async (p) => {
    const result = await dispatch(removeFromWishlist(p._id));
    if (removeFromWishlist.rejected.match(result)) toast.error(result.payload);
  };

  if (!loading && products.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-6 py-24 text-center">
        <h1 className="display text-3xl text-ink">Nothing saved yet</h1>
        <p className="mt-3 text-sm text-body">Tap the heart on any product to keep it here for later.</p>
        <Link to="/products" className="btn btn-primary mt-6">
          Browse the shop
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="display text-4xl text-ink">Wishlist</h1>
      <p className="mt-2 text-sm text-body">
        {products.length} saved {products.length === 1 ? 'item' : 'items'} · prices shown are today's
      </p>

      <ul className="mt-10">
        {products.map((p) => (
          <li key={p._id} className="flex items-center gap-5 border-b border-line py-5">
            <Link to={`/products/${p.slug}`} className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface">
              {p.images?.[0]?.url ? (
                <img src={p.images[0].url} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <span className="display flex h-full items-center justify-center text-2xl text-muted/40">
                  {p.brand.charAt(0)}
                </span>
              )}
            </Link>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-widest text-muted">{p.brand}</p>
              <Link to={`/products/${p.slug}`} className="text-sm text-ink hover:text-accent">
                {p.name}
              </Link>
              <p className="mt-1 text-sm">
                <span className="font-medium text-ink">{inr(p.price)}</span>
                {p.mrp > p.price && <span className="ml-2 text-xs text-muted line-through">{inr(p.mrp)}</span>}
              </p>
              {p.stock === 0 && <p className="mt-1 text-xs text-muted">Sold out</p>}
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
              <button
                onClick={() => move(p)}
                disabled={p.stock === 0 || loading}
                className="btn btn-primary"
              >
                Move to bag
              </button>
              <button onClick={() => remove(p)} className="text-xs text-body hover:text-red-600">
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Wishlist;
