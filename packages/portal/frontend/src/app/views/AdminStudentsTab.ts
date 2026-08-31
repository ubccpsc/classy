import Log from "@common/Log";
import { StudentTransport, StudentTransportPayload } from "@common/types/PortalTypes";

import { SortableTable, TableCell, TableHeader } from "../util/SortableTable";
import { UI } from "../util/UI";
import { ViewAs } from "../util/ViewAs";

import { AdminView } from "./AdminView";

export class AdminStudentsTab {
	private readonly remote: string; // url to backend
	public constructor(remote: string) {
		this.remote = remote;
	}

	// called by reflection in renderPage
	public async init(opts: any): Promise<void> {
		Log.info("AdminStudentsTab::init(..) - start");

		// NOTE: this could consider if studentListTable has children, and if they do, do not refresh
		document.getElementById("studentListTable").innerHTML = ""; // clear target

		if (typeof opts.labSection === "undefined") {
			opts.labSection = "-All-";
		}

		UI.showModal("Retrieving students.");
		const students = await AdminStudentsTab.getStudents(this.remote);
		UI.hideModal();

		this.render(students, opts.labSection);
	}

	private render(students: StudentTransport[], labSection: string): void {
		Log.trace("AdminStudentsTab::render(..) - start");

		const headers: TableHeader[] = [
			{
				id: "num",
				text: "#",
				sortable: true, // Whether the column is sortable (sometimes sorting does not make sense).
				defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
				sortDown: false, // Whether the column should initially sort descending or ascending.
				style: "padding-left: 1em; padding-right: 1em;",
			},
			{
				id: "githubId",
				text: "GitHub Id",
				sortable: true, // Whether the column is sortable (sometimes sorting does not make sense).
				defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
				sortDown: false, // Whether the column should initially sort descending or ascending.
				style: "padding-left: 1em; padding-right: 1em;",
			},
			{
				id: "id",
				text: "CSID",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em;",
			},
			{
				id: "fName",
				text: "First Name",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em;",
			},
			{
				id: "lName",
				text: "Last Name",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em;",
			},
			{
				id: "viewAs",
				text: "View As",
				sortable: false,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em;",
			},
			{
				id: "labId",
				text: "Lab",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em;",
			},
		];

		let labSectionsOptions = ["-All-", "-Unspecified-"];
		const st = new SortableTable(headers, "#studentListTable");

		let count = 1;
		for (const student of students) {
			let labId = "";
			if (student.labId !== null && student.labId.length > 0) {
				labId = student.labId;
			}
			const row: TableCell[] = [
				{ value: count, html: count++ + "" },
				{
					value: student.githubId,
					html: "<a class='selectable' href='" + student.userUrl + "'>" + student.githubId + "</a>", // Should be CWL
				},
				{ value: student.id, html: student.id }, // Should be CSID
				{ value: student.firstName, html: student.firstName },
				{ value: student.lastName, html: student.lastName },
				{
					// NOTE: the entry point for driving Classy as this student. The button only asks the
					// backend to open a session (which audits it); the backend re-checks the caller on
					// every request afterwards, so this is convenience, not authorization.
					value: student.id,
					html:
						"<button class='viewAsButton' data-id='" +
						student.id +
						"' data-name='" +
						student.firstName +
						" " +
						student.lastName +
						"'>View As</button>",
				},
				{ value: labId, html: labId },
			];
			if (labSectionsOptions.indexOf(student.labId) < 0 && student.labId !== "" && student.labId !== null) {
				labSectionsOptions.push(student.labId);
			}
			if (
				labSection === student.labId ||
				labSection === "-All-" ||
				(labSection === "-Unspecified-" && (student.labId === "" || student.labId === null))
			) {
				st.addRow(row);
			}
		}

		st.generate();
		this.wireViewAsButtons();

		labSectionsOptions = labSectionsOptions.sort();
		UI.setDropdownOptions("studentsListSelect", labSectionsOptions, labSection);

		const labSelector = document.querySelector("#studentsListSelect") as HTMLSelectElement;
		const that = this;
		labSelector.onchange = function (evt) {
			Log.info("AdminStudentsTab::render(..) - lab changed");
			evt.stopPropagation(); // prevents list item expansion

			const val = labSelector.value.valueOf();

			// that.renderPage("AdminStudents", {labSection: val}); // if we need to re-fetch
			that.render(students, val); // if cached data is ok
		};

		if (st.numRows() > 0) {
			UI.showSection("studentListTable");
			UI.hideSection("studentListTableNone");
		} else {
			UI.showSection("studentListTable");
			UI.hideSection("studentListTableNone");
		}
	}

	/**
	 * Wires the per-student "View As" buttons.
	 *
	 * Pressing one opens a session (which the backend audits) and then reloads into the student view.
	 * The reload is deliberate: it guarantees every view is rebuilt with the header in place, rather
	 * than leaving some already-rendered admin page holding data fetched as the admin.
	 */
	private wireViewAsButtons(): void {
		const buttons = document.querySelectorAll(".viewAsButton");
		for (const element of Array.from(buttons)) {
			const button = element as HTMLButtonElement;
			button.onclick = async () => {
				const personId = button.getAttribute("data-id");
				const name = button.getAttribute("data-name");
				Log.info("AdminStudentsTab::viewAs( " + personId + " ) - start");

				try {
					const options: any = AdminView.getOptions();
					options.method = "post";
					const response = await fetch(this.remote + "/portal/admin/viewAs/" + personId, options);
					const json = await response.json();

					if (typeof json.success === "undefined") {
						UI.showError(json);
						return;
					}

					ViewAs.start(personId, name + " (" + personId + ")");
					window.location.reload();
				} catch (err) {
					Log.error("AdminStudentsTab::viewAs( " + personId + " ) - ERROR: " + err.message);
					UI.showError(err.message);
				}
			};
		}
	}

	public static async getStaff(remote: string): Promise<StudentTransport[]> {
		Log.info("AdminStudentsTab::getStaff( .. ) - start");
		try {
			return await AdminStudentsTab.getPeople(remote + "/portal/admin/staff");
		} catch (err) {
			Log.error("AdminStudentsTab::getStaff( .. ) - ERROR: " + err.message);
		}
	}

	public static async getStudents(remote: string): Promise<StudentTransport[]> {
		Log.info("AdminStudentsTab::getStudents( .. ) - start");
		try {
			return await AdminStudentsTab.getPeople(remote + "/portal/admin/students");
		} catch (err) {
			Log.error("AdminStudentsTab::getStudents( .. ) - ERROR: " + err.message);
		}
	}

	public static async getPeople(url: string): Promise<StudentTransport[]> {
		Log.info("AdminStudentsTab::getPeople( .. ) - start; url: " + url);

		try {
			const start = Date.now();
			// const url = remote + "/portal/admin/students";
			const options = AdminView.getOptions();
			const response = await fetch(url, options);

			if (response.status === 200) {
				Log.trace("AdminStudentsTab::getPeople(..) - 200 received");
				const json: StudentTransportPayload = await response.json();
				// Log.trace("AdminView::handleStudents(..)  - payload: " + JSON.stringify(json));
				if (typeof json.success !== "undefined" && Array.isArray(json.success)) {
					Log.trace("AdminStudentsTab::getPeople(..)  - worked; # students: " + json.success.length + "; took: " + UI.took(start));
					return json.success;
				} else {
					Log.trace("AdminStudentsTab::getPeople(..)  - ERROR: " + json.failure.message);
					AdminView.showError(json.failure); // FailurePayload
				}
			} else {
				Log.trace("AdminView::getPeople(..)  - !200 received: " + response.status);
				const text = await response.text();
				AdminView.showError(text);
			}
		} catch (err) {
			AdminView.showError("Getting people failed: " + err.message);
		}
		return [];
	}
}
