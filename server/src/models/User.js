import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by queries unless explicitly requested
    },
    role: {
      type: String,
      enum: ['customer', 'admin', 'superadmin'],
      default: 'customer',
    },
    isActive: {
      type: Boolean,
      default: true, // Super Admin suspends by flipping this, not by deleting
    },

    // Tokens issued before this moment are rejected - changing your password
    // signs out every other device.
    passwordChangedAt: Date,

    // Only the SHA-256 of the reset token is stored. A leaked database dump
    // must not hand out working reset links.
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

/* Hash the password before saving - but ONLY when it actually changed. */
userSchema.pre('save', async function () {
  // Mongoose 9: async middleware finishes by returning - there is no `next`.
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);

  // Not on the first save - a brand-new account has no older tokens to revoke.
  // One second back, because JWT iat is whole seconds and the token issued
  // right after this save must still count as newer.
  if (!this.isNew) this.passwordChangedAt = new Date(Date.now() - 1000);
});

/** True when the JWT was issued before the password last changed. */
userSchema.methods.changedPasswordAfter = function (jwtIssuedAt) {
  if (!this.passwordChangedAt) return false;
  return jwtIssuedAt * 1000 < this.passwordChangedAt.getTime();
};

/**
 * Creates a single-use reset token. Returns the RAW token (for the email);
 * only its hash is kept on the document.
 */
userSchema.methods.createPasswordResetToken = function (minutes) {
  const raw = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(raw).digest('hex');
  this.resetPasswordExpire = new Date(Date.now() + minutes * 60 * 1000);
  return raw;
};

/* Compare a plain-text login attempt against the stored hash. */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
