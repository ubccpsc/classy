import Log from "./util/Log";
import {OnsModalElement} from "onsenui";
import {UI} from "./util/UI";

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

    public createD0Repository() {
        const msg = 'Creating D0 Repository<br/>This will take < 60 seconds';
        UI.showModal(msg);


        // '/:courseId/admin/dashboard/:orgName/:delivId
        // const url = this.app.backendURL + this.courseId + '/admin/dashboard/' + params.orgName + '/' + params.delivId + post;
        const url = this.remote + '/currentStatus'; // hardcode
        // going to be slow; show a modal
        UI.showModal('Dashboard being retrieved. This should take < 10 seconds.');
        this.handleRemote(url, null);//, this.dashboardView, UI.handleError);


        // this.longAction(5000,);
    }

    public createD1Repository() {
        Log.info("SDMMSummaryView::createD1Repository() - start");
        this.longAction(5000, 'Creating D1 Repository<br/>Will take < 10 seconds');
    }

    public createD1Individual() {
        Log.info("SDMMSummaryView::createD1Individual() - start");
        this.longAction(5000, 'Configuring D1 Without Team<br/>Will take < 10 seconds');
    }

    public createD1Team() {
        Log.info("SDMMSummaryView::createD1Team() - start");
        this.longAction(5000, 'Configuring D1 Team<br/>Will take < 10 seconds');
    }

    public createD3PullRequest() {
        Log.info("SDMMSummaryView::createD3PullRequest() - start");
        this.longAction(5000, 'Creating D3 Pull Request<br/>Will take < 10 seconds');
    }

    private updateState() {
        const elem = <HTMLSelectElement>document.getElementById('sdmmSelect');
        const value = elem.value;

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
            this.show([
                'sdmmd0status',
                'sdmmd1locked',
                'sdmmd2locked',
                'sdmmd3locked',
            ]);
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

        this.updateState();
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

    public handleRemote(url: string, nextStep: any) {
        console.log('Network::handleRemote( ' + url + ' ) - start');

        //const OPTIONS_HTTP_GET: object = {credentials: 'include'};
        //const AUTHORIZED_STATUS: string = 'authorized';

        const options = {
            headers: {
                user:  localStorage.user,
                token: localStorage.token
            }
        };

        fetch(url, options).then((data: any) => {
            UI.hideModal();
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
        }).catch((err: Error) => {
            console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
            // onError(err.message);
        });
    }

}