'use strict';

const express = require('express');

const router = express.Router();

const PI_API_BASE =
  process.env.PI_API_BASE || 'https://api.minepi.com/v2';

const PI_API_KEY =
  process.env.PI_API_KEY || '';

/*
|--------------------------------------------------------------------------
| SARA VIA — Pi Payments
|--------------------------------------------------------------------------
| Handles:
|   POST /api/payments/approve
|   POST /api/payments/complete
|   POST /api/payments/cancel
|
| The Server API Key NEVER goes to the frontend.
|--------------------------------------------------------------------------
*/

function isValidId(value, maxLength = 200) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function requireApiKey(res) {
  if (!PI_API_KEY) {
    res.status(503).json({
      success: false,
      error: 'Pi Server API Key is not configured.',
      code: 'PI_API_KEY_MISSING'
    });

    return false;
  }

  return true;
}

async function parsePiResponse(response) {
  const contentType =
    response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  return {
    message: await response.text()
  };
}

async function callPiApi(
  endpoint,
  method = 'POST',
  body = null
) {
  const headers = {
    Authorization: `Key ${PI_API_KEY}`,
    Accept: 'application/json'
  };

  const options = {
    method,
    headers
  };

  if (body !== null) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(
    `${PI_API_BASE}${endpoint}`,
    options
  );

  const data =
    await parsePiResponse(response);

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

/*
|--------------------------------------------------------------------------
| APPROVE
|--------------------------------------------------------------------------
|
| POST /api/payments/approve
|
| Body:
| {
|   "paymentId": "..."
| }
|--------------------------------------------------------------------------
*/

router.post('/approve', async (req, res) => {
  try {
    if (!requireApiKey(res)) {
      return;
    }

    const {
      paymentId
    } = req.body || {};

    if (!isValidId(paymentId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid paymentId is required.',
        code: 'INVALID_PAYMENT_ID'
      });
    }

    const result = await callPiApi(
      `/payments/${encodeURIComponent(paymentId)}/approve`,
      'POST'
    );

    console.log(
      `[SARA VIA] APPROVE ${paymentId} -> ${result.status}`
    );

    return res
      .status(result.status)
      .json({
        success: result.ok,
        data: result.data
      });
  } catch (error) {
    console.error(
      '[SARA VIA] Approve error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: 'Unable to approve Pi payment.',
      code: 'PAYMENT_APPROVE_ERROR'
    });
  }
});

/*
|--------------------------------------------------------------------------
| COMPLETE
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
| The order must NOT be marked as paid until Pi confirms
| successful completion.
|--------------------------------------------------------------------------
*/

router.post('/complete', async (req, res) => {
  try {
    if (!requireApiKey(res)) {
      return;
    }

    const {
      paymentId,
      txid
    } = req.body || {};

    if (!isValidId(paymentId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid paymentId is required.',
        code: 'INVALID_PAYMENT_ID'
      });
    }

    if (!isValidId(txid, 300)) {
      return res.status(400).json({
        success: false,
        error: 'Valid transaction ID is required.',
        code: 'INVALID_TXID'
      });
    }

    const result = await callPiApi(
      `/payments/${encodeURIComponent(paymentId)}/complete`,
      'POST',
      {
        txid
      }
    );

    console.log(
      `[SARA VIA] COMPLETE ${paymentId} -> ${result.status}`
    );

    if (!result.ok) {
      return res
        .status(result.status)
        .json({
          success: false,
          completed: false,
          data: result.data
        });
    }

    /*
     * IMPORTANT:
     *
     * This is where SARA VIA will later:
     * 1. Verify/store the completed payment.
     * 2. Mark the booking as paid.
     * 3. Generate the booking confirmation.
     * 4. Prevent duplicate fulfillment.
     *
     * We do NOT grant a booking here until the
     * database/order system is connected.
     */

    return res.status(200).json({
      success: true,
      completed: true,
      paymentId,
      txid,
      data: result.data
    });
  } catch (error) {
    console.error(
      '[SARA VIA] Complete error:',
      error
    );

    return res.status(500).json({
      success: false,
      completed: false,
      error: 'Unable to complete Pi payment.',
      code: 'PAYMENT_COMPLETE_ERROR'
    });
  }
});

/*
|--------------------------------------------------------------------------
| CANCEL
|--------------------------------------------------------------------------
|
| POST /api/payments/cancel
|
| Body:
| {
|   "paymentId": "..."
| }
|--------------------------------------------------------------------------
*/

router.post('/cancel', async (req, res) => {
  try {
    if (!requireApiKey(res)) {
      return;
    }

    const {
      paymentId
    } = req.body || {};

    if (!isValidId(paymentId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid paymentId is required.',
        code: 'INVALID_PAYMENT_ID'
      });
    }

    const result = await callPiApi(
      `/payments/${encodeURIComponent(paymentId)}/cancel`,
      'POST'
    );

    console.log(
      `[SARA VIA] CANCEL ${paymentId} -> ${result.status}`
    );

    return res
      .status(result.status)
      .json({
        success: result.ok,
        data: result.data
      });
  } catch (error) {
    console.error(
      '[SARA VIA] Cancel error:',
      error
    );

    return res.status(500).json({
      success: false,
      error: 'Unable to cancel Pi payment.',
      code: 'PAYMENT_CANCEL_ERROR'
    });
  }
});

module.exports = router;
