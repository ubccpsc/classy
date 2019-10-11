import Log from "../../../../../common/Log";

import {StudentTransport, StudentTransportPayload} from "../../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";

import {UI} from "../util/UI";
import {AdminView} from "./AdminView";

export class AdminStudentsTab {

    private readonly remote: string; // url to backend
    constructor(remote: string) {
        this.remote = remote;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminStudentsTab::init(..) - start');

        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('studentListTable').innerHTML = ''; // clear target

        if (typeof opts.labSection === 'undefined') {
            opts.labSection = '-All-';
        }

        UI.showModal('Retrieving students.');
        const students = await AdminStudentsTab.getStudents(this.remote);
        UI.hideModal();

        this.render(students, opts.labSection);
    }

    private render(students: StudentTransport[], labSection: string): void {
        Log.trace("AdminStudentsTab::render(..) - start");

        const headers: TableHeader[] = [
            {
                id:          'num',
                text:        '#',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'githubId',
                text:        'Github Id',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'id',
                text:        'Internal Id',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
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
                text:        'Lab Section',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            }
        ];

        let labSectionsOptions = ['-All-', '-Unspecified-'];
        const st = new SortableTable(headers, '#studentListTable');

        let count = 1;
        for (const student of students) {
            let labId = '';
            if (student.labId !== null && student.labId.length > 0) {
                labId = student.labId;
            }
            const row: TableCell[] = [
                {value: count, html: count++ + ''},
                {
                    value: student.githubId, html: '<a class="selectable" href="' + student.userUrl + '">' +
                    student.githubId + '</a>' // Should be CWL
                },
                {value: student.id, html: student.id}, // Should be CSID
                {value: student.firstName, html: student.firstName},
                {value: student.lastName, html: student.lastName},
                {value: labId, html: labId}
            ];
            if (labSectionsOptions.indexOf(student.labId) < 0 && student.labId !== '' && student.labId !== null) {
                labSectionsOptions.push(student.labId);
            }
            if (labSection === student.labId || labSection === '-All-' ||
                (labSection === '-Unspecified-' && student.labId === '')) {
                st.addRow(row);
            }
        }

        st.generate();

        labSectionsOptions = labSectionsOptions.sort();
        UI.setDropdownOptions('studentsListSelect', labSectionsOptions, labSection);

        const labSelector = document.querySelector('#studentsListSelect') as HTMLSelectElement;
        // labSelector.innerHTML = '';
        // for (const labId of labSectionsOptions) {
        //     let selected = false;
        //     if (labId === labSection) {
        //         selected = true;
        //     }
        //     const o: HTMLOptionElement = new Option(labId, labId, false, selected);
        //     labSelector.add(o);
        // }

        const that = this;
        labSelector.onchange = function(evt) {
            Log.info('AdminStudentsTab::render(..) - upload pressed');
            evt.stopPropagation(); // prevents list item expansion

            const val = labSelector.value.valueOf();

            // that.renderPage('AdminStudents', {labSection: val}); // if we need to re-fetch
            that.render(students, val); // if cached data is ok
        };

        if (st.numRows() > 0) {
            UI.showSection('studentListTable');
            UI.hideSection('studentListTableNone');
        } else {
            UI.showSection('studentListTable');
            UI.hideSection('studentListTableNone');
        }
    }

    public static async getStudents(remote: string): Promise<StudentTransport[]> {
        Log.info("AdminStudentsTab::getStudents( .. ) - start");

        try {
            const start = Date.now();
            const url = remote + '/portal/admin/students';
            const options = AdminView.getOptions();
            const response = await fetch(url, options);

            if (response.status === 200) {
                Log.trace('AdminStudentsTab::getStudents(..) - 200 received');
                const json: StudentTransportPayload = await response.json();
                // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
                if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                    Log.trace('AdminStudentsTab::getStudents(..)  - worked; # students: ' +
                        json.success.length + '; took: ' + UI.took(start));
                    return json.success;
                } else {
                    Log.trace('AdminStudentsTab::getStudents(..)  - ERROR: ' + json.failure.message);
                    AdminView.showError(json.failure); // FailurePayload
                }
            } else {
                Log.trace('AdminView::getStudents(..)  - !200 received: ' + response.status);
                const text = await response.text();
                AdminView.showError(text);
            }
        } catch (err) {
            AdminView.showError("Getting students failed: " + err.message);
        }
        return [];
    }
}
