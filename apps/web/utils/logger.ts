/* eslint-disable no-console */
/**
 * Lightweight logger utility to centralize console usage.
 * In production we only emit warnings and errors, while development keeps info/debug logs.
 */
const isProduction = process.env.NODE_ENV === 'production';

const logger = {
  debug: (...args: unknown[]) => {
    if (!isProduction) {
      console.debug(...args);
    }
  },
  info: (...args: unknown[]) => {
    if (!isProduction) {
      console.info(...args);
    }
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
};

export const createScopedLogger = (scope: string) => ({
  debug: (...args: unknown[]) => logger.debug(`[${scope}]`, ...args),
  info: (...args: unknown[]) => logger.info(`[${scope}]`, ...args),
  warn: (...args: unknown[]) => logger.warn(`[${scope}]`, ...args),
  error: (...args: unknown[]) => logger.error(`[${scope}]`, ...args),
});

export default logger;
