const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const User = require('../models/User');

module.exports = function() {
  // Local Strategy for username/password authentication
  passport.use(new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password'
    },
    async (email, password, done) => {
      try {
        // Find user by email
        const user = await User.findOne({ email });
        
        // If user not found
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Check password
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // If credentials are valid, return the user object
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  ));
  
  // Serialize user for the session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });
};