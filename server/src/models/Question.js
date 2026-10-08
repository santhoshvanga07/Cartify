import mongoose from 'mongoose';

/**
 * Community Q&A on a product page.
 *
 * Answers are EMBEDDED in their question: they are always read together, a
 * question rarely gathers more than a handful, and deleting a question should
 * take its answers with it. Votes are arrays of user ids for the same reason
 * reviews use them - "one vote per person" becomes a property of the data.
 */
const answerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: [true, 'Answer cannot be empty'], trim: true, maxlength: 1000 },
    // Set from the server's own records, never from the request.
    isStaff: { type: Boolean, default: false },
    isVerifiedBuyer: { type: Boolean, default: false },
    helpfulVotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

const questionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: {
      type: String,
      required: [true, 'Question cannot be empty'],
      trim: true,
      minlength: [5, 'Question is too short'],
      maxlength: [300, 'Keep questions under 300 characters'],
    },
    answers: { type: [answerSchema], validate: [(a) => a.length <= 50, 'Too many answers'] },
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reports: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, maxlength: 200 },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    // Hidden rather than deleted, like reviews: moderation keeps an audit trail.
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Question', questionSchema);
