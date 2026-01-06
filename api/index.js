const serverless = require('serverless-http');
const app = require('../backend/server-new');

module.exports = serverless(app);
