import Log from "@common/Log";
import { DeliverableTransport, Payload, RepositoryTransport } from "@common/types/PortalTypes";
import Util from "@common/Util";

import { UI } from "../util/UI";

import { AdminDeliverablesTab } from "./AdminDeliverablesTab";
import { AdminPage } from "./AdminPage";
import { AdminView } from "./AdminView";
import { JobRunner, type JobSection } from "./JobRunner";

export class AdminProvisionPage extends AdminPage {
	private deliverables: DeliverableTransport[];
	private readonly jobs: JobRunner;

	/**
	 * The three provisioning jobs. Built once; each reads the page's current selection when its
	 * button is pressed.
	 */
	private readonly sections: JobSection[];

	public constructor(remote: string) {
		super(remote);
		this.jobs = new JobRunner(remote);
		this.sections = this.buildSections();
	}

	public async init(opts: any): Promise<void> {
		Log.info("AdminProvisionPage::init(..) - start");

		UI.showModal("Retrieving Deliverables.");

		this.deliverables = await AdminDeliverablesTab.getDeliverables(this.remote);

		this.deliverables = this.deliverables.sort(function compare(a: DeliverableTransport, b: DeliverableTransport) {
			return a.id.localeCompare(b.id);
		});

		const delivOptions = [];
		delivOptions.push("-None-");
		for (const deliv of this.deliverables) {
			if (deliv.shouldProvision === true) {
				delivOptions.push(deliv.id);
			}
		}
		UI.setDropdownOptions("provisionRepoDeliverableSelect", delivOptions, null);

		this.clearLists();

		const delivSelector = document.querySelector("#provisionRepoDeliverableSelect") as HTMLSelectElement;
		delivSelector.onchange = (evt: any) => {
			evt.stopPropagation(); // prevents list item expansion

			this.handleDelivChanged().catch(function (err) {
				Log.warn("AdminProvisionPage::init(..) - handleDelivChanged ERROR: " + err);
			});
		};

		// wires the buttons and shows what each job last did, including one still running
		await Promise.all(this.sections.map((section) => this.jobs.init(section)));

		UI.hideModal();
	}

	/**
	 * Perform work on backend; frontend only checks for status.
	 */
	private buildSections(): JobSection[] {
		return [
			{
				kind: "provision-prepare",
				buttonId: "adminManagePrepareButton",
				statusId: "adminProvisionPrepareStatus",
				ran: "Last prepared",
				params: () => {
					const delivId = AdminProvisionPage.selectedDeliverable();
					if (delivId === null) {
						UI.showErrorToast("Select a deliverable first.");
						return null;
					}
					const checkbox = document.querySelector("#provisionFormSingleCheckbox") as HTMLInputElement;
					return { delivId: delivId, formSingle: checkbox !== null && checkbox.checked === true };
				},
				detail: function (summary: any): string {
					return (
						summary.delivId +
						": " +
						summary.teamsCreated +
						" team(s) and " +
						summary.reposCreated +
						" repository record(s) created; " +
						summary.repos +
						" repo(s) planned."
					);
				},
				onTerminal: () => {
					this.refreshLists();
				},
			},
			{
				kind: "provision-create",
				buttonId: "adminManageProvisionButton",
				cancelButtonId: "adminManageProvisionCancelButton",
				statusId: "adminProvisionCreateStatus",
				ran: "Last provisioned",
				confirmCancel:
					"Stop provisioning after the repositories currently being created finish?\n\n" +
					"Repositories already created are kept; pressing Provision again creates the rest.",
				params: () => this.repoParams("repositoryProvisionSelect", "provisioning"),
				detail: AdminProvisionPage.describeRepoSummary("provisioned"),
				onTerminal: () => {
					this.refreshLists();
				},
			},
			{
				kind: "provision-release",
				buttonId: "adminManageReleaseButton",
				cancelButtonId: "adminManageReleaseCancelButton",
				statusId: "adminProvisionReleaseStatus",
				ran: "Last released",
				confirmCancel:
					"Stop releasing after the current repository finishes?\n\n" +
					"Repositories already released stay released; pressing Release again releases the rest.",
				params: () => this.repoParams("repositoryReleaseSelect", "releasing"),
				detail: AdminProvisionPage.describeRepoSummary("released"),
				onTerminal: () => {
					this.refreshLists();
				},
			},
			{
				kind: "provision-unrelease",
				buttonId: "adminManageUnreleaseButton",
				cancelButtonId: "adminManageUnreleaseCancelButton",
				statusId: "adminProvisionUnreleaseStatus",
				ran: "Last un-released",
				confirmCancel:
					"Stop un-releasing after the current repository finishes?\n\n" +
					"Repositories already un-released stay un-released; pressing Un-Release again does the rest.",
				params: () => this.repoParams("repositoryReleasedSelect", "un-releasing"),
				detail: AdminProvisionPage.describeRepoSummary("unreleased"),
				onTerminal: () => {
					this.refreshLists();
				},
			},
		];
	}

	/**
	 * The selected repos for one of the multi-selects, as job params.
	 *
	 * Allows staff to validate provisioning is working with sample repos before
	 * running the job for the whole course.
	 */
	private repoParams(selectId: string, action: string): any {
		const delivId = AdminProvisionPage.selectedDeliverable();
		if (delivId === null) {
			UI.showErrorToast("Select a deliverable first.");
			return null;
		}

		const repoIds = AdminProvisionPage.selectedOptions(selectId);
		if (repoIds.length === 0) {
			UI.showErrorToast("No repos selected for " + action + ".");
			return null;
		}
		return { delivId: delivId, repoIds: repoIds };
	}

	private static describeRepoSummary(verb: string): (summary: any) => string {
		return function (summary: any): string {
			let detail = summary.delivId + ": " + summary[verb] + " of " + summary.requested + " " + verb + ".";
			if (summary.skipped > 0) {
				detail += " " + summary.skipped + " already done.";
			}
			if (summary.failed?.length > 0) {
				detail += " <b>" + summary.failed.length + " failed: " + summary.failed.slice(0, 5).join(", ") + "</b>";
				if (summary.failed.length > 5) {
					detail += " (and " + (summary.failed.length - 5) + " more)";
				}
			}
			if (summary.cancelled === true) {
				detail += " Cancelled; press again to finish the rest.";
			}
			if (summary.stoppedEarly === true) {
				// everything already done is kept, so pressing again resumes
				detail += " <b>Stopped early: " + summary.stopReason + "</b> Press again to continue.";
			}
			return detail;
		};
	}

	private static selectedDeliverable(): string | null {
		const value = UI.getDropdownValue("provisionRepoDeliverableSelect");
		if (typeof value !== "string" || value === "" || value === "-None-") {
			return null;
		}
		return value;
	}

	private static selectedOptions(selectId: string): string[] {
		const select = document.getElementById(selectId) as HTMLSelectElement;
		const selected: string[] = [];
		if (select === null) {
			return selected;
		}
		for (const opt of select.options) {
			if (opt.selected && opt.disabled === false) {
				selected.push(opt.value || opt.text);
			}
		}
		return selected;
	}

	private clearLists() {
		const toProvisionSelect = document.getElementById("repositoryProvisionSelect") as HTMLSelectElement;
		const provisionedSelect = document.getElementById("repositoryProvisionedSelect") as HTMLSelectElement;
		const toReleaseSelect = document.getElementById("repositoryReleaseSelect") as HTMLSelectElement;
		const releasedSelect = document.getElementById("repositoryReleasedSelect") as HTMLSelectElement;

		const delivSelect = document.getElementById("provisionRepoDeliverableSelect") as HTMLSelectElement;
		delivSelect.disabled = false;

		toProvisionSelect.disabled = false;
		toReleaseSelect.disabled = false;

		toProvisionSelect.innerHTML = "";
		toReleaseSelect.innerHTML = "";
		if (provisionedSelect !== null) {
			provisionedSelect.innerHTML = "";
		}
		if (releasedSelect !== null) {
			releasedSelect.innerHTML = "";
		}
	}

	private async handleDelivChanged(): Promise<void> {
		const val = UI.getDropdownValue("provisionRepoDeliverableSelect");
		Log.info("AdminProvisionPage::handleDelivChanged(..) - new deliverable selected: " + val);

		this.setFormSingleForDeliverable(val);

		if (val === "-None-") {
			this.clearLists();
			return;
		}

		UI.showModal("Retrieving provisioning and releasing details for " + val + ".");
		try {
			await this.refreshLists();
		} finally {
			UI.hideModal();
		}
	}

	/**
	 * `AdminController.prepareProvision` forces formSingle to true when `Deliverable.teamMaxSize`
	 * is 1 (`maxTeamSize` on the transport), so for those deliverables the checkbox is not a live
	 * choice: show it checked and disabled rather than offering an option the backend ignores.
	 */
	private setFormSingleForDeliverable(delivId: string): void {
		const checkbox = document.querySelector("#provisionFormSingleCheckbox") as HTMLInputElement;
		if (checkbox === null) {
			return;
		}

		const deliv = (this.deliverables ?? []).find((d) => d.id === delivId);
		const singleton = typeof deliv !== "undefined" && deliv.maxTeamSize === 1;

		checkbox.disabled = singleton;
		if (singleton === true) {
			checkbox.checked = true;
		}
	}

	/**
	 * Repopulates the four lists from the backend. Read-only: choosing a deliverable no longer
	 * creates teams and repositories as a side effect (that is what Prepare is for).
	 */
	private async refreshLists(): Promise<void> {
		const val = AdminProvisionPage.selectedDeliverable();
		if (val === null) {
			this.clearLists();
			return;
		}

		const toProvisionSelect = document.getElementById("repositoryProvisionSelect") as HTMLSelectElement;
		const provisionedSelect = document.getElementById("repositoryProvisionedSelect") as HTMLSelectElement;
		const toReleaseSelect = document.getElementById("repositoryReleaseSelect") as HTMLSelectElement;
		const releasedSelect = document.getElementById("repositoryReleasedSelect") as HTMLSelectElement;

		try {
			this.clearLists();

			const provisionRepo = await this.getProvisionDetails(val);
			Log.info("AdminProvisionPage::refreshLists(..) - # repos known for " + val + ": " + provisionRepo.length);

			const provisioned: string[] = [];
			const toProvision: string[] = [];

			for (const repo of provisionRepo) {
				// NOT_CREATED has nothing on GitHub; CREATED exists but was never finalized, so both still
				// need provisioning (the second resumes at finalization)
				if (repo.gitHubStatus === "NOT_CREATED" || repo.gitHubStatus === "CREATED") {
					toProvision.push(repo.id);
				} else {
					provisioned.push(repo.id);
				}
			}

			AdminProvisionPage.fillSelect(provisionedSelect, provisioned.sort(), "No provisioned repositories");
			// nothing exists until Prepare has been run, which is a different state from "all done"
			AdminProvisionPage.fillSelect(
				toProvisionSelect,
				toProvision.sort(),
				provisionRepo.length === 0 ? "Nothing planned yet; press Prepare" : "Nothing to provision"
			);

			const reposToRelease = await this.getReleaseDetails(val);
			Log.info("AdminProvisionPage::refreshLists(..) - # repos in release plan: " + reposToRelease.length);

			const released: string[] = [];
			const toRelease: string[] = [];

			for (const repo of reposToRelease) {
				if (repo.gitHubStatus === "READY") {
					toRelease.push(repo.id);
				} else {
					released.push(repo.id);
				}
			}

			// The released list doubles as the un-release selection: every repo in it is one whose
			// Repository and Team records exist on both sides, so there is nothing to plan.
			AdminProvisionPage.fillSelect(releasedSelect, released.sort(), "No released repositories");
			AdminProvisionPage.fillSelect(toReleaseSelect, toRelease.sort(), "Nothing to release");
		} catch (err) {
			Log.error("AdminProvisionPage::refreshLists(..) - ERROR: " + err);
		}
	}

	private static fillSelect(select: HTMLSelectElement, names: string[], emptyText: string): void {
		if (select === null) {
			// The other lists on the page must still fill, so a missing one is not fatal. It is
			// logged rather than ignored: the usual cause is admin.html being older than this code
			// (the served copy is webpack CopyPlugin output, so it goes stale until the frontend is
			// rebuilt), and an empty list with no explanation is a genuinely hard thing to diagnose.
			Log.warn("AdminProvisionPage::fillSelect(..) - list element missing from admin.html; rebuild the frontend");
			return;
		}
		if (names.length === 0) {
			const option = document.createElement("option");
			option.text = emptyText;
			option.disabled = true; // so it can never be sent as a repo id
			select.add(option);
			return;
		}
		for (const name of names) {
			const option = document.createElement("option");
			option.text = name;
			select.add(option);
		}
	}

	private async getProvisionDetails(delivId: any): Promise<RepositoryTransport[]> {
		Log.info("AdminProvisionPage::getProvisionDetails( " + delivId + " ) - start");

		const url = this.remote + "/portal/admin/provision/" + delivId;
		const options: any = AdminView.getOptions();
		options.method = "get";

		const start = Date.now();
		const response = await fetch(url, options);
		const json: Payload = await response.json();

		if (typeof json.success !== "undefined") {
			Log.info("AdminProvisionPage::getProvisionDetails(..) - success; took: " + Util.took(start));
			return json.success;
		} else {
			Log.error("AdminProvisionPage::getProvisionDetails(..) - ERROR: " + json.failure);
		}
		return [];
	}

	private async getReleaseDetails(delivId: any): Promise<RepositoryTransport[]> {
		Log.info("AdminProvisionPage::getReleaseDetails( " + delivId + " ) - start");

		const url = this.remote + "/portal/admin/release/" + delivId;
		const options: any = AdminView.getOptions();
		options.method = "get";

		const start = Date.now();
		const response = await fetch(url, options);
		const json: Payload = await response.json();

		if (typeof json.success !== "undefined") {
			Log.info("AdminProvisionPage::getReleaseDetails(..) - success; took: " + Util.took(start));
			return json.success;
		} else {
			Log.error("AdminProvisionPage::getReleaseDetails(..) - ERROR: " + json.failure);
		}
		return [];
	}

	public renderPage(pageName: string, opts: {}): void {
		Log.info("AdminProvisionPage::renderPage( " + pageName + ", ... ) - start");
	}
}
