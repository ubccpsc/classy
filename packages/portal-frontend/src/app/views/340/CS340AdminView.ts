import {AdminView} from "../AdminView";
import Log from "../../../../../common/Log";
import {
    AssignmentGrade,
    AssignmentGradingRubric, QuestionGrade, SubQuestionGrade,
    SubQuestionGradingRubric
} from "../../../../../common/types/CS340Types";
import {UI} from "../../util/UI";
import {Factory} from "../../Factory";

export class CS340AdminView extends AdminView {

    public renderPage(name: string, opts: {}) {
        Log.info('CS340AdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
        super.renderPage(name, opts);

        // custom view init here
        let opsObject : any = opts;
        if(opsObject.page !== null) {
            console.log("got a non-null page value");
            if(opsObject.page === "cs340/gradingView.html") {
                // do stuff
                console.log("got into grading");
                this.populateGradingPage("a1", "jopika").then((result) => {
                    Log.info("CS340View::renderPage() - finished populating");
                });
            }
        }
    }

    public handleAdminCustomGrades(opts: any) {
        Log.info("CS340AdminView::handleCustomGrades( " + JSON.stringify(opts) + " ) - start");
        // if(opts.delivid === null || opts.sid === null) {
        //     Log.error("CS340AdminView::handleCustomGrades()")
        // }

    }

    /**
     * Grabs the page and adds the grading view as specified in the deliverable
     * @param {string} delivId
     * @param {string} sid
     * @returns {Promise<void>}
     */
    public async populateGradingPage(delivId: string, sid : string) {
        Log.info("CS340View::populateGradingPage() - start");

        UI.showModal("Populating grading view, please wait...");
        let rubric : AssignmentGradingRubric = await this.getGradingRubric(delivId);
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

            for(let j = 0; j < question.subQuestions.length; j++) {
                let subQuestion : SubQuestionGradingRubric = question.subQuestions[j];

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

    public async submitGrade(): Promise<AssignmentGrade|null> {
        let errorStatus = false;
        let errorComment: String = "";
        let questionArray : QuestionGrade[] = [];
        let questionBoxes = document.getElementsByClassName("questionBox");

        for (let i = 0; i < questionBoxes.length; i++) {
            // A single question box, representative of many subquestions
            let questionBox = questionBoxes[i];
            // Get each subquestion from the questionBox
            let subQuestions = questionBox.getElementsByClassName("subQuestionBody");
            // initalize an array to place all the information inside
            let subQuestionArray : SubQuestionGrade[] = [];

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
                if(gradeInputElements.length !== 1 ||
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
                    if(!errorStatus) errorComment = "null rubric-data";
                    errorStatus = true;
                    continue;
                }

                // If the grade value retrieved is not a number, default the value to 0
                if (isNaN(gradeValue)) {
                    gradeValue = 0;
                    if(!errorStatus) errorComment = "non-numerical grade entered";
                    errorStatus = true;
                    errorElement.innerHTML = "Error: Must specify a valid number";
                    continue;
                } else {
                    // If the gradeValue is an actual number
                    // check if there are any warnings about the input value
                    if (this.checkIfWarning(gradeInputElement)) {
                        if(!errorStatus) errorComment = "input triggered warning";
                        errorStatus = true;
                        continue;
                    }
                }

                let newSubGrade : SubQuestionGrade = {
                    sectionName: rubricType,
                    grade: gradeValue,
                    feedback: responseBoxElement.value
                };

                subQuestionArray.push(newSubGrade);
            }

            let questionNames = document.getElementsByClassName("questionName");
            // if(questionNames.length !== 1) {
            //     if(!errorStatus) errorComment = "malformed page with questionName";
            //     errorStatus = true;
            //     continue;
            // }

            let newQuestion : QuestionGrade = {
                questionName: questionNames[i].innerHTML,
                commentName: "",
                subQuestion: subQuestionArray
            };

            questionArray.push(newQuestion);
        }

        let aInfoSIDElements = document.getElementsByClassName("aInfoSID");
        let aInfoIDElements = document.getElementsByClassName("aInfoID");

        if (aInfoSIDElements.length !== 1 || aInfoIDElements.length !== 1) {
            if(!errorStatus) errorComment = "malformed page with info elements";

            errorStatus = true;
        }

        if(errorStatus) {
            Log.error("CS340View::submitGrade() - Unable to submit data; error: " + errorComment);
            return null;
        }

        let sid = aInfoSIDElements[0].innerHTML;
        let aid = aInfoIDElements[0].innerHTML;

        let newAssignmentGrade : AssignmentGrade = {
            assignmentID: aid,
            studentID: sid,
            questions: questionArray
        };

        // TODO: Record in database the new Grade
        const url = this.remote + '/setAssignmentGrade';
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

    public async getGradingRubric(assignmentId: string): Promise<AssignmentGradingRubric | null> {
        Log.info("CS340View::getGradingRubric(" + assignmentId + ") - start");
        const url = this.remote + '/getAssignmentRubric/' + assignmentId;
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

    // protected getOptions() {
    //     const options = {
    //         headers: {
    //             user:  localStorage.user,
    //             token: localStorage.token,
    //             org:   localStorage.org
    //         }
    //     };
    //     return options;
    // }

    private checkIfWarning(gradeInputElement: HTMLInputElement) : boolean {
        // TODO: Complete this
        return false; // stub
    }

    public testfunction() {
        console.log("A spooky message!");
        // UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/gradingView.html', {
        //     hello:"world"
        //     ,page: Factory.getInstance().getHTMLPrefix() + '/gradingView.html'
        // }).then(()=> {
        //     this.renderPage({page: Factory.getInstance().getHTMLPrefix() + '/gradingView.html'});
        //     console.log("all done!");
        // });
        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/gradingView.html', {
            page: Factory.getInstance().getHTMLPrefix() + '/gradingView.html'
        });
    }
}
