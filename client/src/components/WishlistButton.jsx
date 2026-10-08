import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { addToWishlist, removeFromWishlist } from '../features/wishlist/wishlistSlice';

/**
 * Heart toggle. `variant="icon"` floats over a product image;
 * the default is a full-width ghost button for the product page.
 */
const WishlistButton = ({ product, variant = 'button' }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const saved = useSelector((state) => state.wishlist.products.some((p) => p._id === product._id));

  const toggle = async (e) => {
    // The icon sits inside a <Link> - do not navigate to the product as well.
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast.info('Sign in to save items');
      return navigate('/login', { state: { from: { pathname: `/products/${product.slug}` } } });
    }

    const result = await dispatch(saved ? removeFromWishlist(product._id) : addToWishlist(product._id));
    if (result.error) toast.error(result.payload);
    else toast.success(saved ? 'Removed from wishlist' : 'Saved to wishlist');
  };

  const heart = (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <button
        onClick={toggle}
        aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        aria-pressed={saved}
        className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-surface/90 shadow-sm transition-colors ${
          saved ? 'text-accent' : 'text-body hover:text-ink'
        }`}
      >
        {heart}
      </button>
    );
  }

  return (
    <button onClick={toggle} aria-pressed={saved} className={`btn btn-ghost w-full ${saved ? 'text-accent' : ''}`}>
      {heart}
      {saved ? 'Saved to wishlist' : 'Save to wishlist'}
    </button>
  );
};

export default WishlistButton;
