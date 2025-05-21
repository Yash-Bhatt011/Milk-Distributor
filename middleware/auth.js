const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Export all middleware functions together
module.exports = {
    // Authentication check
    isAuthenticated: (req, res, next) => {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash('error_msg', 'Please log in to access this page');
        res.redirect('/login');
    },

    ensureAuthenticated: (req, res, next) => {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash('error_msg', 'Please log in to access this resource');
        res.redirect('/login');
    },

    // Role-based middleware
    isAdmin: (req, res, next) => {
        if (req.isAuthenticated() && req.user.role === 'admin') {
            return next();
        }
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    },

    isDistributor: (req, res, next) => {
        if (req.isAuthenticated() && req.user.role === 'distributor') {
            return next();
        }
        req.flash('error', 'Access denied');
        res.redirect('/dashboard');
    },

    ensureDistributor: (req, res, next) => {
        if (req.isAuthenticated() && req.user.role === 'distributor') {
            return next();
        }
        req.flash('error_msg', 'Access denied. Distributors only.');
        res.redirect('/login');
    },

    isCustomer: (req, res, next) => {
        if (req.isAuthenticated() && req.user.role === 'customer') {
            return next();
        }
        req.flash('error_msg', 'Please log in as a customer to access this resource');
        res.redirect('/login');
    },

    // Prevent authenticated users from accessing login pages
    forwardAuthenticated: (req, res, next) => {
        if (!req.isAuthenticated()) {
            return next();
        }
        res.redirect('/dashboard');
    }
};