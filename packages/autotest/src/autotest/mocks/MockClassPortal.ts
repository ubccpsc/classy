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
        const name = Config.getInstance().getProp(ConfigKey.name);
        const testname = Config.getInstance().getProp(ConfigKey.testname);
        if (name === testname) {
            if (userName === 'staff' || userName === 'cs310') {
                return {personId: userName, isStaff: true, isAdmin: true};
            } else {
                return {personId: userName, isStaff: false, isAdmin: false};
            }
        }
        Log.error('MockClassPortal::isStaff() - MockClassPortal should not be used with: ' + name);
        return {personId: userName, isStaff: false, isAdmin: false};
    }

    public async getDefaultDeliverableId(): Promise<AutoTestDefaultDeliverableTransport | null> {
        const name = Config.getInstance().getProp(ConfigKey.name);
        const testname = Config.getInstance().getProp(ConfigKey.testname);
        if (name === testname) {
            return {defaultDeliverable: "d1"};
        }
        Log.error('MockClassPortal::getDefaultDeliverableId() - MockClassPortal should not be used with: ' + name);
        return null;
    }

    public async getContainerDetails(delivId: string): Promise<AutoTestConfigTransport | null> {
        const name = Config.getInstance().getProp(ConfigKey.name);
        const testname = Config.getInstance().getProp(ConfigKey.testname);
        if (name === testname) { // 310
            const delay = 6 * 60 * 60; // 6 hours in seconds
            return {dockerImage: "310container", studentDelay: delay, maxExecTime: 300, regressionDelivIds: []};
        }
        Log.error('MockClassPortal::getContainerDetails() - MockClassPortal should not be used with: ' + name);
        return null;
    }

    public async sendGrade(grade: AutoTestGradeTransport): Promise<Payload> {
        const name = Config.getInstance().getProp(ConfigKey.name);
        const testname = Config.getInstance().getProp(ConfigKey.testname);
        if (name === testname) {
            return {success: {worked: true}};
        } else {
            return {failure: {message: 'did not work', shouldLogout: false}};
        }
    }

}
