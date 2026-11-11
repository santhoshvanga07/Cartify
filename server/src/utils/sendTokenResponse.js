import jwt from 'jsonwebtoken';

/**
 * The attributes of the auth cookie. Logout MUST clear the cookie with these
 * same attributes: in production the site (Vercel) and the API (Render) are
 * cross-site, and the browser ignores a Set-Cookie on a cross-site response
 * unless it says SameSite=None; Secure - so a plain "expire it" would be
 * silently dropped and the user would stay signed in.
 */
export const authCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,                          // JavaScript cannot read it -> blocks XSS theft
    secure: isProduction,                    // HTTPS only in production
    sameSite: isProduction ? 'none' : 'lax', // 'none' because Vercel -> Render is cross-site
  };
};

/**
 * Signs a JWT, puts it in an httpOnly cookie, and sends the user back.
 * Used by both register and login so cookie behaviour can never drift apart.
 */
const sendTokenResponse = (user, statusCode, res) => {
  // Only non-sensitive identity data goes in the payload - it is READABLE by anyone.
  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

  res.cookie('token', token, {
    ...authCookieOptions(),
    // Defaults keep sign-in working when a host is missing these optional variables.
    maxAge: (Number(process.env.COOKIE_EXPIRES_DAYS) || 7) * 24 * 60 * 60 * 1000,
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
