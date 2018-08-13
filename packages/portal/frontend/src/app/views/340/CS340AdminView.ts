import {OnsButtonElement, OnsInputElement} from "onsenui";
import Log from "../../../../../../common/Log";
import {
    AssignmentGrade,
    AssignmentGradingRubric,
    AssignmentInfo,
    AssignmentStatus,
    QuestionGrade,
    SubQuestionGrade,
    SubQuestionGradingRubric
} from "../../../../../../common/types/CS340Types";
import {StudentTransport, StudentTransportPayload} from "../../../../../../common/types/PortalTypes";
import {Deliverable, Grade} from "../../../../../backend/src/Types";
import {Factory} from "../../Factory";
import {SortableTable, TableCell, TableHeader} from "../../util/SortableTable";
import {UI} from "../../util/UI";
import {AdminView} from "../AdminView";

const ERROR_POTENTIAL_INCORRECT_INPUT: string = "input triggered warning";
const ERROR_INVALID_INPUT: string = "invalid input";
const ERROR_NON_NUMERICAL_GRADE: string = "non-numerical grade entered";
const ERROR_NULL_RUBRIC: string = "null rubric-data";
const ERROR_MALFORMED_PAGE: string = "malformed page with info elements";

export class CS340AdminView extends AdminView {

    public renderPage(name: string, opts: {}) {
        Log.info('CS340AdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
        super.renderPage(name, opts);

        // custom view init here
        let optsObject : any = opts;

        // Testing framework (check if there is a testing value)
        if(typeof optsObject.test !== "undefined") {
            // Testing Page
            if(optsObject.test === "GradingView") {
                this.populateGradingPage("a1", "jopika").then(() => {
                    Log.info("CS340View::renderPage() - finished populating");
                    return;
                });
            }
            return;
        }

        // Normal structure
        if(name === 'GradingView') {
            if(typeof optsObject.aid !== "undefined" || typeof optsObject.sid !== "undefined") {
                // Check if the correct parameters exist
                this.populateGradingPage(optsObject.aid, optsObject.sid).then(()=> {
                    Log.info("CS340AdminView::renderPage() - finished populating page");
                    return;
                });
                return;
            }
        }

        if(name === 'AdminEditDeliverable') {
            Log.info("CS340AdminView::renderPage() - Deliverable editing page triggered");

            return;
        }
        // if(opsObject.page !== null) {
        //     console.log("got a non-null page value");
        //     if(opsObject.page === "cs340/GradingView.html") {
        //         if(typeof opsObject.delivId === 'undefined' || typeof  opsObject.sid === 'undefined') {
        //
        //         }
        //         // do stuff
        //         console.log("got into grading");
        //         this.populateGradingPage("a1", "jopika").then((result) => {
        //             Log.info("CS340View::renderPage() - finished populating");
        //         });
        //     }
        // }
    }

    protected async handleAdminEditDeliverable(opts: any) {
        //options: {"animationOptions":{},"delivId":"a3","page":"editDeliverable.html"}
        await super.handleAdminEditDeliverable(opts);
        // if the deliverable is an assignment, do something(?)
    }

    protected async handleAdminConfig(opts: any) {
        let that = this;
        await super.handleAdminConfig(opts);
        const selectDelivDropdown: HTMLSelectElement = document.querySelector('#adminActionDeliverableSelect') as HTMLSelectElement;
        await this.populateDeliverableDropdown(selectDelivDropdown);

        (document.querySelector('#adminActionSelectDeliverable') as OnsButtonElement).onclick = function (evt) {
            Log.info('CS340AdminView::handleAdminConfig(..) - action pressed');

            that.selectDeliverablePressed();
        };

        (document.querySelector('#adminCheckStatus') as OnsButtonElement).onclick = function (evt) {
            Log.info('CS340AdminView::handleAdminConfig(..) - action pressed');

            that.checkStatusAndUpdate(true);
        };

        (document.querySelector('#adminCreateRepositories') as OnsButtonElement).onclick = function (evt) {
            Log.info('CS340AdminView::handleAdminConfig(..) - action pressed');

            that.createRepoPressed();
        };

        (document.querySelector('#adminReleaseRepositories') as OnsButtonElement).onclick = function (evt) {
            Log.info('CS340AdminView::handleAdminConfig(..) - action pressed');

            that.releaseRepoPressed();
        };

        (document.querySelector('#adminDeleteRepositories') as OnsButtonElement).onclick = function (evt) {// DEBUG
            Log.info('CS340AdminView::handleAdminConfig(..) - action pressed');// DEBUG
                                    // DEBUG
            that.deleteRepoPressed();// DEBUG
        };// DEBUG


    }

    private async selectDeliverablePressed(): Promise<void> {
        Log.info('CS340AdminView::selectDeliverablePressed(..) - start');
        // Log.info('CS340AdminView::selectDeliverable(..) - ');
        const delivId: string | null = await this.checkStatusAndUpdate();

        // (un)lock other buttons
        const checkStatusButton = document.querySelector('#adminCheckStatus') as OnsButtonElement;
        const createRepoButton  = document.querySelector('#adminCreateRepositories') as OnsButtonElement;
        const releaseRepoButton = document.querySelector('#adminReleaseRepositories') as OnsButtonElement;
        const deleteRepoButton  = document.querySelector('#adminDeleteRepositories') as OnsButtonElement; // DEBUG

        if(delivId === null) {
            Log.info('CS340AdminView::selectDeliverable(..) - did not select deliv, locking buttons');
            checkStatusButton.disabled = true;
            createRepoButton.disabled = true;
            releaseRepoButton.disabled = true;
            deleteRepoButton.disabled = true; // DEBUG
        } else {
            checkStatusButton.disabled = false;
            createRepoButton.disabled = false;
            releaseRepoButton.disabled = false;
            deleteRepoButton.disabled = false; // DEBUG
        }

        Log.info('CS340AdminView::selectDeliverablePressed(..) - finished');

        return;
    }

    private async checkStatusAndUpdate(update: boolean = false): Promise<string | null> {
        Log.info('CS340AdminView::checkStatusAndUpdate(..) - start');

        const delivDropdown = document.querySelector('#adminActionDeliverableSelect') as HTMLSelectElement;
        const value = delivDropdown.value;

        const statusBox = document.querySelector('#adminActionStatusText') as HTMLParagraphElement;
        statusBox.innerHTML = "";

        const delivIDBox = document.querySelector('#adminActionDeliverableID') as HTMLParagraphElement;
        delivIDBox.innerHTML = "";

        if(value === null || value == "null") return null;
        if(value === "--N/A--") return null;

        Log.trace("CS340AdminView::checkStatusAndUpdate(..) - value: " + value);
        let url: string;

        if(update) {
            UI.showModal("Recalcuating status, this may take a while");
            url = this.remote + '/portal/cs340/updateAssignmentStatus/' + value;
        } else {
            url = this.remote + '/portal/cs340/getAssignmentStatus/' + value;
        }

        let options: any = AdminView.getOptions();

        options.method = 'get';
        let response = await fetch(url, options);

        if(update) UI.hideModal();

        if(response.status === 200) {
            let responsejson = await response.json();
            // get the textbox
            switch (responsejson.response) {
                case AssignmentStatus.INACTIVE: {
                    statusBox.innerHTML = ": INACTIVE";
                    break;
                }
                case AssignmentStatus.INITIALIZED: {
                    statusBox.innerHTML = ": INITIALIZED";
                    break;
                }
                case AssignmentStatus.PUBLISHED: {
                    statusBox.innerHTML = ": PUBLISHED";
                    break;
                }
                case AssignmentStatus.CLOSED: {
                    statusBox.innerHTML = ": CLOSED";
                    break;
                }
                default: {
                    Log.trace('CS340AdminView::checkStatusAndUpdate(..) - error; ' +
                        'deliverable not set up properly');

                    UI.notification("Broken Status; value: " + responsejson.response);
                    return null;
                }
            }
        } else {
            UI.notification("Deliverable not set up properly!");
            return null;
        }

        delivIDBox.innerHTML = value;
        return value;
    }

    private async createRepoPressed(): Promise<void> {
        Log.info('CS340AdminView::createRepoPressed(..) - start');
        // Log.info('CS340AdminView::createRepoPressed(..) - start');

        const delivIDBox = document.querySelector('#adminActionDeliverableID') as HTMLParagraphElement;
        const delivID = delivIDBox.innerHTML;

        Log.info('CS340AdminView::createRepoPressed(..) - ' + delivID + " selected, beginning repo creation");

        UI.showModal("Creating repositories, please wait... This action may take a while....");

        const url = this.remote + '/portal/cs340/initializeAllRepositories/' + delivID;
        let options: any = AdminView.getOptions();

        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();

        const jsonResponse = await response.json();
        if(response.status === 200) {
            if(jsonResponse.response == true) {
                UI.notification("Success; All repositories created!");
            } else {
                UI.notification("Error: Some repositories were not created, please try again");
            }
        } else {
            Log.error("Issue with creating repositories; status: " + response.status);

            UI.notification("Error: " + jsonResponse.error);
        }

        this.checkStatusAndUpdate();
        Log.info('CS340AdminView::createRepoPressed(..) - finish');

        return;
    }

    private async releaseRepoPressed(): Promise<void> {
        Log.info('CS340AdminView::releaseRepoPressed(..) - start');
        // Log.info('CS340AdminView::releaseRepoPressed(..) - start');

        const delivIDBox = document.querySelector('#adminActionDeliverableID') as HTMLParagraphElement;
        const delivID = delivIDBox.innerHTML;

        Log.info('CS340AdminView::releaseRepoPressed(..) - ' + delivID + " selected, beginning repo publishing");

        UI.showModal("Releasing repositories, please wait...");

        const url = this.remote + '/portal/cs340/publishAllRepositories/' + delivID;
        let options: any = AdminView.getOptions();

        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();


        const jsonResponse = await response.json();
        if(response.status === 200) {
            if(jsonResponse.response == true) {
                UI.notification("Success; All repositories released!");
            } else {
                UI.notification("Error: Some repositories were not released, please try again");
            }
        } else {
            Log.error("Issue with releasing repositories; status: " + response.status);

            UI.notification("Error: " + jsonResponse.error);
        }

        this.checkStatusAndUpdate();
        Log.info('CS340AdminView::releaseRepoPressed(..) - finish');

        return;
    }

    private async deleteRepoPressed(): Promise<void> {
        Log.warn('CS340AdminView::deleteRepoPressed(..) - start');
        // Log.warn('CS340AdminView::deleteRepoPressed(..) - start');

        const delivIDBox = document.querySelector('#adminActionDeliverableID') as HTMLParagraphElement;
        const delivID = delivIDBox.innerHTML;

        Log.warn('CS340AdminView::deleteRepoPressed(..) - ' + delivID + " selected, beginning repo deleting");

        UI.showModal("Deleting repositories, please wait...");

        const url = this.remote + '/portal/cs340/deleteAllRepositories/' + delivID;
        let options: any = AdminView.getOptions();

        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();


        const jsonResponse = await response.json();
        if(response.status === 200) {
            if(jsonResponse.response == true) {
                UI.notification("Success; All repositories deleted!");
            } else {
                UI.notification("Error: Some repositories were not deleted, please try again");
            }
        } else {
            Log.error("Issue with deleting repositories; status: " + response.status);

            UI.notification("Error: " + jsonResponse.error);
        }

        this.checkStatusAndUpdate();
        Log.warn('CS340AdminView::deleteRepoPressed(..) - finish');

        return;
    }

    private async populateDeliverableDropdown(dropDown: HTMLSelectElement): Promise<void> {
        const deliverables = await this.getDeliverables();
        // const delivDropdown = document.querySelector('#adminDefaultDeliverableSelect') as HTMLSelectElement;
        let delivOptions = ['--N/A--'];
        for (const deliv of deliverables) {
            delivOptions.push(deliv.id);
        }
        delivOptions = delivOptions.sort();

        dropDown.innerHTML = '';
        for (const delivId of delivOptions) {
            let selected = false;

            let value = delivId;
            if (delivId.startsWith('--')) {
                // handle the null case
                value = null;
            }

            const o: HTMLOptionElement = new Option(delivId, value, false, selected);
            dropDown.add(o);
        }
        return;
    }

    private async getDeliverables() {
        const delivOptions = AdminView.getOptions();
        const delivUrl: string = this.remote + '/portal/cs340/getAllDeliverables';
        const delivResponse = await fetch(delivUrl, delivOptions);

        if(delivResponse.status !== 200) {
            Log.trace("CS340AdminView::renderStudentGrades(..) - !200 " +
                "response received; code:" + delivResponse.status);
            return;
        }
        const delivJson = await delivResponse.json();
        const delivArray: Deliverable[] = delivJson.response;

        return delivArray;
    }

    public async handleAdminCustomGrades(opts: any) {
        Log.info("CS340AdminView::handleCustomGrades( " + JSON.stringify(opts) + " ) - start");
        // if(opts.delivid === null || opts.sid === null) {
        //     Log.error("CS340AdminView::handleCustomGrades()")
        // }
        const start = Date.now();
        UI.showModal("Retrieving student list");

        // Retrieve the studentGradeTable
        document.getElementById('studentGradeTable').innerHTML = ""; // Clear target

        const studentOptions = AdminView.getOptions();
        const studentUrl = this.remote + '/portal/admin/students';
        const studentResponse = await fetch(studentUrl, studentOptions);
        UI.hideModal();
        if(studentResponse.status === 200) {
            Log.info('CS340AdminView::handCustomGrades(..) - Received student list');
            const studentJson: StudentTransportPayload = await studentResponse.json();
            if(typeof studentJson.success !== 'undefined' && Array.isArray(studentJson.success)) {
                Log.info("CS340AdminView::handCustomGrades(..) - took: " + UI.took(start));
                const gradesOptions: any= AdminView.getOptions();
                gradesOptions.method = 'get';
                const gradesUrl: string = this.remote + '/portal/cs340/getAllGrades';
                const gradesResponse = await fetch(gradesUrl, gradesOptions);

                if(gradesResponse.status === 200) {
                    Log.info("CS340AdminView::handCustomGrades(..) - got grades");
                    const gradesJson = await gradesResponse.json();
                    const gradeData: Grade[] = gradesJson.response;
                    // TODO [Jonathan]: Remove the hardcoding(?)
                    this.renderStudentGrades(studentJson.success, gradeData, "-All-");
                } else {
                    Log.trace("CS340AdminView::handCustomGrades(..) - !200 received " +
                        "when retrieving grade: " + gradesResponse.status);
                }
            } else {
                Log.info("CS340AdminView::handCustomGrades(..) - ERROR: " + studentJson.failure.message);
                AdminView.showError(studentJson.failure);
            }
        } else {
            Log.trace("CS340AdminView::handCustomGrades(..) - !200 received when retrieving students: " +
                studentResponse.status);
            const text = await studentResponse.text();
            AdminView.showError(text);
        }
    }

    private async renderStudentGrades(students: StudentTransport[], grades: Grade[], selectedAssign: string) {
        Log.info("CS340AdminView::renderStudentGrades( " + students.toString() +
            ", " + grades.toString() + ", " + selectedAssign + ", " + " ) - start");

        // const delivOptions = AdminView.getOptions();
        // const delivUrl: string = this.remote + '/portal/getAllDeliverables';
        // const delivResponse = await fetch(delivUrl, delivOptions);
        //
        // if(delivResponse.status !== 200) {
        //     Log.trace("CS340AdminView::renderStudentGrades(..) - !200 " +
        //         "response received; code:" + delivResponse.status);
        //     return;
        // }
        // const delivJson = await delivResponse.json();
        // const delivArray: Deliverable[] = delivJson.response;
        const delivArray: Deliverable[] = await this.getDeliverables();

        let tableHeaders: TableHeader[] = [
            {
                id:          'id',
                text:        'Github Id',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'fName',
                text:        'First Name',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'lName',
                text:        'Last Name',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            }
        ];
        let filteredDelivArray: Deliverable[] = [];
        let maxGradeMap: {[delivId:string]:number} = {};

        for (const deliv of delivArray) {
            if(selectedAssign === "-All-" || selectedAssign === deliv.id) {
                Log.info("CS340AdminView::renderStudentGrades(..) - Adding deliverable: " + deliv.id);
                let newHeader = {
                    id:             deliv.id,
                    text:           deliv.id,
                    sortable:       false,
                    defaultSort:    false,
                    sortDown:       true,
                    style:          'padding-left: 1em; padding-right: 1em;',
                };
                filteredDelivArray.push(deliv);
                tableHeaders.push(newHeader);

                // process max grade
                let maxGrade:number = 0;
                let assignInfo: AssignmentInfo | null = deliv.custom;
                if(assignInfo === null || typeof assignInfo === 'undefined') continue;
                let assignRubric: AssignmentGradingRubric = assignInfo.rubric;
                if(assignRubric === null || typeof assignRubric === 'undefined') continue;

                for(const questionRubric of assignRubric.questions) {
                    for(const subQuestionRubric of questionRubric.subQuestions) {
                        // TODO: Take into account weight
                        maxGrade += subQuestionRubric.outOf;
                    }
                }
                maxGradeMap[deliv.id] = maxGrade;
            }
        }

        const st = new SortableTable(tableHeaders, "#studentGradeTable");
        // For each grade, let
        let gradeMapping: {[studentId:string]:{[delivId:string]:Grade}} = {};
        for(const grade of grades) {
            if (typeof gradeMapping[grade.personId] === 'undefined') {
                // If there is no mapping from person to map(delivId,grade)
                // set up the mapping
                gradeMapping[grade.personId] = {};
            }
            // If the grade is a valid AssignmentGrade, place it in the mapping
            if(grade.custom !== null && typeof grade.custom.assignmentID !== "undefined") {
                gradeMapping[grade.personId][grade.custom.assignmentID] = grade;
            }
        }

        for(const student of students) {
            // TODO [Jonathan]: Add SID and hideable student names
            let newRow: TableCell[] = [
                {value: student.id, html: '<a href="' + student.userUrl + '">' + student.id + '</a>'},
                {value: student.firstName, html: student.firstName},
                {value: student.lastName, html: student.lastName},
            ];
            for(const delivCol of filteredDelivArray) {
                let foundGrade = false;
                if(typeof gradeMapping[student.id] === "undefined") gradeMapping[student.id] = {};
                if(typeof gradeMapping[student.id][delivCol.id] !== "undefined") foundGrade = true;
                if(foundGrade) {
                    let newEntry = {

                        value: gradeMapping[student.githubId][delivCol.id].score,
                        html: "<a onclick='window.myApp.view.transitionGradingPage(\""+
                        student.githubId + "\", \"" + delivCol.id + "\")' href='#'>" +
                        gradeMapping[student.githubId][delivCol.id].score.toString() +

                        "/" + maxGradeMap[delivCol.id] + "</a>"
                    };
                    newRow.push(newEntry);

                } else {
                    let newEntry = {
                        value: "---",

                        html: "<a onclick='window.myApp.view.transitionGradingPage(\""+
                        student.githubId + "\", \"" + delivCol.id + "\")' href='#'> ---" + "</a>",

                    };
                    newRow.push(newEntry);

                }
            }
            st.addRow(newRow);
        }

        st.generate();

        // TODO [Jonathan]: Add rest of code, regarding student table generation (hideable options)
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

        let previousSubmission = await this.getStudentGrade(sid, delivId);

        let assignmentInfoElement = document.getElementById('assignmentInfoSection');
        let gradingSectionElement = document.getElementById('gradingSection');

        let assignmentInfoList  = document.createElement("div");
        let assignmentIDBox     = document.getElementById("aidBox");
        let studentIDBox        = document.getElementById("sidBox");

        let assignmentInfoAssignmentID = document.createElement("p");
        assignmentInfoAssignmentID.innerHTML = delivId;
        assignmentInfoAssignmentID.setAttribute("class", "aInfoID");

        let assignmentInfoStudentID = document.createElement("p");
        assignmentInfoStudentID.innerHTML = sid;
        assignmentInfoStudentID.setAttribute("class", "aInfoSID");
        assignmentIDBox.appendChild(assignmentInfoAssignmentID);
        studentIDBox.appendChild(assignmentInfoStudentID);

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
                if(previousSubmission === null) {
                    gradeInputElement.setAttribute("placeHolder", subQuestion.name);
                } else {
                    gradeInputElement.setAttribute("placeHolder",
                        previousSubmission.questions[i].subQuestion[j].grade.toString());
                }
                gradeInputElement.setAttribute("data-type", subQuestion.name);
                gradeInputElement.setAttribute("modifier", "underbar");
                gradeInputElement.setAttribute("class", "subQuestionGradeInput");
                gradeInputElement.setAttribute("onchange",
                    "window.myApp.view.checkIfWarning(this)");
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
        submitButton.setAttribute("onclick", "window.myApp.view.submitGrade()");
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
                    if(!errorStatus) errorComment = ERROR_NULL_RUBRIC;
                    errorStatus = true;
                    continue;
                }

                // If the grade value retrieved is not a number, default the value to 0
                if (isNaN(gradeValue)) {
                    gradeValue = 0;
                    if(!errorStatus) errorComment = ERROR_NON_NUMERICAL_GRADE;
                    errorStatus = true;
                    errorElement.innerHTML = "Error: Must specify a valid number";
                    continue;
                } else {
                    // If the gradeValue is an actual number
                    // check if there are any warnings about the input value
                    if (this.checkIfWarning(gradeInputElement)) {
                        if(!errorStatus) errorComment = ERROR_POTENTIAL_INCORRECT_INPUT;
                        errorStatus = true;
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
            if(!errorStatus) errorComment = ERROR_MALFORMED_PAGE;
            errorStatus = true;
        }

        if(errorStatus) {
            if(errorComment !== ERROR_POTENTIAL_INCORRECT_INPUT || !confirm("Warning: " +
                "Potential incorrect value entered into page! " +
                "Do you still wish to save?")) {
                Log.error("CS340View::submitGrade() - Unable to submit data; error: " + errorComment);
                return null;
            }
        }

        let sid = aInfoSIDElements[0].innerHTML;
        let aid = aInfoIDElements[0].innerHTML;

        let newAssignmentGrade : AssignmentGrade = {
            assignmentID: aid,
            studentID: sid,
            released: false,
            questions: questionArray
        };

        const url = this.remote + '/portal/cs340/setAssignmentGrade';
        Log.info("CS340View::submitGrade() - uri: " + url);

        UI.showModal("Submitting grade, please wait...");
        // Call the function
        let options: any = AdminView.getOptions();

        options.method = 'put';
        options.headers.Accept = 'application/json';
        options.json = true;
        options.body = JSON.stringify(newAssignmentGrade);

        Log.info("CS340View::submitGrade() - request body: " + options.body);

        let response = await fetch(url, options);

        UI.hideModal();
        Log.info("CS340View::submitGrade() - response from api " + response);
        if(response.status !== 200) {
            const errResponse = await response.json();
            Log.info("CS340AdminView::submitGrade() - error submitting grades, code: " + response.status +
            " error: " + response.statusText);
            alert(errResponse.error);
            return null;
        }
        UI.popPage();
        return newAssignmentGrade;
    }

    public async getStudentGrade(sid: string, aid: string): Promise<AssignmentGrade | null> {
        Log.info("CS340View::getStudentGrade(" + sid + ", " + aid + ") - start");
        let options: any = AdminView.getOptions();
        options.method = 'get';
        let uri = this.remote + '/portal/cs340/getAssignmentGrade/' + sid + '/' + aid;
        let response = await fetch(uri, options);

        let reply;
        if(response.status !== 200) {
            Log.info("CS340View::getStudentGrade(..) - unable to find grade record");
            reply =  null;
        } else {
            Log.info("CS340View::getStudentGrade(..) - found grade record");
            let responseJson = await response.json();
            reply = responseJson.result;
        }
        Log.info("CS340View::getStudentGrade(..) - finish");
        return reply;
    }

    public async getGradingRubric(assignmentId: string): Promise<AssignmentGradingRubric | null> {
        Log.info("CS340View::getGradingRubric(" + assignmentId + ") - start");
        const url = this.remote + '/portal/cs340/getAssignmentRubric/' + assignmentId;
        Log.info("CS340View::getGradingRubric(...) - uri: " + url);

        UI.showModal("Getting grading rubric, please wait...");
        // Call the function
        let options: any = AdminView.getOptions();

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

    public async initializeRepositories(assignmentId: string): Promise<boolean> {
        Log.info("CS340View::initializeRepositories(" + assignmentId + ") - start");
        // Log.info("CS340View::initializeRepositories(..) - ");

        const url = this.remote + '/portal/cs340/initializeAllRepositories/' + assignmentId;
        Log.info("CS340View::initializeRepositories(..) - uri: " + url);

        let options: any = AdminView.getOptions();
        options.method = 'post';

        UI.showModal("Initializing repositories, this will take a while...");
        let response = await fetch(url, options);
        UI.hideModal();

        let jsonResponse = await response.json();
        if (response.status === 200) {
            Log.info("CS340View::initializeRepositories(..) - completed: " + jsonResponse.response);
            return jsonResponse.response;
        } else {
            Log.info("CS340View::initializeRepositories(..) - !200; Code: " + jsonResponse.error);
            UI.notification(jsonResponse.error);
        }
        return false;
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

    private checkIfWarning(gradeInputElement: OnsInputElement) : boolean {
        // TODO: Complete this
        // data-outOf
        let gradeValue: number = parseFloat(gradeInputElement.value);
        let gradeOutOf: number = parseFloat(gradeInputElement.getAttribute("data-outOf"));
        let parentElement: HTMLElement = gradeInputElement.parentElement;
        let errorBox = parentElement.getElementsByClassName("errorBox");
        if(gradeValue < 0 || gradeValue > gradeOutOf) {
            errorBox[0].innerHTML = "Warning: Grade out of bounds";
            return true;
        } else {
            errorBox[0].innerHTML = "";
            return false;
        }
    }

    public testfunction() {
        console.log("A spooky message!");
        // UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/GradingView.html', {
        //     hello:"world"
        //     ,page: Factory.getInstance().getHTMLPrefix() + '/GradingView.html'
        // }).then(()=> {
        //     this.renderPage({page: Factory.getInstance().getHTMLPrefix() + '/GradingView.html'});
        //     console.log("all done!");
        // });
        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/GradingView.html', {
            test: "GradingView"
        });
    }

    public transitionGradingPage(sid:string, aid:string) {
        // Move to grading
        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/GradingView.html', {
            sid:sid,
            aid:aid
        });
    }
}
