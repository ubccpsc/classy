import {OnsButtonElement} from "onsenui";
import Log from "../../../../../common/Log";
import {AdminConfigTab} from "../views/AdminConfigTab";
import {AdminPullRequestsPage} from "./AdminPullRequestsPage";

export class CustomAdminConfigTab extends AdminConfigTab {
    public async init(opts: any): Promise<void> {
        Log.info('CustomAdminConfigTab::init(..) - start');
        await super.init(opts);

        const that: CustomAdminConfigTab = this;

        (document.querySelector('#adminManagePullRequestsButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - manage PRs page pressed');
            evt.preventDefault();

            that.pushPage('./adminPullRequests.html', {}).then(function() {
                const pullRequestsPage = new AdminPullRequestsPage(that.remote);
                pullRequestsPage.init({}).then(function() {
                    // success
                    Log.info('AdminConfigTab::handleAdminConfig(..) - PRs page init');
                }).catch(function(err) {
                    // error
                    Log.error('AdminConfigTab::handleAdminConfig(..) - PRs page ERROR: ' + err);
                });
            }).catch(function(err) {
                Log.error("AdminConfigTab - adminPullRequests ERROR: " + err.message);
            });
        };
    }
}
