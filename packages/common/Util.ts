import Log from "./Log";

export default class Util {

    public static timeout(ms: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    public static took(start: number): string {
        return Date.now() - start + " ms";
    }

    public static tookHuman(start: number, end?: number): string {
        if (typeof end === 'undefined') {
            end = Date.now();
        }
        const delta = Math.floor((end - start) / 1000); // convert to seconds
        const hours = Math.floor(delta / 3600);
        const minutes = Math.floor((delta - (hours * 3600)) / 60);
        const seconds = Math.floor(delta - (hours * 3600) - (minutes * 60));

        let msg = "";
        if (hours > 1) {
            msg = hours + " hours"; // and " + minutes + " minutes";
        } else if (hours === 1) {
            msg = hours + " hour"; // and " + minutes + " minutes";
        }

        if (hours > 0) {
            // won't have seconds
            if (minutes === 1) {
                msg = msg + " and 1 minute";
            } else {
                msg = msg + " and " + minutes + " minutes";
            }
        } else {
            /// will have eseconds
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

        return msg;
    }

    // just a useful delay function for when we need to wait for GH to do something
    // or we want a test to be able to slow itself down
    public static delay(ms: number): Promise<{}> {
        // logger.info("GitHubActions::delay( " + ms + ") - start");
        const start = Date.now();
        return new Promise(function(resolve) {
            const fire = new Date(start + ms);
            Log.trace("Util::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
            setTimeout(function() {
                const actual = Date.now();
                const took = actual - start;
                const delta = actual - fire.getTime();
                Log.info("Util::delay( " + ms + " ms ) - fired; took: " + took + " ms; jitter: " + delta + " ms");
                resolve();
            }, ms);
        });
    }

    /**
     * Creates a query string for fetch requests
     * @param obj: [key: string]: string type.
     * @return qs: UrlSearchParams
     */
    public static getQueryStr(obj: {[key: string]: string}): string {
        const qs = '?';
        const params = Object.keys(obj).map((key) => {
            return encodeURIComponent(key) + '=' + encodeURIComponent(obj[key]);
        })
        .join('&');
        return qs + params;
}

    /**
     * Makes a copy of an object.
     *
     * @param {{}} obj
     * @returns {{}}
     */
    public static clone(obj: {}): {} {
        const ret = Object.assign({}, obj);
        return ret;
    }

    public static truncateNumber(num: number, digits: number): number {
        try {
            if (typeof num === 'undefined' || num === null) {
                return 0;
            }
            return Number(Number(num).toFixed(digits)) + 0;
        } catch (err) {
            Log.error("Util::truncateNumber(..) - ERROR: " + err.message);
            Log.error("Util::truncateNumber( " + num + ", " + digits + " ) - ERROR: " + err.message);
            return 0;
        }
    }

    public static isEmpty(obj: any): boolean {
        if (typeof obj === 'undefined' || obj === null) {
            return true;
        }
        return Object.keys(obj).length === 0 && obj.constructor === Object;
    }
}
