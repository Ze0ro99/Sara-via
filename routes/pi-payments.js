'use strict';

const express = require('express');

const router = express.Router();

/*
|--------------------------------------------------------------------------
| SARA VIA — PI NETWORK PAYMENT ENGINE
|--------------------------------------------------------------------------
|
| Environment:
|   TESTNET
|
| Payment direction:
|   USER -> APP
|
| Endpoints:
|   POST /api/payments/approve
|   POST /api/payments/complete
|   POST /api/payments/cancel
|   GET  /api/payments/:paymentId
|
| SECURITY:
|   - PI_API_KEY is SERVER-ONLY.
|   - Never expose PI_API_KEY to frontend.
|   - Never put wallet passphrase/private key here.
|   - Payment data is verified against Pi Platform API.
|
|--------------------------------------------------------------------------
*/

const PI_API_BASE =
  process.env.PI_API_BASE ||
  'https://api.minepi.com/v2';

const PI_API_KEY =
  process.env.PI_API_KEY ||
  '';

const PI_WALLET_ADDRESS =
  process.env.PI_WALLET_ADDRESS ||
  '';

const APP_ENV =
  process.env.APP_ENV ||
  'testnet';

/*
|--------------------------------------------------------------------------
| Security helpers
|--------------------------------------------------------------------------
*/

function isValidString(value, maxLength = 500) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isValidPaymentId(value) {
  return isValidString(value, 200);
}

function isValidTxid(value) {
  return isValidString(value, 300);
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

/*
|--------------------------------------------------------------------------
| Pi API response parser
|--------------------------------------------------------------------------
*/

async function parsePiResponse(response) {
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

/*
|--------------------------------------------------------------------------
| Generic Pi Platform API caller
|--------------------------------------------------------------------------
*/

async function callPiApi(
  endpoint,
  method = 'GET',
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
    headers['Content-Type'] =
      'application/json';

    options.body =
      JSON.stringify(body);
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
| Verify payment belongs to SARA VIA
|--------------------------------------------------------------------------
|
| Pi PaymentDTO contains:
|
|   identifier
|   user_uid
|   amount
|   memo
|   metadata
|   from_address
|   to_address
|   direction
|   network
|   status
|   transaction
|
| We verify the critical payment properties before
| allowing the payment lifecycle to continue.
|
|--------------------------------------------------------------------------
*/

function verifyPaymentForSaraVia(payment) {
  if (!payment || typeof payment !== 'object') {
    return {
      valid: false,
      code: 'PAYMENT_DATA_INVALID',
      message: 'Pi payment data is invalid.'
    };
  }

  /*
   * Payment must be User -> App.
   */
  if (payment.direction !== 'user_to_app') {
    return {
      valid: false,
      code: 'INVALID_PAYMENT_DIRECTION',
      message:
        'Payment direction is not user_to_app.'
    };
  }

  /*
   * If our public wallet address is configured,
   * verify Pi's recipient address against it.
   *
   * This prevents a payment intended for another
   * destination from being treated as a SARA VIA payment.
   */
  if (
    PI_WALLET_ADDRESS &&
    payment.to_address !== PI_WALLET_ADDRESS
  ) {
    return {
      valid: false,
      code: 'INVALID_PAYMENT_RECIPIENT',
      message:
        'Payment recipient does not match the SARA VIA wallet.'
    };
  }

  /*
   * For Testnet we expect Pi Testnet.
   *
   * This prevents accidentally accepting a payment
   * from the wrong network.
   */
  if (
    APP_ENV === 'testnet' &&
    payment.network &&
    payment.network !== 'Pi Testnet'
  ) {
    return {
      valid: false,
      code: 'INVALID_PAYMENT_NETWORK',
      message:
        'Payment network does not match SARA VIA Testnet.'
    };
  }

  return {
    valid: true
  };
}

/*
|--------------------------------------------------------------------------
| Fetch payment from Pi and verify it
|--------------------------------------------------------------------------
*/

async function getAndVerifyPayment(
  paymentId
) {
  const result = await callPiApi(
    `/payments/${encodeURIComponent(paymentId)}`,
    'GET'
  );

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      payment: null,
      error: {
        code: 'PI_PAYMENT_LOOKUP_FAILED',
        message:
          'Unable to verify the payment with Pi Network.',
        details: result.data
      }
    };
  }

  const verification =
    verifyPaymentForSaraVia(
      result.data
    );

  if (!verification.valid) {
    return {
      ok: false,
      status: 400,
      payment: result.data,
      error: verification
    };
  }

  return {
    ok: true,
    status: 200,
    payment: result.data,
    error: null
  };
}

/*
|--------------------------------------------------------------------------
| Optional user-token verification
|--------------------------------------------------------------------------
|
| Normal frontend payment requests can provide:
|
| Authorization: Bearer <Pi access token>
|
| We verify that token through Pi /me.
|
| IMPORTANT:
| Incomplete-payment recovery may happen before
| Pi.authenticate() returns the access token.
|
| Therefore incomplete recovery relies on payment
| verification instead of requiring a Bearer token.
|--------------------------------------------------------------------------
*/

async function verifyUserAccessToken(
  authorization
) {
  if (
    typeof authorization !== 'string' ||
    !authorization.startsWith('Bearer ')
  ) {
    return {
      ok: false,
      status: 401,
      user: null
    };
  }

  const accessToken =
    authorization
      .slice('Bearer '.length)
      .trim();

  if (!isValidString(accessToken, 2000)) {
    return {
      ok: false,
      status: 401,
      user: null
    };
  }

  try {
    const response =
      await fetch(
        `${PI_API_BASE}/me`,
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            Accept:
              'application/json'
          }
        }
      );

    const data =
      await parsePiResponse(
        response
      );

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        user: null
      };
    }

    return {
      ok: true,
      status: 200,
      user: data
    };
  } catch (error) {
    console.error(
      '[SARA VIA] Pi user verification error:',
      error
    );

    return {
      ok: false,
      status: 503,
      user: null
    };
  }
}

/*
|--------------------------------------------------------------------------
| APPROVE
|--------------------------------------------------------------------------
|
| POST /api/payments/approve
|
| Body:
|
| {
|   "paymentId": "..."
| }
|
|--------------------------------------------------------------------------
*/

router.post(
  '/approve',
  async (req, res) => {
    try {
      if (!requireApiKey(res)) {
        return;
      }

      const {
        paymentId
      } = req.body || {};

      if (!isValidPaymentId(paymentId)) {
        return res.status(400).json({
          success: false,
          error:
            'Valid paymentId is required.',
          code:
            'INVALID_PAYMENT_ID'
        });
      }

      /*
       * Verify the authenticated Pi user.
       *
       * This protects the normal frontend payment
       * approval route.
       */
      const auth =
        await verifyUserAccessToken(
          req.headers.authorization
        );

      if (!auth.ok) {
        return res.status(
          auth.status
        ).json({
          success: false,
          error:
            'Valid Pi user authentication is required.',
          code:
            'PI_USER_AUTH_REQUIRED'
        });
      }

      /*
       * Retrieve the real payment from Pi.
       */
      const verification =
        await getAndVerifyPayment(
          paymentId
        );

      if (!verification.ok) {
        return res.status(
          verification.status
        ).json({
          success: false,
          error:
            verification.error.message,
          code:
            verification.error.code
        });
      }

      const payment =
        verification.payment;

      /*
       * Make sure the payment belongs to
       * the authenticated Pi user.
       *
       * Pi's UserDTO contains uid.
       */
      if (
        auth.user?.uid &&
        payment.user_uid &&
        auth.user.uid !== payment.user_uid
      ) {
        return res.status(403).json({
          success: false,
          error:
            'Payment does not belong to the authenticated Pi user.',
          code:
            'PAYMENT_USER_MISMATCH'
        });
      }

      /*
       * Do not approve an already cancelled payment.
       */
      if (
        payment.status?.cancelled ||
        payment.status?.user_cancelled
      ) {
        return res.status(409).json({
          success: false,
          error:
            'This payment has already been cancelled.',
          code:
            'PAYMENT_ALREADY_CANCELLED'
        });
      }

      /*
       * Idempotency:
       * If Pi already reports developer approval,
       * do not send another approval request.
       */
      if (
        payment.status?.developer_approved
      ) {
        return res.status(200).json({
          success: true,
          approved: true,
          alreadyApproved: true,
          paymentId,
          data: payment
        });
      }

      /*
       * Ask Pi to approve the payment.
       */
      const result =
        await callPiApi(
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
          approved: result.ok,
          paymentId,
          data: result.data
        });
    } catch (error) {
      console.error(
        '[SARA VIA] Approve error:',
        error
      );

      return res.status(500).json({
        success: false,
        approved: false,
        error:
          'Unable to approve Pi payment.',
        code:
          'PAYMENT_APPROVE_ERROR'
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| COMPLETE
|--------------------------------------------------------------------------
|
| POST /api/payments/complete
|
| Body:
|
| {
|   "paymentId": "...",
|   "txid": "..."
| }
|
|--------------------------------------------------------------------------
*/

router.post(
  '/complete',
  async (req, res) => {
    try {
      if (!requireApiKey(res)) {
        return;
      }

      const {
        paymentId,
        txid
      } = req.body || {};

      if (!isValidPaymentId(paymentId)) {
        return res.status(400).json({
          success: false,
          completed: false,
          error:
            'Valid paymentId is required.',
          code:
            'INVALID_PAYMENT_ID'
        });
      }

      if (!isValidTxid(txid)) {
        return res.status(400).json({
          success: false,
          completed: false,
          error:
            'Valid transaction ID is required.',
          code:
            'INVALID_TXID'
        });
      }

      /*
       * IMPORTANT:
       *
       * This route can also be reached by the
       * incomplete-payment recovery callback.
       *
       * Therefore we DO NOT require a Bearer token here.
       *
       * Instead, the payment itself is retrieved
       * directly from Pi and verified below.
       */

      const verification =
        await getAndVerifyPayment(
          paymentId
        );

      if (!verification.ok) {
        return res.status(
          verification.status
        ).json({
          success: false,
          completed: false,
          error:
            verification.error.message,
          code:
            verification.error.code
        });
      }

      const payment =
        verification.payment;

      /*
       * Prevent a cancelled payment from being completed.
       */
      if (
        payment.status?.cancelled ||
        payment.status?.user_cancelled
      ) {
        return res.status(409).json({
          success: false,
          completed: false,
          error:
            'This payment has been cancelled.',
          code:
            'PAYMENT_ALREADY_CANCELLED'
        });
      }

      /*
       * If the payment is already completed,
       * return success without duplicating fulfillment.
       */
      if (
        payment.status?.developer_completed
      ) {
        return res.status(200).json({
          success: true,
          completed: true,
          alreadyCompleted: true,
          paymentId,
          txid:
            payment.transaction?.txid ||
            txid,
          data: payment
        });
      }

      /*
       * If Pi already has a blockchain transaction,
       * make sure the txid supplied by the frontend
       * agrees with Pi's transaction.
       */
      if (
        payment.transaction?.txid &&
        payment.transaction.txid !== txid
      ) {
        return res.status(409).json({
          success: false,
          completed: false,
          error:
            'Transaction ID does not match the Pi payment.',
          code:
            'TXID_MISMATCH'
        });
      }

      /*
       * Server-side completion.
       */
      const result =
        await callPiApi(
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
            paymentId,
            txid,
            data: result.data
          });
      }

      /*
       * IMPORTANT:
       *
       * Pi has now confirmed server-side completion.
       *
       * This is the correct point to connect:
       *
       * 1. Order database
       * 2. Booking record
       * 3. Payment record
       * 4. Invoice
       * 5. Travel confirmation
       * 6. Duplicate-payment protection
       *
       * We intentionally do NOT pretend a booking
       * exists until the SARA VIA database is connected.
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
        error:
          'Unable to complete Pi payment.',
        code:
          'PAYMENT_COMPLETE_ERROR'
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CANCEL
|--------------------------------------------------------------------------
|
| POST /api/payments/cancel
|
| Body:
|
| {
|   "paymentId": "..."
| }
|
|--------------------------------------------------------------------------
*/

router.post(
  '/cancel',
  async (req, res) => {
    try {
      if (!requireApiKey(res)) {
        return;
      }

      const {
        paymentId
      } = req.body || {};

      if (!isValidPaymentId(paymentId)) {
        return res.status(400).json({
          success: false,
          error:
            'Valid paymentId is required.',
          code:
            'INVALID_PAYMENT_ID'
        });
      }

      /*
       * Authenticate normal cancellation requests.
       */
      const auth =
        await verifyUserAccessToken(
          req.headers.authorization
        );

      if (!auth.ok) {
        return res.status(
          auth.status
        ).json({
          success: false,
          error:
            'Valid Pi user authentication is required.',
          code:
            'PI_USER_AUTH_REQUIRED'
        });
      }

      /*
       * Verify the real payment first.
       */
      const verification =
        await getAndVerifyPayment(
          paymentId
        );

      if (!verification.ok) {
        return res.status(
          verification.status
        ).json({
          success: false,
          error:
            verification.error.message,
          code:
            verification.error.code
        });
      }

      const payment =
        verification.payment;

      /*
       * Make sure the payment belongs
       * to the authenticated user.
       */
      if (
        auth.user?.uid &&
        payment.user_uid &&
        auth.user.uid !== payment.user_uid
      ) {
        return res.status(403).json({
          success: false,
          error:
            'Payment does not belong to the authenticated Pi user.',
          code:
            'PAYMENT_USER_MISMATCH'
        });
      }

      /*
       * Do not cancel an already completed payment.
       */
      if (
        payment.status?.developer_completed
      ) {
        return res.status(409).json({
          success: false,
          error:
            'A completed payment cannot be cancelled.',
          code:
            'PAYMENT_ALREADY_COMPLETED'
        });
      }

      /*
       * Idempotent cancellation.
       */
      if (
        payment.status?.cancelled ||
        payment.status?.user_cancelled
      ) {
        return res.status(200).json({
          success: true,
          cancelled: true,
          alreadyCancelled: true,
          paymentId,
          data: payment
        });
      }

      const result =
        await callPiApi(
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
          cancelled: result.ok,
          paymentId,
          data: result.data
        });
    } catch (error) {
      console.error(
        '[SARA VIA] Cancel error:',
        error
      );

      return res.status(500).json({
        success: false,
        cancelled: false,
        error:
          'Unable to cancel Pi payment.',
        code:
          'PAYMENT_CANCEL_ERROR'
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| GET PAYMENT
|--------------------------------------------------------------------------
|
| GET /api/payments/:paymentId
|
| Useful for:
|   - diagnostics
|   - payment verification
|   - support
|
| The Server API Key remains server-side.
|--------------------------------------------------------------------------
*/

router.get(
  '/:paymentId',
  async (req, res) => {
    try {
      if (!requireApiKey(res)) {
        return;
      }

      const {
        paymentId
      } = req.params;

      if (!isValidPaymentId(paymentId)) {
        return res.status(400).json({
          success: false,
          error:
            'Valid paymentId is required.',
          code:
            'INVALID_PAYMENT_ID'
        });
      }

      const verification =
        await getAndVerifyPayment(
          paymentId
        );

      if (!verification.ok) {
        return res.status(
          verification.status
        ).json({
          success: false,
          error:
            verification.error.message,
          code:
            verification.error.code
        });
      }

      return res.status(200).json({
        success: true,
        paymentId,
        payment:
          verification.payment
      });
    } catch (error) {
      console.error(
        '[SARA VIA] Payment lookup error:',
        error
      );

      return res.status(500).json({
        success: false,
        error:
          'Unable to retrieve Pi payment.',
        code:
          'PAYMENT_LOOKUP_ERROR'
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| SERVICE STATUS
|--------------------------------------------------------------------------
*/

router.get(
  '/status/service',
  (req, res) => {
    res.status(200).json({
      success: true,
      service:
        'SARA VIA Pi Payment Engine',
      environment:
        APP_ENV,
      network:
        APP_ENV === 'testnet'
          ? 'Pi Testnet'
          : 'Pi Network',
      apiConfigured:
        Boolean(PI_API_KEY),
      walletConfigured:
        Boolean(PI_WALLET_ADDRESS),
      status:
        'online'
    });
  }
);

module.exports = router;
