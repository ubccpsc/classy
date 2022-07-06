import Log from "../../../../../common/Log";

import {
    DeliverableTransport,
    GradeTransport,
    GradeTransportPayload,
    StudentTransport
} from "../../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";

import {UI} from "../util/UI";
import {AdminDeliverablesTab} from "./AdminDeliverablesTab";
import {AdminPage} from "./AdminPage";
import {AdminStudentsTab} from "./AdminStudentsTab";
import {AdminView} from "./AdminView";

export class AdminGradesTab extends AdminPage {

    // private readonly remote: string; // url to backend
    constructor(remote: string) {
        // this.remote = remote;
        super(remote);
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminGradesTab::init(..) - start');

        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('gradesListTable').innerHTML = ''; // clear target
        document.getElementById('gradesSummaryTable').innerHTML = ''; // clear target

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
                id: 'githubId',
                text: 'GitHub Id',
                sortable: true,
                defaultSort: true,
                sortDown: false,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: 'id',
                text: 'Internal Id',
                sortable: true,
                defaultSort: true,
                sortDown: false,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: 'snum',
                text: 'SNUM',
                sortable: true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown: false, // Whether the column should initially sort descending or ascending.
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: 'fName',
                text: 'First Name',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: 'lName',
                text: 'Last Name',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: 'labId',
                text: 'Lab',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            }

            // more sections dynamically added
        ];

        for (const deliv of delivs) {
            const col = {
                id: deliv.id,
                text: deliv.id,
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            };
            headers.push(col);
        }

        const st = new SortableTable(headers, '#gradesListTable');

        // this loop couldn't possibly be less efficient
        for (const student of students) {
            const row: TableCell[] = [
                {
                    value: student.githubId,
                    html: '<a class="selectable" href="' + student.userUrl + '">' + student.githubId + '</a>'
                },
                {value: student.id, html: student.id + ''},
                {value: student.studentNum, html: student.studentNum + ''},
                {value: student.firstName, html: student.firstName},
                {value: student.lastName, html: student.lastName},
                {value: student.labId, html: student.labId}
            ];
            for (const deliv of delivs) {
                let tableCell: TableCell = null;
                for (const grade of grades) {
                    if (grade.personId === student.id) {
                        if (grade.delivId === deliv.id) {
                            const hoverComment = AdminGradesTab.makeHTMLSafe(grade.comment);
                            let score = '';
                            if (grade.score !== null && grade.score >= 0) {
                                score = grade.score + '';
                            }
                            let html;
                            if (score !== '' && grade.URL !== null) {
                                html = `<a class="selectable" title="${hoverComment}" href="${grade.URL}">${score}</a>`;
                            } else if (score !== '' && grade.URL === null) {
                                html = `<div title="${hoverComment}">${score}</div>`;
                            } else {
                                html = score;
                            }
                            tableCell = {value: score, html};
                        }
                    }
                }
                if (tableCell === null) {
                    // tableCell = {value: 'N/A', html: 'N/A'}; // N/A for missing cells
                    tableCell = {value: '', html: ''}; // blanks for missing cells
                }
                row.push(tableCell);
            }
            st.addRow(row);
        }

        st.generate();

        if (st.numRows() > 0) {
            UI.showSection('gradesListTable');
            UI.showSection('gradesSummaryTable');
            UI.hideSection('gradesListTableNone');
        } else {
            UI.hideSection('gradesListTable');
            UI.hideSection('gradesSummaryTable');
            UI.showSection('gradesListTableNone');
        }

        this.renderSummary(grades, delivs, students);
    }

    private renderSummary(grades: GradeTransport[], delivs: DeliverableTransport[], students: StudentTransport[]): void {
        Log.trace("AdminGradesTab::renderSummary(..) - start");

        const headers: TableHeader[] = [
            {
                id: 'delivId',
                text: 'Deliv Id',
                sortable: true,
                defaultSort: true,
                sortDown: false,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: 'avg',
                text: 'Average',
                sortable: true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown: false, // Whether the column should initially sort descending or ascending.
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: 'median',
                text: 'Median',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '009',
                text: '0-9',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '1019',
                text: '10-19',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '2029',
                text: '20-29',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '3039',
                text: '30-39',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '4049',
                text: '40-49',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '5059',
                text: '50-59',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '6069',
                text: '60-69',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '7079',
                text: '70-79',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '8089',
                text: '80-89',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '9099',
                text: '90-99',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            },
            {
                id: '100',
                text: '100',
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: 'padding-left: 1em; padding-right: 1em;'
            }

        ];

        // for (const deliv of delivs) {
        //     const col = {
        //         id:          deliv.id,
        //         text:        deliv.id,
        //         sortable:    true,
        //         defaultSort: false,
        //         sortDown:    true,
        //         style:       'padding-left: 1em; padding-right: 1em;'
        //     };
        //     headers.push(col);
        // }

        const st = new SortableTable(headers, '#gradesSummaryTable');

        // this loop couldn't possibly be less efficient
        const gradeMap: { [delivId: string]: number[] } = {};

        for (const grade of grades) {
            if (grade !== null && typeof grade.score !== 'undefined' && typeof grade.score === 'number') {
                if (typeof gradeMap[grade.delivId] === 'undefined') {
                    gradeMap[grade.delivId] = [];
                }
                // ignore grades for withdrawn students in the summary table
                let inc = false;
                for (const student of students) {
                    if (student.id === grade.personId && student.labId !== 'W') {
                        inc = true;
                    }
                }
                if (inc === true) {
                    gradeMap[grade.delivId].push(grade.score);
                }
            }
        }

        const inBin = function (list: number[], lower: number, upper: number): number {
            const total = list.reduce(function (accumulator, currentValue) {
                currentValue = Math.round(currentValue);
                if (currentValue >= lower && currentValue <= upper) {
                    accumulator++;
                }
                return accumulator;
            }, 0);
            return total;
        };

        for (const delivId of Object.keys(gradeMap)) {

            const delivGrades: number[] = gradeMap[delivId];

            const num = delivGrades.length;
            if (num > 0) {
                const total = delivGrades.reduce(function (accumulator, currentValue) {
                    return accumulator + currentValue;
                });
                const avg = Number((total / num).toFixed(2));

                delivGrades.sort((a, b) => a - b);
                const lowMiddle = Math.floor((num - 1) / 2);
                const highMiddle = Math.ceil((num - 1) / 2);
                let median = (delivGrades[lowMiddle] + delivGrades[highMiddle]) / 2;
                median = Number(median.toFixed(2));

                const row: TableCell[] = [
                    {value: delivId, html: delivId},
                    {value: avg + '', html: avg + ''},
                    {value: median + '', html: median + ''}
                ];

                for (let i = 0; i < 10; i++) {
                    const lower = i * 10;
                    const upper = lower + 9;
                    const numInBin = inBin(delivGrades, lower, upper);
                    Log.info('inBin( [..], ' + lower + ', ' + upper + '; #: ' + numInBin);
                    row.push({value: numInBin + '', html: numInBin + ''});
                }
                const numPerfect = inBin(delivGrades, 100, 100);
                row.push({value: numPerfect + '', html: numPerfect + ''});
                st.addRow(row);
            }
        }

        st.generate();
    }

    public static async getGrades(remote: string): Promise<GradeTransport[]> {
        Log.info("AdminGradesTab::getGrades( .. ) - start");
        try {
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
        } catch (err) {
            AdminView.showError("Getting grades failed: " + err.message);
        }
        return [];
    }

    private static makeHTMLSafe(text: string): string {
        // https://stackoverflow.com/questions/14129953/how-to-encode-a-string-in-javascript-for-displaying-in-html/14130005
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}
