import * as rp from "request-promise-native";
import {IClassPortal} from "../autotest/ClassPortal";
import Log from "../../../common/Log";

export class EdXClassPortal implements IClassPortal {

    public async isStaff(courseId: string, userName: string): Promise<boolean> {
        if (typeof courseId === "undefined" || courseId === null || typeof userName === "undefined" || userName === null) {
            return false;
        }
        if (courseId === "edx") {
            return userName === "rtholmes";
        }
        return false;
    }

    public async getDefaultDeliverableId(commitUrl: string): Promise<string | null> {
        if (typeof commitUrl !== "undefined" && commitUrl !== null) {
            if (commitUrl.indexOf("edx") >= 0) {
                return null; // no default deliverable for edx (self paced)
            }
        }
        return null;
    }

    public async getContainerDetails(courseId: string, delivId: string): Promise<{ dockerImage: string,  studentDelay: number, maxExecTime: number, regressionDelivIds: string[] }  | null> {
        if (typeof courseId !== "undefined" && courseId !== null && typeof delivId !== "undefined" && delivId !== null) {
            if (courseId === "edx") {
                const delay = 60 * 60 * 12; // 12h in seconds
                // TODO: update the image and build
                return {dockerImage: "310container", studentDelay: delay, maxExecTime: 300, regressionDelivIds: []};
            }
        }
        return null;
    }
}

