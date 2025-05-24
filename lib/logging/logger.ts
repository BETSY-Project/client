import { LogType } from './types';
// LogEntry type is no longer used internally by this simplified logger,
// but might be used by consumers if they were previously relying on it.
// For a fully self-contained CLM-only logger, this export could also be removed.

// Helper to convert LogType enum to string for CLM
const logTypeToString = (logType: LogType): string => {
  switch (logType) {
    case LogType.INFO: return 'info';
    case LogType.SUCCESS: return 'success';
    case LogType.WARNING: return 'warning';
    case LogType.ERROR: return 'error';
    default: return 'info'; // Default to info
  }
};

// Sanitize details for JSON stringification
const sanitizeDetails = (details: unknown): unknown => {
  try {
    // Basic sanitization: handle circular refs by stringifying/parsing
    return JSON.parse(JSON.stringify(details));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // If complex object fails, try to get a string representation
    if (details instanceof Error) {
      return { name: details.name, message: details.message, stack: details.stack };
    }
    return String(details);
  }
};

class Logger {
  private static instance: Logger;
  private clmUrl: string;

  private constructor() {
    // Ensure this runs only in the browser
    if (typeof window !== 'undefined') {
      const baseUrl = process.env.NEXT_PUBLIC_CLM_URL || 'http://localhost:9999';
      this.clmUrl = `${baseUrl.replace(/\/$/, '')}/log`; // Ensure no double slashes and append /log
    } else {
      // Default for non-browser, though primarily client-side
      const baseUrl = 'http://localhost:9999';
      this.clmUrl = `${baseUrl.replace(/\/$/, '')}/log`;
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private async sendToCLM(level: LogType, message: string, details?: unknown): Promise<void> {
    // Do not attempt to log if not in a browser environment (where fetch is available)
    // or if clmUrl is not set (though it has a default).
    if (typeof window === 'undefined' || !this.clmUrl) {
      // Optionally, log to console if CLM is not available or in non-browser context
      // console.log(`[${logTypeToString(level)}] (CLM Disabled): ${message}`, details);
      return;
    }

    const payload: {
      service: string;
      level: string;
      message: string;
      details?: unknown;
    } = {
      service: 'client',
      level: logTypeToString(level),
      message: message,
    };

    if (details !== undefined) {
      payload.details = sanitizeDetails(details);
    }

    try {
      await fetch(this.clmUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        mode: 'cors', // Explicitly set mode for cross-origin requests
      });
      // console.info('Log sent to CLM:', payload);
    } catch (error) {
      console.warn('Failed to send log to CLM:', error, payload);
    }
  }

  public info = async (message: string, details?: unknown): Promise<void> => {
    await this.sendToCLM(LogType.INFO, message, details);
  };

  public error = async (message: string, details?: unknown): Promise<void> => {
    await this.sendToCLM(LogType.ERROR, message, details);
  };

  public success = async (message: string, details?: unknown): Promise<void> => {
    await this.sendToCLM(LogType.SUCCESS, message, details);
  };

  public warn = async (message: string, details?: unknown): Promise<void> => {
    await this.sendToCLM(LogType.WARNING, message, details);
  };
}

// Export a singleton instance
export const logger = Logger.getInstance();

// Re-export LogType for consumers
export { LogType };