import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by queries unless explicitly requested
    },
    role: {
      type: String,
      enum: ['customer', 'admin', 'superadmin'],
      default: 'customer',
    },
    isActive: {
      type: Boolean,
      default: true, // Super Admin suspends by flipping this, not by deleting
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

/* Hash the password before saving - but ONLY when it actually changed. */
userSchema.pre('save', async function () {
  // Mongoose 9: async middleware finishes by returning - there is no `next`.
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/* Compare a plain-text login attempt against the stored hash. */
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
