import * as moment from "moment";
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
import {AdminPage} from "./AdminPage";
import {AdminView} from "./AdminView";

export class AdminResultsTab extends AdminPage {

    // private readonly remote: string; // url to backend
    private delivValue: string | null = null;
    private repoValue: string | null = null;

    constructor(remote: string) {
        // this.remote = remote;
        super(remote);
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminResultsTab::init(..) - start');
        const that = this;

        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('resultsListTable').innerHTML = ''; // clear target

        UI.showModal('Retrieving results.');
        const course = await AdminView.getCourse(this.remote);
        if (this.delivValue === null) {
            this.delivValue = course.defaultDeliverableId;
            // ugly way to set the default the first time the page is rendered
            UI.setDropdownOptions('resultsDelivSelect', [this.delivValue], this.delivValue);
        }
        const delivs = await AdminDeliverablesTab.getDeliverables(this.remote); // for select
        const repos = await AdminResultsTab.getRepositories(this.remote); // for select
        const results = await this.performQueries();
        UI.hideModal();

        const fab = document.querySelector('#resultsUpdateButton') as OnsButtonElement;
        fab.onclick = function(evt: any) {
            Log.info('AdminResultsTab::init(..)::updateButton::onClick');
            UI.showModal('Retrieving results.');
            that.performQueries().then(function(newResults) {
                // TODO: need to track and update the current value of deliv and repo
                that.render(delivs, repos, newResults);
                UI.hideModal();
            }).catch(function(err) {
                UI.showError(err);
            });
        };

        this.render(delivs, repos, results);
    }

    private async performQueries(): Promise<AutoTestResultSummaryTransport[]> {
        Log.info('AdminResultsTab::performQueries(..) - start');
        const start = Date.now();
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
        const values = await AdminResultsTab.getResults(this.remote, this.delivValue, this.repoValue);
        Log.info('AdminResultsTab::performQueries(..) - done; # values: ' + values.length + "; took: " + UI.took(start));
        return values;
    }

    private render(delivs: DeliverableTransport[],
                   repos: RepositoryTransport[],
                   results: AutoTestResultSummaryTransport[]): void {
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
                id:          '?',
                text:        '?',
                sortable:    false,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
            },
            {
                id:          'repoId',
                text:        'Repository',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em; text-align: left;'
            },
            {
                id:          'delivId',
                text:        'Deliv',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
            },
            {
                id:          'score',
                text:        'Score',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
            },
            {
                id:          'state',
                text:        'State',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
            },
            {
                id:          'timstamp',
                text:        'Timestamp',
                sortable:    true,
                defaultSort: true,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
            }
        ];

        const st = new SortableTable(headers, '#resultsListTable');

        // this loop couldn't possibly be less efficient
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
            // const tsString = new Date(ts).toLocaleDateString() + ' @ ' + new Date(ts).toLocaleTimeString();

            const stdioViewerURL = '/stdio.html?delivId=' + result.delivId + '&repoId=' + result.repoId + '&sha=' + result.commitSHA;

            const row: TableCell[] = [
                {
                    value: '',
                    html:  '<a style="cursor: pointer; cursor: hand;" target="_blank" href="' +
                               stdioViewerURL + '"><ons-icon icon="ion-ios-help-outline"</ons-icon></a>'
                },
                {value: result.repoId, html: '<a class="selectable" href="' + result.repoURL + '">' + result.repoId + '</a>'},
                // {value: result.repoId, html: result.repoId},
                {value: result.delivId, html: result.delivId},
                {value: result.scoreOverall, html: result.scoreOverall + ''},
                {value: result.state, html: result.state},
                {value: ts, html: '<a class="selectable" href="' + result.commitURL + '">' + tsString + '</a>'}
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

        try {
            const start = Date.now();
            const url = remote + '/portal/admin/repositories';
            const options = AdminView.getOptions();
            const response = await fetch(url, options);

            if (response.status === 200) {
                Log.trace('AdminResultsTab::getRepositories(..) - 200 received');
                const json: RepositoryPayload = await response.json();
                // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
                if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                    Log.trace('AdminResultsTab::getRepositories(..)  - worked; # repos: ' +
                        json.success.length + '; took: ' + UI.took(start));
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
        } catch (err) {
            AdminView.showError("Getting results failed: " + err.message);
        }
        return [];
    }
}
