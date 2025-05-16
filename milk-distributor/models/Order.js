const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
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
  items: [{
    product: {
      type: String,
      required: true,
      default: 'Regular Milk'
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.5
    },
    price: {
      type: Number,
      required: true,
      default: 60 // Default price per liter
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    default: function() {
      return this.items.reduce((total, item) => total + (item.quantity * item.price), 0);
    }
  },
  deliveryDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  deliveryTime: {
    type: String,
    enum: ['morning', 'evening'],
    default: 'morning'
  },
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending'
  },
  specialInstructions: String
}, { timestamps: true });

// Add index for better query performance
orderSchema.index({ customer: 1, deliveryDate: -1 });

orderSchema.pre('save', function(next) {
  if (!this.totalAmount) {
    this.totalAmount = this.items.reduce((total, item) => total + (item.quantity * item.price), 0);
  }
  if (!this.deliveryDate) {
    this.deliveryDate = new Date();
  }
  next();
});

// Add more descriptive validation
orderSchema.pre('validate', function(next) {
  if (!this.items || this.items.length === 0) {
    this.invalidate('items', 'At least one item is required');
  }
  
  if (!this.customer) {
    this.invalidate('customer', 'Customer is required');
  }
  
  if (!this.distributor) {
    this.invalidate('distributor', 'Distributor is required');
  }

  next();
});

module.exports = mongoose.model('Order', orderSchema);