const User = require('../models/User');

const setupInitialAdmin = async () => {
  try {
    // Check if admin exists
    const adminExists = await User.findOne({ role: 'admin' });
    if (adminExists) {
      console.log('Admin already exists');
      return;
    }

    // Create initial admin
    const admin = new User({
      name: process.env.ADMIN_NAME,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      phone: process.env.ADMIN_PHONE,
      role: 'admin',
      address: {}
    });

    await admin.save();
    console.log('Initial admin account created successfully');
  } catch (err) {
    console.error('Error creating initial admin:', err);
  }
};

module.exports = setupInitialAdmin;
