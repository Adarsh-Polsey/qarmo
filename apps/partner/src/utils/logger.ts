/**
 * Dev-only, tagged console logging. Every call is a no-op when __DEV__ is false,
 * so none of this reaches production builds or their logs.
 */

const write = (level: 'log' | 'warn' | 'error', tag: string, message: string, data?: unknown) => {
  if (!__DEV__) return;
  const line = `[${tag}] ${message}`;
  if (data !== undefined) {
    console[level](line, data);
  } else {
    console[level](line);
  }
};

export const logger = {
  info: (tag: string, message: string, data?: unknown) => write('log', tag, message, data),
  warn: (tag: string, message: string, data?: unknown) => write('warn', tag, message, data),
  error: (tag: string, message: string, data?: unknown) => write('error', tag, message, data),

  /** Logs start/end + elapsed ms around an async step. Call the returned function when the step settles. */
  time: (tag: string, label: string) => {
    if (!__DEV__) return () => {};
    const startedAt = Date.now();
    write('log', tag, `${label} — started`);
    return (outcome: 'ok' | 'fail' = 'ok', data?: unknown) => {
      const ms = Date.now() - startedAt;
      write(
        outcome === 'ok' ? 'log' : 'warn',
        tag,
        `${label} — ${outcome === 'ok' ? 'done' : 'failed'} in ${ms}ms`,
        data,
      );
    };
  },
};
