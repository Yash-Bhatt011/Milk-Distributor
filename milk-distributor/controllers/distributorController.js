const User = require('../models/User');
const Order = require('../models/Order');
const Delivery = require('../models/Delivery');
const Payment = require('../models/Payment');

// Get distributor dashboard
exports.getDashboard = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Calculate monthly revenue
    const monthlyRevenueData = await Payment.aggregate([
      {
        $match: {
          distributor: req.user._id,
          status: 'completed',
          paymentDate: {
            $gte: firstDayOfMonth,
            $lte: lastDayOfMonth
          }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    // Get today's deliveries count
    const todaysDeliveries = await Delivery.countDocuments({
      distributor: req.user._id,
      scheduledDate: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    // Get active customers count
    const activeCustomers = await User.countDocuments({
      'customerFields.distributorId': req.user._id,
      'customerFields.active': true
    });

    // Get pending payments total
    const pendingPayments = await Payment.aggregate([
      {
        $match: {
          distributor: req.user._id,
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

    // Get recent deliveries
    const recentDeliveries = await Delivery.find({
      distributor: req.user._id
    })
    .populate('customer', 'name address')
    .sort({ scheduledDate: -1 })
    .limit(10);

    res.render('distributor/dashboard', {
      title: 'Distributor Dashboard',
      todaysDeliveries,
      activeCustomers,
      pendingPayments: pendingPayments[0]?.total || 0,
      monthlyRevenue: monthlyRevenueData[0]?.total || 0,
      recentDeliveries
    });
  } catch (err) {
    console.error('Dashboard Error:', err);
    req.flash('error_msg', 'Error loading dashboard');
    res.redirect('/');
  }
};

// Get all customers
exports.getCustomers = async (req, res) => {
  try {
    console.log('Fetching customers for distributor:', req.user._id);
    
    const customers = await User.find({
      'customerFields.distributorId': req.user._id,
      role: 'customer'
    })
    .select('name email phone address customerFields')
    .sort({ name: 1 });

    console.log('Found customers:', customers.length);

    res.render('distributor/customers', {
      title: 'My Customers',
      customers
    });
  } catch (err) {
    console.error('Error in getCustomers:', err);
    req.flash('error_msg', 'Error loading customers');
    res.redirect('/distributor/dashboard');
  }
};

// Get deliveries for distributor
exports.getDeliveries = async (req, res) => {
  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const deliveries = await Delivery.find({
      distributor: req.user._id,
      scheduledDate: {
        $gte: today,
        $lt: tomorrow
      }
    })
    .populate('customer', 'name address')
    .populate('order', 'items')
    .sort({ scheduledTime: 1 });

    const customers = await User.find({
      'customerFields.distributorId': req.user._id,
      'customerFields.active': true
    }).select('name address customerFields');

    console.log('Found deliveries:', deliveries.length);

    res.render('distributor/deliveries', {
      title: 'Today\'s Deliveries',
      deliveries,
      customers
    });
  } catch (err) {
    console.error('Error loading deliveries:', err);
    req.flash('error_msg', 'Error loading deliveries');
    res.redirect('/distributor/dashboard');
  }
};

// Update delivery status
exports.updateDeliveryStatus = async (req, res) => {
    try {
        const { status, notes } = req.body;
        
        // Validate status
        const validStatuses = ['pending', 'in-progress', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status value' 
            });
        }

        const delivery = await Delivery.findOneAndUpdate(
            { _id: req.params.id, distributor: req.user._id },
            {
                status,
                deliveryNotes: notes,
                actualDeliveryTime: status === 'delivered' ? new Date() : undefined
            },
            { new: true }
        );

        if (!delivery) {
            return res.status(404).json({ 
                success: false, 
                message: 'Delivery not found' 
            });
        }

        res.json({ success: true, delivery });
    } catch (err) {
        console.error('Update delivery status error:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error updating delivery status' 
        });
    }
};

// Get customer details
exports.getCustomerDetails = async (req, res) => {
  try {
    const customer = await User.findById(req.params.id)
      .select('-password');
      
    if (!customer || customer.role !== 'customer') {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create new customer
exports.createCustomer = async (req, res) => {
    try {
        console.log('Creating customer with data:', req.body);

        const {
            name, email, password, phone,
            address, customerFields
        } = req.body;

        // Validation
        if (!name || !email || !password || !phone || !customerFields.subscriptionPlan) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Create customer
        const customer = new User({
            name,
            email,
            password,
            phone,
            role: 'customer',
            address,
            customerFields: {
                ...customerFields,
                distributorId: req.user._id
            }
        });

        await customer.save();
        console.log('Customer created successfully:', customer._id);

        res.status(201).json({
            success: true,
            message: 'Customer added successfully'
        });
    } catch (err) {
        console.error('Customer creation error:', err);
        
        if (err.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: err.message || 'Error creating customer'
        });
    }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { 
      name, phone, street, city, state, zipCode,
      subscriptionPlan, milkQuantity, deliveryTime,
      deliveryInstructions, active 
    } = req.body;

    const customer = await User.findOneAndUpdate(
      { 
        _id: req.params.id,
        'customerFields.distributorId': req.user._id 
      },
      {
        name,
        phone,
        address: { street, city, state, zipCode },
        customerFields: {
          subscriptionPlan,
          milkQuantity,
          distributorId: req.user._id,
          deliveryTime,
          deliveryInstructions,
          active
        }
      },
      { new: true, runValidators: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error updating customer' });
  }
};

// Get delivery details
exports.getDeliveryDetails = async (req, res) => {
  try {
    const delivery = await Delivery.findById(req.params.id)
      .populate('customer', 'name address phone')
      .populate('order', 'items totalAmount specialInstructions');

    if (!delivery || delivery.distributor.toString() !== req.user._id.toString()) {
      return res.status(404).json({ message: 'Delivery not found' });
    }

    res.json(delivery);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get distributor profile
exports.getProfile = async (req, res) => {
  try {
    const distributor = await User.findById(req.user._id)
      .select('-password');

    res.render('distributor/profile', {
      title: 'My Profile',
      distributor
    });
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error loading profile');
    res.redirect('/distributor/dashboard');
  }
};

// Update distributor profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, street, city, state, zipCode, vehicleNumber } = req.body;

    await User.findByIdAndUpdate(req.user._id, {
      name,
      phone,
      address: { street, city, state, zipCode },
      'distributorFields.vehicleNumber': vehicleNumber
    });

    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/distributor/profile');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error updating profile');
    res.redirect('/distributor/profile');
  }
};

// Check if deliveries exist for today
exports.checkTodayDeliveries = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const existingDeliveries = await Delivery.findOne({
            distributor: req.user._id,
            scheduledDate: {
                $gte: today,
                $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
            }
        });

        res.json({ exists: !!existingDeliveries });
    } catch (err) {
        console.error('Error checking today\'s deliveries:', err);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create single delivery
exports.createDelivery = async (req, res) => {
    try {
        const { customerId, milkType, quantity, deliveryTime } = req.body;

        // Validate input
        if (!customerId || !milkType || !quantity || !deliveryTime) {
            return res.status(400).json({ 
                success: false, 
                message: 'Please provide all required fields' 
            });
        }

        // Get milk price based on type
        const milkPrices = {
            'Regular': 60,
            'Full Cream': 75,
            'Toned': 65,
            'Double Toned': 55
        };

        const price = milkPrices[milkType] || 60;
        const totalAmount = quantity * price;

        // Create order
        const order = new Order({
            customer: customerId,
            distributor: req.user._id,
            items: [{
                product: milkType,
                quantity: quantity,
                price: price
            }],
            totalAmount: totalAmount,
            status: 'confirmed',
            deliveryDate: new Date(),
            deliveryTime: deliveryTime
        });

        await order.save();

        // Create delivery
        const delivery = new Delivery({
            order: order._id,
            distributor: req.user._id,
            customer: customerId,
            scheduledDate: new Date(),
            scheduledTime: deliveryTime,
            status: 'pending'
        });

        await delivery.save();

        res.status(200).json({ 
            success: true, 
            message: 'Delivery created successfully' 
        });
    } catch (err) {
        console.error('Error creating delivery:', err);
        res.status(500).json({ 
            success: false, 
            message: 'Error creating delivery' 
        });
    }
};

// Get revenue details
exports.getRevenue = async (req, res) => {
    try {
        const startDate = new Date(req.query.startDate || new Date().setMonth(new Date().getMonth() - 1));
        const endDate = new Date(req.query.endDate || Date.now());
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // Get payments for this distributor
        const payments = await Payment.find({
            distributor: req.user._id,
            paymentDate: { $gte: startDate, $lte: endDate }
        })
        .populate('customer', 'name')
        .sort({ paymentDate: -1 });

        // Calculate revenue metrics
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const todayRevenue = await Payment.aggregate([
            {
                $match: {
                    distributor: req.user._id,
                    status: 'completed',
                    paymentDate: { $gte: todayStart }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);

        const monthlyRevenue = await Payment.aggregate([
            {
                $match: {
                    distributor: req.user._id,
                    status: 'completed',
                    paymentDate: { $gte: monthStart }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);

        const pendingAmount = await Payment.aggregate([
            {
                $match: {
                    distributor: req.user._id,
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

        res.render('distributor/revenue', {
            title: 'Revenue Details',
            payments,
            todayRevenue: todayRevenue[0]?.total || 0,
            monthlyRevenue: monthlyRevenue[0]?.total || 0,
            totalRevenue: payments.reduce((sum, p) => sum + (p.amount || 0), 0),
            pendingAmount: pendingAmount[0]?.total || 0,
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0]
        });
    } catch (err) {
        console.error('Error fetching revenue:', err);
        req.flash('error_msg', 'Error loading revenue data');
        res.redirect('/distributor/dashboard');
    }
};

exports.getRevenueData = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        const revenueData = await Payment.aggregate([
            {
                $match: {
                    distributor: req.user._id,
                    status: 'completed',
                    paymentDate: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
                    totalAmount: { $sum: '$amount' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json(revenueData);
    } catch (err) {
        console.error('Revenue data error:', err);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
};