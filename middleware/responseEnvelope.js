// Standard response envelope
module.exports = function responseEnvelope(req, res, next) {
  const start = Date.now();

  res.success = (data = {}, extra = {}) => {
    const body = { success: true, ...extra, data };
    res.json(body);
  };

  res.fail = (statusCode = 400, error = 'Bad Request', details) => {
    const payload = { success: false, error };
    if (details) payload.details = details;
    res.status(statusCode).json(payload);
  };

  res.on('finish', () => {
    // Attach timing header for visibility
    res.setHeader('X-Response-Time', `${Date.now() - start}ms`);
  });

  next();
};


