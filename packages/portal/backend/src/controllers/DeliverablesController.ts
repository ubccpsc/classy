import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {AutoTestConfigTransport, DeliverableTransport} from "@common/types/PortalTypes";
import {Deliverable} from "../Types";

import {DatabaseController} from "./DatabaseController";

export class DeliverablesController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllDeliverables(): Promise<Deliverable[]> {
        Log.trace("DeliverablesController::getAllGrades() - start");

        return await this.db.getDeliverables();
    }

    public async getDeliverable(delivId: string): Promise<Deliverable | null> {
        Log.trace("DeliverablesController::getDeliverable( " + delivId + " ) - start");

        return await this.db.getDeliverable(delivId);
    }

    public async saveDeliverable(deliv: Deliverable): Promise<Deliverable | null> {
        Log.info("DeliverableController::saveDeliverable( " + JSON.stringify(deliv) + " ) - start");

        // enforce minimum time constraints; the AutoTest infrastructure is resource constrained
        let MIN_DELAY = 60 * 15; // 15 minutes by default
        if (Config.getInstance().hasProp(ConfigKey.minimum_student_delay) === true) {
            // can be overridden in .env, but this is an explicit choice
            MIN_DELAY = Number(Config.getInstance().getProp(ConfigKey.minimum_student_delay));
        }

        if (deliv.autotest.studentDelay < MIN_DELAY) {
            deliv.autotest.studentDelay = MIN_DELAY;
        }

        await this.db.writeDeliverable(deliv); // let this handle the update
        Log.info("DeliverableController::saveDeliverable(..) - done");
        return deliv;
    }

    /**
     *
     * @param {DeliverableTransport} deliv
     * @returns {string|null} null if the deliverable is valid; string describing the error if there is one.
     */
    public validateDeliverableTransport(deliv: DeliverableTransport): string | null {
        Log.trace("DeliverablesController::validateDeliverableTransport(..) - start");

        if (typeof deliv === "undefined") {
            const msg = "object undefined";
            Log.error("DeliverableController::validateDeliverableTransport(..) - ERROR: " + msg);
            return msg;
        }

        if (deliv === null) {
            const msg = "object null";
            Log.error("DeliverableController::validateDeliverableTransport(..) - ERROR: " + msg);
            return msg;
        }

        if (typeof deliv.id === "undefined" || deliv.id === null || deliv.id.length < 2) {
            const msg = "invalid delivId: " + deliv.id;
            Log.error("DeliverableController::validateDeliverableTransport(..) - ERROR: " + msg);
            return msg;
        }

        Log.trace("DeliverablesController::validateDeliverableTransport(..) - done; object is valid");
        return null;
    }

    public static deliverableToTransport(deliv: Deliverable): DeliverableTransport {
        const at = deliv.autotest as AutoTestConfigTransport; // really AutoTestConfig
        at.openTimestamp = deliv.openTimestamp;
        at.closeTimestamp = deliv.closeTimestamp;

        return {
            id: deliv.id,
            URL: deliv.URL,

            repoPrefix: deliv.repoPrefix,
            teamPrefix: deliv.teamPrefix,

            openTimestamp: deliv.openTimestamp,
            closeTimestamp: deliv.closeTimestamp,

            lateAutoTest: deliv.lateAutoTest,
            shouldProvision: deliv.shouldProvision,
            minTeamSize: deliv.teamMinSize,
            maxTeamSize: deliv.teamMaxSize,
            teamsSameLab: deliv.teamSameLab,
            studentsFormTeams: deliv.teamStudentsForm,
            importURL: deliv.importURL,

            onOpenAction: "",
            onCloseAction: "",

            gradesReleased: deliv.gradesReleased,
            visibleToStudents: deliv.visibleToStudents,

            shouldAutoTest: deliv.shouldAutoTest,
            autoTest: at,
            rubric: deliv.rubric,
            custom: deliv.custom
        } as DeliverableTransport;
    }

    public static transportToDeliverable(trans: DeliverableTransport): Deliverable {

        return {
            id: trans.id,
            URL: trans.URL,

            openTimestamp: trans.openTimestamp,
            closeTimestamp: trans.closeTimestamp,
            gradesReleased: trans.gradesReleased,

            lateAutoTest: trans.lateAutoTest,
            shouldProvision: trans.shouldProvision,
            teamMinSize: trans.minTeamSize,
            teamMaxSize: trans.maxTeamSize,
            teamSameLab: trans.teamsSameLab,
            teamStudentsForm: trans.studentsFormTeams,
            importURL: trans.importURL,

            repoPrefix: trans.repoPrefix,
            teamPrefix: trans.teamPrefix,

            visibleToStudents: trans.visibleToStudents,

            shouldAutoTest: trans.shouldAutoTest,
            autotest: trans.autoTest,

            rubric: trans.rubric,
            custom: trans.custom
        } as Deliverable;
    }
}
