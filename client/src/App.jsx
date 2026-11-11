import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';

import { loadUser } from './features/auth/authSlice';
import { fetchCart, resetCart } from './features/cart/cartSlice';
import { fetchWishlist, resetWishlist } from './features/wishlist/wishlistSlice';
import Navbar from './components/Navbar';
import ProtectedRoute from './routes/ProtectedRoute';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Assistant from './pages/Assistant';
import Compare from './pages/Compare';
import Wishlist from './pages/Wishlist';
import Invoice from './pages/Invoice';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminLayout from './pages/admin/AdminLayout';
import AdminOverview from './pages/admin/AdminOverview';
import AdminOrders from './pages/admin/AdminOrders';
import AdminProducts from './pages/admin/AdminProducts';
import AdminCategories from './pages/admin/AdminCategories';
import AdminUsers from './pages/admin/AdminUsers';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminModeration from './pages/admin/AdminModeration';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminReports from './pages/admin/AdminReports';
import AdminSettings from './pages/admin/AdminSettings';
import AdminActivity from './pages/admin/AdminActivity';
import NotFound from './pages/NotFound';
import Footer from './components/Footer';
import VerifyEmailBanner from './components/VerifyEmailBanner';
import VerifyEmail from './pages/VerifyEmail';
import { Terms, Privacy, Returns, Shipping, Contact } from './pages/Policies';

function App() {
  const dispatch = useDispatch();

  // On app start, ask the server who we are - the cookie may still be valid.
  const user = useSelector((state) => state.auth.user);

  useEffect(() => {
    dispatch(loadUser());
  }, [dispatch]);

  // Load the cart and wishlist when someone signs in; clear them when they sign out.
  useEffect(() => {
    if (user) {
      dispatch(fetchCart());
      dispatch(fetchWishlist());
    } else {
      dispatch(resetCart());
      dispatch(resetWishlist());
    }
  }, [user, dispatch]);

  return (
    <div className="min-h-screen bg-page text-ink">
      <Navbar />
      <VerifyEmailBanner />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/verify-email/:token" element={<VerifyEmail />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/returns" element={<Returns />} />
        <Route path="/shipping" element={<Shipping />} />
        <Route path="/contact" element={<Contact />} />

        {/* Logged-in users only */}
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/orders/:id" element={<OrderDetail />} />
          <Route path="/orders/:id/invoice" element={<Invoice />} />
        </Route>

        {/* Staff area. Nested routes render inside AdminLayout's <Outlet />. */}
        <Route element={<ProtectedRoute roles={['admin', 'superadmin']} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminOverview />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="reports" element={<AdminReports />} />
          </Route>
        </Route>

        {/* Super Admin only - a second, tighter gate */}
        <Route element={<ProtectedRoute roles={['superadmin']} />}>
          <Route path="/admin/users" element={<AdminLayout />}>
            <Route index element={<AdminUsers />} />
          </Route>
          <Route path="/admin/settings" element={<AdminLayout />}>
            <Route index element={<AdminSettings />} />
          </Route>
          <Route path="/admin/activity" element={<AdminLayout />}>
            <Route index element={<AdminActivity />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </div>
  );
}

export default App;
