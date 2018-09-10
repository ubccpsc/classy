import * as moment from "moment";
import {OnsButtonElement} from "onsenui";

import Log from "../../../../../common/Log";
import {
    AutoTestDashboardPayload,
    AutoTestDashboardTransport,
    DeliverableTransport,
    RepositoryTransport
} from "../../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";

import {UI} from "../util/UI";
import {AdminDeliverablesTab} from "./AdminDeliverablesTab";
import {AdminResultsTab} from "./AdminResultsTab";
import {AdminView} from "./AdminView";

export class AdminDashboardTab {

    private readonly remote: string; // url to backend
    private delivValue: string | null = null;
    private repoValue: string | null = null;

    constructor(remote: string) {
        this.remote = remote;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminDashboardTab::init(..) - start');
        const that = this;
        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('dashboardListTable').innerHTML = ''; // clear target

        UI.showModal('Retrieving results.');
        const delivs = await AdminDeliverablesTab.getDeliverables(this.remote); // for select
        const repos = await AdminResultsTab.getRepositories(this.remote); // for select
        const results = await this.performQueries();
        UI.hideModal();

        const fab = document.querySelector('#dashboardUpdateButton') as OnsButtonElement;
        fab.onclick = function(evt: any) {
            Log.info('AdminDashboardTab::init(..)::updateButton::onClick');
            that.performQueries().then(function(newResults) {
                // TODO: need to track and update the current value of deliv and repo
                that.render(delivs, repos, newResults);
            }).catch(function(err) {
                UI.showError(err);
            });
        };

        this.render(delivs, repos, results);
    }

    private async performQueries(): Promise<AutoTestDashboardTransport[]> {
        Log.info('AdminDashboardTab::performQueries(..) - start');
        let deliv = UI.getDropdownValue('dashboardDelivSelect');
        if (deliv === '-Any-') {
            deliv = 'any';
        }
        let repo = UI.getDropdownValue('dashboardRepoSelect');
        if (repo === '-Any-') {
            repo = 'any';
        }
        this.delivValue = deliv;
        this.repoValue = repo;
        return await AdminDashboardTab.getDashboard(this.remote, deliv, repo);
    }

    private render(delivs: DeliverableTransport[], repos: RepositoryTransport[], results: AutoTestDashboardTransport[]): void {
        Log.trace("AdminDashboardTab::render(..) - start");
        const that = this;

        let delivNames: string[] = [];
        for (const deliv of delivs) {
            delivNames.push(deliv.id);
        }
        delivNames = delivNames.sort();
        delivNames.unshift('-Any-');
        UI.setDropdownOptions('dashboardDelivSelect', delivNames, this.delivValue);

        let repoNames: string[] = [];
        for (const repo of repos) {
            repoNames.push(repo.id);
        }
        repoNames = repoNames.sort();
        repoNames.unshift('-Any-');
        UI.setDropdownOptions('dashboardRepoSelect', repoNames, this.repoValue);

        const headers: TableHeader[] = [
            {
                id:          '?',
                text:        '?',
                sortable:    false,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
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
                text:        'Deliv',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'score',
                text:        'Score',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'testScore',
                text:        'Test%',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'coverScore',
                text:        'Cover%',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
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
                id:          'results',
                text:        'Results',
                sortable:    false,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            }
        ];

        const st = new SortableTable(headers, '#dashboardListTable');

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
            const date = new Date(ts);
            const mom = moment(date);
            const tsString = mom.format("MM/DD[@]HH:mm");

            const dashRow = this.generateHistogram(result);

            const stdioURL = '/portal/admin/result/' + result.delivId + '/' + result.repoId + '/' + result.commitSHA;
            const clickTarget = "myApp.view.dashTab.getDetails('" + stdioURL + "');";

            const row: TableCell[] = [
                // {value: '?', html: '<a href="http://refugeeks.com/wp-content/uploads/2014/04/501-Not-Implemented-600x480.jpg">?</a>'},
                {
                    value: '',
                    html:  '<a style="cursor: pointer; cursor: hand;" onclick= that.newWindow = window.open(\'text/plain\');' +
                           clickTarget + '><ons-icon icon="ion-ios-help-outline"</ons-icon></a>'
                },
                {value: result.repoId, html: '<a href="' + result.repoURL + '">' + result.repoId + '</a>'},
                {value: result.delivId, html: result.delivId},
                {value: result.scoreOverall, html: result.scoreOverall + ''},
                {value: result.scoreTests, html: result.scoreTests + ''},
                {value: result.scoreCover, html: result.scoreCover + ''},
                {value: ts, html: '<a href="' + result.commitURL + '">' + tsString + '</a>'},
                {value: '', html: dashRow}
            ];

            st.addRow(row);
        }

        st.generate();

        if (st.numRows() > 0) {
            UI.showSection('dashboardListTable');
            UI.hideSection('dashboardListTableNone');
        } else {
            UI.showSection('dashboardListTable');
            UI.hideSection('dashboardListTableNone');
        }
    }

    private newWindow: Window = null;

    public async getDetails(path: string): Promise<void> {
        const url = this.remote + path;
        Log.info('AdminDashboardTab::getDetails( .. ) - url: ' + url);

        try {
            const options = AdminView.getOptions();
            const response = await fetch(url, options);
            if (response.status === 200) {
                let data = await response.text();
                Log.info('AdminDashboardTab::getDetails( .. ) - text length: ' + data.length);
                // const newWindow = window.open('text/plain');
                data = data.replace(/&/g, "&amp;");
                data = data.replace(/</g, "&lt;");
                data = data.replace(/>/g, "&gt;");
                data = data.replace(/"/g, "&quot;");
                data = data.replace(/'/g, "&#039;");
                data = data.replace(/\n/g, "<br/>");
                this.newWindow.document.write(data);
            } else if (response.status === 400) {
                const data = await response.json();
                UI.showError("Error retrieving stdio: " + data.failure.message);
            } else {
                const data = await response.text();
                UI.showError("Error retrieving stdio: " + data);
            }
        } catch (err) {
            Log.info('AdminDashboardTab::getDetails( .. ) - ERROR: ' + err.message);
            UI.showError("Error retrieving stdio: " + err.message);
        }
    }

    private generateHistogram(row: AutoTestDashboardTransport): string {

        const passNames = row.testPass as string[];
        const failNames = row.testFail  as string[];
        const skipNames = row.testSkip as string[];
        const errorNames = row.testError as string[];

        let all: string[] = [];
        all = all.concat(passNames, failNames, skipNames, errorNames);
        all = all.sort();

        interface DetailRow {
            name: string;
            state: string;
            colour: string;
        }

        const annotated: DetailRow[] = [];
        for (const name of all) {
            let state = 'unknown';
            let colour = 'black';
            if (failNames.indexOf(name) > 0) {
                state = 'fail';
                colour = 'red';
            } else if (passNames.indexOf(name) >= 0) {
                state = 'pass';
                colour = 'green';
            } else if (skipNames.indexOf(name) >= 0) {
                state = 'skip';
                colour = 'grey';
            } else if (errorNames.indexOf(name) >= 0) {
                state = 'error';
                colour = 'orange';
            } else {
                // uhoh
            }
            annotated.push({name: name, state: state, colour: colour});
        }

        let str = '<span><table style="height: 20px;">';
        str += '<tr>';

        for (const a of annotated) {
            str += '<td class="dashResultCell" style="width: 5px; height: 20px; background: ' + a.colour + '" title="' + a.name + '"></td>';
        }

        str += '</tr>';
        str += '</table></span>';
        return str;
    }

    public static async getDashboard(remote: string, delivId: string, repoId: string): Promise<AutoTestDashboardTransport[]> {
        Log.info("AdminDashboardTab::getDashboard( .. ) - start");

        const start = Date.now();
        const url = remote + '/portal/admin/dashboard/' + delivId + '/' + repoId;
        const options = AdminView.getOptions();
        const response = await fetch(url, options);

        if (response.status === 200) {
            Log.trace('AdminDashboardTab::getDashboard(..) - 200 received');
            const json: AutoTestDashboardPayload = await response.json();
            // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminDashboardTab::getDashboard(..)  - worked; # rows: ' + json.success.length + '; took: ' + UI.took(start));
                return json.success;
            } else {
                Log.trace('AdminDashboardTab::getDashboard(..)  - ERROR: ' + json.failure.message);
                AdminView.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminDashboardTab::getDashboard(..)  - !200 received: ' + response.status);
            const text = await response.text();
            AdminView.showError(text);
        }

        return [];
    }

    // public static async getRepositories(remote: string): Promise<RepositoryTransport[]> {
    //     Log.info("AdminDashboardTab::getRepositories( .. ) - start");
    //
    //     try {
    //         const start = Date.now();
    //         const url = remote + '/portal/admin/repositories';
    //         const options = AdminView.getOptions();
    //         const response = await fetch(url, options);
    //
    //         if (response.status === 200) {
    //             Log.trace('AdminDashboardTab::getRepositories(..) - 200 received');
    //             const json: RepositoryPayload = await response.json();
    //             // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
    //             if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
    //                 Log.trace('AdminDashboardTab::getRepositories(..)  - worked; took: ' + UI.took(start));
    //                 return json.success;
    //             } else {
    //                 Log.trace('AdminDashboardTab::getRepositories(..)  - ERROR: ' + json.failure.message);
    //                 AdminView.showError(json.failure); // FailurePayload
    //             }
    //         } else {
    //             Log.trace('AdminDashboardTab::getRepositories(..)  - !200 received: ' + response.status);
    //             const text = await response.text();
    //             AdminView.showError(text);
    //         }
    //     } catch (err) {
    //         AdminView.showError("Getting results failed: " + err.message);
    //     }
    //     return [];
    // }
}
