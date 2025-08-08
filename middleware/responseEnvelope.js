// Standard response envelope
module.exports = function responseEnvelope(_req, res, next) {
  res.success = (data = {}, extra = {}) => {
    const body = { success: true, ...extra, data };
    res.json(body);
  };

  res.fail = (statusCode = 400, error = 'Bad Request', details) => {
    const payload = { success: false, error };
    if (details) payload.details = details;
    res.status(statusCode).json(payload);
  };
  next();
};


