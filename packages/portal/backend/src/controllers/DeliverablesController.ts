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

    public translateTransport(trans: DeliverableTransport): Deliverable | null {

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
