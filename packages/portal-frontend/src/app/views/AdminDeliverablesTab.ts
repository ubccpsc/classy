import Log from "../../../../common/Log";

import {UI} from "../util/UI"

import {DeliverableTransport, DeliverableTransportPayload} from "../../../../common/types/PortalTypes";
import {AdminView} from "./AdminView";
import {OnsFabElement} from "onsenui";


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


    private handleAdminEditDeliverablePage(opts: any) {
        Log.warn('AdminView::handleadminEditDeliverablePage( ' + JSON.stringify(opts) + ' ) - NOT IMPLEMENTED');
        const that = this;

        const fab = document.querySelector('#adminEditDeliverableSave') as OnsFabElement;
        if (this.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            fab.onclick = function (evt) {
                Log.info('AdminView::handleadminEditDeliverablePage(..)::addDeliverable::onClick');
                AdminView.showError('not implemented');
            };
        }
    }


}