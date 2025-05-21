const express = require('express');
const router = express.Router();
const distributorController = require('../controllers/distributorController');
const paymentController = require('../controllers/paymentController');
const { ensureAuthenticated, ensureDistributor } = require('../middleware/auth');
const User = require('../models/User');
const Payment = require('../models/Payment'); // Added Payment model
const Order = require('../models/Order'); // Added Order model
const Delivery = require('../models/Delivery'); // Added Delivery model

// Protect all distributor routes
router.use(ensureAuthenticated, ensureDistributor);

// Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Add activeCustomers to the Promise.all array
    const [todayStats, monthlyStats, pendingStats, recentPayments, revenueData, todaysDeliveries, activeCustomers, recentDeliveries] = await Promise.all([
      // Today's revenue
      Payment.aggregate([
        {
          $match: {
            distributor: req.user._id,
            paymentDate: { $gte: today },
            status: 'confirmed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Monthly revenue
      Payment.aggregate([
        {
          $match: {
            distributor: req.user._id,
            paymentDate: { 
              $gte: firstDayOfMonth,
              $lte: lastDayOfMonth
            },
            status: 'confirmed'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]),

      // Pending payments
      Payment.aggregate([
        {
          $match: {
            distributor: req.user._id,
            status: 'pending'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' },
            count: { $sum: 1 }
          }
        }
      ]),

      // Recent payments
      Payment.find({ distributor: req.user._id })
        .populate('customer', 'name')
        .sort({ paymentDate: -1 })
        .limit(5),

      // Revenue trend data (last 7 days)
      Payment.aggregate([
        {
          $match: {
            distributor: req.user._id,
            paymentDate: {
              $gte: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
            },
            status: 'confirmed'
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
            total: { $sum: '$amount' }
          }
        },
        { $sort: { '_id': 1 } }
      ])
    ]);

    // Process revenue trend data
    const labels = [];
    const values = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const dateString = date.toISOString().split('T')[0];
      const dayData = revenueData.find(d => d._id === dateString);
      labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
      values.push(dayData ? dayData.total : 0);
    }

    res.render('distributor/dashboard', {
      todayRevenue: todayStats[0]?.total || 0,
      todayPayments: todayStats[0]?.count || 0,
      monthlyRevenue: monthlyStats[0]?.total || 0,
      pendingAmount: pendingStats[0]?.total || 0,
      pendingPayments: pendingStats[0]?.count || 0,
      recentPayments,
      revenueData: { labels, values },
      todaysDeliveries,
      activeCustomers,
      recentDeliveries // Add this line to pass recent deliveries to the view
    });
  } catch (error) {
    console.error('Dashboard Error:', error);
    req.flash('error', 'Error loading dashboard data');
    res.redirect('/distributor');
  }
});

// Customers
router.get('/customers', distributorController.getCustomers);
router.post('/customers/new', distributorController.createCustomer);
router.get('/customers/:id', distributorController.getCustomerDetails);
router.put('/customers/:id', distributorController.updateCustomer);

// Route to edit customer page
router.get('/customers/:id/edit', async (req, res) => {
  try {
    const customer = await User.findOne({
      _id: req.params.id,
      'customerFields.distributorId': req.user._id
    });

    if (!customer) {
      req.flash('error_msg', 'Customer not found');
      return res.redirect('/distributor/customers');
    }

    res.render('distributor/edit-customer', {
      customer,
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Error loading customer');
    res.redirect('/distributor/customers');
  }
});

// Route to update customer (POST)
router.post('/customers/:id/edit', async (req, res) => {
  try {
    const { 
      name, phone, email, subscriptionPlan, 
      milkQuantity, deliveryTime, street, 
      city, state, zipCode 
    } = req.body;

    const customer = await User.findOneAndUpdate(
      {
        _id: req.params.id,
        distributor: req.user._id
      },
      {
        $set: {
          name,
          phone,
          email,
          'customerFields.subscriptionPlan': subscriptionPlan,
          'customerFields.milkQuantity': milkQuantity,
          'customerFields.deliveryTime': deliveryTime,
          'address.street': street,
          'address.city': city,
          'address.state': state,
          'address.zipCode': zipCode
        }
      },
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer not found' 
      });
    }

    res.json({ 
      success: true, 
      message: 'Customer updated successfully',
      customer 
    });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update customer',
      error: error.message 
    });
  }
});

// Route to toggle customer status
router.post('/customers/:id/toggle-status', async (req, res) => {
  try {
    const customer = await User.findOne({
      _id: req.params.id,
      'customerFields.distributorId': req.user._id
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Toggle active status
    customer.customerFields.active = !customer.customerFields.active;
    await customer.save();

    res.json({
      success: true,
      message: 'Status updated successfully',
      active: customer.customerFields.active
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error updating customer status'
    });
  }
});

// Deliveries
router.post('/deliveries/create', async (req, res) => {
    try {
        const { customer, distributor, items, deliveryTime, deliveryDate, status } = req.body;

        // Validate required fields
        if (!customer || !distributor || !items || !items.length) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Create order first
        const order = new Order({
            customer,
            distributor,
            items,
            totalAmount: items.reduce((sum, item) => sum + (item.quantity * item.price), 0),
            deliveryDate: new Date(deliveryDate),
            deliveryTime,
            status: 'pending'
        });

        await order.save();

        // Create delivery with order reference
        const delivery = new Delivery({
            order: order._id,
            customer,
            distributor,
            status,
            deliveryTime,
            scheduledTime: new Date(deliveryDate)
        });

        await delivery.save();

        res.json({
            success: true,
            message: 'Delivery created successfully',
            delivery
        });
    } catch (err) {
        console.error('Create Delivery Error:', err);
        res.status(500).json({
            success: false,
            message: err.message || 'Failed to create delivery'
        });
    }
});

router.get('/deliveries', distributorController.getDeliveries);
router.get('/deliveries/:id', distributorController.getDeliveryDetails);
router.put('/deliveries/:id', distributorController.updateDeliveryStatus);

// Update delivery status
router.post('/deliveries/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;

    // Validate status
    const validStatuses = ['pending', 'delivered', 'failed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status value'
      });
    }

    const delivery = await Delivery.findOneAndUpdate(
      { 
        _id: req.params.id,
        distributor: req.user._id 
      },
      { 
        status,
        notes,
        updatedAt: Date.now(),
        completedAt: status === 'delivered' ? Date.now() : undefined
      },
      { new: true }
    ).populate('customer', 'name');

    if (!delivery) {
      return res.status(404).json({
        success: false,
        message: 'Delivery not found'
      });
    }

    res.json({
      success: true,
      message: `Delivery marked as ${status}`,
      delivery
    });
  } catch (err) {
    console.error('Update delivery status error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update delivery status'
    });
  }
});

// Get order details
router.get('/orders/:id', async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      distributor: req.user._id
    }).populate('customer', 'name').lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order details'
    });
  }
});

// Get order details with additional fields
router.get('/orders/:id/details', async (req, res) => {
  try {
    const order = await Order.findOne({
      _id: req.params.id,
      distributor: req.user._id
    })
    .populate('customer', 'name phone address')
    .lean();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (err) {
    console.error('Error fetching order:', err);
    res.status(500).json({
      success: false,
      message: 'Error loading order details'
    });
  }
});

// Payments - Fix route order
router.get('/payments/customer/:customerId', paymentController.getCustomerPayments);
router.get('/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      distributor: req.user._id
    })
    .populate('customer', 'name phone')
    .populate('distributor', 'name')
    .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Format data for display
    const formattedPayment = {
      ...payment,
      formattedDate: new Date(payment.paymentDate).toLocaleString(),
      formattedAmount: payment.amount.toFixed(2),
      milkQuantityDisplay: `${payment.milkQuantity} L @ ₹${payment.ratePerLiter}/L`,
      customerInfo: {
        name: payment.customer?.name || 'N/A',
        phone: payment.customer?.phone || 'N/A'
      }
    };

    res.json({
      success: true,
      data: formattedPayment
    });
  } catch (err) {
    console.error('Payment details error:', err);
    res.status(500).json({
      success: false,
      message: 'Error loading payment details'
    });
  }
});
router.get('/payments', async (req, res) => {
  try {
    const payments = await Payment.find({ distributor: req.user._id })
      .populate('customer', 'name phone')
      .populate('distributor', 'name')
      .sort('-paymentDate');

    const customers = await User.find({
      'customerFields.distributorId': req.user._id,
      'customerFields.active': true
    }).select('name customerFields');

    // Calculate pending amounts
    const customersWithPending = await Promise.all(customers.map(async (customer) => {
      const pendingAmount = await Payment.aggregate([
        {
          $match: {
            customer: customer._id,
            status: 'pending'
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$amount' }
          }
        }
      ]);  // <-- Fixed: Added missing closing parenthesis here

      return {
        ...customer.toObject(),
        pendingAmount: pendingAmount[0]?.total || 0
      };
    }));

    res.render('distributor/payments', {
      payments,
      customers: customersWithPending,
      csrfToken: req.csrfToken()
    });
  } catch (err) {
    console.error('Error loading payments:', err);
    res.status(500).send('Error loading payments');
  }
});

// Update payment details route
router.get('/payments/:id', async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      distributor: req.user._id
    })
    .populate('customer', 'name phone')
    .populate('distributor', 'name')
    .lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Format data for display
    const formattedPayment = {
      ...payment,
      formattedDate: new Date(payment.paymentDate).toLocaleString(),
      formattedAmount: payment.amount.toFixed(2),
      milkQuantityDisplay: `${payment.milkQuantity} L @ ₹${payment.ratePerLiter}/L`,
      customerInfo: {
        name: payment.customer?.name || 'N/A',
        phone: payment.customer?.phone || 'N/A'
      }
    };

    res.json({
      success: true,
      data: formattedPayment
    });
  } catch (err) {
    console.error('Error fetching payment:', err);
    res.status(500).json({
      success: false,
      message: 'Error loading payment details'
    });
  }
});
router.post('/payments/record', async (req, res) => {
  try {
    const { customerId, amount, paymentMethod, notes, ratePerLiter, milkQuantity } = req.body;

    // Validate input
    if (!customerId || !amount || !paymentMethod || !ratePerLiter || !milkQuantity) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    const payment = new Payment({
      customer: customerId,
      distributor: req.user._id,
      amount: parseFloat(amount),
      milkQuantity: parseFloat(milkQuantity),
      ratePerLiter: parseFloat(ratePerLiter),
      paymentMethod,
      notes,
      status: 'pending',
      paymentDate: new Date()
    });

    await payment.save();

    res.json({
      success: true,
      message: 'Payment recorded successfully'
    });
  } catch (err) {
    console.error('Payment recording error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error recording payment'
    });
  }
});

router.post('/payments/:id/toggle-status', async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      distributor: req.user._id
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Toggle status
    payment.status = payment.status === 'completed' ? 'pending' : 'completed';
    await payment.save();

    res.json({
      success: true,
      message: 'Payment status updated successfully',
      status: payment.status
    });
  } catch (error) {
    console.error('Toggle payment status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating payment status'
    });
  }
});

router.put('/payments/:id/toggle-status', async (req, res) => {
  try {
    const payment = await Payment.findOne({
      _id: req.params.id,
      distributor: req.user._id
    });

    if (!payment) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    payment.status = req.body.status;
    await payment.save();

    res.json({ 
      success: true, 
      message: 'Payment status updated',
      status: payment.status 
    });
  } catch (err) {
    console.error('Toggle payment error:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating payment status'
    });
  }
});

// Revenue routes
router.get('/revenue', async (req, res) => {
  try {
    await distributorController.getRevenue(req, res);
  } catch (error) {
    console.error('Revenue route error:', error);
    req.flash('error', 'Error loading revenue data');
    res.redirect('/distributor/dashboard');
  }
});

// Remove or implement the getRevenueData route
// router.get('/revenue/data', distributorController.getRevenueData); // Remove this line

// Profile
router.get('/profile', distributorController.getProfile);
router.put('/profile', distributorController.updateProfile);

// Get pending payments
router.get('/pending-payments', async (req, res) => {
  try {
    const pendingPayments = await Payment.find({
      distributor: req.user._id,
      status: 'pending'
    })
    .populate('customer', 'name')
    .sort('-paymentDate')
    .lean();

    res.render('distributor/pending-payments', {
      payments: pendingPayments
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading pending payments');
    res.redirect('/distributor/dashboard');
  }
});

// Confirm or reject payment
router.post('/confirm-payment/:id', async (req, res) => {
  try {
    const { action, note } = req.body;
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    payment.status = action === 'confirm' ? 'confirmed' : 'rejected';
    payment.distributorConfirmed = action === 'confirm';
    payment.confirmationDate = new Date();
    payment.confirmationNote = note;
    await payment.save();

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error processing payment confirmation' });
  }
});

module.exports = router;