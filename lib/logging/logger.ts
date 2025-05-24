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
    case LogType.DEBUG: return 'debug';
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
  private clmUrl?: string; // Can be undefined if not configured
  private isClmConfigured: boolean = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      const clmEnvUrl = process.env.NEXT_PUBLIC_CLM_URL;
      if (clmEnvUrl) {
        this.clmUrl = `${clmEnvUrl.replace(/\/$/, '')}/log`;
        this.isClmConfigured = true;
      } else {
        // CLM_URL not set, CLM logging will be disabled, fallback to console.
        this.isClmConfigured = false;
        console.info("Logger: NEXT_PUBLIC_CLM_URL not set. CLM logging disabled, will use console.");
      }
    } else {
      // Non-browser environment, disable CLM and use console if methods are called.
      this.isClmConfigured = false;
    }
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  // Helper to log to console based on level
  private logToConsole(level: LogType, message: string, details?: unknown) {
    const detailsToLog = details !== undefined ? [details] : [];
    switch (level) {
      case LogType.INFO:
        console.info(message, ...detailsToLog);
        break;
      case LogType.SUCCESS:
        console.log(`%c${message}`, 'color: green;', ...detailsToLog); // console.log for success with color
        break;
      case LogType.WARNING:
        console.warn(message, ...detailsToLog);
        break;
      case LogType.ERROR:
        console.error(message, ...detailsToLog);
        break;
      case LogType.DEBUG:
        console.debug(message, ...detailsToLog);
        break;
      default:
        console.log(message, ...detailsToLog);
    }
  }

  private async sendToCLM(level: LogType, message: string, details?: unknown): Promise<void> {
    if (typeof window === 'undefined' || !this.isClmConfigured || !this.clmUrl) {
      // Fallback to console if not in browser, CLM not configured, or clmUrl somehow missing
      this.logToConsole(level, `(CLM Disabled) ${message}`, details);
      return;
    }

    const payload = {
      service: 'client',
      level: logTypeToString(level),
      message: message,
      details: details !== undefined ? sanitizeDetails(details) : undefined,
    };

    try {
      const response = await fetch(this.clmUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        mode: 'cors',
      });
      if (!response.ok) {
        // CLM responded with an error (e.g., 4xx, 5xx)
        console.warn(`Failed to send log to CLM (HTTP ${response.status}):`, payload, await response.text());
        this.logToConsole(level, `(CLM Send Fail) ${message}`, details); // Fallback to console
      }
      // If successful (2xx), do nothing more (no console log)
    } catch (error) {
      // Network error or other fetch issue
      console.warn('Failed to send log to CLM (Network Error):', error, payload);
      this.logToConsole(level, `(CLM Network Fail) ${message}`, details); // Fallback to console
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

  public debug = async (message: string, details?: unknown): Promise<void> => {
    await this.sendToCLM(LogType.DEBUG, message, details);
  };
}

// Export a singleton instance
export const logger = Logger.getInstance();

// Re-export LogType for consumers
export { LogType };