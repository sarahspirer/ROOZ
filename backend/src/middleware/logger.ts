import { Request, Response, NextFunction } from 'express';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function colorForStatus(status: number): string {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  return colors.green;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;

  res.on('finish', () => {
    const ms = Date.now() - start;
    const statusColor = colorForStatus(res.statusCode);
    console.log(
      `${colors.gray}${new Date().toISOString()}${colors.reset} ` +
      `${colors.cyan}${method}${colors.reset} ` +
      `${originalUrl} ` +
      `${statusColor}${res.statusCode}${colors.reset} ` +
      `${colors.gray}${ms}ms${colors.reset}`,
    );
  });

  next();
}

export function log(level: 'info' | 'warn' | 'error', message: string, meta?: unknown): void {
  const ts = new Date().toISOString();
  const color =
    level === 'error' ? colors.red : level === 'warn' ? colors.yellow : colors.green;
  const prefix = `${colors.gray}${ts}${colors.reset} ${color}[${level.toUpperCase()}]${colors.reset}`;
  if (meta !== undefined) {
    console.log(prefix, message, meta);
  } else {
    console.log(prefix, message);
  }
}
