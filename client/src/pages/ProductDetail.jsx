import { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchProduct } from '../features/products/productSlice';
import { addToCart } from '../features/cart/cartSlice';
import { inr } from '../components/ProductCard';
import Recommendations, { ProductShelf } from '../components/Recommendations';
import { getRecentlyViewed, recordView } from '../utils/recentlyViewed';
import Reviews from '../components/Reviews';
import WishlistButton from '../components/WishlistButton';
import Questions from '../components/Questions';
import usePageTitle from '../hooks/usePageTitle';

const ProductDetail = () => {
  usePageTitle(useSelector((state) => state.products.current?.name));
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
    if (hasOptions && !chosen) return toast.info(`Please choose a ${optionName.toLowerCase()}`);
    const result = await dispatch(addToCart({ productId: product._id, quantity: 1, variant: chosen || undefined }));
    if (addToCart.fulfilled.match(result)) toast.success('Added to your bag');
    else toast.error(result.payload);
  };

  // Read during render, i.e. BEFORE the effect below records this visit, so
  // the shelf shows what came before rather than the page you are on.
  // Keyed on slug: recomputed on every product-to-product navigation.
  // Which photo is showing. Reset to the cover whenever the product changes.
  const [photo, setPhoto] = useState({ slug, index: 0 });
  const photoIndex = photo.slug === slug ? photo.index : 0;

  // The chosen size/colour, remembered per product page.
  const [choice, setChoice] = useState({ slug, label: '' });
  const chosen = choice.slug === slug ? choice.label : '';
  const hasOptions = product?.variants?.length > 0;
  const optionName = product?.optionName || 'Size';
  const chosenStock = hasOptions && chosen ? product.variants.find((v) => v.label === chosen)?.stock ?? 0 : null;

  const recent = useMemo(() => getRecentlyViewed().filter((s) => s !== slug).slice(0, 4), [slug]);

  useEffect(() => {
    dispatch(fetchProduct(slug));
    recordView(slug);
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

  const images = product.images || [];
  const image = images[photoIndex]?.url || images[0]?.url;
  const saving = product.mrp - product.price;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <Link to="/products" className="text-sm text-muted hover:text-ink">
        &larr; Shop
      </Link>

      <div className="mt-8 grid gap-12 md:grid-cols-2">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-surface">
            {image ? (
              <img src={image} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="display text-7xl text-muted/30">{product.brand.charAt(0)}</span>
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="mt-3 flex gap-2">
              {images.map((img, i) => (
                <button
                  key={img.publicId || img.url}
                  onClick={() => setPhoto({ slug, index: i })}
                  aria-label={`Show photo ${i + 1}`}
                  aria-pressed={i === photoIndex}
                  className={`h-16 w-16 overflow-hidden rounded-lg bg-surface ring-offset-2 ring-offset-page ${
                    i === photoIndex ? 'ring-2 ring-accent' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
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

          {hasOptions && (
            <div className="mt-7">
              <p className="label">
                {optionName}
                {chosen && <span className="text-ink">: {chosen}</span>}
              </p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={optionName}>
                {product.variants.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    role="radio"
                    aria-checked={chosen === v.label}
                    disabled={v.stock === 0}
                    onClick={() => setChoice({ slug, label: v.label })}
                    title={v.stock === 0 ? 'Sold out' : undefined}
                    className={`min-w-12 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      chosen === v.label
                        ? 'border-ink bg-ink text-white'
                        : v.stock === 0
                        ? 'cursor-not-allowed border-line text-muted line-through'
                        : 'border-line text-ink hover:border-ink'
                    }`}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-3 text-sm text-body">
            {product.stock === 0
              ? 'Currently unavailable'
              : chosenStock !== null
              ? chosenStock <= 5
                ? `Only ${chosenStock} left in ${chosen}`
                : `${chosen} in stock`
              : hasOptions
              ? `Choose a ${optionName.toLowerCase()}`
              : product.stock <= 5
              ? `Only ${product.stock} left`
              : 'In stock'}
          </p>

          <button
            onClick={handleAdd}
            disabled={product.stock === 0 || cartLoading}
            className="btn btn-primary mt-8 w-full"
          >
            {product.stock === 0
              ? 'Sold out'
              : cartLoading
              ? 'Adding…'
              : hasOptions && !chosen
              ? `Choose a ${optionName.toLowerCase()}`
              : 'Add to bag'}
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

      {recent.length > 0 && (
        <ProductShelf title="Recently viewed" endpoint="/ai/by-slugs" params={{ slugs: recent.join(',') }} />
      )}
    </div>
  );
};

export default ProductDetail;
