import {OnsButtonElement} from "onsenui";
import Log from "../../../../../common/Log";
import {CourseTransport, CourseTransportPayload, Payload, ProvisionTransport} from "../../../../../common/types/PortalTypes";
import {Network} from "../util/Network";
import {UI} from "../util/UI";
import {AdminDeliverablesTab} from "./AdminDeliverablesTab";
import {AdminView} from "./AdminView";

export class AdminConfigTab {

    private readonly remote: string; // url to backend
    private isAdmin: boolean;

    private deliverablesPage: AdminDeliverablesTab = null;
    private course: CourseTransport = null;

    constructor(remote: string, isAdmin: boolean) {
        this.remote = remote;
        this.isAdmin = isAdmin;
        this.deliverablesPage = new AdminDeliverablesTab(remote, isAdmin);
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

        await this.deliverablesPage.init(opts);

        (document.querySelector('#adminSubmitClasslist') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminView::handleAdminConfig(..) - upload pressed');
            evt.stopPropagation(); // prevents list item expansion

            const fileInput = document.querySelector('#adminClasslistFile') as HTMLInputElement;
            const isValid: boolean = that.validateClasslistSpecified(fileInput);
            if (isValid === true) {
                that.uploadClasslist(fileInput.files).then(function() {
                    // done
                }).catch(function(err) {
                    Log.error('AdminView::handleAdminConfig(..) - upload pressed ERROR: ' + err.message);
                });
            }
        };

        (document.querySelector('#adminSubmitDefaultDeliverable') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminView::handleAdminConfig(..) - default deliverable pressed');

            that.defaultDeliverablePressed().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminView::handleAdminConfig(..) - default deliverable pressed; ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminProvisionButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminView::handleAdminConfig(..) - provision deliverable pressed');

            that.provisionDeliverablePressed().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminView::handleAdminConfig(..) - provision deliverable pressed; ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminReleaseButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminView::handleAdminConfig(..) - release deliverable pressed');

            that.releaseDeliverablePressed().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminView::handleAdminConfig(..) - release deliverable pressed; ERROR: ' + err.message);
            });
        };

        UI.showModal("Retriving config / deliverable details.");

        this.course = await AdminConfigTab.getCourse(this.remote);

        const deliverables = await AdminDeliverablesTab.getDeliverables(this.remote);
        const defaultDeliverableDropdown = document.querySelector('#adminDefaultDeliverableSelect') as HTMLSelectElement;
        const provisionDropdown = document.querySelector('#adminProvisionDeliverableSelect') as HTMLSelectElement;
        const releaseDropdown = document.querySelector('#adminReleaseDeliverableSelect') as HTMLSelectElement;

        const defaultDeliverableOptions = ['--Not Set--'];
        const provisionOptions = ['--Select--'];
        const releaseOptions = ['--Select--'];

        for (const deliv of deliverables) {
            if (deliv.shouldAutoTest === true) {
                // default deliverables only matter for autotest
                defaultDeliverableOptions.push(deliv.id);
            }
            if (deliv.shouldProvision === true) {
                // can only provision or release deliverables that are provisionable
                provisionOptions.push(deliv.id);
                releaseOptions.push(deliv.id);
            }
        }

        this.populateDelivSelect(defaultDeliverableOptions, defaultDeliverableDropdown);
        this.populateDelivSelect(provisionOptions, provisionDropdown);
        this.populateDelivSelect(releaseOptions, releaseDropdown);

        // set default deliverable, if it exists
        for (const o of (defaultDeliverableDropdown as any).children) {
            if (o.value === this.course.defaultDeliverableId) {
                o.selected = true;
            }
        }

        UI.hideModal();
    }

    private populateDelivSelect(delivOptions: string[], dropdown: HTMLSelectElement) {
        delivOptions = delivOptions.sort();

        dropdown.innerHTML = '';
        for (const delivId of delivOptions) {
            let value = delivId;
            if (delivId.startsWith('--')) {
                // handle the null case
                value = null;
            }
            const o: HTMLOptionElement = new Option(delivId, value, false, false);
            dropdown.add(o);
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
        const url = this.remote + '/portal/admin/classlist';

        UI.showModal('Uploading classlist.');

        try {
            const formData = new FormData();
            formData.append('classlist', fileList[0]); // The CSV is fileList[0]

            const opts = {
                headers: {
                    // 'Content-Type': 'application/json', // violates CORS; leave commented out
                    user:  localStorage.user,
                    token: localStorage.token
                }
            };
            const response: Response = await Network.httpPostFile(url, opts, formData);
            if (response.status >= 200 && response.status < 300) {
                const data: Payload = await response.json();
                UI.hideModal();
                Log.info('AdminView::uploadClasslist(..) - RESPONSE: ' + JSON.stringify(data));
                UI.notification(data.success.message);
            } else {
                const reason = await response.json();
                UI.hideModal();
                if (typeof reason.failure && typeof reason.failure.message) {
                    UI.notification('There was an issue uploading your class list. ' +
                        'Please ensure the CSV file includes all required columns. <br/>Details: ' + reason.failure.message);
                } else {
                    UI.notification('There was an issue uploading your class list. ' +
                        'Please ensure the CSV file includes all required columns.');
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

        const url = this.remote + '/portal/admin/course';
        const options: any = AdminView.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(this.course);

        const response = await fetch(url, options);
        const body = await response.json();

        if (typeof body.success !== 'undefined') {
            UI.showErrorToast("Default deliverable saved successfully.");
        } else {
            UI.showAlert(body.failure.message);
        }
    }

    private async provisionDeliverablePressed(): Promise<void> {
        Log.trace('AdminView::provisionDeliverablePressed(..) - start');
        const start = Date.now();
        const delivDropdown = document.querySelector('#adminProvisionDeliverableSelect') as HTMLSelectElement;
        const value = delivDropdown.value;
        Log.trace('AdminView::provisionDeliverablePressed(..) - value: ' + value);

        if (value !== null && value !== 'null') {
            const url = this.remote + '/portal/admin/provision';
            const options: any = AdminView.getOptions();
            options.method = 'post';

            const provision: ProvisionTransport = {delivId: value, formSingle: false};
            options.body = JSON.stringify(provision); // TODO: handle formSingle correctly

            UI.showAlert("This is going to be a long-running operation;" +
                " you can monitor progress by watching your GitHub org for newly created repos " +
                "(and teams, although they will not be added to the repos until you release). " +
                "Please make sure this operation completes before you provision again or release these repos.");

            Log.trace('AdminView::provisionDeliverablePressed(..) - POSTing to: ' + url);
            const response = await fetch(url, options);

            if (response.status === 200 || response.status === 400) {
                const body = await response.json();
                if (typeof body.success !== 'undefined') {
                    Log.info("Repositories provisioned: " + JSON.stringify(body.success));
                    UI.showAlert("Repositories provisioned: " + body.success.length);
                } else {
                    if (typeof body.failure !== 'undefined') {
                        UI.showAlert(body.failure.message);
                    } else {
                        UI.showAlert(body);
                    }
                }
            } else {
                UI.showAlert("Unexpected problem encountered: " + response.statusText);
            }
        }
        Log.trace('AdminView::provisionDeliverablePressed(..) - done; took: ' + UI.took(start));
    }

    private async releaseDeliverablePressed(): Promise<void> {
        Log.trace('AdminView::releaseDeliverablePressed(..) - start');
        const start = Date.now();
        const delivDropdown = document.querySelector('#adminReleaseDeliverableSelect') as HTMLSelectElement;
        const value = delivDropdown.value;
        Log.trace('AdminView::releaseDeliverablePressed(..) - value: ' + value);

        if (value !== null && value !== 'null') {
            const url = this.remote + '/portal/admin/release';
            const options: any = AdminView.getOptions();
            options.method = 'post';

            UI.showAlert("This is going to be a long-running operation;" +
                " you can monitor progress by watching the teams in your GitHub org" +
                " as teams are added to repos. " +
                "Please make sure this operation completes before you release again or provision new repos.");

            const provision: ProvisionTransport = {delivId: value, formSingle: false};
            options.body = JSON.stringify(provision); // TODO: handle formSingle correctly

            Log.trace('AdminView::releaseDeliverablePressed(..) - POSTing to: ' + url);
            const response = await fetch(url, options);

            if (response.status === 200 || response.status === 400) {
                const body = await response.json();
                if (typeof body.success !== 'undefined') {
                    UI.showAlert("Repositories released: " + body.success.length);
                    Log.info("Repositories released: " + JSON.stringify(body.success));
                } else {
                    if (typeof body.failure !== 'undefined') {
                        UI.showAlert(body.failure.message);
                    } else {
                        UI.showAlert(body);
                    }
                }
            } else {
                Log.error("Unexpected problem: " + response.statusText);
                UI.showAlert("Unexpected problem: " + response.statusText);
            }
        }
        Log.trace('AdminView::releaseDeliverablePressed(..) - done; took: ' + UI.took(start));
    }

    public static async getCourse(remote: string): Promise<CourseTransport> {
        try {
            // UI.showModal('Retrieving config.');

            // get class options
            const options = AdminView.getOptions();
            const url = remote + '/portal/admin/course';
            const response = await fetch(url, options);
            // UI.hideModal();

            const courseOptions: CourseTransport = null;
            const start = Date.now();
            if (response.status === 200 || response.status === 400) {
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
        } catch (err) {
            AdminView.showError("Getting config failed: " + err.message);
        }
        return null;
    }

}
