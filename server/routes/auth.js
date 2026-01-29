const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const { sanitizeString } = require('../utils/sanitize');

const router = express.Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Sanitize user input
    const cleanDisplayName = sanitizeString(displayName);

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const passwordHash = bcrypt.hashSync(password, 10);

    db.prepare('INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)')
      .run(id, email, passwordHash, cleanDisplayName);

    const user = { id, email, display_name: cleanDisplayName };
    const token = generateToken(user);

    res.status(201).json({
      user: { id, email, displayName: cleanDisplayName },
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password, totpCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if 2FA is enabled
    if (user.totp_enabled && user.totp_secret) {
      // If no TOTP code provided, return a temp token indicating 2FA is required
      if (!totpCode) {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/auth');
        const tempToken = jwt.sign(
          { id: user.id, email: user.email, requires2FA: true },
          JWT_SECRET,
          { expiresIn: '5m' }
        );
        return res.json({
          requires2FA: true,
          tempToken
        });
      }

      // Verify TOTP code
      const speakeasy = require('speakeasy');
      const verified = speakeasy.totp.verify({
        secret: user.totp_secret,
        encoding: 'base32',
        token: totpCode,
        window: 2,
      });

      if (!verified) {
        return res.status(401).json({ error: 'Invalid 2FA code' });
      }
    }

    const token = generateToken(user);

    res.json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // JWT is stateless, client just discards the token
  res.json({ message: 'Logged out successfully' });
});


// POST /api/auth/forgot-password
router.post('/forgot-password', (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Always return success to prevent email enumeration
    // In production, this would send a reset email if the user exists
    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me - Get current user info
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, email, display_name, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ id: user.id, email: user.email, displayName: user.display_name, createdAt: user.created_at });
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { displayName } = req.body;
    if (!displayName) {
      return res.status(400).json({ error: 'Display name is required' });
    }

    const cleanDisplayName = sanitizeString(displayName);

    db.prepare('UPDATE users SET display_name = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(cleanDisplayName, req.user.id);

    res.json({ id: req.user.id, email: req.user.email, displayName: cleanDisplayName });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET /api/auth/notification-preferences
router.get('/notification-preferences', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT notification_preferences FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const prefs = JSON.parse(user.notification_preferences || '{}');
    // Return with defaults
    res.json({
      newRequests: prefs.newRequests !== undefined ? prefs.newRequests : true,
      requestVotes: prefs.requestVotes !== undefined ? prefs.requestVotes : true,
      eventReminders: prefs.eventReminders !== undefined ? prefs.eventReminders : true,
      attendeeMessages: prefs.attendeeMessages !== undefined ? prefs.attendeeMessages : true,
      weeklyDigest: prefs.weeklyDigest !== undefined ? prefs.weeklyDigest : false,
      soundAlerts: prefs.soundAlerts !== undefined ? prefs.soundAlerts : true,
    });
  } catch (err) {
    console.error('Get notification preferences error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/notification-preferences
router.put('/notification-preferences', authenticateToken, (req, res) => {
  try {
    const prefs = req.body;
    const sanitized = {
      newRequests: !!prefs.newRequests,
      requestVotes: !!prefs.requestVotes,
      eventReminders: !!prefs.eventReminders,
      attendeeMessages: !!prefs.attendeeMessages,
      weeklyDigest: !!prefs.weeklyDigest,
      soundAlerts: !!prefs.soundAlerts,
    };
    db.prepare("UPDATE users SET notification_preferences = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(sanitized), req.user.id);
    res.json(sanitized);
  } catch (err) {
    console.error('Update notification preferences error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// GET /api/auth/default-event-settings
router.get('/default-event-settings', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT default_event_settings FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const defaults = JSON.parse(user.default_event_settings || '{}');
    res.json({
      blockExplicit: defaults.blockExplicit !== undefined ? defaults.blockExplicit : false,
      votingEnabled: defaults.votingEnabled !== undefined ? defaults.votingEnabled : true,
      requestsOpen: defaults.requestsOpen !== undefined ? defaults.requestsOpen : true,
      maxRequestsPerUser: defaults.maxRequestsPerUser || 0,
      autoApprove: defaults.autoApprove !== undefined ? defaults.autoApprove : false,
    });
  } catch (err) {
    console.error('Get default event settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/auth/default-event-settings
router.put('/default-event-settings', authenticateToken, (req, res) => {
  try {
    const settings = {
      blockExplicit: !!req.body.blockExplicit,
      votingEnabled: req.body.votingEnabled !== false,
      requestsOpen: req.body.requestsOpen !== false,
      maxRequestsPerUser: parseInt(req.body.maxRequestsPerUser) || 0,
      autoApprove: !!req.body.autoApprove,
    };
    db.prepare("UPDATE users SET default_event_settings = ?, updated_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(settings), req.user.id);
    res.json(settings);
  } catch (err) {
    console.error('Update default event settings error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
