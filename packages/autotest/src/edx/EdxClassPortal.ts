import {IClassPortal} from "../autotest/ClassPortal";
import Config, {ConfigKey} from "../../../common/Config";
import {IAutoTestResult} from "../Types";
import {
    AutoTestAuthTransport,
    AutoTestDefaultDeliverableTransport,
    AutoTestGradeTransport,
    AutoTestResultTransport,
    Payload,
} from "../../../common/types/PortalTypes";
import Log from "../../../common/Log";

/**
 * TODO: This type should go away once the full portal-backend project is finished and spun up.
 * The SDMM backend instance should be able to provide all of this directly.
 */
export class EdXClassPortal implements IClassPortal {

    public async isStaff(userName: string): Promise<AutoTestAuthTransport> {
        Log.info("EdXClassPortal::isStaff(..) - start");
        const courseId = Config.getInstance().getProp(ConfigKey.name);
        if (courseId === "sdmm") {
            if (userName === "rtholmes") {
                return {personId: userName, isStaff: true, isAdmin: true};
            }
        }
        return {personId: userName, isStaff: false, isAdmin: false};
    }

    public async getDefaultDeliverableId(): Promise<AutoTestDefaultDeliverableTransport | null> {
        Log.info("EdXClassPortal::getDefaultDeliverableId(..) - start");
        // no default deliverable for edx
        return null;
    }

    public async getContainerDetails(delivId: string): Promise<{ dockerImage: string, studentDelay: number, maxExecTime: number, regressionDelivIds: string[] } | null> {
        Log.info("EdXClassPortal::getContainerDetails(..) - start");
        const courseId = Config.getInstance().getProp(ConfigKey.name);
        if (typeof courseId !== "undefined" && courseId !== null && typeof delivId !== "undefined" && delivId !== null) {
            if (courseId === "sdmm") {
                const delay = 60 * 60 * 12; // 12h in seconds
                // TODO: update the image and build
                return {dockerImage: "310container", studentDelay: delay, maxExecTime: 300, regressionDelivIds: []};
            }
        }
        return null;
    }

    public async sendGrade(grade: AutoTestGradeTransport): Promise<Payload> {
        Log.info("EdXClassPortal::getGrade(..) - start");
        return {success: {worked: true}};
    }

    public async sendResult(grade: IAutoTestResult): Promise<Payload> {
        Log.info("EdXClassPortal::sendResult(..) - start");
        return {success: {worked: true}};
    }

    getResult(delivId: string, repoId: string): Promise<AutoTestResultTransport | null> {
        Log.info("EdXClassPortal::getResult(..) - start");
        return null;
    }
}

