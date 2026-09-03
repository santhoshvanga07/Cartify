import mongoose from 'mongoose';
import slugify from '../utils/slugify.js';

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },

    price: { type: Number, required: true, min: [0, 'Price cannot be negative'] },
    mrp: { type: Number, required: true, min: 0 },

    // Reference, not a copy: categories are edited independently of products.
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },

    images: [{ url: String, publicId: String }],
    stock: { type: Number, required: true, min: 0, default: 0 },

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

productSchema.pre('save', function () {
  if (this.isModified('name')) this.slug = slugify(this.name);

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
