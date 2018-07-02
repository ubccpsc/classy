import {IClassPortal} from "../autotest/ClassPortal";
import Config, {ConfigKey} from "../../../common/Config";
import {
    AutoTestAuthTransport,
    AutoTestDefaultDeliverableTransport,
    AutoTestGradeTransport,
    Payload
} from "../../../common/types/PortalTypes";

export class EdXClassPortal implements IClassPortal {

    public async isStaff(userName: string): Promise<AutoTestAuthTransport> {
        const courseId = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of this var
        if (courseId === "edx") { // TODO: should be secapstone
            if (userName === "rtholmes") {
                return {personId: userName, isStaff: true, isAdmin: true};
            }
        }
        return {personId: userName, isStaff: false, isAdmin: false};
    }

    public async getDefaultDeliverableId(): Promise<AutoTestDefaultDeliverableTransport | null> {
        // no default deliverable for edx
        return null;
    }

    public async getContainerDetails(delivId: string): Promise<{ dockerImage: string, studentDelay: number, maxExecTime: number, regressionDelivIds: string[] } | null> {
        const courseId = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of this var
        if (typeof courseId !== "undefined" && courseId !== null && typeof delivId !== "undefined" && delivId !== null) {
            if (courseId === "edx") {
                const delay = 60 * 60 * 12; // 12h in seconds
                // TODO: update the image and build
                return {dockerImage: "310container", studentDelay: delay, maxExecTime: 300, regressionDelivIds: []};
            }
        }
        return null;
    }

    public async sendGrade(grade: AutoTestGradeTransport): Promise<Payload> {
        return {success: {worked: true}};
    }
}

