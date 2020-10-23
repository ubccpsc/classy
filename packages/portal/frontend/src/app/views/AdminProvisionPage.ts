import {OnsButtonElement} from "onsenui";

import Log from "../../../../../common/Log";
import {DeliverableTransport, Payload, RepositoryTransport} from "../../../../../common/types/PortalTypes";
import Util from "../../../../../common/Util";

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

        this.clearLists();

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

    private clearLists() {
        const toProvisionSelect = document.getElementById("repositoryProvisionSelect") as HTMLSelectElement;
        const provisionedUL = document.getElementById("repositoryProvisionedUL") as HTMLUListElement;
        const toReleaseSelect = document.getElementById("repositoryReleaseSelect") as HTMLSelectElement;
        const releasedUL = document.getElementById("repositoryReleasedUL") as HTMLUListElement;

        const releaseButton = document.getElementById('adminManageReleaseButton') as HTMLButtonElement;
        const provisionButton = document.getElementById('adminManageProvisionButton') as HTMLButtonElement;
        releaseButton.disabled = false;
        provisionButton.disabled = false;

        const delivSelect = document.getElementById('provisionRepoDeliverableSelect') as HTMLSelectElement;
        delivSelect.disabled = false;

        toProvisionSelect.disabled = false;
        toReleaseSelect.disabled = false;

        toProvisionSelect.innerHTML = '';
        provisionedUL.innerHTML = '';
        toReleaseSelect.innerHTML = '';
        releasedUL.innerHTML = '';
    }

    private disableElements() {
        const toProvisionSelect = document.getElementById("repositoryProvisionSelect") as HTMLSelectElement;
        const toReleaseSelect = document.getElementById("repositoryReleaseSelect") as HTMLSelectElement;
        const releaseButton = document.getElementById('adminManageReleaseButton') as HTMLButtonElement;
        const provisionButton = document.getElementById('adminManageProvisionButton') as HTMLButtonElement;
        const delivSelect = document.getElementById('provisionRepoDeliverableSelect') as HTMLSelectElement;
        delivSelect.disabled = true;
        releaseButton.disabled = true;
        provisionButton.disabled = true;
        toReleaseSelect.disabled = true;
        toProvisionSelect.disabled = true;
    }

    private async handleDelivChanged(): Promise<void> {
        const toProvisionSelect = document.getElementById("repositoryProvisionSelect") as HTMLSelectElement;
        const provisionedUL = document.getElementById("repositoryProvisionedUL") as HTMLUListElement;
        const toReleaseSelect = document.getElementById("repositoryReleaseSelect") as HTMLSelectElement;
        const releasedUL = document.getElementById("repositoryReleasedUL") as HTMLUListElement;

        const val = UI.getDropdownValue('provisionRepoDeliverableSelect');
        Log.info('AdminProvisionPage::init(..) - new deliverable selected: ' + val);
        if (val !== '-None-') {
            try {
                this.clearLists();

                // update provisioned
                const provisionRepo = await this.getProvisionDetails(val);
                Log.info('AdminProvisionPage::init(..) - planning provisioning worked: ' + provisionRepo);

                let provisioned = [];
                let toProvision = [];

                for (const repo of provisionRepo) {
                    if (repo.URL === null) {
                        // Log.trace('Repo to provision: ' + repo.id + '; URL: ' + repo.URL);
                        toProvision.push(repo.id);
                    } else {
                        // Log.trace('Repo already provisioned: ' + repo.id + '; URL: ' + repo.URL);
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

                // release

                // update provisioned
                const reposToRelease = await this.getReleaseDetails(val);
                Log.info('AdminProvisionPage::init(..) - planning releasing worked: ' + reposToRelease);

                let released: string[] = [];
                let toRelease: string[] = [];

                for (const repo of reposToRelease) {
                    // Log.info("repo for release: " + JSON.stringify(repo));
                    if (repo.URL === null) {
                        toRelease.push(repo.id);
                    } else {
                        released.push(repo.id);
                    }
                }

                released = released.sort();
                toRelease = toRelease.sort();

                if (released.length === 0) {
                    const li = document.createElement('li');
                    li.appendChild(document.createTextNode("No released repositories"));
                    releasedUL.appendChild(li);
                }

                if (toRelease.length === 0) {
                    const option = document.createElement("option");
                    option.text = "Nothing to release";
                    toReleaseSelect.add(option);
                }

                for (const releasedName of released) {
                    const li = document.createElement('li');
                    li.appendChild(document.createTextNode(releasedName));
                    releasedUL.appendChild(li);
                }

                for (const toReleaseName of toRelease) {
                    const option = document.createElement("option");
                    option.text = toReleaseName;
                    toReleaseSelect.add(option);
                }

            } catch (err) {
                Log.error('AdminProvisionPage::init(..) - ERROR planning provisioning / releasing: ' + err);
            }
        } else {
            // none selected; clear selects
            this.clearLists();
        }
    }

    private async handleReleasePressed(): Promise<boolean> {
        // Log.info('AdminProvisionPage::handleReleasePressed(..) - start');
        //
        // const delivId = UI.getDropdownValue('provisionRepoDeliverableSelect');
        // const provision: ProvisionTransport = {delivId: delivId, formSingle: false};
        //
        // const url = this.remote + '/portal/admin/release';
        // const options: any = AdminView.getOptions();
        // options.method = 'post';
        // options.body = JSON.stringify(provision); // TODO: handle formSingle correctly
        //
        // UI.showModal("Releasing repositories for " + delivId + ". Please be patient.");
        //
        // const start = Date.now();
        // Log.trace('AdminProvisionPage::handleReleasePressed(..) - GET from: ' + url);
        // const response = await fetch(url, options);
        // const json: Payload = await response.json();
        // Log.trace('AdminProvisionPage::handleReleasePressed(..) - complete; took: ' + Util.took(start));
        //
        // UI.hideModal();
        // UI.showSuccessToast('Repositories released.', {timeout: 10000, buttonLabel: 'Ok'});
        //
        // if (typeof json.success !== 'undefined') {
        //     Log.info('AdminProvisionPage::handleReleasePressed(..) - success'); // + json.success);
        //     return json.success;
        // } else {
        //     Log.error('AdminProvisionPage::handleReleasePressed(..) - ERROR: ' + json.failure);
        // }
        // return true;

        Log.info('AdminProvisionPage::handleReleasePressed(..) - start');

        const releaseList = document.getElementById("repositoryReleaseSelect") as HTMLSelectElement;
        const selected = [];

        // tslint:disable-next-line
        for (let i = 0; i < releaseList.options.length; i++) {
            const opt = releaseList.options[i];
            if (opt.selected) {
                selected.push(opt.value || opt.text);
            }
        }

        Log.info('AdminProvisionPage::handleReleasePressed(..) - start; # repos to provision: ' + selected.length);
        if (selected.length > 0) {
            UI.showSuccessToast('Repo releasing in progress; this will take a while. Do not close this browser window.');
        } else {
            UI.showErrorToast('No repos selected for releasing.');
        }

        // tslint:disable-next-line
        for (let i = 0; i < selected.length; i++) {
            const repoId = selected[i];
            try {
                const start = Date.now();
                await this.releaseRepo(repoId);
                Log.info('AdminProvisionPage::handleReleasePressed(..) - releasing complete; repo: ' + repoId +
                    '; took: ' + Util.took(start));
                UI.showSuccessToast('Repo released: ' + repoId + ' ( ' + (i + 1) + ' of ' + selected.length + ' )',
                    {timeout: 1000, animation: 'none'});
            } catch (err) {
                Log.error('AdminProvisionPage::handleReleasePressed(..) - releasing error for: ' + repoId + '; ERROR: ' + err.message);
                UI.showErrorToast('Repo NOT released: ' + repoId + ' (see error console)');
            }
        }

        Log.info('AdminProvisionPage::handleReleasePressed(..) - done');
        if (selected.length > 0) {
            UI.showSuccessToast('Repository releasing complete.', {timeout: 20000, buttonLabel: 'Ok'});
        }
        // refresh the page
        await this.init({});
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

        Log.info('AdminProvisionPage::handleProvisionPressed(..) - start; # repos to provision: ' + selected.length);
        if (selected.length > 0) {
            UI.showSuccessToast('Repo provisioning in progress; this will take a while. Do not close this browser window.',
                {timeout: 10000});
        } else {
            UI.showErrorToast('No repos selected for provisioning.');
        }

        // tslint:disable-next-line
        for (let i = 0; i < selected.length; i++) {
            const repoId = selected[i];
            try {
                const delivId = UI.getDropdownValue('provisionRepoDeliverableSelect');
                const start = Date.now();
                await this.provisionRepo(delivId, repoId);
                Log.info('AdminProvisionPage::handleProvision(..) - provisioning complete; repo: ' + repoId +
                    '; took: ' + Util.took(start));
                UI.showSuccessToast('Repo provisioned: ' + repoId + ' ( ' + (i + 1) + ' of ' + selected.length + ' )',
                    {timeout: 10000, force: true});
            } catch (err) {
                Log.error('AdminProvisionPage::handleProvision(..) - provisioning error for: ' + repoId + '; ERROR: ' + err.message);
                UI.showErrorToast('Repo NOT provisioned: ' + repoId + ' (see error console)');
            }
        }

        Log.info('AdminProvisionPage::handleProvision(..) - done');
        if (selected.length > 0) {
            UI.showSuccessToast('Repository provisioning complete.', {timeout: 20000, buttonLabel: 'Ok'});
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

        Log.trace('AdminProvisionPage::getProvisionDetails(..) - GET from: ' + url);
        const start = Date.now();
        const response = await fetch(url, options);
        const json: Payload = await response.json();
        UI.hideModal();

        if (typeof json.success !== 'undefined') {
            Log.info('AdminProvisionPage::getProvisionDetails(..) - success; took: ' + Util.took(start));
            return json.success;
        } else {
            Log.error('AdminProvisionPage::getProvisionDetails(..) - ERROR: ' + json.failure);
        }
        return [];
    }

    private async getReleaseDetails(delivId: any): Promise<RepositoryTransport[]> {
        const url = this.remote + '/portal/admin/release/' + delivId;
        const options: any = AdminView.getOptions();
        options.method = 'get';

        UI.showModal("Retrieving release details for " + delivId);

        Log.trace('AdminProvisionPage::getReleaseDetails(..) - GET from: ' + url);
        const start = Date.now();
        const response = await fetch(url, options);
        const json: Payload = await response.json();
        UI.hideModal();

        if (typeof json.success !== 'undefined') {
            Log.info('AdminProvisionPage::getReleaseDetails(..) - success; took: ' + Util.took(start));
            return json.success;
        } else {
            Log.error('AdminProvisionPage::getReleaseDetails(..) - ERROR: ' + json.failure);
        }
        return [];
    }

    public renderPage(pageName: string, opts: {}): void {
        Log.info("AdminProvisionPage::renderPage( " + pageName + ", ... ) - start");
    }

    private async provisionRepo(delivId: string, repoId: string): Promise<boolean> {
        Log.info("AdminProvisionPage::provisionRepo( " + delivId + ", " + repoId + " ) - start");

        const url = this.remote + '/portal/admin/provision/' + delivId + '/' + repoId;
        return await this.performAction(url);
    }

    private async releaseRepo(repoId: string): Promise<boolean> {
        Log.info("AdminProvisionPage::releaseRepo( " + repoId + " ) - start");

        const url = this.remote + '/portal/admin/release/' + repoId;
        return await this.performAction(url);
    }

    private async performAction(url: string): Promise<boolean> {
        const options: any = AdminView.getOptions();
        options.method = 'post';

        this.disableElements();

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
