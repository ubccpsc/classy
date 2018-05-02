import Log from "../../../common/Log";
import {DatabaseController} from "./DatabaseController";
import {Deliverable} from "../Types";

export class DeliverablesController {

    private db: DatabaseController = DatabaseController.getInstance();

    public async getAllDeliverables(org: string): Promise<Deliverable[]> {
        Log.info("DeliverablesController::getAllGrades( " + org + " ) - start");

        let delivs = await this.db.getDeliverables(org);
        return delivs;
    }

    public async getDeliverable(org: string, delivId: string): Promise<Deliverable | null> {
        Log.info("DeliverablesController::getDeliverable( " + org + ", " + delivId + " ) - start");

        let deliv = await this.db.getDeliverable(org, delivId);
        return deliv;
    }


    public async saveDeliverable(org: string, deliv: Deliverable): Promise<Deliverable | null> {
        Log.info("DeliverableController::saveDeliverable( " + org + ", " + JSON.stringify(deliv) + " ) - start");
        try {
            // let existingDeliverable = await this.getDeliverable(org, deliv.id);

            await this.db.writeDeliverable(deliv); // let this handle the update
            return deliv;
        } catch (err) {
            Log.error("RepositoryController::createGrade(..) - ERROR: " + err);
            return null;
        }
    }
}
