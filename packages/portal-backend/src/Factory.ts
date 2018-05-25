import Config from "../../common/Config";
import Log from "../../common/Log";

import IREST from "./server/IREST";
import SDMMREST from "./server/SDMM/SDMMREST";

export class Factory {

    /**
     * Returns a custom route handler for a course. This will be used to configure
     * Restify with any custom routes required for the course backend. Only one
     * custom handler is permitted per instance.
     *
     * @returns {IREST}
     */
    public static getCustomRouteHandler(): IREST {
        const org = Factory.getOrg();

        if (org === 'sdmm') {
            return new SDMMREST();
        } else if (org === 'secapstonetest') {
            return new SDMMREST();
        } else if (org === 'cs340') {
            // do something
        } else {
            Log.error("Factory::getCustomRouteHandler() - unknown org: " + org);
        }
        return null; // TODO: should not happen; should return a default implementation instead.
    }

    /**
     * Gets the org associated with the Backend instance from the .env file.
     *
     * @returns {string | null}
     */
    private static getOrg(): string | null {
        try {
            const org = Config.getInstance().getProp('org');
            if (org === null) {
                Log.error("Factory::getOrg() - null org");
            }
            return org;
        } catch (err) {
            Log.error("Factory::getOrg() - ERROR: " + err);
        }
        return null;
    }
}