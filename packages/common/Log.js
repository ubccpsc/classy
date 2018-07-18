"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* tslint:disable:no-console */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["TRACE"] = 0] = "TRACE";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["TEST"] = 4] = "TEST";
    LogLevel[LogLevel["NONE"] = 5] = "NONE";
})(LogLevel || (LogLevel = {}));
let LOG_LEVEL;
switch (("TRACE").toUpperCase()) {
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
class Log {
    static trace(msg) {
        if (Log.Level <= LogLevel.TRACE) {
            console.log(`<T> ${new Date().toLocaleString()}: ${msg}`);
        }
    }
    static cmd(msg) {
        if (Log.Level <= LogLevel.INFO) {
            console.info(`\`\`\`\n${msg}\n\`\`\``);
        }
    }
    static info(msg) {
        if (Log.Level <= LogLevel.INFO) {
            console.info(`<I> ${new Date().toLocaleString()}: ${msg}`);
        }
    }
    static warn(msg) {
        if (Log.Level <= LogLevel.WARN) {
            console.warn(`<W> ${new Date().toLocaleString()}: ${msg}`);
        }
    }
    static error(msg) {
        if (Log.Level <= LogLevel.ERROR) {
            console.error(`<E> ${new Date().toLocaleString()}: ${msg}`);
        }
    }
    static test(msg) {
        if (Log.Level <= LogLevel.TEST) {
            console.log(`<X> ${new Date().toLocaleString()}: ${msg}`);
        }
    }
}
Log.Level = LOG_LEVEL;
exports.default = Log;
//# sourceMappingURL=Log.js.map