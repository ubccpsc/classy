import Log from "./util/Log";
import {OnsModalElement} from "onsenui";
import {UI} from "./util/UI";
import {App} from "./App";

declare const myApp: App;

// copied from sddm-portal-backend

export interface Payload {
    success?: ActionPayload | StatusPayload; // only set if defined
    failure?: FailurePayload; // only set if defined
}

export interface FailurePayload {
    message: string;
    shouldLogout: boolean; // almost always false
}

export interface ActionPayload {
    message: string;
    status: StatusPayload; // if an action was successful we should send the current status
}

export interface StatusPayload {
    status: string;
    d0: GradePayload | null;
    d1: GradePayload | null;
    d2: GradePayload | null;
    d3: GradePayload | null;
}

export interface GradePayload {
    score: number; // grade: < 0 will mean 'N/A' in the UI
    url: string; // commit URL if known, otherwise repo url
    timestamp: number; // even if grade < 0 might as well return when the entry was made
}

export class SDMMSummaryView {

    private remote: string = null;

    constructor(remoteUrl: string) {
        Log.info("SDMMSummaryView::<init>");
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
            that.updateState();
        }, (duration - 500));

    }

    public checkStatus() {
        const msg = "Updating status";
        // UI.showModal(msg);

        const url = this.remote + '/currentStatus';
        this.fetchStatus(url);
    }

    public async createD0Repository(): Promise<void> {
        const msg = 'Creating D0 Repository<br/>This will take < 60 seconds';

        this.showModal("Provisioning D0 Repository.<br/>This can take up to 5 minutes.<br/>This dialog will clear as soon as the operation is complete.")
        const url = this.remote + '/performAction/provisionD0';
        Log.info('SDDM::createD0Repository( ' + url + ' ) - start');

        let options: any = this.getOptions();
        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('SDDM::createD0Repository(..) - 200 received');
            let json = await response.json();

            if (json.success === true) {
                this.longAction(2000, "D0 Repository created");
            } else {
                this.longAction(5000, "Error encountered:<br/>" + json.message);
            }

            // TODO: refresh
            this.checkStatus();
        } else {
            Log.trace('SDDM::createD0Repository(..) - !200 received');
        }
        return;
    }

    public createD1Repository() {
        Log.info("SDMMSummaryView::createD1Repository() - start");
        this.longAction(5000, 'Creating D1 Repository<br/>Will take < 10 seconds');
    }

    public async createD1Individual(): Promise<void> {
        Log.info("SDMMSummaryView::createD1Individual() - start");

        const url = this.remote + '/performAction/provisionD1individual';
        Log.info('SDDM::createD1Individual( ' + url + ' ) - start');

        let options: any = this.getOptions();
        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('SDDM::createD1Individual(..) - 200 received');
            let json = await response.json();
            if (typeof json.success !== 'undefined') {
                this.longAction(2000, "D1 Repository created");
            } else {
                this.showError(json);
            }

            // TODO: refresh
            this.checkStatus();
        } else {
            Log.trace('SDDM::createD1Individual(..) - !200 received');
        }
        return;

    }

    public async createD1Team(): Promise<void> {
        Log.info("SDMMSummaryView::createD1Team() - start");
        // this.longAction(5000, 'Configuring D1 Team<br/>Will take < 10 seconds');

        const url = this.remote + '/performAction/provisionD1team';
        // TODO: actually provide team members!!!
        Log.info('SDDM::createD1Team( ' + url + ' ) - start');

        let options: any = this.getOptions();
        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('SDDM::createD1Team(..) - 200 received');
            let json = await response.json();
            if (typeof json.success !== 'undefined') {
                this.longAction(2000, "D1 Repository created");
            } else {
                this.showError(json);
            }

            // TODO: refresh
            this.checkStatus();
        } else {
            Log.trace('SDDM::createD1Team(..) - !200 received');
        }
        return;
    }

    public createD3PullRequest() {
        Log.info("SDMMSummaryView::createD3PullRequest() - start");
        this.longAction(5000, 'Creating D3 Pull Request<br/>Will take < 10 seconds');
    }

    private updateState(status?: any) { // status is SuccessPayload
        const elem = <HTMLSelectElement>document.getElementById('sdmmSelect');

        let value = null;
        if (typeof status === 'undefined') {
            value = elem.value;
        } else {
            value = status.status;
            if (value === null) {
                Log.warn('SDDMSummaryView::updateState(..) - null value');
                Log.warn('SDDMSummaryView::updateState(..) - status: ' + JSON.stringify(status));
            }
        }


        // TODO: value should come from remote

        let states = [
            'sdmmd0provision',
            'sdmmd0status',
            'sdmmd1locked',
            'sdmmd1teams',
            'sdmmd1provision',
            'sdmmd1status',
            'sdmmd2locked',
            'sdmmd2status',
            'sdmmd3provision',
            'sdmmd3locked',
            'sdmmd3status'];

        for (const s of states) {
            const e = document.getElementById(s);
            if (e !== null) {
                e.style.display = 'none';
            } else {
                Log.warn("App::sdmmSelectChanged(..) - null for: " + s);
            }
        }

        if (value === 'D0PRE') {
            this.show([
                'sdmmd0provision',
                'sdmmd1locked',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);
        } else if (value === 'D0') {
            this.showStatusD0(status);
        } else if (value === 'D1UNLOCKED') {
            this.show([
                'sdmmd0status',
                'sdmmd1teams',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);
        } else if (value === 'D1TEAMSET') {
            this.show([
                'sdmmd0status',
                'sdmmd1provision',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);
        } else if (value === 'D1') {
            this.show([
                'sdmmd0status',
                'sdmmd1status',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);
        } else if (value === 'D2') {
            this.show([
                'sdmmd0status',
                'sdmmd1status',
                'sdmmd2status',
                'sdmmd3locked',
            ]);
        } else if (value === 'D3PRE') {
            this.show([
                'sdmmd0status',
                'sdmmd1status',
                'sdmmd2status',
                'sdmmd3provision',
            ]);
        } else if (value === 'D3') {
            this.show([
                'sdmmd0status',
                'sdmmd1status',
                'sdmmd2status',
                'sdmmd3status',
            ]);
        }

    }

    public renderPage() {
        Log.info('SDMMSummaryView::renderPage() - start');

        // this.updateState();
        this.checkStatus();
    }

    private show(ids: string[]) {
        for (const s of ids) {
            let elem = document.getElementById(s);
            if (elem !== null) {
                elem.style.display = 'flex';
            } else {
                Log.warn("App::show(..) - null for: " + s);
            }
        }
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
            console.log('UI::showModal(..) - Modal is null');
        }
    }

    public hideModal() {
        const modal = document.querySelector('ons-modal') as OnsModalElement;
        if (modal !== null) {
            modal.hide({animation: 'fade'});
        } else {
            console.log('UI::hideModal(..) - Modal is null');
        }
    }

    public async fetchStatus(url: string): Promise<void> {
        Log.info('SDDM::fetchStatus( ' + url + ' ) - start');

        let options = this.getOptions();
        let response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('SDDM::fetchStatus(..) - 200 received');
            let json = await response.json();
            Log.trace('SDDM::fetchStatus(..) - payload: ' + JSON.stringify(json));

            if (typeof json.success !== 'undefined') {
                Log.trace('SDDM::fetchStatus(..) - status: ' + json.success.status);
                this.updateState(json.success); // StatusPayload
            } else {
                Log.trace('SDDM::fetchStatus(..) - ERROR: ' + json.failure.message);
                this.showError(json.failure); // FailurePayload
            }

        } else {
            Log.trace('SDDM::fetchStatus(..) - !200 received');
        }
        return;
    }


    public showError(failure: any) { // FailurePayload
        Log.error("SDDM::showError(..) - failure: " + JSON.stringify(failure));
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

    private showStatusD0(status: StatusPayload) {
        Log.trace('SDDMSV::showStatusD0(..) - start: ' + JSON.stringify(status));
        // <ons-icon icon="fa-times-circle"></ons-icon> <!-- fa-check-circle -->
        try {
            // update icon
            let row = document.getElementById('sdmmd0status');
            let icon = row.children[0].children[0];
            if (status.d0.score >= 60) {
                icon.setAttribute('icon', 'fa-check-circle');
            } else {
                icon.setAttribute('icon', 'fa-times-circle');
            }

            // set title:
            if (status.d0.score > 0) {
                row.children[1].children[0].innerHTML = 'Grade: ' + status.d0.score.toFixed(1) + ' %';
            } else {
                row.children[1].children[0].innerHTML = 'Grade: N/A';
            }

            // set subrow
            row.children[1].children[1].innerHTML = '<a href="' + status.d0.url + '">Source Repository</a>&nbsp;&nbsp;Timestamp: ' + new Date(status.d0.timestamp).toLocaleTimeString();

            this.show([
                'sdmmd0status',
                'sdmmd1locked',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);
        } catch (err) {
            Log.trace('SDDMSV::showStatusD0(..) - ERROR: ' + err);
        }
    }
}