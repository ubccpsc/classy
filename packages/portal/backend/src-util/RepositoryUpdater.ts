import Log from "@common/Log";
import { GitHubActions, IGitHubActions } from "../src/controllers/GitHubActions";

import { Repository } from "../src/Types";
import { RepositoryController } from "@backend/controllers/RepositoryController";

/**
 * Sometimes you may need to perform some GitHub actions on many repositories.
 * This file shows how you can do this.
 *
 * To run this locally, you need to have a .env configured with the production values
 * and an ssh tunnel configured to the server you want the database to come from.
 *
 * 1) Get on the UBC VPN.
 * 2) Make sure you do not have a local mongo instance running.
 * 3) Ensure your .env corresponds to the production values.
 * 4) ssh user@host -L 27017:127.0.0.1:27017
 * 5) Run this script.
 *
 * Alternatively, this can be run on the production host, which saves you from
 * having to configure a .env.
 *
 * Regardless of how you are using this, running with DRY_RUN true
 * is always recommended, so you can ensure the script is behaving
 * as you expect.
 *
 */
export class RepositoryUpdater {
	/**
	 * Only actually performs the action if DRY_RUN is false.
	 * Otherwise, show what _would_ happen.
	 * NOTE: this is ignored for the TEST_USER user.
	 */
	private DRY_RUN = true;

	/**
	 * Usernames to ignore DRY_RUN for (aka usually a TA or course repo for testing)
	 */
	private readonly TEST_REPOSITORIES: string[] = []; // ["project_staff110"];

	// /**
	//  * To make this request we are actually transforming a commit URL into an API request URL.
	//  * Having to hard-code this is not pretty, but it makes the code much simpler. The format
	//  * you need should be pretty easy to infer from what is present here.
	//  */
	// private readonly PREFIXOLD = "https://github.students.cs.ubc.ca/orgs/CPSC310-2022W-T2/";
	// private readonly PREFIXNEW = "https://github.students.cs.ubc.ca/api/v3/repos/CPSC310-2022W-T2/";

	/**
	 * Specify a restriction on the repos to update. This is the prefix that any relevant repo must match.
	 */
	private readonly REPOPREFIX = "project_";

	constructor() {
		Log.info("RepositoryUpdater::<init> - start");
	}

	public async process(): Promise<void> {
		Log.info("RepositoryUpdater::process() - start");

		const gha = GitHubActions.getInstance(true);

		// Find the commit you want to invoke the bot against.
		// e.g., usually you want to run against the commit associated
		// with the grade record, as that is the 'max' commit
		// but it is conceivable you might want to instead get all
		// result rows and run against the latest before the deadline
		// or some other approach.
		//
		// You might use some other approach here; any commit URL
		// will work with the code below.
		const reposC = new RepositoryController();
		Log.info("RepositoryUpdater::process() - requesting repos");
		const allRepos = await reposC.getAllRepos();
		Log.info("RepositoryUpdater::process() - # repos retrieved: " + allRepos.length);

		const matchedRepos = [];
		for (const repo of allRepos as Repository[]) {
			if (this.TEST_REPOSITORIES.length > 0) {
				// if there are test repos, only consider those=
				if (this.TEST_REPOSITORIES.indexOf(repo.id) >= 0) {
					matchedRepos.push(repo);
				}
			} else {
				// if there are no test repos, consider all repos that match the prefix
				if (repo.id.startsWith(this.REPOPREFIX)) {
					matchedRepos.push(repo);
				}
			}
		}
		Log.info("RepositoryUpdater::process() - # matched repos: " + matchedRepos.length);
		Log.info("RepositoryUpdater::process() - checking that repos exist in GitHub...");

		const matchedReposThatExist = [];
		// Ensure the repo returned by RepositoryController actually exists on GitHub
		for (const matchedRepo of matchedRepos) {
			const repoExists = await gha.repoExists(matchedRepo.id);
			if (repoExists === true) {
				matchedReposThatExist.push(matchedRepo);
			}
		}

		Log.info("RepositoryUpdater::process() - # matched repos that exist: " + matchedReposThatExist.length);
		Log.trace("RepositoryUpdater::process() - matched repos: " + JSON.stringify(matchedReposThatExist));

		for (const matchedExistingRepo of matchedReposThatExist) {
			await this.deleteUnwantedBranches(matchedExistingRepo, gha);
		}

		Log.info("RepositoryUpdater::process() - done");
	}

	private async deleteUnwantedBranches(repo: Repository, gha: IGitHubActions): Promise<boolean> {
		Log.info("RepositoryUpdater::deleteUnwantedBranches() - start; repo: " + repo.id);

		/**
		 * The list of branches we want to delete.
		 */
		const BRANCH_NAMES_TO_DELETE = [
			"feature/pull_request_template_improvement",
			"removeFolderTest",
			"remove-dynamic-tests",
			"master",
			"errortype",
			"23W2EmptyChanges",
			"empty-repo",
		];

		const allBranches = await gha.listRepoBranches(repo.id);
		const branchesToRemove = [];
		const branchesToKeep = [];
		for (const branch of allBranches) {
			if (BRANCH_NAMES_TO_DELETE.indexOf(branch) >= 0) {
				// Log.info("RepositoryUpdater::deleteUnwantedBranches() - branch to REMOVE: " + branch);
				branchesToRemove.push(branch);
			} else {
				branchesToKeep.push(branch);
			}
		}

		Log.info(
			"RepositoryUpdater::deleteUnwantedBranches() - repo: " +
				repo.id +
				"; branchesToRemove: " +
				JSON.stringify(branchesToRemove) +
				"; branchesToKeep: " +
				JSON.stringify(branchesToKeep)
		);

		let allSuccess = true;
		for (const branch of branchesToRemove) {
			if (this.DRY_RUN === false) {
				Log.info(
					"RepositoryUpdater::deleteUnwantedBranches() - DRY_RUN === false; removing branch; repo: " +
						repo.id +
						"; branch: " +
						branch
				);
				try {
					const success = await gha.deleteBranch(repo.id, branch);
					if (success === false) {
						allSuccess = false;
					}
					Log.info("RepositoryUpdater::deleteUnwantedBranches() - removed branch; success: " + success);
				} catch (err) {
					Log.error("RepositoryUpdater::deleteUnwantedBranches() - ERROR: " + err.message);
				}
			} else {
				Log.info(
					"RepositoryUpdater::deleteUnwantedBranches() - DRY_RUN === true; should have deleted branch - repo: " +
						repo.id +
						"; branch: " +
						branch
				);
			}
		}
		Log.info("RepositoryUpdater::deleteUnwantedBranches() - done; repo: " + repo.id + "; allSuccess: " + allSuccess);
		return allSuccess;
	}
}

const ru = new RepositoryUpdater();
ru.process()
	.then(function () {
		Log.info("RepositoryUpdater::process() - complete");
		process.exit();
	})
	.catch(function (err) {
		Log.error("RepositoryUpdater::process() - ERROR: " + err.message);
		process.exit(-1);
	});
