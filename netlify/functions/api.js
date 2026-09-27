'use strict';

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const serverless = require('serverless-http');

const piAuthRouter = require('../../routes/pi-auth');
const piPaymentsRouter = require('../../routes/pi-payments');

const app = express();

app.disable('x-powered-by');

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

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false }));

app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    app: 'SARA VIA',
    environment: 'testnet',
    service: 'api',
    status: 'online'
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    app: 'SARA VIA',
    environment: 'testnet',
    status: 'online'
  });
});

app.use('/api/auth', piAuthRouter);
app.use('/api/payments', piPaymentsRouter);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Resource not found.',
    code: 'NOT_FOUND'
  });
});

module.exports.handler = serverless(app);
