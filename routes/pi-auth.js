'use strict';

const express = require('express');

const router = express.Router();

const PI_API_BASE =
  process.env.PI_API_BASE || 'https://api.minepi.com/v2';

/*
|--------------------------------------------------------------------------
| SARA VIA — Pi Authentication Routes
|--------------------------------------------------------------------------
| This route verifies the Pi access token received from the frontend.
|
| IMPORTANT:
| The user's Pi access token is sent to Pi's API for verification.
| Never store the token in a public file or expose server secrets.
|--------------------------------------------------------------------------
*/

function isValidString(value, maxLength = 500) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

async function readResponse(response) {
  const contentType =
    response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return {
    message: await response.text()
  };
}

/*
|--------------------------------------------------------------------------
| GET /api/auth/me
|--------------------------------------------------------------------------
| Verifies:
|
| Authorization: Bearer <PI_ACCESS_TOKEN>
|--------------------------------------------------------------------------
*/

router.get('/me', async (req, res) => {
  try {
    const authorization =
      req.headers.authorization || '';

    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: 'Pi access token is required.',
        code: 'AUTH_TOKEN_MISSING'
      });
    }

    const accessToken =
      authorization
        .slice('Bearer '.length)
        .trim();

    if (!isValidString(accessToken)) {
      return res.status(401).json({
        success: false,
        authenticated: false,
        error: 'Invalid Pi access token.',
        code: 'AUTH_TOKEN_INVALID'
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

    const data = await readResponse(response);

    if (!response.ok) {
      console.error(
        '[SARA VIA] Pi authentication rejected:',
        response.status
      );

      return res.status(response.status).json({
        success: false,
        authenticated: false,
        error: 'Pi authentication could not be verified.',
        code: 'PI_AUTH_REJECTED'
      });
    }

    return res.status(200).json({
      success: true,
      authenticated: true,
      user: data
    });
  } catch (error) {
    console.error(
      '[SARA VIA] Pi authentication error:',
      error
    );

    return res.status(500).json({
      success: false,
      authenticated: false,
      error: 'Authentication service temporarily unavailable.',
      code: 'AUTH_SERVICE_ERROR'
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET /api/auth/status
|--------------------------------------------------------------------------
| Simple backend status endpoint.
|--------------------------------------------------------------------------
*/

router.get('/status', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'SARA VIA Pi Authentication',
    environment: 'testnet',
    status: 'online'
  });
});

module.exports = router;
