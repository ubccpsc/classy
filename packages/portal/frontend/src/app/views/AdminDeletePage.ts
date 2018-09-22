import {OnsButtonElement} from "onsenui";
import Log from "../../../../../common/Log";
import {UI} from "../util/UI";
import {AdminPage} from "./AdminPage";

export class AdminDeletePage extends AdminPage {

    constructor(remote: string) {
        super(remote);
    }

    public async init(opts: any): Promise<void> {
        const that = this;

        (document.querySelector('#adminDeleteDeliverableButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminDeletePage::handleDeliverableDelete(..) - delete pressed');
            evt.stopPropagation(); // prevents list item expansion

            let value = UI.getTextFieldValue('adminDeleteDeliverableText');
            if (typeof value === 'string') {
                value = value.trim();
            }
            that.deleteDeliverable(value).then(function() {
                // done
            }).catch(function(err) {
                Log.error('AdminDeletePage::handleDeliverableDelete(..) - delete pressed ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminDeleteTeamButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminDeletePage::handleTeamDelete(..) - button pressed');
            evt.stopPropagation(); // prevents list item expansion

            let value = UI.getTextFieldValue('adminDeleteTeamText');
            if (typeof value === 'string') {
                value = value.trim();
            }
            that.deleteTeam(value).then(function() {
                // done
            }).catch(function(err) {
                Log.error('AdminDeletePage::handleTeamDelete(..) - delete pressed ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminDeleteRepositoryButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminDeletePage::handleRepositoryDelete(..) - button pressed');
            evt.stopPropagation(); // prevents list item expansion

            let value = UI.getTextFieldValue('adminDeleteRepositoryText');
            if (typeof value === 'string') {
                value = value.trim();
            }
            that.deleteRepository(value).then(function() {
                // done
            }).catch(function(err) {
                Log.error('AdminDeletePage::handleRepositoryDelete(..) - delete pressed ERROR: ' + err.message);
            });
        };

    }

    private async deleteDeliverable(delivId: string): Promise<boolean> {
        Log.info("AdminDeletePage::deleteDeliverable( " + delivId + " ) - start");
        UI.notificationToast("Deliverable deleted: " + delivId);
        return Promise.resolve(true);
    }

    private async deleteTeam(teamId: string): Promise<boolean> {
        Log.info("AdminDeletePage::deleteTeam( " + teamId + " ) - start");
        UI.notificationToast("Team deleted: " + teamId);
        return Promise.resolve(true);
    }

    private async deleteRepository(repositoryId: string): Promise<boolean> {
        Log.info("AdminDeletePage::deleteRepository( " + repositoryId + " ) - start");
        UI.notificationToast("Repository deleted: " + repositoryId);
        return Promise.resolve(true);
    }

}
