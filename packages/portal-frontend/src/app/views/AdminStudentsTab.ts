import Log from "../../../../common/Log";

import {UI} from "../util/UI"

import {StudentTransport, StudentTransportPayload} from "../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";
import {AdminView} from "./AdminView";


export class AdminStudentsTab {

    private remote: string; // url to backend
    constructor(remote: string) {
        this.remote = remote;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminStudentsTab::init(..) - start');
        const start = Date.now();
        UI.showModal('Retrieving students');

        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('studentListTable').innerHTML = ''; // clear target

        if (typeof opts.labSection === 'undefined') {
            opts.labSection = '-All-';
        }

        const options = AdminView.getOptions();
        const url = this.remote + '/admin/students';
        const response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('AdminStudentsTab::init(..) - 200 received');
            const json: StudentTransportPayload = await response.json();
            // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminStudentsTab::init(..)  - worked; took: ' + UI.took(start));
                this.render(json.success, opts.labSection);
            } else {
                Log.trace('AdminStudentsTab::init(..)  - ERROR: ' + json.failure.message);
                AdminView.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminView::init(..)  - !200 received: ' + response.status);
            const text = await response.text();
            AdminView.showError(text);
        }
    }


    private render(students: StudentTransport[], labSection: string) {
        Log.trace("AdminStudentsTab::render(..) - start");
        const headers: TableHeader[] = [
            {
                id:          'id',
                text:        'Github Id',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
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
                text:        'Lab Section',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            }
        ];

        let labSectionsOptions = ['-All-', '-Unspecified-'];
        const st = new SortableTable(headers, '#studentListTable');
        for (const student of students) {
            let row: TableCell[] = [
                {value: student.userName, html: '<a href="' + student.userUrl + '">' + student.userName + '</a>'},
                {value: student.firstName, html: student.firstName},
                {value: student.lastName, html: student.lastName},
                {value: student.labId, html: student.labId}
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
        let labSelector = document.querySelector('#studentsListSelect') as HTMLSelectElement;
        labSelector.innerHTML = '';
        for (const labId of labSectionsOptions) {
            let selected = false;
            if (labId === labSection) {
                selected = true;
            }
            const o: HTMLOptionElement = new Option(labId, labId, false, selected);
            labSelector.add(o);
        }

        const that = this;
        labSelector.onchange = function (evt) {
            Log.info('AdminStudentsTab::render(..) - upload pressed');
            evt.stopPropagation(); // prevents list item expansion

            let val = labSelector.value.valueOf();

            // that.renderPage('AdminStudents', {labSection: val}); // if we need to re-fetch
            that.render(students, val); // if cached data is ok
        };

    }
}