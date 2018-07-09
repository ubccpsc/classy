import {IClassPortal} from "../ClassPortal";
import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {IAutoTestResult} from "../../Types";
import {
    AutoTestAuthTransport,
    AutoTestConfigTransport,
    AutoTestDefaultDeliverableTransport,
    AutoTestGradeTransport,
    AutoTestResultTransport,
    Payload,
} from "../../../../common/types/PortalTypes";
import {MockDataStore} from "./MockDataStore";

export class MockClassPortal implements IClassPortal {

    public async isStaff(userName: string): Promise<AutoTestAuthTransport> {
        Log.info("MockClassPortal::isStaff(..) - start");
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
        Log.info("MockClassPortal::getDefaultDeliverableId(..) - start");
        const name = Config.getInstance().getProp(ConfigKey.name);
        const testname = Config.getInstance().getProp(ConfigKey.testname);
        if (name === testname) {
            return {defaultDeliverable: "d1"};
        }
        Log.error('MockClassPortal::getDefaultDeliverableId() - MockClassPortal should not be used with: ' + name);
        return null;
    }

    public async getContainerDetails(delivId: string): Promise<AutoTestConfigTransport | null> {
        Log.info("MockClassPortal::getContainerDetails(..) - start");
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
        Log.info("MockClassPortal::sendGrade(..) - start");
        const name = Config.getInstance().getProp(ConfigKey.name);
        const testname = Config.getInstance().getProp(ConfigKey.testname);
        if (name === testname) {
            return {success: {worked: true}};
        } else {
            return {failure: {message: 'did not work', shouldLogout: false}};
        }
    }

    public async sendResult(result: IAutoTestResult): Promise<Payload> {
        Log.info("MockClassPortal::sendResult(..) - start");
        const name = Config.getInstance().getProp(ConfigKey.name);
        const testname = Config.getInstance().getProp(ConfigKey.testname);
        if (name === testname) {
            const ds = new MockDataStore();
            await ds.saveResult(result);
            return {success: {worked: true}};
        } else {
            return {failure: {message: 'did not work', shouldLogout: false}};
        }
    }

    async getResult(delivId: string, repoId: string): Promise<AutoTestResultTransport | null> {
        Log.info("MockClassPortal::getResult(..) - start");

        const ds = new MockDataStore();
        return await ds.getResult(delivId, repoId);
    }

}
