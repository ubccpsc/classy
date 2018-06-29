import {IClassPortal} from "../ClassPortal";
import Config, {ConfigKey} from "../../../../common/Config";

export class MockClassPortal implements IClassPortal {

    public async isStaff(userName: string): Promise<boolean> {
        const courseId = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of var
        if (typeof courseId === "undefined" || courseId === null || typeof userName === "undefined" || userName === null) {
            return false;
        }
        if (courseId === "test") { // 310
            return userName === "staff" || userName === "cs310";
        }
        return false;
    }

    public async getDefaultDeliverableId(): Promise<string | null> {
        // if (typeof commitUrl !== "undefined" && commitUrl !== null) {
        //     if (commitUrl.indexOf("310") >= 0) {
        //         return "d1";
        //     }
        // }
        const courseId = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of var
        if (courseId === 'test') {
            return "d1";
        }
        return null;
    }

    public async getContainerDetails(delivId: string): Promise<{ dockerImage: string, studentDelay: number, maxExecTime: number, regressionDelivIds: string[] } | null> {
        const courseId = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of var
        if (typeof courseId !== "undefined" && courseId !== null && typeof delivId !== "undefined" && delivId !== null) {
            if (courseId === "test") { // 310
                return {dockerImage: "310container", studentDelay: 100, maxExecTime: 300, regressionDelivIds: []};
            }
        }
        return null;
    }

    /*
        public async getTestDelay(org: string, delivId: string): Promise<number | null> {
            if (typeof org !== "undefined" && org !== null && typeof delivId !== "undefined" && delivId !== null) {
                if (org === "310") {
                    return 12 * 60 * 60 * 1000; // 12h right now
                }
            }
            return null;
        }
        */
}
