import Config, {ConfigKey} from "../../../../common/Config";
import Log from "../../../../common/Log";
import {AutoTestResult} from "../../../../common/types/AutoTestTypes";
import {GradeReport} from "../../../../common/types/ContainerTypes";
import {
    AutoTestAuthTransport,
    AutoTestConfigTransport,
    AutoTestGradeTransport,
    AutoTestPersonIdTransport,
    AutoTestResultTransport,
    ClassyConfigurationTransport,
    Payload
} from "../../../../common/types/PortalTypes";
import {IClassPortal} from "../ClassPortal";
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

    public async getConfiguration(): Promise<ClassyConfigurationTransport | null> {
        Log.info("MockClassPortal::getDefaultDeliverableId(..) - start");
        const name = Config.getInstance().getProp(ConfigKey.name);
        const testname = Config.getInstance().getProp(ConfigKey.testname);
        if (name === testname) {
            return {defaultDeliverable: "d1", deliverableIds: ["d1", "d4"]};
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
            return {
                dockerImage:        "310container",
                studentDelay:       delay,
                maxExecTime:        300,
                regressionDelivIds: [],
                custom:             {},
                openTimestamp:      new Date(2018, 1, 1).getTime(),
                closeTimestamp:     new Date(2018, 6, 1).getTime(),
                lateAutoTest:       false
            };
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

    public async sendResult(result: AutoTestResult): Promise<Payload> {
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

    public async getResult(delivId: string, repoId: string): Promise<AutoTestResultTransport | null> {
        Log.info("MockClassPortal::getResult(..) - start");

        const ds = new MockDataStore();
        return await ds.getResult(delivId, repoId);
    }

    public async getPersonId(userName: string): Promise<AutoTestPersonIdTransport | null> {
        return Promise.resolve({personId: userName});
    }

    public async formatFeedback(gradeRecord: GradeReport, feedbackMode?: string): Promise<string | null> {
        return Promise.resolve(gradeRecord.feedback);
    }

}
