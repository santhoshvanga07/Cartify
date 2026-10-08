import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api/axios';

const when = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const Badge = ({ children }) => (
  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">{children}</span>
);

const AnswerForm = ({ questionId, onDone }) => {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/questions/${questionId}/answers`, { text });
      setText('');
      toast.success('Answer posted');
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not post your answer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 flex gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        required
        placeholder="Write an answer"
        aria-label="Your answer"
        className="field"
      />
      <button type="submit" disabled={saving || !text.trim()} className="btn btn-primary shrink-0">
        {saving ? '…' : 'Answer'}
      </button>
    </form>
  );
};

/** Community Q&A for one product. */
const Questions = ({ slug }) => {
  const user = useSelector((state) => state.auth.user);
  const [questions, setQuestions] = useState(null);
  const [text, setText] = useState('');
  const [asking, setAsking] = useState(false);
  const [answeringId, setAnsweringId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/products/${slug}/questions`);
      setQuestions(data.questions);
    } catch {
      /* the product page works fine without Q&A */
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const ask = async (e) => {
    e.preventDefault();
    setAsking(true);
    try {
      await api.post(`/products/${slug}/questions`, { text });
      setText('');
      toast.success('Question posted - shoppers and our team can now answer it');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not post your question');
    } finally {
      setAsking(false);
    }
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

  if (!questions) return null;

  const visible = showAll ? questions : questions.slice(0, 5);
  const isStaff = user && user.role !== 'customer';

  return (
    <section className="mt-20 border-t border-line pt-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display text-2xl text-ink">Questions &amp; answers</h2>
        <p className="text-xs text-muted">
          {questions.length} {questions.length === 1 ? 'question' : 'questions'}
        </p>
      </div>

      {user ? (
        <form onSubmit={ask} className="mt-6 flex max-w-xl gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            minLength={5}
            maxLength={300}
            required
            placeholder="Ask about size, compatibility, what's in the box…"
            aria-label="Your question"
            className="field"
          />
          <button type="submit" disabled={asking || text.trim().length < 5} className="btn btn-primary shrink-0">
            {asking ? 'Posting…' : 'Ask'}
          </button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-body">
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>{' '}
          to ask or answer a question.
        </p>
      )}

      {questions.length === 0 && <p className="mt-6 text-sm text-body">No questions yet. Ask the first one.</p>}

      <div className="mt-8 space-y-7">
        {visible.map((q) => (
          <article key={q._id} className="border-b border-line pb-7 last:border-0">
            <div className="flex gap-4">
              {/* Upvote */}
              <button
                onClick={() => user && !q.isMine && act(() => api.post(`/questions/${q._id}/upvote`))}
                disabled={!user || q.isMine}
                aria-label={q.upvotedByMe ? 'Remove upvote' : 'Upvote question'}
                aria-pressed={q.upvotedByMe}
                title={!user ? 'Sign in to vote' : q.isMine ? 'Your question' : 'This question helps me too'}
                className={`flex h-12 w-10 shrink-0 flex-col items-center justify-center rounded-lg text-xs ${
                  q.upvotedByMe ? 'bg-accent-soft text-accent' : 'bg-surface text-body'
                } ${user && !q.isMine ? 'hover:text-ink' : 'cursor-default'}`}
              >
                <span aria-hidden="true">▲</span>
                {q.upvoteCount}
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">Q: {q.text}</p>
                <p className="mt-1 text-xs text-muted">
                  {q.user.name} · {when(q.createdAt)}
                </p>

                <div className="mt-3 space-y-3">
                  {q.answers.map((a) => (
                    <div key={a._id} className="rounded-lg bg-surface px-4 py-3">
                      <p className="text-sm leading-relaxed text-body">
                        <span className="text-ink">A:</span> {a.text}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                        <span className="text-muted">
                          {a.user.name} · {when(a.createdAt)}
                        </span>
                        {a.isStaff && <Badge>Cartify team</Badge>}
                        {a.isVerifiedBuyer && <Badge>Verified buyer</Badge>}
                        {user && !a.isMine && (
                          <button
                            onClick={() => act(() => api.post(`/questions/${q._id}/answers/${a._id}/helpful`))}
                            className={a.helpfulByMe ? 'text-accent' : 'text-body hover:text-ink'}
                          >
                            {a.helpfulByMe ? 'Marked helpful' : 'Helpful'}
                            {a.helpfulCount > 0 && ` (${a.helpfulCount})`}
                          </button>
                        )}
                        {!user && a.helpfulCount > 0 && (
                          <span className="text-muted">{a.helpfulCount} found this helpful</span>
                        )}
                        {user && (a.isMine || isStaff) && (
                          <button
                            onClick={() =>
                              act(() => api.delete(`/questions/${q._id}/answers/${a._id}`), 'Answer deleted')
                            }
                            className="text-muted hover:text-red-600"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {user && (
                  <div className="mt-3 flex flex-wrap gap-4 text-xs">
                    <button
                      onClick={() => setAnsweringId(answeringId === q._id ? null : q._id)}
                      className="text-accent hover:underline"
                    >
                      {answeringId === q._id ? 'Cancel' : q.answers.length ? 'Add an answer' : 'Answer this'}
                    </button>
                    {!q.isMine && (
                      <button
                        onClick={() =>
                          act(
                            () => api.post(`/questions/${q._id}/report`, { reason: 'Reported by user' }),
                            'Reported - our team will take a look'
                          )
                        }
                        className="text-muted hover:text-red-600"
                      >
                        Report
                      </button>
                    )}
                    {(q.isMine || isStaff) && (
                      <button
                        onClick={() => act(() => api.delete(`/questions/${q._id}`), 'Question deleted')}
                        className="text-muted hover:text-red-600"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}

                {answeringId === q._id && (
                  <AnswerForm
                    questionId={q._id}
                    onDone={() => {
                      setAnsweringId(null);
                      load();
                    }}
                  />
                )}
              </div>
            </div>
          </article>
        ))}
      </div>

      {questions.length > 5 && (
        <button onClick={() => setShowAll((v) => !v)} className="btn btn-ghost mt-6">
          {showAll ? 'Show fewer' : `Show all ${questions.length} questions`}
        </button>
      )}
    </section>
  );
};

export default Questions;
