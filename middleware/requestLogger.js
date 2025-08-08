const { randomUUID } = require('crypto');
const logger = require('../utils/logger');

function shouldSkipLogging(pathname) {
  if (!pathname) return false;
  return (
    pathname === '/health' ||
    pathname === '/_ai/health' ||
    pathname.startsWith('/_debug/') ||
    pathname.startsWith('/public/') ||
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/js/') ||
    pathname.startsWith('/admin/assets') ||
    pathname.startsWith('/admin/js') ||
    pathname.startsWith('/uploads/')
  );
}

module.exports = function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'] || randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);

  const skip = shouldSkipLogging(req.path || req.url);
  if (!skip) {
    const meta = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip,
    };
    if (process.env.LOG_REQUEST_BODY === 'true' && req.method !== 'GET') {
      meta.body = req.body;
      meta.query = req.query;
    }
    logger.info('request.start', meta);
  }

  const onFinish = () => {
    if (skip) return;
    const durationMs = Date.now() - start;
    const meta = {
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs,
      contentLength: res.getHeader('Content-Length') || 0,
    };
    logger.info('request.end', meta);
  };
  res.on('finish', onFinish);
  res.on('close', onFinish);

  next();
};


