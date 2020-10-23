import {OnsButtonElement} from "onsenui";
// import Config, {ConfigKey} from "../../../../../common/Config";
import Log from "../../../../../common/Log";
import {Payload, RepositoryTransport} from "../../../../../common/types/PortalTypes";
import Util from "../../../../../common/Util";
import {UI} from "../util/UI";
import {AdminPage} from "./AdminPage";
import {AdminView} from "./AdminView";

export class AdminPullRequestsPage extends AdminPage {
    private patchSourceRepo: string;
    private patches: string[];
    private repos: string[];

    constructor(remote: string) {
        super(remote);
    }

    public async init(opts: any): Promise<void> {
        const that = this;
        Log.info("AdminPullRequestsPage::init(..) - start");

        UI.showModal("Retrieving Patches and Repositories");

        await this.enableSelectors();
        await this.populatePatches();
        await this.populateRepos();

        (document.querySelector('#adminViewPatch') as OnsButtonElement).onclick = function(evt) {
            Log.info("AdminPullRequestsPage::viewPatchButton(..) - button pressed");
            evt.stopPropagation(); // prevents list item expansion
            that.handleViewPatch().then(function() {
                // worked
            }).catch(function(err) {
                // didn't
            });
        };

        (document.querySelector('#adminRefreshPatches') as OnsButtonElement).onclick = function(evt) {
            Log.info("AdminPullRequestsPage::refreshPatchesButton(..) - button pressed");
            evt.stopPropagation(); // prevents list item expansion
            that.handlePatchRefresh().then(function() {
                // worked
            }).catch(function(err) {
                // didn't
            });
        };

        (document.querySelector('#adminPatchSubsetOfReposButton') as OnsButtonElement).onclick = function(evt) {
            Log.info("AdminPullRequestsPage::patchSubsetRepos(..) - button pressed");
            evt.stopPropagation(); // prevents list item expansion
            that.handlePatchSubset().then(function() {
                // worked
            }).catch(function(err) {
                // didn't
            });
        };

        (document.querySelector('#adminPatchAllReposButton') as OnsButtonElement).onclick = function(evt) {
            Log.info("AdminPullRequestsPage::patchAllRepos(..) - button pressed");
            evt.stopPropagation(); // prevents list item expansion
            that.handlePatchAll().then(function() {
                // worked
            }).catch(function(err) {
                // didn't
            });
        };

        const patchSelector = document.querySelector('#adminPatchSelect') as HTMLSelectElement;
        patchSelector.onchange = function(evt) {
            evt.stopPropagation(); // prevents list item expansion
        };

        UI.hideModal();
    }

    private async enableSelectors(): Promise<void> {
        (document.getElementById("adminRefreshPatches") as HTMLButtonElement).disabled = false;
        (document.getElementById("repositoryPatchSelect") as HTMLSelectElement).disabled = false;
        (document.getElementById("adminViewPatch") as HTMLButtonElement).disabled = false;
    }

    private async populatePatches(): Promise<void> {
        this.patchSourceRepo = await this.getPatchSourceRepo();
        this.patches = await this.getPatches();
        this.patches = this.patches.sort();
        const displayPatches = ['-None-', ...this.patches];
        UI.setDropdownOptions('adminPatchSelect', displayPatches, null);
    }

    private async populateRepos(): Promise<void> {
        try {
            const repositorySelect = document.getElementById("repositoryPatchSelect") as HTMLSelectElement;
            this.repos = (await this.getAllRepos()).map((repo) => repo.id);
            this.repos.sort();
            if (this.repos.length === 0) {
                const option = document.createElement("option");
                option.text = "No repos to patch";
                repositorySelect.add(option);
                repositorySelect.disabled = true;
            } else {
                repositorySelect.innerHTML = '';
                for (const repo of this.repos) {
                    const option = document.createElement("option");
                    option.text = repo;
                    repositorySelect.add(option);
                }
                repositorySelect.disabled = false;
            }
        } catch (err) {
            Log.error("AdminPullRequestsPage::populateRepos(..) - ERROR listing repos: " + err);
        }
    }

    private async getAllRepos(): Promise<RepositoryTransport[]> {
        const url = this.remote + '/portal/admin/repositories';
        const options: any = AdminView.getOptions();
        options.method = 'get';

        const start = Date.now();
        const response = await fetch(url, options);
        const json: Payload = await response.json();

        if (typeof json.success !== 'undefined') {
            Log.info("AdminPullRequestsPage::getAllRepos(..) - success; took: " + Util.took(start));
            return json.success;
        } else {
            Log.error("AdminPullRequestsPage::getAllRepos(..) - ERROR: " + json.failure);
        }
        return [];
    }

    private async handleViewPatch(): Promise<void> {
        const patch = UI.getDropdownValue('adminPatchSelect');
        if (patch === "-None-") {
            UI.showErrorToast("No patch has been selected.");
        } else if (this.patchSourceRepo === "") {
            UI.showErrorToast("No patch source repo was found to view.");
        } else {
            const address = `${this.patchSourceRepo.replace(/\.git$/, "")}/tree/master/${patch}/diff`;
            window.open(address, '_blank');
        }
    }

    private async handlePatchRefresh(): Promise<void> {
        try {
            UI.showModal("Refreshing Patches");
            const url = this.remote + '/portal/admin/updatePatches';
            const options: any = AdminView.getOptions();
            options.method = 'post';

            const start = Date.now();
            const response = await fetch(url, options);
            const json: Payload = await response.json();

            if (typeof json.success !== 'undefined') {
                Log.info("AdminPullRequestsPage::handlePatchRefresh(..) - update success; took: " + Util.took(start));
                await this.populatePatches();
                UI.showSuccessToast("Patches Refreshed.", {timeout: 10000, buttonLabel: 'Ok'});
            } else {
                Log.error("AdminPullRequestsPage::handlePatchRefresh(..) - ERROR: " + json.failure);
                UI.showErrorToast("Couldn't refresh patches. Failure received from patchtool (see error console)");
            }
        } catch (err) {
            Log.error("AdminPullRequestsPage::handlePatchRefresh(..) - Error refreshing patches: " + err);
            UI.showErrorToast("Couldn't refresh patches.");
        } finally {
            UI.hideModal();
        }
    }

    private async handlePatchSubset(): Promise<void> {
        const repositorySelect = document.getElementById("repositoryPatchSelect") as HTMLSelectElement;
        if (repositorySelect.disabled) {
            UI.showErrorToast("No repos have been selected.");
            return;
        }
        const patchRepoList = Array.from(repositorySelect.options)
            .filter((opt) => opt.selected)
            .map((opt) => (opt.value || opt.text));
        await this.patchListOfRepos(patchRepoList);
    }

    private async patchListOfRepos(repoList: string[]): Promise<void> {
        const patch = UI.getDropdownValue('adminPatchSelect');
        const root = UI.getToggleValue('headOrRoot');
        if (repoList.length < 1) {
            UI.showErrorToast("There are no repos to patch.");
        } else if (patch === '-None-') {
            UI.showErrorToast("No patch has been selected.");
        } else {
            UI.showSuccessToast("Patching commenced. Do not close this browser window.", {timeout: 10000, buttonLabel: 'Ok'});
            let i = 0;
            for (const repo of repoList) {
                const start = Date.now();
                try {
                    const res = await this.patchRepo(repo, patch, root);
                    if (res) {
                        Log.info("AdminPullRequestPage::patchListOfRepos(..) - patching complete; repo: " + repo +
                            "; took: " + Util.took(start));
                        UI.showSuccessToast("Repo patched: " + repo + " ( " + (++i) + " of " + repoList.length + " )",
                            {timeout: 1000, animation: 'none'});
                    } else {
                        ++i;
                        throw new Error();
                    }
                } catch (err) {
                    Log.error("AdminPullRequestPage::patchListOfRepos(..) - patching error for: " + patch + ".");
                    UI.showErrorToast("Repo NOT patched: " + repo + " (see error console)");
                }
            }
            Log.info("AdminPullRequestPage::patchListOfRepos(..) - done");
            UI.showSuccessToast("Repository patching complete.", {timeout: 20000, buttonLabel: 'Ok'});
            await this.init({}); // Refresh the page
        }
    }

    private async patchRepo(repo: string, patch: string, root: boolean): Promise<boolean> {
        const url = this.remote + `/portal/admin/patchRepo/${repo}/${patch}/${root}`;
        const options: any = AdminView.getOptions();
        options.method = 'post';
        const res = await fetch(url, options);
        const body = await res.json();
        if (res.status !== 200) {
            Log.warn(`AdminPullRequestsPage::patchRepo() - Repo not patched successfully: ${repo}`);
            return false;
        } else {
            return true;
        }
    }

    private async handlePatchAll(): Promise<void> {
        await this.patchListOfRepos(this.repos);
    }

    private async getPatches(): Promise<string[]> {
        const url = this.remote + '/portal/admin/listPatches';
        const options: any = AdminView.getOptions();
        options.method = 'get';

        const start = Date.now();
        const response = await fetch(url, options);
        const json: Payload = await response.json();

        if (typeof json.success !== 'undefined') {
            Log.info("AdminPullRequestsPage::getPatches(..) - success; took: " + Util.took(start));
            return json.success;
        } else {
            Log.error("AdminPullRequestsPage::getPatches(..) - ERROR: " + json.failure);
        }
        return [];
    }

    private async getPatchSourceRepo(): Promise<string> {
        const url = this.remote + '/portal/admin/patchSource';
        const options: any = AdminView.getOptions();
        options.method = 'get';

        const start = Date.now();
        const response = await fetch(url, options);
        const json: Payload = await response.json();

        if (typeof json.success !== 'undefined') {
            Log.info("AdminPullRequestsPage::getPatchSourceRepo(..) - success; took: " + Util.took(start));
            return json.success;
        } else {
            Log.error("AdminPullRequestsPage::getPatchSourceRepo(..) - ERROR: " + json.failure);
            UI.showErrorToast("No patch source repo was found in environment. Patch refresh not possible.");
            (document.getElementById("adminRefreshPatches") as HTMLButtonElement).disabled = true;
            (document.getElementById("adminViewPatch") as HTMLButtonElement).disabled = true;
            return "";
        }
    }
}
