import { AdminController } from "@backend/controllers/AdminController";
import { DatabaseController } from "@backend/controllers/DatabaseController";
import { DeliverablesController } from "@backend/controllers/DeliverablesController";
import { GitHubActions } from "@backend/controllers/GitHubActions";
import { GitHubController } from "@backend/controllers/GitHubController";
import { JobContext } from "@backend/controllers/JobController";
import { ProvisionAbortedError } from "@backend/controllers/ProvisionFailurePolicy";
import { RepositoryController } from "@backend/controllers/RepositoryController";
import { AuditLabel, Deliverable, RepoStatus, Repository } from "@backend/Types";
import Log from "@common/Log";
import { RepositoryTransport } from "@common/types/PortalTypes";
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
	skipped: number; // already finalized, so there was nothing to do
	failed: string[]; // one bad repo does not stop the run; see ProvisionFailurePolicy
	cancelled: boolean;
	stoppedEarly: boolean; // the run gave up; everything provisioned so far is kept
	stopReason: string | null;
}

export interface ProvisionReleaseSummary {
	delivId: string;
	requested: number;
	released: number;
	skipped: number; // not finalized yet, so there is nothing to attach a team to
	failed: string[];
	cancelled: boolean;
	stoppedEarly: boolean;
	stopReason: string | null;
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
	private readonly controller: AdminController;

	/**
	 * @param controller the AdminController to work through. Defaults to one built on the live
	 * GitHub client; specs pass a double, which is the only way to exercise what a run reports when
	 * GitHub fails part way through.
	 */
	public constructor(controller: AdminController = null) {
		this.controller = controller;
	}

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
		const ac = this.getAdminController();

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
		const ac = this.getAdminController();

		// performProvision skips repos GitHub already knows about; count them here so the summary can
		// distinguish "nothing to do" from "did not work"
		// NOT_CREATED needs the whole flow; CREATED exists on GitHub but was never finalized, and
		// provisioning it again resumes there
		const toCreate = repos.filter((repo) => repo.gitHubStatus === RepoStatus.NOT_CREATED || repo.gitHubStatus === RepoStatus.CREATED);
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

		const summarize = (created: RepositoryTransport[], stopReason: string | null): ProvisionCreateSummary => {
			const provisionedIds = created.map((repo) => repo.id);
			return {
				delivId: delivId,
				requested: repos.length,
				provisioned: created.length,
				skipped: skipped,
				failed: toCreate.filter((repo) => provisionedIds.indexOf(repo.id) < 0).map((repo) => repo.id),
				cancelled: ctx?.isCancelled() === true,
				stoppedEarly: stopReason !== null,
				stopReason: stopReason,
			};
		};

		let provisioned: RepositoryTransport[] = [];
		try {
			provisioned = await ac.performProvision(repos, deliv.importURL, undefined, ctx);
		} catch (err) {
			// the run gave up part way; report what it did manage, and fail the job
			if (err instanceof ProvisionAbortedError) {
				const partial = await this.provisionedSoFar(repos);
				throw new ProvisionAbortedError(err.message, summarize(partial, err.message));
			}
			throw err;
		}

		const summary = summarize(provisioned, null);

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
		const ac = this.getAdminController();

		// a repo that is not on GitHub yet has nothing to attach a team to
		const releasable = repos.filter((repo) => repo.gitHubStatus === RepoStatus.READY);
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

		const summarize = (attached: RepositoryTransport[], stopReason: string | null): ProvisionReleaseSummary => {
			const releasedIds = attached.map((repo) => repo.id);
			return {
				delivId: delivId,
				requested: repos.length,
				released: attached.length,
				skipped: skipped,
				failed: releasable.filter((repo) => releasedIds.indexOf(repo.id) < 0).map((repo) => repo.id),
				cancelled: ctx?.isCancelled() === true,
				stoppedEarly: stopReason !== null,
				stopReason: stopReason,
			};
		};

		let released: RepositoryTransport[] = [];
		try {
			released = await ac.performRelease(repos, ctx);
		} catch (err) {
			if (err instanceof ProvisionAbortedError) {
				const partial = await this.releasedSoFar(repos);
				throw new ProvisionAbortedError(err.message, summarize(partial, err.message));
			}
			throw err;
		}

		const summary = summarize(released, null);

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

	/**
	 * What actually got done before an aborted run stopped.
	 *
	 * Read back from the database rather than tracked in memory. performProvision throws out of
	 * a concurrent loop, so its return value is lost, but every repo it finished has already been
	 * recorded.
	 */
	private async provisionedSoFar(repos: Repository[]): Promise<RepositoryTransport[]> {
		return await this.statusIs(repos, [RepoStatus.READY, RepoStatus.RELEASED]);
	}

	private async releasedSoFar(repos: Repository[]): Promise<RepositoryTransport[]> {
		return await this.statusIs(repos, [RepoStatus.RELEASED]);
	}

	private async statusIs(repos: Repository[], wanted: RepoStatus[]): Promise<RepositoryTransport[]> {
		const matched: RepositoryTransport[] = [];
		for (const repo of repos) {
			const current = await this.dbc.getRepository(repo.id);
			if (current !== null && wanted.indexOf(current.gitHubStatus) >= 0) {
				matched.push(RepositoryController.repositoryToTransport(current));
			}
		}
		return matched;
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

	private getAdminController(): AdminController {
		if (this.controller !== null) {
			return this.controller;
		}
		return new AdminController(new GitHubController(GitHubActions.getInstance()));
	}
}
