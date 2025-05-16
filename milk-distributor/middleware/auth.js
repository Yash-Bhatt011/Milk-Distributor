const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to check if user is authenticated
exports.isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Please log in to access this page');
  res.redirect('/login');
};

exports.ensureAuthenticated = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash('error_msg', 'Please log in to access this resource');
    res.redirect('/login');
};

// Middleware for admin access
exports.isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  req.flash('error', 'Access denied');
  res.redirect('/dashboard');
};

// Middleware for distributor access
exports.isDistributor = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'distributor') {
    return next();
  }
  req.flash('error', 'Access denied');
  res.redirect('/dashboard');
};

exports.ensureDistributor = (req, res, next) => {
    if (req.isAuthenticated() && req.user.role === 'distributor') {
        return next();
    }
    req.flash('error_msg', 'Access denied. Distributors only.');
    res.redirect('/login');
};

// Middleware for customer access
exports.isCustomer = (req, res, next) => {
  if (req.isAuthenticated() && req.user.role === 'customer') {
    return next();
  }
  req.flash('error', 'Access denied');
  res.redirect('/dashboard');
};

// Middleware to prevent authenticated users from accessing login pages
exports.forwardAuthenticated = (req, res, next) => {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect('/dashboard');
};