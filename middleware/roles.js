const roles = {
  admin: ['admin'],
  distributor: ['admin', 'distributor'],
  customer: ['admin', 'distributor', 'customer']
};

exports.checkRole = (role) => {
  return (req, res, next) => {
    if (!req.user) {
      req.flash('error_msg', 'Please log in to access this page');
      return res.redirect('/login');
    }

    if (!roles[role].includes(req.user.role)) {
      req.flash('error_msg', 'You are not authorized to access this page');
      return res.redirect('/dashboard');
    }
    next();
  };
};
