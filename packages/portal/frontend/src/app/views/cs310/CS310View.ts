/**
 * This is the main student page for the SDDM.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsModalElement} from "onsenui";

import Log from "../../../../../../common/Log";

import {UI} from "../../util/UI";
import {IView} from "../IView";
import {GradeTransport} from "../../../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../../util/SortableTable";

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
        Log.warn("CS310view::checkStatus() - NOT IMPLEMENTED");
        // const msg = "Updating status";
        // UI.showModal(msg);

        // const url = this.remote + '/portal/currentStatus';
        // this.fetchStatus(url);
    }

    public renderPage(opts: {}) {
        Log.info('CS310View::renderPage() - start; options: ' + opts);

        // this.checkStatus();

        this.initGrades();
    }

    private async initGrades(): Promise<void> {
        // studentGradeDiv
        UI.showModal('Fetching Grades');
        let options = this.getOptions();
        const url = this.remote + '/portal/grades';
        let response = await fetch(url, options);
        UI.hideModal();
        if (response.status === 200) {
            Log.trace('CS310View::initGrades(..) - 200 received');
            let json = await response.json();
            Log.trace('CS310View::initGrades(..) - payload: ' + JSON.stringify(json));

            if (typeof json.success !== 'undefined') {
                Log.trace('CS310View::initGrades(..) - success: ' + json.success);
                this.renderGrades(<GradeTransport[]>json.success);
            } else {
                Log.trace('CS310View::initGrades(..) - ERROR: ' + json.failure.message);
                this.showError(json.failure);
            }

        } else {
            Log.trace('CS310View::initGrades(..) - !200 received');
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

    private renderGrades(grades: GradeTransport[]) {
        Log.trace("CS310View::renderGrades() - start");

        const headers: TableHeader[] = [
            {
                id:          'id',
                text:        'Deliv Id',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
            },
            {
                id:          'grade',
                text:        'Grade',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em; text-align: center;'
            },
            {
                id:          'comment',
                text:        'Comment',
                sortable:    false,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em; text-align: left;'
            }
        ];

        const st = new SortableTable(headers, '#studentGradeTable');
        for (const grade of grades) {

            let score: number | string = grade.score;
            if (score === null) {
                score = 'Not Set';
            }
            let comment = grade.comment;
            if (comment === null) {
                comment = '';
            }
            let row: TableCell[] = [
                {value: grade.delivId, html: '<a href="' + grade.URL + '">' + grade.delivId + '</a>'},
                {value: score, html: score + ''},
                {value: comment, html: comment}
            ];
            st.addRow(row);
        }

        st.generate();

    }
}
