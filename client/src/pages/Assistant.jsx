import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import ProductCard from '../components/ProductCard';
import VoiceButton, { voiceSupported } from '../components/VoiceButton';
import { aiSearch, resetChat } from '../features/ai/aiSlice';

const EXAMPLES = [
  'Show me laptops under ₹60,000',
  'Waterproof trekking shoes',
  'Noise cancelling headphones, budget around 10k',
  'Best rated phone under 1 lakh',
];

/** Renders the filter object the AI produced, so nothing feels like magic. */
const Interpretation = ({ filters }) => {
  const entries = Object.entries(filters || {});
  if (entries.length === 0) return null;

  const label = { q: 'keyword', category: 'category', minPrice: 'from', maxPrice: 'up to',
                  minRating: 'rating', sort: 'sorted by', inStockOnly: 'in stock' };

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <span key={k} className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] text-accent">
          {label[k] || k}: {String(v)}
        </span>
      ))}
    </div>
  );
};

const Assistant = () => {
  const [input, setInput] = useState('');
  const dispatch = useDispatch();
  const { turns, loading } = useSelector((state) => state.ai);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, loading]);

  const send = (text) => {
    const query = (text ?? input).trim();
    if (!query || loading) return;
    setInput('');
    dispatch(aiSearch(query));
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-4xl text-ink">Shopping assistant</h1>
          <p className="mt-2 text-sm text-body">
            Describe what you need. I read your words, turn them into a search, and show you
            what we actually stock.
          </p>
        </div>
        {turns.length > 0 && (
          <button onClick={() => dispatch(resetChat())} className="text-xs text-muted hover:text-ink">
            Clear
          </button>
        )}
      </div>

      {/* Empty state: give people something to click */}
      {turns.length === 0 && (
        <div className="mt-10">
          <p className="text-xs uppercase tracking-widest text-muted">Try one</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => send(e)}
                className="rounded-full bg-surface px-4 py-2 text-sm text-body transition-colors hover:text-accent"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Transcript */}
      <div className="mt-10 space-y-8">
        {turns.map((turn, i) =>
          turn.role === 'user' ? (
            <p key={i} className="text-right">
              <span className="inline-block rounded-2xl bg-ink px-4 py-2 text-sm text-white">
                {turn.text}
              </span>
            </p>
          ) : (
            <div key={i}>
              <p className={`text-sm ${turn.failed ? 'text-red-600' : 'text-body'}`}>{turn.text}</p>

              {!turn.failed && <Interpretation filters={turn.interpretation} />}

              {turn.widened && (
                <p className="mt-2 text-xs text-muted">
                  Nothing matched "{turn.droppedKeyword}" exactly, so I widened the search.
                </p>
              )}
              {turn.degraded && (
                <p className="mt-2 text-xs text-muted">
                  The assistant was unavailable, so this is a plain keyword search.
                </p>
              )}

              {turn.products?.length > 0 ? (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3">
                    {turn.products.slice(0, 6).map((p) => (
                      <ProductCard key={p._id} product={p} />
                    ))}
                  </div>
                  {turn.total > 6 && (
                    <p className="mt-4 text-xs text-muted">
                      Showing 6 of {turn.total} matches.
                    </p>
                  )}
                </>
              ) : (
                !turn.failed && (
                  <p className="mt-3 text-sm text-muted">
                    Nothing in stock matches that. Try a wider budget or a different category.
                  </p>
                )
              )}
            </div>
          )
        )}

        {loading && <p className="text-sm text-muted">Thinking…</p>}
        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-6 mt-10 flex gap-2 rounded-xl bg-surface p-2 shadow-lg"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={voiceSupported ? 'Type or tap the mic and speak' : 'What are you looking for?'}
          maxLength={300}
          aria-label="Ask the shopping assistant"
          className="flex-1 bg-transparent px-3 py-2 text-sm text-ink outline-none placeholder:text-muted"
        />
        {/* Show the words as they are heard, then send once the shopper stops talking. */}
        <VoiceButton onPartial={setInput} onResult={(text) => send(text)} className="w-10" />
        <button type="submit" disabled={loading || !input.trim()} className="btn btn-primary">
          Ask
        </button>
      </form>
    </div>
  );
};

export default Assistant;
