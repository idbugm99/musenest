const util = require('util');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const THRESHOLD = LEVELS[LOG_LEVEL] ?? LEVELS.info;

function formatLog(level, message, meta) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: typeof message === 'string' ? message : util.format('%o', message),
    ...meta,
  };
  return JSON.stringify(entry);
}

function log(level, message, meta = {}) {
  if ((LEVELS[level] ?? 100) < THRESHOLD) return;
  const line = formatLog(level, message, meta);
  // eslint-disable-next-line no-console
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](line);
}

module.exports = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};


