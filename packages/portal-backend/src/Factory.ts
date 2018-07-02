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
        const name = Factory.getName();

        if (name === 'sdmm' || name === 'secapstonetest') {
            return new SDMMREST();
        } else if (name === 'cs310' || name === 'classytest') {
            // no custom routes are required for 310
            return new NoCustomRoutes();
        } else if (name === 'cs340') {
            return new CS340REST();
        } else {
            Log.error("Factory::getCustomRouteHandler() - unknown name: " + name);
        }
        return new NoCustomRoutes(); // default handler
    }

    /**
     * Gets the name associated with the Backend instance from the .env file.
     *
     * @returns {string | null}
     */
    private static getName(): string | null {
        try {
            const name = Config.getInstance().getProp(ConfigKey.name);
            if (name === null) {
                Log.error("Factory::getName() - null name");
            }
            return name;
        } catch (err) {
            Log.error("Factory::getName() - ERROR: " + err);
        }
        return null;
    }
}
