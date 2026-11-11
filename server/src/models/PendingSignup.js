import mongoose from 'mongoose';

/**
 * A sign-up waiting for its 6-digit email code. The account itself is only
 * created once the code is entered, so made-up addresses never become accounts.
 *
 * The password is stored already hashed (bcrypt) and the code as an HMAC -
 * never in plain text. MongoDB deletes the document by itself after it
 * expires (TTL index), so abandoned sign-ups do not pile up.
 */
const pendingSignupSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 50 },
    passwordHash: { type: String, required: true },
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    sentAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

pendingSignupSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('PendingSignup', pendingSignupSchema);
