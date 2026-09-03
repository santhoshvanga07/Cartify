const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

export const isAiConfigured = () => Boolean(process.env.GROQ_API_KEY);

/**
 * One call to the LLM, forced to return JSON.
 *
 * Everything about talking to Groq lives here so the controllers stay readable
 * and there is exactly one place to change the model, timeout or error handling.
 */
export const chatJSON = async ({ system, user, maxTokens = 500, temperature = 0 }) => {
  if (!isAiConfigured()) {
    const err = new Error('AI is not configured on this server');
    err.statusCode = 503;
    throw err;
  }

  let response;
  try {
    response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        // Ask the API itself to guarantee valid JSON. Far more reliable than
        // begging the model in the prompt and then regex-ing the reply.
        response_format: { type: 'json_object' },
        temperature, // 0 = deterministic. We want a parser, not a poet.
        max_tokens: maxTokens,
      }),
      // Without a timeout a hung upstream call would hold the request open
      // until the browser gave up, with no useful error.
      signal: AbortSignal.timeout(25000),
    });
  } catch (e) {
    const err = new Error(
      e.name === 'TimeoutError' ? 'The AI service took too long to respond' : 'Could not reach the AI service'
    );
    err.statusCode = 504;
    throw err;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(payload.error?.message || 'The AI service returned an error');
    err.statusCode = response.status === 429 ? 429 : 502;
    throw err;
  }

  const text = payload.choices?.[0]?.message?.content ?? '';

  try {
    return { data: JSON.parse(text), usage: payload.usage };
  } catch {
    // JSON mode makes this rare, but "rare" is not "never" - and an
    // unhandled parse error here would be a 500 on a user-facing feature.
    const err = new Error('The AI returned a response we could not read');
    err.statusCode = 502;
    throw err;
  }
};

/**
 * Scrubs whatever the model returned into a filter object we are willing to
 * run against the database.
 *
 * THIS IS THE SECURITY BOUNDARY. The model's output is untrusted input, exactly
 * like a request body. We copy across only keys we recognise, coerce the types
 * ourselves, and clamp the ranges - so a hallucinated or hostile response can
 * do nothing worse than return no products.
 */
export const sanitizeFilters = (raw, { validCategorySlugs = [], validSorts = [] } = {}) => {
  const clean = {};
  if (!raw || typeof raw !== 'object') return clean;

  if (typeof raw.q === 'string' && raw.q.trim()) {
    clean.q = raw.q.trim().slice(0, 60); // cap length: this becomes a regex
  }

  // The model may invent a category. Only real slugs survive.
  if (typeof raw.category === 'string' && validCategorySlugs.includes(raw.category)) {
    clean.category = raw.category;
  }

  for (const key of ['minPrice', 'maxPrice']) {
    const n = Number(raw[key]);
    if (Number.isFinite(n) && n >= 0 && n <= 100_000_000) clean[key] = Math.round(n);
  }
  // "between 5000 and 2000" - accept it, but put it the right way round.
  if (clean.minPrice != null && clean.maxPrice != null && clean.minPrice > clean.maxPrice) {
    [clean.minPrice, clean.maxPrice] = [clean.maxPrice, clean.minPrice];
  }

  const rating = Number(raw.minRating);
  if (Number.isFinite(rating) && rating > 0 && rating <= 5) clean.minRating = rating;

  if (typeof raw.sort === 'string' && validSorts.includes(raw.sort)) clean.sort = raw.sort;

  if (raw.inStockOnly === true) clean.inStockOnly = true;

  return clean;
};
