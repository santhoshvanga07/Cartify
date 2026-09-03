import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { fetchCart, updateCartItem, removeCartItem } from '../features/cart/cartSlice';
import { inr } from '../components/ProductCard';

const Cart = () => {
  const dispatch = useDispatch();
  const { items, totals, loading, error } = useSelector((state) => state.cart);

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const changeQty = (productId, quantity) => {
    if (quantity < 1) return;
    dispatch(updateCartItem({ productId, quantity }));
  };

  if (!loading && items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-28 text-center">
        <h1 className="display text-4xl text-ink">Your bag is empty</h1>
        <p className="mt-3 text-sm text-body">Nothing here yet. Let's fix that.</p>
        <Link to="/products" className="btn btn-primary mt-8">
          Browse the shop
        </Link>
      </div>
    );
  }

  const rows = [
    ['Subtotal', inr(totals.subtotal)],
    ...(totals.discount > 0 ? [['Discount', '- ' + inr(totals.discount)]] : []),
    ['GST (18%)', inr(totals.gst)],
    ['Shipping', totals.shipping === 0 ? 'Free' : inr(totals.shipping)],
  ];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="display text-4xl text-ink">Your bag</h1>
      <p className="mt-2 text-sm text-body">
        {totals.itemCount} {totals.itemCount === 1 ? 'item' : 'items'}
      </p>

      <div className="mt-10 grid gap-12 md:grid-cols-[1fr_300px]">
        {/* Line items */}
        <section>
          {items.map(({ product, quantity, maxAvailable, lineTotal }) => (
            <div key={product._id} className="flex gap-5 border-b border-line py-6">
              <Link
                to={`/products/${product.slug}`}
                className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-surface"
              >
                {product.images?.[0]?.url ? (
                  <img src={product.images[0].url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="display text-2xl text-muted/40">{product.brand.charAt(0)}</span>
                  </div>
                )}
              </Link>

              <div className="flex-1">
                <p className="text-[11px] uppercase tracking-widest text-muted">{product.brand}</p>
                <Link to={`/products/${product.slug}`} className="text-sm text-ink hover:text-accent">
                  {product.name}
                </Link>
                <p className="mt-1 text-sm text-body">{inr(product.price)} each</p>

                <div className="mt-3 flex items-center gap-4">
                  {/* Quantity stepper */}
                  <div className="flex items-center rounded-lg bg-page">
                    <button
                      onClick={() => changeQty(product._id, quantity - 1)}
                      disabled={quantity <= 1 || loading}
                      className="px-3 py-1.5 text-body disabled:opacity-30 hover:text-ink"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm text-ink">{quantity}</span>
                    <button
                      onClick={() => changeQty(product._id, quantity + 1)}
                      disabled={quantity >= maxAvailable || loading}
                      className="px-3 py-1.5 text-body disabled:opacity-30 hover:text-ink"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => dispatch(removeCartItem(product._id))}
                    className="text-xs text-muted underline underline-offset-4 hover:text-ink"
                  >
                    Remove
                  </button>

                  {quantity >= maxAvailable && (
                    <span className="text-xs text-muted">Max available</span>
                  )}
                </div>
              </div>

              <p className="text-sm text-ink">{inr(lineTotal)}</p>
            </div>
          ))}
        </section>

        {/* Summary - every number here was calculated on the server */}
        <aside className="h-fit">
          <div className="card">
            <h2 className="text-sm font-medium text-ink">Order summary</h2>

            <dl className="mt-5 space-y-3 text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-body">{label}</dt>
                  <dd className="text-ink">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between border-t border-line pt-3">
                <dt className="text-ink">Total</dt>
                <dd className="text-base font-medium text-ink">{inr(totals.total)}</dd>
              </div>
            </dl>

            {totals.shipping > 0 && (
              <p className="mt-4 text-xs text-muted">
                Add {inr(5000 - totals.subtotal)} more for free shipping.
              </p>
            )}

            <Link to="/checkout" className="btn btn-primary mt-6 w-full">
              Checkout
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Cart;
