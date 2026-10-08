import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../../api/axios';

const when = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

const Reports = ({ reports }) => (
  <p className="mt-2 text-xs text-muted">
    {reports.length} {reports.length === 1 ? 'report' : 'reports'}
    {reports.some((r) => r.reason) &&
      ` · ${[...new Set(reports.map((r) => r.reason).filter(Boolean))].slice(0, 3).join(', ')}`}
  </p>
);

/**
 * One queue for everything shoppers have flagged: reviews and Q&A questions.
 * Three reports hide an item automatically; a human then restores or keeps it hidden.
 */
const AdminModeration = () => {
  const [reviews, setReviews] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [r, q] = await Promise.all([api.get('/reviews/reported'), api.get('/questions/reported')]);
      setReviews(r.data.reviews);
      setQuestions(q.data.questions);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load the queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (fn, message) => {
    try {
      await fn();
      toast.success(message);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update');
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-sm font-medium text-ink">Reported reviews ({reviews.length})</h2>
        {reviews.length === 0 && <p className="mt-3 text-sm text-muted">Nothing flagged. All clear.</p>}
        <div className="mt-4 space-y-3">
          {reviews.map((r) => (
            <div key={r._id} className="card !p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/products/${r.product?.slug}`} className="text-xs text-accent hover:underline">
                    {r.product?.name}
                  </Link>
                  <p className="mt-1 text-sm text-ink">
                    {'★'.repeat(r.rating)}
                    <span className="text-line">{'★'.repeat(5 - r.rating)}</span>
                    {r.title && <span className="ml-2 font-medium">{r.title}</span>}
                  </p>
                  <p className="mt-1 text-sm text-body">{r.comment}</p>
                  <p className="mt-1 text-xs text-muted">
                    {r.user?.name} ({r.user?.email}) · {when(r.createdAt)}
                  </p>
                  <Reports reports={r.reports} />
                </div>
                <span className={`text-xs ${r.isApproved ? 'text-body' : 'text-red-600'}`}>
                  {r.isApproved ? 'Visible' : 'Hidden'}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => act(() => api.patch(`/reviews/${r._id}/approve`, { isApproved: true }), 'Review restored')}
                  className="btn btn-primary !px-3 !py-1.5 !text-xs"
                >
                  Keep &amp; clear reports
                </button>
                {r.isApproved && (
                  <button
                    onClick={() => act(() => api.patch(`/reviews/${r._id}/approve`, { isApproved: false }), 'Review hidden')}
                    className="btn btn-ghost !px-3 !py-1.5 !text-xs"
                  >
                    Hide
                  </button>
                )}
                <button
                  onClick={() => act(() => api.delete(`/reviews/${r._id}`), 'Review deleted')}
                  className="btn btn-ghost !px-3 !py-1.5 !text-xs text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-ink">Reported questions ({questions.length})</h2>
        {questions.length === 0 && <p className="mt-3 text-sm text-muted">Nothing flagged. All clear.</p>}
        <div className="mt-4 space-y-3">
          {questions.map((q) => (
            <div key={q._id} className="card !p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/products/${q.product?.slug}`} className="text-xs text-accent hover:underline">
                    {q.product?.name}
                  </Link>
                  <p className="mt-1 text-sm text-ink">Q: {q.text}</p>
                  <p className="mt-1 text-xs text-muted">
                    {q.user?.name} ({q.user?.email}) · {when(q.createdAt)} · {q.answers.length} answers
                  </p>
                  <Reports reports={q.reports} />
                </div>
                <span className={`text-xs ${q.isHidden ? 'text-red-600' : 'text-body'}`}>
                  {q.isHidden ? 'Hidden' : 'Visible'}
                </span>
              </div>
              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => act(() => api.patch(`/questions/${q._id}/visibility`, { isHidden: false }), 'Question restored')}
                  className="btn btn-primary !px-3 !py-1.5 !text-xs"
                >
                  Keep &amp; clear reports
                </button>
                {!q.isHidden && (
                  <button
                    onClick={() => act(() => api.patch(`/questions/${q._id}/visibility`, { isHidden: true }), 'Question hidden')}
                    className="btn btn-ghost !px-3 !py-1.5 !text-xs"
                  >
                    Hide
                  </button>
                )}
                <button
                  onClick={() => act(() => api.delete(`/questions/${q._id}`), 'Question deleted')}
                  className="btn btn-ghost !px-3 !py-1.5 !text-xs text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AdminModeration;
