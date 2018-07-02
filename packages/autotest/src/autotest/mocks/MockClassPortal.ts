import {IClassPortal} from "../ClassPortal";
import Config, {ConfigKey} from "../../../../common/Config";
import {
    AutoTestAuthTransport,
    AutoTestConfigTransport,
    AutoTestDefaultDeliverableTransport,
    AutoTestGradeTransport,
    Payload
} from "../../../../common/types/PortalTypes";
import Log from "../../../../common/Log";

export class MockClassPortal implements IClassPortal {

    public async isStaff(userName: string): Promise<AutoTestAuthTransport> {
        const org = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of var
        if (org === "test") { // 310
            if (userName === "staff" || userName === "cs310") {
                return {personId: userName, isStaff: true, isAdmin: true};
            }
        }
        Log.error('MockClassPortal::isStaff() - MockClassPortal should not be used with: ' + org);
        return {personId: userName, isStaff: false, isAdmin: false};
    }

    public async getDefaultDeliverableId(): Promise<AutoTestDefaultDeliverableTransport | null> {
        const org = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of var
        if (org === 'test') {
            return {defaultDeliverable: "d1"};
        }
        Log.error('MockClassPortal::getDefaultDeliverableId() - MockClassPortal should not be used with: ' + org);
        return null;
    }

    public async getContainerDetails(delivId: string): Promise<AutoTestConfigTransport | null> {
        const org = Config.getInstance().getProp(ConfigKey.org); // TODO: get rid of var
        if (org === "test") { // 310
            return {dockerImage: "310container", studentDelay: 100, maxExecTime: 300, regressionDelivIds: []};
        }
        Log.error('MockClassPortal::getContainerDetails() - MockClassPortal should not be used with: ' + org);
        return null;
    }

    public async sendGrade(grade: AutoTestGradeTransport): Promise<Payload> {
        return {success: {worked: true}};
    }

}
