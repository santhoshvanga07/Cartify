import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchProduct } from '../features/products/productSlice';
import { addToCart } from '../features/cart/cartSlice';
import { inr } from '../components/ProductCard';
import Recommendations from '../components/Recommendations';
import Reviews from '../components/Reviews';
import WishlistButton from '../components/WishlistButton';
import Questions from '../components/Questions';

const ProductDetail = () => {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { current: product, loading, error } = useSelector((state) => state.products);
  const user = useSelector((state) => state.auth.user);
  const cartLoading = useSelector((state) => state.cart.loading);

  const handleAdd = async () => {
    // Guests must sign in first - the cart belongs to a user on the server.
    if (!user) {
      toast.info('Please sign in to add items');
      return navigate('/login', { state: { from: { pathname: `/products/${slug}` } } });
    }
    const result = await dispatch(addToCart({ productId: product._id, quantity: 1 }));
    if (addToCart.fulfilled.match(result)) toast.success('Added to your bag');
    else toast.error(result.payload);
  };

  useEffect(() => {
    dispatch(fetchProduct(slug));
  }, [slug, dispatch]);

  if (loading) {
    return (
      <div className="mx-auto grid max-w-5xl gap-12 px-6 py-12 md:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-surface" />
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded bg-surface" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-surface" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-24 text-center">
        <p className="display text-3xl text-ink">{error}</p>
        <Link to="/products" className="mt-6 inline-block text-sm text-accent hover:underline">
          Back to the shop
        </Link>
      </div>
    );
  }

  if (!product) return null;

  const image = product.images?.[0]?.url;
  const saving = product.mrp - product.price;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/products" className="text-sm text-muted hover:text-ink">
        &larr; Shop
      </Link>

      <div className="mt-8 grid gap-12 md:grid-cols-2">
        <div className="aspect-square overflow-hidden rounded-2xl bg-surface">
          {image ? (
            <img src={image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="display text-7xl text-muted/30">{product.brand.charAt(0)}</span>
            </div>
          )}
        </div>

        <div className="pt-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">{product.brand}</p>
          <h1 className="display mt-2 text-4xl leading-tight text-ink">{product.name}</h1>

          {product.numReviews > 0 && (
            <p className="mt-3 text-sm text-body">
              {product.ratingAvg.toFixed(1)} out of 5 &middot; {product.numReviews} reviews
            </p>
          )}

          <div className="mt-7 flex items-baseline gap-3">
            <span className="text-2xl font-medium text-ink">{inr(product.price)}</span>
            {saving > 0 && (
              <>
                <span className="text-sm text-muted line-through">{inr(product.mrp)}</span>
                <span className="text-sm text-accent">Save {inr(saving)}</span>
              </>
            )}
          </div>

          <p className="mt-3 text-sm text-body">
            {product.stock > 0
              ? product.stock <= 5
                ? `Only ${product.stock} left`
                : 'In stock'
              : 'Currently unavailable'}
          </p>

          <button
            onClick={handleAdd}
            disabled={product.stock === 0 || cartLoading}
            className="btn btn-primary mt-8 w-full"
          >
            {product.stock === 0 ? 'Sold out' : cartLoading ? 'Adding…' : 'Add to bag'}
          </button>
          <div className="mt-3">
            <WishlistButton product={product} />
          </div>

          <p className="mt-8 text-sm leading-relaxed text-body">{product.description}</p>
        </div>
      </div>

      {/* Specifications - the same data the AI comparison reads in Week 9 */}
      {Object.keys(product.attributes || {}).length > 0 && (
        <section className="mt-20 border-t border-line pt-10">
          <h2 className="display text-2xl text-ink">Specifications</h2>
          <dl className="mt-6 grid gap-x-12 gap-y-0 sm:grid-cols-2">
            {Object.entries(product.attributes).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-line py-3 text-sm">
                <dt className="text-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <Reviews slug={product.slug} />

      <Questions slug={product.slug} />

      <Recommendations slug={product.slug} />
    </div>
  );
};

export default ProductDetail;
