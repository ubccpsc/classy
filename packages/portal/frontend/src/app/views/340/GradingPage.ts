import {OnsInputElement} from "onsenui";
import Log from "../../../../../../common/Log";
import {AssignmentGrade, AssignmentRubric, SubQuestionRubric} from "../../../../../../common/types/CS340Types";
import {DeliverableTransport} from "../../../../../../common/types/PortalTypes";
import {UI} from "../../util/UI";
import {AdminDeliverablesTab} from "../AdminDeliverablesTab";
import {AdminPage} from "../AdminPage";

export class GradingPageView extends AdminPage {
    // private students: string[];
    // private isTeam: boolean;
    // private deliverableId: string;

    constructor(remote: string) {
        super(remote);
    }

    public async init(opts: any): Promise<void> {
        Log.info(`GradingPage::init(..) - opts: ${JSON.stringify(opts)}`);
        return await this.populateGradingPage(opts.aid, opts.sid, opts.isTeam);
    }

    public async populateGradingPage(delivId: string, studentId: string, isTeam: boolean = false): Promise<void> {
        Log.info(`GradingPage::populateGradingPage(${delivId}, ${studentId}, ${isTeam}) - start`);
        UI.showModal(`Populating grading view, please wait....`);

        const deliverables: DeliverableTransport[] = await AdminDeliverablesTab.getDeliverables(this.remote);
        const deliverable: DeliverableTransport = deliverables.find((deliverableTransport) => {
            return deliverableTransport.id === delivId;
        });

        if (deliverable === undefined || deliverable == null) {
            Log.error(`GradingPage::populateGradingPage(..) - ERROR: Unable to find deliverable object: ${delivId} in DB`);
            Log.error(`GradingPage::populateGradingPage(..) - deliverables: ${JSON.stringify(deliverables)}`);

            return null;
        }

        // retrieving rubric
        const rubric: AssignmentRubric = (deliverable.rubric) as AssignmentRubric;
        if (rubric === null) {
            // Log.error(`GradingPage::populateGradingPage(..) `);
            Log.error(`GradingPage::populateGradingPage(..) - ERROR: Assignment does not have a rubric`);
            // TODO: Attempt to generate rubric?
            return null;
        }

        Log.info(`GradingPage::populateGradingPage(${JSON.stringify(rubric)}`);

        const previousSubmission = await this.getPreviousSubmission(studentId, delivId);

        const assignmentInfoElement = document.getElementById('assignmentInfoSection');
        const gradingSectionElement = document.getElementById('gradingSection');

        const assignmentInfoList = document.createElement("div");
        const assignmentIDBox = document.getElementById("aidBox");
        const studentIDBox = document.getElementById("sidBox");

        if (isTeam) {
            const teamIndicator: HTMLParagraphElement = document.createElement("p");
            teamIndicator.innerHTML = "Editing team grade of: " + studentId;
            teamIndicator.id = "teamIndicator";
            assignmentInfoList.appendChild(teamIndicator);
        }

        const assignmentInfoAssignmentID = document.createElement("p");
        assignmentInfoAssignmentID.innerHTML = delivId;
        assignmentInfoAssignmentID.setAttribute("class", "aInfoID");

        const assignmentInfoStudentID = document.createElement("p");
        assignmentInfoStudentID.innerHTML = studentId;
        assignmentInfoStudentID.setAttribute("class", "aInfoSID");
        assignmentIDBox.appendChild(assignmentInfoAssignmentID);
        studentIDBox.appendChild(assignmentInfoStudentID);

        if (gradingSectionElement === null || assignmentInfoElement === null) {
            Log.error("CS340View::populateGradingPage() - Unable to populate page due to missing elements");
            return;
        }

        assignmentInfoElement.appendChild(assignmentInfoList);

        // Create a "DID NOT COMPLETE" button
        const dncButton = document.createElement("ons-button");
        dncButton.setAttribute("onclick", "window.myApp.view.submitGrade(false)");
        dncButton.setAttribute("style", "margin-left: 1em; background: red");
        dncButton.innerHTML = "No Submission";
        gradingSectionElement!.appendChild(dncButton);

        for (let i = 0; i < rubric.questions.length; i++) {
            // Get the i-th question
            const question = rubric.questions[i];

            const questionHeaderElement = document.createElement("h3");
            const questionHeader = document.createElement("span");
            const questionHeaderComponent1 = document.createElement("span");
            const questionHeaderComponent2 = document.createElement("span");

            // TODO: Check this
            questionHeaderComponent1.innerHTML = question.name;
            questionHeaderComponent1.setAttribute("class", "questionName");
            questionHeaderComponent2.setAttribute("class", "redText");
            questionHeaderComponent2.innerHTML = " *";

            questionHeader.appendChild(questionHeaderComponent1);
            questionHeader.appendChild(questionHeaderComponent2);
            questionHeaderElement.appendChild(questionHeader);
            gradingSectionElement.appendChild(questionHeaderElement);

            const questionBox = document.createElement("div");
            questionBox.setAttribute("class", "questionBox");

            for (let j = 0; j < question.subQuestions.length; j++) {
                const subQuestion: SubQuestionRubric = question.subQuestions[j];

                const questionSubBoxElement = document.createElement("div");
                questionSubBoxElement.setAttribute("class", "subQuestionBody");

                // Create the grade input element
                const subInfoBoxElement = document.createElement("div");
                subInfoBoxElement.setAttribute("class", "subQuestionInfoBox");

                // Contains the feedback box for the particular subquestion
                const subTextBoxElement = document.createElement("div");
                subTextBoxElement.setAttribute("class", "subQuestionTextBox");

                const subErrorBoxElement = document.createElement("div");
                subErrorBoxElement.setAttribute("class", "subQuestionErrorBox");

                // Create the grade input element
                const gradeInputElement = document.createElement("ons-input");
                gradeInputElement.setAttribute("type", "number");
                if (previousSubmission === null || !previousSubmission.questions[i].subQuestions[j].graded) {
                    gradeInputElement.setAttribute("placeHolder", subQuestion.name);
                } else {
                    gradeInputElement.setAttribute("placeHolder",
                        previousSubmission.questions[i].subQuestions[j].grade.toString());
                    (gradeInputElement as OnsInputElement).value = previousSubmission.questions[i].subQuestions[j].grade.toString();
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
                const errorBox = document.createElement("p");
                errorBox.setAttribute("class", "errorBox");

                // Add the error box to the info box section
                subInfoBoxElement.appendChild(errorBox);

                // Create input form for feedback form
                const textBoxElement = document.createElement("textArea");
                const textBoxLabelElement = document.createElement("p");
                textBoxLabelElement.innerHTML = "Comments & Feedback";
                textBoxLabelElement.setAttribute("class", "textboxLabel");
                textBoxElement.setAttribute("class", "textarea");
                textBoxElement.setAttribute("style", "width: 100%;height: 75%; min-width: 100px;min-height: 50px");
                if (previousSubmission !== null && previousSubmission.questions[i].subQuestions[j].graded) {
                    textBoxElement.innerHTML = previousSubmission.questions[i].subQuestions[j].feedback;
                }

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

        // Create a Save Grade button
        const submitButton = document.createElement("ons-button");
        submitButton.setAttribute("onclick", "window.myApp.view.submitGrade()");
        submitButton.innerHTML = "Save Grade";

        gradingSectionElement!.appendChild(submitButton);
        return null;
    }

    /**
     * Returns the student's previous submission, or null
     * @param studentId
     * @param deliverableId
     */
    private async getPreviousSubmission(studentId: string, deliverableId: string): Promise<AssignmentGrade> {
        // TODO: Complete this
        return null;
    }
}
