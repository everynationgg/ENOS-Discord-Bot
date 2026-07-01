// ─── Simple Console Logger ────────────────────────────────────────────────────
const LEVELS = { INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR', DEBUG: 'DEBUG' };

function timestamp() {
  return new Date().toISOString();
}

function format(level, ...args) {
  return `[${timestamp()}] [${level}]`, ...args;
}

const logger = {
  info: (...args) => console.log(`[${timestamp()}] [INFO]`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] [WARN]`, ...args),
  error: (...args) => console.error(`[${timestamp()}] [ERROR]`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${timestamp()}] [DEBUG]`, ...args);
    }
  },
};

module.exports = logger;
