import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order, { COUNTS_AS_SALE } from '../models/Order.js';
import Wishlist from '../models/Wishlist.js';
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
/* ------------------------------------------------------------------
 * Fallback understanding, for when the AI is off or failing.
 * Not clever - but "trekking shoes under 3000" must not search for the
 * words "under" and "3000", or a working catalogue looks empty.
 * ------------------------------------------------------------------ */

const FILLER = new Set(
  ('i im i\'m want need looking look for a an the some any show me find get buy with and or to in of on my please '
    + 'something good nice best cheap cheapest affordable budget under below less than within upto up above over more '
    + 'max maximum min minimum around about price priced cost costing rs inr rupees that is are which can you')
    .split(' ')
);

/** "3000", "3,000", "3k", "1.5 lakh", "₹2999" -> rupees */
const amount = (num, unit = '') => {
  const n = Number(String(num).replace(/,/g, ''));
  const u = unit.toLowerCase();
  return u === 'k' || u === 'thousand' ? n * 1000 : u === 'l' || u === 'lakh' || u === 'lac' ? n * 100000 : n;
};
const MONEY = String.raw`(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)\s*(k|thousand|lakh|lac|l)?\b`;

export const fallbackFilters = (query, categories = []) => {
  let text = ` ${query.toLowerCase()} `;
  const out = {};

  const between = text.match(new RegExp(String.raw`between\s+${MONEY}\s+(?:and|to|-)\s+${MONEY}`, 'i'));
  if (between) {
    out.minPrice = amount(between[1], between[2]);
    out.maxPrice = amount(between[3], between[4]);
    text = text.replace(between[0], ' ');
  }
  const max = text.match(new RegExp(String.raw`(?:under|below|less than|within|up ?to|max(?:imum)?|cheaper than|<)\s*${MONEY}`, 'i'));
  if (max) {
    out.maxPrice = amount(max[1], max[2]);
    text = text.replace(max[0], ' ');
  }
  const min = text.match(new RegExp(String.raw`(?:above|over|more than|min(?:imum)?|from|>)\s*${MONEY}`, 'i'));
  if (min) {
    out.minPrice = amount(min[1], min[2]);
    text = text.replace(min[0], ' ');
  }

  // A category named in the request ("laptops", "laptop", "audio") becomes the category filter.
  // "other" is an ordinary word ("other laptops"), so the Others category is never guessed from it.
  for (const c of categories.filter((x) => x.slug !== 'others')) {
    const name = c.name.toLowerCase();
    const forms = [name, name.replace(/s$/, ''), c.slug];
    const hit = forms.find((f) => f && new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`).test(text));
    if (hit) {
      out.category = c.slug;
      text = text.replace(new RegExp(`\\b${hit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?\\b`, 'g'), ' ');
      break;
    }
  }

  if (/\bin stock\b|\bavailable\b/.test(text)) out.inStockOnly = true;

  const words = text
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w) && !/^\d+$/.test(w) && w !== 'stock');
  if (words.length) out.q = words.join(' ');
  return out;
};

export const aiSearch = async (req, res) => {
  const query = String(req.body?.query || '').trim();

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
    data = fallbackFilters(query, categories);
  }

  // The model may answer with JSON null or a bare value - treat that as "no filters".
  if (!data || typeof data !== 'object') data = fallbackFilters(query, categories);

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
      ? `Here is what matches "${query}".`
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
  const { slugA, slugB } = req.body ?? {};

  // Strings only: an object like {"$ne": null} would otherwise be run as a query.
  if (typeof slugA !== 'string' || typeof slugB !== 'string' || !slugA || !slugB || slugA === slugB) {
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

  /**
   * The side-by-side facts need no AI - they are our own data. The AI only
   * adds pros, cons and a verdict. If it is not configured (or fails), the
   * shopper still gets the comparison table instead of an error.
   */
  let data;
  let usage;
  try {
    ({ data, usage } = await chatJSON({
      system: comparePrompt,
      user: `${describe(a, 'A')}\n\n${describe(b, 'B')}`,
      maxTokens: 800,
    }));
  } catch (err) {
    if (err.statusCode !== 503) console.error(`AI compare failed: ${err.message}`);
    return res.status(200).json({ success: true, products: { A: a, B: b }, comparison: null, aiUnavailable: true });
  }
  if (!data || typeof data !== 'object') data = {};

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

/*
 * ------------------------------------------------------------------
 * More recommendation shelves. Like the one above, every one of these
 * is a plain database query: explainable ("people who bought X also
 * bought Y"), instant and free.
 * ------------------------------------------------------------------
 */

const SHELF_FIELDS = 'name slug brand price mrp stock images ratingAvg numReviews category';
const SOLD = COUNTS_AS_SALE;

/** Loads products by id in the given order, keeping only ones still for sale. */
const productsInOrder = async (ids) => {
  const docs = await Product.find({ _id: { $in: ids }, isActive: true, stock: { $gt: 0 } }).select(SHELF_FIELDS);
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return ids.map((id) => byId.get(String(id))).filter(Boolean);
};

/**
 * @route GET /api/ai/recommendations/:slug/bought-together
 * @access Public
 * Market-basket in one pipeline: orders that contained this product,
 * every OTHER line in those orders, counted.
 */
export const boughtTogether = async (req, res) => {
  const product = await Product.findOne({ slug: req.params.slug, isActive: true }).select('_id');
  if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

  const pairs = await Order.aggregate([
    { $match: { ...SOLD, 'items.product': product._id } },
    { $unwind: '$items' },
    { $match: { 'items.product': { $ne: product._id } } },
    { $group: { _id: '$items.product', orders: { $sum: 1 } } },
    { $sort: { orders: -1 } },
    { $limit: 8 },
  ]);

  const products = (await productsInOrder(pairs.map((p) => p._id))).slice(0, 4);
  res.status(200).json({ success: true, basedOn: 'Bought in the same order', count: products.length, products });
};

/**
 * @route GET /api/ai/trending
 * @access Public
 * Most units sold in the last 30 days.
 */
export const trending = async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const top = await Order.aggregate([
    { $match: { ...SOLD, createdAt: { $gte: since } } },
    { $unwind: '$items' },
    { $group: { _id: '$items.product', units: { $sum: '$items.quantity' } } },
    { $sort: { units: -1 } },
    { $limit: 12 },
  ]);

  const products = (await productsInOrder(top.map((t) => t._id))).slice(0, 4);
  res.status(200).json({ success: true, basedOn: 'Most bought in the last 30 days', count: products.length, products });
};

/**
 * @route GET /api/ai/for-you
 * @access Private
 * Categories this shopper has bought from or saved, best rated first,
 * leaving out what they already own.
 */
export const forYou = async (req, res) => {
  const [orders, wishlist] = await Promise.all([
    Order.find({ user: req.user._id, ...SOLD }).select('items.product').lean(),
    Wishlist.findOne({ user: req.user._id }).select('products').lean(),
  ]);

  const owned = orders.flatMap((o) => o.items.map((i) => i.product));
  const seeds = [...owned, ...(wishlist?.products || [])];
  if (seeds.length === 0) {
    return res.status(200).json({ success: true, basedOn: 'Not enough history yet', count: 0, products: [] });
  }

  const categories = await Product.distinct('category', { _id: { $in: seeds } });
  const products = await Product.find({
    category: { $in: categories },
    _id: { $nin: seeds },
    isActive: true,
    stock: { $gt: 0 },
  })
    .select(SHELF_FIELDS)
    .sort({ ratingAvg: -1, numReviews: -1 })
    .limit(4);

  res.status(200).json({ success: true, basedOn: 'Your orders and wishlist', count: products.length, products });
};

/**
 * @route GET /api/ai/by-slugs?slugs=a,b,c
 * @access Public
 * Powers "Recently viewed": the browser remembers slugs, the server
 * supplies today's price and stock. Order is preserved.
 */
export const bySlugs = async (req, res) => {
  const slugs = String(req.query.slugs || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9-]{1,120}$/.test(s))
    .slice(0, 12);

  const docs = await Product.find({ slug: { $in: slugs }, isActive: true }).select(SHELF_FIELDS);
  const bySlug = new Map(docs.map((d) => [d.slug, d]));
  const products = slugs.map((s) => bySlug.get(s)).filter(Boolean);
  res.status(200).json({ success: true, count: products.length, products });
};
