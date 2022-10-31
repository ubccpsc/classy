import Log from "@common/Log";
import {AutoTestPersonIdTransport, ClassyConfigurationTransport} from "@common/types/PortalTypes";

import {ClassPortal} from "../autotest/ClassPortal";

export class EdXClassPortal extends ClassPortal {
    /**
     * There is no default deliverable for the SDMM since it is self-paced.
     *
     * @returns {Promise<AutoTestDefaultDeliverableTransport | null>}
     */
    public async getConfiguration(): Promise<ClassyConfigurationTransport | null> {
        Log.info("EdXClassPortal::getDefaultDeliverableId(..) - returning null (no default deliverable for SDMM)");
        // no default deliverable for edx
        return null;
    }

    /**
     * personId === githubId for the SDMM.
     * @param {string} githubId
     * @returns {Promise<AutoTestPersonIdTransport | null>}
     */
    public getPersonId(githubId: string): Promise<AutoTestPersonIdTransport | null> {
        // usernames are the same for edX
        const payload: AutoTestPersonIdTransport = {
            personId: githubId
        };
        Log.info("EdXClassPortal::getPersonId( " + githubId + " ) - returning: " + JSON.stringify(payload));
        return Promise.resolve(payload);
    }
}
