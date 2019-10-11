import Config, {ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import Util from "../../../common/Util";
import {GitHubActions} from "../src/controllers/GitHubActions";

/**
 * This is for updating the webhooks for every repo in an organization.
 *
 * Useful if you need to update the webhook target or the webhook secret for all repos.
 *
 */
export class WebhookUpdater {

    /**
     * Set to false if you actually want to update the hooks.
     *
     * @type {boolean}
     */
    private DRY_RUN = true; // always true when committing

    /**
     * The URL you wan the hooks to be updated to point to. The secret will be automatically calculated using the .env.
     *
     * @type {string}
     */
        // private HOOK_URL = 'https://localhost/portal/githubWebhook';
    private HOOK_URL = 'https://sdmm.cs.ubc.ca/portal/githubWebhook';

    private gha = GitHubActions.getInstance(true);

    constructor() {
        Log.info("WebhookUpdater::<init> - start");
        const config = Config.getInstance();

        Log.warn("WebhookUpdater::<init> - ORGNAME: " + config.getProp(ConfigKey.org));

        // if (config.getProp(ConfigKey.org) !== config.getProp(ConfigKey.testorg)) {
        //     Log.error("WebhookUpdater::<init> - org is not the test org. You probably REALLY REALLY do not want to do this");
        //     this.DRY_RUN = true; // force back to dry run
        // }
    }

    public async run(): Promise<void> {
        await this.updateHooks();
    }

    private async updateHooks(): Promise<void> {
        Log.info("WebhookUpdater::updateHooks() - start");

        const REPOS_TO_IGNORE = ['PostTestDoNotDelete1', 'PostTestDoNotDelete', 'bootstrap',
            'capstone', 'project_oracle', 'course-csv-dataset ', 'classy'];

        const reposToUpdate = [];
        const repos = await this.gha.listRepos();
        for (const repo of repos) {
            if (REPOS_TO_IGNORE.indexOf(repo.repoName) >= 0) {
                Log.info("WebhookUpdater::updateHooks() - repo to IGNORE: " + repo.repoName);
            } else {
                Log.info("WebhookUpdater::updateHooks() - repo to UPDATE: " + repo.repoName);
                reposToUpdate.push(repo);
            }
        }

        for (const repo of reposToUpdate) {
            const currentHooks = await this.gha.listWebhooks(repo.repoName) as any[];
            let currHook = '_NOT-SET_';
            if (currentHooks.length === 1 && typeof currentHooks[0].config !== 'undefined') {
                currHook = currentHooks[0].config.url;
            }

            if (this.DRY_RUN === false) {
                if (currHook === this.HOOK_URL) {
                    Log.info("WebhookUpdater::updateHooks() - hook correct for repo: " + repo.repoName);
                } else {
                    Log.warn("WebhookUpdater::updateHooks() - fixing hook for repo: " + repo.repoName +
                        "; current: " + currHook + "; new: " + this.HOOK_URL);
                    await this.gha.updateWebhook(repo.repoName, this.HOOK_URL);
                    Log.info("WebhookUpdater::updateHooks() - done updating: " + repo.repoName);
                }

            } else {
                if (currHook === this.HOOK_URL) {
                    Log.info("WebhookUpdater::updateHooks() - dry run; hook correct for repo: " + repo.repoName);
                } else {
                    Log.warn("WebhookUpdater::updateHooks() - dry run; fixing hook for repo: " + repo.repoName +
                        "; current: " + currHook + "; new: " + this.HOOK_URL);
                }
            }
        }

        Log.info("WebhookUpdater::updateHooks() - done");
    }

}

const ghc = new WebhookUpdater();
const start = Date.now();
ghc.run().then(function() {
    Log.info("WebhookUpdater::run() - complete; took: " + Util.took(start));
}).catch(function(err) {
    Log.error("GitHubCleaner::run() - ERROR: " + err.message);
    process.exit();
});
