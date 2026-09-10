import Log from "@common/Log";
import {
	AutoTestResultSummaryPayload,
	AutoTestResultSummaryTransport,
	DeliverableTransport,
	PERSON_VIEWS,
	PersonView,
	RepositoryPayload,
	RepositoryTransport,
} from "@common/types/PortalTypes";
import moment from "moment";
import { OnsButtonElement } from "onsenui";

import { SortableTable, TableCell, TableHeader } from "../util/SortableTable";
import { UI } from "../util/UI";

import { AdminDeliverablesTab } from "./AdminDeliverablesTab";
import { AdminPage } from "./AdminPage";
import { AdminView } from "./AdminView";

declare let TomSelect: any;

export class AdminResultsTab extends AdminPage {
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
		const select = document.querySelector("#resultsViewSelect") as HTMLSelectElement;
		if (select === null) {
			return "all";
		}
		return PERSON_VIEWS.indexOf(select.value as PersonView) >= 0 ? (select.value as PersonView) : "all";
	}

	private wireViewSelector(): void {
		const select = document.querySelector("#resultsViewSelect") as HTMLSelectElement;
		if (select === null) {
			return;
		}
		select.onchange = () => {
			this.init({}).catch((err) => {
				Log.error("AdminResultsTab::wireViewSelector(..) - ERROR: " + err.message);
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
		Log.info("AdminResultsTab::init(..) - start");
		const that = this;

		// NOTE: this could consider if studentListTable has children, and if they do, do not refresh
		document.getElementById("resultsListTable").innerHTML = ""; // clear target

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
			UI.setDropdownOptions("resultsDelivSelect", [this.delivValue], this.delivValue);
		}
		const delivs = await AdminDeliverablesTab.getDeliverables(this.remote); // for select
		const repos = await AdminResultsTab.getRepositories(this.remote); // for select
		const results = await this.performQueries();
		UI.hideModal();

		this.wireViewSelector();

		const fab = document.querySelector("#resultsUpdateButton") as OnsButtonElement;
		fab.onclick = function (_evt: any) {
			Log.info("AdminResultsTab::init(..)::updateButton::onClick");
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

	private async performQueries(): Promise<AutoTestResultSummaryTransport[]> {
		Log.info("AdminResultsTab::performQueries(..) - start");
		const start = Date.now();
		let deliv = UI.getDropdownValue("resultsDelivSelect");
		if (deliv === "-Any-") {
			deliv = "any";
		}
		let repo = UI.getDropdownValue("resultsRepoSelect");
		if (repo === "-Any-") {
			repo = "any";
		}

		this.delivValue = deliv;
		this.repoValue = repo;
		// when the subclass filters by person, the repo filter is left open: the dropdown holds a
		// person, not a repository id, and sending it as one would match nothing
		const person = this.personFilter();
		const repoFilter = person === null ? this.repoValue : "any";
		const values = await AdminResultsTab.getResults(this.remote, this.delivValue, repoFilter, AdminResultsTab.selectedView(), person);
		Log.info("AdminResultsTab::performQueries(..) - done; # values: " + values.length + "; took: " + UI.took(start));
		return values;
	}

	/**
	 * The columns of the results table.
	 *
	 * protected so a course plugin can subclass this tab and relabel or add a column without
	 * re-implementing the whole table. CS210, for example, reports a mutation score rather than
	 * coverage, and shows a count of the student's own passing tests -- neither of which means
	 * anything to a course whose container reports real coverage.
	 *
	 * A subclass that adds a column must append the matching cell in decorateRow(), in the same
	 * order, or the row and its headers will disagree.
	 */
	protected buildHeaders(): TableHeader[] {
		return [
			{
				id: "timstamp",
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
				id: "scoreTest",
				text: "Correctness %",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em; text-align: center;",
			},
			{
				id: "scoreCover",
				// the field's meaning belongs to the container, so this label is the generic one. A
				// course whose container reports something else -- CS210 reports a mutation score --
				// relabels it by overriding buildHeaders rather than renaming it for everyone.
				text: "Cover %",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em; text-align: center;",
			},
			{
				id: "state",
				text: "State",
				sortable: true,
				defaultSort: false,
				sortDown: true,
				style: "padding-left: 1em; padding-right: 1em; text-align: center;",
			},
		];
	}

	/**
	 * A sub-score cell: two decimals, or N/A when the container reported none.
	 *
	 * null and 0 are different answers -- "the container said nothing" versus "the student scored
	 * nothing" -- and rendering the first as 0.00 would quietly invent a result. Matches how the
	 * dashboard has always shown a missing value.
	 */
	protected static percentCell(value: number | null): string {
		const SPACER = "&#8199;";
		if (typeof value !== "number") {
			return SPACER + SPACER + "N/A";
		}
		if (value === 100) {
			return "100.00";
		}
		return (value < 10 ? SPACER + SPACER : SPACER) + value.toFixed(2);
	}

	/**
	 * Last chance to change a row before it is added.
	 *
	 * The default returns it untouched. A subclass that added a column in buildHeaders() appends the
	 * matching cell here, so the two stay in step without re-implementing the render loop.
	 */
	/**
	 * The href an admin table shows for a record URL; the default is the URL as stored.
	 *
	 * A seam for course plugins, like buildRepoOptions() and decorateRow(). The motivating case is
	 * PrairieLearn: PrairieLearnAgent stores the STUDENT link for an assessment instance (the one a
	 * student can open from their grades page), and an instructor opening it lands on the
	 * student-facing page. A course that uses PL overrides this with
	 *   return Util.toInstructorPrairieLearnUrl(url);
	 * (@common/Util; GitHub and other URLs pass through it untouched). Core stays neutral so a course
	 * without PL sees exactly what it always did, and the stored record is never changed.
	 */
	protected adminLink(url: string): string {
		return url;
	}

	protected decorateRow(row: TableCell[], result: AutoTestResultSummaryTransport): TableCell[] {
		void result;
		return row;
	}

	private renderResults(results: AutoTestResultSummaryTransport[]): void {
		Log.trace("AdminResultsTab::renderResults: " + results.length);
		const headers: TableHeader[] = this.buildHeaders();

		const st = new SortableTable(headers, "#resultsListTable");

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
			// const tsString = new Date(ts).toLocaleDateString() + " @ " + new Date(ts).toLocaleTimeString();

			const stdioViewerURL = "/stdio.html?delivId=" + result.delivId + "&repoId=" + result.repoId + "&sha=" + result.commitSHA;

			// what to link to is a course decision; see adminLink()
			const commitURL = this.adminLink(result.commitURL);
			const repoURL = this.adminLink(result.repoURL);

			// scoreOverall is null whenever the container reported no overall score -- every
			// PrairieLearn row, and any container that leaves it unset. This used to assign the null
			// and then concatenate it, so the cell rendered the literal text "null". The dashboard
			// has always shown "N/A" for the same case (AdminDashboardTab::alignValue); match it.
			const score = AdminResultsTab.percentCell(result.scoreOverall);

			// ion-ios-help-outline
			const row: TableCell[] = [
				{ value: ts, html: "<a class='selectable' href='" + commitURL + "'>" + tsString + "</a>" },
				{
					value: "",
					html:
						"<a style='cursor: pointer; cursor: hand;' target='_blank' href='" +
						stdioViewerURL +
						"'><ons-icon icon='md-info-outline'</ons-icon></a>",
				},
				{
					value: result.repoId,
					html: "<a class='selectable' href='" + repoURL + "'>" + result.repoId + "</a>",
				},
				// {value: result.repoId, html: result.repoId},
				{ value: result.delivId, html: result.delivId },
				{ value: result.scoreOverall, html: score },
				{ value: result.scoreTests, html: AdminResultsTab.percentCell(result.scoreTests) },
				{ value: result.scoreCover, html: AdminResultsTab.percentCell(result.scoreCover) },
				{ value: result.state, html: result.state },
			];

			st.addRow(this.decorateRow(row, result));
		}

		st.generate();

		if (st.numRows() > 0) {
			UI.showSection("resultsListTable");
			UI.hideSection("resultsListTableNone");
		} else {
			UI.showSection("resultsListTable");
			UI.hideSection("resultsListTableNone");
		}
	}

	private render(delivs: DeliverableTransport[], repos: RepositoryTransport[], results: AutoTestResultSummaryTransport[]): void {
		Log.trace("AdminResultsTab::render(..) - start");

		const that = this;

		// Every deliverable, not just the AutoTest ones.
		//
		// This used to filter on shouldAutoTest, on the reasoning that a deliverable without it
		// "will never have results to render". That stopped being true when results started arriving
		// from somewhere other than a container: the PrairieLearn connector writes a Result per
		// submission for deliverables that have shouldAutoTest false, and filtering them out made
		// them impossible to select here. A deliverable with no results simply renders an empty
		// table, which is a fine answer to a question someone asked.
		let delivNames: string[] = [];
		for (const deliv of delivs) {
			delivNames.push(deliv.id);
		}
		delivNames = delivNames.sort();
		delivNames.unshift("-Any-");
		UI.setDropdownOptions("resultsDelivSelect", delivNames, this.delivValue);

		let repoNames: string[] = this.buildRepoOptions(repos);
		repoNames = repoNames.sort();
		repoNames.unshift("-Any-");
		UI.setDropdownOptions("resultsRepoSelect", repoNames, this.repoValue);

		this.renderResults(results);

		try {
			new TomSelect("#resultsRepoSelect", {
				maxOptions: null,
				maxItems: 1,
				closeAfterSelect: true,
				onDropdownOpen: function () {
					Log.trace("AdminResultsTab::render(..)::repoSelect - Clearing input: " + this);
					this.setValue("");
				},
				onDropdownClose: function () {
					// heavyweight way to initiate a search, but it works
					Log.trace("AdminResultsTab::render(..)::repoSelect - Performing search: " + this);
					Log.trace("AdminResultsTab::render(..)::repoSelect - Search value: " + this.getValue());
					if (this.getValue() === "") {
						// if nothing selected, go back to any
						this.setValue("-Any-");
					}
					void that.init({}).then().catch(); // promises ignored
					this.blur();
				},
			});
		} catch (err) {
			Log.trace("AdminResultsTab::render(..) - updating select; MSG: " + err.message);
		}
	}

	public static async getResults(
		remote: string,
		delivId: string,
		repoId: string,
		view: PersonView = "all",
		person: string | null = null
	): Promise<AutoTestResultSummaryTransport[]> {
		Log.info("AdminResultsTab::getResults( .. ) - start");

		const start = Date.now();
		let url = remote + "/portal/admin/results/" + delivId + "/" + repoId + "/" + view;
		if (person !== null && person.length > 0) {
			url += "?person=" + encodeURIComponent(person);
		}
		const options = AdminView.getOptions();
		const response = await fetch(url, options);

		if (response.status === 200) {
			Log.trace("AdminResultsTab::getResults(..) - 200 received");
			const json: AutoTestResultSummaryPayload = await response.json();
			if (typeof json.success !== "undefined" && Array.isArray(json.success)) {
				Log.trace("AdminResultsTab::getResults(..)  - worked; # rows: " + json.success.length + "; took: " + UI.took(start));
				return json.success;
			} else {
				Log.trace("AdminResultsTab::getResults(..)  - ERROR: " + json.failure.message);
				AdminView.showError(json.failure); // FailurePayload
			}
		} else {
			Log.trace("AdminResultsTab::getResults(..)  - !200 received: " + response.status);
			const text = await response.text();
			AdminView.showError(text);
		}

		return [];
	}

	public static async getRepositories(remote: string): Promise<RepositoryTransport[]> {
		Log.info("AdminResultsTab::getRepositories( .. ) - start");

		try {
			const start = Date.now();
			const url = remote + "/portal/admin/repositories";
			const options = AdminView.getOptions();
			const response = await fetch(url, options);

			if (response.status === 200) {
				Log.trace("AdminResultsTab::getRepositories(..) - 200 received");
				const json: RepositoryPayload = await response.json();
				if (typeof json.success !== "undefined" && Array.isArray(json.success)) {
					Log.trace("AdminResultsTab::getRepositories(..)  - worked; # repos: " + json.success.length + "; took: " + UI.took(start));
					return json.success;
				} else {
					Log.trace("AdminResultsTab::getRepositories(..)  - ERROR: " + json.failure.message);
					AdminView.showError(json.failure); // FailurePayload
				}
			} else {
				Log.trace("AdminResultsTab::getRepositories(..)  - !200 received: " + response.status);
				const text = await response.text();
				AdminView.showError(text);
			}
		} catch (err) {
			AdminView.showError("Getting results failed: " + err.message);
		}
		return [];
	}
}
