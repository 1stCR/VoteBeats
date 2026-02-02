const jwt = require('jsonwebtoken');

const DEFAULT_DEV_SECRET = 'votebeats-dev-secret-key-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;

// Warn if using default secret in production
if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_DEV_SECRET) {
  console.error('SECURITY WARNING: Using default JWT secret in production! Set JWT_SECRET environment variable.');
  process.exit(1);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Authentication required', message: 'No token provided' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token', message: 'Token is invalid or expired' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
  } catch (err) {
    req.user = null;
  }
  next();
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, displayName: user.display_name },
    JWT_SECRET,
    { expiresIn: '30d' }  // Extended from 7d to 30d for better user experience
  );
}

module.exports = { authenticateToken, optionalAuth, generateToken, JWT_SECRET };
