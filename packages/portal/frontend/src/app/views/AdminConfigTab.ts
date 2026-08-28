import Log from "@common/Log";
import { CourseTransport, Payload, ProvisionTransport, StudentTransport, TeamFormationTransport } from "@common/types/PortalTypes";
import { AdminDeleteGraderPage } from "@frontend/views/AdminDeleteGraderPage";
import { OnsButtonElement } from "onsenui";
import { Network } from "../util/Network";
import { UI } from "../util/UI";
import { AdminDeletePage } from "./AdminDeletePage";
import { AdminDeliverablesTab } from "./AdminDeliverablesTab";
import { AdminPage } from "./AdminPage";
import { AdminProvisionPage } from "./AdminProvisionPage";
import { AdminView } from "./AdminView";
import { JobRunner, type JobSection } from "./JobRunner";

export class AdminConfigTab extends AdminPage {
	private readonly jobs: JobRunner;

	// private readonly remote: string; // url to backend
	private isAdmin: boolean;

	private deliverablesPage: AdminDeliverablesTab = null;
	private course: CourseTransport = null;

	public constructor(remote: string, isAdmin: boolean) {
		super(remote);
		this.isAdmin = isAdmin;
		this.jobs = new JobRunner(remote);
		this.deliverablesPage = new AdminDeliverablesTab(remote, isAdmin);
	}

	public setAdmin(isAdmin: boolean) {
		Log.info("AdminConfigTab::isAdmin( " + isAdmin + " )");
		this.isAdmin = isAdmin;
	}

	// called by reflection in renderPage
	// biome-ignore lint/complexity/noExcessiveLinesPerFunction: flat wiring of ~15 button handlers; grouping them into helpers would shorten this without making anything clearer or testable
	public async init(opts: any): Promise<void> {
		Log.info("AdminConfigTab::init(..) - start");
		const that = this;
		// Can init frame here if needed

		await this.deliverablesPage.init(opts);

		await this.initJobSections();

		(document.querySelector("#adminSubmitClasslist") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - upload classlist pressed");
			evt.stopPropagation(); // prevents list item expansion

			const fileInput = document.querySelector("#adminClasslistFile") as HTMLInputElement;
			const isValid: boolean = that.validateFileSpecified(fileInput);
			if (isValid === true) {
				that
					.uploadClasslist(fileInput.files)
					.then(function () {
						// done
					})
					.catch(function (err) {
						Log.error("AdminConfigTab::handleAdminConfig(..) - upload classlist pressed ERROR: " + err.message);
					});
			}
		};

		(document.querySelector("#adminSubmitGradeCSV") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - upload grades pressed");
			evt.stopPropagation(); // prevents list item expansion

			const fileInput = document.querySelector("#adminGradeCSV") as HTMLInputElement;
			const isValid: boolean = that.validateFileSpecified(fileInput);
			if (isValid === true) {
				const delivDropdown = document.querySelector("#adminGradeDeliverableSelect") as HTMLSelectElement;
				const delivId = delivDropdown.value;
				that
					.uploadGrades(fileInput.files, delivId)
					.then(function () {
						// done
					})
					.catch(function (err) {
						Log.error("AdminConfigTab::handleAdminConfig(..) - upload grades pressed ERROR: " + err.message);
					});
			}
		};

		(document.querySelector("#adminSubmitGradePrairieCSV") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - upload prairie grades pressed");
			evt.stopPropagation(); // prevents list item expansion

			const fileInput = document.querySelector("#adminGradePrairieCSV") as HTMLInputElement;
			const isValid: boolean = that.validateFileSpecified(fileInput);
			if (isValid === true) {
				that
					.uploadGradesPrairie(fileInput.files)
					.then(function () {
						// done
					})
					.catch(function (err) {
						Log.error("AdminConfigTab::handleAdminConfig(..) - upload grades pressed ERROR: " + err.message);
					});
			}
		};

		(document.querySelector("#adminSubmitDefaultDeliverable") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - default deliverable pressed");
			evt.preventDefault();
			evt.stopPropagation(); // prevents list item expansion

			that
				.defaultDeliverablePressed()
				.then(function () {
					// worked
				})
				.catch(function (err) {
					Log.info("AdminConfigTab::handleAdminConfig(..) - default deliverable pressed; ERROR: " + err.message);
				});
		};

		(document.querySelector("#adminCreateTeamButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - create team pressed");
			evt.preventDefault();
			evt.stopPropagation(); // prevents list item expansion

			that
				.teamCreatePressed()
				.then(function () {
					// worked
				})
				.catch(function (err) {
					Log.info("AdminConfigTab::handleAdminConfig(..) - create team pressed; ERROR: " + err.message);
				});
		};

		(document.querySelector("#adminDeleteTeamManageButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - delete team pressed");
			evt.preventDefault();
			evt.stopPropagation(); // prevents list item expansion

			that
				.teamDeletePressed()
				.then(function () {
					// worked
				})
				.catch(function (err) {
					Log.info("AdminConfigTab::handleAdminConfig(..) - delete team pressed; ERROR: " + err.message);
				});
		};

		(document.querySelector("#adminTeamAddMemberButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - add member to team pressed");
			evt.preventDefault();
			evt.stopPropagation(); // prevents list item expansion

			that
				.teamAddMemberPressed()
				.then(function () {
					// worked
				})
				.catch(function (err) {
					Log.info("AdminConfigTab::handleAdminConfig(..) - add member to team pressed; ERROR: " + err.message);
				});
		};

		(document.querySelector("#adminTeamRemoveMemberButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - remove member to team pressed");
			evt.preventDefault();
			evt.stopPropagation(); // prevents list item expansion

			that
				.teamRemoveMemberPressed()
				.then(function () {
					// worked
				})
				.catch(function (err) {
					Log.info("AdminConfigTab::handleAdminConfig(..) - remove member to team pressed; ERROR: " + err.message);
				});
		};

		(document.querySelector("#adminDeletePageButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - delete page pressed");
			evt.preventDefault();

			that
				.pushPage("./adminDelete2.html", {})
				.then(function () {
					const deletePage = new AdminDeletePage(that.remote);
					deletePage
						.init({})
						.then(function () {
							// success
							Log.info("AdminConfigTab::handleAdminConfig(..) - delete page init");
						})
						.catch(function (err) {
							// error
							Log.error("AdminConfigTab::handleAdminConfig(..) - delete page ERROR: " + err);
						});
				})
				.catch(function (err) {
					Log.error("AdminConfigTab - adminDelete ERROR: " + err.message);
				});
		};

		(document.querySelector("#adminManageRepositoriesButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - manage repo page pressed");
			evt.preventDefault();

			that
				.pushPage("./adminProvision.html", {})
				.then(function () {
					const provisionPage = new AdminProvisionPage(that.remote);
					provisionPage
						.init({})
						.then(function () {
							// success
							Log.info("AdminConfigTab::handleAdminConfig(..) - provision page init");
						})
						.catch(function (err) {
							// error
							Log.error("AdminConfigTab::handleAdminConfig(..) - provision page ERROR: " + err);
						});
				})
				.catch(function (err) {
					Log.error("AdminConfigTab - adminProvision ERROR: " + err.message);
				});
		};

		(document.querySelector("#adminRemoveGraderImagesPageButton") as OnsButtonElement).onclick = function (evt) {
			Log.info("AdminConfigTab::handleAdminConfig(..) - remove grader images page pressed");
			evt.preventDefault();

			that
				.pushPage("./adminGraderImages.html", {})
				.then(function () {
					const deleteImagePage = new AdminDeleteGraderPage(that.remote);
					deleteImagePage
						.init({})
						.then(function () {
							// success
							Log.info("AdminConfigTab::handleAdminConfig(..) - image delete page init");
						})
						.catch(function (err) {
							// error
							Log.error("AdminConfigTab::handleAdminConfig(..) - image delete page ERROR: " + err);
						});
				})
				.catch(function (err) {
					Log.error("AdminConfigTab imageDelete ERROR: " + err.message);
				});
		};

		// (document.querySelector("#adminManagePullRequestsButton") as OnsButtonElement).onclick = function(evt) {
		//     Log.info("AdminConfigTab::handleAdminConfig(..) - manage PRs page pressed");
		//     evt.preventDefault();

		//     that.pushPage("./adminPullRequests.html", {}).then(function() {
		//         const pullRequestsPage = new AdminPullRequestsPage(that.remote);
		//         pullRequestsPage.init({}).then(function() {
		//             // success
		//             Log.info("AdminConfigTab::handleAdminConfig(..) - PRs page init");
		//         }).catch(function(err) {
		//             // error
		//             Log.error("AdminConfigTab::handleAdminConfig(..) - PRs page ERROR: " + err);
		//         });
		//     }).catch(function(err) {
		//         Log.error("AdminConfigTab - adminPullRequests ERROR: " + err.message);
		//     });
		// };

		UI.showModal("Retriving config / deliverable details.");

		this.course = await AdminView.getCourse(this.remote);

		const deliverables = await AdminDeliverablesTab.getDeliverables(this.remote);
		const gradesDeliverableDropdown = document.querySelector("#adminGradeDeliverableSelect") as HTMLSelectElement;
		const defaultDeliverableDropdown = document.querySelector("#adminDefaultDeliverableSelect") as HTMLSelectElement;
		const teamDropdown = document.querySelector("#adminTeamDeliverableSelect") as HTMLSelectElement;

		const defaultDeliverableOptions = ["--Not Set--"];
		const provisionOptions = ["--Select--"];
		const gradesOptions = ["--Select--"];
		const allDeliverables = ["--Select--"];

		for (const deliv of deliverables) {
			if (deliv.shouldAutoTest === true) {
				// default deliverables only matter for autotest
				defaultDeliverableOptions.push(deliv.id);
			}
			if (deliv.shouldProvision === true) {
				// can only provision or release deliverables that are provisionable
				provisionOptions.push(deliv.id);
				gradesOptions.push(deliv.id);
			}
			allDeliverables.push(deliv.id);
		}

		this.populateDelivSelect(defaultDeliverableOptions, defaultDeliverableDropdown);
		this.populateDelivSelect(provisionOptions, teamDropdown); // can only create teams on provisionable deliverables
		this.populateDelivSelect(allDeliverables, gradesDeliverableDropdown);

		// set default deliverable, if it exists
		for (const o of (defaultDeliverableDropdown as any).children) {
			if (o.value === this.course.defaultDeliverableId) {
				o.selected = true;
			}
		}

		UI.hideModal();
	}

	private populateDelivSelect(delivOptions: string[], dropdown: HTMLSelectElement) {
		delivOptions = delivOptions.sort();

		dropdown.innerHTML = "";
		for (const delivId of delivOptions) {
			let value = delivId;
			if (delivId.startsWith("--")) {
				// handle the null case
				value = null;
			}
			const o: HTMLOptionElement = new Option(delivId, value, false, false);
			dropdown.add(o);
		}
	}

	private validateFileSpecified(fileInput: HTMLInputElement) {
		if (fileInput.value.length > 0) {
			Log.trace("AdminConfigTab::validateFileSpecified() - validation passed");
			return true;
		} else {
			UI.notification("You must select a CSV before you click Upload.");
			return false;
		}
	}

	public async uploadClasslist(fileList: FileList) {
		Log.info("AdminConfigTab::uploadClasslist(..) - start");
		const url = this.remote + "/portal/admin/classlist";

		UI.showModal("Uploading classlist.");

		try {
			const formData = new FormData();
			formData.append("classlist", fileList[0]); // The CSV is fileList[0]

			const opts = {
				headers: {
					// NOTE: no Content-Type; httpPostFile lets the browser set the multipart boundary
					user: localStorage.user,
					token: localStorage.token,
				},
			};
			const response: Response = await Network.httpPostFile(url, opts, formData);
			if (response.status >= 200 && response.status < 300) {
				const data: Payload = await response.json();
				UI.hideModal();
				Log.info("AdminConfigTab::uploadClasslist(..) - RESPONSE: " + JSON.stringify(data));
				if (typeof data.success !== "undefined") {
					UI.notificationToast(data.success.message);
					this.showClasslistChanges(data.success);
				}
			} else {
				const reason = await response.json();
				UI.hideModal();
				if (typeof reason.failure && typeof reason.failure.message) {
					UI.notification(
						"There was an issue uploading your class list. " +
							"Please ensure the CSV file includes all required columns. <br/>Details: " +
							reason.failure.message
					);
				} else {
					UI.notification("There was an issue uploading your class list. " + "Please ensure the CSV file includes all required columns.");
				}
			}
		} catch (err) {
			UI.hideModal();
			Log.error("AdminConfigTab::uploadClasslist(..) - ERROR: " + err.message);
			AdminView.showError(err);
		}

		Log.trace("AdminConfigTab::uploadClasslist(..) - end");
	}

	public async uploadGrades(fileList: FileList, delivId: string) {
		Log.info("AdminConfigTab::uploadGrades(..) - start");
		const url = this.remote + "/portal/admin/grades/csv/" + delivId;

		UI.showModal("Uploading grades.");

		try {
			const formData = new FormData();
			formData.append("gradelist", fileList[0]); // The CSV is fileList[0]

			const opts = {
				headers: {
					// NOTE: no Content-Type; httpPostFile lets the browser set the multipart boundary
					user: localStorage.user,
					token: localStorage.token,
				},
			};
			const response: Response = await Network.httpPostFile(url, opts, formData);
			if (response.status >= 200 && response.status < 300) {
				const data: Payload = await response.json();
				UI.hideModal();
				Log.info("AdminConfigTab::uploadGrades(..) - RESPONSE: " + JSON.stringify(data));
				UI.notification(data.success.message);
			} else {
				const reason = await response.json();
				UI.hideModal();
				if (typeof reason.failure && typeof reason.failure.message) {
					UI.notification(
						"There was an issue uploading your grade CSV. " +
							"Please ensure the CSV file includes all required columns. <br/>Details: " +
							reason.failure.message
					);
				} else {
					UI.notification("There was an issue uploading your grade CSV. " + "Please ensure the CSV file includes all required columns.");
				}
			}
		} catch (err) {
			UI.hideModal();
			Log.error("AdminConfigTab::uploadGrades(..) - ERROR: " + err.message);
			AdminView.showError(err);
		}

		Log.trace("AdminConfigTab::uploadGrades(..) - end");
	}

	public async uploadGradesPrairie(fileList: FileList) {
		Log.info("AdminConfigTab::uploadGradesPrairie(..) - start");
		const url = this.remote + "/portal/admin/grades/prairie";

		UI.showModal("Uploading PrairieLearn GradeBook.");

		try {
			const formData = new FormData();
			formData.append("gradelist", fileList[0]); // The CSV is fileList[0]

			const opts = {
				headers: {
					// NOTE: no Content-Type; httpPostFile lets the browser set the multipart boundary
					user: localStorage.user,
					token: localStorage.token,
				},
			};
			const response: Response = await Network.httpPostFile(url, opts, formData);
			if (response.status >= 200 && response.status < 300) {
				const data: Payload = await response.json();
				UI.hideModal();
				Log.info("AdminConfigTab::uploadGradesPrairie(..) - RESPONSE: " + JSON.stringify(data));
				UI.notification(data.success.message);
			} else {
				const reason = await response.json();
				UI.hideModal();
				if (typeof reason.failure && typeof reason.failure.message) {
					UI.notification(
						"There was an issue uploading your grade CSV. " +
							"Please ensure the CSV file includes all required columns. <br/>Details: " +
							reason.failure.message
					);
				} else {
					UI.notification("There was an issue uploading your grade CSV. " + "Please ensure the CSV file includes all required columns.");
				}
			}
		} catch (err) {
			UI.hideModal();
			Log.error("AdminConfigTab::uploadGradesPrairie(..) - ERROR: " + err.message);
			AdminView.showError(err);
		}

		Log.trace("AdminConfigTab::uploadGradesPrairie(..) - end");
	}

	private async teamCreatePressed(): Promise<void> {
		Log.trace("AdminConfigTab::teamCreatePressed(..) - start");
		const delivDropdown = document.querySelector("#adminTeamDeliverableSelect") as HTMLSelectElement;
		const delivId = delivDropdown.value;

		const names = UI.getTextFieldValue("adminTeamText");
		let nameList = names.split(",");
		nameList = nameList.map(Function.prototype.call, String.prototype.trim); // trim whitespace before/after names

		const url = this.remote + "/portal/admin/team";
		const options: any = AdminView.getOptions();
		options.method = "post";

		const team: TeamFormationTransport = {
			delivId: delivId,
			githubIds: nameList,
		};

		Log.trace("AdminConfigTab::teamCreatePressed(..) - body: " + JSON.stringify(team));

		options.body = JSON.stringify(team);

		const response = await fetch(url, options);
		const body = await response.json();

		if (typeof body.success !== "undefined") {
			UI.showSuccessToast("Team created successfully: " + body.success[0].id);
			UI.clearTextField("adminTeamText");
		} else {
			UI.showAlert(body.failure.message);
		}
	}

	private async teamDeletePressed(): Promise<void> {
		Log.trace("AdminConfigTab::teamDeletePressed(..) - start");

		const teamId = UI.getTextFieldValue("adminDeleteTeamManageTeam");

		const url = this.remote + "/portal/admin/team/" + teamId;
		const options: any = AdminView.getOptions();
		options.method = "delete";

		Log.trace("AdminConfigTab::teamDeletePressed(..) - body: " + JSON.stringify({}));

		options.body = JSON.stringify({});

		const response = await fetch(url, options);
		const body = await response.json();

		if (typeof body.success !== "undefined") {
			UI.showSuccessToast("Team deleted successfully: " + body.success.message);
			UI.clearTextField("adminDeleteTeamManageTeam");
		} else {
			UI.showAlert(body.failure.message);
		}
	}

	private async teamAddMemberPressed(): Promise<void> {
		Log.trace("AdminConfigTab::teamAddMemberPressed(..) - start");

		const teamId = UI.getTextFieldValue("adminTeamAddMemberTeam");
		const memberId = UI.getTextFieldValue("adminTeamAddMemberMember");

		const url = this.remote + "/portal/admin/team/" + teamId + "/members/" + memberId;
		const options: any = AdminView.getOptions();
		options.method = "post";

		Log.trace("AdminConfigTab::teamAddMemberPressed(..) - body: " + JSON.stringify({}));

		options.body = JSON.stringify({});

		const response = await fetch(url, options);
		const body = await response.json();

		if (typeof body.success !== "undefined") {
			UI.showSuccessToast("Team member added successfully: " + body.success.message);
			UI.clearTextField("adminTeamAddMemberTeam");
			UI.clearTextField("adminTeamAddMemberMember");
		} else {
			UI.showAlert(body.failure.message);
		}
	}

	private async teamRemoveMemberPressed(): Promise<void> {
		Log.trace("AdminConfigTab::teamRemoveMemberPressed(..) - start");

		const teamId = UI.getTextFieldValue("adminTeamRemoveMemberTeam");
		const memberId = UI.getTextFieldValue("adminTeamRemoveMemberMember");

		const url = this.remote + "/portal/admin/team/" + teamId + "/members/" + memberId;
		const options: any = AdminView.getOptions();
		options.method = "delete";

		Log.trace("AdminConfigTab::teamRemoveMemberPressed(..) - body: " + JSON.stringify({}));

		options.body = JSON.stringify({});

		const response = await fetch(url, options);
		const body = await response.json();

		if (typeof body.success !== "undefined") {
			UI.showSuccessToast("Team member removed successfully: " + body.success.message);
			UI.clearTextField("adminTeamRemoveMemberTeam");
			UI.clearTextField("adminTeamRemoveMemberMember");
		} else {
			UI.showAlert(body.failure.message);
		}
	}

	private showClasslistChanges(classlistChanges: any): void {
		Log.info("AdminConfigTab::showClasslistChanges(..) - changes: " + JSON.stringify(classlistChanges));
		const mapToTextAndSubtext = function (people: StudentTransport[]) {
			return people.map(function (person) {
				return {
					text: person.id + "/" + person.studentNum + "/" + person.githubId + ": " + person.firstName + " " + person.lastName,
					subtext: person.labId,
				};
			});
		};
		if (classlistChanges.created.length) {
			const createdList = mapToTextAndSubtext(classlistChanges.created);
			UI.templateConfirm("classlistDialog.html", {
				header: "Created: May need Repos Provisioned",
				listContent: createdList,
			});
		}
		if (classlistChanges.updated.length) {
			const updatedList = mapToTextAndSubtext(classlistChanges.updated);
			UI.templateConfirm("classlistDialog.html", {
				header: "Updated: Student data has been modified in new Classlist upload",
				listContent: updatedList,
			});
		}
		if (classlistChanges.removed.length) {
			const removedList = mapToTextAndSubtext(classlistChanges.removed);
			UI.templateConfirm("classlistDialog.html", {
				header: "Removed: NOT in latest Classlist upload. To Be Withdrawn",
				listContent: removedList,
			});
		}
	}

	/**
	 * Describes every button on this page whose work runs as a background job; JobRunner does the
	 * starting and watching.
	 */
	private async initJobSections(): Promise<void> {
		const sections: JobSection[] = [
			{
				kind: "classlist-update",
				buttonId: "adminUpdateClasslist",
				statusId: "adminUpdateClasslistStatus",
				ran: "Last updated",
				detail: function (summary: any): string {
					return summary.created.length + " added, " + summary.updated.length + " updated, " + summary.removed.length + " removed.";
				},
				// only for the run this page started; arriving at a finished job should not reopen it
				onFinished: (summary: any) => {
					UI.notificationToast("Classlist updated: " + summary.classlist.length + " students processed.");
					this.showClasslistChanges(summary);
				},
			},
			{
				kind: "student-withdraw",
				buttonId: "adminPerformWithdrawButton",
				statusId: "adminPerformWithdrawStatus",
				ran: "Last run",
				detail: function (summary: any): string {
					return summary.message;
				},
				onFinished: (summary: any) => {
					UI.notificationToast("Withdraw marking successful: " + summary.message, 5000);
				},
			},
		];

		if ((await this.isPrairieLearnEnabled()) === true) {
			(document.querySelector("#adminPrairieLearnSyncItem") as HTMLElement).style.display = "";
			sections.push({
				kind: "prairielearn-sync",
				buttonId: "adminPrairieLearnSyncButton",
				cancelButtonId: "adminPrairieLearnCancelButton",
				statusId: "adminPrairieLearnStatus",
				ran: "Last synced",
				neverRun: "Never synced.",
				detail: AdminConfigTab.describePrairieLearnSummary,
			});
		}

		await Promise.all(sections.map((section) => this.jobs.init(section)));
	}

	/**
	 * PrairieLearn is hidden unless PRAIRIELEARN_* is configured in Classy's .env.
	 */
	private async isPrairieLearnEnabled(): Promise<boolean> {
		if (document.querySelector("#adminPrairieLearnSyncItem") === null) {
			return false; // course has customised admin.html and removed the section
		}
		try {
			const response = await fetch(this.remote + "/portal/config", AdminView.getOptions());
			const json = await response.json();
			return json?.success?.prairieLearnEnabled === true;
		} catch (err) {
			Log.warn("AdminConfigTab::isPrairieLearnEnabled() - could not read config; ERROR: " + err.message);
			return false;
		}
	}

	private static describePrairieLearnSummary(summary: any): string {
		let detail = summary.gradesWritten + " grades, " + summary.resultsWritten + " results, " + summary.instancesSkipped + " unchanged";
		if (summary.deliverablesCreated?.length > 0) {
			detail += "; created " + summary.deliverablesCreated.join(", ");
		}
		if (summary.submissionsAfterClose > 0) {
			detail += "; " + summary.submissionsAfterClose + " attempt(s) after close (not graded)";
		}
		if (summary.unmatchedUids?.length > 0) {
			// a systematic mismatch looks like "nobody has submitted"; make it loud
			detail += "; <b>" + summary.unmatchedUids.length + " unmatched user(s)</b>";
		}
		return detail + ".";
	}

	private async defaultDeliverablePressed(): Promise<void> {
		Log.trace("AdminConfigTab::defaultDeliverablePressed(..) - start");
		const delivDropdown = document.querySelector("#adminDefaultDeliverableSelect") as HTMLSelectElement;
		const value = delivDropdown.value;

		this.course.defaultDeliverableId = value; // update with new value

		Log.trace("AdminConfigTab::defaultDeliverablePressed(..) - value: " + value);

		const url = this.remote + "/portal/admin/course";
		const options: any = AdminView.getOptions();
		options.method = "post";
		options.body = JSON.stringify(this.course);

		const response = await fetch(url, options);
		const body = await response.json();

		if (typeof body.success !== "undefined") {
			UI.showSuccessToast("Default deliverable saved successfully.");
		} else {
			UI.showAlert(body.failure.message);
		}
	}
}
