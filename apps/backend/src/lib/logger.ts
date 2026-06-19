import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

let errorTracker: (() => void) | null = null;

export function registerErrorTracker(tracker: () => void) {
  errorTracker = tracker;
}

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  hooks: {
    logMethod(inputArgs, method, level) {
      if (level >= 50 && errorTracker) {
        try {
          errorTracker();
        } catch (e) {
          // ignore
        }
      }
      return method.apply(this, inputArgs);
    },
  },

  redact: {
    paths: [
      'privateKey',
      'secret',
      'token',
      '*.privateKey',
      '*.secret',
      '*.token',
      'req.headers.authorization',
    ],
    censor: '[REDACTED]',
  },
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    },
  }),
});
