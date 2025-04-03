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
			// console.log("Log::parseLogLevel() - start; currently: " + Log.Level);
			let valToSwitch;
			if (typeof Log.Level === "undefined") {
				// if undefined, use .env; otherwise re-parse value
				valToSwitch = (process.env["LOG_LEVEL"] || "").toUpperCase();
			} else {
				valToSwitch = Log.Level;
			}

			if (typeof valToSwitch !== "string") {
				LOG_LEVEL = Log.Level;
				// console.log("Log::parseLogLevel() - unchanged; current level: " + LOG_LEVEL);
				return LOG_LEVEL;
			} else {
				// if the value is not a string, it must be a LogLevel already
				// so we do not need to parse it again
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
				// console.log("Log::parseLogLevel() - log level: " + LOG_LEVEL);
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
			console.log(`<T> ${Log.getCurrentTS()}`, ...msg);
		}
	}

	public static cmd(msg: string): void {
		if (Log.Level <= LogLevel.INFO) {
			console.info(`\`\`\`\n${msg}\n\`\`\``);
		}
	}

	public static info(...msg: any[]): void {
		if (Log.Level <= LogLevel.INFO) {
			console.info(`<I> ${Log.getCurrentTS()}`, ...msg);
		}
	}

	public static warn(...msg: any[]): void {
		if (Log.Level <= LogLevel.WARN) {
			console.warn(`<W> ${Log.getCurrentTS()}`, ...msg);
		}
	}

	public static error(...msg: any[]): void {
		if (Log.Level <= LogLevel.ERROR) {
			console.error(`<E> ${Log.getCurrentTS()}`, ...msg);
		}
	}

	public static exception(...err: any[]): void {
		console.error(`<!> ${Log.getCurrentTS()}`, ...err);
	}

	public static test(...msg: any[]): void {
		if (Log.Level <= LogLevel.TEST) {
			console.log(`<X> ${Log.getCurrentTS()}`, ...msg);
		}
	}

	protected static getCurrentTS(): string {
		// 11/31/2024, 11:27:00 AM
		let dateStr = new Date().toLocaleString() + ":";
		dateStr = dateStr.padEnd(23, " ");
		return dateStr;
	}
}

// enable log level changes to dynamically update
Log.parseLogLevel();
