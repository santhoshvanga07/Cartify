import jwt from 'jsonwebtoken';

/**
 * Signs a JWT, puts it in an httpOnly cookie, and sends the user back.
 * Used by both register and login so cookie behaviour can never drift apart.
 */
const sendTokenResponse = (user, statusCode, res) => {
  // Only non-sensitive identity data goes in the payload - it is READABLE by anyone.
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  const isProduction = process.env.NODE_ENV === 'production';

  res.cookie('token', token, {
    httpOnly: true,                    // JavaScript cannot read it -> blocks XSS theft
    secure: isProduction,              // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax', // 'none' because Vercel -> Render is cross-site
    maxAge: Number(process.env.COOKIE_EXPIRES_DAYS) * 24 * 60 * 60 * 1000,
  });

  res.status(statusCode).json({
    success: true,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    },
  });
};

export default sendTokenResponse;
