import Log from "../../../../../common/Log";

import {UI} from "../util/UI"

import {AutoTestResultPayload, AutoTestResultTransport} from "../../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";
import {AdminView} from "./AdminView";


export class AdminResultsTab {

    private remote: string; // url to backend
    constructor(remote: string) {
        this.remote = remote;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminResultsTab::init(..) - start');

        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('resultsListTable').innerHTML = ''; // clear target


        UI.showModal('Retrieving results.');
        const results = await AdminResultsTab.getResults(this.remote);
        UI.hideModal();

        this.render(results);
    }


    private render(results: AutoTestResultTransport[]): void {
        Log.trace("AdminResultsTab::render(..) - start");

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

            let ts = new Date(result.timestamp).toLocaleTimeString();
            let row: TableCell[] = [
                {value: result.repoId, html: '<a href="' + result.input.pushInfo.projectURL + '">' + result.repoId + '</a>'},
                {value: result.delivId, html: result.delivId},
                {value: result.timestamp, html: '<a href="' + result.commitURL + '">' + ts + '</a>'},
                {value: result.output.state, html: result.output.state},
                {value: result.output.report.scoreOverall, html: result.output.report.scoreOverall + ''}
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

    public static async getResults(remote: string): Promise<AutoTestResultTransport[]> {
        Log.info("AdminResultsTab::getResults( .. ) - start");

        const start = Date.now();
        const url = remote + '/portal/admin/results';
        const options = AdminView.getOptions();
        const response = await fetch(url, options);

        if (response.status === 200) {
            Log.trace('AdminResultsTab::getResults(..) - 200 received');
            const json: AutoTestResultPayload = await response.json();
            // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminResultsTab::getResults(..)  - worked; took: ' + UI.took(start));
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
}
