import Config, {ConfigKey} from "../../common/Config";
import Log from "../../common/Log";

import IREST from "./server/IREST";
import SDMMREST from "./server/SDMM/SDMMREST";
import CS340REST from "./server/340/CS340REST";
import NoCustomRoutes from "./server/common/NoCustomRoutes";

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

        if (org === 'sdmm' || org === 'secapstonetest') {
            return new SDMMREST();
        } else if (org === 'CS310-2017Jan' || org === 'CS310-2017Jan_TEST') {
            // no custom routes are required for 310
            return new NoCustomRoutes();
        } else if (org === 'cs340') {
            return new CS340REST();
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
            const org = Config.getInstance().getProp(ConfigKey.org);
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
