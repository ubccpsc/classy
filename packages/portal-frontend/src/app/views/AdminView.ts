/**
 * This is the main student page for the SDDM.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import Log from "../../../../common/Log";

import {UI} from "../util/UI"

import {IView} from "./IView";

import {StudentTransport, StudentTransportPayload} from "../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";

interface AdminTabs {
    deliverables: boolean,
    students: boolean,
    teams: boolean,
    results: boolean,
    grades: boolean,
    dashboard: boolean,
    config: boolean
}

export class AdminView implements IView {

    private remote: string | null = null;
    private tabs: AdminTabs | null = null;

    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("AdminView::<init>");
        this.remote = remoteUrl;
        this.tabs = tabs;
    }


    /*
        private longAction(duration: number, msg?: string) {
            const that = this;
            if (typeof msg !== 'undefined') {
                that.showModal(msg);
            } else {
                that.showModal();
            }

            setTimeout(function () {
                that.hideModal();
            }, duration);

            setTimeout(function () {
                let sel = <any>document.getElementById('sdmmSelect');
                if (sel !== null) {
                    sel.selectedIndex = sel.selectedIndex + 1;
                }
                that.checkStatus();
            }, (duration - 500));

        }

        public checkStatus() {
            Log.warn("CS310view::checkStatus() - NOT IMPLEMENTED");
            // const msg = "Updating status";
            // UI.showModal(msg);

            // const url = this.remote + '/currentStatus';
            // this.fetchStatus(url);
        }

    */
    public renderPage(name: string, opts: {}) {
        Log.info('AdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));

        if (this.tabs !== null) {
            this.setTabVisibility('AdminDeliverableTab', this.tabs.deliverables);
            this.setTabVisibility('AdminStudentTab', this.tabs.students);
            this.setTabVisibility('AdminTeamTab', this.tabs.teams);
            this.setTabVisibility('AdminResultTab', this.tabs.results);
            this.setTabVisibility('AdminGradeTab', this.tabs.grades);
            this.setTabVisibility('AdminDashboardTab', this.tabs.dashboard);
            this.setTabVisibility('AdminConfigTab', this.tabs.config);
        }

        // NOTE: This is a kind of reflection to find the function to call without hard-coding it
        // this calls `handle<PageName>`, so to make it work your IView subtype must have a method
        // with that name (which you set in your ons-page id attribute in your html file)
        const functionName = 'handle' + name;
        if (typeof (<any>this)[functionName] === 'function') {
            Log.warn('AdminView::renderPage(..) - calling: ' + functionName);
            (<any>this)[functionName](opts);
        } else {
            Log.warn('AdminView::renderPage(..) - unknown page: ' + name + ' (function: ' + functionName + ' not defined on view).');
        }
    }

    private setTabVisibility(name: string, visible: boolean) {
        const e = document.getElementById(name);
        if (e !== null) {
            if (visible === false) {
                e.style.display = 'none';
            }
        } else {
            Log.warn("AdminView::setTabVisibility( " + name + ", " + visible + " ) - tab not found");
        }
    }

    /*
        public showModal(text?: string) {
            // https://onsen.io/v2/api/js/ons-modal.html

            if (typeof text === 'undefined') {
                text = null;
            }

            const modal = document.querySelector('ons-modal') as OnsModalElement;
            if (modal !== null) {
                modal.style.backgroundColor = '#444444'; // modal opaque
                if (text != null) {
                    document.getElementById('modalText').innerHTML = text;
                }
                modal.show({animation: 'fade'});
            } else {
                Log.warn('CS310View::showModal(..) - Modal is null');
            }
        }

        public hideModal() {
            const modal = document.querySelector('ons-modal') as OnsModalElement;
            if (modal !== null) {
                modal.hide({animation: 'fade'});
            } else {
                Log.warn('CS310View::hideModal(..) - Modal is null');
            }
        }*/

    /*
        public async fetchStatus(url: string): Promise<void> {
            Log.info('CS310View::fetchStatus( ' + url + ' ) - start');

            let options = this.getOptions();
            let response = await fetch(url, options);
            UI.hideModal();
            if (response.status === 200) {
                Log.trace('CS310View::fetchStatus(..) - 200 received');
                let json = await response.json();
                Log.trace('CS310View::fetchStatus(..) - payload: ' + JSON.stringify(json));

                if (typeof json.success !== 'undefined') {
                    Log.trace('CS310View::fetchStatus(..) - status: ' + json.success.status);
                    // this.updateState(json.success); // StatusPayload
                } else {
                    Log.trace('CS310View::fetchStatus(..) - ERROR: ' + json.failure.message);
                    this.showError(json.failure); // FailurePayload
                }

            } else {
                Log.trace('CS310View::fetchStatus(..) - !200 received');
            }
            return;
        }
    */

    public showError(failure: any) { // FailurePayload
        Log.error("CS310View::showError(..) - failure: " + JSON.stringify(failure));
        try {
            // check to see if response is json
            const f = JSON.parse(failure);
            if (f !== null) {
                failure = f; // change to object if it is one
            }
        } catch (err) {
            // intentionally blank
        }
        if (typeof failure === 'string') {
            UI.showAlert(failure);
        } else if (typeof failure.failure !== 'undefined') {
            UI.showAlert(failure.failure.message);
        } else {
            Log.error("Unknown message: " + JSON.stringify(failure));
            UI.showAlert("Action unsuccessful.");
        }
    }

    private getOptions() {
        const options = {
            headers: {
                'Content-Type': 'application/json',
                'user':         localStorage.user,
                'token':        localStorage.token
            }
        };
        return options;
    }

    // called by reflection in renderPage
    private async handleAdminStudents(opts: {}): Promise<void> {
        Log.info('AdminView::handleStudents(..) - start');
        UI.showModal('Retrieving students');

        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('studentListTable').innerHTML = ''; // clear target

        const options = this.getOptions();
        const url = this.remote + '/admin/students';
        const response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('AdminView::handleStudents(..) - 200 received');
            const json: StudentTransportPayload = await response.json();
            // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminView::handleStudents(..)  - worked');
                this.renderStudents(json.success);
            } else {
                Log.trace('AdminView::handleStudents(..)  - ERROR: ' + json.failure.message);
                this.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminView::handleStudents(..)  - !200 received: ' + response.status);
            const text = await response.text();
            this.showError(text);
        }
    }

    private renderStudents(students: StudentTransport[]) {
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

        const st = new SortableTable(headers, '#studentListTable');
        for (const student of students) {
            let row: TableCell[] = [
                {value: student.userName, html: '<a href="' + student.userUrl + '">' + student.userName + '</a>'},
                {value: student.firstName, html: student.firstName},
                {value: student.lastName, html: student.lastName},
                {value: student.labId, html: student.labId}
            ];
            st.addRow(row);
        }

        setTimeout(function () {
            st.generate();
        }, 50);

    }
}
