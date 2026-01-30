const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const requestRoutes = require('./routes/requests');
const songRoutes = require('./routes/songs');
const messageRoutes = require('./routes/messages');
const twofaRoutes = require('./routes/twofa');
const templateRoutes = require('./routes/templates');
const spotifyRoutes = require('./routes/spotify');

const app = express();
const PORT = process.env.PORT || 3002;

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 2000, // limit each IP to 2000 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // auth endpoints (includes /auth/me checks on every page load)
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', generalLimiter);
app.use('/api/auth', authLimiter);

// Middleware
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
  credentials: true,
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset']
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Routes - request routes MUST come before event routes
// because event routes use router.use(authenticateToken) globally,
// and request submission/voting are public (no auth required)
app.use('/api/auth', authRoutes);
app.use('/api/auth/2fa', twofaRoutes);
app.use('/api', requestRoutes);
app.use('/api', messageRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/spotify', spotifyRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`VoteBeats API server running on http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
