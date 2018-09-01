import {OnsFabElement} from "onsenui";
import Log from "../../../../../common/Log";
import {AutoTestConfig} from "../../../../../common/types/AutoTestTypes";

import {DeliverableTransport, DeliverableTransportPayload} from "../../../../../common/types/PortalTypes";

import {UI} from "../util/UI";
import {AdminView} from "./AdminView";

// import flatpickr from "flatpickr";
declare var flatpickr: any;

/**
 *
 * This isn't a tab on its own anymore. It has been absorbed within AdminConfigTab
 * but the code here is more clearly organized so we've left it here for the time
 * being until more explicit tab sub-helpers are actually a thing.
 *
 */
export class AdminDeliverablesTab {

    private readonly remote: string; // url to backend
    private isAdmin: boolean;
    private openPicker: any; // flatpickr;
    private closePicker: any; // flatpickr;

    constructor(remote: string, isAdmin: boolean) {
        this.remote = remote;
        this.isAdmin = isAdmin;
    }

    public setAdmin(isAdmin: boolean) {
        Log.info('AdminDeliverablesTab::isAdmin( ' + isAdmin + ' )');
        this.isAdmin = isAdmin;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminDeliverablesTab::init(..) - start');

        // const fab = document.querySelector('#adminAddDeliverable') as OnsFabElement;
        // if (this.isAdmin === false) {
        //     fab.style.display = 'none';
        // } else {
        //     fab.onclick = function(evt: any) {
        //         Log.info('AdminDeliverablesTab::init(..)::addDeliverable::onClick');
        //         UI.pushPage('editDeliverable.html', {delivId: null});
        //     };
        // }

        UI.showModal('Retrieving deliverables.');
        const delivs = await AdminDeliverablesTab.getDeliverables(this.remote);
        this.render(delivs);
        UI.hideModal();
    }

    private render(deliverables: DeliverableTransport[]) {
        Log.info("AdminDeliverablesTab::render(..) - start");
        const deliverableList = document.querySelector('#adminDeliverablesList') as HTMLElement;

        // FlatPicker.setFlatPickerField(deliverable.open, OPEN_DELIV_KEY);
        // FlatPicker.setFlatPickerField(deliverable.close, CLOSE_DELIV_KEY);

        deliverableList.innerHTML = '';
        deliverableList.appendChild(UI.createListHeader('Deliverables'));

        for (const deliv of deliverables) {
            const main = 'Deliverable: ' + deliv.id;
            const sub = 'Opens: ' + new Date(deliv.openTimestamp).toLocaleString() +
                '; Closes: ' + new Date(deliv.closeTimestamp).toLocaleString();

            let editable = false;
            if (this.isAdmin === true) {
                editable = true;
            }

            const elem = UI.createListItem(main, sub, editable);
            elem.setAttribute('delivId', deliv.id);
            elem.onclick = function(evt: any) {
                const delivId = evt.currentTarget.getAttribute('delivId');
                UI.pushPage('editDeliverable.html', {delivId: delivId});
            };
            deliverableList.appendChild(elem);
        }

        if (deliverables.length === 0) {
            deliverableList.appendChild(UI.createListItem('Deliverables not yet specified.'));
        }

        const createDeliverable = document.createElement('ons-button');
        createDeliverable.setAttribute('modifier', 'large');
        createDeliverable.innerText = 'Create New Deliverable';

        createDeliverable.onclick = function() {
            UI.pushPage('editDeliverable.html', {delivId: null});
        };

        const li = document.createElement('ons-list-item');
        li.appendChild(createDeliverable);

        deliverableList.appendChild(li);
    }

    public async initEditDeliverablePage(opts: any): Promise<void> {
        Log.info('AdminView::initEditDeliverablePage( ' + JSON.stringify(opts) + ' ) - start');
        const start = Date.now();
        const delivId = opts.delivId;

        if (delivId === null) {
            // create deliverable, not edit
            this.renderEditDeliverablePage(null);
        } else {
            const deliverables = await AdminDeliverablesTab.getDeliverables(this.remote);
            for (const deliv of deliverables) {
                if (deliv.id === delivId) {
                    this.renderEditDeliverablePage(deliv);
                    return;
                }
            }
        }
    }

    public renderEditDeliverablePage(deliv: DeliverableTransport) {
        Log.info('AdminView::renderEditDeliverablePage( ' + JSON.stringify(deliv) + ' ) - start');
        const that = this;

        // TODO: handle when deliv is null (aka the deliverable is new)

        const fab = document.querySelector('#adminEditDeliverableSave') as OnsFabElement;
        if (this.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            fab.onclick = function(evt) {
                Log.info('AdminView::renderEditDeliverablePage(..)::adminEditDeliverableSave::onClick');
                that.save();
            };
        }

        const flatpickrOptions = {
            enableTime:  true,
            time_24hr:   true,
            utc:         true,
            dateFormat:  "Y/m/d @ H:i",
            defaultDate: new Date()
        };

        if (deliv === null) {
            // new deliverable, set defaults

            flatpickrOptions.defaultDate = new Date();
            this.openPicker = flatpickr("#adminEditDeliverablePage-open", flatpickrOptions);
            flatpickrOptions.defaultDate = new Date();
            this.closePicker = flatpickr("#adminEditDeliverablePage-close", flatpickrOptions);

            UI.setDropdownSelected('adminEditDeliverablePage-minTeamSize', 1, this.isAdmin);
            UI.setDropdownSelected('adminEditDeliverablePage-maxTeamSize', 1, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-inSameLab', true, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-studentsMakeTeams', false, this.isAdmin);

            this.setToggle('adminEditDeliverablePage-gradesReleased', false, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-visible', false, this.isAdmin);

            this.setTextField('adminEditDeliverablePage-atContainerTimeout', '300', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atStudentDelay', (12 * 60 * 60) + '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atCustom', '{}', this.isAdmin);

            this.setTextField('adminEditDeliverablePage-repoPrefix', '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-teamPrefix', '', this.isAdmin);

            this.setTextField('adminEditDeliverablePage-rubric', '{}', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-custom', '{}', this.isAdmin);
        } else {
            // edit existing deliverable

            this.setTextField('adminEditDeliverablePage-name', deliv.id, false);
            this.setTextField('adminEditDeliverablePage-url', deliv.URL, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-repoPrefix', deliv.repoPrefix, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-teamPrefix', deliv.teamPrefix, this.isAdmin);

            flatpickrOptions.defaultDate = new Date(deliv.openTimestamp);
            this.openPicker = flatpickr("#adminEditDeliverablePage-open", flatpickrOptions);
            flatpickrOptions.defaultDate = new Date(deliv.closeTimestamp);
            this.closePicker = flatpickr("#adminEditDeliverablePage-close", flatpickrOptions);

            UI.setDropdownSelected('adminEditDeliverablePage-minTeamSize', deliv.minTeamSize, this.isAdmin);
            UI.setDropdownSelected('adminEditDeliverablePage-maxTeamSize', deliv.maxTeamSize, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-inSameLab', deliv.teamsSameLab, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-studentsMakeTeams', deliv.studentsFormTeams, this.isAdmin);

            this.setToggle('adminEditDeliverablePage-gradesReleased', deliv.gradesReleased, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-visible', deliv.visibleToStudents, this.isAdmin);

            this.setTextField('adminEditDeliverablePage-atDockerName', deliv.autoTest.dockerImage, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atContainerTimeout', deliv.autoTest.maxExecTime + '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atStudentDelay', deliv.autoTest.studentDelay + '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atRegressionIds', deliv.autoTest.regressionDelivIds.toString(), this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atCustom', JSON.stringify(deliv.autoTest.custom), this.isAdmin);

            this.setTextField('adminEditDeliverablePage-rubric', JSON.stringify(deliv.rubric), this.isAdmin);
            this.setTextField('adminEditDeliverablePage-custom', JSON.stringify(deliv.custom), this.isAdmin);
        }
    }

    private setTextField(fieldName: string, textValue: string, editable: boolean) {
        const field = document.querySelector('#' + fieldName) as HTMLTextAreaElement;
        if (field !== null) {
            field.value = textValue;
            if (editable === false) {
                field.setAttribute('readonly', '');
            }
        } else {
            Log.error('AdminDeliverablesTab::setTextField( ' + fieldName + ', ... ) - element does not exist');
        }
    }

    private setToggle(fieldName: string, value: boolean, editable: boolean) {
        const field = document.querySelector('#' + fieldName) as HTMLInputElement;
        if (field !== null) {
            field.checked = value;
            if (editable === false) {
                field.setAttribute('readonly', '');
            }
        } else {
            Log.error('AdminDeliverablesTab::setToggle( ' + fieldName + ', ... ) - element does not exist');
        }
    }

    private async save(): Promise<void> {
        Log.info("AdminDeliverablesTab::save() - start");

        const id = UI.getTextFieldValue('adminEditDeliverablePage-name');
        const URL = UI.getTextFieldValue('adminEditDeliverablePage-url');

        const openTimestamp = this.openPicker.latestSelectedDateObj.getTime();
        const closeTimestamp = this.closePicker.latestSelectedDateObj.getTime();

        const shouldProvision = UI.getToggleValue('adminEditDeliverablePage-shouldProvision');
        const importURL = UI.getTextFieldValue('adminEditDeliverablePage-importURL');
        const minTeamSize = Number(UI.getDropdownValue('adminEditDeliverablePage-minTeamSize'));
        const maxTeamSize = Number(UI.getDropdownValue('adminEditDeliverablePage-maxTeamSize'));
        const teamsSameLab = UI.getToggleValue('adminEditDeliverablePage-inSameLab');
        const studentsFormTeams = UI.getToggleValue('adminEditDeliverablePage-studentsMakeTeams');

        const gradesReleased = UI.getToggleValue('adminEditDeliverablePage-gradesReleased');
        const visibleToStudents = UI.getToggleValue('adminEditDeliverablePage-visible');

        const shouldAutoTest = UI.getToggleValue('adminEditDeliverablePage-shouldAutoTest');
        const dockerImage = UI.getTextFieldValue('adminEditDeliverablePage-atDockerName');
        const maxExecTime = Number(UI.getTextFieldValue('adminEditDeliverablePage-atContainerTimeout'));
        const studentDelay = Number(UI.getTextFieldValue('adminEditDeliverablePage-atStudentDelay'));

        const repoPrefix = UI.getTextFieldValue('adminEditDeliverablePage-repoPrefix');
        const teamPrefix = UI.getTextFieldValue('adminEditDeliverablePage-teamPrefix');

        const atRegression = UI.getTextFieldValue('adminEditDeliverablePage-atRegressionIds');
        const regressionDelivIds: string[] = [];
        if (atRegression.length > 0) {
            const parts = atRegression.split(',');
            for (const p of parts) {
                regressionDelivIds.push(p);
            }
        }

        let atCustomRaw = UI.getTextFieldValue('adminEditDeliverablePage-atCustom');
        let atCustom: any = {};
        if (atCustomRaw.length > 0) {
            Log.trace("AdminDeliverablesTab::save() - atCustomRaw: " + atCustomRaw);
            // https://stackoverflow.com/a/34763398 (handle unquoted props (e.g., {foo: false}))
            atCustomRaw = atCustomRaw.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
            try {
                atCustom = JSON.parse(atCustomRaw);
            } catch (err) {
                UI.showError("AutoTest Custom field is not valid JSON: " + err.message);
                throw new Error("Cancel back"); // hack: prevents page transition from proceeding
            }

        }

        const customRaw = UI.getTextFieldValue('adminEditDeliverablePage-custom');
        let custom: any = {};
        if (customRaw.length > 0) {
            Log.trace("AdminDeliverablesTab::save() - customRaw: " + customRaw);
            // https://stackoverflow.com/a/34763398 (handle unquoted props (e.g., {foo: false}))
            // customRaw = customRaw.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
            try {
                custom = JSON.parse(customRaw);
            } catch (err) {
                UI.showError("Custom field is not valid JSON: " + err.message);
                throw new Error("Cancel back"); // hack: prevents page transition from proceeding
            }
        }

        const rubricRaw = UI.getTextFieldValue('adminEditDeliverablePage-rubric');
        let rubric: any = {};
        if (rubricRaw.length > 0) {
            Log.trace("AdminDeliverablesTab::save() - customRaw: " + customRaw);
            // https://stackoverflow.com/a/34763398 (handle unquoted props (e.g., {foo: false}))
            // customRaw = customRaw.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
            try {
                rubric = JSON.parse(rubricRaw);
            } catch (err) {
                UI.showError("Rubric field is not valid JSON: " + err.message);
                throw new Error("Cancel back"); // hack: prevents page transition from proceeding
            }
        }

        const at: AutoTestConfig = {
            dockerImage,
            maxExecTime,
            studentDelay,
            regressionDelivIds,
            custom: atCustom
        };

        const deliv: DeliverableTransport = {
            id,
            URL,
            visibleToStudents,
            openTimestamp,
            closeTimestamp,
            onOpenAction:  '', // TODO: add this
            onCloseAction: '', // TODO: add this
            shouldAutoTest,
            importURL,
            minTeamSize,
            maxTeamSize,
            studentsFormTeams,
            teamsSameLab,
            gradesReleased,
            shouldProvision,
            autoTest:      at,
            repoPrefix,
            teamPrefix,
            rubric,
            custom
        };

        Log.trace("AdminDeliverablesTab::save() - result: " + JSON.stringify(deliv));

        const url = this.remote + '/portal/admin/deliverable';
        const options: any = AdminView.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(deliv);

        const response = await fetch(url, options);
        const body = await response.json();

        if (typeof body.success !== 'undefined') {
            // worked
            UI.showErrorToast("Deliverable saved successfully.");
            UI.popPage();
        } else {
            UI.showAlert(body.failure.message);
        }
    }

    public static async getDeliverables(remote: string): Promise<DeliverableTransport[]> {
        try {
            Log.info("AdminDeliverablesTab::getDeliverables( .. ) - start");
            const start = Date.now();

            const options = AdminView.getOptions();
            const url = remote + '/portal/admin/deliverables';
            const response = await fetch(url, options);

            if (response.status === 200) {
                Log.trace('AdminDeliverablesTab::getDeliverables(..) - 200 received');
                const json: DeliverableTransportPayload = await response.json();
                // Log.trace('AdminView::getDeliverables(..)  - payload: ' + JSON.stringify(json));
                if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                    Log.trace('AdminDeliverablesTab::getDeliverables(..)  - worked; took: ' + UI.took(start));
                    return (json.success);
                } else {
                    Log.trace('AdminDeliverablesTab::getDeliverables(..)  - ERROR: ' + json.failure.message);
                    AdminView.showError(json.failure); // FailurePayload
                }
            } else {
                Log.trace('AdminDeliverablesTab::getDeliverables(..)  - !200 received: ' + response.status);
                const text = await response.text();
                AdminView.showError(text);
            }
        } catch (err) {
            AdminView.showError("Getting deliverables failed: " + err.message);
        }
        return [];
    }
}
