import {OnsButtonElement} from "onsenui";
import Log from "../../../../../common/Log";
import {
    AutoTestResultSummaryPayload,
    AutoTestResultSummaryTransport,
    DeliverableTransport,
    RepositoryPayload,
    RepositoryTransport
} from "../../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";

import {UI} from "../util/UI";
import {AdminDeliverablesTab} from "./AdminDeliverablesTab";
import {AdminView} from "./AdminView";

export class AdminResultsTab {

    private readonly remote: string; // url to backend
    private delivValue: string | null = null;
    private repoValue: string | null = null;

    constructor(remote: string) {
        this.remote = remote;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminResultsTab::init(..) - start');
        const that = this;
        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('resultsListTable').innerHTML = ''; // clear target

        UI.showModal('Retrieving results.');
        const delivs = await AdminDeliverablesTab.getDeliverables(this.remote); // for select
        const repos = await AdminResultsTab.getRepositories(this.remote); // for select
        const results = await this.performQueries(); // AdminResultsTab.getResults(this.remote);
        UI.hideModal();

        const fab = document.querySelector('#resultsUpdateButton') as OnsButtonElement;
        fab.onclick = function(evt: any) {
            Log.info('AdminResultsTab::init(..)::updateButton::onClick');
            that.performQueries().then(function(newResults) {
                // TODO: need to track and update the current value of deliv and repo
                that.render(delivs, repos, newResults);
            }).catch(function(err) {
                UI.showError(err);
            });
        };

        this.render(delivs, repos, results);
    }

    private async performQueries(): Promise<AutoTestResultSummaryTransport[]> {
        Log.info('AdminResultsTab::performQueries(..) - start');
        let deliv = UI.getDropdownValue('resultsDelivSelect');
        if (deliv === '-Any-') {
            deliv = 'any';
        }
        let repo = UI.getDropdownValue('resultsRepoSelect');
        if (repo === '-Any-') {
            repo = 'any';
        }
        this.delivValue = deliv;
        this.repoValue = repo;
        return await AdminResultsTab.getResults(this.remote, deliv, repo);
    }

    private render(delivs: DeliverableTransport[], repos: RepositoryTransport[], results: AutoTestResultSummaryTransport[]): void {
        Log.trace("AdminResultsTab::render(..) - start");

        let delivNames: string[] = [];
        for (const deliv of delivs) {
            delivNames.push(deliv.id);
        }
        delivNames = delivNames.sort();
        delivNames.unshift('-Any-');
        UI.setDropdownOptions('resultsDelivSelect', delivNames, this.delivValue);

        let repoNames: string[] = [];
        for (const repo of repos) {
            repoNames.push(repo.id);
        }
        repoNames = repoNames.sort();
        repoNames.unshift('-Any-');
        UI.setDropdownOptions('resultsRepoSelect', repoNames, this.repoValue);

        const headers: TableHeader[] = [
            {
                id:          'repoId',
                text:        'Repository',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'delivId',
                text:        'Deliverable',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'timstamp',
                text:        'Timestamp',
                sortable:    true,
                defaultSort: true,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'state',
                text:        'State',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'score',
                text:        'Score',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            }
        ];

        const st = new SortableTable(headers, '#resultsListTable');

        // this loop couldn't possibly be less efficient
        for (const result of results) {

            // repoId
            // repoURL
            // delivId
            // state
            // timestamp
            // commitSHA
            // commitURL
            // scoreOverall
            // scoreCover
            // scoreTests

            // const ts = result.input.pushInfo.timestamp;
            const ts = result.timestamp;
            const tsString = new Date(ts).toLocaleDateString() + ' @ ' + new Date(ts).toLocaleTimeString();
            const row: TableCell[] = [
                {value: result.repoId, html: '<a href="' + result.repoURL + '">' + result.repoId + '</a>'},
                // {value: result.repoId, html: result.repoId},
                {value: result.delivId, html: result.delivId},
                {value: ts, html: '<a href="' + result.commitURL + '">' + tsString + '</a>'},
                {value: result.state, html: result.state},
                {value: result.scoreOverall, html: result.scoreOverall + ''}
            ];

            st.addRow(row);
        }

        st.generate();

        if (st.numRows() > 0) {
            UI.showSection('resultsListTable');
            UI.hideSection('resultsListTableNone');
        } else {
            UI.showSection('resultsListTable');
            UI.hideSection('resultsListTableNone');
        }
    }

    public static async getResults(remote: string, delivId: string, repoId: string): Promise<AutoTestResultSummaryTransport[]> {
        Log.info("AdminResultsTab::getResults( .. ) - start");

        const start = Date.now();
        const url = remote + '/portal/admin/results/' + delivId + '/' + repoId;
        const options = AdminView.getOptions();
        const response = await fetch(url, options);

        if (response.status === 200) {
            Log.trace('AdminResultsTab::getResults(..) - 200 received');
            const json: AutoTestResultSummaryPayload = await response.json();
            // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminResultsTab::getResults(..)  - worked; # rows: ' + json.success.length + '; took: ' + UI.took(start));
                return json.success;
            } else {
                Log.trace('AdminResultsTab::getResults(..)  - ERROR: ' + json.failure.message);
                AdminView.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminResultsTab::getResults(..)  - !200 received: ' + response.status);
            const text = await response.text();
            AdminView.showError(text);
        }

        return [];
    }

    public static async getRepositories(remote: string): Promise<RepositoryTransport[]> {
        Log.info("AdminResultsTab::getRepositories( .. ) - start");

        const start = Date.now();
        const url = remote + '/portal/admin/repositories';
        const options = AdminView.getOptions();
        const response = await fetch(url, options);

        if (response.status === 200) {
            Log.trace('AdminResultsTab::getRepositories(..) - 200 received');
            const json: RepositoryPayload = await response.json();
            // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminResultsTab::getRepositories(..)  - worked; took: ' + UI.took(start));
                return json.success;
            } else {
                Log.trace('AdminResultsTab::getRepositories(..)  - ERROR: ' + json.failure.message);
                AdminView.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminResultsTab::getRepositories(..)  - !200 received: ' + response.status);
            const text = await response.text();
            AdminView.showError(text);
        }

        return [];
    }
}
