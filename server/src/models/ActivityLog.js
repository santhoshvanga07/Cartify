import mongoose from 'mongoose';

/**
 * The audit trail: who did what, to what, from where.
 *
 * Append-only by convention - nothing in the API updates or deletes a log
 * entry, so an admin who misbehaves cannot tidy up after themselves.
 * Entries expire after 180 days via a TTL index, which keeps the collection
 * bounded without a cron job.
 */
const activityLogSchema = new mongoose.Schema({
  // Null for anonymous events such as a failed sign-in.
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorName: String, // kept even if the account is later deleted
  actorRole: String,

  // Dotted names group naturally: auth.*, order.*, product.*, user.*, settings.*
  action: { type: String, required: true, index: true },
  target: {
    type: { type: String },
    id: String,
    label: String,
  },
  details: String,

  ip: String,
  userAgent: String,
  at: { type: Date, default: Date.now },
});

activityLogSchema.index({ at: -1 });
activityLogSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model('ActivityLog', activityLogSchema);
