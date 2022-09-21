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

/**
 * Collection of logging methods. Useful for making the output easier to read and understand.
 */
export default class Log {
    public static Level: LogLevel = Log.parseLogLevel();

    public static parseLogLevel(): LogLevel {
        try {
            console.log("Log::parseLogLevel() - start; currently: " + Log.Level);
            let valToSwitch = null;
            if (typeof Log.Level === "undefined") {
                // if undefined, use .env; otherwise re-parse value
                valToSwitch = (process.env["LOG_LEVEL"] || "").toUpperCase();
            } else {
                valToSwitch = Log.Level;
            }

            if (typeof valToSwitch !== "string") {
                LOG_LEVEL = Log.Level;
                console.log("Log::parseLogLevel() - unchanged; current level: " + LOG_LEVEL);
                return LOG_LEVEL;
            } else {
                // if the value isn't a string, it must be a LogLevel already
                // so we don't need to parse it again
                switch (valToSwitch) {
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
                console.log("Log::parseLogLevel() - log level: " + LOG_LEVEL);
                Log.Level = LOG_LEVEL;
                return LOG_LEVEL;
            }
        } catch (err) {
            console.log("<E> Log::parseLogLevel() - ERROR; setting to TRACE");
            Log.Level = LogLevel.TRACE;
            LOG_LEVEL = LogLevel.TRACE;
            return LOG_LEVEL;
        }
    }

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

// enable log level changes to dynamically update
Log.parseLogLevel();
