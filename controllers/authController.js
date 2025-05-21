const User = require('../models/User');
const passport = require('passport');
const bcrypt = require('bcryptjs');

// Display login form with role selection
exports.getLogin = (req, res) => {
  res.render('auth/role-select', {
    title: 'Select Login Type'
  });
};

// Display login form for specific role
exports.getRoleLogin = (req, res) => {
  const role = req.params.role;
  
  // Validate role
  if (!['admin', 'distributor', 'customer'].includes(role)) {
    req.flash('error_msg', 'Invalid user role');
    return res.redirect('/login');
  }
  
  res.render('auth/login', {
    title: `${role.charAt(0).toUpperCase() + role.slice(1)} Login`,
    role: role
  });
};

// Process login
exports.postLogin = (req, res, next) => {
  const role = req.params.role;
  
  // Validate role
  if (!['admin', 'distributor', 'customer'].includes(role)) {
    req.flash('error_msg', 'Invalid user role');
    return res.redirect('/login');
  }
  
  passport.authenticate('local', (err, user, info) => {
    if (err) {
      console.error(err);
      return next(err);
    }
    
    if (!user) {
      req.flash('error_msg', info.message || 'Invalid email or password');
      return res.redirect(`/login/${role}`);
    }
    
    // Check if user role matches the selected role
    if (user.role !== role) {
      req.flash('error_msg', `Invalid credentials for ${role} login`);
      return res.redirect(`/login/${role}`);
    }
    
    req.logIn(user, (err) => {
      if (err) {
        console.error(err);
        return next(err);
      }
      
      // Redirect based on role
      switch (user.role) {
        case 'admin':
          return res.redirect('/admin/dashboard');
        case 'distributor':
          return res.redirect('/distributor/dashboard');
        case 'customer':
          return res.redirect('/customer/dashboard');
        default:
          return res.redirect('/dashboard');
      }
    });
  })(req, res, next);
};

// Register initial admin
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if any admin already exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      req.flash('error_msg', 'Admin already exists');
      return res.redirect('/login');
    }

    // Check if email is already registered
    const userExists = await User.findOne({ email });
    if (userExists) {
      req.flash('error_msg', 'Email is already registered');
      return res.redirect('/login');
    }

    // Create new admin
    const newAdmin = new User({
      name,
      email,
      password,
      role: 'admin',
      phone,
      address: {} // Empty address for admin
    });

    await newAdmin.save();

    req.flash('success_msg', 'Admin registered successfully');
    res.redirect('/login');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Error registering admin');
    res.redirect('/login');
  }
};

// Register new distributor (admin only function)
exports.registerDistributor = async (req, res) => {
  try {
    const { name, email, password, phone, street, city, state, zipCode, assignedArea, vehicleNumber } = req.body;
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error_msg', 'Email is already registered');
      return res.redirect('/admin/distributor/register');
    }
    
    // Create new distributor
    const newDistributor = new User({
      name,
      email,
      password,
      role: 'distributor',
      phone,
      address: {
        street,
        city,
        state,
        zipCode
      },
      distributorFields: {
        assignedArea,
        vehicleNumber,
        adminId: req.user._id // Current admin
      }
    });
    
    await newDistributor.save();
    
    req.flash('success_msg', 'Distributor registered successfully');
    res.redirect('/admin/distributors');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error during registration');
    res.redirect('/admin/distributor/register');
  }
};

// Register new customer (distributor only function)
exports.registerCustomer = async (req, res) => {
  try {
    const { 
      name, email, password, phone, 
      street, city, state, zipCode, 
      subscriptionPlan, milkQuantity, deliveryTime, deliveryInstructions 
    } = req.body;
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      req.flash('error_msg', 'Email is already registered');
      return res.redirect('/distributor/customer/register');
    }
    
    // Create new customer
    const newCustomer = new User({
      name,
      email,
      password,
      role: 'customer',
      phone,
      address: {
        street,
        city,
        state,
        zipCode
      },
      customerFields: {
        subscriptionPlan,
        milkQuantity,
        distributorId: req.user._id, // Current distributor
        deliveryTime,
        deliveryInstructions,
        active: true
      }
    });
    
    await newCustomer.save();
    
    req.flash('success_msg', 'Customer registered successfully');
    res.redirect('/distributor/customers');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Server error during registration');
    res.redirect('/distributor/customer/register');
  }
};

// Logout user
exports.logout = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error(err);
      return res.redirect('/dashboard');
    }
    req.flash('success_msg', 'You are logged out');
    res.redirect('/login');
  });
};