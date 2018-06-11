/**
 * This is the main student page for CS340.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsModalElement, OnsSelectElement} from "onsenui";

import Log from "../../../../../common/Log";
import {UI} from "../../util/UI";
import {AssignmentGrade, AssignmentGradingRubric} from "../../../../../common/types/CS340Types";

import {IView} from "../IView";
import {Deliverable} from "../../../../../portal-backend/src/Types";
import {Factory} from "../../Factory";


export class CS340View implements IView {
    private remote: string = null;

    constructor(remoteUrl: string) {
        Log.info("CS340View::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('CS340View::renderPage() - start; opts: ' + opts);
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

    public async getGradingRubric(assignmentId: string): Promise<AssignmentGradingRubric | null> {
        Log.info("CS340View::getGradingRubric(" + assignmentId + ") - start");
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

    public async getStudentGrade(sid: string, aid: string): Promise<AssignmentGrade | null> {
        // TODO [Jonathan]: Complete this

        return null;
    }

    public async pageSetup() {
        Log.info("CS340View::pageSetup - Setting up page with default dropdowns");


    }


    public async renderDeliverables() {
        // TODO [Jonathan]: Get the deliverables
        Log.info("CS340View::getAllDeliverables() - start");
        const url = this.remote + '/getAllDeliverables';
        this.showModal("Getting all deliverables, please wait...");

        let options: any = this.getOptions();
        options.method = 'get';
        let response = await fetch(url, options);
        UI.hideModal();

        if (response.status === 200) {
            console.log("This is the result received: ");
            let jsonResponse = await response.json();
            console.log(jsonResponse);
            Log.info("CS340View::getAllDeliverables() - end");

            let deliverableListElement = document.getElementById("select-deliverable-list") as OnsSelectElement;
            while (deliverableListElement.firstChild) {
                deliverableListElement.removeChild(deliverableListElement.firstChild);
                // deliverableListElement.remove();
            }
            let arrayResponse: Deliverable[] = jsonResponse.result;

            for (const deliv of arrayResponse) {
                // let newOption = document.createElement("ons-list-item");
                let newOption = document.createElement("option");
                // newOption.setAttribute("tappable", "true");
                newOption.setAttribute("value", "material");
                newOption.innerHTML = deliv.id;
                // TODO [Jonathan]: Make this call the page transition function
                // newOption.setAttribute("onclick", "window.classportal.view.changeStudentList(\""+deliv.id+"\")");
                // selectElement.appendChild(newOption);
                (<any>deliverableListElement).appendChild(newOption);
            }

            // TODO [Jonathan]: Setup an event listener on the button to show the grades
        } else {
            Log.info("CS340View::getAllDeliverables() - Error: unable to retrieve deliverables");
            // return null;
        }
    }

    public async changeStudentList(delivId: string) {
        console.log(delivId);

        const nav = document.querySelector('#myNavigator') as any;
        let page = nav.pushPage(Factory.getInstance().getHTMLPrefix() + "/deliverableView.html", {
            delivId: delivId
        });

        console.log(nav.topPage.data);
        // console.log();
    }
}
