const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Define the user schema with role-based fields
const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true
  },
  active: {
    type: Boolean,
    default: true,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'distributor', 'customer'],
    required: true
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    match: [/^\d{10}$/, 'Please enter a valid 10-digit phone number']
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  // Fields specific to distributors
  distributorFields: {
    assignedArea: String,
    vehicleNumber: String,
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  // Fields specific to customers
  customerFields: {
    subscriptionPlan: {
      type: String,
      enum: ['daily', 'alternate', 'weekly', 'custom'],
      default: 'daily'
    },
    milkQuantity: {
      type: Number,
      default: 1
    },
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveryTime: {
      type: String,
      default: 'morning'
    },
    deliveryInstructions: String,
    active: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Add this index for better query performance
UserSchema.index({ role: 1, active: 1 });

// Add virtual field for customers
UserSchema.virtual('customers', {
  ref: 'User',
  localField: '_id',
  foreignField: 'customerFields.distributorId',
  justOne: false
});

// Enable virtuals when converting document to JSON
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

// Pre-save hook to hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare entered password with hashed password
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);