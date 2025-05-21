const Payment = require('../models/Payment');
const User = require('../models/User');

exports.getPayments = async (req, res) => {
    try {
        const payments = await Payment.find({ distributor: req.user._id })
            .populate('customer', 'name')
            .sort({ paymentDate: -1 });

        const customers = await User.find({
            'customerFields.distributorId': req.user._id,
            'customerFields.active': true
        }).select('name customerFields');

        // Calculate pending amounts for each customer
        const customersWithPending = await Promise.all(customers.map(async (customer) => {
            const pendingAmount = await Payment.aggregate([
                {
                    $match: {
                        customer: customer._id,
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

            return {
                ...customer.toObject(),
                pendingAmount: pendingAmount[0]?.total || 0
            };
        }));

        res.render('distributor/payments', {
            title: 'Payment Management',
            payments,
            customers: customersWithPending
        });
    } catch (err) {
        console.error('Error in getPayments:', err);
        req.flash('error_msg', 'Error loading payments');
        res.redirect('/distributor/dashboard');
    }
};

exports.recordPayment = async (req, res) => {
    try {
        const { customerId, amount, paymentMethod, notes } = req.body;

        // Validate input
        if (!customerId || !amount || !paymentMethod) {
            req.flash('error_msg', 'Please provide all required fields');
            return res.redirect('/distributor/payments');
        }

        // Get customer details to verify distributor
        const customer = await User.findById(customerId);
        if (!customer || customer.customerFields.distributorId.toString() !== req.user._id.toString()) {
            req.flash('error_msg', 'Invalid customer');
            return res.redirect('/distributor/payments');
        }

        // Create new payment
        const payment = new Payment({
            customer: customerId,
            distributor: req.user._id,
            amount: parseFloat(amount),
            paymentMethod,
            status: 'completed',
            notes,
            paymentDate: new Date(),
            transactionId: 'TXN' + Date.now()
        });

        await payment.save();
        
        req.flash('success_msg', 'Payment recorded successfully');
        res.redirect('/distributor/payments');
    } catch (err) {
        console.error('Error in recordPayment:', err);
        req.flash('error_msg', 'Error recording payment');
        res.redirect('/distributor/payments');
    }
};

exports.getCustomerPayments = async (req, res) => {
    try {
        const payments = await Payment.find({
            customer: req.params.customerId,
            distributor: req.user._id
        }).sort({ paymentDate: -1 });

        res.json(payments);
    } catch (err) {
        console.error('Error in getCustomerPayments:', err);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
};

exports.getPaymentDetails = async (req, res) => {
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

    // Add formatted data
    payment.formattedDate = new Date(payment.paymentDate).toLocaleString();
    payment.formattedAmount = payment.amount.toFixed(2);
    payment.milkQuantityDisplay = `${payment.milkQuantity} L @ ₹${payment.ratePerLiter}/L`;
    payment.customerInfo = {
      name: payment.customer?.name || 'N/A',
      phone: payment.customer?.phone || 'N/A'
    };

    res.json({
      success: true,
      data: payment
    });
  } catch (err) {
    console.error('Payment details error:', err);
    res.status(500).json({
      success: false,
      message: 'Error loading payment details'
    });
  }
};

exports.togglePaymentStatus = async (req, res) => {
    try {
        const payment = await Payment.findById(req.params.id);

        if (!payment) {
            return res.status(404).json({ message: 'Payment not found' });
        }

        if (payment.distributor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied' });
        }

        payment.status = payment.status === 'completed' ? 'pending' : 'completed';
        await payment.save();

        res.json({ success: true, status: payment.status });
    } catch (err) {
        console.error('Error toggling payment status:', err);
        res.status(500).json({ message: 'Error updating payment status' });
    }
};
