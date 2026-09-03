import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';

const Stars = ({ value, onChange, size = 'text-base' }) => (
  <span className={`inline-flex gap-0.5 ${size}`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button
        key={n}
        type="button"
        disabled={!onChange}
        onClick={() => onChange?.(n)}
        aria-label={`${n} star${n > 1 ? 's' : ''}`}
        className={`${onChange ? 'cursor-pointer' : 'cursor-default'} ${
          n <= value ? 'text-accent' : 'text-line'
        }`}
      >
        ★
      </button>
    ))}
  </span>
);

const Reviews = ({ slug }) => {
  const user = useSelector((state) => state.auth.user);
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ rating: 0, title: '', comment: '' });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/products/${slug}/reviews`);
      setData(data);
    } catch {
      /* an empty review section is not worth an error banner */
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const myReview = data?.reviews.find((r) => r.isMine);

  const submit = async (e) => {
    e.preventDefault();
    if (form.rating === 0) return toast.error('Pick a star rating');

    setSaving(true);
    try {
      if (editingId) await api.put(`/reviews/${editingId}`, form);
      else await api.post(`/products/${slug}/reviews`, form);
      toast.success(editingId ? 'Review updated' : 'Thanks for your review');
      setForm({ rating: 0, title: '', comment: '' });
      setEditingId(null);
      setShowForm(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save your review');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (r) => {
    setEditingId(r._id);
    setForm({ rating: r.rating, title: r.title || '', comment: r.comment });
    setShowForm(true);
  };

  const act = async (fn, successMessage) => {
    try {
      await fn();
      if (successMessage) toast.success(successMessage);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  if (!data) return null;

  const total = data.count || 1;

  return (
    <section className="mt-20 border-t border-line pt-10">
      <h2 className="display text-2xl text-ink">Reviews</h2>

      {data.count === 0 ? (
        <p className="mt-3 text-sm text-body">No reviews yet. Be the first.</p>
      ) : (
        <div className="mt-6 flex flex-wrap items-start gap-12">
          <div>
            <p className="display text-5xl text-ink">{data.ratingAvg.toFixed(1)}</p>
            <Stars value={Math.round(data.ratingAvg)} />
            <p className="mt-1 text-xs text-muted">{data.count} reviews</p>
          </div>

          {/* Distribution bars */}
          <div className="min-w-52 flex-1 space-y-1.5">
            {data.breakdown.map(({ star, count }) => (
              <div key={star} className="flex items-center gap-3 text-xs">
                <span className="w-3 text-muted">{star}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-page">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${(count / total) * 100}%` }}
                  />
                </span>
                <span className="w-6 text-right text-muted">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write / edit */}
      <div className="mt-8">
        {!user ? (
          <p className="text-sm text-body">
            <Link to="/login" className="text-accent hover:underline">Sign in</Link> to write a review.
          </p>
        ) : myReview && !editingId ? (
          <p className="text-sm text-body">You have already reviewed this product.</p>
        ) : (
          <button
            onClick={() => setShowForm((v) => !v)}
            className={`btn ${showForm ? 'btn-ghost' : 'btn-primary'}`}
          >
            {showForm ? 'Cancel' : 'Write a review'}
          </button>
        )}
      </div>

      {showForm && user && (
        <form onSubmit={submit} className="card mt-5 max-w-xl">
          <label className="label">Your rating</label>
          <Stars
            value={form.rating}
            onChange={(rating) => setForm({ ...form, rating })}
            size="text-2xl"
          />

          <div className="mt-4">
            <label className="label">Title (optional)</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              maxLength={100}
              className="field"
            />
          </div>

          <div className="mt-4">
            <label className="label">Your review</label>
            <textarea
              value={form.comment}
              onChange={(e) => setForm({ ...form, comment: e.target.value })}
              required
              rows={4}
              maxLength={2000}
              className="field"
              placeholder="What did you like or dislike?"
            />
          </div>

          <button type="submit" disabled={saving} className="btn btn-primary mt-5">
            {saving ? 'Posting…' : editingId ? 'Update review' : 'Post review'}
          </button>
        </form>
      )}

      {/* List */}
      <div className="mt-10 space-y-8">
        {data.reviews.map((r) => (
          <article key={r._id} className="border-b border-line pb-8 last:border-0">
            <div className="flex flex-wrap items-center gap-3">
              <Stars value={r.rating} size="text-sm" />
              {r.title && <h3 className="text-sm font-medium text-ink">{r.title}</h3>}
              {r.isVerifiedPurchase && (
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">
                  Verified purchase
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-muted">
              {r.user?.name} ·{' '}
              {new Date(r.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>

            <p className="mt-3 text-sm leading-relaxed text-body">{r.comment}</p>

            <div className="mt-4 flex flex-wrap gap-4 text-xs">
              {user && !r.isMine && (
                <>
                  <button
                    onClick={() => act(() => api.post(`/reviews/${r._id}/helpful`))}
                    className={r.votedByMe ? 'text-accent' : 'text-body hover:text-ink'}
                  >
                    {r.votedByMe ? 'Marked helpful' : 'Helpful'}
                    {r.helpfulCount > 0 && ` (${r.helpfulCount})`}
                  </button>
                  <button
                    onClick={() =>
                      act(
                        () => api.post(`/reviews/${r._id}/report`, { reason: 'Reported by user' }),
                        'Reported - our team will take a look'
                      )
                    }
                    className="text-muted hover:text-red-600"
                  >
                    Report
                  </button>
                </>
              )}

              {r.isMine && (
                <>
                  <button onClick={() => startEdit(r)} className="text-body hover:text-ink">
                    Edit
                  </button>
                  <button
                    onClick={() => act(() => api.delete(`/reviews/${r._id}`), 'Review deleted')}
                    className="text-muted hover:text-red-600"
                  >
                    Delete
                  </button>
                </>
              )}

              {!user && r.helpfulCount > 0 && (
                <span className="text-muted">{r.helpfulCount} found this helpful</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Reviews;
