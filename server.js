'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const piAuthRouter = require('./routes/pi-auth');
const piPaymentsRouter = require('./routes/pi-payments');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const PI_API_BASE =
  process.env.PI_API_BASE || 'https://api.minepi.com/v2';

const PI_API_KEY =
  process.env.PI_API_KEY || '';

/*
|--------------------------------------------------------------------------
| SARA VIA
| Premium Web3 Travel Platform
| Pi Network TESTNET Backend
|--------------------------------------------------------------------------
*/

app.disable('x-powered-by');

app.set('trust proxy', 1);

/*
|--------------------------------------------------------------------------
| Security
|--------------------------------------------------------------------------
*/

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(
  express.json({
    limit: '100kb'
  })
);

app.use(
  express.urlencoded({
    extended: false,
    limit: '100kb'
  })
);

/*
|--------------------------------------------------------------------------
| Request logging
|--------------------------------------------------------------------------
*/

app.use((req, res, next) => {
  const started = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - started;

    console.log(
      `[SARA VIA] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });

  next();
});

/*
|--------------------------------------------------------------------------
| Root / API information
|--------------------------------------------------------------------------
*/

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    app: 'SARA VIA',
    environment: 'testnet',
    service: 'api',
    status: 'online',
    version: '1.0.0'
  });
});

/*
|--------------------------------------------------------------------------
| Health Check
|--------------------------------------------------------------------------
*/

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    app: 'SARA VIA',
    environment: 'testnet',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| Public configuration
|--------------------------------------------------------------------------
|
| NEVER expose PI_API_KEY here.
|--------------------------------------------------------------------------
*/

app.get('/api/config', (req, res) => {
  res.status(200).json({
    success: true,
    app: 'SARA VIA',
    environment: 'testnet',
    pi: {
      sandbox: true,
      apiConfigured: Boolean(PI_API_KEY)
    }
  });
});

/*
|--------------------------------------------------------------------------
| Pi Authentication
|--------------------------------------------------------------------------
|
| /api/auth/me
| /api/auth/status
|--------------------------------------------------------------------------
*/

app.use(
  '/api/auth',
  piAuthRouter
);

/*
|--------------------------------------------------------------------------
| Pi Payments
|--------------------------------------------------------------------------
|
| /api/payments/approve
| /api/payments/complete
| /api/payments/cancel
|--------------------------------------------------------------------------
*/

app.use(
  '/api/payments',
  piPaymentsRouter
);

/*
|--------------------------------------------------------------------------
| SARA VIA Website
|--------------------------------------------------------------------------
|
| Frontend files are served from the project root.
|--------------------------------------------------------------------------
*/

app.use(
  express.static(
    path.join(__dirname),
    {
      extensions: ['html'],
      index: 'index.html'
    }
  )
);

/*
|--------------------------------------------------------------------------
| Explicit homepage
|--------------------------------------------------------------------------
*/

app.get('/', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'index.html')
  );
});

/*
|--------------------------------------------------------------------------
| 404
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found.',
    code: 'NOT_FOUND'
  });
});

/*
|--------------------------------------------------------------------------
| Global Error Handler
|--------------------------------------------------------------------------
*/

app.use((error, req, res, next) => {
  console.error(
    '[SARA VIA] Unhandled server error:',
    error
  );

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    success: false,
    error: 'Internal server error.',
    code: 'INTERNAL_SERVER_ERROR'
  });
});

/*
|--------------------------------------------------------------------------
| Start Server
|--------------------------------------------------------------------------
*/

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('          SARA VIA');
  console.log('       WEB3 TRAVEL PLATFORM');
  console.log('          PI TESTNET');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Environment : TESTNET`);
  console.log(`Host        : ${HOST}`);
  console.log(`Port        : ${PORT}`);
  console.log(`Pi API      : ${PI_API_BASE}`);
  console.log(
    `Pi API Key  : ${PI_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED'}`
  );
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
