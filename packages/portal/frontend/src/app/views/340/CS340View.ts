/**
 * This is the main student page for CS340.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsButtonElement} from "onsenui";
import Log from "../../../../../../common/Log";
import {DeliverableInfo} from "../../../../../../common/types/CS340Types";

import {Payload, TeamFormationTransport, TeamTransport} from "../../../../../../common/types/PortalTypes";
import {UI} from "../../util/UI";
import {StudentView} from "../StudentView";

export class CS340View extends StudentView {
    private teams: TeamTransport[];
    private deliverables: DeliverableInfo[];

    constructor(remoteUrl: string) {
        super();
        Log.info("CS340View::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('CS340View::renderPage() - start; options: ' + opts);
        const that = this;
        const start = Date.now();
        UI.hideSection('studentSelectPartnerDiv');
        UI.hideSection('studentPartnerDiv');
        UI.showModal("Fetching data.");
        super.render().then(function() {
            // super render complete; do custom work
            return that.fetchData340();
        }).then(function() {
            // that.renderTeams(that.teams);
            return that.renderDeliverables();
        }).then(function() {
            UI.hideModal();
            Log.info('CS340View::renderPage(..) - prep & render took: ' + UI.took(start));
        }).catch(function(err) {
            Log.error('CS340View::renderPage() - ERROR: ' + err);
            UI.hideModal();
        });
    }

    private async fetchData340(): Promise<void> {
        UI.showModal('Fetching Data');
        this.teams = null;

        const teamUrl = this.remote + '/portal/teams';
        const teamResponse = await fetch(teamUrl, super.getOptions());
        if (teamResponse.status === 200) {
            Log.trace('CS340View::fetchData340(..) - teams 200 received');
            const teamJson = await teamResponse.json();
            Log.trace('CS340View::fetchData340(..) - teams payload: ' + JSON.stringify(teamJson));
            if (typeof teamJson.success !== 'undefined') {
                Log.trace('CS340View::fetchData340(..) - teams success: ' + teamJson.success);
                this.teams = teamJson.success as TeamTransport[];
            } else {
                Log.trace('CS340View::fetchData340(..) - teams ERROR: ' + teamJson.failure.message);
                UI.showError(teamJson.failure);
            }
        } else {
            Log.trace('CS340View::fetchData340(..) - teams !200 received');
        }

        const delivUrl = this.remote + "/portal/cs340/getAllDelivInfo";
        const delivResponse = await fetch(delivUrl, super.getOptions());

        if (delivResponse.status === 200) {
            Log.trace('CS340View::fetchData340(..) - received deliverables');
            const delivJson = await delivResponse.json();
            if (typeof delivJson.response !== "undefined") {
                this.deliverables = delivJson.response;
            } else {
                Log.trace("CS340View::fetchData340(..) - deliverable error: " + delivJson.error);
            }
        } else {
            Log.trace('CS340View::fetchData340(..) - deliverables !200 received');
        }

        UI.hideModal();
        return;
    }

    private async renderDeliverables(): Promise<void> {
        Log.info("CS340View::renderDeliverables(..) - start");

        const that = this;
        const deliverables = this.deliverables;

        const delivSelectElement = document.querySelector('#studentDeliverableSelect') as HTMLSelectElement;
        const delivOptions: string[] = ["--N/A--"];

        for (const deliv of deliverables) {
            delivOptions.push(deliv.id);
        }

        delivSelectElement.innerHTML = "";
        for (const delivOption of delivOptions) {
            const option = document.createElement("option");

            option.innerText = delivOption;

            delivSelectElement.appendChild(option);
        }

        Log.info('CS340View::renderDeliverables(..) - hooking event listener');

        delivSelectElement.addEventListener("change", (evt) => {
            that.updateTeams().then(function() {
                // then
            }).catch(function(err) {
                // catch
            });
        });

        Log.info('CS340View::renderDeliverables(..) - finished hooking event listener');

        Log.info("CS340View::renderDeliverables(..) - finished rendering deliverable");
    }

    /*
    function editSelects(event) {
      document.getElementById('choose-sel').removeAttribute('modifier');
      if (event.target.value == 'material' || event.target.value == 'underbar') {
        document.getElementById('choose-sel').setAttribute('modifier', event.target.value);
      }
    }
    function addOption(event) {
      const option = document.createElement('option');
      var text = document.getElementById('optionLabel').value;
      option.innerText = text;
      text = '';
      document.getElementById('dynamic-sel').appendChild(option);
    }
    * */

    private async updateTeams(): Promise<void> {
        Log.info('CS340View::updateTeams(..) - start');

        const teams: TeamTransport[] = this.teams;
        const that = this;
        UI.hideSection('studentSelectPartnerDiv');
        UI.hideSection('studentPartnerDiv');

        const delivSelectElement = document.querySelector('#studentDeliverableSelect') as HTMLSelectElement;
        // get the deliverable ID
        const delivId = delivSelectElement.value;
        if (delivId === "--N/A--") {
            return;
        }
        Log.info('CS340View::updateTeams(..) - selected ' + delivId);

        let found = false;
        let selectedTeam;
        for (const team of teams) {
            if (team.delivId === delivId) {
                found = true;
                selectedTeam = team;
            }
        }

        if (found) {
            const tName = document.getElementById('studentPartnerTeamName');
            const pName = document.getElementById('studentPartnerTeammates');

            if (selectedTeam.URL !== null) {
                tName.innerHTML = '<a href="' + selectedTeam.URL + '">' + selectedTeam.id + '</a>';
            } else {
                tName.innerHTML = selectedTeam.id;
            }
            pName.innerHTML = JSON.stringify(selectedTeam.people);
            UI.showSection("studentPartnerDiv");
        } else {
            const button = document.querySelector('#studentSelectPartnerButton') as OnsButtonElement;

            button.onclick = async function(evt: any) {
                const selectedID = (document.querySelector('#studentDeliverableSelect') as HTMLSelectElement).value;

                Log.info("CS340View::updateTeams(..)::createTeam::onClick - selectedDeliv: " + selectedID);
                const teamCreation: TeamTransport = await that.formTeam(selectedID);
                Log.info("CS340View::updateTeams(..)::createTeam::onClick::then - result: " + teamCreation.toString());
                if (teamCreation === null) {
                    return;
                }
                that.teams.push(teamCreation);

                that.renderPage({});
            };

            const minTeam = document.querySelector("#minimumNum");
            const maxTeam = document.querySelector("#maximumNum");

            for (const delivInfo of this.deliverables) {
                if (delivInfo.id === delivId) {
                    minTeam.innerHTML = delivInfo.minStudents.toString();
                    maxTeam.innerHTML = delivInfo.maxStudents.toString();
                }
            }

            UI.showSection('studentSelectPartnerDiv');
            return;
        }
    }

    // private async renderTeams(teams: TeamTransport[]): Promise<void> {
    //     Log.trace('CS340View::renderTeams(..) - start');
    //     const that = this;
    //
    //     // make sure these are hidden
    //     UI.hideSection('studentSelectPartnerDiv');
    //     UI.hideSection('studentPartnerDiv');
    //
    //     // 310 only has one team so we don't need to check to see if it's the right one
    //     if (teams.length < 1) {
    //         // no team yet
    //
    //         const button = document.querySelector('#studentSelectPartnerButton') as OnsButtonElement;
    //         button.onclick = function(evt: any) {
    //             Log.info('CS340View::renderTeams(..)::createTeam::onClick');
    //             that.formTeam().then(function(team) {
    //                 Log.info('CS340View::renderTeams(..)::createTeam::onClick::then - team created');
    //                 that.teams.push(team);
    //                 if (team !== null) {
    //                     that.renderPage({}); // simulating refresh
    //                 }
    //             }).catch(function(err) {
    //                 Log.info('CS340View::renderTeams(..)::createTeam::onClick::catch - ERROR: ' + err);
    //             });
    //         };
    //
    //         UI.showSection('studentSelectPartnerDiv');
    //     } else {
    //         // already on team
    //         UI.showSection('studentPartnerDiv');
    //
    //         const tName = document.getElementById('studentPartnerTeamName');
    //         const pName = document.getElementById('studentPartnerTeammates');
    //         const team = this.teams[0];
    //
    //         if (team.URL !== null) {
    //             tName.innerHTML = '<a href="' + team.URL + '">' + team.id + '</a>';
    //         } else {
    //             tName.innerHTML = team.id;
    //         }
    //         pName.innerHTML = JSON.stringify(team.people);
    //     }
    // }

    private async formTeam(selectedDeliv: string): Promise<TeamTransport> {
        Log.info("CS340View::formTeam() - start");
        const otherIds = UI.getTextFieldValue('studentSelectPartnerText');
        // split the other IDs by semicolons
        const idArray: string[] = otherIds.split(";");
        const myGithubId = this.getStudent().githubId;
        const githubIds: string[] = [];
        githubIds.push(myGithubId);
        for (const id of idArray) {
            githubIds.push(id.trim());
        }

        const payload: TeamFormationTransport = {
            // delivId:   selectedTeam,
            delivId:   selectedDeliv,
            githubIds: githubIds
        };
        const url = this.remote + '/portal/team';
        const options: any = this.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(payload);

        Log.info("CS340View::formTeam() - URL: " + url + "; payload: " + JSON.stringify(payload));
        const response = await fetch(url, options);

        Log.info("CS340View::formTeam() - responded");

        const body = await response.json() as Payload;

        Log.info("CS340View::formTeam() - response: " + JSON.stringify(body));

        if (typeof body.success !== 'undefined') {
            // worked
            return body.success as TeamTransport;
        } else if (typeof body.failure !== 'undefined') {
            // failed
            UI.showError(body);
            return null;
        } else {
            Log.error("CS340View::formTeam() - else ERROR: " + JSON.stringify(body));
        }
    }

    // tslint:disable
    // private async getDeliverables(): Promise<Deliverable[]> {
    //     const delivOptions = AdminView.getOptions();
    //     const delivUrl: string = this.remote + '/portal/cs340/getAllDeliverables';
    //     const delivResponse = await fetch(delivUrl, delivOptions);
    //
    //     if(delivResponse.status !== 200) {
    //         Log.trace("CS340AdminView::renderStudentGrades(..) - !200 " +
    //             "response received; code:" + delivResponse.status);
    //         return;
    //     }
    //     const delivJson = await delivResponse.json();
    //     const delivArray: Deliverable[] = delivJson.response;
    //
    //     return delivArray;
    // }

    /*
        private remote: string = null;

        constructor(remoteUrl: string) {
            Log.info("CS340View::<init>");
            this.remote = remoteUrl;
        }

        public renderPage(opts: {}) {
            Log.info('CS340View::renderPage() - start; opts: ' + JSON.stringify(opts));

        }

    */

    /*
        public testfunction() {
            console.log("A spooky message!");
            UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/GradingView.html', {
                hello:  "world"
                , page: Factory.getInstance().getHTMLPrefix() + '/GradingView.html'
            }).then(() => {
                this.renderPage({page: Factory.getInstance().getHTMLPrefix() + '/GradingView.html'});
                console.log("all done!");
            });
        }

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

        // public showModal(text?: string) {
        //     // https://onsen.io/v2/api/js/ons-modal.html
        //     if (typeof text === 'undefined') {
        //         text = null;
        //     }
        //
        //     const modal = document.querySelector('ons-modal') as OnsModalElement;
        //     if (modal !== null) {
        //         modal.style.backgroundColor = '#444444'; // modal opaque
        //         if (text != null) {
        //             document.getElementById('modalText').innerHTML = text;
        //         }
        //         modal.show({animation: 'fade'});
        //     } else {
        //         console.log('UI::showModal(..) - Modal is null');
        //     }
        // }
        //
        // public hideModal() {
        //     const modal = document.querySelector('ons-modal') as OnsModalElement;
        //     if (modal !== null) {
        //         modal.hide({animation: 'fade'});
        //     } else {
        //         console.log('UI::hideModal(..) - Modal is null');
        //     }
        // }

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
            const url = this.remote + '/portal/getAssignmentRubric/' + assignmentId;
            Log.info("CS340View::getGradingRubric(...) - uri: " + url);

            UI.showModal("Getting grading rubric, please wait...");
            // Call the function
            let options: any = this.getOptions();

            options.method = 'get';
            let response = await fetch(url, options);
            UI.hideModal();

            // If the response was valid:
            if (response.status === 200) {
                let jsonResponse = await response.json();
                // TODO [Jonathan]: Do something with the response
                return jsonResponse.response;
            } else {
                Log.trace('CS340View::getGradingRubric(...) - !200; Code: ' + response.status);
                return null;
            }
        }

        /!**
         * Grabs the page and adds the grading view as specified in the deliverable
         * @param {string} delivId
         * @param {string} sid
         * @returns {Promise<void>}
         *!/
        public async populateGradingPage(delivId: string, sid: string) {
            Log.info("CS340View::populateGradingPage() - start");

            UI.showModal("Populating grading view, please wait...");
            let rubric: AssignmentGradingRubric = await this.getGradingRubric(delivId);
            if (rubric === null) {
                // Log.error(rubric);
                Log.error("CS340View::populateGradingPage() - Unable to populate page due to missing rubric");
                return;
            }
            Log.info("CS340View::populateGradingPage() - Rubric: " + rubric);

            // TODO: Do something about the previous submission
            let previousSubmission = await this.getStudentGrade(sid, delivId);

            let assignmentInfoElement = document.getElementById('assignmentInfoSection');
            let gradingSectionElement = document.getElementById('gradingSection');

            // let assignmentInfoList = document.createElement("ons-list");
            // let assignmentInfoAssignmentID = document.createElement("ons-list-item");
            // let assignmentInfoAssignmentStudent = document.createElement("ons-list-item");

            let assignmentInfoList = document.createElement("div");

            let assignmentInfoAssignmentID = document.createElement("p");
            assignmentInfoAssignmentID.innerHTML = delivId;
            assignmentInfoAssignmentID.setAttribute("class", "aInfoID");

            let assignmentInfoStudentID = document.createElement("p");
            assignmentInfoStudentID.innerHTML = sid;
            assignmentInfoStudentID.setAttribute("class", "aInfoSID");
            assignmentInfoList.appendChild(assignmentInfoAssignmentID);
            assignmentInfoList.appendChild(assignmentInfoStudentID);

            if (gradingSectionElement === null || assignmentInfoElement === null) {
                Log.error("CS340View::populateGradingPage() - Unable to populate page due to missing elements");
                return;
            }

            assignmentInfoElement.appendChild(assignmentInfoList);

            for (let i = 0; i < rubric.questions.length; i++) {
                // Get the i-th question
                let question = rubric.questions[i];

                let questionHeaderElement = document.createElement("h3");
                let questionHeader = document.createElement("span");
                let questionHeaderComponent1 = document.createElement("span");
                let questionHeaderComponent2 = document.createElement("span");

                // TODO: Check this
                questionHeaderComponent1.innerHTML = question.name;
                questionHeaderComponent1.setAttribute("class", "questionName");
                questionHeaderComponent2.setAttribute("class", "redText");
                questionHeaderComponent2.innerHTML = " *";

                questionHeader.appendChild(questionHeaderComponent1);
                questionHeader.appendChild(questionHeaderComponent2);
                questionHeaderElement.appendChild(questionHeader);
                gradingSectionElement.appendChild(questionHeaderElement);

                let questionBox = document.createElement("div");
                questionBox.setAttribute("class", "questionBox");

                for (let j = 0; j < question.subQuestions.length; j++) {
                    let subQuestion: SubQuestionGradingRubric = question.subQuestions[j];

                    let questionSubBoxElement = document.createElement("div");
                    questionSubBoxElement.setAttribute("class", "subQuestionBody");

                    // Create the grade input element
                    let subInfoBoxElement = document.createElement("div");
                    subInfoBoxElement.setAttribute("class", "subQuestionInfoBox");

                    // Contains the feedback box for the particular subquestion
                    let subTextBoxElement = document.createElement("div");
                    subTextBoxElement.setAttribute("class", "subQuestionTextBox");

                    let subErrorBoxElement = document.createElement("div");
                    subErrorBoxElement.setAttribute("class", "subQuestionErrorBox");

                    // Create the grade input element
                    let gradeInputElement = document.createElement("ons-input");
                    gradeInputElement.setAttribute("type", "number");
                    gradeInputElement.setAttribute("placeHolder", subQuestion.name);
                    gradeInputElement.setAttribute("data-type", subQuestion.name);
                    gradeInputElement.setAttribute("modifier", "underbar");
                    gradeInputElement.setAttribute("class", "subQuestionGradeInput");
                    // gradeInputElement.setAttribute("onchange", "checkIfWarning(this)");
                    gradeInputElement.setAttribute("data-outOf", "" + subQuestion.outOf);
                    gradeInputElement.innerHTML = subQuestion.name + " [out of " + subQuestion.outOf + "]";

                    // Add grade input to infoBox
                    subInfoBoxElement.appendChild(gradeInputElement);

                    // Create error box that is initially invisible
                    let errorBox = document.createElement("p");
                    errorBox.setAttribute("class", "errorBox");

                    // Add the error box to the info box section
                    subInfoBoxElement.appendChild(errorBox);

                    // Create input form for feedback form
                    let textBoxElement = document.createElement("textArea");
                    let textBoxLabelElement = document.createElement("p");
                    textBoxLabelElement.innerHTML = "Comments & Feedback";
                    textBoxLabelElement.setAttribute("class", "textboxLabel");
                    textBoxElement.setAttribute("class", "textarea");
                    textBoxElement.setAttribute("style", "width: 100%;height: 75%; min-width: 100px;min-height: 50px");
                    subTextBoxElement.appendChild(textBoxLabelElement);
                    subTextBoxElement.appendChild(textBoxElement);

                    // Add two subboxes to the subQuestion box
                    questionSubBoxElement.appendChild(subInfoBoxElement);
                    questionSubBoxElement.appendChild(subTextBoxElement);

                    // Add the subQuestion to the question box
                    questionBox.appendChild(questionSubBoxElement);
                }

                // Add the questionBox to the gradingSection
                gradingSectionElement!.appendChild(questionBox);
            }

            // TODO: Work on this
            // Create a submission button
            let submitButton = document.createElement("ons-button");
            // TODO: Link this better
            submitButton.setAttribute("onclick", "window.classportal.view.submitGrade()");
            submitButton.innerHTML = "Submit";

            gradingSectionElement!.appendChild(submitButton);
        }

        public async submitGrade(): Promise<AssignmentGrade | null> {
            let error = false;
            let questionArray: QuestionGrade[] = [];
            let questionBoxes = document.getElementsByClassName("questionBox");

            for (let i = 0; i < questionBoxes.length; i++) {
                // A single question box, representative of many subquestions
                let questionBox = questionBoxes[i];
                // Get each subquestion from the questionBox
                let subQuestions = questionBox.getElementsByClassName("subQuestionBody");
                // initalize an array to place all the information inside
                let subQuestionArray: SubQuestionGrade[] = [];

                // for each subQuestion
                for (let j = 0; j < subQuestions.length; j++) {
                    // Get a single subQuestion
                    let subQuestion = subQuestions[j];

                    // Grab the elements associated with the subQuesiton
                    let gradeInputElements = subQuestion.getElementsByClassName("subQuestionGradeInput");
                    let errorElements = subQuestion.getElementsByClassName("errorBox");
                    let responseBoxElements = subQuestion.getElementsByClassName("textarea");

                    // Check if there is exactly one element in each
                    // otherwise something is wrong with the webpage
                    if (gradeInputElements.length !== 1 ||
                        responseBoxElements.length !== 1 ||
                        errorElements.length !== 1) {
                        // Display an error
                        Log.error("CS340View::submitGrade - Error: Page is malformed");
                        return null;
                    }

                    // Grab the elements
                    let gradeInputElement = gradeInputElements[0] as HTMLInputElement;
                    let responseBoxElement = responseBoxElements[0] as HTMLTextAreaElement;
                    let errorElement = errorElements[0] as HTMLElement;

                    // Get the type from the embedded HTML data
                    let rubricType = gradeInputElement.getAttribute("data-type");

                    // Retrieve the value inputted into the form field
                    let gradeValue = parseFloat(gradeInputElement.value);

                    // If the value is not found, set it to a default empty string
                    if (rubricType === null) {
                        rubricType = "";
                        error = true;
                        continue;
                    }

                    // If the grade value retrieved is not a number, default the value to 0
                    if (isNaN(gradeValue)) {
                        gradeValue = 0;
                        error = true;
                        errorElement.innerHTML = "Error: Must specify a valid number";
                        continue;
                    } else {
                        // If the gradeValue is an actual number
                        // check if there are any warnings about the input value
                        if (this.checkIfWarning(gradeInputElement)) {
                            error = true;
                            continue;
                        }
                    }

                    let newSubGrade: SubQuestionGrade = {
                        sectionName: rubricType,
                        grade:       gradeValue,
                        feedback:    responseBoxElement.value
                    };

                    subQuestionArray.push(newSubGrade);
                }

                let questionNames = document.getElementsByClassName("questionName");
                if (questionNames.length !== 1) {
                    error = true;
                    continue;
                }

                let newQuestion: QuestionGrade = {
                    questionName: questionNames[0].innerHTML,
                    commentName:  "",
                    subQuestion:  subQuestionArray
                };

                questionArray.push(newQuestion);
            }

            let aInfoSIDElements = document.getElementsByClassName("aInfoSID");
            let aInfoIDElements = document.getElementsByClassName("aInfoID");

            if (aInfoSIDElements.length !== 1 || aInfoIDElements.length !== 1) {
                error = true;
            }

            if (error) {
                Log.error("CS340View::submitGrade() - Unable to submit data");
                return null;
            }

            let sid = aInfoSIDElements[0].innerHTML;
            let aid = aInfoIDElements[0].innerHTML;

            let newAssignmentGrade: AssignmentGrade = {
                assignmentID: aid,
                studentID:    sid,
                questions:    questionArray
            };

            // TODO: Record in database the new Grade
            const url = this.remote + '/portal/setAssignmentGrade';
            Log.info("CS340View::submitGrade() - uri: " + url);

            UI.showModal("Submitting grade, please wait...");
            // Call the function
            let options: any = this.getOptions();

            options.method = 'put';
            options.headers.Accept = 'application/json';
            options.json = true;
            // options.body = JSON.stringify({"value": "response"});
            options.body = JSON.stringify(newAssignmentGrade);

            Log.info("CS340View::submitGrade() - request body: " + options.body);

            let response = await fetch(url, options);

            UI.hideModal();
            Log.info("CS340View::submitGrade() - response from api " + response);

            return newAssignmentGrade;
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
            const url = this.remote + '/portal/getAllDeliverables';
            UI.showModal("Getting all deliverables, please wait...");

            let options: any = this.getOptions();
            options.method = 'get';
            let response = await fetch(url, options);
            UI.hideModal();

            if (response.status === 200) {
                Log.info("CS340View::getAllDeliverables() - response 200");

                // console.log("This is the result received: ");
                let jsonResponse = await response.json();
                let responseData = jsonResponse.response;

                // console.log(jsonResponse);
                Log.info("CS340View::getAllDeliverables() - response data: " + JSON.stringify(responseData));

                let deliverableListElement = document.getElementById("select-deliverable-list") as OnsSelectElement;
                while (deliverableListElement.firstChild) {
                    deliverableListElement.removeChild(deliverableListElement.firstChild);
                    // deliverableListElement.remove();
                }
                let arrayResponse: Deliverable[] = responseData;
                // Log.info("CS340View::getAllDeliverables() value- " + JSON.stringify(arrayResponse));
                // Log.info("CS340View::getAllDeliverables() value- " + arrayResponse);
                if (arrayResponse == null || typeof arrayResponse == "undefined") {
                    Log.error("CS340View::getAllDeliverables() - error, response is null or undefined");
                    return;
                }
                for (const deliv of arrayResponse) {
                    // let newOption = document.createElement("ons-list-item");
                    let newOption = document.createElement("option");
                    // newOption.setAttribute("tappable", "true");
                    newOption.setAttribute("value", "material");
                    newOption.text = deliv.id;
                    newOption.value = deliv.id;
                    // TODO [Jonathan]: Make this call the page transition function
                    // newOption.setAttribute("onclick", "window.classportal.view.changeStudentList(\""+deliv.id+"\")");
                    // selectElement.appendChild(newOption);
                    Log.info("CS340View::getAllDeliverables - Add new option: " + deliv.id);
                    (<any>deliverableListElement).appendChild(newOption);
                }
                // TODO [Jonathan]: Setup an event listener on the button to show the grades
                let deliverableButton = document.getElementById("select-deliverable-button") as OnsButtonElement;
                deliverableButton.addEventListener('click', () => {
                    let selectedDeliverable = deliverableListElement.options[deliverableListElement.options.selectedIndex].value;
                    // Log.info("CS340View::clickListener - value: " + selectedDeliverable);
                    this.renderStudentSubmissions(selectedDeliverable);
                });
            } else {
                Log.error("CS340View::getAllDeliverables() - Error: unable to retrieve deliverables");
                // return null;
            }

            Log.info("CS340View::getAllDeliverables() - end");
        }

    // <<<<<<< HEAD
        public async renderStudentSubmissions(delivId: string) {
            Log.info("CS340View::renderStudentSubmissions(" + delivId + ") -- start");
            let gradeTable = document.getElementById("grades-table");
            const submissionRetrieveURL = this.remote + '/portal/getAllSubmissionsByDelivID/' + delivId;

            UI.showModal("Loading submissions, please wait...");
            let options: any = this.getOptions();
            options.method = 'get';
            let response = await fetch(submissionRetrieveURL, options);

            if (response.status === 200) {
                let jsonResponse = await response.json();
                let responseData = jsonResponse.response; // TODO: Check if this is null

                if (gradeTable !== null) {
                    gradeTable.innerHTML = ''; // destructively delete the table entries
                    let headerValues = ['Username', 'SNum', 'First', 'Last'];

                    headerValues.push(delivId); // Append the deliverable ID to the end of the header
                    let delivCount = 1; // Constant: Change if dynamic

                    let headers: TableHeader[] = [];
                    let defaultSort = true; // Set true for first value
                    for (let h of headerValues) {
                        headers.push({id: h, text: h, sortable: true, defaultSort: defaultSort, sortDown: true});
                        defaultSort = false;
                    }

                    // Get all students and their associated information, then store in a map for constant time access
                    const url = this.remote + '/portal/getAllPersons';
                    let options: any = this.getOptions();
                    options.method = 'get';
                    let response = await fetch(url, options);

                    if (response.status !== 200) {
                        // Fail, unable to join person data
                        Log.trace("CS340View::renderStudentSubmissions - unable to join person data; code: " + response.status);
                        return;
                    }

                    let jsonResponse = await response.json();
                    const personData: Person[] = jsonResponse.response;

                    if (personData === null) {
                        Log.trace("CS340View::renderStudentSubmissions - unable to parse person data");
                    }

                    // Person Lookup mapping, for close to constant lookups
                    let personIdMap: { [s: string]: Person } = {};
                    for (const person of personData) {
                        if (typeof personIdMap[person.id] === 'undefined') {
                            personIdMap[person.id] = person;
                        }
                    }

                    let table = new SortableTable(headers, "grades-table");
                }
            } else {
                Log.info("CS340View::renderStudentSubmissions - error; backend api response code: " + response.status);
            }
    // =======
    //     public async changeStudentList(delivId: string) {
    //         console.log(delivId);
    //
    //         const nav = document.querySelector('#myNavigator') as any;
    //         let page = nav.pushPage(Factory.getInstance().getHTMLPrefix() + "/deliverableView.html", {
    //             delivId: delivId
    //         });
    //
    //         Log.info("CS340View::renderStudentSubmission() -- Complete");
    //         console.log("data: "+ JSON.stringify(nav.topPage.data));
    //         // console.log();
    // >>>>>>> 6485a394b8e4acf9036fc5e5c2b3121698aa8cee
        }

        // Takes the data, and removes unnecessary data based on the delivId string, and returns a filtered Grade Array
        private processGradeTableData(data: Grade[], delivId: string): Grade[] {
            let returnArray: Grade[] = [];
            for (const grade of data) {
                if (grade.delivId === delivId || delivId === "all") {
                    returnArray.push(grade);
                }
            }
            return returnArray;
        }

        /!*
            // Using the submission data (grades), join the data with student and deliverable information
            private async processData(data: Grade[], delivId: string) {

                Log.info("CS340View::processResponse - start");
                const url = this.remote + '/portal/getAllPersons';
                let options : any = this.getOptions();
                options.method = 'get';
                let response = await fetch(url, options);

                if(response.status !== 200) {
                    // Fail, unable to join person data
                    Log.trace("CS340View::processResponse - unable to join person data; code: " + response.status);
                    return;
                }

                let jsonResponse = await response.json();
                const personData : Person[] = jsonResponse.response;

                if(personData === null) {
                    Log.trace("CS340View::processResponse - unable to parse person data");
                }

                // Person Lookup mapping, for close to constant lookups
                let personIdMap : {[s:string] : Person} = {};
                for(const person of personData) {
                    if(typeof personIdMap[person.id] === 'undefined') {
                        personIdMap[person.id] = person;
                    }
                }

                // let students : Map<string,String[]> = new Map<string, String[]>();
                let students : {[s: string]: any} = {};
                let delivNamesMap : {[s: string]: string} = {};

                // Prepare student map and deliverable map data
                for (var row of data) {
                    let personId = row.personId;

                    const deliverable = row.delivId;

                    // Create a new array for the given personId
                    if (typeof students[personId] === 'undefined') {
                        students[personId] = [];                            // get ready for grades
                    }

                    if (this.includeRecord(row, delivId)) {
                        // not captured yet
                        if (typeof delivNamesMap[deliverable] === 'undefined') {
                            delivNamesMap[deliverable] = deliverable;
                        }
                    }
                }

                // Basic sorting function based on strings
                const stringSort = function (a: string, b: string) {
                    return (a.localeCompare(b));
                };

                // Sort the deliverables list
                let delivKeys = Object.keys(delivNamesMap).sort(stringSort);

                let headers = ['ID', 'SNUM', 'First', 'Last'];

                headers = headers.concat(delivKeys);

                students['_index'] = headers;

                // UPDATE: At this point, we have all the headers in the Array that will be appended to the Table
                for (let row of data) {
                    if (this.includeRecord(row, delivId)) {
                        if(typeof personIdMap[row.personId] === 'undefined') {
                            Log.trace("CS340View::processResponse - error; something is wrong with the data");
                            continue;
                        }

                        const username = personIdMap[row.personId].githubId;
                        const deliverable = row.delivId;
                        const student = students[username];
                        const grade = row.score === null ? '' : row.score;
                        const index = delivKeys.indexOf(deliverable);

                        student.snum = personIdMap[row.personId].studentNumber;
                        student.fname = personIdMap[row.personId].fName;
                        student.lname = personIdMap[row.personId].lName;
                        student.username = personIdMap[row.personId].githubId;

                        if (typeof student.grades === 'undefined') {
                            student.grades = [];
                        }

                        // Gets an action-clickable-comment if a comment exists in the Grade object.
                        let htmlNoComment: string = grade;
                        let htmlComment: string = '<a class="adminGradesView__comment" href="#" data-comment="' + row.comments + '">' + grade + '</a>';
                        let html: string = row.comments === '' ? htmlNoComment : htmlComment;

                        student.grades[index] = {
                            value: grade,
                            html:  html
                        };

                        // row.delivDetails // UNUSED right now
                    }
                }

                // console.log('grade data processed: ' + JSON.stringify(students));
                return students;
            }*!/

        // Helper to decide if record should be included in table
        private includeRecord(data: Grade, delivId: string): boolean {
            if (delivId === "all" || data.delivId === delivId) {
                return true;
            }
            return false;
        }

        private checkIfWarning(gradeInputElement: HTMLInputElement): boolean {
            // TODO: Complete this
            return false; // stub
        }*/
}
