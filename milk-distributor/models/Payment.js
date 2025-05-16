const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  distributor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  milkQuantity: {
    type: Number,
    required: true
  },
  ratePerLiter: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'upi', 'card']
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected'],
    default: 'pending'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  confirmationDate: Date,
  confirmationNote: String
}, { timestamps: true });

// Calculate total amount before saving
PaymentSchema.pre('save', function(next) {
  if (!this.amount) {
    this.amount = this.milkQuantity * this.ratePerLiter;
  }
  next();
});

module.exports = mongoose.model('Payment', PaymentSchema);