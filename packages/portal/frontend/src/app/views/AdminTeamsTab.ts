import Log from "../../../../../common/Log";

import {StudentTransport, TeamTransport, TeamTransportPayload} from "../../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";

import {UI} from "../util/UI";
import {AdminStudentsTab} from "./AdminStudentsTab";
import {AdminView} from "./AdminView";

export class AdminTeamsTab {

    private readonly remote: string; // url to backend
    private teams: TeamTransport[];
    private students: StudentTransport[];

    constructor(remote: string) {
        this.remote = remote;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminTeamsTab::init(..) - start');
        const start = Date.now();

        document.getElementById('teamsListTable').innerHTML = ''; // clear target
        document.getElementById('teamsIndividualListTable').innerHTML = ''; // clear target

        this.students = null;
        this.teams = null;

        if (typeof opts.delivId === 'undefined') {
            opts.delivId = '-None-';
        }

        UI.showModal('Retrieving teams.');
        this.teams = await AdminTeamsTab.getTeams(this.remote);
        this.renderTeams(this.teams, opts.delivId);

        this.students = await AdminStudentsTab.getStudents(this.remote);
        this.renderIndividuals(this.teams, this.students, opts.delivId);
        UI.hideModal();
    }

    private render(teams: TeamTransport[], delivId: string): void {
        this.renderTeams(teams, delivId);
    }

    private renderTeams(teams: TeamTransport[], delivId: string): void {
        Log.trace("AdminTeamsTab::renderTeams(..) - start");
        const headers: TableHeader[] = [
            {
                id:          'id',
                text:        'Team Id',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'p1',
                text:        'First Member',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'p2',
                text:        'Second Member',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'p3',
                text:        'Third Member',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            }
        ];

        let delivOptions = ['-None-'];
        const st = new SortableTable(headers, '#teamsListTable');
        let listContainsStudents = false;

        for (const team of teams) {
            let p1 = '';
            let p2 = '';
            let p3 = '';
            if (team.people.length === 0) {
                // do nothing
            } else if (team.people.length === 1) {
                p1 = team.people[0];
            } else if (team.people.length === 2) {
                p1 = team.people[0];
                p2 = team.people[1];
            } else if (team.people.length === 3) {
                p1 = team.people[0];
                p2 = team.people[1];
                p3 = team.people[2];
            }
            const row: TableCell[] = [
                {value: team.id, html: '<a href="' + team.URL + '">' + team.id + '</a>'},
                {value: p1, html: p1},
                {value: p2, html: p2},
                {value: p3, html: p3}
            ];
            if (delivOptions.indexOf(team.delivId) < 0 && team.delivId !== '' && team.delivId !== null) {
                delivOptions.push(team.delivId);
            }
            if (delivId === team.delivId && team.people.length > 1) {
                st.addRow(row);
                listContainsStudents = true;
            }
        }

        st.generate();

        delivOptions = delivOptions.sort();
        UI.setDropdownOptions('teamsListSelect', delivOptions, delivId);

        const delivSelector = document.querySelector('#teamsListSelect') as HTMLSelectElement;
        // delivSelector.innerHTML = '';
        // for (const deliv of delivOptions) {
        //     let selected = false;
        //     if (deliv === delivId) {
        //         selected = true;
        //     }
        //     const o: HTMLOptionElement = new Option(deliv, deliv, false, selected);
        //     delivSelector.add(o);
        // }

        const that = this;
        delivSelector.onchange = function(evt) {
            Log.info('AdminTeamsTab::renderTeams(..) - upload pressed');
            evt.stopPropagation(); // prevents list item expansion

            const val = delivSelector.value.valueOf();

            // that.renderPage('AdminTeams', {labSection: val}); // if we need to re-fetch
            that.renderTeams(that.teams, val); // if cached data is ok
            that.renderIndividuals(that.teams, that.students, val); // if cached data is ok
        };

        if (st.numRows() > 0) {
            UI.showSection('teamsListTable');
            UI.hideSection('teamsListTableNone');
        } else {
            UI.hideSection('teamsListTable');
            UI.showSection('teamsListTableNone');
        }

    }

    private renderIndividuals(teams: TeamTransport[], students: StudentTransport[], delivId: string): void {
        Log.trace("AdminTeamsTab::renderTeams(..) - start");

        const headers: TableHeader[] = [
            {
                id:          'id',
                text:        'Student',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em;'
            }
        ];

        const st = new SortableTable(headers, '#teamsIndividualListTable');

        const studentsOnTeams: string[] = [];
        for (const team of teams) {

            if (team.delivId === delivId) {
                for (const p of team.people) {
                    studentsOnTeams.push(p);
                }
            }
        }

        let listContainsStudents = false;
        for (const student of students) {
            if (studentsOnTeams.indexOf(student.id) < 0) {
                const row: TableCell[] = [
                    {value: student.id, html: '<a href="' + student.userUrl + '">' + student.id + '</a>'}
                ];
                if (delivId !== '-None-') {
                    st.addRow(row);
                    listContainsStudents = true;
                }
            }
        }

        st.generate();

        if (st.numRows() > 0) {
            UI.showSection('teamsIndividualListTable');
            UI.hideSection('teamsIndividualListTableNone');
        } else {
            UI.hideSection('teamsIndividualListTable');
            UI.showSection('teamsIndividualListTableNone');
        }

    }

    public static async getTeams(remote: string): Promise<TeamTransport[]> {
        Log.info("AdminTeamsTab::getTeams( .. ) - start");
        try {
            const start = Date.now();
            const options = AdminView.getOptions();
            const url = remote + '/portal/admin/teams';
            const response = await fetch(url, options);

            if (response.status === 200) {
                Log.trace('AdminTeamsTab::getTeams(..) - 200 received');
                const json: TeamTransportPayload = await response.json();
                if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                    Log.trace('AdminTeamsTab::getTeams(..)  - worked; took: ' + UI.took(start));
                    return json.success;
                } else {
                    Log.trace('AdminTeamsTab::getTeams(..)  - ERROR: ' + json.failure.message);
                    AdminView.showError(json.failure); // FailurePayload
                }
            } else {
                Log.trace('AdminTeamsTab::getTeams(..)  - !200 received: ' + response.status);
                const text = await response.text();
                AdminView.showError(text);
            }
        } catch (err) {
            AdminView.showError("Getting teams failed: " + err.message);
        }
        return [];
    }
}
