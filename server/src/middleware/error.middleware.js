/* 404 - no route matched. Must be registered AFTER all routes. */
export const notFound = (req, res, next) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.originalUrl}` });
};

/* Central error handler. Four arguments is what marks it as an error handler. */
export const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Server error';

  // Mongoose: bad ObjectId, e.g. /api/products/not-a-real-id
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose: schema validation failed
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // MongoDB: unique index violated (remember - `unique` is an index, not a validator)
  if (err.code === 11000) {
    status = 409;
    message = `${Object.keys(err.keyValue)[0]} already exists`;
  }

  /**
   * Log stack traces only for 5xx - those are OUR bugs and we need the detail.
   *
   * A 4xx means the client sent something invalid, which is expected and
   * handled. Dumping a stack trace for every failed validation buries real
   * crashes in noise, and in production it would fill the log with the
   * everyday behaviour of a working system.
   */
  if (status >= 500) {
    console.error(err);
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn(`${status} ${req.method} ${req.originalUrl} - ${message}`);
  }

  res.status(status).json({ success: false, message });
};
