import Log from "./Log";

export default class Util {

    public static timeout(ms: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    public static took(start: number): string {
        return Date.now() - start + " ms";
    }

    public static tookHuman(start: number): string {
        const delta = Math.floor((Date.now() - start) / 1000); // convert to seconds
        const hours = Math.floor(delta / 3600);
        const minutes = Math.floor((delta - (hours * 3600)) / 60);
        const seconds = Math.floor(delta - (hours * 3600) - (minutes * 60));
        let msg = "";
        if (hours > 0) {
            msg = hours + " hours and " + minutes + " minutes"; // seconds don't matter if we're over an hour
        } else if (minutes > 0) {
            msg = minutes + " minutes and " + seconds + " second";
        } else {
            msg = delta + " seconds";
        }
        return msg;
    }

    // // just a useful delay function for when we need to wait for GH to do something
    // // or we want a test to be able to slow itself down
    // public static delay(ms: number): Promise<{}> {
    //     // Log.info("Util::delay( " + ms + " ) - start: " + Date.now());
    //
    //     const waitComplete = function() {
    //         // blank
    //     };
    //     const fire = new Date(Date.now() + ms);
    //     Log.info("Util::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
    //
    //     await setTimeout(waitComplete, ms);
    //
    //     Log.info("Util::delay( " + ms + ") - done: " + Date.now());
    //     return;
    // }

    // just a useful delay function for when we need to wait for GH to do something
    // or we want a test to be able to slow itself down
    public static delay(ms: number): Promise<{}> {
        // logger.info("GitHubActions::delay( " + ms + ") - start");
        const start = Date.now();
        return new Promise(function(resolve) {
            const fire = new Date(start + ms);
            Log.info("Util::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
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
}
