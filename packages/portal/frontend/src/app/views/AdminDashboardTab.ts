import Log from "@common/Log";
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

import { SortableTable, TableCell, TableHeader } from "../util/SortableTable";
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

/**
 * A SortableTable that refits the histograms whenever it rebuilds. A column sort regenerates every
 * row's markup, which puts each histogram back at its widest pitch.
 */
class DashboardTable extends SortableTable {
	private readonly afterGenerate: () => void;

	public constructor(headers: TableHeader[], divName: string, afterGenerate: () => void) {
		super(headers, divName);
		this.afterGenerate = afterGenerate;
	}

	public generate(): void {
		super.generate();
		this.afterGenerate();
	}
}

export class AdminDashboardTab extends AdminPage {
	// private readonly remote: string; // url to backend
	private delivValue: string | null = null;
	private repoValue: string | null = null;

	/** The tests behind each rendered histogram, indexed by its data-hist attribute; read by the tooltip. */
	private histograms: DetailRow[][] = [];
	private histogramTip: HTMLElement | null = null;
	private resizeWired = false;

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
	 * Re-queries as soon as the deliverable filter changes, matching the view selector above.
	 *
	 * Unlike that one this does not re-init: the deliverable and repository lists do not depend on
	 * which deliverable is selected, so re-fetching them would only add latency. The <select>
	 * survives UI.setDropdownOptions (it swaps the options, not the element), so this handler does
	 * not need re-wiring after every render.
	 */
	private wireDelivSelector(delivs: DeliverableTransport[], repos: RepositoryTransport[]): void {
		const select = document.querySelector("#dashboardDelivSelect") as HTMLSelectElement;
		if (select === null) {
			return;
		}
		select.onchange = () => {
			this.refreshResults(delivs, repos);
		};
	}

	/**
	 * Runs the current filters and re-renders; shared by the Update button and the deliverable
	 * filter so the two cannot drift.
	 *
	 * NOTE: the modal is hidden on the error path too. UI.showError does not do it, so a failed
	 * query used to leave "Retrieving results." covering the page with no way to dismiss it.
	 */
	private refreshResults(delivs: DeliverableTransport[], repos: RepositoryTransport[]): void {
		UI.showModal("Retrieving results.");
		this.performQueries()
			.then((newResults) => {
				this.render(delivs, repos, newResults);
				UI.hideModal();
			})
			.catch((err) => {
				UI.hideModal();
				UI.showError(err);
			});
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
		this.wireDelivSelector(delivs, repos);

		const fab = document.querySelector("#dashboardUpdateButton") as OnsButtonElement;
		fab.onclick = function (_evt: any) {
			Log.info("AdminDashboardTab::init(..)::updateButton::onClick");
			that.refreshResults(delivs, repos);
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
	/**
	 * The href an admin table shows for a record URL; the default is the URL as stored.
	 *
	 * A seam for course plugins, like buildRepoOptions() and decorateRow(). A course whose stored
	 * URLs are right for students but not for instructors -- an external grader that has separate
	 * student and instructor views of the same submission, say -- overrides this to rewrite the link
	 * at render time. Core stays neutral so every other course sees exactly what it always did, and
	 * the stored record is never changed; only the href in this table is.
	 */
	protected adminLink(url: string): string {
		return url;
	}

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
		this.histograms = [];
		const st = new DashboardTable(headers, "#dashboardListTable", () => this.fitHistograms());

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

			// what to link to is a course decision; see adminLink()
			const commitURL = this.adminLink(result.commitURL);
			const repoURL = this.adminLink(result.repoURL);

			// ion-ios-help-outline
			const row: TableCell[] = [
				{ value: ts, html: "<a class='selectable' href='" + commitURL + "'>" + tsString + "</a>" },
				{
					value: "",
					html: "<a style='cursor: pointer;' target='_blank' href='" + stdioViewerURL + "'><ons-icon icon='md-info-outline'</ons-icon></a>",
				},
				{
					value: result.repoId,
					html: "<a class='selectable' href='" + repoURL + "'>" + result.repoId + "</a>",
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
		this.wireHistogramHover();
		this.wireResize();

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

	/**
	 * Geometry of one test's bar, in CSS px, reproducing the per-test table cells this replaced as
	 * they measured under the app's stylesheets.
	 *
	 * A bar was a 5px cell plus 1px of padding each side, so 7px wide at most; 2px of border-spacing
	 * separated cells, and that gap never changed. When the page was too narrow, the table shrank
	 * only the cells, down to their padding, 2px, and overflowed past that. fitHistograms() does the
	 * same, so these bound the pitch (bar plus gap) it chooses: 9px at most, 4px at least.
	 */
	private static readonly BAR_WIDTH = 7;
	private static readonly MIN_BAR_WIDTH = 2;
	private static readonly BAR_GAP = 2;
	private static readonly BAR_HEIGHT = 22;
	private static readonly BAR_PITCH = AdminDashboardTab.BAR_WIDTH + AdminDashboardTab.BAR_GAP;
	private static readonly MIN_BAR_PITCH = AdminDashboardTab.MIN_BAR_WIDTH + AdminDashboardTab.BAR_GAP;

	/**
	 * Width of the count that precedes the bars; a floor wide enough for four digits keeps every
	 * row's bars starting at the same offset. Rendered as an inline-block, where width is honoured
	 * (a table cell's width was only a hint, which is how `_100_` used to push its bars right).
	 */
	private static readonly LABEL_WIDTH = "3.5em";

	private generateHistogram(row: AutoTestDashboardTransport): string {
		const tests = AdminDashboardTab.annotateTests(row);
		const id = this.histograms.push(tests) - 1;
		return AdminDashboardTab.histogramHTML(tests, id);
	}

	/**
	 * One entry per test name in the row, sorted by name, with its state and colour.
	 *
	 * A name listed under more than one state keeps one entry per listing, each taking the first
	 * state that lists it in the order fail, pass, skip, error; that is what the per-name indexOf
	 * chain this replaced produced. That chain searched every list for every name, quadratic per
	 * row and paid on every render; Sets make each lookup constant.
	 *
	 * Names stay raw. They are student-authored, and they never enter an HTML string any more:
	 * the only place they are shown is the tooltip, which sets textContent.
	 */
	private static annotateTests(row: AutoTestDashboardTransport): DetailRow[] {
		const passNames = (row.testPass ?? []) as string[];
		const failNames = (row.testFail ?? []) as string[];
		const skipNames = (row.testSkip ?? []) as string[];
		const errorNames = (row.testError ?? []) as string[];

		const fail = new Set(failNames);
		const pass = new Set(passNames);
		const skip = new Set(skipNames);
		const error = new Set(errorNames);

		const all = ([] as string[]).concat(passNames, failNames, skipNames, errorNames).sort();
		const annotated: DetailRow[] = [];
		for (const name of all) {
			if (fail.has(name)) {
				annotated.push({ name: name, state: "fail", colour: "red" });
			} else if (pass.has(name)) {
				annotated.push({ name: name, state: "pass", colour: "green" });
			} else if (skip.has(name)) {
				annotated.push({ name: name, state: "skip", colour: "grey" });
			} else if (error.has(name)) {
				annotated.push({ name: name, state: "error", colour: "orange" });
			} else {
				annotated.push({ name: name, state: "unknown", colour: "black" });
			}
		}
		return annotated;
	}

	/**
	 * A row's histogram as two inline elements, whatever its number of tests.
	 *
	 * This used to be a nested table with a cell per test, so a dashboard of a few hundred rows
	 * and a hundred-odd tests built tens of thousands of cells, each laid out by the table
	 * algorithm, and did it again on every column sort. Now the bars are one element: a gradient
	 * with a stop for each run of same-coloured tests, and a repeating mask that cuts the gap
	 * between tests so each still reads as its own bar. The gaps are transparent, so the row's
	 * background shows through them exactly as it did between the cells.
	 *
	 * Everything scales with one custom property, --p, the pitch of a test: the width is N pitches
	 * and the mask repeats every pitch, and the colour stops are percentages of the width, so they
	 * follow along. It starts at the widest pitch; fitHistograms() narrows it to fit the page.
	 */
	private static histogramHTML(tests: DetailRow[], id: number): string {
		const G = AdminDashboardTab.BAR_GAP;
		const n = tests.length;
		// a test's boundary as a percentage of the width; four places is well under a pixel even at
		// thousands of tests
		const at = (k: number): string => Number(((k * 100) / n).toFixed(4)) + "%";

		// The padding stands in for the border-spacing the nested table put above and below its row,
		// so dashboard rows keep their height. nowrap keeps the count and the bars on one line: a
		// table row could not break between its cells, so when the page was too narrow the table
		// overflowed, where two inline-blocks would otherwise wrap and double the row's height.
		// Underscores around the count for easier searching.
		let html = "<div class='histogramcontainer' style='padding: " + AdminDashboardTab.BAR_GAP + "px 0; white-space: nowrap;'>";
		html +=
			"<span class='selectable' style='display: inline-block; box-sizing: content-box; width: " +
			AdminDashboardTab.LABEL_WIDTH +
			"; padding: 0 1px; text-align: center; vertical-align: middle;'>_" +
			tests.length +
			"_</span>";

		if (tests.length > 0) {
			// one stop per run of a colour; the colours are the fixed set above, never row data
			const stops: string[] = [];
			let runStart = 0;
			for (let i = 1; i <= n; i++) {
				if (i === n || tests[i].colour !== tests[runStart].colour) {
					stops.push(tests[runStart].colour + " " + at(runStart) + " " + at(i));
					runStart = i;
				}
			}
			// the gap stays G whatever the pitch; only the bar narrows, as the table cells did
			const mask =
				"repeating-linear-gradient(to right, #000 0 calc(var(--p) - " + G + "px), transparent calc(var(--p) - " + G + "px) var(--p))";
			html +=
				"<span class='dashHistogram' data-hist='" +
				id +
				"' style='--p: " +
				AdminDashboardTab.BAR_PITCH +
				"px; display: inline-block; vertical-align: middle; margin-left: " +
				G +
				// N whole pitches: the last test's gap is inside the box, and masked like every other
				"px; width: calc(var(--p) * " +
				n +
				"); height: " +
				AdminDashboardTab.BAR_HEIGHT +
				"px; background-image: linear-gradient(to right, " +
				stops.join(", ") +
				"); -webkit-mask-image: " +
				mask +
				"; mask-image: " +
				mask +
				";'></span>";
		}
		return html + "</div>";
	}

	/**
	 * One tooltip for every histogram, fed by a single listener on the table's container.
	 *
	 * The per-test title attribute went with the per-test cells, so this finds the test under the
	 * pointer from its x offset instead. It measures against the bar element rather than the event
	 * target, so the pointer can cross a masked gap without the tooltip flickering off.
	 *
	 * NOTE: assigned with onmousemove, not addEventListener. render() runs on every refresh and
	 * must not stack another listener each time; the container element itself persists.
	 */
	private wireHistogramHover(): void {
		const container = document.querySelector("#dashboardListTable") as HTMLElement | null;
		if (container === null) {
			return;
		}
		container.onmousemove = (evt: MouseEvent) => {
			const test = this.testUnderPointer(evt);
			if (test === null) {
				this.hideHistogramTip();
			} else {
				this.showHistogramTip(test, evt);
			}
		};
		container.onmouseleave = () => {
			this.hideHistogramTip();
		};
	}

	/**
	 * Narrows each histogram's pitch to fit the room the Results column has, as the table cells it
	 * replaced did on their own.
	 *
	 * The column gets whatever the page has left after the other columns. A row whose tests fit at
	 * the widest pitch keeps it; a row with more tests than that shrinks to fill the column, down to
	 * MIN_BAR_PITCH, and past that the table overflows, as it always did. The pitch is fractional,
	 * like the cells' widths were, so a shrunk row fills the column rather than stopping short.
	 *
	 * Runs after every generate(), since a column sort rebuilds every row at the widest pitch, and
	 * on resize. Skipped while the dashboard is not on screen; the next render fits it.
	 */
	private fitHistograms(): void {
		const container = document.querySelector("#dashboardListTable") as HTMLElement | null;
		if (container === null || container.clientWidth === 0) {
			return;
		}
		const table = container.querySelector("table") as HTMLElement | null;
		const bars = Array.from(container.querySelectorAll(".dashHistogram")) as HTMLElement[];
		if (table === null || bars.length === 0) {
			return;
		}
		const testsIn = (bar: HTMLElement): number => this.histograms[Number(bar.dataset.hist)]?.length ?? 0;
		// A row that cannot fit even at the narrowest pitch makes the column that wide regardless,
		// and the table overflows. The cells let every other row use that width, so fitting does too.
		const widestMinimum = Math.max(...bars.map((bar) => testsIn(bar) * AdminDashboardTab.MIN_BAR_PITCH));

		// Twice: narrowing the Results column can let another column relax (a header that had
		// wrapped, say), so the second pass measures the table as the first one left it.
		for (let pass = 0; pass < 2; pass++) {
			const cell = bars[0].closest("td") as HTMLElement;
			const cellRect = cell.getBoundingClientRect();
			// every row lays out the same way up to the bars: cell padding, the count, its margin
			const beforeBars = bars[0].getBoundingClientRect().left - cellRect.left;
			const afterBars = Number.parseFloat(getComputedStyle(cell).paddingRight) || 0;
			const column = container.clientWidth - (table.getBoundingClientRect().width - cellRect.width);
			const room = Math.max(column - beforeBars - afterBars, widestMinimum);
			for (const bar of bars) {
				const n = testsIn(bar);
				if (n > 0) {
					const pitch = Math.min(AdminDashboardTab.BAR_PITCH, Math.max(AdminDashboardTab.MIN_BAR_PITCH, room / n));
					bar.style.setProperty("--p", pitch + "px");
				}
			}
		}
	}

	/**
	 * Refits on resize, at most once a frame. Wired once per tab, not per render: this is the one
	 * listener on window, and render() runs on every refresh.
	 */
	private wireResize(): void {
		if (this.resizeWired === true) {
			return;
		}
		this.resizeWired = true;
		let queued = false;
		window.addEventListener("resize", () => {
			if (queued === true) {
				return;
			}
			queued = true;
			window.requestAnimationFrame(() => {
				queued = false;
				this.fitHistograms();
			});
		});
	}

	private testUnderPointer(evt: MouseEvent): DetailRow | null {
		const host = (evt.target as Element | null)?.closest(".histogramcontainer");
		const bar = host?.querySelector(".dashHistogram") as HTMLElement | null | undefined;
		if (bar === null || typeof bar === "undefined") {
			return null;
		}
		const tests = this.histograms[Number(bar.dataset.hist)];
		const rect = bar.getBoundingClientRect();
		const x = evt.clientX - rect.left;
		if (typeof tests === "undefined" || x < 0 || x >= rect.width || evt.clientY < rect.top || evt.clientY >= rect.bottom) {
			return null;
		}
		// the row's own pitch, which fitHistograms() may have narrowed
		const pitch = Number.parseFloat(bar.style.getPropertyValue("--p")) || AdminDashboardTab.BAR_PITCH;
		return tests[Math.floor(x / pitch)] ?? null;
	}

	private showHistogramTip(test: DetailRow, evt: MouseEvent): void {
		if (this.histogramTip === null) {
			const tip = document.createElement("div");
			tip.style.cssText =
				"position: fixed; z-index: 10000; pointer-events: none; padding: 2px 6px; border-radius: 3px; " +
				"background: rgba(0, 0, 0, 0.8); color: white; font-size: 12px; white-space: nowrap; display: none;";
			document.body.appendChild(tip);
			this.histogramTip = tip;
		}
		const tip = this.histogramTip;
		// textContent, never innerHTML: test names are student-authored
		tip.textContent = test.name + " (" + test.state + ")";
		tip.style.display = "block";
		// flip to the left of the pointer near the right edge; histograms can run wider than the window
		const offset = 12;
		const left = evt.clientX + offset + tip.offsetWidth > window.innerWidth ? evt.clientX - offset - tip.offsetWidth : evt.clientX + offset;
		tip.style.left = Math.max(0, left) + "px";
		tip.style.top = evt.clientY + offset + "px";
	}

	private hideHistogramTip(): void {
		if (this.histogramTip !== null) {
			this.histogramTip.style.display = "none";
		}
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
