import Config, {ConfigKey} from '../../../../common/Config';
import Log from "../../../../common/Log";
import {AutoTestConfigTransport, DeliverableTransport} from "../../../../common/types/PortalTypes";
import {Deliverable} from "../Types";

import {DatabaseController} from "./DatabaseController";

export class DeliverablesController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllDeliverables(): Promise<Deliverable[]> {
        Log.info("DeliverablesController::getAllGrades() - start");

        const delivs = await this.db.getDeliverables();
        return delivs;
    }

    public async getDeliverable(delivId: string): Promise<Deliverable | null> {
        Log.info("DeliverablesController::getDeliverable( " + delivId + " ) - start");

        const deliv = await this.db.getDeliverable(delivId);
        return deliv;
    }

    public async saveDeliverable(deliv: Deliverable): Promise<Deliverable | null> {
        Log.info("DeliverableController::saveDeliverable( " + JSON.stringify(deliv) + " ) - start");

        // enforce minimum time constraints; the AutoTest infrastructure is resource constrained
        // this prevents students from hammering against the service and causing it to become overloaded
        // const allStudents = await this.db.getPeople();
        // let numStudents = allStudents.length;
        // if (numStudents < 60) {
        //     numStudents = 60; // enforce a 60 student minumum in case the class list hasn't been uploaded yet
        // }
        // const MIN_DELAY_MULTIPLIER = 2; // number of minutes-per-student the platform can withstand (2-10 are reasonable values)
        // const minDelay = (numStudents * MIN_DELAY_MULTIPLIER) * 60; // minimum delay in seconds
        // if (minDelay < 12 * 60 * 60) { // only use this formula if the delay is less than N hours
        //     if (deliv.autotest.studentDelay < minDelay) {
        //         deliv.autotest.studentDelay = minDelay;
        //     }
        // }

        // the above was pretty complicated
        const MIN_DELAY = Config.getInstance().getProp(ConfigKey.minimum_student_delay) || 60 * 15; // ENV setting or 15 minutes
        if (deliv.autotest.studentDelay < MIN_DELAY) {
            deliv.autotest.studentDelay = MIN_DELAY;
        }

        await this.db.writeDeliverable(deliv); // let this handle the update
        return deliv;
    }

    /**
     *
     * @param {DeliverableTransport} deliv
     * @returns {string|null} null if the deliverable is valid; string describing the error if there is one.
     */
    public validateDeliverableTransport(deliv: DeliverableTransport): string | null {
        Log.trace('DeliverablesController::validateDeliverableTransport(..) - start');

        if (typeof deliv === 'undefined') {
            const msg = 'object undefined';
            Log.error('DeliverableController::validateDeliverableTransport(..) - ERROR: ' + msg);
            return msg;
        }

        if (deliv === null) {
            const msg = 'object null';
            Log.error('DeliverableController::validateDeliverableTransport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof deliv.id === 'undefined' || deliv.id === null || deliv.id.length < 2) {
            const msg = 'invalid delivId: ' + deliv.id;
            Log.error('DeliverableController::validateDeliverableTransport(..) - ERROR: ' + msg);
            return msg;
        }

        Log.trace('DeliverablesController::validateDeliverableTransport(..) - done; object is valid');
        return null;
    }

    public static deliverableToTransport(deliv: Deliverable): DeliverableTransport {
        const at = deliv.autotest as AutoTestConfigTransport; // really AutoTestConfig
        at.openTimestamp = deliv.openTimestamp;
        at.closeTimestamp = deliv.closeTimestamp;

        const trans: DeliverableTransport = {
            id:  deliv.id,
            URL: deliv.URL,

            repoPrefix: deliv.repoPrefix,
            teamPrefix: deliv.teamPrefix,

            openTimestamp:  deliv.openTimestamp,
            closeTimestamp: deliv.closeTimestamp,

            lateAutoTest:      deliv.lateAutoTest,
            shouldProvision:   deliv.shouldProvision,
            minTeamSize:       deliv.teamMinSize,
            maxTeamSize:       deliv.teamMaxSize,
            teamsSameLab:      deliv.teamSameLab,
            studentsFormTeams: deliv.teamStudentsForm,
            importURL:         deliv.importURL,

            onOpenAction:  '',
            onCloseAction: '',

            gradesReleased:    deliv.gradesReleased,
            visibleToStudents: deliv.visibleToStudents,

            shouldAutoTest: deliv.shouldAutoTest,
            autoTest:       at,
            rubric:         deliv.rubric,
            custom:         deliv.custom
        };
        return trans;
    }

    public static transportToDeliverable(trans: DeliverableTransport): Deliverable {

        const deliv: Deliverable = {
            id:  trans.id,
            URL: trans.URL,

            openTimestamp:  trans.openTimestamp,
            closeTimestamp: trans.closeTimestamp,
            gradesReleased: trans.gradesReleased,

            lateAutoTest:     trans.lateAutoTest,
            shouldProvision:  trans.shouldProvision,
            teamMinSize:      trans.minTeamSize,
            teamMaxSize:      trans.maxTeamSize,
            teamSameLab:      trans.teamsSameLab,
            teamStudentsForm: trans.studentsFormTeams,
            importURL:        trans.importURL,

            repoPrefix: trans.repoPrefix,
            teamPrefix: trans.teamPrefix,

            visibleToStudents: trans.visibleToStudents,

            shouldAutoTest: trans.shouldAutoTest,
            autotest:       trans.autoTest,

            rubric: trans.rubric,
            custom: trans.custom
        };

        return deliv;
    }
}
