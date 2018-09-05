import Log from "./Log";

export default class Util {

    public static timeout(ms: number): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    public static took(start: number): string {
        return Date.now() - start + " ms";
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
        return new Promise(function(resolve) {
            const fire = new Date(new Date().getTime() + ms);
            Log.info("Util::delay( " + ms + " ms ) - waiting; will trigger at " + fire.toLocaleTimeString());
            setTimeout(resolve, ms);
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

}
