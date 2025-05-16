const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  phone: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    default: 'customer'
  },
  active: {
    type: Boolean,
    default: true
  },
  customerFields: {
    distributorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    milkQuantity: {
      type: Number,
      default: 0
    },
    ratePerLiter: {
      type: Number,
      default: 0
    },
    subscriptionPlan: {
      type: String,
      enum: ['daily', 'alternate', 'weekly'],
      default: 'daily'
    },
    deliveryTime: {
      type: String,
      enum: ['morning', 'evening'],
      default: 'morning'
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  pendingAmount: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
