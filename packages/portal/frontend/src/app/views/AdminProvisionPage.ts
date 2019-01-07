import {OnsButtonElement} from "onsenui";

import Log from "../../../../../common/Log";
import {DeliverableTransport, Payload, ProvisionTransport, RepositoryTransport} from "../../../../../common/types/PortalTypes";

import {UI} from "../util/UI";

import {AdminDeliverablesTab} from "./AdminDeliverablesTab";
import {AdminPage} from "./AdminPage";
import {AdminView} from "./AdminView";

export class AdminProvisionPage extends AdminPage {

    private deliverables: DeliverableTransport[];

    constructor(remote: string) {
        super(remote);
    }

    public async init(opts: any): Promise<void> {
        const that = this;
        Log.info('AdminProvisionPage::init(..) - start');

        UI.showModal('Retrieving Deliverables.');

        this.deliverables = await AdminDeliverablesTab.getDeliverables(this.remote);

        // this.teams = await AdminTeamsTab.getTeams(this.remote);
        // this.repos = await AdminResultsTab.getRepositories(this.remote);

        this.deliverables = this.deliverables.sort(function compare(a: DeliverableTransport, b: DeliverableTransport) {
            return a.id.localeCompare(b.id);
        });

        const delivOptions = [];
        delivOptions.push('-None-');
        for (const deliv of this.deliverables) {
            if (deliv.shouldProvision === true) {
                delivOptions.push(deliv.id);
            }
        }
        UI.setDropdownOptions('provisionRepoDeliverableSelect', delivOptions, null);

        // clear options
        const toProvisionSelect = document.getElementById("repositoryProvisionSelect") as HTMLSelectElement;
        toProvisionSelect.innerHTML = '';
        const provisionedUL = document.getElementById("repositoryProvisionedUL") as HTMLUListElement;
        provisionedUL.innerHTML = '';

        (document.querySelector('#adminManageProvisionButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminProvisionPage::manageProvisionButton(..) - button pressed');
            evt.stopPropagation(); // prevents list item expansion
            that.handleProvisionPressed().then(function() {
                // worked
            }).catch(function(err) {
                // didn't
            });
        };

        (document.querySelector('#adminManageReleaseButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminProvisionPage::manageReleaseButton(..) - button pressed');
            evt.stopPropagation(); // prevents list item expansion
            that.handleReleasePressed().then(function() {
                // worked
            }).catch(function(err) {
                // didn't
            });
        };

        const delivSelector = document.querySelector('#provisionRepoDeliverableSelect') as HTMLSelectElement;
        delivSelector.onchange = function(evt) {
            evt.stopPropagation(); // prevents list item expansion

            that.handleDelivChanged().then(function() {
                //
            }).catch(function(err) {
                //
            });
        };

        UI.hideModal();
    }

    private async handleDelivChanged(): Promise<void> {
        const toProvisionSelect = document.getElementById("repositoryProvisionSelect") as HTMLSelectElement;
        const provisionedUL = document.getElementById("repositoryProvisionedUL") as HTMLUListElement;

        const val = UI.getDropdownValue('provisionRepoDeliverableSelect');
        Log.info('AdminProvisionPage::init(..) - new deliverable selected: ' + val);
        if (val !== '-None-') {
            try {
                // update
                const repos = await this.getProvisionDetails(val);
                Log.info('AdminProvisionPage::init(..) - planning provisioning worked: ' + repos);

                toProvisionSelect.innerHTML = '';
                provisionedUL.innerHTML = '';

                let provisioned = [];
                let toProvision = [];

                for (const repo of repos) {
                    if (repo.URL === null) {
                        Log.info('repo to provision: ' + repo.id + '; URL: ' + repo.URL);
                        toProvision.push(repo.id);
                    } else {
                        Log.info('repo already provisioned: ' + repo.id + '; URL: ' + repo.URL);
                        provisioned.push(repo.id);
                    }
                }

                provisioned = provisioned.sort();
                toProvision = toProvision.sort();

                if (provisioned.length === 0) {
                    const li = document.createElement('li');
                    li.appendChild(document.createTextNode("No provisioned repositories"));
                    provisionedUL.appendChild(li);
                }

                if (toProvision.length === 0) {
                    const option = document.createElement("option");
                    option.text = "Nothing to provision";
                    toProvisionSelect.add(option);
                }

                for (const provisionedName of provisioned) {
                    const li = document.createElement('li');
                    li.appendChild(document.createTextNode(provisionedName));
                    provisionedUL.appendChild(li);
                }

                for (const toProvisionName of toProvision) {
                    const option = document.createElement("option");
                    option.text = toProvisionName;
                    toProvisionSelect.add(option);
                }

            } catch (err) {
                Log.error('AdminProvisionPage::init(..) - ERROR planning provisioning: ' + err);
            }
        } else {
            // none selected; clear selects
            toProvisionSelect.innerHTML = '';
        }
    }

    private async handleReleasePressed(): Promise<boolean> {
        Log.info('AdminProvisionPage::handleReleasePressed(..) - start');

        const delivId = UI.getDropdownValue('provisionRepoDeliverableSelect');
        const provision: ProvisionTransport = {delivId: delivId, formSingle: false};

        const url = this.remote + '/portal/admin/release';
        const options: any = AdminView.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(provision); // TODO: handle formSingle correctly

        UI.showModal("Releasing repositories for " + delivId + ". Please be patient.");

        Log.trace('AdminProvisioningPage::handleReleasePressed(..) - GET from: ' + url);
        const response = await fetch(url, options);
        const json: Payload = await response.json();
        UI.hideModal();
        UI.showSuccessToast('Repositories released.', {timeout: 10000});

        if (typeof json.success !== 'undefined') {
            Log.info('AdminProvisioningPage::handleReleasePressed(..) - received: ' + json.success);
            return json.success;
        } else {
            Log.error('AdminProvisioningPage::handleReleasePressed(..) - ERROR: ' + json.failure);
        }
        return true;
    }

    private async handleProvisionPressed(): Promise<boolean> {
        Log.info('AdminProvisionPage::handleProvisionPressed(..) - start');

        const provisionList = document.getElementById("repositoryProvisionSelect") as HTMLSelectElement;
        const selected = [];

        // tslint:disable-next-line
        for (let i = 0; i < provisionList.options.length; i++) {
            const opt = provisionList.options[i];
            if (opt.selected) {
                selected.push(opt.value || opt.text);
            }
        }

        Log.info('AdminDeletePage::handleProvisionPressed(..) - start; # repos to provision: ' + selected.length);
        if (selected.length > 0) {
            UI.showSuccessToast('Repo provisioning in progress; this will take a while. Do not close this browser window.', 5000);
        } else {
            UI.showErrorToast('No repos selected for provisioning.');
        }

        // tslint:disable-next-line
        for (let i = 0; i < selected.length; i++) {
            const repoId = selected[i];
            try {
                const delivId = UI.getDropdownValue('provisionRepoDeliverableSelect');
                await this.provisionRepo(delivId, repoId);
                Log.info('AdminDeletePage::handleProvision(..) - provisioning complete; repo: ' + repoId);
                UI.showSuccessToast('Repo provisioned: ' + repoId + ' ( ' + (i + 1) + ' of ' + selected.length + ' )');
            } catch (err) {
                Log.error('AdminDeletePage::handleProvision(..) - provisioning error for: ' + repoId + '; ERROR: ' + err.message);
                UI.showErrorToast('Repo NOT provisioned: ' + repoId + ' (see error console)');
            }
        }

        Log.info('AdminDeletePage::handleProvision(..) - done');
        if (selected.length > 0) {
            UI.showSuccessToast('Repository provisioning complete.');
        }
        // refresh the page
        await this.init({});
        return true;
    }

    private async getProvisionDetails(delivId: any): Promise<RepositoryTransport[]> {
        const url = this.remote + '/portal/admin/provision/' + delivId;
        const options: any = AdminView.getOptions();
        options.method = 'get';

        UI.showModal("Retrieving provisioning details for " + delivId);

        Log.trace('AdminProvisioningPage::getProvisionDetails(..) - GET from: ' + url);
        const response = await fetch(url, options);
        const json: Payload = await response.json();
        UI.hideModal();

        if (typeof json.success !== 'undefined') {
            Log.info('AdminProvisioningPage::getProvisionDetails(..) - received: ' + json.success);
            return json.success;
        } else {
            Log.error('AdminProvisioningPage::getProvisionDetails(..) - ERROR: ' + json.failure);
        }
        return [];
    }

    public renderPage(pageName: string, opts: {}): void {
        Log.info("AdminProvisionPage::renderPage( " + pageName + ", ... ) - start");
    }

    private async provisionRepo(delivId: string, repoId: string): Promise<boolean> {
        Log.info("AdminDeletePage::provisionRepo( " + delivId + ", " + repoId + " ) - start");

        const url = this.remote + '/portal/admin/provision/' + delivId + '/' + repoId;
        return await this.performAction(url);
    }

    private async performAction(url: string): Promise<boolean> {
        const options: any = AdminView.getOptions();
        options.method = 'post';

        const response = await fetch(url, options);
        const body = await response.json();
        if (typeof body.success !== 'undefined') {
            return true;
        } else {
            Log.error("Provision ERROR: " + body.failure.message);
            UI.showError(body.failure.message);
            return false;
        }
    }

}
