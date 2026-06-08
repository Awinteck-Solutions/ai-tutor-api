type LogLevel = "info" | "warn" | "error" | "debug";

interface LogMeta {
  [key: string]: unknown;
}

export class Logger {
  private static format(level: LogLevel, message: string, meta?: LogMeta): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    });
  }

  static info(message: string, meta?: LogMeta): void {
    console.log(this.format("info", message, meta));
  }

  static warn(message: string, meta?: LogMeta): void {
    console.warn(this.format("warn", message, meta));
  }

  static error(message: string, meta?: LogMeta): void {
    console.error(this.format("error", message, meta));
  }

  static debug(message: string, meta?: LogMeta): void {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.format("debug", message, meta));
    }
  }
}
