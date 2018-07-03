/**
 * This is the main student page for the SDDM.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import Log from "../../../../common/Log";

import {UI} from "../util/UI"

import {IView} from "./IView";

import {
    DeliverableTransport,
    DeliverableTransportPayload,
    StudentTransport,
    StudentTransportPayload
} from "../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";
import {OnsButtonElement, OnsFabElement} from "onsenui";
import {Network} from "../util/Network";

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

    protected remote: string | null = null;
    private tabs: AdminTabs | null = null;
    private isStaff = false;
    private isAdmin = false;

    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("AdminView::<init>");
        this.remote = remoteUrl;
        this.tabs = tabs;
    }

    public renderPage(name: string, opts: any) {
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

        if (typeof opts.isAdmin !== 'undefined') {
            this.isAdmin = opts.isAdmin;
        }
        if (typeof opts.isStaff !== 'undefined') {
            this.isStaff = opts.isStaff;
        }
        if (this.isAdmin === false) {
            // hide the config tab if we aren't an admin
            Log.info('AdminView::renderPage(..) - !admin; hiding config tab');
            this.setTabVisibility('AdminConfigTab', false);
        }

        // NOTE: This is a kind of reflection to find the function to call without hard-coding it
        // this calls `handle<PageName>`, so to make it work your IView subtype must have a method
        // with that name (which you set in your ons-page id attribute in your html file)
        const functionName = 'handle' + name;
        if (typeof (<any>this)[functionName] === 'function') {
            Log.info('AdminView::renderPage(..) - calling: ' + functionName);
            // NOTE: does not await; not sure if this is a problem
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
        Log.error("AdminView::showError(..) - start");
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
            Log.error("AdminView::showError(..) - failure: " + failure);
            UI.showAlert(failure);
        } else if (typeof failure.failure !== 'undefined') {
            Log.error("AdminView::showError(..) - failure message: " + failure.failure.message);
            UI.showAlert(failure.failure.message);
        } else {
            Log.error("AdminView::showError(..) - Unknown message: " + failure);
            UI.showAlert("Action unsuccessful.");
        }
    }

    protected getOptions() {
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
    private async handleAdminRoot(opts: {}): Promise<void> {
        Log.info('AdminView::handleAdminRoot(..) - start');
        // Can init frame here if needed
        return;
    }

    // called by reflection in renderPage
    private async handleAdminDeliverables(opts: {}): Promise<void> {
        Log.info('AdminView::handleAdminDeliverables(..) - start');
        UI.showModal('Retrieving deliverables');
        const start = Date.now();

        const fab = document.querySelector('#adminAddDeliverable') as OnsFabElement;
        if (this.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            fab.onclick = function (evt) {
                Log.info('AdminView::handleAdminDeliverables(..)::addDeliverable::onClick');
                UI.pushPage('editDeliverable.html', {delivId: null});
            };
        }

        const options = this.getOptions();
        const url = this.remote + '/admin/deliverables';
        const response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('AdminView::handleAdminDeliverables(..) - 200 received');
            const json: DeliverableTransportPayload = await response.json();
            // Log.trace('AdminView::handleAdminDeliverables(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminView::handleAdminDeliverables(..)  - worked; took: ' + this.took(start));

                this.renderDeliverables(json.success);
            } else {
                Log.trace('AdminView::handleAdminDeliverables(..)  - ERROR: ' + json.failure.message);
                this.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminView::handleAdminDeliverables(..)  - !200 received: ' + response.status);
            const text = await response.text();
            this.showError(text);
        }
    }

    // called by reflection in renderPage
    private async handleAdminConfig(opts: {}): Promise<void> {
        Log.info('AdminView::handleAdminConfig(..) - start');
        const that = this;
        // Can init frame here if needed

        (document.querySelector('#adminSubmitClasslist') as OnsButtonElement).onclick = function (evt) {
            Log.info('AdminView::handleAdminConfig(..) - upload pressed');
            evt.stopPropagation(); // prevents list item expansion

            const fileInput = document.querySelector('#adminClasslistFile') as HTMLInputElement;
            const isValid: boolean = that.validateClasslistSpecified(fileInput);
            if (isValid === true) {
                that.uploadClasslist(fileInput.files);
            }
        };

        return;
    }

    private validateClasslistSpecified(fileInput: HTMLInputElement) {
        if (fileInput.value.length > 0) {
            Log.trace('AdminView::validateClasslistSpecified() - validation passed');
            return true;
        } else {
            UI.notification('You must select a ClassList CSV before you click "Upload".');
            return false;
        }
    }

    public async uploadClasslist(fileList: FileList) {
        Log.info('AdminView::uploadClasslist(..) - start');
        const url = this.remote + '/admin/classlist';

        UI.showModal('Uploading classlist.');

        try {
            const formData = new FormData();
            formData.append('classlist', fileList[0]); // The CSV is fileList[0]

            const opts = {
                headers: {
                    // 'Content-Type': 'application/json', // violates CORS; leave commented out
                    'user':  localStorage.user,
                    'token': localStorage.token
                }
            };
            const response: Response = await Network.httpPostFile(url, opts, formData);
            if (response.status >= 200 && response.status < 300) {
                const data = await response.json();
                UI.hideModal();
                Log.info('AdminView::uploadClasslist(..) - RESPONSE: ' + JSON.stringify(data));
                UI.notification('Class list Updated.');
            } else {
                const reason = await response.json();
                UI.hideModal();
                if (typeof reason.failure && typeof reason.failure.message) {
                    UI.notification('There was an issue uploading your class list. Please ensure the CSV file includes all required columns. <br/>Details: ' + reason.failure.message);
                } else {
                    UI.notification('There was an issue uploading your class list. Please ensure the CSV file includes all required columns.');
                }
            }
        } catch (err) {
            UI.hideModal();
            Log.error('AdminView::uploadClasslist(..) - ERROR: ' + err.message);
            this.showError(err);
        }

        Log.trace('AdminView::uploadClasslist(..) - end');
    }

    // called by reflection in renderPage
    private async handleAdminStudents(opts: any): Promise<void> {
        Log.info('AdminView::handleStudents(..) - start');
        const start = Date.now();
        UI.showModal('Retrieving students');

        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('studentListTable').innerHTML = ''; // clear target

        if (typeof opts.labSection === 'undefined') {
            opts.labSection = '-All-';
        }

        const options = this.getOptions();
        const url = this.remote + '/admin/students';
        const response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('AdminView::handleStudents(..) - 200 received');
            const json: StudentTransportPayload = await response.json();
            // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminView::handleStudents(..)  - worked; took: ' + this.took(start));
                this.renderStudents(json.success, opts.labSection);
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

    private renderStudents(students: StudentTransport[], labSection: string) {
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
            Log.info('AdminView::renderStudents(..) - upload pressed');
            evt.stopPropagation(); // prevents list item expansion

            let val = labSelector.value.valueOf();

            // that.renderPage('AdminStudents', {labSection: val}); // if we need to re-fetch
            that.renderStudents(students, val); // if cached data is ok
        };

    }

    private renderDeliverables(deliverables: DeliverableTransport[]) {
        const deliverableList = document.querySelector('#adminDeliverablesList') as HTMLElement;

        deliverableList.innerHTML = '';
        deliverableList.appendChild(UI.createListHeader('Deliverables'));

        for (const deliv of deliverables) {
            const main = 'Deliverable: ' + deliv.id;
            const sub = 'Opens: ' + new Date(deliv.openTimestamp).toLocaleString() + '; Closes: ' + new Date(deliv.closeTimestamp).toLocaleString();

            let editable = false;
            if (this.isAdmin === true) {
                editable = true;
            }

            const elem = UI.createListItem(main, sub, editable);
            elem.setAttribute('delivId', deliv.id);
            elem.onclick = function (evt: any) {
                const delivId = evt.currentTarget.getAttribute('delivId');
                UI.pushPage('editDeliverable.html', {delivId: delivId});
            };
            deliverableList.appendChild(elem);
        }

        if (deliverables.length === 0) {
            deliverableList.appendChild(UI.createListItem('Deliverables not yet specified.'));
        }
    }

    private handleadminEditDeliverablePage(opts: any) {
        Log.warn('AdminView::handleadminEditDeliverablePage( ' + JSON.stringify(opts) + ' ) - NOT IMPLEMENTED');
        const that = this;

        const fab = document.querySelector('#adminEditDeliverableSave') as OnsFabElement;
        if (this.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            fab.onclick = function (evt) {
                Log.info('AdminView::handleadminEditDeliverablePage(..)::addDeliverable::onClick');
                that.showError('not implemented');
            };
        }
    }

    private took(start: number): string {
        return (Date.now() - start) + ' ms';
    }
}
