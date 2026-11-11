import mongoose from 'mongoose';
import slugify from '../utils/slugify.js';

/**
 * One option of a product - a size ("UK 8") or a colour ("Black") - with its
 * own stock. A product either has no variants (stock lives on the product) or
 * has some, and then the product's stock is always the SUM of theirs.
 */
const variantSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true, maxlength: 30 },
    stock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      validate: { validator: Number.isInteger, message: 'Stock must be a whole number' },
    },
  },
  { _id: false }
);

export const MAX_VARIANTS = 30;

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },

    price: { type: Number, required: true, min: [0, 'Price cannot be negative'] },
    mrp: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        // `this` is the product being saved. A price above MRP would show a negative discount.
        validator(v) { return this.price == null || v >= this.price; },
        message: 'MRP cannot be lower than the selling price',
      },
    },

    // Reference, not a copy: categories are edited independently of products.
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },

    images: [{ url: String, publicId: String }],
    stock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      default: 0,
      validate: { validator: Number.isInteger, message: 'Stock must be a whole number' },
    },

    // What the options are called ("Size", "Colour") and the options themselves.
    optionName: { type: String, trim: true, maxlength: 20, default: '' },
    variants: {
      type: [variantSchema],
      default: [],
      validate: [
        {
          validator: (list) => list.length <= MAX_VARIANTS,
          message: `A product can have at most ${MAX_VARIANTS} options`,
        },
        {
          validator: (list) => new Set(list.map((v) => v.label.toLowerCase())).size === list.length,
          message: 'Each option (size or colour) can only be listed once',
        },
      ],
    },

    // Flexible per-category specs. A laptop has RAM; a shoe has Waterproof.
    // This is the field the AI comparison feature reads in Week 9.
    attributes: { type: Map, of: String, default: {} },

    // Denormalised from reviews so product lists never aggregate on read.
    ratingAvg: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },

    /**
     * A denormalised search index built on save.
     *
     * We cannot search the description: it flattens attributes into prose, so
     * "Waterproof: No" matches a search for "waterproof". This field contains
     * only the name, brand and attributes whose value is meaningful - a shoe
     * that is NOT waterproof never gets the word.
     *
     * This is what a search index is: a second representation of the data,
     * shaped for querying rather than for reading.
     */
    searchText: { type: String, index: true, default: '' },
  },
  { timestamps: true }
);

const NEGATIVE = /^(no|none|false|0|nil|na)$/i;

// With options, the product's stock is the total of its options' stock.
productSchema.pre('validate', function () {
  if (this.variants?.length) this.stock = this.variants.reduce((sum, v) => sum + (v.stock || 0), 0);
});

/** Stock of one option (or of the product, when it has no options). */
productSchema.methods.stockFor = function (variant) {
  if (!this.variants?.length) return this.stock;
  return this.variants.find((v) => v.label === variant)?.stock ?? 0;
};

/** Does this product need a size/colour, and is the one given real? */
productSchema.methods.checkVariant = function (variant) {
  if (!this.variants?.length) return null;
  if (!variant) return `Please choose a ${(this.optionName || 'size').toLowerCase()}`;
  if (!this.variants.some((v) => v.label === variant)) return `${variant} is not available for this product`;
  return null;
};

productSchema.pre('save', async function () {
  /**
   * The slug (the product's URL) is chosen ONCE, when the product is created.
   * Past orders store it, so renaming a product must not break their links.
   * Two products may share a name, and a name may have no Latin letters at
   * all ("कुर्ता") - so fall back to "product" and add a short unique suffix
   * when the plain slug is already taken.
   */
  if (this.isNew || !this.slug) {
    const base = slugify(this.name) || 'product';
    const taken = await this.constructor.exists({ slug: base, _id: { $ne: this._id } });
    this.slug = taken ? `${base}-${this._id.toString().slice(-6)}` : base;
  }

  if (this.isModified('name') || this.isModified('brand') || this.isModified('attributes')) {
    const specs = [...(this.attributes ?? [])]
      .filter(([, value]) => !NEGATIVE.test(String(value).trim()))
      .map(([key, value]) => `${key} ${value}`);

    this.searchText = [this.name, this.brand, ...specs].join(' ').toLowerCase();
  }
});

// Text index powers keyword search. Weights make a name match beat a description match.
productSchema.index(
  { name: 'text', brand: 'text', description: 'text' },
  { weights: { name: 10, brand: 5, description: 1 }, name: 'product_text_index' }
);

// Compound index for the most common query: active products in a category, cheapest first.
productSchema.index({ isActive: 1, category: 1, price: 1 });

export default mongoose.model('Product', productSchema);
