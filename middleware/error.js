const ErrorResponse = require('../utils/errorResponse');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', {
    name: err.name,
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path,
    method: req.method,
    body: req.body
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    error = new ErrorResponse('Resource not found', 404);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    error = new ErrorResponse('Duplicate field value entered', 400);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = new ErrorResponse(message, 400);
  }

  // Handle different request types
  if (req.xhr || req.headers.accept.includes('application/json')) {
    // API response
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Server Error'
    });
  }

  // Render error page for regular requests
  res.status(error.statusCode || 500).render('errors/500', {
    title: 'Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
};

module.exports = errorHandler;
