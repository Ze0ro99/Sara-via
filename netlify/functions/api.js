'use strict';

const serverless = require('serverless-http');
const app = require('../../server');

// Netlify rewrites /api/* and /health through this function. Strip the
// function's mount prefix so Express receives the original /api/... path.
module.exports.handler = serverless(app, {
  basePath: '/.netlify/functions/api'
});
