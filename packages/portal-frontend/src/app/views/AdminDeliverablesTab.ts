import Log from "../../../../common/Log";

import {UI} from "../util/UI"

import {DeliverableTransport, DeliverableTransportPayload} from "../../../../common/types/PortalTypes";
import {AdminView} from "./AdminView";
import {OnsFabElement} from "onsenui";

// import flatpickr from "flatpickr";
declare var flatpickr: any;

export class AdminDeliverablesTab {

    private remote: string; // url to backend
    private isAdmin: boolean;

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
        UI.showModal('Retrieving deliverables');
        const start = Date.now();

        const fab = document.querySelector('#adminAddDeliverable') as OnsFabElement;
        if (this.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            fab.onclick = function (evt: any) {
                Log.info('AdminDeliverablesTab::init(..)::addDeliverable::onClick');
                UI.pushPage('editDeliverable.html', {delivId: null});
            };
        }

        const options = AdminView.getOptions();
        const url = this.remote + '/admin/deliverables';
        const response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('AdminDeliverablesTab::init(..) - 200 received');
            const json: DeliverableTransportPayload = await response.json();
            // Log.trace('AdminView::handleAdminDeliverables(..)  - payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminDeliverablesTab::init(..)  - worked; took: ' + UI.took(start));

                this.render(json.success);
            } else {
                Log.trace('AdminDeliverablesTab::init(..)  - ERROR: ' + json.failure.message);
                AdminView.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminDeliverablesTab::init(..)  - !200 received: ' + response.status);
            const text = await response.text();
            AdminView.showError(text);
        }
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

    public async initEditDeliverablePage(opts: any): Promise<void> {
        Log.warn('AdminView::initEditDeliverablePage( ' + JSON.stringify(opts) + ' ) - NOT IMPLEMENTED');
        const start = Date.now();
        const delivId = opts.delivId;

        UI.showModal('Retrieving ' + delivId + ' details'); // NOTE: not working on this screen

        const options = AdminView.getOptions();
        const url = this.remote + '/admin/deliverables';
        const response = await fetch(url, options);

        UI.hideModal();
        if (response.status === 200) {
            Log.trace('AdminDeliverablesTab::initEditDeliverablePage(..) - 200 received');
            const json: DeliverableTransportPayload = await response.json();
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                Log.trace('AdminDeliverablesTab::initEditDeliverablePage(..)  - worked; took: ' + UI.took(start));

                for (const deliv of json.success) {
                    if (deliv.id === delivId) {
                        this.renderEditDeliverablePage(deliv);
                        return;
                    }
                }
                Log.error('AdminDeliverablesTab::initEditDeliverablePage(..)  - delivId not found: ' + delivId);
            } else {
                Log.trace('AdminDeliverablesTab::initEditDeliverablePage(..)  - ERROR: ' + json.failure.message);
                AdminView.showError(json.failure); // FailurePayload
            }
        } else {
            Log.trace('AdminDeliverablesTab::initEditDeliverablePage(..)  - !200 received: ' + response.status);
            const text = await response.text();
            AdminView.showError(text);
        }
    }

    public renderEditDeliverablePage(deliv: DeliverableTransport) {
        Log.warn('AdminView::renderEditDeliverablePage( ' + JSON.stringify(deliv) + ' ) - NOT IMPLEMENTED');
        const that = this;

        const fab = document.querySelector('#adminEditDeliverableSave') as OnsFabElement;
        if (this.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            fab.onclick = function (evt) {
                Log.info('AdminView::renderEditDeliverablePage(..)::addDeliverable::onClick');
                AdminView.showError('not implemented');
            };
        }

        this.setTextField('adminEditDeliverablePage-name', deliv.id, false);
        this.setTextField('adminEditDeliverablePage-url', deliv.URL, this.isAdmin);

        const flatpickrOptions = {
            enableTime:  true,
            time_24hr:   true,
            utc:         true,
            dateFormat:  "Y/m/d @ H:i",
            defaultDate: new Date()
        };

        flatpickrOptions.defaultDate = new Date(deliv.openTimestamp);
        flatpickr("#adminEditDeliverablePage-open", flatpickrOptions);
        flatpickrOptions.defaultDate = new Date(deliv.closeTimestamp);
        flatpickr("#adminEditDeliverablePage-close", flatpickrOptions);

        this.setDropdown('adminEditDeliverablePage-minTeamSize', deliv.minTeamSize, this.isAdmin);
        this.setDropdown('adminEditDeliverablePage-maxTeamSize', deliv.maxTeamSize, this.isAdmin);
        this.setToggle('adminEditDeliverablePage-inSameLab', deliv.teamsSameLab, this.isAdmin);
        this.setToggle('adminEditDeliverablePage-studentsMakeTeams', deliv.studentsFormTeams, this.isAdmin);

        this.setToggle('adminEditDeliverablePage-gradesReleased', deliv.gradesReleased, this.isAdmin);

        this.setTextField('adminEditDeliverablePage-atDockerName', deliv.autoTest.dockerImage, this.isAdmin);
        this.setTextField('adminEditDeliverablePage-atContainerTimeout', deliv.autoTest.maxExecTime+'', this.isAdmin);
        this.setTextField('adminEditDeliverablePage-atStudentDelay', deliv.autoTest.studentDelay+'', this.isAdmin);
        this.setTextField('adminEditDeliverablePage-atRegressionIds', deliv.autoTest.regressionDelivIds.toString(), this.isAdmin);
        this.setTextField('adminEditDeliverablePage-atCustom', JSON.stringify(deliv.autoTest.custom), this.isAdmin);

        this.setTextField('adminEditDeliverablePage-custom', JSON.stringify(deliv.custom), this.isAdmin);
    }

    private setDropdown(fieldName: string, value: string | number, editable: boolean) {
        const field = document.querySelector('#' + fieldName) as HTMLSelectElement;
        if (field !== null) {
            for (let i = 0; i < field.length; i++) {
                const opt = field.options[i];
                if (opt.value == value) { // use == so string and number values match
                    field.selectedIndex = i;
                }
            }

            if (editable === false) {
                field.setAttribute('readonly', '');
            }
        } else {
            Log.error('AdminDeliverablesTab::setDropdown( ' + fieldName + ', ... ) - element does not exist')
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
            Log.error('AdminDeliverablesTab::setTextField( ' + fieldName + ', ... ) - element does not exist')
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
            Log.error('AdminDeliverablesTab::setToggle( ' + fieldName + ', ... ) - element does not exist')
        }
    }
}