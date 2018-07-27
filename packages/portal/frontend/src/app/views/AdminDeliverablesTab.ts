import Log from "../../../../../common/Log";

import {UI} from "../util/UI"

import {DeliverableTransport, DeliverableTransportPayload} from "../../../../../common/types/PortalTypes";
import {AdminView} from "./AdminView";
import {OnsFabElement} from "onsenui";
import {AutoTestConfig} from "../../../../backend/src/Types";

// import flatpickr from "flatpickr";
declare var flatpickr: any;

export class AdminDeliverablesTab {

    private remote: string; // url to backend
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

        const fab = document.querySelector('#adminAddDeliverable') as OnsFabElement;
        if (this.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            fab.onclick = function (evt: any) {
                Log.info('AdminDeliverablesTab::init(..)::addDeliverable::onClick');
                UI.pushPage('editDeliverable.html', {delivId: null});
            };
        }

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
        Log.warn('AdminView::initEditDeliverablePage( ' + JSON.stringify(opts) + ' ) - start');
        const start = Date.now();
        const delivId = opts.delivId;

        if (delivId === null) {
            // create deliverable, not edit
            this.renderEditDeliverablePage(null);

        } else {
            // UI.showModal('Retrieving ' + delivId + ' details'); // NOTE: not working on this screen
            //
            // const options = AdminView.getOptions();
            // const url = this.remote + '/portal/admin/deliverables';
            // const response = await fetch(url, options);
            //
            // UI.hideModal();
            // if (response.status === 200) {
            //     Log.trace('AdminDeliverablesTab::initEditDeliverablePage(..) - 200 received');
            //     const json: DeliverableTransportPayload = await response.json();
            //     if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
            //         Log.trace('AdminDeliverablesTab::initEditDeliverablePage(..)  - worked; took: ' + UI.took(start));
            //
            //         for (const deliv of json.success) {
            //             if (deliv.id === delivId) {
            //                 this.renderEditDeliverablePage(deliv);
            //                 return;
            //             }
            //         }
            //         Log.error('AdminDeliverablesTab::initEditDeliverablePage(..)  - delivId not found: ' + delivId);
            //     } else {
            //         Log.trace('AdminDeliverablesTab::initEditDeliverablePage(..)  - ERROR: ' + json.failure.message);
            //         AdminView.showError(json.failure); // FailurePayload
            //     }
            // } else {
            //     Log.trace('AdminDeliverablesTab::initEditDeliverablePage(..)  - !200 received: ' + response.status);
            //     const text = await response.text();
            //     AdminView.showError(text);
            // }
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
        Log.warn('AdminView::renderEditDeliverablePage( ' + JSON.stringify(deliv) + ' ) - start');
        const that = this;

        // TODO: handle when deliv is null (aka the deliverable is new)

        const fab = document.querySelector('#adminEditDeliverableSave') as OnsFabElement;
        if (this.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            fab.onclick = function (evt) {
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

            this.setDropdown('adminEditDeliverablePage-minTeamSize', 1, this.isAdmin);
            this.setDropdown('adminEditDeliverablePage-maxTeamSize', 1, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-inSameLab', true, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-studentsMakeTeams', false, this.isAdmin);

            this.setToggle('adminEditDeliverablePage-gradesReleased', false, this.isAdmin);

            this.setTextField('adminEditDeliverablePage-atContainerTimeout', '300', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atStudentDelay', (12 * 60 * 60) + '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atCustom', '{}', this.isAdmin);

            this.setTextField('adminEditDeliverablePage-custom', '{}', this.isAdmin);
        } else {
            // edit existing deliverable

            this.setTextField('adminEditDeliverablePage-name', deliv.id, false);
            this.setTextField('adminEditDeliverablePage-url', deliv.URL, this.isAdmin);

            flatpickrOptions.defaultDate = new Date(deliv.openTimestamp);
            this.openPicker = flatpickr("#adminEditDeliverablePage-open", flatpickrOptions);
            flatpickrOptions.defaultDate = new Date(deliv.closeTimestamp);
            this.closePicker = flatpickr("#adminEditDeliverablePage-close", flatpickrOptions);

            this.setDropdown('adminEditDeliverablePage-minTeamSize', deliv.minTeamSize, this.isAdmin);
            this.setDropdown('adminEditDeliverablePage-maxTeamSize', deliv.maxTeamSize, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-inSameLab', deliv.teamsSameLab, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-studentsMakeTeams', deliv.studentsFormTeams, this.isAdmin);

            this.setToggle('adminEditDeliverablePage-gradesReleased', deliv.gradesReleased, this.isAdmin);

            this.setTextField('adminEditDeliverablePage-atDockerName', deliv.autoTest.dockerImage, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atContainerTimeout', deliv.autoTest.maxExecTime + '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atStudentDelay', deliv.autoTest.studentDelay + '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atRegressionIds', deliv.autoTest.regressionDelivIds.toString(), this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atCustom', JSON.stringify(deliv.autoTest.custom), this.isAdmin);

            this.setTextField('adminEditDeliverablePage-custom', JSON.stringify(deliv.custom), this.isAdmin);
        }
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

    private async save(): Promise<void> {
        Log.info("AdminDeliverablesTab::save() - start");

        const id = this.getTextField('adminEditDeliverablePage-name');
        const URL = this.getTextField('adminEditDeliverablePage-url');

        const openTimestamp = this.openPicker.latestSelectedDateObj.getTime();
        const closeTimestamp = this.closePicker.latestSelectedDateObj.getTime();

        const minTeamSize = Number(this.getDropdown('adminEditDeliverablePage-minTeamSize'));
        const maxTeamSize = Number(this.getDropdown('adminEditDeliverablePage-maxTeamSize'));
        const teamsSameLab = this.getToggle('adminEditDeliverablePage-inSameLab');
        const studentsFormTeams = this.getToggle('adminEditDeliverablePage-studentsMakeTeams');

        const gradesReleased = this.getToggle('adminEditDeliverablePage-gradesReleased');

        const dockerImage = this.getTextField('adminEditDeliverablePage-atDockerName');
        const maxExecTime = Number(this.getTextField('adminEditDeliverablePage-atContainerTimeout'));
        const studentDelay = Number(this.getTextField('adminEditDeliverablePage-atStudentDelay'));

        const atRegression = this.getTextField('adminEditDeliverablePage-atRegressionIds');
        const regressionDelivIds: string[] = [];
        if (atRegression.length > 0) {
            const parts = atRegression.split(',');
            for (const p of parts) {
                regressionDelivIds.push(p);
            }
        }

        let atCustomRaw = this.getTextField('adminEditDeliverablePage-atCustom');
        let atCustom: any = {};
        if (atCustomRaw.length > 0) {
            Log.trace("AdminDeliverablesTab::save() - atCustomRaw: " + atCustomRaw);
            // https://stackoverflow.com/a/34763398 (handle unquoted props (e.g., {foo: false}))
            atCustomRaw = atCustomRaw.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
            atCustom = JSON.parse(atCustomRaw);
        }

        let customRaw = this.getTextField('adminEditDeliverablePage-custom');
        let custom: any = {};
        if (customRaw.length > 0) {
            Log.trace("AdminDeliverablesTab::save() - customRaw: " + customRaw);
            // https://stackoverflow.com/a/34763398 (handle unquoted props (e.g., {foo: false}))
            customRaw = customRaw.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
            custom = JSON.parse(customRaw);
        }

        let at: AutoTestConfig = {
            dockerImage,
            maxExecTime,
            studentDelay,
            regressionDelivIds,
            custom: atCustom,
        };

        let deliv: DeliverableTransport = {
            id,
            URL,
            openTimestamp,
            closeTimestamp,
            onOpenAction:  '',// TODO: add this
            onCloseAction: '', // TODO: add this
            minTeamSize,
            maxTeamSize,
            studentsFormTeams,
            teamsSameLab,
            gradesReleased,
            autoTest:      at,
            custom
        };

        Log.trace("AdminDeliverablesTab::save() - result: " + JSON.stringify(deliv));

        const url = this.remote + '/portal/admin/deliverable';
        let options: any = AdminView.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(deliv);

        let response = await fetch(url, options);
        let body = await response.json();

        if (typeof body.success !== 'undefined') {
            // worked
            UI.showErrorToast("Deliverable saved successfully.");
            UI.popPage();
        } else {
            UI.showAlert(body.failure.message);
        }
    }

    private getTextField(fieldName: string): string {
        const field = document.querySelector('#' + fieldName) as HTMLTextAreaElement;
        if (field !== null) {
            return field.value;
        } else {
            Log.error('AdminDeliverablesTab::getTextField( ' + fieldName + ' ) - element does not exist')
        }
    }

    private getDropdown(fieldName: string): string {
        const field = document.querySelector('#' + fieldName) as HTMLSelectElement;
        if (field !== null) {
            return field.options[field.selectedIndex].value;
        } else {
            Log.error('AdminDeliverablesTab::getDropdown( ' + fieldName + ' ) - element does not exist')
        }
    }

    private getToggle(fieldName: string): boolean {
        const field = document.querySelector('#' + fieldName) as HTMLInputElement;
        if (field !== null) {
            return field.checked;
        } else {
            Log.error('AdminDeliverablesTab::getToggle( ' + fieldName + ' ) - element does not exist')
        }
    }

    public static async getDeliverables(remote: string): Promise<DeliverableTransport[]> {
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

        return [];
    }
}
