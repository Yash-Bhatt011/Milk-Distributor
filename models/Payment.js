const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  distributorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Distributor',
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
  totalAmount: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'upi', 'card'],
    required: true
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['completed', 'pending'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true
  }
});

// Calculate total amount before saving
paymentSchema.pre('save', function(next) {
  this.totalAmount = this.milkQuantity * this.ratePerLiter;
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);