require('dotenv').config();

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
const desktopRoutes = require('./routes/desktop');
const feedbackRoutes = require('./routes/feedback');
const roadmapRoutes = require('./routes/roadmap');
const domainRoutes = require('./routes/domain');

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

// Middleware - CORS with custom domain support
const baseCorsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'];

// Dynamic CORS: include custom domain from database if configured
function getCorsOrigins() {
  try {
    const db = require('./db');
    const config = db.prepare('SELECT custom_domain FROM domain_config WHERE id = 1').get();
    if (config && config.custom_domain) {
      const domain = config.custom_domain;
      const extraOrigins = [
        `https://${domain}`,
        `https://www.${domain}`,
        `http://${domain}`,
        `http://www.${domain}`,
      ];
      return [...new Set([...baseCorsOrigins, ...extraOrigins])];
    }
  } catch (e) {
    // DB not ready yet, use base origins
  }
  return baseCorsOrigins;
}

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    const allowedOrigins = getCorsOrigins();
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
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
app.use('/api', feedbackRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/spotify', spotifyRoutes);
app.use('/api/desktop', desktopRoutes);
app.use('/api', roadmapRoutes);
app.use('/api/domain', domainRoutes);
app.use('/api', desktopRoutes); // Also mount at /api for /api/events/:eventId/now-playing and /api/events/:eventId/sync

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
