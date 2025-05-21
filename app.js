const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const morgan = require('morgan');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const flash = require('connect-flash');
const passport = require('passport');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const setupInitialAdmin = require('./utils/setupAdmin');
const { ErrorResponse } = require('./utils/errorResponse');
const { Delivery } = require('./models/Delivery');
const mongoose = require('mongoose');

// Load environment variables
dotenv.config();

// Database connection
const connectDB = require('./config/database');
connectDB().then(() => {
  // Setup initial admin after database connection
  setupInitialAdmin();
});

// Initialize app
const app = express();

// Passport config
require('./config/passport')(passport);

// Body Parser and Cookie Parser must come before CSRF
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// Method override for PUT and DELETE requests
app.use(methodOverride('_method'));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Add security middleware
app.use(helmet({
  contentSecurityPolicy: false // Disable for development
}));
app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// EJS setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// Static folder
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration - must be before CSRF
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'milk_delivery_secret',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGO_URI,
    touchAfter: 24 * 3600 // Only update session once per day
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict'
  },
  name: 'sessionId' // Change default session cookie name
};

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(session(sessionConfig));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// CSRF Protection after session
app.use(csrf({ cookie: true }));
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Global variables middleware
app.use((req, res, next) => {
  res.locals.user = req.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.title = 'Milk Distribution System'; // Add default title
  next();
});

// Add error logging middleware before error handler
app.use((req, res, next) => {
  console.log('Request URL:', req.url);
  console.log('Request Method:', req.method);
  console.log('User:', req.user ? req.user._id : 'Not logged in');
  next();
});

// Async error handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Routes with async error handling
app.use('/', asyncHandler(require('./routes/auth')));
app.use('/admin', asyncHandler(require('./routes/admin')));
app.use('/distributor', asyncHandler(require('./routes/distributor')));
app.use('/customer', asyncHandler(require('./routes/customer')));

// Dashboard redirects based on role
app.get('/dashboard', (req, res) => {
  if (!req.user) {
    return res.redirect('/login');
  }
  
  switch (req.user.role) {
    case 'admin':
      return res.redirect('/admin/dashboard');
    case 'distributor':
      return res.redirect('/distributor/dashboard');
    case 'customer':
      return res.redirect('/customer/dashboard');
    default:
      return res.redirect('/login');
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('errors/404', {
    title: '404 - Page Not Found'
  });
});

// Enhanced error handler
app.use((err, req, res, next) => {
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    user: req.user?._id
  });

  // Handle specific error types
  if (err.code === 'EBADCSRFTOKEN') {
    return handleCSRFError(err, req, res);
  }
  
  if (err.name === 'ValidationError') {
    return handleValidationError(err, req, res);
  }

  if (err.name === 'UnauthorizedError') {
    return handleAuthError(err, req, res);
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 
    ? 'Internal Server Error'
    : err.message;

  if (isAPIRequest(req)) {
    return res.status(statusCode).json({
      success: false,
      message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }

  res.status(statusCode).render(`errors/${statusCode}`, {
    title: `Error ${statusCode}`,
    message: process.env.NODE_ENV === 'development' ? err.message : message
  });
});

// Helper functions for error handling
function isAPIRequest(req) {
  return req.xhr || req.headers.accept?.includes('application/json');
}

function handleCSRFError(err, req, res) {
  const statusCode = 403;
  if (isAPIRequest(req)) {
    return res.status(statusCode).json({
      success: false,
      message: 'Invalid CSRF token'
    });
  }
  res.status(statusCode).render('errors/403', {
    title: 'Forbidden',
    message: 'Invalid security token'
  });
}

function handleValidationError(err, req, res) {
  const statusCode = 400;
  const message = Object.values(err.errors)
    .map(error => error.message)
    .join(', ');
    
  if (isAPIRequest(req)) {
    return res.status(statusCode).json({
      success: false,
      message,
      errors: err.errors
    });
  }
  res.status(statusCode).render('errors/400', {
    title: 'Validation Error',
    message
  });
}

function handleAuthError(err, req, res) {
  const statusCode = 401;
  if (isAPIRequest(req)) {
    return res.status(statusCode).json({
      success: false,
      message: 'Unauthorized access'
    });
  }
  res.redirect('/login');
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`));