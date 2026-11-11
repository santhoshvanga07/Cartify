import { useState, useEffect } from 'react';
import api from '../api/axios';
import ProductCard from './ProductCard';

/**
 * A titled row of products from one recommendation endpoint.
 *
 * None of these are LLM calls - they are database queries (same category,
 * bought together, best sellers...). Instant, free, and explainable, which
 * recommendations should be.
 *
 * Renders nothing while loading or when the shelf is empty: a missing row of
 * suggestions is not worth a spinner or an error.
 */
export const ProductShelf = ({
  title,
  endpoint,
  params,
  className = 'mt-20 border-t border-line pt-10',
  titleSize = 'text-2xl',
}) => {
  const [products, setProducts] = useState([]);
  const key = endpoint + JSON.stringify(params || {});

  useEffect(() => {
    if (!endpoint) return undefined;
    let cancelled = false;
    api
      .get(endpoint, { params })
      .then(({ data }) => {
        // Guard against a stale response landing after the user navigated away.
        if (cancelled) return;
        if (!Array.isArray(data?.products)) {
          console.error(`Invalid recommendation response from ${endpoint}: expected a products array.`);
          setProducts([]);
          return;
        }
        setProducts(data.products);
      })
      .catch((error) => {
        if (!cancelled) console.error(`Failed to load recommendations from ${endpoint}.`, error);
      });
    return () => {
      cancelled = true;
    };
    // `key` captures endpoint + params by value, so a new params object
    // with the same contents does not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (products.length === 0) return null;

  return (
    <section className={className}>
      <h2 className={`display ${titleSize} text-ink`}>{title}</h2>
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
        {products.slice(0, 4).map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </section>
  );
};

/** Product page: similar products, and what people bought alongside it. */
const Recommendations = ({ slug }) => (
  <>
    <ProductShelf title="Frequently bought together" endpoint={`/ai/recommendations/${slug}/bought-together`} />
    <ProductShelf title="You might also like" endpoint={`/ai/recommendations/${slug}`} />
  </>
);

export default Recommendations;
