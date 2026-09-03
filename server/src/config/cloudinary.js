import { v2 as cloudinary } from 'cloudinary';

/**
 * Why upload to Cloudinary instead of saving files on our own server:
 *
 * 1. Render's filesystem is EPHEMERAL. Every deploy or restart wipes it, so
 *    images written to disk would silently vanish in production.
 * 2. Images are served from a CDN near the user, not from our single server.
 * 3. Cloudinary resizes and re-encodes on the fly, so one upload serves a
 *    thumbnail and a full-size image without us storing both.
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true, // always return https:// URLs
});

export const isCloudinaryConfigured = () =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );

/**
 * Uploads a buffer held in memory.
 *
 * The SDK's upload() wants a file path or a URL, so for an in-memory buffer we
 * use upload_stream and wrap its callback in a Promise - that is what lets the
 * controller simply `await` it.
 */
export const uploadBuffer = (buffer, folder = 'cartify/products', options = {}) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
        // Never store anything enormous: cap the stored dimensions and let
        // Cloudinary pick the best format and quality per browser.
        transformation: [
          { width: 1200, height: 1200, crop: 'limit' },
          { quality: 'auto', fetch_format: 'auto' },
        ],
        // Callers can pin a public_id or force a format (used when converting
        // generated SVG artwork into PNG). Spread last so it can override.
        ...options,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });

/** Removes an image. publicId is why we store it alongside the URL. */
export const deleteImage = (publicId) => cloudinary.uploader.destroy(publicId);

export default cloudinary;
