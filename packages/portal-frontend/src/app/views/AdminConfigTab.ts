import Log from "../../../../common/Log";

import {UI} from "../util/UI"
import {AdminView} from "./AdminView";
import {OnsButtonElement} from "onsenui";
import {Network} from "../util/Network";
import {CourseTransport, CourseTransportPayload} from "../../../../common/types/PortalTypes";
import {AdminDeliverablesTab} from "./AdminDeliverablesTab";


export class AdminConfigTab {

    private remote: string; // url to backend
    private isAdmin: boolean;

    private course: CourseTransport = null;

    constructor(remote: string, isAdmin: boolean) {
        this.remote = remote;
        this.isAdmin = isAdmin;
    }

    public setAdmin(isAdmin: boolean) {
        Log.info('AdminConfigTab::isAdmin( ' + isAdmin + ' )');
        this.isAdmin = isAdmin;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminDeliverablesTab::init(..) - start');
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

        (document.querySelector('#adminSubmitDefaultDeliverable') as OnsButtonElement).onclick = function (evt) {
            Log.info('AdminView::handleAdminConfig(..) - default deliverable pressed');

            that.defaultDeliverablePressed();
        };

        this.course = await AdminConfigTab.getCourse(this.remote);

        const deliverables = await AdminDeliverablesTab.getDeliverables(this.remote);
        const delivDropdown = document.querySelector('#adminDefaultDeliverableSelect') as HTMLSelectElement;
        let delivOptions = ['--Not Set--'];
        for (const deliv of deliverables) {
            delivOptions.push(deliv.id);
        }
        delivOptions = delivOptions.sort();

        delivDropdown.innerHTML = '';
        for (const delivId of delivOptions) {
            let selected = false;

            if (delivId === this.course.defaultDeliverableId) {
                selected = true;
            }

            let value = delivId;
            if (delivId.startsWith('--')) {
                // handle the null case
                value = null;
            }

            const o: HTMLOptionElement = new Option(delivId, value, false, selected);
            delivDropdown.add(o);
        }
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
            AdminView.showError(err);
        }

        Log.trace('AdminView::uploadClasslist(..) - end');
    }

    private async defaultDeliverablePressed(): Promise<void> {
        Log.trace('AdminView::defaultDeliverablePressed(..) - start');
        const delivDropdown = document.querySelector('#adminDefaultDeliverableSelect') as HTMLSelectElement;
        const value = delivDropdown.value;

        this.course.defaultDeliverableId = value; // update with new value

        Log.trace('AdminView::defaultDeliverablePressed(..) - value: ' + value);

        const url = this.remote + '/admin/course';
        let options: any = AdminView.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(this.course);

        let response = await fetch(url, options);
        let body = await response.json();

        if (typeof body.success !== 'undefined') {
            // worked
            UI.showErrorToast("Default deliverable saved successfully.");
            // UI.popPage();
        } else {
            UI.showAlert(body.failure.message);
        }

    }

    public static async getCourse(remote: string): Promise<CourseTransport> {
        UI.showModal('Retrieving config.');

        // get class options
        const options = AdminView.getOptions();
        let url = remote + '/admin/course';
        let response = await fetch(url, options);

        let courseOptions: CourseTransport = null;
        let start = Date.now();
        if (response.status === 200) {
            Log.trace('AdminCourseTab::getCourse(..) - 200 received for course options');
            const json: CourseTransportPayload = await response.json();
            // Log.trace('AdminView::handleStudents(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined') {
                Log.trace('AdminCourseTab::getCourse(..)  - worked; took: ' + UI.took(start));
                return json.success;
            } else {
                Log.trace('AdminCourseTab::getCourse(..)  - ERROR: ' + json.failure.message);
                AdminView.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminCourseTab::getCourse(..)  - !200 received: ' + response.status);
            const text = await response.text();
            AdminView.showError(text);
        }
        return null;
    }

}