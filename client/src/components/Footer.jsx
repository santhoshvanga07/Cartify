import { Link } from 'react-router-dom';
import { useSettings } from '../utils/settings';

/** Site-wide footer: help and policy links, store details. Hidden when printing an invoice. */
const Footer = () => {
  const s = useSettings();
  const year = new Date().getFullYear();
  const col = 'space-y-2 text-sm';
  const link = 'text-body hover:text-ink';
  return (
    <footer className="mt-24 border-t border-line bg-surface print:hidden">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <p className="display text-2xl text-ink">{s.storeName}</p>
          <p className="mt-3 text-sm text-body">Shop smart, with an assistant that only shows what is really in stock.</p>
        </div>
        <div className={col}>
          <p className="text-xs uppercase tracking-widest text-muted">Shop</p>
          <Link to="/products" className={`block ${link}`}>All products</Link>
          <Link to="/assistant" className={`block ${link}`}>Shopping assistant</Link>
          <Link to="/compare" className={`block ${link}`}>Compare products</Link>
          <Link to="/orders" className={`block ${link}`}>Track your order</Link>
        </div>
        <div className={col}>
          <p className="text-xs uppercase tracking-widest text-muted">Help</p>
          <Link to="/contact" className={`block ${link}`}>Contact us</Link>
          <Link to="/shipping" className={`block ${link}`}>Shipping</Link>
          <Link to="/returns" className={`block ${link}`}>Returns &amp; refunds</Link>
        </div>
        <div className={col}>
          <p className="text-xs uppercase tracking-widest text-muted">Legal</p>
          <Link to="/terms" className={`block ${link}`}>Terms of use</Link>
          <Link to="/privacy" className={`block ${link}`}>Privacy policy</Link>
        </div>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-6xl px-6 py-5 text-xs text-muted">
          © {year} {s.legalName}
          {s.gstin && ` · GSTIN ${s.gstin}`}
          {s.address && ` · ${s.address}`}
        </p>
      </div>
    </footer>
  );
};

export default Footer;
