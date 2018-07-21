/**
 * This is the main student page for the SDDM.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsModalElement} from "onsenui";

import Log from "../../../../../../common/Log";
import {GradePayload, StatusPayload} from "../../../../../../common/types/SDMMTypes";

import {UI} from "../../util/UI";
import {IView} from "../IView";
import {Factory} from "../../Factory";

export class SDMMSummaryView implements IView {

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
            that.checkStatus();
        }, (duration - 500));

    }

    public checkStatus() {
        const msg = "Updating status";
        // UI.showModal(msg);

        const url = this.remote + '/portal/sdmm/currentStatus';
        this.fetchStatus(url);
    }

    public async createD0Repository(): Promise<void> {

        this.showModal("Provisioning D0 Repository.<br/>This can take up to 5 minutes.<br/>This dialog will clear as soon as the operation is complete.")

        const url = this.remote + '/portal/sdmm/performAction/provisionD0';
        Log.info('SDDM::createD0Repository( ' + url + ' ) - start');

        let options: any = this.getOptions();
        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('SDDM::createD0Repository(..) - 200 received');
            let json = await response.json();

            this.longAction(2000, "D0 Repository created");

            this.checkStatus();
        } else {
            Log.trace('SDDM::createD0Repository(..) - !200 received; status: ' + response.status);
            let json = await response.json();
            this.showError(json);
        }
        return;
    }

    public createD1Repository() {
        Log.info("SDMMSummaryView::createD1Repository() - start");
        this.longAction(5000, 'Creating D1 Repository<br/>Will take < 10 seconds');
    }

    public async createD1Individual(): Promise<void> {
        Log.info("SDMMSummaryView::createD1Individual() - start");

        const url = this.remote + '/portal/sdmm/performAction/provisionD1individual';
        Log.info('SDDM::createD1Individual( ' + url + ' ) - start');

        this.showModal("Provisioning D1 Repository.<br/>This can take up to 5 minutes.<br/>This dialog will clear as soon as the operation is complete.")

        let options: any = this.getOptions();
        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('SDDM::createD1Individual(..) - 200 received');
            let json = await response.json();

            this.longAction(2000, "D1 Repository created");
            UI.hideModal();

            this.checkStatus();
        } else {
            Log.trace('SDDM::createD1Individual(..) - !200 received; status: ' + response.status);
            let json = await response.json();
            this.showError(json);
        }
        return;

    }

    public async createD1Team(partnerName: string): Promise<void> {
        Log.info("SDMMSummaryView::createD1Team() - start");
        // this.longAction(5000, 'Configuring D1 Team<br/>Will take < 10 seconds');

        this.showModal("Provisioning D1 Repository.<br/>This can take up to 5 minutes.<br/>This dialog will clear as soon as the operation is complete.")

        const url = this.remote + '/portal/sdmm/performAction/provisionD1team/' + partnerName;
        // TODO: actually provide team members!!!
        Log.info('SDDM::createD1Team( ' + url + ' ) - start');

        let options: any = this.getOptions();
        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('SDDM::createD1Team(..) - 200 received');
            let json = await response.json();

            this.longAction(2000, "D1 Repository created");

            this.checkStatus();
        } else {
            Log.trace('SDDM::createD1Team(..) - !200 received; status: ' + response.status);
            let json = await response.json();
            this.showError(json);
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
            this.showStatusD1(status); // still do the d0 status
            this.show([
                'sdmmd0status',
                'sdmmd1teams',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);
        } else if (value === 'D1TEAMSET') {
            this.showStatusD1(status); // still do the d0 status
            this.show([
                'sdmmd0status',
                'sdmmd1provision',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);
        } else if (value === 'D1') {
            this.showStatusD1(status);
        } else if (value === 'D2') {
            this.showStatusD2(status);
        } else if (value === 'D3PRE') {
            // still do the d2 status
            this.showStatusD3(status);
            this.show([
                'sdmmd0status',
                'sdmmd1status',
                'sdmmd2status',
                'sdmmd3provision',
            ]);
        } else if (value === 'D3') {
            this.showStatusD3(status);
        }

    }

    public renderPage(opts: {}) {
        Log.info('SDMMSummaryView::renderPage() - start');

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

            Log.trace('SDDM::fetchStatus(..) - status: ' + json.success.status);
            this.updateState(json.success); // StatusPayload
        } else {
            Log.trace('SDDM::fetchStatus(..) - !200 received: ' + response.status);
            let json = await response.json();
            Log.trace('SDDM::fetchStatus(..) - ERROR: ' + json.failure.message);
            this.showError(json.failure); // FailurePayload

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
                // org:   localStorage.org
                name:  Factory.getInstance().getName()
            }
        };
        return options;
    }

    private showStatusD0(status: StatusPayload) {
        Log.trace('SDDMSV::showStatusD0(..) - start: ' + JSON.stringify(status));
        // <ons-icon icon="fa-times-circle"></ons-icon> <!-- fa-check-circle -->
        try {

            this.show([
                'sdmmd0status',
                'sdmmd1locked',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);

            if (status.d0 !== null) {
                let row = document.getElementById('sdmmd0status');
                this.updateDeliverableRow(row, status.d0);
            }


        } catch (err) {
            Log.trace('SDDMSV::showStatusD0(..) - ERROR: ' + err);
        }
    }

    private updateDeliverableRow(row: any, grade: GradePayload) {
        // update icon
        if (row === null || grade === null) {
            return;
        }

        let icon = row.children[0].children[0];
        if (grade.score >= 60) {
            icon.setAttribute('icon', 'fa-check-circle');
        } else {
            icon.setAttribute('icon', 'fa-times-circle');
        }

        // set title:
        if (grade.score > 0) {
            row.children[1].children[0].innerHTML = 'Grade: ' + grade.score.toFixed(1) + ' %';
            row.children[1].children[1].innerHTML = '<a href="' + grade.URL + '">Source Commit</a>&nbsp;&nbsp;Timestamp: ' + new Date(grade.timestamp).toLocaleTimeString();
        } else {
            row.children[1].children[0].innerHTML = 'Grade: N/A';
            row.children[1].children[1].innerHTML = '<a href="' + grade.URL + '">Source Repository</a>&nbsp;&nbsp;Timestamp: ' + new Date(grade.timestamp).toLocaleTimeString();
        }

        // set subrow

    }

    private showStatusD1(status: any | undefined) {
        Log.info("SDDM::showStatusD1(..) - start: " + JSON.stringify(status));
        try {

            this.show([
                'sdmmd0status',
                'sdmmd1status',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);

            let row = document.getElementById('sdmmd0status');
            if (status.d0 !== null) {
                this.updateDeliverableRow(row, status.d0);
            } else {
                row.style.display = 'none';
            }

            row = document.getElementById('sdmmd1status');
            if (status.d1 !== null) {
                this.updateDeliverableRow(row, status.d1);
            } else {
                row.style.display = 'none';
            }

        } catch (err) {
            Log.info("SDDM::showStatusD1(..) - ERROR: " + err);
        }
    }

    private showStatusD2(status: any | undefined) {
        Log.info("SDDM::showStatusD2(..) - start: " + JSON.stringify(status));
        try {

            this.show([
                'sdmmd0status',
                'sdmmd1status',
                'sdmmd2status',
                'sdmmd3locked',
            ]);

            let row = document.getElementById('sdmmd0status');
            if (status.d0 !== null) {
                this.updateDeliverableRow(row, status.d0);
            } else {
                row.style.display = 'none';
            }

            row = document.getElementById('sdmmd1status');
            if (status.d1 !== null) {
                this.updateDeliverableRow(row, status.d1);
            } else {
                row.style.display = 'none';
            }

            row = document.getElementById('sdmmd2status');
            if (status.d2 !== null) {
                this.updateDeliverableRow(row, status.d2);
            } else {
                row.style.display = 'none';
            }
        } catch (err) {
            Log.info("SDDM::showStatusD2(..) - ERROR: " + err);
        }
    }


    private showStatusD3(status: any | undefined) {
        Log.info("SDDM::showStatusD3(..) - start: " + JSON.stringify(status));
        try {

            this.show([
                'sdmmd0status',
                'sdmmd1status',
                'sdmmd2status',
                'sdmmd3status',
            ]);

            let row = document.getElementById('sdmmd0status');
            if (status.d0 !== null) {
                this.updateDeliverableRow(row, status.d0);
            } else {
                row.style.display = 'none';
            }
            row = document.getElementById('sdmmd1status');
            if (status.d1 !== null) {

                this.updateDeliverableRow(row, status.d1);
            } else {
                row.style.display = 'none';
            }
            row = document.getElementById('sdmmd2status');
            if (status.d2 !== null) {

                this.updateDeliverableRow(row, status.d2);
            } else {
                row.style.display = 'none';
            }
            row = document.getElementById('sdmmd3status');
            if (status.d3 !== null) {

                this.updateDeliverableRow(row, status.d3);
            } else {
                row.style.display = 'none';
            }

        } catch (err) {
            Log.info("SDDM::showStatusD2(..) - ERROR: " + err);
        }
    }

    public d1TeamDialog() {
        Log.info("SDDM::d1TeamDialog()");
        UI.showD1TeamDialog();
    }

    public d1TeamCancel() {
        Log.info("SDDM::d1TeamCancel()");
        UI.hideD1TeamDialog();
    }

    public d1TeamForm() {
        Log.info("SDDM::d1TeamForm()");
        let partnerInput: any = document.getElementById('d1partnerInput');
        let partnerUser = partnerInput.value;
        partnerUser = partnerUser.trim();
        Log.info("SDDM::d1TeamForm() - partner name: " + partnerUser);
        UI.hideD1TeamDialog();
        this.createD1Team(partnerUser);
    }

    /**
     * Debugging method.
     */
    public sdmmSelectChanged() {
        Log.trace('App::sdmmSelectChanged()');
        this.updateState(); // stick to dropdown for debugging
    }
}
