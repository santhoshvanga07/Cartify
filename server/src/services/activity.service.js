import ActivityLog from '../models/ActivityLog.js';

/**
 * Records one audit entry. Fire-and-forget: a logging failure is reported to
 * the console but never fails the action that was being logged.
 *
 * @param req     the request - supplies the actor, IP and user agent
 * @param action  e.g. 'order.status', 'auth.login_failed'
 * @param target  { type, id, label } - what was acted on
 * @param details free text, e.g. 'placed -> confirmed'
 * @param actor   override when req.user is not set yet (e.g. at login)
 */
export const logActivity = (req, action, target = {}, details = '', actor = req.user) => {
  ActivityLog.create({
    actor: actor?._id,
    actorName: actor?.name,
    actorRole: actor?.role,
    action,
    target: { type: target.type, id: target.id ? String(target.id) : undefined, label: target.label },
    details: String(details).slice(0, 500),
    // req.ip honours X-Forwarded-For only when 'trust proxy' is set, which
    // stops a client from simply claiming any address it likes.
    ip: req.ip,
    userAgent: String(req.get?.('user-agent') || '').slice(0, 200),
  }).catch((err) => console.error(`Activity log failed (${action}): ${err.message}`));
};
