const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { requireAuth } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/error');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const toiletRoutes = require('./routes/toilets');
const homeRoutes = require('./routes/home');
const bookingRoutes = require('./routes/bookings');
const paymentRoutes = require('./routes/payments');
const earningsRoutes = require('./routes/earnings');
const reviewRoutes = require('./routes/reviews');
const notificationRoutes = require('./routes/notifications');

const createApp = () => {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use(morgan('dev'));

  app.get('/', (_req, res) => {
    res.type('html').send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PNP Backend</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; min-height: 100vh; display: grid; place-items: center; }
      main { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 32px; max-width: 420px; }
      h1 { margin: 0 0 8px; font-size: 28px; }
      p { margin: 0 0 16px; color: #94a3b8; line-height: 1.5; }
      code { background: #0f172a; padding: 2px 6px; border-radius: 6px; color: #38bdf8; }
    </style>
  </head>
  <body>
    <main>
      <h1>Welcome to PNP</h1>
      <p>Backend is running. Use this page to confirm the API is up.</p>
      <p>OTP login is ready. Demo code: <code>123456</code></p>
      <p>Health: <code>/health</code> · API: <code>/api</code></p>
    </main>
  </body>
</html>`);
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'pnp-backend', message: 'Welcome to PNP. Backend is running.' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/profile', requireAuth, profileRoutes);
  app.use('/api/home', requireAuth, homeRoutes);
  app.use('/api/toilets', requireAuth, toiletRoutes);
  app.use('/api/bookings', requireAuth, bookingRoutes);
  app.use('/api/payments', requireAuth, paymentRoutes);
  app.use('/api/earnings', requireAuth, earningsRoutes);
  app.use('/api/reviews', requireAuth, reviewRoutes);
  app.use('/api/notifications', requireAuth, notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
};

module.exports = { createApp };
