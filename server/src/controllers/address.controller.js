import User, { MAX_ADDRESSES } from '../models/User.js';
import { checkAddress, cleanAddress, sameAddress } from '../utils/address.js';

/**
 * The signed-in customer's address book. Up to five addresses, one default
 * (the one checkout picks first).
 */

const reply = (res, user, status = 200) =>
  res.status(status).json({ success: true, addresses: user.addresses });

/**
 * Adds an address unless the same one is already saved. Shared with checkout's
 * "save this address" box. The first address saved becomes the default.
 * @returns the user, or throws an Error with statusCode 400 when the book is full
 */
export const saveAddressFor = async (userId, raw, { makeDefault = false } = {}) => {
  const user = await User.findById(userId);
  const address = cleanAddress(raw);
  const existing = user.addresses.find((a) => sameAddress(a, address));
  if (existing) {
    if (makeDefault) user.addresses.forEach((a) => { a.isDefault = a._id.equals(existing._id); });
  } else {
    if (user.addresses.length >= MAX_ADDRESSES) {
      const err = new Error(`You can save up to ${MAX_ADDRESSES} addresses - delete one first`);
      err.statusCode = 400;
      throw err;
    }
    const isDefault = makeDefault || user.addresses.length === 0;
    if (isDefault) user.addresses.forEach((a) => { a.isDefault = false; });
    user.addresses.push({ ...address, isDefault });
  }
  await user.save({ validateModifiedOnly: true });
  return user;
};

/** @route GET /api/auth/addresses  @access Private */
export const listAddresses = async (req, res) => {
  const user = await User.findById(req.user.id).select('addresses');
  reply(res, user);
};

/** @route POST /api/auth/addresses  body: address + isDefault?  @access Private */
export const addAddress = async (req, res) => {
  const problem = checkAddress(req.body);
  if (problem) return res.status(400).json({ success: false, message: problem });
  const user = await saveAddressFor(req.user.id, req.body, { makeDefault: req.body.isDefault === true });
  reply(res, user, 201);
};

/** @route PUT /api/auth/addresses/:id  @access Private */
export const updateAddress = async (req, res) => {
  const problem = checkAddress(req.body);
  if (problem) return res.status(400).json({ success: false, message: problem });
  const user = await User.findById(req.user.id);
  const address = user.addresses.id(req.params.id);
  if (!address) return res.status(404).json({ success: false, message: 'Address not found' });
  Object.assign(address, cleanAddress(req.body));
  await user.save({ validateModifiedOnly: true });
  reply(res, user);
};

/** @route PATCH /api/auth/addresses/:id/default  @access Private */
export const setDefaultAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user.addresses.id(req.params.id)) return res.status(404).json({ success: false, message: 'Address not found' });
  user.addresses.forEach((a) => { a.isDefault = a._id.toString() === req.params.id; });
  await user.save({ validateModifiedOnly: true });
  reply(res, user);
};

/** @route DELETE /api/auth/addresses/:id  @access Private */
export const deleteAddress = async (req, res) => {
  const user = await User.findById(req.user.id);
  const address = user.addresses.id(req.params.id);
  if (!address) return res.status(404).json({ success: false, message: 'Address not found' });
  const wasDefault = address.isDefault;
  address.deleteOne();
  // Keep exactly one default while any address is left.
  if (wasDefault && user.addresses.length) user.addresses[0].isDefault = true;
  await user.save({ validateModifiedOnly: true });
  reply(res, user);
};
