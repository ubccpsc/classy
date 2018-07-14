import Log from "../../../common/Log";

import {DatabaseController} from "./DatabaseController";
import {Deliverable} from "../Types";
import {DeliverableTransport} from "../../../common/types/PortalTypes";

export class DeliverablesController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllDeliverables(): Promise<Deliverable[]> {
        Log.info("DeliverablesController::getAllGrades() - start");

        let delivs = await this.db.getDeliverables();
        return delivs;
    }

    public async getDeliverable(delivId: string): Promise<Deliverable | null> {
        Log.info("DeliverablesController::getDeliverable( " + delivId + " ) - start");

        let deliv = await this.db.getDeliverable(delivId);
        return deliv;
    }


    public async saveDeliverable(deliv: Deliverable): Promise<Deliverable | null> {
        Log.info("DeliverableController::saveDeliverable( " + JSON.stringify(deliv) + " ) - start");
        try {
            // let existingDeliverable = await this.getDeliverable(org, deliv.id);

            await this.db.writeDeliverable(deliv); // let this handle the update
            return deliv;
        } catch (err) {
            Log.error("RepositoryController::createGrade(..) - ERROR: " + err);
            return null;
        }
    }

    /**
     *
     * @param {DeliverableTransport} deliv
     * @returns {string|null} null if the deliverable is valid; string describing the error if there is one.
     */
    public validateDeliverableTransport(deliv: DeliverableTransport): string | null {

        if (typeof deliv === 'undefined') {
            const msg = 'object undefined';
            Log.error('DeliverableController::validateDeliverableTransport(..) - ERROR: ' + msg);
            return msg;
        }

        if (typeof deliv === null) {
            const msg = 'object null';
            Log.error('DeliverableController::validateDeliverableTransport(..) - ERROR: ' + msg);
            return msg;
        }

        if (deliv.id.length < 2) {
            const msg = 'invalid delivId: ' + deliv.id;
            Log.error('DeliverableController::validateDeliverableTransport(..) - ERROR: ' + msg);
            return msg;
        }

        return null;
    }

    public translateTransport(trans: DeliverableTransport): Deliverable | null {

        // let at: AutoTestConfig = {
        //     dockerImage,
        //     maxExecTime,
        //     studentDelay,
        //     regressionDelivIds,
        //     custom: atCustom,
        // };
        //
        // let deliv: DeliverableTransport = {
        //     id,
        //     URL,
        //     openTimestamp,
        //     closeTimestamp,
        //     onOpenAction:  '',// TODO: add this
        //     onCloseAction: '', // TODO: add this
        //     minTeamSize,
        //     maxTeamSize,
        //     studentsFormTeams,
        //     teamsSameLab,
        //     gradesReleased,
        //     autoTest:      at,
        //     custom
        // };

        const deliv: Deliverable = {
            id:         trans.id,
            URL:        trans.URL,
            repoPrefix: '', // TODO: remove

            openTimestamp:  trans.openTimestamp,
            closeTimestamp: trans.closeTimestamp,
            gradesReleased: trans.gradesReleased,

            teamMinSize:      trans.minTeamSize,
            teamMaxSize:      trans.maxTeamSize,
            teamSameLab:      trans.teamsSameLab,
            teamStudentsForm: trans.studentsFormTeams,
            teamPrefix:       '', // TODO: remove

            autotest: trans.autoTest,

            custom: trans.custom
        };


        return deliv;

    }
}
