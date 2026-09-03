import multer from 'multer';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

/**
 * multer parses multipart/form-data. express.json() cannot - a file upload is
 * not JSON, so without this req.file would be undefined.
 *
 * memoryStorage keeps the file in a Buffer instead of writing it to disk.
 * That is deliberate: the file is only passing through on its way to
 * Cloudinary, and Render's disk is wiped on every deploy anyway.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_BYTES,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    // NOTE: mimetype is supplied by the CLIENT and can be forged. It is a
    // convenience check, not a security boundary - Cloudinary rejects
    // anything that is not really an image, which is the real defence.
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP or AVIF images are allowed'));
    }
    cb(null, true);
  },
});

/**
 * Wraps multer so its errors come back as our standard JSON envelope
 * instead of an HTML error page.
 */
export const uploadSingleImage = (fieldName = 'image') => (req, res, next) => {
  upload.single(fieldName)(req, res, (err) => {
    if (!err) return next();

    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'Image must be 5 MB or smaller'
        : err.code === 'LIMIT_FILE_COUNT'
        ? 'Upload one image at a time'
        : err.message || 'Upload failed';

    res.status(400).json({ success: false, message });
  });
};

export default upload;
