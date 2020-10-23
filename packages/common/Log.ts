/* tslint:disable:no-console */

export enum LogLevel {
    TRACE,
    INFO,
    WARN,
    ERROR,
    TEST,
    NONE,
}

let LOG_LEVEL: LogLevel;

switch ((process.env["LOG_LEVEL"] || "").toUpperCase()) {
    case "TRACE":
        LOG_LEVEL = LogLevel.TRACE;
        break;
    case "INFO":
        LOG_LEVEL = LogLevel.INFO;
        break;
    case "WARN":
        LOG_LEVEL = LogLevel.WARN;
        break;
    case "ERROR":
        LOG_LEVEL = LogLevel.ERROR;
        break;
    case "TEST":
        LOG_LEVEL = LogLevel.TEST;
        break;
    case "NONE":
        LOG_LEVEL = LogLevel.NONE;
        break;
    default:
        LOG_LEVEL = LogLevel.TRACE;
}

/**
 * Collection of logging methods. Useful for making the output easier to read and understand.
 */
export default class Log {
    public static Level: LogLevel = LOG_LEVEL;

    public static trace(...msg: any[]): void {
        if (Log.Level <= LogLevel.TRACE) {
            console.log(`<T> ${new Date().toLocaleString()}:`, ...msg);
        }
    }

    public static cmd(msg: string): void {
        if (Log.Level <= LogLevel.INFO) {
            console.info(`\`\`\`\n${msg}\n\`\`\``);
        }
    }

    public static info(...msg: any[]): void {
        if (Log.Level <= LogLevel.INFO) {
            console.info(`<I> ${new Date().toLocaleString()}:`, ...msg);
        }
    }

    public static warn(...msg: any[]): void {
        if (Log.Level <= LogLevel.WARN) {
            console.warn(`<W> ${new Date().toLocaleString()}:`, ...msg);
        }
    }

    public static error(...msg: any[]): void {
        if (Log.Level <= LogLevel.ERROR) {
            console.error(`<E> ${new Date().toLocaleString()}:`, ...msg);
        }
    }

    public static exception(...err: any[]): void {
        console.error(`<!> ${new Date().toLocaleString()}:`, ...err);
    }

    public static test(...msg: any[]): void {
        if (Log.Level <= LogLevel.TEST) {
            console.log(`<X> ${new Date().toLocaleString()}:`, ...msg);
        }
    }
}
