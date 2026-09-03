import Product from '../models/Product.js';
import Category from '../models/Category.js';
import { chatJSON, sanitizeFilters, isAiConfigured } from '../services/ai.service.js';
import { runProductQuery, VALID_SORTS } from '../services/productQuery.service.js';

/** @route GET /api/ai/status  @access Public */
export const aiStatus = (req, res) => {
  res.status(200).json({
    success: true,
    enabled: isAiConfigured(),
    model: isAiConfigured() ? process.env.GROQ_MODEL : null,
  });
};

const searchSystemPrompt = (categories) => `
You convert an online shopper's request into a product search filter.

Available categories (use the slug exactly, or omit): ${categories.map((c) => c.slug).join(', ')}
Valid sort values: ${VALID_SORTS.join(', ')}

Reply with ONLY a JSON object using these optional keys:
  q          string  - brand or keyword, if one is named
  category   string  - one of the slugs above
  minPrice   number  - rupees, plain digits
  maxPrice   number  - rupees, plain digits
  minRating  number  - 1 to 5
  sort       string  - one of the sort values above
  inStockOnly boolean
  reply      string  - one friendly sentence for the shopper

Rules:
- Prices are Indian rupees. "60k" means 60000. "under 1 lakh" means maxPrice 100000.
- NEVER invent product names, models or prices. You only produce filters.
- Omit any key you cannot confidently infer. Do not guess.
- "cheap" or "budget" implies sort price-asc, not a specific price.
- Use "q" ONLY for a brand name or a distinctive feature word. NEVER put the
  category or a generic product word in it. If you set category, do not also
  put "phone", "laptop", "shoes", "headphones" or similar in q - that is
  already covered by the category and it will wrongly narrow the results.
  Good: category "smartphones" with no q.  Bad: category "smartphones", q "phone".
`.trim();

/**
 * @route POST /api/ai/search   body: { query }
 * @access Public
 *
 * The heart of the AI layer:
 *   plain English -> LLM -> filter JSON -> sanitise -> the SAME MongoDB query
 *   the filter sidebar uses -> real products at real prices.
 *
 * The model never sees the catalogue and never names a product, so it cannot
 * hallucinate stock we do not carry.
 */
export const aiSearch = async (req, res) => {
  const query = String(req.body.query || '').trim();

  if (!query) return res.status(400).json({ success: false, message: 'Tell me what you are looking for' });
  if (query.length > 300) {
    return res.status(400).json({ success: false, message: 'That request is too long' });
  }

  const categories = await Category.find({ isActive: true }).select('name slug');

  let data = {};
  let usage;
  let degraded = false;

  try {
    ({ data, usage } = await chatJSON({
      system: searchSystemPrompt(categories),
      user: query,
      maxTokens: 300,
    }));
  } catch (err) {
    /**
     * GRACEFUL DEGRADATION.
     * The AI can fail for reasons that are not the user's fault: rate limits,
     * a timeout, or a refusal (a prompt-injection attempt makes the model
     * decline to emit JSON). Returning 502 would turn a working search box
     * into a dead one. Instead we fall back to a plain keyword search, which
     * is exactly what a shopper typing in the normal search box would get.
     */
    degraded = true;
    data = { q: query };
  }

  // Untrusted output in, safe filter out.
  const filters = sanitizeFilters(data, {
    validCategorySlugs: categories.map((c) => c.slug),
    validSorts: VALID_SORTS,
  });

  const result = await runProductQuery({ ...filters, limit: 12 });

  res.status(200).json({
    success: true,
    query,
    // Returned so the UI can show what the AI understood - the user can see
    // it was interpreted, not guessed at, and can correct it by hand.
    interpretation: filters,
    degraded, // the UI can quietly say "showing keyword results"
    reply: degraded
      ? `Showing keyword results for "${query}".`
      : typeof data.reply === 'string' && data.reply.length < 300
      ? data.reply
      : `Here is what I found for "${query}".`,
    tokensUsed: usage?.total_tokens,
    ...result,
  });
};

const comparePrompt = `
You compare two products a shopper is choosing between.

You will be given the real specifications of both. Base every statement on that
data only - never introduce a spec, price or feature you were not given.

Reply with ONLY a JSON object shaped like:
{
  "summary": "one or two sentences comparing them",
  "productA": { "pros": ["..."], "cons": ["..."] },
  "productB": { "pros": ["..."], "cons": ["..."] },
  "bestValue": "A" | "B",
  "recommendation": "one sentence saying who should pick which"
}
Give two to four short pros and cons each.
`.trim();

/**
 * @route POST /api/ai/compare   body: { slugA, slugB }
 * @access Public
 */
export const aiCompare = async (req, res) => {
  const { slugA, slugB } = req.body;

  if (!slugA || !slugB || slugA === slugB) {
    return res.status(400).json({ success: false, message: 'Pick two different products' });
  }

  const [a, b] = await Promise.all([
    Product.findOne({ slug: slugA, isActive: true }).populate('category', 'name'),
    Product.findOne({ slug: slugB, isActive: true }).populate('category', 'name'),
  ]);

  if (!a || !b) return res.status(404).json({ success: false, message: 'Product not found' });

  // Send facts we hold, nothing more.
  const describe = (p, label) =>
    `Product ${label}: ${p.name} by ${p.brand}. Category ${p.category?.name}. ` +
    `Price Rs ${p.price} (MRP Rs ${p.mrp}). Rating ${p.ratingAvg}/5 from ${p.numReviews} reviews. ` +
    `In stock: ${p.stock > 0 ? 'yes' : 'no'}. ` +
    `Specifications: ${Object.entries(Object.fromEntries(p.attributes || []))
      .map(([k, v]) => `${k} = ${v}`)
      .join('; ')}.`;

  const { data, usage } = await chatJSON({
    system: comparePrompt,
    user: `${describe(a, 'A')}\n\n${describe(b, 'B')}`,
    maxTokens: 800,
  });

  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 4) : []);

  res.status(200).json({
    success: true,
    products: { A: a, B: b },
    comparison: {
      summary: String(data.summary || '').slice(0, 600),
      productA: { pros: list(data.productA?.pros), cons: list(data.productA?.cons) },
      productB: { pros: list(data.productB?.pros), cons: list(data.productB?.cons) },
      bestValue: data.bestValue === 'B' ? 'B' : 'A',
      recommendation: String(data.recommendation || '').slice(0, 400),
    },
    tokensUsed: usage?.total_tokens,
  });
};

/**
 * @route GET /api/ai/recommendations/:slug
 * @access Public
 *
 * Deliberately NOT an LLM call. Recommendations are a database query:
 * same category, in stock, well rated, similar price. It is instant, free,
 * deterministic and explainable - all things an LLM would not be here.
 * Start simple; a smarter model can replace this later behind the same route.
 */
export const recommendations = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true });
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const products = await Product.find({
    _id: { $ne: product._id },
    category: product.category,
    isActive: true,
    stock: { $gt: 0 },
    price: { $gte: product.price * 0.5, $lte: product.price * 1.5 },
  })
    .populate('category', 'name slug')
    .sort({ ratingAvg: -1 })
    .limit(4);

  res.status(200).json({
    success: true,
    basedOn: 'Same category, similar price, highest rated',
    count: products.length,
    products,
  });
};
