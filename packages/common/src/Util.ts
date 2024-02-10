import Log from "./Log";

export default class Util {

    public static timeout(ms: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    public static took(start: number): string {
        return Date.now() - start + " ms";
    }

    public static shaHuman(sha: string): string {
        if (sha !== null && typeof sha === "string" && sha.length > 6) {
            return sha.substr(0, 6);
        }
        return sha;
    }

    public static tookHuman(start: number, end?: number, shortForm?: boolean): string {
        if (typeof end === "undefined") {
            end = Date.now();
        }

        if (typeof shortForm === "undefined") {
            shortForm = false;
        }

        if (start > end) {
            // swap, want end to be most recent
            [start, end] = [end, start]; // es6 destructuring ftw
        }

        let delta = end - start;
        if (delta < (1000 * 10)) {
            // just short circuit for really fast times
            let ret = delta + " ms";
            if (delta < 100) {
                ret = ret.padStart(6, "0");
            }
            ret = ret.padStart(12, " ");
            return ret;
        }

        delta = Math.floor(delta / 1000); // convert to seconds
        const hours = Math.floor(delta / 3600);
        const minutes = Math.floor((delta - (hours * 3600)) / 60);
        const seconds = Math.floor(delta - (hours * 3600) - (minutes * 60));

        let msg = "";
        if (hours >= 100) {
            msg = hours + "h";
        } else if (hours >= 10) {
            msg = " " + hours + "h";
        } else {
            msg = "  " + hours + "h";
        }

        if (minutes >= 10) {
            msg = msg + " " + minutes + "m";
        } else {
            msg = msg + " 0" + minutes + "m";
        }

        if (seconds >= 10) {
            msg = msg + " " + seconds + "s";
        } else {
            msg = msg + " 0" + seconds + "s";
        }

        if (shortForm === true) {
            msg = msg.replace(" and ", " ");
            msg = msg.replace("seconds", "secs");
            msg = msg.replace("second", "sec");
            msg = msg.replace("minutes", "mins");
            msg = msg.replace("minute", "min");
            msg = msg.replace("hours", "hrs");
            msg = msg.replace("hour", "hr");
        }

        return msg;
    }

    // just a useful delay function for when we need to wait for GH to do something
    // or we want a test to be able to slow itself down
    public static delay(ms: number): Promise<void> {
        // logger.info("GitHubActions::delay( " + ms + ") - start");
        const start = Date.now();
        return new Promise(function (resolve) {
            const fire = new Date(start + ms);
            Log.trace("Util::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
            setTimeout(function () {
                const actual = Date.now();
                const took = actual - start;
                const delta = actual - fire.getTime();
                Log.trace("Util::delay( " + ms + " ms ) - fired; took: " + took + " ms; jitter: " + delta + " ms");
                resolve();
            }, ms);
        });
    }

    /**
     * Makes a copy of an object.
     *
     * @param {{}} obj
     * @returns {{}}
     */
    public static clone(obj: {}): {} {
        return Object.assign({}, obj);
    }

    /**
     * Converts a string value to a boolean.
     *
     * The following are True:
     *
     * true
     * "true" (case-insensitive)
     * "yes" (case-insensitive)
     * 1
     * "1"
     *
     * Every other thing is false, but most commonly:
     *
     * false
     * "False" (case-insensitive)
     * 0
     * "0"
     * null
     * undefined
     *
     * @param value
     */
    public static toBoolean(value: any): boolean {
        const strValue = String(value).toLowerCase().trim();

        return strValue === "true" || strValue === "yes" || strValue === "1";
    }

    /**
     * Converts any value to an integer. If the value is not
     * an integer, the fallback is returned.
     *
     * @param value
     * @param fallback
     */
    public static toInteger(value: any, fallback: number): number {
        try {
            const num = parseInt(value, 10);
            if (isNaN(num) === false) {
                return num;
            }
        } catch (err) {
            // should not happen
            Log.warn("Util::toInteger( " + value + ", " + fallback + " ) - ERROR: " + err.message);
        }
        Log.trace("Util::toInteger( " + value + ", " + fallback + " ) - value not an integer; returning fallback");
        return fallback;
    }
}
