const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });
const User = require('../models/User');

// Add csrf middleware to distributor routes
router.use(csrfProtection);

// Route to get customers
router.get('/customers', async (req, res) => {
  try {
    const customers = await User.find({ role: 'customer', distributor: req.user._id });
    res.render('distributor/customers', { 
      customers,
      csrfToken: req.csrfToken() // Pass token to view
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

// Route to add a new customer
router.post('/customers/new', async (req, res) => {
  try {
    const { name, phone, email, password, subscriptionPlan, milkQuantity, deliveryTime, street, city, state, zipCode } = req.body;

    const newCustomer = new User({
      name,
      phone,
      email,
      password,
      role: 'customer',
      distributor: req.user._id,
      customerFields: {
        subscriptionPlan,
        milkQuantity,
        deliveryTime
      },
      address: {
        street,
        city,
        state,
        zipCode
      }
    });

    await newCustomer.save();
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.json({ success: false, message: 'Failed to add customer' });
  }
});

// Route to view customer details
router.get('/customers/:id', async (req, res) => {
  try {
    const customer = await User.findById(req.params.id);
    if (!customer || customer.distributor.toString() !== req.user._id.toString()) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    res.json(customer);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to fetch customer details' });
  }
});

// Route to edit customer (GET)
router.get('/customers/:id/edit', async (req, res) => {
  try {
    const customer = await User.findOne({
      _id: req.params.id,
      distributor: req.user._id
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
    req.flash('error_msg', 'Error loading customer details');
    res.redirect('/distributor/customers');
  }
});

// Route to update customer (POST)
router.post('/customers/:id/edit', async (req, res) => {
  try {
    const { name, phone, email, subscriptionPlan, milkQuantity, deliveryTime, street, city, state, zipCode } = req.body;

    const customer = await User.findOne({
      _id: req.params.id,
      distributor: req.user._id
    });

    if (!customer) {
      return res.json({ 
        success: false, 
        message: 'Customer not found' 
      });
    }

    // Update customer fields
    customer.name = name;
    customer.phone = phone;
    customer.email = email;
    customer.customerFields.subscriptionPlan = subscriptionPlan;
    customer.customerFields.milkQuantity = milkQuantity;
    customer.customerFields.deliveryTime = deliveryTime;
    customer.address = { street, city, state, zipCode };

    await customer.save();

    res.json({ 
      success: true, 
      message: 'Customer updated successfully' 
    });
  } catch (error) {
    console.error(error);
    res.json({ 
      success: false, 
      message: 'Failed to update customer' 
    });
  }
});

// Route to toggle customer status
router.post('/customers/:id/toggle-status', async (req, res) => {
  try {
    const customer = await User.findOne({
      _id: req.params.id,
      distributor: req.user._id
    });

    if (!customer) {
      return res.status(404).json({ 
        success: false, 
        message: 'Customer not found' 
      });
    }

    // Toggle the active status
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

module.exports = router;