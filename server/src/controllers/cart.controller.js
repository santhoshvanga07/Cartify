import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import { calculateTotals } from '../utils/pricing.js';

/**
 * The bag. Each line is a product AND, for products with options, the chosen
 * size/colour: "Trek Shoes, UK 8" and "Trek Shoes, UK 9" are separate lines.
 */

const variantOf = (req) => String(req.body?.variant ?? req.query.variant ?? '').trim();
const sameLine = (item, productId, variant) =>
  item.product.toString() === productId && (item.variant || '') === variant;

/**
 * The user's cart, created if they have none. One atomic upsert: two quick
 * "Add to bag" clicks from a brand-new user must not both create a cart (the
 * second would hit the unique index and the item would be lost).
 */
export const findOrCreateCart = (userId) =>
  Cart.findOneAndUpdate({ user: userId }, { $setOnInsert: { user: userId, items: [] } }, { upsert: true, returnDocument: 'after' });

/**
 * Loads the user's cart, drops products that were since deleted, and returns
 * it with server-calculated totals. A line whose size/colour no longer exists
 * is kept but marked, so the shopper can see it and pick again.
 */
const buildCartResponse = async (userId) => {
  const cart = await Cart.findOne({ user: userId }).populate(
    'items.product',
    'name slug brand price mrp stock images isActive optionName variants'
  );

  if (!cart) return { items: [], totals: calculateTotals([]) };

  const valid = cart.items.filter((i) => i.product && i.product.isActive);

  const items = valid.map((i) => {
    const problem = i.product.checkVariant(i.variant);
    return {
      product: i.product,
      variant: i.variant || '',
      quantity: i.quantity,
      maxAvailable: problem ? 0 : i.product.stockFor(i.variant),
      ...(problem && { problem }),
      lineTotal: i.product.price * i.quantity,
    };
  });

  const totals = calculateTotals(
    items.filter((i) => !i.problem).map((i) => ({ price: i.product.price, quantity: i.quantity }))
  );

  return { items, totals };
};

/** @route GET /api/cart  @access Private */
export const getCart = async (req, res) => {
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};

/** @route POST /api/cart  @access Private  body: { productId, quantity, variant? } */
export const addToCart = async (req, res) => {
  const { quantity = 1 } = req.body ?? {};
  const productId = String(req.body?.productId ?? '');
  const variant = variantOf(req);
  const qty = Number(quantity);

  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ success: false, message: 'Quantity must be a whole number' });
  }

  const product = await Product.findById(productId);
  if (!product || !product.isActive) {
    return res.status(404).json({ success: false, message: 'Product not found' });
  }
  const problem = product.checkVariant(variant);
  if (problem) return res.status(400).json({ success: false, message: problem });
  const line = product.variants.length ? variant : ''; // ignore a stray size on a product without sizes

  const cart = await findOrCreateCart(req.user.id);
  const existing = cart.items.find((i) => sameLine(i, productId, line));
  const wanted = existing ? existing.quantity + qty : qty;
  const available = product.stockFor(line);

  // Stock is checked on the SERVER. The button being enabled proves nothing.
  if (wanted > available) {
    const what = line ? `${product.name} (${line})` : 'This item';
    return res.status(409).json({
      success: false,
      message:
        available === 0
          ? `${what} is out of stock`
          : `Only ${available} left - you already have ${existing?.quantity ?? 0} in your bag`,
    });
  }

  if (existing) existing.quantity = wanted;
  else cart.items.push({ product: productId, variant: line, quantity: qty });

  await cart.save();
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};

/** @route PATCH /api/cart/:productId?variant=  @access Private  body: { quantity } */
export const updateCartItem = async (req, res) => {
  const qty = Number(req.body?.quantity);
  const variant = variantOf(req);

  if (!Number.isInteger(qty) || qty < 1) {
    return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
  }

  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) return res.status(404).json({ success: false, message: 'Cart is empty' });

  const item = cart.items.find((i) => sameLine(i, req.params.productId, variant));
  if (!item) return res.status(404).json({ success: false, message: 'Item not in cart' });

  const product = await Product.findById(req.params.productId);
  if (!product || !product.isActive) {
    return res.status(404).json({ success: false, message: 'This product is no longer available - remove it from your bag' });
  }
  const available = product.checkVariant(variant) ? 0 : product.stockFor(variant);
  // Lowering the quantity is always allowed: if stock fell below what is in the
  // bag, the shopper must be able to step DOWN to it, not be stuck.
  if (qty > available && qty > item.quantity) {
    return res.status(409).json({ success: false, message: `Only ${available} in stock` });
  }

  item.quantity = qty;
  await cart.save();
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};

/** @route DELETE /api/cart/:productId?variant=  @access Private */
export const removeCartItem = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) return res.status(404).json({ success: false, message: 'Cart is empty' });

  const variant = variantOf(req);
  cart.items = cart.items.filter((i) => !sameLine(i, req.params.productId, variant));
  await cart.save();
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};

/** @route DELETE /api/cart  @access Private */
export const clearCart = async (req, res) => {
  await Cart.findOneAndUpdate({ user: req.user.id }, { items: [] });
  res.status(200).json({ success: true, cart: await buildCartResponse(req.user.id) });
};
