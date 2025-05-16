const mongoose = require('mongoose');

const DeliverySchema = new mongoose.Schema({
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    distributor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scheduledDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    deliveryTime: {
        type: String,
        enum: ['morning', 'evening'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'delivered', 'failed'],
        default: 'pending'
    },
    notes: String,
    completedAt: Date
});

module.exports = mongoose.model('Delivery', DeliverySchema);
