import Log from "@common/Log";
import { RepositoryTransport, TeamTransport } from "@common/types/PortalTypes";
import { OnsButtonElement } from "onsenui";

import { UI } from "../util/UI";

import { AdminPage } from "./AdminPage";
import { AdminResultsTab } from "./AdminResultsTab";
import { AdminTeamsTab } from "./AdminTeamsTab";
import { AdminView } from "./AdminView";

export class AdminDeletePage extends AdminPage {
	private teams: TeamTransport[];
	private repos: RepositoryTransport[];

	public constructor(remote: string) {
		super(remote);
	}

	public async init(opts: any): Promise<void> {
		const that = this;
		Log.info("AdminDeletePage::init(..) - start");

		UI.showModal("Retrieving repositories and teams.");

		this.teams = await AdminTeamsTab.getTeams(this.remote);
		this.repos = await AdminResultsTab.getRepositories(this.remote);

		this.teams = this.teams.sort(function compare(a: TeamTransport, b: TeamTransport) {
			return a.id.localeCompare(b.id);
		});

		this.repos = this.repos.sort(function compare(a: RepositoryTransport, b: RepositoryTransport) {
			return a.id.localeCompare(b.id);
		});

		const teamDelete = document.getElementById("teamDeleteSelect") as HTMLSelectElement;
		teamDelete.innerHTML = "";
		for (const team of this.teams) {
			const option = document.createElement("option");
			option.text = team.id;
			teamDelete.add(option);
		}

		const repoDelete = document.getElementById("repoDeleteSelect") as HTMLSelectElement;
		repoDelete.innerHTML = "";
		for (const repo of this.repos) {
			const option = document.createElement("option");
			option.text = repo.id;
			repoDelete.add(option);
		}

		UI.hideModal();

		(document.querySelector("#adminDeleteDeliverableButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminDeletePage::handleDeliverableDelete(..) - delete pressed");
			evt.stopPropagation(); // prevents list item expansion

			let value = UI.getTextFieldValue("adminDeleteDeliverableText");
			if (typeof value === "string") {
				value = value.trim();
			}
			that
				.deleteDeliverable(value)
				.then(function () {
					// done
				})
				.catch(function (err) {
					Log.error("AdminDeletePage::handleDeliverableDelete(..) - delete pressed ERROR: " + err.message);
				});
		};

		(document.querySelector("#adminDeleteTeamButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminDeletePage::handleTeamDelete(..) - button pressed");
			evt.stopPropagation(); // prevents list item expansion
			that
				.deleteTeamPressed()
				.then(function () {
					// worked
				})
				.catch(function (err) {
					// did not
				});
		};

		(document.querySelector("#adminDeleteRepositoryButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminDeletePage::handleRepositoryDelete(..) - button pressed");
			evt.stopPropagation(); // prevents list item expansion

			that
				.deleteRepoPressed()
				.then(function () {
					// worked
				})
				.catch(function (err) {
					// did not
				});
		};

		(document.querySelector("#adminDeleteSanitizeDB") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminDeletePage::adminDeleteSanitizeDB(..) - button pressed");
			evt.stopPropagation(); // prevents list item expansion
			that
				.sanitizeDBPressed()
				.then(function () {
					// worked
				})
				.catch(function (err) {
					// did not
				});
		};
	}

	private async deleteRepoPressed(): Promise<void> {
		const repoDelete = document.getElementById("repoDeleteSelect") as HTMLSelectElement;

		const selected = [];

		for (const opt of repoDelete.options) {
			if (opt.selected) {
				selected.push(opt.value || opt.text);
			}
		}

		Log.info("AdminDeletePage::deleteRepoPressed(..) - start; # repos to delete: " + selected.length);
		if (selected.length > 0) {
			UI.showSuccessToast("Repository deletion in progress.");
		} else {
			UI.showErrorToast("No repositories selected for deletion.");
		}

		for (let i = 0; i < selected.length; i++) {
			const sel = selected[i];
			try {
				await this.deleteRepository(sel);
				Log.info("AdminDeletePage::deleteRepoPressed(..) - delete complete; repo: " + sel);
				UI.showSuccessToast("Repository deleted: " + sel + " ( " + (i + 1) + " of " + selected.length + " )", {
					force: true,
					animation: "none",
				});
			} catch (err) {
				Log.error("AdminDeletePage::deleteRepoPressed(..) - delete pressed ERROR: " + err.message);
				UI.showErrorToast("Repository NOT deleted: " + sel);
			}
		}

		Log.info("AdminDeletePage::deleteRepoPressed(..) - done");
		if (selected.length > 0) {
			UI.showSuccessToast("Repository deletion complete.", { buttonLabel: "Ok" });
		}
		// refresh the page
		await this.init({});
	}

	private async deleteTeamPressed(): Promise<void> {
		const teamDelete = document.getElementById("teamDeleteSelect") as HTMLSelectElement;
		const selected = [];

		for (const opt of teamDelete.options) {
			if (opt.selected) {
				selected.push(opt.value || opt.text);
			}
		}

		Log.info("AdminDeletePage::deleteTeamPressed(..) - start; # teams to delete: " + selected.length);
		if (selected.length > 0) {
			UI.showSuccessToast("Team deletion in progress.");
		} else {
			UI.showErrorToast("No teams selected for deletion.");
		}

		for (let i = 0; i < selected.length; i++) {
			const sel = selected[i];
			try {
				await this.deleteTeam(sel);
				Log.info("AdminDeletePage::deleteTeamPressed(..) - delete complete; team: " + sel);
				UI.showSuccessToast("Team deleted: " + sel + " ( " + (i + 1) + " of " + selected.length + " )", {
					force: true,
					animation: "none",
				});
			} catch (err) {
				Log.error("AdminDeletePage::deleteTeamPressed(..) - delete pressed ERROR: " + err.message);
				UI.showErrorToast("Team NOT deleted: " + sel);
			}
		}

		Log.info("AdminDeletePage::deleteTeamPressed(..) - done");
		if (selected.length > 0) {
			UI.showSuccessToast("Team deletion complete.", { buttonLabel: "Ok" });
		}
		// refresh the page
		await this.init({});
	}

	private async sanitizeDBPressed(): Promise<void> {
		const dryRun = document.getElementById("adminDeleteSanitizeDBToggle") as HTMLInputElement;

		Log.info("AdminDeletePage::sanitizeDBPressed(..) - start; dryRun: " + dryRun.checked);

		try {
			const url = this.remote + "/portal/admin/checkDatabase/" + (dryRun.checked === true);

			const options: any = AdminView.getOptions();
			options.method = "post";

			const response = await fetch(url, options);
			const body = await response.json();
			if (typeof body.success === "undefined") {
				// this used to report "complete" whatever the server said, including a 400
				throw new Error(body?.failure?.message ?? "HTTP " + response.status);
			}

			Log.info("AdminDeletePage::sanitizeDBPressed(..) - done");
			if (dryRun.checked === true) {
				UI.showSuccessToast("Dry run complete: nothing was written. Repairs are in the portal log; turn Dry Run off to apply them.", {
					buttonLabel: "Ok",
					timeout: 8000,
				});
			} else {
				UI.showSuccessToast("GitHub synchronization complete; the database now matches GitHub.", { buttonLabel: "Ok", timeout: 5000 });
			}
		} catch (err) {
			Log.error("AdminDeletePage::sanitizeDBPressed(..) - ERROR: " + err.message);
			UI.showErrorToast("Error sanitizing DB: " + err.message);
		}
	}

	public renderPage(pageName: string, opts: {}): void {
		Log.info("AdminDeletePage::renderPage( " + pageName + ", ... ) - start");
	}

	private async deleteDeliverable(delivId: string): Promise<boolean> {
		Log.info("AdminDeletePage::deleteDeliverable( " + delivId + " ) - start");
		const url = this.remote + "/portal/admin/deliverable/" + delivId;
		return await this.performDelete(url);
	}

	private async deleteTeam(teamId: string): Promise<boolean> {
		Log.info("AdminDeletePage::deleteTeam( " + teamId + " ) - start");

		const url = this.remote + "/portal/admin/team/" + teamId;
		return await this.performDelete(url);
	}

	private async deleteRepository(repositoryId: string): Promise<boolean> {
		Log.info("AdminDeletePage::deleteRepository( " + repositoryId + " ) - start");
		const url = this.remote + "/portal/admin/repository/" + repositoryId;
		return await this.performDelete(url);
	}

	private async performDelete(url: string): Promise<boolean> {
		const options: any = AdminView.getOptions();
		options.method = "delete";

		const response = await fetch(url, options);
		const body = await response.json();
		if (typeof body.success !== "undefined") {
			return true;
		}
		// Thrown rather than returned: the callers only look for a rejection, so a false here used
		// to be toasted as "deleted" while the record was still in the database.
		const message = body?.failure?.message ?? "HTTP " + response.status;
		Log.error("AdminDeletePage::performDelete( " + url + " ) - ERROR: " + message);
		throw new Error(message);
	}
}
