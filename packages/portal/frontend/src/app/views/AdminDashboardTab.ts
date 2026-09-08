import Log from "@common/Log";
import { ClusteredResult } from "@common/types/ContainerTypes";
import {
	AutoTestDashboardPayload,
	AutoTestDashboardTransport,
	DeliverableTransport,
	PERSON_VIEWS,
	PersonView,
	RepositoryTransport,
} from "@common/types/PortalTypes";
import moment from "moment";
import { OnsButtonElement } from "onsenui";

import { DashboardTable } from "../util/DashboardTable";
import { TableCell, TableHeader } from "../util/SortableTable";
import { UI } from "../util/UI";

import { AdminDeliverablesTab } from "./AdminDeliverablesTab";
import { AdminPage } from "./AdminPage";
import { AdminResultsTab } from "./AdminResultsTab";
import { AdminView } from "./AdminView";

declare let TomSelect: any;

export interface DetailRow {
	name: string;
	state: string;
	colour: string;
}

export class AdminDashboardTab extends AdminPage {
	// private readonly remote: string; // url to backend
	private delivValue: string | null = null;
	private repoValue: string | null = null;

	public constructor(remote: string) {
		// this.remote = remote;
		super(remote);
	}

	// called by reflection in renderPage
	/**
	 * The view the selector is set to, or "all" when the page does not have one (a course can
	 * customise admin.html and drop it). "all" rather than "students" because these views have
	 * always shown every result, staff runs included.
	 */
	private static selectedView(): PersonView {
		const select = document.querySelector("#dashboardViewSelect") as HTMLSelectElement;
		if (select === null) {
			return "all";
		}
		return PERSON_VIEWS.indexOf(select.value as PersonView) >= 0 ? (select.value as PersonView) : "all";
	}

	private wireViewSelector(): void {
		const select = document.querySelector("#dashboardViewSelect") as HTMLSelectElement;
		if (select === null) {
			return;
		}
		select.onchange = () => {
			this.init({}).catch((err) => {
				Log.error("AdminDashboardTab::wireViewSelector(..) - ERROR: " + err.message);
			});
		};
	}

	/**
	 * What the second dropdown offers. Repository ids by default.
	 *
	 * protected because "which repository" is not a question every course can answer: a course whose
	 * results do not come from repositories at all (PrairieLearn keys them by assessment instance)
	 * needs to offer something else -- a CWL, say -- and filter on that instead. A subclass that
	 * changes this must also override personFilter(), or the value it offers will be sent as a
	 * repository id and match nothing.
	 */
	protected buildRepoOptions(repos: RepositoryTransport[]): string[] {
		const names: string[] = [];
		for (const repo of repos) {
			names.push(repo.id);
		}
		return names;
	}

	/**
	 * The person to filter by, when the second dropdown selects people rather than repositories.
	 *
	 * null (the default) means the selection is a repository id and is sent as one. Returning a
	 * value here sends it as ?person= instead, and the repository filter is left open -- the two are
	 * alternative ways of narrowing the same list, not filters that combine.
	 */
	protected personFilter(): string | null {
		return null;
	}

	public async init(opts: any): Promise<void> {
		Log.info("AdminDashboardTab::init(..) - start");
		const that = this;
		// NOTE: this could consider if studentListTable has children, and if they do, do not refresh
		document.getElementById("dashboardListTable").innerHTML = ""; // clear target

		UI.showModal("Retrieving results.");
		const course = await AdminView.getCourse(this.remote);
		if (this.delivValue === null) {
			// The course's default deliverable, when it has one. A course that grades outside
			// AutoTest has none -- the Config tab only offers AutoTest deliverables as the default --
			// and the old code then seeded the dropdown with a single `null` option. The first query
			// went out filtering for a deliverable named "null", so the page rendered empty until
			// Update was pressed, by which point render() had populated the real options. "any" is
			// the honest default for "no particular deliverable".
			this.delivValue = course.defaultDeliverableId ?? "any";
			// ugly way to set the default the first time the page is rendered
			UI.setDropdownOptions("dashboardDelivSelect", [this.delivValue], this.delivValue);
		}
		const delivs = await AdminDeliverablesTab.getDeliverables(this.remote); // for select
		const repos = await AdminResultsTab.getRepositories(this.remote); // for select
		const results = await this.performQueries();
		UI.hideModal();

		this.wireViewSelector();

		const fab = document.querySelector("#dashboardUpdateButton") as OnsButtonElement;
		fab.onclick = function (_evt: any) {
			Log.info("AdminDashboardTab::init(..)::updateButton::onClick");
			UI.showModal("Retrieving results.");
			that
				.performQueries()
				.then(function (newResults) {
					// TODO: need to track and update the current value of deliv and repo
					that.render(delivs, repos, newResults);
					UI.hideModal();
				})
				.catch(function (err) {
					UI.showError(err);
				});
		};

		this.render(delivs, repos, results);
	}

	private async performQueries(): Promise<AutoTestDashboardTransport[]> {
		Log.info("AdminDashboardTab::performQueries(..) - start");
		const start = Date.now();

		let deliv = UI.getDropdownValue("dashboardDelivSelect");
		if (deliv === "-Any-") {
			deliv = "any";
		}
		let repo = UI.getDropdownValue("dashboardRepoSelect");
		if (repo === "-Any-") {
			repo = "any";
		}
		this.delivValue = deliv;
		this.repoValue = repo;
		// see AdminResultsTab: a person filter and a repo filter are alternatives, not a conjunction
		const person = this.personFilter();
		const results = await AdminDashboardTab.getDashboard(
			this.remote,
			deliv,
			person === null ? repo : "any",
			AdminDashboardTab.selectedView(),
			person
		);
		Log.info("AdminDashboardTab::performQueries(..) - done; # results: " + results.length + "; took: " + UI.took(start));
		return results;
	}

	/**
	 * The columns of the dashboard table.
	 *
	 * protected for the same reason as AdminResultsTab::buildHeaders: a course plugin can relabel a
	 * column, or add one, without re-implementing the table. A subclass that adds a header must
	 * append the matching cell in decorateRow().
	 */
	protected buildHeaders(): TableHeader[] {
		return [
			{
				id: "timestamp",
				text: "Timestamp",
				sortable: true,
				defaultSort: true,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em; text-align: center;",
			},
			{
				id: "?",
				text: "?",
				sortable: false,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em; text-align: center;",
			},
			{
				id: "repoId",
				text: "Repository",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em; text-align: left;",
			},
			{
				id: "delivId",
				text: "Deliv",
				sortable: true, // Whether the column is sortable (sometimes sorting does not make sense).
				defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
				sortDown: false, // Whether the column should initially sort descending or ascending.
				style: "padding-left: 1em; padding-right: 1em; text-align: center;",
			},
			{
				id: "score",
				text: "Score %",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em; text-align: center;",
			},
			{
				id: "testScore",
				text: "Correctness %",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em; text-align: center;",
			},
			{
				id: "coverScore",
				text: "Cover %",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em; text-align: center;",
			},
			{
				id: "results",
				text: "Results",
				sortable: false,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em;",
			},
		];
	}

	/**
	 * Last chance to change a row before it is added; the default returns it untouched.
	 */
	protected decorateRow(row: TableCell[], result: AutoTestDashboardTransport): TableCell[] {
		void result;
		return row;
	}

	private render(delivs: DeliverableTransport[], repos: RepositoryTransport[], results: AutoTestDashboardTransport[]): void {
		Log.trace("AdminDashboardTab::render(..) - start");
		const that = this;

		// Every deliverable; see the same change in AdminResultsTab. Results no longer come only from
		// AutoTest containers, so shouldAutoTest is not a proxy for "could have results" any more.
		let delivNames: string[] = [];
		for (const deliv of delivs) {
			delivNames.push(deliv.id);
		}
		delivNames = delivNames.sort();
		delivNames.unshift("-Any-");
		UI.setDropdownOptions("dashboardDelivSelect", delivNames, this.delivValue);

		let repoNames: string[] = this.buildRepoOptions(repos);
		repoNames = repoNames.sort();
		repoNames.unshift("-Any-");
		UI.setDropdownOptions("dashboardRepoSelect", repoNames, this.repoValue);

		const headers: TableHeader[] = this.buildHeaders();
		const st = new DashboardTable(headers, "#dashboardListTable");

		// this loop could not possibly be less efficient
		for (const result of results) {
			// repoId
			// repoURL
			// delivId
			// result
			// timestamp
			// commitSHA
			// commitURL
			// scoreOverall
			// scoreCover
			// scoreTests

			// const ts = result.input.pushInfo.timestamp;
			const ts = result.timestamp;
			const date = new Date(ts);
			const mom = moment(date);
			const tsString = mom.format("MM/DD[@]HH:mm");

			const dashRow = this.generateHistogram(result);

			const stdioViewerURL = "/stdio.html?delivId=" + result.delivId + "&repoId=" + result.repoId + "&sha=" + result.commitSHA;

			// ion-ios-help-outline
			const row: TableCell[] = [
				{ value: ts, html: "<a class='selectable' href='" + result.commitURL + "'>" + tsString + "</a>" },
				{
					value: "",
					html: "<a style='cursor: pointer;' target='_blank' href='" + stdioViewerURL + "'><ons-icon icon='md-info-outline'</ons-icon></a>",
				},
				{
					value: result.repoId,
					html: "<a class='selectable' href='" + result.repoURL + "'>" + result.repoId + "</a>",
				},
				{ value: result.delivId, html: result.delivId },
				{ value: result.scoreOverall, html: this.alignValue(result.scoreOverall) },
				{ value: result.scoreTests, html: this.alignValue(result.scoreTests) },
				{ value: result.scoreCover, html: this.alignValue(result.scoreCover) },
				{ value: "", html: dashRow },
			];

			st.addRow(this.decorateRow(row, result));
		}

		st.generate();

		try {
			new TomSelect("#dashboardRepoSelect", {
				maxOptions: null,
				maxItems: 1,
				closeAfterSelect: true,
				onDropdownOpen: function () {
					Log.trace("AdminDashboardTab::render(..)::repoSelect - Clearing input: " + this);
					this.setValue("");
				},
				onDropdownClose: function () {
					// heavyweight way to initiate a search, but it works
					Log.trace("AdminDashboardTab::render(..)::repoSelect - Performing search: " + this);
					Log.trace("AdminDashboardTab::render(..)::repoSelect - Search value: " + this.getValue());
					if (this.getValue() === "") {
						// if nothing selected, go back to any
						this.setValue("-Any-");
					}
					void that.init({}).then().catch(); // ignored on purpose
					this.blur();
				},
			});
		} catch (err) {
			Log.trace("AdminDashboardTab::render(..) - updating select; MSG: " + err.message);
		}

		if (st.numRows() > 0) {
			UI.showSection("dashboardListTable");
			UI.hideSection("dashboardListTableNone");
		} else {
			UI.showSection("dashboardListTable");
			UI.hideSection("dashboardListTableNone");
		}
	}

	private generateHistogram(row: AutoTestDashboardTransport): string {
		const passNames = row.testPass as string[];
		const failNames = row.testFail as string[];
		const skipNames = row.testSkip as string[];
		const errorNames = row.testError as string[];

		let all: string[] = [];
		all = all.concat(passNames, failNames, skipNames, errorNames);
		all = all.sort();

		const annotated: DetailRow[] = [];
		for (let name of all) {
			let state = "unknown";
			let colour = "black";
			if (failNames.indexOf(name) >= 0) {
				state = "fail";
				colour = "red";
			} else if (passNames.indexOf(name) >= 0) {
				state = "pass";
				colour = "green";
			} else if (skipNames.indexOf(name) >= 0) {
				state = "skip";
				colour = "grey";
			} else if (errorNames.indexOf(name) >= 0) {
				state = "error";
				colour = "orange";
			} else {
				// unknown name
			}
			// sanitize: test names are student-authored and are rendered into a title attribute
			name = AdminDashboardTab.escapeHtml(name);
			annotated.push({ name: name, state: state, colour: colour });
		}

		let str: string = "<div class='histogramcontainer'>";
		str += this.generateTable(annotated);
		if (row.hasOwnProperty("cluster")) {
			str += this.generateClusteredTable(annotated, row.delivId, row.custom.cluster);
		}
		str += "</div>";
		return str;
	}

	/**
	 * Escapes a string for interpolation into HTML text or a quoted attribute value.
	 *
	 * The previous version called String.replace four times with STRING patterns, which replace
	 * only the FIRST occurrence -- so "a<b<c" became "a&lt;b<c". Test names are student-authored
	 * and land in title='...' (generateTable) and title="..." (generateClusteredTable), so a name
	 * with two metacharacters escaped the attribute and ran script in a session that holds admin
	 * rights over the GitHub org. It also mapped ' to &quot; (wrong character) and never escaped
	 * &, which double-decodes anything a student writes literally.
	 *
	 * & must be replaced first, or it re-escapes the entity prefixes introduced below it.
	 */
	private static escapeHtml(value: string): string {
		return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
	}

	private generateTable(annotated: DetailRow[]): string {
		let str = "<span class='normalhistogram'><table style='height: 20px;'>";
		str += "<tr class='selectable'>";
		// underscores for easier searching
		str += "<td class='selectable' style='width: 2em; text-align: center;'>_" + annotated.length + "_</td>";
		for (const a of annotated) {
			str += "<td class='dashResultCell' style='width: 5px; height: 20px; background: " + a.colour + "' title='" + a.name + "'></td>";
		}
		str += "</tr>";
		str += "</table></span>";
		return str;
	}

	private generateClusteredTable(annotated: DetailRow[], _delivId: string, clusteredResult: ClusteredResult): string {
		const cellMap: { [key: string]: string } = {};
		for (const cell of annotated) {
			const c = cell.colour;
			const n = cell.name;
			cellMap[cell.name] = `<td class="dashResultCell" style="width: 5px; height: 20px; background: ${c}" title="${n}"></td>`;
		}
		let str = "<span class='clusteredhistogram hidden'><table style='height: 20px;'>";
		for (const cluster of Object.keys(clusteredResult)) {
			str += "<tr>";
			str += "<td style='width: 2em; text-align: center;'> " + cluster + " < /td>";
			for (const test of clusteredResult[cluster].allNames) {
				str += cellMap[test];
			}
			str += "</tr>";
		}
		str += "</table></span>";
		return str;
	}

	public static async getDashboard(
		remote: string,
		delivId: string,
		repoId: string,
		view: PersonView = "all",
		person: string | null = null
	): Promise<AutoTestDashboardTransport[]> {
		Log.info("AdminDashboardTab::getDashboard( .. ) - start");

		const start = Date.now();
		let url = remote + "/portal/admin/dashboard/" + delivId + "/" + repoId + "/" + view;
		if (person !== null && person.length > 0) {
			url += "?person=" + encodeURIComponent(person);
		}
		const options = AdminView.getOptions();
		const response = await fetch(url, options);

		if (response.status === 200) {
			Log.trace("AdminDashboardTab::getDashboard(..) - 200 received");
			const json: AutoTestDashboardPayload = await response.json();
			// Log.trace("AdminView::handleStudents(..)  - payload: " + JSON.stringify(json));
			if (typeof json.success !== "undefined" && Array.isArray(json.success)) {
				Log.trace("AdminDashboardTab::getDashboard(..)  - worked; # rows: " + json.success.length + "; took: " + UI.took(start));
				return json.success;
			} else {
				Log.trace("AdminDashboardTab::getDashboard(..)  - ERROR: " + json.failure.message);
				AdminView.showError(json.failure); // FailurePayload
			}
		} else {
			Log.trace("AdminDashboardTab::getDashboard(..)  - !200 received: " + response.status);
			const text = await response.text();
			AdminView.showError(text);
		}

		return [];
	}

	private alignValue(value: number | string): string {
		const SPACER = "&#8199;";

		if (value === null) {
			return SPACER + SPACER + "N/A";
		}

		if (typeof value === "string") {
			if (value === "N/A") {
				return SPACER + SPACER + "N/A";
			}
			if (value === "") {
				return "";
			}
			value = Number.parseFloat(value);
		}

		const origValue = Number(value);
		let score: number | string = "";
		let scorePrepend = "";
		score = Number(value);
		if (score === 100) {
			score = "100.00";
		} else {
			// two decimal places
			if (typeof value === "number") {
				score = value.toFixed(2);
			} else {
				Log.trace("AdminDashboardTab::alignValue(..) - not a number: " + value);
			}

			// prepend space (not 100)
			scorePrepend = SPACER + scorePrepend;
			if (origValue < 10) {
				// prepend with extra space if < 10
				scorePrepend = SPACER + scorePrepend;
			}
		}
		return scorePrepend + score;
	}
}
