const User = require('../models/User');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Delivery = require('../models/Delivery');

exports.getDashboard = async (req, res) => {
  try {
    // Get recent orders
    const recentOrders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('distributor', 'name');

    // Get pending payments
    const pendingAmount = await Payment.aggregate([
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

    res.render('customer/dashboard', {
      title: 'Dashboard',
      user: req.user,
      recentOrders,
      pendingAmount: pendingAmount[0]?.total || 0
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
};

exports.getProfile = async (req, res) => {
  try {
    console.log('Loading profile for user:', req.user._id);

    const customer = await User.findById(req.user._id)
      .populate('customerFields.distributorId', 'name phone')
      .select('-password')
      .lean();

    if (!customer) {
      console.error('Customer not found:', req.user._id);
      req.flash('error_msg', 'Profile not found');
      return res.redirect('/customer/dashboard');
    }

    console.log('Customer data:', {
      id: customer._id,
      name: customer.name,
      distributorId: customer.customerFields?.distributorId?._id
    });

    return res.render('customer/profile', {
      title: 'My Profile',
      customer: customer,
      layout: 'layouts/main' // Make sure layout is specified
    });
  } catch (err) {
    console.error('Profile Error:', err);
    req.flash('error_msg', 'Error loading profile');
    res.redirect('/customer/dashboard');
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, street, city, state, zipCode } = req.body;
    
    await User.findByIdAndUpdate(req.user._id, {
      name,
      phone,
      address: { street, city, state, zipCode }
    });

    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/customer/profile');
  } catch (err) {
    console.error('Update Error:', err);
    req.flash('error_msg', 'Error updating profile');
    res.redirect('/customer/profile');
  }
};
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log("Attempting to update customer with ID:", id);
    console.log("Request body:", JSON.stringify(updateData));
    console.log("Request params:", req.params);
    console.log("Request route:", req.originalUrl);
    console.log("User making request:", req.user ? req.user._id : 'Not authenticated');
    
    // If using MongoDB, ensure valid ObjectId
    const mongoose = require('mongoose');
    let customerId;
    
    try {
      customerId = mongoose.Types.ObjectId(id);
    } catch (err) {
      console.log("Invalid customer ID format:", id);
      return res.status(400).json({ message: "Invalid customer ID format" });
    }
    
    // Check if the customer exists and belongs to the distributor
    const customer = await User.findOne({ 
      _id: customerId,
      role: 'customer',
      'customerFields.distributorId': req.user._id  // Ensure customer belongs to this distributor
    });
    
    console.log("Find result:", customer);
    
    if (!customer) {
      console.log("Customer not found with ID:", id, "or doesn't belong to distributor:", req.user._id);
      return res.status(404).json({ message: "Customer not found" });
    }
    
    // Update only allowed fields
    const allowedUpdates = {
      name: updateData.name,
      phone: updateData.phone,
      email: updateData.email,
      address: updateData.address,
      'customerFields.subscriptionPlan': updateData.subscriptionPlan,
      'customerFields.milkQuantity': updateData.milkQuantity,
      'customerFields.deliveryTime': updateData.deliveryTime,
      'customerFields.deliveryInstructions': updateData.deliveryInstructions,
      'customerFields.active': updateData.active
    };
    
    // Remove undefined fields
    Object.keys(allowedUpdates).forEach(key => 
      allowedUpdates[key] === undefined && delete allowedUpdates[key]
    );
    
    // Update customer
    const updatedCustomer = await User.findByIdAndUpdate(
      customerId, 
      allowedUpdates, 
      { new: true, runValidators: true }
    );
    
    console.log("Customer updated successfully:", updatedCustomer);
    res.status(200).json(updatedCustomer);
  } catch (error) {
    console.error("Error updating customer:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({ message: "Error updating customer", error: error.message });
  }
}

exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .populate('distributor', 'name');

    res.render('customer/orders', {
      title: 'My Orders',
      orders
    });
  } catch (err) {
    console.error('Orders Error:', err);
    req.flash('error_msg', 'Error loading orders');
    res.redirect('/customer/dashboard');
  }
};

exports.pauseDelivery = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      'customerFields.active': false
    });

    res.json({ success: true, message: 'Deliveries paused successfully' });
  } catch (err) {
    console.error('Pause Error:', err);
    res.status(500).json({ success: false, message: 'Error pausing deliveries' });
  }
};

exports.resumeDelivery = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      'customerFields.active': true
    });

    res.json({ success: true, message: 'Deliveries resumed successfully' });
  } catch (err) {
    console.error('Resume Error:', err);
    res.status(500).json({ success: false, message: 'Error resuming deliveries' });
  }
};

exports.getPayments = async (req, res) => {
  try {
    // Get all payments
    const payments = await Payment.find({ customer: req.user._id })
      .sort({ createdAt: -1 })
      .populate('orders');

    // Calculate current balance
    const pendingAmount = await Payment.aggregate([
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

    const currentBalance = pendingAmount[0]?.total || 0;

    res.render('customer/payments', {
      title: 'My Payments',
      payments,
      currentBalance
    });
  } catch (err) {
    console.error('Payments Error:', err);
    req.flash('error_msg', 'Error loading payments');
    res.redirect('/customer/dashboard');
  }
};

exports.makePayment = async (req, res) => {
  try {
    const { amount, method } = req.body;

    const payment = new Payment({
      customer: req.user._id,
      distributor: req.user.customerFields.distributorId,
      amount,
      paymentMethod: method,
      status: 'completed'
    });

    await payment.save();

    res.json({ success: true, message: 'Payment recorded successfully' });
  } catch (err) {
    console.error('Payment Error:', err);
    res.status(500).json({ success: false, message: 'Error processing payment' });
  }
};

exports.getOrderDetails = async (req, res) => {
    try {
        const order = await Order.findOne({
            _id: req.params.id,
            customer: req.user._id
        })
        .populate('distributor', 'name')
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
        console.error('Error fetching order details:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error loading order details' 
        });
    }
};
