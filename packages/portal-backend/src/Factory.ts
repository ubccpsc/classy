import {Config} from "../../common/Config";
import Log from "../../common/Log";

import SDMMREST from "./controllers/SDMM/SDMMREST";
import IREST from "./controllers/IREST";

export class Factory {

    public static getCustomRouteHandler(): IREST {
        const org = Factory.getOrg();

        if (org === 'sdmm') {
            return new SDMMREST();
        } else if (org === 'cs340') {
            // do something
        } else {
            Log.error("Factory::getXXX() - unknown org: " + org);
        }
    }

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
    }
}