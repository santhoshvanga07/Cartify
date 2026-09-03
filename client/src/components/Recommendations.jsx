import { useState, useEffect } from 'react';
import api from '../api/axios';
import ProductCard from './ProductCard';

/**
 * Deliberately NOT an LLM call - it is a database query
 * (same category, similar price, in stock, best rated).
 * Instant, free, and explainable, which recommendations should be.
 */
const Recommendations = ({ slug }) => {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/ai/recommendations/${slug}`)
      .then(({ data }) => {
        // Guard against a stale response landing after the user navigated away.
        if (!cancelled) setProducts(data.products);
      })
      .catch(() => {}); // a missing shelf of suggestions is not worth an error
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (products.length === 0) return null;

  return (
    <section className="mt-20 border-t border-line pt-10">
      <h2 className="display text-2xl text-ink">You might also like</h2>
      <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-8 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    </section>
  );
};

export default Recommendations;
