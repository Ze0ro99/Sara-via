'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const PI_API_BASE =
  process.env.PI_API_BASE || 'https://api.minepi.com/v2';

const PI_API_KEY = process.env.PI_API_KEY || '';

/*
|--------------------------------------------------------------------------
| SARA VIA — Pi Network Testnet Backend
|--------------------------------------------------------------------------
| This server is responsible for:
| - Serving the SARA VIA web application
| - Verifying Pi user access tokens
| - Handling server-side payment approval
| - Handling server-side payment completion
|
| IMPORTANT:
| PI_API_KEY must NEVER be placed in frontend JavaScript.
|--------------------------------------------------------------------------
*/

app.disable('x-powered-by');

app.set('trust proxy', 1);

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
| Utility helpers
|--------------------------------------------------------------------------
*/

function isValidString(value, maxLength = 500) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function requirePiApiKey(res) {
  if (!PI_API_KEY) {
    res.status(503).json({
      success: false,
      error: 'Pi backend is not configured.',
      code: 'PI_API_KEY_MISSING'
    });

    return false;
  }

  return true;
}

async function readPiResponse(response) {
  const contentType =
    response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();

  return {
    message: text
  };
}

async function piRequest(endpoint, options = {}) {
  if (!PI_API_KEY) {
    throw new Error('PI_API_KEY is not configured.');
  }

  const response = await fetch(
    `${PI_API_BASE}${endpoint}`,
    {
      ...options,
      headers: {
        Authorization: `Key ${PI_API_KEY}`,
        Accept: 'application/json',
        ...(options.body
          ? {
              'Content-Type': 'application/json'
            }
          : {}),
        ...(options.headers || {})
      }
    }
  );

  const data = await readPiResponse(response);

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

/*
|--------------------------------------------------------------------------
| Health check
|--------------------------------------------------------------------------
*/

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    app: 'SARA VIA',
    environment: 'testnet',
    service: 'backend',
    status: 'online',
    timestamp: new Date().toISOString()
  });
});

/*
|--------------------------------------------------------------------------
| Public configuration
|--------------------------------------------------------------------------
|
| Never return PI_API_KEY here.
|
*/

app.get('/api/config', (req, res) => {
  res.status(200).json({
    success: true,
    app: 'SARA VIA',
    environment: 'testnet',
    pi: {
      sandbox: true
    }
  });
});

/*
|--------------------------------------------------------------------------
| Verify authenticated Pi user
|--------------------------------------------------------------------------
|
| Frontend sends:
|
| Authorization: Bearer <Pi access token>
|
| Backend verifies the token directly with Pi Platform API.
|--------------------------------------------------------------------------
*/

app.get('/api/auth/me', async (req, res) => {
  try {
    const authorization =
      req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Pi access token is required.',
        code: 'AUTH_TOKEN_MISSING'
      });
    }

    const accessToken =
      authorization.substring('Bearer '.length).trim();

    if (!isValidString(accessToken, 500)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Pi access token.',
        code: 'AUTH_TOKEN_INVALID'
      });
    }

    if (!PI_API_KEY) {
      return res.status(503).json({
        success: false,
        error: 'Pi backend is not configured.',
        code: 'PI_API_KEY_MISSING'
      });
    }

    const response = await fetch(
      `${PI_API_BASE}/me`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json'
        }
      }
    );

    const data = await readPiResponse(response);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: 'Pi authentication verification failed.',
        code: 'PI_AUTH_VERIFICATION_FAILED',
        details: data
      });
    }

    return res.status(200).json({
      success: true,
      user: data
    });
  } catch (error) {
    console.error(
      '[SARA VIA] Authentication error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: 'Unable to verify Pi authentication.',
      code: 'AUTH_SERVER_ERROR'
    });
  }
});

/*
|--------------------------------------------------------------------------
| Server-side payment approval
|--------------------------------------------------------------------------
|
| POST /api/payments/approve
|
| Body:
| {
|   "paymentId": "..."
| }
|
| Pi requires the backend to approve the payment before the
| Pioneer can submit the blockchain transaction.
|--------------------------------------------------------------------------
*/

app.post('/api/payments/approve', async (req, res) => {
  try {
    if (!requirePiApiKey(res)) {
      return;
    }

    const { paymentId } = req.body || {};

    if (!isValidString(paymentId, 200)) {
      return res.status(400).json({
        success: false,
        error: 'A valid paymentId is required.',
        code: 'PAYMENT_ID_MISSING'
      });
    }

    const result = await piRequest(
      `/payments/${encodeURIComponent(paymentId)}/approve`,
      {
        method: 'POST'
      }
    );

    console.log(
      `[SARA VIA] Payment approval: ${paymentId} -> ${result.status}`
    );

    return res.status(result.status).json({
      success: result.ok,
      data: result.data
    });
  } catch (error) {
    console.error(
      '[SARA VIA] Payment approval error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: 'Payment approval failed.',
      code: 'PAYMENT_APPROVAL_ERROR'
    });
  }
});

/*
|--------------------------------------------------------------------------
| Server-side payment completion
|--------------------------------------------------------------------------
|
| POST /api/payments/complete
|
| Body:
| {
|   "paymentId": "...",
|   "txid": "..."
| }
|
| The application should consider the payment completed only after
| Pi confirms successful server-side completion.
|--------------------------------------------------------------------------
*/

app.post('/api/payments/complete', async (req, res) => {
  try {
    if (!requirePiApiKey(res)) {
      return;
    }

    const {
      paymentId,
      txid
    } = req.body || {};

    if (!isValidString(paymentId, 200)) {
      return res.status(400).json({
        success: false,
        error: 'A valid paymentId is required.',
        code: 'PAYMENT_ID_MISSING'
      });
    }

    if (!isValidString(txid, 300)) {
      return res.status(400).json({
        success: false,
        error: 'A valid transaction ID is required.',
        code: 'TXID_MISSING'
      });
    }

    const result = await piRequest(
      `/payments/${encodeURIComponent(paymentId)}/complete`,
      {
        method: 'POST',
        body: JSON.stringify({
          txid
        })
      }
    );

    console.log(
      `[SARA VIA] Payment completion: ${paymentId} -> ${result.status}`
    );

    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        data: result.data
      });
    }

    /*
     * IMPORTANT:
     * Only after Pi confirms successful completion should
     * SARA VIA mark the order as paid / deliver the service.
     *
     * Database/order fulfillment will be connected here later.
     */

    return res.status(200).json({
      success: true,
      completed: true,
      data: result.data
    });
  } catch (error) {
    console.error(
      '[SARA VIA] Payment completion error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: 'Payment completion failed.',
      code: 'PAYMENT_COMPLETION_ERROR'
    });
  }
});

/*
|--------------------------------------------------------------------------
| Payment cancellation
|--------------------------------------------------------------------------
*/

app.post('/api/payments/cancel', async (req, res) => {
  try {
    if (!requirePiApiKey(res)) {
      return;
    }

    const { paymentId } = req.body || {};

    if (!isValidString(paymentId, 200)) {
      return res.status(400).json({
        success: false,
        error: 'A valid paymentId is required.',
        code: 'PAYMENT_ID_MISSING'
      });
    }

    const result = await piRequest(
      `/payments/${encodeURIComponent(paymentId)}/cancel`,
      {
        method: 'POST'
      }
    );

    console.log(
      `[SARA VIA] Payment cancellation: ${paymentId} -> ${result.status}`
    );

    return res.status(result.status).json({
      success: result.ok,
      data: result.data
    });
  } catch (error) {
    console.error(
      '[SARA VIA] Payment cancellation error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: 'Payment cancellation failed.',
      code: 'PAYMENT_CANCELLATION_ERROR'
    });
  }
});

/*
|--------------------------------------------------------------------------
| 404 handler
|--------------------------------------------------------------------------
*/

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'The requested resource was not found.',
    code: 'NOT_FOUND'
  });
});

/*
|--------------------------------------------------------------------------
| Global error handler
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
| Start server
|--------------------------------------------------------------------------
*/

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('        SARA VIA — TESTNET');
  console.log('        Backend Server');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Environment : TESTNET`);
  console.log(`Host        : ${HOST}`);
  console.log(`Port        : ${PORT}`);
  console.log(`Pi API      : ${PI_API_BASE}`);
  console.log(`API Key     : ${PI_API_KEY ? 'Configured' : 'NOT CONFIGURED'}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
