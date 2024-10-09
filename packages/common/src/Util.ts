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

    public static tookHuman(start: number, end?: number, shortForm?: boolean, pad?: boolean): string {
        if (typeof end === "undefined") {
            end = Date.now();
        }

        if (typeof shortForm === "undefined") {
            shortForm = false;
        }

        if (typeof pad === "undefined") {
            pad = false;
        }

        if (start > end) {
            // swap, want end to be most recent
            [start, end] = [end, start]; // es6 destructuring ftw
        }

        let msg = "";
        const delta = end - start;
        const deltaSec = Math.floor(delta / 1000); // convert to seconds
        const hours = Math.floor(deltaSec / 3600);
        const minutes = Math.floor((deltaSec - (hours * 3600)) / 60);
        const seconds = Math.floor(deltaSec - (hours * 3600) - (minutes * 60));

        if (shortForm === true) {

            if (delta < (1000 * 10)) {
                // just short circuit for really fast times
                let ret = delta + " ms";
                if (pad) {
                    ret = ret.padStart(12, " ");
                }
                return ret;
            }

            if (hours > 0) {
                msg = hours + "h";
                // don't bother 0 padding hours
            }

            if (hours > 0 || minutes > 0) {
                // need mins
                if (minutes < 10) {
                    msg = msg + " 0" + minutes + "m";
                } else {
                    msg = msg + " " + minutes + "m";
                }
            }

            if (hours > 0 || minutes > 0 || seconds > 0) {
                // need seconds
                if (seconds < 10) {
                    msg = msg + " 0" + seconds + "s";
                } else {
                    msg = msg + " " + seconds + "s";
                }

            }

            // msg = msg.replace(" and ", " ");
            // msg = msg.replace("seconds", "secs");
            // msg = msg.replace("second", "sec");
            // msg = msg.replace("minutes", "mins");
            // msg = msg.replace("minute", "min");
            // msg = msg.replace("hours", "hrs");
            // msg = msg.replace("hour", "hr");

            // 100h 59m 59s
            if (pad) {
                msg = msg.padStart(12, " ");
            }
        } else {
            if (delta < 1000) {
                // just short circuit for really fast times
                return delta + " ms";
            }

            if (hours > 1) {
                msg = hours + " hours"; // and " + minutes + " minutes";
            } else if (hours === 1) {
                msg = hours + " hour"; // and " + minutes + " minutes";
            }

            if (hours > 0) {
                // will not show seconds
                if (minutes === 1) {
                    msg = msg + " and 1 minute";
                } else if (minutes > 1) {
                    msg = msg + " and " + minutes + " minutes";
                }
            } else {
                // will have seconds
                if (minutes === 1) {
                    msg = "1 minute";
                } else {
                    msg = minutes + " minutes";
                }
            }

            if (hours < 1) {
                if (minutes > 0) {
                    if (seconds === 0) {
                        // say nothing
                    } else if (seconds === 1) {
                        msg = msg + " and 1 second";
                    } else {
                        msg = msg + " and " + seconds + " seconds";
                    }
                } else {
                    if (seconds === 0) {
                        // say nothing
                    } else if (seconds === 1) {
                        msg = "1 second";
                    } else {
                        msg = seconds + " seconds";
                    }
                }
            }

            // 999 hours and 59 minutes and 59 seconds
            if (pad) {
                msg = msg.padStart(40, " ");
            }
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

    /**
     * Returns true if the value is a number.
     *
     * @param value
     */
    public static isNumeric(value: any): boolean {
        return !isNaN(value - parseFloat(value));
    }

    /**
     * Compare two values for sorting.
     *
     * @param a
     * @param b
     */
    public static compare(a: any, b: any): number {

        // exactly equal
        if ((typeof a === typeof b) && a === b) {
            return 0;
        }

        // exactly nothing
        if ((a === null || a === undefined) && (b === null || b === undefined)) {
            return 0;
        }

        // a is nothing but b is something
        if ((a === null || a === undefined) && (b !== null && b !== undefined)) {
            return -1;
        }

        // b is nothing but a is something
        if ((b === null || b === undefined) && (a !== null && a !== undefined)) {
            return 1;
        }

        // punt on arrays
        if (Array.isArray(a) || Array.isArray(b)) {
            Log.trace("Util::compare( " + a + ", " + b + " ) - punt on arrays");
            return 0;
        }

        // punt on objects
        if (typeof a === "object" || typeof b === "object") {
            Log.trace("Util::compare( " + a + ", " + b + " ) - punt on objects");
            return 0;
        }

        // no matter what, if a is a number and b is not, a is more
        if (Util.isNumeric(a) && !Util.isNumeric(b)) {
            return 1;
        }

        // no matter what, if b is a number and a is not, a is less
        if (Util.isNumeric(b) && !Util.isNumeric(a)) {
            return -1;
        }

        // hopefully the most common case
        if (Util.isNumeric(a) && Util.isNumeric(b)) {
            // this is the most basic case
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (numA === numB) {
                return 0;
            } else if (numA < numB) {
                return -1;
            } else {
                return 1;
            }
        }

        // at the end of everything, just defer to localCompare
        return ("" + a).localeCompare("" + b);
    }
}
