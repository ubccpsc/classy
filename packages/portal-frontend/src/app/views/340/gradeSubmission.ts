import {
    AssignmentGrade,
    AssignmentGradingRubric,
    QuestionGrade,
    QuestionGradingRubric, SubQuestionGradingRubric
} from "../../../../../common/types/CS340Types";


let MARK_THRESHOLD_MULTIPLIER_WARNING = 1.5;

class ConnectionConfig {
    // URLs to various places
    baseURL: string;
    orgName: string;
    courseName: string;
    repoPrefix: string;
    staffRepo: string;
    studentRepo: string;
    gradesRepo: string;
    staffTeam: string;
    studentTeam: string;

    constructor(baseURL: string, orgName: string, courseName: string,
                repoPrefix: string, staffRepo: string, studentRepo: string,
                gradesRepo: string, staffTeam: string, studentTeam: string) {
        this.baseURL = baseURL;
        this.orgName = orgName;
        this.courseName = courseName;
        this.repoPrefix = repoPrefix;
        this.staffRepo = staffRepo;
        this.studentRepo = studentRepo;
        this.gradesRepo = gradesRepo;
        this.staffTeam = staffTeam;
        this.studentTeam = studentTeam;
    };

    loadDefaultConfig() {
        this.baseURL     = "https://github.com";
        this.orgName     = "CPSC340";
        this.courseName  = "CPSC 340";
        this.repoPrefix  = "CPSC_340";
        this.staffRepo   = "CPSC_340_instructors";
        this.studentRepo = "CPSC_340_students";
        this.gradesRepo  = "CPSC_340_grades_instructors";
        this.staffTeam   = "CPSC_340_staff";
        this.studentTeam = "students_test";
    }
}

/*// Represents a subquestion submission, with a rubric section name and a grade associated
interface SubsectionGrade {
    sectionName: string;
    grade: number;
    feedback: string;
}

interface CourseConfig {
    labs: GradingSchema[];
    exams: GradingSchema[];
}

// TODO: Consider changing the File Parsing to utilize the Database on Classy
interface GradingSchema {
    weight: number;
    peerReview: boolean;
    publicAfterSubmit: boolean;
    mainFile: string;
    mainDir: string;
}

interface MarkBreakdown {
    name: string;
    outOf: number;
    comment: string;
}*/

// Returns the Grading Schema, based on the name and the appropriate type
// e.g. retrieveGradingRubric("labs", "lab1") returns the grading schema for lab1
//
function retrieveGradingRubric(type: string, name: string) : AssignmentGradingRubric {
    // stub TODO [Jonathan]: Call REST api and get the rubric

    return {
        name: "Assignment 1",
        comment: "",
        questions: [{
            name: "Question 2",
            comment: "",
            subQuestions: [{
                name: "explanation",
                comment: "",
                outOf: 4,
                weight: 1,
                modifiers: null
            }, {
                name: "coding",
                comment: "",
                outOf: 5,
                weight: 1,
                modifiers: null
            }]
        }, {
            name: "Question 2",
            comment: "",
            subQuestions: [{
                name: "coding",
                comment: "",
                outOf: 10,
                weight: 1,
                modifiers: null
            }]
        }]
    }
/*    return {
        weight: 0,
        peerReview: false,
        publicAfterSubmit: false,
        mainFile: "",
        mainDir: ""
    }
*/
}

// TODO: Make this more robust
// Returns an array of Array of markbreakdowns
function getAssignmentRubric(assID: string) : AssignmentGradingRubric {
    // TODO [Jonathan]: Call REST api and get the rubric
    // stub
    return {
        name: "Assignment 1",
        comment: "",
        questions: [{
            name: "Question 2",
            comment: "",
            subQuestions: [{
                name: "explanation",
                comment: "",
                outOf: 4,
                weight: 1,
                modifiers: null
            }, {
                name: "coding",
                comment: "",
                outOf: 5,
                weight: 1,
                modifiers: null
            }]
        }, {
            name: "Question 2",
            comment: "",
            subQuestions: [{
                name: "coding",
                comment: "",
                outOf: 10,
                weight: 1,
                modifiers: null
            }]
        }]
    };
    //
    // return [[{name:"reasoning", outOf: 5, comment: ""}],
    //     [{name:"reasoning", outOf: 3, comment: ""},
    //         {name:"code", outOf: 3, comment: ""},
    //         {name:"language", outOf: 4, comment: ""}],
    //     [{name: "reasoning", outOf: 2, comment: ""}],
    //     [{name: "reasoning", outOf: 7, comment: ""}]];
}

function getStudentGrade(sid: string) : AssignmentGrade {
    // TODO [Jonathan]: Call the REST API and get the grade
    return null; // stub
}


// Adds grading items to the webpage
// Consumes an assignment ID and a student ID and displays the grading view
function populateGrading(assID: string, sid: string) {
    // TODO: Don't use a hardcoded thing :)
    // TODO: Implement this

    let assignmentGradingRubric = getAssignmentRubric("labs/lab1.md");
    let previousGrading : AssignmentGrade = getStudentGrade("");
    let gradingSectionElement = document.getElementById("gradingSection");
    let assignmentInfoElement = document.getElementById("assignmentSection");

    let count = 0;

    if (previousGrading != null) {
        // do something here
    }

    if (gradingSectionElement == null || assignmentInfoElement == null) {
        console.log("Error getting Elements from page, is the page malformed?");
        return; // Error
    }

    for (let i = 0; i < assignmentGradingRubric.questions.length; i++) {
        let question : QuestionGradingRubric = assignmentGradingRubric.questions[i];
// TODO: Generate a question header !!REVISIT THIS!!
        count++;
        let questionHeaderElement = document.createElement("h3"); // New header

        let questionHeader = document.createElement("span");

        let questionHeaderComponent1 = document.createElement("span");
        questionHeader.innerHTML = "Question " + count;

        let questionHeaderComponent2 = document.createElement("span");
        questionHeaderComponent2.setAttribute("class", "redText");
        questionHeaderComponent2.innerHTML = " *";

        questionHeader.appendChild(questionHeaderComponent1);
        questionHeader.appendChild(questionHeaderComponent2);

        questionHeaderElement.appendChild(questionHeader);
        // questionHeaderElement.appendChild(questionHeaderComponent2);


        if (gradingSectionElement === null) {
            return null;
        }

        gradingSectionElement.appendChild(questionHeaderElement);

        let questionBox = document.createElement("div");
        questionBox.setAttribute("class", "questionBox");

        for(let j = 0; j < question.subQuestions.length; j++) {
            let markBreakdown : SubQuestionGradingRubric = question.subQuestions[j];
            // TODO: Generate the subgrouping for each element
            let questionSubBoxElement = document.createElement("div");
            questionSubBoxElement.setAttribute("class", "subQuestionBody");

            // Contains the question grade input
            let subInfoBoxElement = document.createElement("div");
            subInfoBoxElement.setAttribute("class", "subQuestionInfoBox");

            // Contains the feedback for the particular subquestion
            let subTextBoxElement = document.createElement("div");
            subTextBoxElement.setAttribute("class", "subQuestionTextBox");

            let subErrorBoxElement = document.createElement("div");
            subErrorBoxElement.setAttribute("class", "subQuestionErrorBox");

            let gradeType : string = markBreakdown.name;
            let gradeOutOf : number = markBreakdown.outOf;
            // Create the grade input element
            let gradeInputElement = document.createElement("ons-input");
            gradeInputElement.setAttribute("type", "number");
            gradeInputElement.setAttribute("placeHolder", gradeType);
            gradeInputElement.setAttribute("data-type", gradeType);
            gradeInputElement.setAttribute("modifier", "underbar");
            gradeInputElement.setAttribute("class", "subQuestionGradeInput");
            gradeInputElement.setAttribute("onchange", "checkIfWarning(this)");
            gradeInputElement.setAttribute("data-outOf", "" + gradeOutOf);
            gradeInputElement.innerHTML = gradeType + " [out of " + gradeOutOf + "]";

            // Add the grade input element to the infoBox
            subInfoBoxElement.appendChild(gradeInputElement);

            let errorBox = document.createElement("p");
            errorBox.setAttribute("class", "errorBox");

            subInfoBoxElement.appendChild(errorBox);

            // Input form for feedback form
            let textBoxElement = document.createElement("textArea");
            let textBoxLabelElement = document.createElement("p");
            textBoxLabelElement.innerHTML = "Comments & Feedback";
            textBoxLabelElement.setAttribute("class", "textboxLabel");
            textBoxElement.setAttribute("class", "textarea");
            textBoxElement.setAttribute("style", "width: 100%;height: 75%; min-width: 100px;min-height: 50px");
            subTextBoxElement.appendChild(textBoxLabelElement);
            subTextBoxElement.appendChild(textBoxElement);


            questionSubBoxElement.appendChild(subInfoBoxElement);
            questionSubBoxElement.appendChild(subTextBoxElement);

            // Add the subBox to the question box
            questionBox.appendChild(questionSubBoxElement);
        }

        // Add the questionBox to the gradingSection
        gradingSectionElement!.appendChild(questionBox);
    }

    // Create
    let submitButton = document.createElement("ons-button");
    submitButton.setAttribute("onclick", "submitGrades()");
    submitButton.innerHTML = "Submit";

    gradingSectionElement!.appendChild(submitButton);
}

// Checks if there should be any warnings displayed in reference to the InputElement
function checkIfWarning(event: HTMLInputElement): void {
    let inputBox: HTMLInputElement = event;
    let errorBoxes = inputBox.parentElement!.getElementsByClassName("errorBox");
    console.log(errorBoxes);
    if (errorBoxes.length !== 1) {
        return;
    }

    let errorBox = errorBoxes[0];
    let maxGradeString = inputBox.getAttribute("data-outOf");
    if (maxGradeString === null) {
        return;
    }

    let maxGrade = parseFloat(maxGradeString);

    if (parseFloat(inputBox.value) >= maxGrade * MARK_THRESHOLD_MULTIPLIER_WARNING) {
        errorBox.innerHTML = "Warning: Grade is signifigantly higher than max grade";
    } else {
        errorBox.innerHTML = "";
    }
}


// Pulls all fields and returns a JSON
function submitGrades(): Array<Array<SubsectionGrade>> {
    // TODO: Complete this
    let error = false;
    let gradeSubmission_default = [[]];
    let gradeSubmission = [];
    let questionBoxes = document.getElementsByClassName("questionBox");

    for (let i = 0; i < questionBoxes.length; i++) {
        // A single question box, representative of many subquestions
        let questionBox = questionBoxes[i];

        // Get each subquestion from the question box
        let subQuestions = questionBox.getElementsByClassName("subQuestionBody");
        let newQuestionGrade = [];

        for (let j = 0; j < subQuestions.length; j++) {
            // Get a single subQuestion
            let subQuestion = subQuestions[j];

            // Grab the elements associated with the subQuestion
            let gradeInputElements = subQuestion.getElementsByClassName("subQuestionGradeInput");
            let responseBoxElements = subQuestion.getElementsByClassName("textarea");

            // Check if there is exactly one element in each
            // otherwise something is malformed with the webpage.
            if (gradeInputElements.length !== 1 || responseBoxElements.length !== 1) {
                // Display an error
                console.log("Error: Something went wrong during website generation");
                alert("Error: Malformed webpage; Please contact web-admin");

                return gradeSubmission_default;
            }

            //
            let errorElements = subQuestion.getElementsByClassName("errorBox");
            if (errorElements.length !== 1) {
                return gradeSubmission_default;
            }
            let errorElement = errorElements[0];

            // Grab the element
            let gradeInputElement = gradeInputElements[0] as HTMLInputElement;
            let responseBoxElement = responseBoxElements[0] as HTMLTextAreaElement;

            // Get the type from the embedded HTML data
            let rubricType = gradeInputElement.getAttribute("data-type");
            // Retrieve the value inputted into the form field
            let gradeValue = parseFloat(gradeInputElement.value);

            // If the value is not found, set it to a default empty string
            if (rubricType === null) {
                rubricType = "";
                error = true;
            }

            // If the grade value retrieved is not a number, default the value to 0
            if (isNaN(gradeValue)) {
                gradeValue = 0;
                error = true;

                errorElement.innerHTML = "Error: Must specify a valid number";
                console.log("not given a number!");
            } else {
                // If the gradeValue is an actual number
                // check if there are any warnings about the input value
                checkIfWarning(gradeInputElement);
            }

            // Create a new object
            let newSubGrade = {
                sectionName: rubricType,
                grade: gradeValue,
                feedback: responseBoxElement.value
            };

            // Push the object into the Array
            newQuestionGrade.push(newSubGrade);
        }

        // Push the entire question into the array
        gradeSubmission.push(newQuestionGrade);
    }

    console.log(gradeSubmission); // TODO: Remove this (Debugging purposes)

    // TODO: Do something to signal what happened
    if (error) {
        // Display error prompt
    } else {
        //
    }

    return gradeSubmission; // TODO: Remove this
}

