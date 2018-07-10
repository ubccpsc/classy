import Log from "../../../../common/Log";

import {UI} from "../util/UI"
import {AdminView} from "./AdminView";
import {OnsButtonElement} from "onsenui";
import {Network} from "../util/Network";


export class AdminConfigTab {

    private remote: string; // url to backend
    private isAdmin: boolean;

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
            AdminView.showError(err);
        }

        Log.trace('AdminView::uploadClasslist(..) - end');
    }


}