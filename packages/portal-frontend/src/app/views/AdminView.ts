/**
 * This is the main student page for the SDDM.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import Log from "../../../../common/Log";
import {IView} from "./IView";

export class AdminView implements IView {

    private remote: string = null;

    constructor(remoteUrl: string) {
        Log.info("AdminView::<init>");
        this.remote = remoteUrl;
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
    public renderPage(opts: {}) {
        Log.info('AdminView::renderPage() - start; options: ' + opts);

        // this.checkStatus();
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

    private getOptions() {
        const options = {
            headers: {
                'Content-Type': 'application/json',
                'user':         localStorage.user,
                'token':        localStorage.token,
                'org':          localStorage.org
            }
        };
        return options;
    }
    */
}
