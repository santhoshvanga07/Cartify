import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { calculateTotals } from '../utils/pricing.js';

/**
 * Loads the user's cart, drops any products that were since deleted,
 * and returns it together with server-calculated totals.
 */
const buildCartResponse = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate(
    'items.product',
    'name slug brand price mrp stock images isActive'
  );

  if (!cart) return { items: [], totals: calculateTotals([]) };

  // A product may have been soft-deleted since it was added.
  const valid = cart.items.filter((i) => i.product && i.product.isActive);

  const items = valid.map((i) => ({
    product: i.product,
    quantity: i.quantity,
    // Clamp the display quantity to what is actually in stock.
    maxAvailable: i.product.stock,
    lineTotal: i.product.price * i.quantity,
  }));

  const totals = calculateTotals(
    items.map((i) => ({ price: i.product.price, quantity: i.quantity }))
  );

  return { items, totals };
};

/** @route GET /api/cart  @access Private */
export const getCart = async (req, res) => {
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};

/** @route POST /api/cart  @access Private  body: { productId, quantity } */
export const addToCart = async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const qty = Number(quantity);

  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ success: false, message: 'Quantity must be a whole number' });
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }

  const cart = (await Cart.findOne({ user: req.user.id })) || new Cart({ user: req.user.id, items: [] });
  const existing = cart.items.find((i) => i.product.toString() === productId);
  const wanted = existing ? existing.quantity + qty : qty;

  // Stock is checked on the SERVER. The button being enabled proves nothing.
  if (wanted > product.stock) {
    return res.status(409).json({
      success: false,
      message:
        product.stock === 0
          ? 'This item is out of stock'
          : `Only ${product.stock} left - you already have ${existing?.quantity ?? 0} in your cart`,
    });
  }

  if (existing) existing.quantity = wanted;
  else cart.items.push({ product: productId, quantity: qty });

  await cart.save();
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};

/** @route PATCH /api/cart/:productId  @access Private  body: { quantity } */
export const updateCartItem = async (req, res) => {
  const qty = Number(req.body.quantity);

  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
  }

  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) return res.status(404).json({ success: false, message: 'Cart is empty' });

  const item = cart.items.find((i) => i.product.toString() === req.params.productId);
  if (!item) return res.status(404).json({ success: false, message: 'Item not in cart' });

  const product = await Product.findById(req.params.productId);
  if (qty > product.stock) {
    return res.status(409).json({ success: false, message: `Only ${product.stock} in stock` });
  }

  item.quantity = qty;
  await cart.save();
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};

/** @route DELETE /api/cart/:productId  @access Private */
export const removeCartItem = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) return res.status(404).json({ success: false, message: 'Cart is empty' });

  cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
  await cart.save();
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};

/** @route DELETE /api/cart  @access Private */
export const clearCart = async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};
