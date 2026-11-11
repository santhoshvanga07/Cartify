import mongoose from 'mongoose';
import slugify from '../utils/slugify.js';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Category name is required'], trim: true, unique: true },
    slug: { type: String, unique: true, index: true },
    description: { type: String, trim: true, default: '' },
    image: { url: String, publicId: String },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Keep the slug in sync with the name automatically.
categorySchema.pre('save', function () {
  if (this.isModified('name')) this.slug = slugify(this.name) || `category-${this._id.toString().slice(-6)}`;
});

/** The built-in catch-all category: always present, always listed last, cannot be deleted or renamed. */
export const OTHERS_SLUG = 'others';
export const OTHERS_NAME = 'Others';

export default mongoose.model('Category', categorySchema);
