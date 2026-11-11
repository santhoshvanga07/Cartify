import Question from '../models/Question.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { logActivity } from '../services/activity.service.js';

const isStaff = (user) => ['admin', 'superadmin'].includes(user?.role);
const has = (ids, user) => Boolean(user) && ids.some((id) => id.equals(user._id));

/** Shapes a question for the public: counts instead of voter lists, no reporter ids. */
const present = (q, me) => ({
  _id: q._id,
  text: q.text,
  user: { _id: q.user?._id, name: q.user?.name },
  createdAt: q.createdAt,
  upvoteCount: q.upvotes.length,
  upvotedByMe: has(q.upvotes, me),
  isMine: Boolean(me) && q.user?._id?.equals(me._id),
  answers: q.answers
    .map((a) => ({
      _id: a._id,
      text: a.text,
      user: { _id: a.user?._id, name: a.user?.name },
      isStaff: a.isStaff,
      isVerifiedBuyer: a.isVerifiedBuyer,
      createdAt: a.createdAt,
      helpfulCount: a.helpfulVotes.length,
      helpfulByMe: has(a.helpfulVotes, me),
      isMine: Boolean(me) && a.user?._id?.equals(me._id),
    }))
    // Most helpful first; staff answers win ties because they are authoritative.
    .sort((x, y) => y.helpfulCount - x.helpfulCount || y.isStaff - x.isStaff),
});

const loadQuestion = async (req, res) => {
  const q = await Question.findById(req.params.id);
  if (!q || q.isHidden) {
    res.status(404).json({ success: false, message: 'Question not found' });
    return null;
  }
  return q;
};

const populated = (q) => q.populate([{ path: 'user', select: 'name' }, { path: 'answers.user', select: 'name' }]);

/**
 * @route GET /api/products/:slug/questions
 * @access Public (optionalAuth)
 */
export const listQuestions = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug });
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const questions = await Question.find({ product: product._id, isHidden: false })
    .populate('user', 'name')
    .populate('answers.user', 'name')
    .sort({ createdAt: -1 });

  const shaped = questions
    .map((q) => present(q, req.user))
    .sort((a, b) => b.upvoteCount - a.upvoteCount); // stable: newest first among equals

  res.status(200).json({ success: true, count: shaped.length, questions: shaped });
};

/**
 * @route POST /api/products/:slug/questions   body: { text }
 * @access Private
 */
export const askQuestion = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true });
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const q = await Question.create({ product: product._id, user: req.user.id, text: req.body.text });
  await populated(q);
  res.status(201).json({ success: true, question: present(q, req.user) });
};

/**
 * @route POST /api/questions/:id/answers   body: { text }
 * @access Private
 */
export const answerQuestion = async (req, res) => {
  const q = await loadQuestion(req, res);
  if (!q) return;

  // One person cannot fill a question's 50 answer slots and lock everyone else out.
  const mine = q.answers.filter((a) => a.user.equals(req.user._id)).length;
  if (mine >= 3) {
    return res.status(409).json({ success: false, message: 'You have already answered this question 3 times' });
  }

  const isVerifiedBuyer = Boolean(
    await Order.exists({ user: req.user.id, status: 'delivered', 'items.product': q.product })
  );

  q.answers.push({ user: req.user.id, text: req.body.text, isStaff: isStaff(req.user), isVerifiedBuyer });
  await q.save();
  await populated(q);
  res.status(201).json({ success: true, question: present(q, req.user) });
};

/** Adds or removes the user's id from a vote array. Returns true when now voted. */
const toggle = (ids, userId) => {
  const i = ids.findIndex((id) => id.equals(userId));
  if (i === -1) ids.push(userId);
  else ids.splice(i, 1);
  return i === -1;
};

/** @route POST /api/questions/:id/upvote  @access Private */
export const upvoteQuestion = async (req, res) => {
  const q = await loadQuestion(req, res);
  if (!q) return;
  if (q.user.equals(req.user._id)) {
    return res.status(400).json({ success: false, message: 'You cannot upvote your own question' });
  }
  const upvoted = toggle(q.upvotes, req.user._id);
  await q.save();
  res.status(200).json({ success: true, upvoteCount: q.upvotes.length, upvotedByMe: upvoted });
};

/** @route POST /api/questions/:id/answers/:answerId/helpful  @access Private */
export const markAnswerHelpful = async (req, res) => {
  const q = await loadQuestion(req, res);
  if (!q) return;
  const answer = q.answers.id(req.params.answerId);
  if (!answer) return res.status(404).json({ success: false, message: 'Answer not found' });
  if (answer.user.equals(req.user._id)) {
    return res.status(400).json({ success: false, message: 'You cannot vote on your own answer' });
  }
  const voted = toggle(answer.helpfulVotes, req.user._id);
  await q.save();
  res.status(200).json({ success: true, helpfulCount: answer.helpfulVotes.length, helpfulByMe: voted });
};

/** @route POST /api/questions/:id/report  body: { reason }  @access Private */
export const reportQuestion = async (req, res) => {
  const q = await loadQuestion(req, res);
  if (!q) return;
  if (q.reports.some((r) => r.user?.equals(req.user._id))) {
    return res.status(409).json({ success: false, message: 'You have already reported this question' });
  }
  q.reports.push({ user: req.user.id, reason: String(req.body.reason || '').slice(0, 200) });
  // Same rule as reviews: three independent reports hide it until a human looks.
  if (q.reports.length >= 3) q.isHidden = true;
  await q.save();
  res.status(200).json({ success: true, message: 'Thank you - our team will take a look' });
};

/** @route DELETE /api/questions/:id  @access Author or staff */
export const deleteQuestion = async (req, res) => {
  const q = await Question.findById(req.params.id);
  if (!q) return res.status(404).json({ success: false, message: 'Question not found' });
  if (!q.user.equals(req.user._id) && !isStaff(req.user)) {
    return res.status(403).json({ success: false, message: 'Not your question' });
  }
  // A question hidden by reports is kept for moderators to review; its author
  // cannot quietly delete the evidence.
  if (q.isHidden && !isStaff(req.user)) {
    return res.status(409).json({ success: false, message: 'This question is under review and cannot be deleted' });
  }
  await q.deleteOne();
  if (!q.user.equals(req.user._id)) logActivity(req, 'question.delete', { type: 'question', id: q._id, label: q.text.slice(0, 60) });
  res.status(200).json({ success: true, message: 'Question deleted' });
};

/** @route DELETE /api/questions/:id/answers/:answerId  @access Author or staff */
export const deleteAnswer = async (req, res) => {
  const q = await Question.findById(req.params.id);
  const answer = q?.answers.id(req.params.answerId);
  if (!answer) return res.status(404).json({ success: false, message: 'Answer not found' });
  if (!answer.user.equals(req.user._id) && !isStaff(req.user)) {
    return res.status(403).json({ success: false, message: 'Not your answer' });
  }
  answer.deleteOne();
  await q.save();
  res.status(200).json({ success: true, message: 'Answer deleted' });
};

/** @route GET /api/questions/reported  @access Admin - the moderation queue */
export const listReportedQuestions = async (req, res) => {
  const questions = await Question.find({ $or: [{ 'reports.0': { $exists: true } }, { isHidden: true }] })
    .populate('user', 'name email')
    .populate('product', 'name slug')
    .sort({ updatedAt: -1 });
  res.status(200).json({ success: true, count: questions.length, questions });
};

/** @route PATCH /api/questions/:id/visibility  body: { isHidden }  @access Admin */
export const setVisibility = async (req, res) => {
  const q = await Question.findById(req.params.id);
  if (!q) return res.status(404).json({ success: false, message: 'Question not found' });
  q.isHidden = Boolean(req.body.isHidden);
  if (!q.isHidden) q.reports = []; // a human has judged it
  await q.save();
  logActivity(req, q.isHidden ? 'question.hide' : 'question.restore', { type: 'question', id: q._id, label: q.text.slice(0, 60) });
  res.status(200).json({ success: true, message: q.isHidden ? 'Question hidden' : 'Question restored', question: q });
};
