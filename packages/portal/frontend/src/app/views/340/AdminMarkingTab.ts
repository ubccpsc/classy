import Log from "../../../../../../common/Log";

import {
    DeliverableTransport,
    GradeTransport,
    GradeTransportPayload,
    StudentTransport,
    TeamTransport
} from "../../../../../../common/types/PortalTypes";
import {SortableTable, TableCell, TableHeader} from "../../util/SortableTable";

import {OnsSelectElement} from "onsenui";
import {AssignmentGrade, AssignmentRubric} from "../../../../../../common/types/CS340Types";
import {UI} from "../../util/UI";
import {AdminDeliverablesTab} from "../AdminDeliverablesTab";
import {AdminGradesTab} from "../AdminGradesTab";
import {AdminPage} from "../AdminPage";
import {AdminStudentsTab} from "../AdminStudentsTab";
import {AdminTeamsTab} from "../AdminTeamsTab";

export class AdminMarkingTab extends AdminPage {

    private selectedDeliverable: string | null = null;

    // private readonly remote: string; // url to backend
    constructor(remote: string) {
        // this.remote = remote;
        super(remote);
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminMarkingTab::init(..) - start');

        // NOTE: this could consider if studentListTable has children, and if they do, don't refresh
        document.getElementById('gradesListTable').innerHTML = ''; // clear target
        document.getElementById('gradesSummaryTable').innerHTML = ''; // clear target

        UI.showModal('Retrieving grades.');
        const delivs = await AdminDeliverablesTab.getDeliverables(this.remote);
        const students = await AdminStudentsTab.getStudents(this.remote);
        const grades = await AdminGradesTab.getGrades(this.remote);
        UI.hideModal();

        this.populateDeliverableDropdown(delivs);
    }

    private populateDeliverableDropdown(delivs: DeliverableTransport[]): void {
        // Add the deliverables to the dropdown
        Log.info(`AdminMarkingTab::render(..)`);
        let deliverableNames: string[] = [];
        for (const deliv of delivs) {
            deliverableNames.push(deliv.id);
        }
        deliverableNames = deliverableNames.sort();
        deliverableNames.unshift("--N/A--");
        UI.setDropdownOptions('markingDeliverableSelect', deliverableNames, this.selectedDeliverable);
        const dropdown: OnsSelectElement = document.getElementById("markingDeliverableSelect") as OnsSelectElement;

        dropdown.onchange = async (evt: any) => {
            Log.info(`AdminMarkingTab::render(..)::deliverableSelect::onchange - selected: ${
                (evt.target as HTMLSelectElement).value}`);
            // TODO: Render some new student submissions
            this.selectedDeliverable = (evt.target as HTMLSelectElement).value;
            await this.renderStudentSubmissions(this.selectedDeliverable);
        };

    }

    private async renderStudentSubmissions(delivId: string, hiddenNames: boolean = false) {
        Log.info(`AdminMarkingTab::renderStudentSubmissions(${delivId},${hiddenNames}) - start`);

        const emptyResultsElement = document.getElementById("markingListTableNone") as HTMLDivElement;
        const tabledResultsElement = document.getElementById("markingListTable") as HTMLDivElement;

        if (delivId === null || delivId === "null" || delivId === "--N/A--") {
            Log.info(`AdminMarkingTab::renderStudentSubmissions(..) - ${delivId} given; hiding the table`);
            UI.showSection(emptyResultsElement.id);
            UI.hideSection(tabledResultsElement.id);
            return;
        } else {
            Log.info(`AdminMarkingTab::renderStudentSubmissions(..) - ${delivId} given; showing the table`);
            UI.hideSection(emptyResultsElement.id);
            UI.showSection(tabledResultsElement.id);
        }

        UI.showModal("Retrieving data");
        const teamPromise = AdminTeamsTab.getTeams(this.remote);
        const studentPromise = AdminStudentsTab.getStudents(this.remote);
        const gradePromise = AdminGradesTab.getGrades(this.remote);
        const deliverablePromise = AdminDeliverablesTab.getDeliverables(this.remote);

        const [teamTransports, studentTransports, gradeTransports, deliverableTransports] = await Promise.all([
            teamPromise, studentPromise, gradePromise, deliverablePromise]);
        UI.hideModal();

        // build up student mapping (studentId -> studentObject)
        const studentIdMap: Map<string, StudentTransport> = new Map<string, StudentTransport>();
        for (const student of studentTransports) {
            if (!studentIdMap.has(student.id)) {
                studentIdMap.set(student.id, student);
            }
        }

        // build up grade mapping (studentId -> gradeObject)
        const gradeMap: Map<string, GradeTransport> = new Map<string, GradeTransport>();
        const filteredList = gradeTransports.filter((gradeTransport) => {
            return gradeTransport.delivId === delivId;
        });
        for (const grade of filteredList) {
            if (!gradeMap.has(grade.personId)) {
                gradeMap.set(grade.personId, grade);
            }
        }

        // retrieve deliverableInfo
        const deliverableTransport: DeliverableTransport = deliverableTransports.find((delivtransport) => {
            return delivtransport.id === delivId;
        });

        // build up table headers
        const tableHeaders: TableHeader[] = [];
        const maxTeamSize = deliverableTransport.maxTeamSize;
        if (!hiddenNames) {
            let firstHeader = true; // allows the first header to simply be sorted by default
            for (let i = 0; i < maxTeamSize; i++) {
                const newHeader: TableHeader = {
                    id:          'uid' + i,
                    text:        'id' + i,
                    sortable:    true,
                    defaultSort: firstHeader,
                    sortDown:    false,
                    style:       'padding-left: 1em; padding-right: 1em;'
                };
                firstHeader = false; // don't want any other headers to be 'default sorted'!
                tableHeaders.push(newHeader);
            }
        } else {
            // names are hidden
            // TODO: Implement hidden names
        }

        tableHeaders.push({
            id:          "grade",
            text:        "Grade",
            sortable:    true,
            defaultSort: false,
            sortDown:    false,
            style:       'padding-left: 1em; padding-right: 1em;'
        });

        const st = new SortableTable(tableHeaders, "#markingListTable");
        for (const team of teamTransports) {
            if (team.delivId !== delivId) {
                continue;
            }

            const newRow: TableCell[] = [];
            for (const personId of team.people) {
                newRow.push({value: personId, html: personId});
            }

            // handle uneven team sizes
            for (let i = team.people.length; i < maxTeamSize; i++) {
                newRow.push({value: "", html: ""}); // blank, just so table sizes are consistent
            }

            // ASSUMPTION: If students are on a team for a deliverable, they should all have the same grade
            const studentId: string = team.people[0];
            let newEntry: TableCell;
            // let completelyGraded: boolean = false;

            if (gradeMap.has(studentId)) {
                newEntry = this.buildGradeCell(studentId, gradeMap.get(studentId), deliverableTransport);
            } else {
                newEntry = this.buildGradeCell(studentId, null, deliverableTransport);
            }

            newRow.push(newEntry);

            st.addRow(newRow);

        }
        st.generate();
    }

    private checkIfCompletelyGraded(gradeTransport: GradeTransport): boolean {
        if (gradeTransport === null || typeof gradeTransport === "undefined") {
            return false;
        }

        // verify it contains assignment information
        if (!this.isAssignmentGrade(gradeTransport)) {
            return false;
        } else {
            return gradeTransport.custom.assignmentGrade.fullyGraded;
        }
    }

    /**
     * Returns true if the GradeTransport is an AssignmentGrade
     * @param obj
     */
    private isAssignmentGrade(obj: GradeTransport): boolean {
        return typeof obj.custom !== "undefined" && typeof obj.custom.assignmentGrade !== "undefined";
    }

    private isAssignment(obj: DeliverableTransport): boolean {
        return typeof obj.custom !== "undefined" && typeof (obj.custom as any).assignment !== "undefined";
    }

    private buildGradeCell(studentId: string, grade: GradeTransport, deliverable: DeliverableTransport): TableCell {
        Log.info(`AdminMarkingTab::buildGradeCell(${studentId},${JSON.stringify(grade)},..) - start`);

        let newEntry: TableCell;

        if (!this.isAssignment(deliverable)) {
            if (typeof grade === "undefined" || grade === null) {
                newEntry = {
                    value: "n/a",
                    html: `<span>n/a</span>`
                };
            } else {
                newEntry = {
                    value: grade.score,
                    html: `<span>${grade.score}</span>`
                };
            }
        } else {
            // deliverable is an assignment
            if (this.checkIfCompletelyGraded(grade)) {
                // completely graded
                const maxGrade = this.calculateMaxGrade(deliverable);
                newEntry = {
                    value: `${grade.score}`,
                    html: `<a onclick='window.myApp.view.transitionGradingPage` +
                        `("${studentId}","${deliverable.id}",true)' href='#'>${grade.score}/${maxGrade}</a>`
    // `<a onclick='this.transitionGradingPage("${studentId}",true)' href='#'>${grade.score}/${maxGrade}</a>`
                };
            } else {
                // not completely graded
                newEntry = {
                    value: "---",
                    html: `<a onclick='window.myApp.view.transitionGradingPage` +
                        `("${studentId}","${deliverable.id}",true)' href='#'>---</a>`
                    // html: `<a onclick='this.transitionGradingPage("${studentId}",true)' href='#'>---</a>`
                };
            }
        }

        return newEntry;
    }

    private calculateMaxGrade(deliverable: DeliverableTransport): number {
        if (deliverable === null || !this.isAssignment(deliverable)) {
            return 0;
        }

        let sum: number = 0;
        for (const question of ((deliverable.rubric) as AssignmentRubric).questions) {
            for (const subQuestion of question.subQuestions) {
                sum += subQuestion.outOf * subQuestion.weight;
            }
        }

        return sum;
    }
}
