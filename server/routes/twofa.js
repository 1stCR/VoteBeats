const express = require('express');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/2fa/setup - Generate a new TOTP secret and QR code
router.post('/setup', authenticateToken, async (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA is already enabled. Disable it first to reconfigure.' });
    }

    // Generate a new secret
    const secret = speakeasy.generateSecret({
      name: `VoteBeats (${user.email})`,
      issuer: 'VoteBeats',
      length: 20,
    });

    // Store the secret temporarily (not enabled until verified)
    db.prepare('UPDATE users SET totp_secret = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(secret.base32, req.user.id);

    // Generate QR code as data URL
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauthUrl: secret.otpauth_url,
    });
  } catch (err) {
    console.error('2FA setup error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/2fa/verify - Verify a TOTP code and enable 2FA
router.post('/verify', authenticateToken, (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const user = db.prepare('SELECT id, totp_secret, totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.totp_secret) {
      return res.status(400).json({ error: 'No 2FA setup in progress. Please start setup first.' });
    }

    if (user.totp_enabled) {
      return res.status(400).json({ error: '2FA is already enabled.' });
    }

    // Verify the code
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: code,
      window: 2, // Allow 2 time steps tolerance (60 seconds)
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code. Please try again.' });
    }

    // Enable 2FA
    db.prepare('UPDATE users SET totp_enabled = 1, updated_at = datetime(\'now\') WHERE id = ?')
      .run(req.user.id);

    res.json({ message: '2FA has been enabled successfully.', enabled: true });
  } catch (err) {
    console.error('2FA verify error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/2fa/disable - Disable 2FA
router.post('/disable', authenticateToken, (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required to disable 2FA' });
    }

    const bcrypt = require('bcryptjs');
    const user = db.prepare('SELECT id, password_hash, totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.totp_enabled) {
      return res.status(400).json({ error: '2FA is not currently enabled.' });
    }

    // Verify password
    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password.' });
    }

    // Disable 2FA
    db.prepare('UPDATE users SET totp_enabled = 0, totp_secret = NULL, updated_at = datetime(\'now\') WHERE id = ?')
      .run(req.user.id);

    res.json({ message: '2FA has been disabled.', enabled: false });
  } catch (err) {
    console.error('2FA disable error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/2fa/status - Check if 2FA is enabled
router.get('/status', authenticateToken, (req, res) => {
  try {
    const user = db.prepare('SELECT totp_enabled FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ enabled: !!user.totp_enabled });
  } catch (err) {
    console.error('2FA status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/2fa/validate - Validate a TOTP code during login (unauthenticated, uses temp token)
router.post('/validate', (req, res) => {
  try {
    const { code, tempToken } = req.body;
    if (!code || !tempToken) {
      return res.status(400).json({ error: 'Code and temp token are required' });
    }

    // Decode the temp token to get user ID
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired temporary token' });
    }

    if (!decoded.requires2FA) {
      return res.status(400).json({ error: 'This token does not require 2FA validation' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user || !user.totp_enabled || !user.totp_secret) {
      return res.status(400).json({ error: 'Invalid 2FA state' });
    }

    // Verify TOTP code
    const verified = speakeasy.totp.verify({
      secret: user.totp_secret,
      encoding: 'base32',
      token: code,
      window: 2,
    });

    if (!verified) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    // Issue a full JWT token
    const { generateToken } = require('../middleware/auth');
    const token = generateToken(user);

    res.json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
      token,
    });
  } catch (err) {
    console.error('2FA validate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
