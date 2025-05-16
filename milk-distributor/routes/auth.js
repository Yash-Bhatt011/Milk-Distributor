const express = require('express');
const router = express.Router();
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });
const authController = require('../controllers/authController');
const { forwardAuthenticated, isAuthenticated, isAdmin, isDistributor } = require('../middleware/auth');

// Login page with role selection
router.get('/login', forwardAuthenticated, csrfProtection, (req, res) => {
  res.render('auth/role-select', {
    title: 'Select Login Type',
    csrfToken: req.csrfToken()
  });
});

// Role-specific login pages
router.get('/login/:role', forwardAuthenticated, csrfProtection, (req, res) => {
  const role = req.params.role;
  if (!['admin', 'distributor', 'customer'].includes(role)) {
    req.flash('error_msg', 'Invalid user role');
    return res.redirect('/login');
  }
  
  res.render('auth/login', {
    title: `${role.charAt(0).toUpperCase() + role.slice(1)} Login`,
    role: role,
    csrfToken: req.csrfToken()
  });
});

// Process login
router.post('/login/:role', forwardAuthenticated, authController.postLogin);

// Register distributor (admin only)
router.post('/register/distributor', isAuthenticated, isAdmin, authController.registerDistributor);

// Register customer (distributor only)
router.post('/register/customer', isAuthenticated, isDistributor, authController.registerCustomer);

// Logout
router.get('/logout', isAuthenticated, authController.logout);

// Home page redirect
router.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

module.exports = router;