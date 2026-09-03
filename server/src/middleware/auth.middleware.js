import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * AUTHENTICATION - "who are you?"
 * Verifies the JWT cookie and attaches the live user to req.user.
 */
export const protect = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // covers expired, malformed and forged tokens alike
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  // Look the user up fresh: the token may outlive a deletion or suspension.
  const user = await User.findById(decoded.id);
  if (!user) {
    return res.status(401).json({ success: false, message: 'User no longer exists' });
  }
  if (!user.isActive) {
    return res.status(403).json({ success: false, message: 'Account suspended' });
  }

  req.user = user;
  next();
};

/**
 * AUTHORIZATION - "what may you do?"
 * Must run AFTER protect. Usage: authorize('admin', 'superadmin')
 */
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not allowed to access this resource`,
      });
    }
    next();
  };
};

/**
 * OPTIONAL authentication.
 * Attaches req.user when a valid cookie is present, but never rejects.
 *
 * Used by public endpoints that show a little more to signed-in visitors -
 * the review list marks which reviews are yours and which you have voted on,
 * but strangers must still be able to read it.
 */
export const optionalAuth = async (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return next();

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user && user.isActive) req.user = user;
  } catch {
    // A bad or expired token simply means "treat them as a guest".
  }
  next();
};
