import Product from '../models/Product.js';
import { uploadBuffer, deleteImage, isCloudinaryConfigured } from '../config/cloudinary.js';

/**
 * @route POST /api/products/:id/images
 * @access Admin
 * multipart/form-data with an "image" field.
 */
export const uploadProductImage = async (req, res) => {
  if (!isCloudinaryConfigured()) {
    return res.status(503).json({ success: false, message: 'Image uploads are not configured' });
  }
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image supplied' });
  }

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  if (product.images.length >= 5) {
    return res.status(409).json({ success: false, message: 'A product can have at most 5 images' });
  }

  let result;
  try {
    result = await uploadBuffer(req.file.buffer, 'cartify/products');
  } catch (err) {
    // Cloudinary is a third party - it can be down, or reject the file.
    // Its SDK reports permission problems as a bare "unexpected status code",
    // which tells an admin nothing, so translate the ones that have a fix.
    if (err.http_code === 401 || err.http_code === 403) {
      return res.status(502).json({
        success: false,
        message:
          'Cloudinary rejected the upload: the API key lacks upload permission. ' +
          'In the Cloudinary console open Settings > API Keys and use a key with ' +
          'create/write access (the master key has it).',
      });
    }
    return res.status(502).json({ success: false, message: `Upload failed: ${err.message}` });
  }

  // Store BOTH: the url to display, and the public_id so we can delete it later.
  // Keeping only the url would strand the file on Cloudinary forever.
  product.images.push({ url: result.secure_url, publicId: result.public_id });
  await product.save();

  res.status(201).json({ success: true, images: product.images });
};

/**
 * @route DELETE /api/products/:id/images/:publicId
 * @access Admin
 * publicId contains slashes ("cartify/products/abc"), so the route uses a
 * wildcard and we read it from req.params[0].
 */
export const deleteProductImage = async (req, res) => {
  /**
   * A Cloudinary publicId contains slashes ("cartify/products/abc123"), so the
   * route matches it with a wildcard.
   *
   * Express 5 hands a named wildcard back as an ARRAY of path segments
   * (["cartify","products","abc123"]), where Express 4 gave a single string in
   * req.params[0]. Comparing that array to a stored string silently never
   * matches - which showed up as a 404 on every delete.
   */
  const raw = req.params.publicId ?? req.params[0];
  const publicId = Array.isArray(raw) ? raw.join('/') : raw;

  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const image = product.images.find((i) => i.publicId === publicId);
  if (!image) return res.status(404).json({ success: false, message: 'Image not found' });

  // Remove from our database first. If Cloudinary fails afterwards we are left
  // with one orphaned file, which is harmless. The reverse order could leave a
  // product pointing at an image that no longer exists - a broken page.
  product.images = product.images.filter((i) => i.publicId !== publicId);
  await product.save();

  try {
    await deleteImage(publicId);
  } catch {
    // Deliberately swallowed: the user's action succeeded from their point of view.
  }

  res.status(200).json({ success: true, images: product.images });
};
