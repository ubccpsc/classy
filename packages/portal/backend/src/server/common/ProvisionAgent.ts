import { AdminController } from "@backend/controllers/AdminController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubActions } from "@backend/controllers/GitHubActions";
import { GitHubController } from "@backend/controllers/GitHubController";
import { JobContext } from "@backend/controllers/JobController";
import { AuditLabel, Deliverable, Repository } from "@backend/Types";
import Log from "@common/Log";
import Util from "@common/Util";

export interface ProvisionPrepareSummary {
	delivId: string;
	teamsCreated: number; // teams that did not exist before this run
	reposCreated: number; // Repository records; nothing exists on GitHub yet
	repos: number; // repos now planned for the deliverable, created or not
}

export interface ProvisionCreateSummary {
	delivId: string;
	requested: number;
	provisioned: number;
	skipped: number; // already existed on GitHub
	failed: string[]; // see AdminController.performProvision: a failure no longer stops the run
	cancelled: boolean;
}

export interface ProvisionReleaseSummary {
	delivId: string;
	requested: number;
	released: number;
	skipped: number; // not provisioned yet, so there is nothing to attach a team to
	failed: string[];
	cancelled: boolean;
}

/**
 * The three provisioning jobs.
 *
 * Provisioning was the last part of Classy the browser drove: the admin page looped over batches of
 * repositories, one request at a time, and the work only continued while that tab stayed open. Each
 * request was also bounded by the proxy's 90s read timeout, which is why the batches were small.
 *
 * These run as jobs instead (registered in BackendServer):
 *
 *   provision-prepare   creates the Team and Repository records
 *   provision-create    creates the repositories on GitHub
 *   provision-release   attaches the student teams to them
 *
 * Only one job per kind runs at a time, which is what we want here: two deliverables provisioning at
 * once would compete for the same GitHub secondary rate limits.
 */
export class ProvisionAgent {
	private readonly dbc = DatabaseController.getInstance();

	/**
	 * Creates the Team and Repository records for a deliverable. Nothing reaches GitHub.
	 *
	 * @param delivId
	 * @param formSingle whether students not on a team should each get one (and so a repo)
	 * @param requesterId Person.id of whoever asked; audited
	 * @param ctx
	 * @returns {Promise<ProvisionPrepareSummary>}
	 */
	public async prepare(
		delivId: string,
		formSingle: boolean,
		requesterId: string,
		ctx: JobContext = null
	): Promise<ProvisionPrepareSummary> {
		const start = Date.now();
		Log.info("ProvisionAgent::prepare( " + delivId + ", " + formSingle + " ) - start");

		const deliv = await ProvisionAgent.getProvisionableDeliverable(delivId);
		const ac = ProvisionAgent.getAdminController();

		// counted for this deliverable rather than the whole database: only one provisioning job runs
		// at a time, but teams can also be formed by students while it does
		const teamsBefore = ProvisionAgent.countFor(await this.dbc.getTeams(), delivId);
		const reposBefore = ProvisionAgent.countFor(await this.dbc.getRepositories(), delivId);

		const planned = await ac.prepareProvision(deliv, formSingle, ctx);

		const summary: ProvisionPrepareSummary = {
			delivId: delivId,
			teamsCreated: ProvisionAgent.countFor(await this.dbc.getTeams(), delivId) - teamsBefore,
			reposCreated: ProvisionAgent.countFor(await this.dbc.getRepositories(), delivId) - reposBefore,
			repos: planned.length,
		};

		await this.dbc.writeAudit(
			AuditLabel.REPO_PROVISION,
			requesterId,
			{},
			{},
			{
				action: "prepare",
				delivId: delivId,
				formSingle: formSingle,
				reposCreated: summary.reposCreated,
			}
		);

		Log.info("ProvisionAgent::prepare( " + delivId + " ) - done; " + JSON.stringify(summary) + "; took: " + Util.took(start));
		return summary;
	}

	/**
	 * Creates the requested repositories on GitHub.
	 *
	 * @param delivId
	 * @param repoIds the subset the admin selected
	 * @param requesterId Person.id of whoever asked; audited
	 * @param ctx
	 * @returns {Promise<ProvisionCreateSummary>}
	 */
	public async create(delivId: string, repoIds: string[], requesterId: string, ctx: JobContext = null): Promise<ProvisionCreateSummary> {
		const start = Date.now();
		Log.info("ProvisionAgent::create( " + delivId + " ) - start; # repos: " + (repoIds ?? []).length);

		const deliv = await ProvisionAgent.getProvisionableDeliverable(delivId);
		const repos = await this.resolveRepos(delivId, repoIds);
		const ac = ProvisionAgent.getAdminController();

		// performProvision skips repos GitHub already knows about; count them here so the summary can
		// distinguish "nothing to do" from "did not work"
		const toCreate = repos.filter((repo) => repo.gitHubStatus === "NOT_PROVISIONED");
		const skipped = repos.length - toCreate.length;

		await this.dbc.writeAudit(
			AuditLabel.REPO_PROVISION,
			requesterId,
			{},
			{},
			{
				action: "create",
				delivId: delivId,
				repoIds: repos.map((repo) => repo.id),
			}
		);

		const provisioned = await ac.performProvision(repos, deliv.importURL, undefined, ctx);
		const provisionedIds = provisioned.map((repo) => repo.id);

		const summary: ProvisionCreateSummary = {
			delivId: delivId,
			requested: repos.length,
			provisioned: provisioned.length,
			skipped: skipped,
			failed: toCreate.filter((repo) => provisionedIds.indexOf(repo.id) < 0).map((repo) => repo.id),
			cancelled: ctx?.isCancelled() === true,
		};

		Log.info("ProvisionAgent::create( " + delivId + " ) - done; " + JSON.stringify(summary) + "; took: " + Util.took(start));
		return summary;
	}

	/**
	 * Attaches the student teams to the requested repositories.
	 *
	 * @param delivId
	 * @param repoIds the subset the admin selected
	 * @param requesterId Person.id of whoever asked; audited
	 * @param ctx
	 * @returns {Promise<ProvisionReleaseSummary>}
	 */
	public async release(delivId: string, repoIds: string[], requesterId: string, ctx: JobContext = null): Promise<ProvisionReleaseSummary> {
		const start = Date.now();
		Log.info("ProvisionAgent::release( " + delivId + " ) - start; # repos: " + (repoIds ?? []).length);

		await ProvisionAgent.getProvisionableDeliverable(delivId); // validate before doing any work
		const repos = await this.resolveRepos(delivId, repoIds);
		const ac = ProvisionAgent.getAdminController();

		// a repo that is not on GitHub yet has nothing to attach a team to
		const releasable = repos.filter((repo) => repo.gitHubStatus !== "NOT_PROVISIONED");
		const skipped = repos.length - releasable.length;

		await this.dbc.writeAudit(
			AuditLabel.REPO_RELEASE,
			requesterId,
			{},
			{},
			{
				delivId: delivId,
				repoIds: repos.map((repo) => repo.id),
			}
		);

		const released = await ac.performRelease(repos, ctx);
		const releasedIds = released.map((repo) => repo.id);

		const summary: ProvisionReleaseSummary = {
			delivId: delivId,
			requested: repos.length,
			released: released.length,
			skipped: skipped,
			failed: releasable.filter((repo) => releasedIds.indexOf(repo.id) < 0).map((repo) => repo.id),
			cancelled: ctx?.isCancelled() === true,
		};

		Log.info("ProvisionAgent::release( " + delivId + " ) - done; " + JSON.stringify(summary) + "; took: " + Util.took(start));
		return summary;
	}

	/**
	 * NOTE: a job's params arrive from the client, so everything is validated here rather than
	 * trusted: the route only checks that the caller is an admin.
	 */
	private async resolveRepos(delivId: string, repoIds: string[]): Promise<Repository[]> {
		if (Array.isArray(repoIds) === false || repoIds.length === 0) {
			throw new Error("No repositories were selected.");
		}

		const repos: Repository[] = [];
		for (const repoId of repoIds) {
			const repo = await this.dbc.getRepository(repoId);
			if (repo === null) {
				throw new Error("Unknown repository: " + repoId);
			}
			if (repo.delivId !== delivId) {
				throw new Error("Repository " + repoId + " does not belong to " + delivId + ".");
			}
			repos.push(repo);
		}
		return repos;
	}

	private static countFor(records: Array<{ delivId: string }>, delivId: string): number {
		return records.filter((record) => record.delivId === delivId).length;
	}

	private static async getProvisionableDeliverable(delivId: string): Promise<Deliverable> {
		const deliv = await new DeliverablesController().getDeliverable(delivId);
		if (deliv === null) {
			throw new Error("Unknown deliverable: " + delivId);
		}
		if (deliv.shouldProvision !== true) {
			throw new Error("Deliverable is not provisionable: " + delivId);
		}
		return deliv;
	}

	private static getAdminController(): AdminController {
		return new AdminController(new GitHubController(GitHubActions.getInstance()));
	}
}
