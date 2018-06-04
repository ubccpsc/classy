/**
 * This is the main student page for the SDDM.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsModalElement} from "onsenui";

import Log from "../../../../../common/Log";

import {UI} from "../../util/UI";
import {IView} from "../IView";

export class CS310View implements IView {

    private remote: string = null;

    constructor(remoteUrl: string) {
        Log.info("CS310View::<init>");
        this.remote = remoteUrl;
    }

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
        const msg = "Updating status";
        // UI.showModal(msg);

        const url = this.remote + '/currentStatus';
        this.fetchStatus(url);
    }

    public renderPage() {
        Log.info('CS310View::renderPage() - start');

        this.checkStatus();
    }

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
    }

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


    public showError(failure: any) { // FailurePayload
        Log.error("CS310View::showError(..) - failure: " + JSON.stringify(failure));
        if (typeof failure === 'string') {
            UI.showAlert(failure);
        } else if (typeof failure.failure !== 'undefined') {
            UI.showAlert(failure.failure.message);
        } else {
            Log.error("Unknown message: " + JSON.stringify(failure));
            UI.showAlert("Action unsuccessful.");
        }
    }

    /*
    if (data.status !== 200 && data.status !== 405 && data.status !== 401) {
        console.log('Network::handleRemote() WARNING: Repsonse status: ' + data.status);
        throw new Error('Network::handleRemote() - API ERROR: ' + data.status);
    } else if (data.status !== 200 && data.status === 405 || data.status === 401) {
        console.error('Network::getRemotePost() Permission denied for your userrole.');
        alert('You are not authorized to access this endpoint. Please re-login.');
        // location.reload();
    } else {
        console.log('Network::handleRemote() 200 return');
        data.json().then(function (json: any) {
            // view.render(json); // calls render instead of the function
            console.log('Network::handleRemote() this is the data: ' + JSON.stringify(json));

        });
    }
    */

    private getOptions() {
        const options = {
            headers: {
                user:  localStorage.user,
                token: localStorage.token,
                org:   localStorage.org
            }
        };
        return options;
    }
}
