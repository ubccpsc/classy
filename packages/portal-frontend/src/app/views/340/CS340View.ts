/**
 * This is the main student page for CS340.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsModalElement} from "onsenui";

import Log from "../../../../../common/Log";
import {GradePayload, StatusPayload} from "../../../../../common/types/SDMMTypes";
import {UI} from "../../util/UI";
import {AssignmentGradingRubric, QuestionGradingRubric, SubQuestionGradingRubric} from "../../../../../common/types/CS340Types";
import {AssignmentGrade, QuestionGrade, SubQuestionGrade} from "../../../../../common/types/CS340Types";

import {IView} from "../IView";


export class CS340View implements IView {
    private remote: string = null;

    constructor(remoteUrl: string) {
        Log.info("CS340View::<init>");
        this.remote = remoteUrl;
    }

    public renderPage() {
        Log.info('CS340View::renderPage() - start');
    }

    public testfunction() {
        console.log("A spooky message");
    }

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

    public async getGradingRubric(assignmentId : string) : Promise<AssignmentGradingRubric|null> {
        Log.info("CS340View::getGradingRubric("+assignmentId+") - start");
        const url = this.remote + '/getAssignmentRubric/' + assignmentId;
        this.showModal("Getting grading rubric, please wait...");
        // Call the function
        let options: any = this.getOptions();

        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();

        // If the response was valid;
        if (response.status === 200) {
            let jsonResponse = await response.json();
            // TODO [Jonathan]: Do something with the response
            return jsonResponse;
        } else {
            Log.trace('CS340View::getGradingRubric(...) - !200; Code: ' + response.status);
        }
        return null;
    }

    public async getStudentGrade(sid: string, aid: string) : Promise<AssignmentGrade|null> {
        // TODO [Jonathan]: Complete this

        return null;
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
}
