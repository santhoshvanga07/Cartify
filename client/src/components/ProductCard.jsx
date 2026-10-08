import { Link } from 'react-router-dom';
import WishlistButton from './WishlistButton';

/**
 * Indian rupee formatting with lakh/crore digit grouping.
 * Whole amounts show no decimals (54,990); fractional ones always show two
 * (4,858.20, never 4,858.2) - money with one decimal place looks like a bug.
 */
export const inr = (n) => {
  const value = Number(n) || 0;
  return `₹${value.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

const ProductCard = ({ product }) => {
  const { name, brand, price, mrp, stock, ratingAvg, slug, images } = product;
  const outOfStock = stock === 0;
  const image = images?.[0]?.url;

  return (
    <Link to={`/products/${slug}`} className="group block">
      {/* Image area: square, quiet, no badges shouting over it */}
      <div className="relative aspect-square overflow-hidden rounded-xl bg-surface">
        {image ? (
          <img
            src={image}
            alt={name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="display text-4xl text-muted/40">{brand.charAt(0)}</span>
          </div>
        )}

        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/70">
            <span className="text-xs tracking-wide text-body uppercase">Sold out</span>
          </div>
        )}

        <WishlistButton product={product} variant="icon" />
      </div>

      <div className="mt-3.5 px-0.5">
        <p className="text-[11px] uppercase tracking-widest text-muted">{brand}</p>
        <h3 className="mt-1 text-sm leading-snug text-ink transition-colors group-hover:text-accent">
          {name}
        </h3>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-sm font-medium text-ink">{inr(price)}</span>
          {mrp > price && (
            <span className="text-xs text-muted line-through">{inr(mrp)}</span>
          )}
        </div>

        {ratingAvg > 0 && (
          <p className="mt-1 text-xs text-muted">
            {ratingAvg.toFixed(1)} &middot; {product.numReviews} reviews
          </p>
        )}
      </div>
    </Link>
  );
};

export default ProductCard;
