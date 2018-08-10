import Log from "../../../../../common/Log";

import {DeliverableTransport, GradeTransport, GradeTransportPayload, StudentTransport} from "../../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";

import {UI} from "../util/UI"
import {AdminDeliverablesTab} from "./AdminDeliverablesTab";
import {AdminStudentsTab} from "./AdminStudentsTab";
import {AdminView} from "./AdminView";


export class AdminGradesTab {

    private remote: string; // url to backend
    constructor(remote: string) {
        this.remote = remote;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminGradesTab::init(..) - start');

        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('gradesListTable').innerHTML = ''; // clear target

        UI.showModal('Retrieving grades.');
        const delivs = await AdminDeliverablesTab.getDeliverables(this.remote);
        const students = await AdminStudentsTab.getStudents(this.remote);
        const grades = await AdminGradesTab.getGrades(this.remote);
        UI.hideModal();

        this.render(grades, delivs, students);
    }

    private render(grades: GradeTransport[], delivs: DeliverableTransport[], students: StudentTransport[]): void {
        Log.trace("AdminGradesTab::render(..) - start");

        const headers: TableHeader[] = [
            {
                id:          'githubId',
                text:        'GitHub Id',
                sortable:    true,
                defaultSort: true,
                sortDown:    false,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'snum',
                text:        'SNUM',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'fName',
                text:        'First Name',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'lName',
                text:        'Last Name',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'labId',
                text:        'Lab',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            }

            // more sections dynamically added
        ];

        for (const deliv of delivs) {
            const col = {
                id:          deliv.id,
                text:        deliv.id,
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            };
            headers.push(col);
        }

        const st = new SortableTable(headers, '#gradesListTable');

        // this loop couldn't possibly be less efficient
        for (const student of students) {
            // let snum = 'N/A';
            // if (student.studentNum !== null && student.studentNum >= 0) {
            //     snum = student.studentNum + '';
            // }
            // let lab = 'N/A';
            // if (student.labId !== null && student.labId.length > 0) {
            //     lab = student.labId;
            // }
            let row: TableCell[] = [
                {value: student.userName, html: '<a href="' + student.userUrl + '">' + student.userName + '</a>'},
                {value: student.studentNum, html: student.studentNum + ''},
                {value: student.firstName, html: student.firstName},
                {value: student.lastName, html: student.lastName},
                {value: student.labId, html: student.labId}
            ];
            for (const deliv of delivs) {
                let tableCell: TableCell = null;
                for (const grade of grades) {
                    if (grade.personId === student.userName) {
                        if (grade.delivId === deliv.id) {
                            let score = '';
                            if (grade.score !== null && grade.score > 0) {
                                score = grade.score + '';
                            }
                            if (score !== '') {
                                tableCell = {value: score, html: '<a href="' + grade.URL + '">' + score + '</a>'};
                            } else {
                                tableCell = {value: score, html: score};
                            }
                        }
                    }
                }
                if (tableCell === null) {
                    tableCell = {value: 'N/A', html: 'N/A'};
                }
                row.push(tableCell);
            }
            st.addRow(row);
        }

        st.generate();

        if (st.numRows() > 0) {
            UI.showSection('gradesListTable');
            UI.hideSection('gradesListTableNone');
        } else {
            UI.showSection('gradesListTable');
            UI.hideSection('gradesListTableNone');
        }
    }

    public static async getGrades(remote: string): Promise<GradeTransport[]> {
        Log.info("AdminGradesTab::getGrades( .. ) - start");

        const start = Date.now();
        const url = remote + '/portal/admin/grades';
        const options = AdminView.getOptions();

        const response = await fetch(url, options);
        if (response.status === 200) {
            Log.trace('AdminGradesTab::getGrades(..) - 200 received');
            const json: GradeTransportPayload = await response.json();
            // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminGradesTab::getGrades(..)  - worked; took: ' + UI.took(start));
                return json.success;
            } else {
                Log.trace('AdminGradesTab::getGrades(..)  - ERROR: ' + json.failure.message);
                AdminView.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminGradesTab::getGrades(..)  - !200 received: ' + response.status);
            const text = await response.text();
            AdminView.showError(text);
        }

        return [];
    }
}
