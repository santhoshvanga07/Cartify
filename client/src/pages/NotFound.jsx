import { Link } from 'react-router-dom';

/** Any URL that matches no route - better than a blank page under the navbar. */
const NotFound = () => (
  <div className="mx-auto max-w-lg px-6 py-24 text-center">
    <p className="text-xs uppercase tracking-[0.2em] text-accent">404</p>
    <h1 className="display mt-4 text-4xl text-ink">Page not found</h1>
    <p className="mt-3 text-sm text-body">The link may be old, or the page may have moved.</p>
    <div className="mt-10 flex justify-center gap-3">
      <Link to="/" className="btn btn-primary">Home</Link>
      <Link to="/products" className="btn btn-ghost">Shop</Link>
    </div>
  </div>
);

export default NotFound;
