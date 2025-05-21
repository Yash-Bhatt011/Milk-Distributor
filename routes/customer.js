const express = require('express');
const router = express.Router();
const { Customer, Order, Payment, Delivery, User } = require('../models');
const { ensureAuthenticated, isCustomer } = require('../middleware/auth');

// Remove these duplicate imports
// const Delivery = require('../models/delivery');
// const Delivery = require('../models/Delivery');

router.get('/dashboard', async (req, res) => {
  try {
    const [recentOrders, pendingAmount, monthlyRevenue] = await Promise.all([
      Order.find({ customer: req.user._id })
        .sort({ deliveryDate: -1 })
        .limit(5)
        .populate('distributor'),
      
      Payment.aggregate([
        { $match: { customer: req.user._id, status: 'pending' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),

      Order.aggregate([
        {
          $match: {
            customer: req.user._id,
            deliveryDate: {
              $gte: new Date(new Date().setDate(1)), // First day of current month
              $lte: new Date()
            }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ])
    ]);

    // Format orders for display with null checks
    const formattedOrders = recentOrders.map(order => ({
      ...order._doc,
      deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : 'Not scheduled',
      items: Array.isArray(order.items) ? order.items.map(item => ({
        ...item,
        quantity: item.quantity ? parseFloat(item.quantity).toFixed(1) : '0.0'
      })) : [],
      totalAmount: order.totalAmount ? parseFloat(order.totalAmount).toFixed(2) : '0.00'
    }));

    res.render('customer/dashboard', {
      title: 'Dashboard',
      user: req.user,
      recentOrders: formattedOrders,
      pendingAmount: pendingAmount[0]?.total || 0,
      monthlyRevenue: monthlyRevenue[0]?.total || 0
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
});

// Get all orders
router.get('/orders', async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('distributor', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const formattedOrders = orders.map(order => ({
      ...order,
      deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().split('T')[0] : 'Not scheduled',
      items: Array.isArray(order.items) ? order.items.map(item => ({
        ...item,
        quantity: item.quantity ? parseFloat(item.quantity).toFixed(1) : '0.0'
      })) : [],
      totalAmount: parseFloat(order.totalAmount || 0)
    }));

    res.render('customer/orders', {
      title: 'My Orders',
      orders: formattedOrders
    });
  } catch (err) {
    console.error('Orders Error:', err);
    req.flash('error_msg', 'Error loading orders');
    res.redirect('/customer/dashboard');
  }
});

// Get all payments
router.get('/payments', async (req, res) => {
  try {
    const payments = await Payment.find({ customer: req.user._id })
      .populate('distributor', 'name')
      .sort({ paymentDate: -1 })
      .lean();

    // Calculate current balance from pending payments
    const pendingPayments = await Payment.aggregate([
      {
        $match: {
          customer: req.user._id,
          status: 'pending'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const currentBalance = pendingPayments[0]?.total || 0;

    res.render('customer/payments', {
      title: 'My Payments',
      payments: payments,
      currentBalance: currentBalance
    });
  } catch (err) {
    console.error('Payments Error:', err);
    req.flash('error_msg', 'Error loading payments');
    res.redirect('/customer/dashboard');
  }
});

// View order details
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      customer: req.user._id
    })
    .populate('distributor', 'name phone')
    .lean();

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const formattedOrder = {
      success: true,
      order: {
        _id: order._id.toString(),
        deliveryDate: order.deliveryDate,
        status: order.status || 'pending',
        totalAmount: order.totalAmount || 0,
        items: order.items || [],
        distributor: order.distributor || { name: 'Not Assigned' }
      }
    };

    res.json(formattedOrder);
  } catch (err) {
    console.error('Order Details Error:', err);
    res.status(500).json({ success: false, message: 'Error loading order details' });
  }
});

// Payment routes
router.get('/payments/new', isCustomer, async (req, res) => {
  try {
    // Get customer details with distributor info
    const customer = await User.findById(req.user._id)
      .populate('customerFields.distributorId');

    // Get pending deliveries
    const pendingDeliveries = await Delivery.find({
      customer: req.user._id,
      paymentStatus: 'pending'
    }).populate('order');

    // Calculate total amount due
    const amountDue = pendingDeliveries.reduce((total, delivery) => {
      return total + (delivery.order ? delivery.order.totalAmount : 0);
    }, 0);

    const milkQuantity = customer.customerFields?.milkQuantity || 0;
    const ratePerLiter = customer.customerFields?.ratePerLiter || 0;

    res.render('customer/make-payment', {
      title: 'Make Payment',
      milkQuantity,
      ratePerLiter,
      amountDue,
      distributor: customer.customerFields?.distributorId,
      pendingDeliveries,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error:', error);
    req.flash('error', 'Failed to load payment details');
    res.redirect('/customer/payments');
  }
});

router.get('/payments/receipt/:id', async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id).lean();
        if (!payment) {
            return res.redirect('/customer/payments');
        }
        res.render('customer/receipt', { payment });
    } catch (err) {
        console.error('Receipt Error:', err);
        res.redirect('/customer/payments');
    }
});

router.post('/payments/process', isCustomer, async (req, res) => {
  try {
    const {
      distributorId,
      milkQuantity,
      ratePerLiter,
      totalAmount,
      paymentMethod,
    } = req.body;

    if (!distributorId || !paymentMethod) {
      throw new Error('Missing required payment information');
    }

    // Create new payment record
    const payment = new Payment({
      customer: req.user._id,
      distributor: distributorId,
      amount: parseFloat(totalAmount) || 0,
      milkQuantity: parseFloat(milkQuantity) || 0,
      ratePerLiter: parseFloat(ratePerLiter) || 0,
      paymentMethod,
      paymentDate: new Date(),
      status: 'pending'
    });

    await payment.save();

    // Update related deliveries if any
    if (req.body.deliveryIds) {
      await Delivery.updateMany(
        { _id: { $in: req.body.deliveryIds } },
        { $set: { paymentStatus: 'paid' } }
      );
    }

    res.json({ 
      success: true, 
      message: 'Payment processed successfully',
      paymentId: payment._id 
    });
  } catch (error) {
    console.error('Payment processing error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to process payment. Please try again.' 
    });
  }
});

router.post('/orders/create', async (req, res) => {
  try {
    const { customerId, items, deliveryTime } = req.body;

    // Validate required fields
    if (!customerId || !items || !items.length) {
      throw new Error('Missing required fields');
    }

    // Ensure all items have required fields
    const processedItems = items.map(item => ({
      product: item.product || 'Regular Milk',
      quantity: parseFloat(item.quantity) || 0.5,
      price: parseFloat(item.price) || 60
    }));

    const order = new Order({
      customer: customerId,
      distributor: req.user._id,
      items: processedItems,
      deliveryTime: deliveryTime || 'morning',
      deliveryDate: new Date(),
      status: 'pending'
    });

    await order.save();
    res.json({ success: true, message: 'Order created successfully' });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/make-payment', isCustomer, async (req, res) => {
    try {
        // Fetch pending orders/deliveries for the customer
        const pendingDeliveries = await Delivery.find({
            customer: req.user._id,
            paymentStatus: 'pending'
        }).populate('order');

        // Calculate total amount due
        const amountDue = pendingDeliveries.reduce((total, delivery) => {
            return total + (delivery.order ? delivery.order.totalAmount : 0);
        }, 0);

        res.render('customer/make-payment', {
            title: 'Make Payment',
            amountDue: amountDue,
            pendingDeliveries: pendingDeliveries
        });
    } catch (error) {
        console.error('Error:', error);
        req.flash('error', 'Failed to load payment details');
        res.redirect('/customer/dashboard');
    }
});

module.exports = router;