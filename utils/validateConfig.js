/*
 Validate required environment and configuration at startup.
 Warn in development if non-critical values are missing.
*/

function validateConfig(env = process.env) {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_DATABASE'];
  const missing = required.filter((k) => !env[k] || String(env[k]).trim() === '');
  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(', ')}`;
    if (env.NODE_ENV === 'production') {
      // eslint-disable-next-line no-console
      console.error(message);
      throw new Error(message);
    } else {
      // eslint-disable-next-line no-console
      console.warn(message);
    }
  }

  if (!env.AI_SERVER_URL && env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('AI_SERVER_URL is not set; AI proxy and tests may fail.');
  }
}

module.exports = { validateConfig };


