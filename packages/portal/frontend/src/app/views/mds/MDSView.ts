import {OnsButtonElement} from "onsenui";
import Log from "../../../../../../common/Log";
import {
    DeliverableTransport, GradeTransport,
    Payload, RepositoryTransport, StudentTransport,
    TeamFormationTransport,
    TeamTransport
} from "../../../../../../common/types/PortalTypes";

import {AssignmentGrade, AssignmentRubric} from "../../../../../../common/types/CS340Types";
import {SortableTable, TableCell, TableHeader} from "../../util/SortableTable";
import {UI} from "../../util/UI";
import {StudentView} from "../StudentView";

export class MDSView extends StudentView {

    private teams: TeamTransport[];
    private deliverables: DeliverableTransport[];
    private delivGradeMap: Map<string, GradeTransport> = new Map();
    private delivMap: Map<string, DeliverableTransport> = new Map();

    constructor(remoteUrl: string) {
        super();
        Log.info("MDSView::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('MDSView::renderPage() - start; options: ' + opts);
        const that = this;
        const start = Date.now();

        UI.showModal("Fetching data.");

        super.render().then(function() {
            // super render complete; do custom work
            return that.renderStudentPage();
        }).then(function() {
            Log.info('MDSView::renderPage(..) - prep & render took: ' + UI.took(start));
            UI.hideModal();
        }).catch(function(err) {
            Log.error('MDSView::renderPage() - ERROR: ' + err);
            UI.hideModal();
        });
    }

    private async renderStudentPage(): Promise<void> {
        UI.showModal('Fetching Data');
        try {
            Log.info('MDSView::renderStudentPage(..) - start');

            // grades rendered in StudentView

            // teams rendered here
            const teams = await this.fetchTeamData();
            this.teams = teams;
            // await this.renderTeams(teams);

            UI.hideSection('studentSelectPartnerDiv');
            UI.hideSection('studentPartnerDiv');

            await this.fetchDeliverableData();

            await this.renderDeliverables();
            await this.renderGradesDropdown();

            for (const grade of this.grades) {
                this.delivGradeMap.set(grade.delivId, grade);
            }

            for (const deliv of this.deliverables) {
                this.delivMap.set(deliv.id, deliv);
            }

            await this.updateTeams();

            await this.renderFinalGrade();

            Log.info('MDSView::renderStudentPage(..) - done');
        } catch (err) {
            Log.error('Error encountered: ' + err.message);
        }
        UI.hideModal();
        return;
    }

    private async renderGradesDropdown(): Promise<void> {
        Log.info(`CS340View::renderGradesDropdown(..) - start`);
        const that = this;
        const gradeDropdown = this.populateDeliverableDropdown("studentGradeSelect");
        if (gradeDropdown === null) {
            return;
        }
        gradeDropdown.addEventListener("change", async (evt) => {
            Log.info(`CS340View::renderGradesDropdown::onChange(..) - start with value: ` +
            `${(evt.target as HTMLSelectElement).value}`);
            await that.handleGradeChange((evt.target as HTMLSelectElement).value);
        });
        return;
    }

    private async handleGradeChange(delivId: string): Promise<void> {
        Log.info(`CS340View::handleGradeChange(${delivId}) - start`);

        if (delivId === "--N/A--") {
            UI.hideSection("studentGradesDiv");
            UI.hideSection("studentNoGradesDiv");
            return;
        }

        if (this.delivGradeMap.has(delivId)) {
            const grade: GradeTransport = this.delivGradeMap.get(delivId);
            const deliv: DeliverableTransport = this.delivMap.get(delivId);
            const customGrade = grade.custom;
            const studentGradeTable = document.getElementById("studentGradeBreakdownTable");
            if (typeof customGrade.assignmentGrade === "undefined" || typeof deliv.rubric === "undefined" ||
                typeof (deliv.rubric as AssignmentRubric).questions === "undefined") {
                // display normal grade
                studentGradeTable.innerHTML = `Grade: ${grade.score}`;
            } else {
                const rubric: AssignmentRubric = deliv.rubric as AssignmentRubric;
                const assignmentGrade: AssignmentGrade = customGrade.assignmentGrade;
                const headers: TableHeader[] = [{
                    id: 'exerciseId',
                    text: "Exercise Name",
                    sortable: false,
                    defaultSort: false,
                    sortDown: false,
                    style: 'padding-left: 1em; padding-right: 1em; text-align: left',
                }, {
                    id: 'grade',
                    text: 'Grade',
                    sortable: false,
                    defaultSort: false,
                    sortDown: false,
                    style: 'padding-left: 1em; padding-right: 1em; text-align: center;'
                }, {
                    id: 'outOf',
                    text: 'Out Of',
                    sortable: false,
                    defaultSort: false,
                    sortDown: false,
                    style: 'padding-left: 1em; padding-right: 1em; text-align: center;'
                }, {
                    id: 'feedback',
                    text: 'Feedback',
                    sortable: false,
                    defaultSort: false,
                    sortDown: false,
                    style: 'padding-left: 1em; padding-right: 1em; text-align: center;'
                }];

                const st = new SortableTable(headers, "#studentGradeBreakdownTable");
                let totalGrade: number = 0;
                let maxGrade: number = 0;

                for (let i = 0; i < assignmentGrade.questions.length; i++) {
                    const question = assignmentGrade.questions[i];
                    for (let j = 0; j < question.subQuestions.length; j++) {
                        if (i < rubric.questions.length && j < rubric.questions[i].subQuestions.length) {
                            const subRubric = rubric.questions[i].subQuestions[j];
                            const subQuestion = question.subQuestions[j];

                            const newRow: TableCell[] = [];
                            newRow.push({
                                value: `${question.name} ${subQuestion.name}`,
                                html: `${question.name} ${subQuestion.name}`}
                                );
                            newRow.push({value: subQuestion.grade.toFixed(2).toString(),
                                html: subQuestion.grade.toFixed(2).toString()});
                            newRow.push({value: subRubric.outOf.toString(), html: subRubric.outOf.toString()});
                            newRow.push({value: subQuestion.feedback, html: subQuestion.feedback});

                            totalGrade += subQuestion.grade * subRubric.weight;
                            maxGrade += subRubric.outOf;

                            st.addRow(newRow);
                        }
                    }
                }

                const totalRow: TableCell[] = [];
                totalRow.push({
                    value: "Total Grade",
                    html: "<b>Total Grade</b>"
                });
                totalRow.push({
                    value: totalGrade.toFixed(2).toString(),
                    html: totalGrade.toFixed(2).toString()
                });
                totalRow.push({
                    value: maxGrade.toString(),
                    html: maxGrade.toString()
                });
                totalRow.push({
                    value: "",
                    html: ""
                });

                st.addRow(totalRow);

                // for (const question of assignmentGrade.questions) {
                //     //
                //     for (const subQuestion of question.subQuestions) {
                //         const newRow: TableCell[] = [];
                //         newRow.push({value: subQuestion.name, html: subQuestion.name});
                //         newRow.push({value: subQuestion.grade.toString(), html: subQuestion.grade.toString()});
                //         newRow.push({value: subQuestion.outOf, html: subQuestion.outOf}); // need the rubric
                //         newRow.push({value: subQuestion.feedback, html: subQuestion.feedback});
                //         st.addRow(newRow);
                //     }
                // }

                st.generate();

                UI.showSection("studentGradesDiv");
                UI.hideSection("studentNoGradesDiv");
                }

        } else {
            UI.hideSection("studentGradesDiv");
            UI.showSection("studentNoGradesDiv");
        }

        return;
    }

    private async fetchTeamData(): Promise<TeamTransport[]> {
        try {
            this.teams = null;
            let data: TeamTransport[] = await this.fetchData('/portal/teams');
            if (data === null) {
                data = [];
            }
            this.teams = data;
            return data;
        } catch (err) {
            Log.error('MDSView::fetchTeamData(..) - ERROR: ' + err.message);
            this.teams = [];
            return [];
        }
    }

    private async fetchDeliverableData(): Promise<DeliverableTransport[]> {
        Log.info(`CS340AdminView::fetchDeliverableData() - start`);
        try {
            this.deliverables = null;
            const data = await this.fetchData('/portal/cs340/deliverables') as DeliverableTransport[];

            this.deliverables = data;
            return data;
        } catch (err) {
            Log.error(`CS340View::fetchDeliverableData() - Error: ${JSON.stringify(err)}`);
            this.teams = [];
            return [];
        }
    }

    private populateDeliverableDropdown(dropdownId: string): HTMLSelectElement {
        Log.info(`CS340View::populateDeliverableDropdown(${dropdownId}) - string`);

        const delivSelectElement = document.getElementById(dropdownId) as HTMLSelectElement;
        if (delivSelectElement === null) {
            Log.error(`CS340View::populateDeliverableDropdown(..) - Error: Unable to find dropdown with id: ${dropdownId}`);
            return null;
        }

        const deliverables = this.deliverables;
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

        return delivSelectElement;
    }

    private async renderDeliverables(): Promise<void> {
        Log.info(`CS340View::renderDeliverables(..) - start`);

        const that = this;
        const delivSelectElement = this.populateDeliverableDropdown("studentDeliverableSelect");

        Log.info(`CS340View::renderDeliverables(..) - hooking event listener`);

        delivSelectElement.addEventListener("change", async (evt) => {
            await that.updateTeams();
        });

        Log.info(`CS340View::renderDeliverables(..) - finished hooking event listener`);

        Log.info("MDSView::renderDeliverables(..) - finished rendering deliverable");

        return;
    }

    private async updateTeams(): Promise<void> {
        Log.info('MDSView::updateTeams(..) - start');

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
        Log.info('MDSView::updateTeams(..) - selected ' + delivId);

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

                Log.info("MDSView::updateTeams(..)::createTeam::onClick - selectedDeliv: " + selectedID);
                const teamCreation: TeamTransport = await that.formTeam(selectedID);
                Log.info("MDSView::updateTeams(..)::createTeam::onClick::then - result: " + JSON.stringify(teamCreation));
                if (teamCreation === null) {
                    return;
                }
                that.teams.push(teamCreation);

                UI.hideSection("studentSelectPartnerDiv");
                that.renderPage({});
            };

            const minTeam = document.querySelector("#minimumNum");
            const maxTeam = document.querySelector("#maximumNum");

            for (const delivInfo of this.deliverables) {
                if (delivInfo.id === delivId) {
                    minTeam.innerHTML = delivInfo.minTeamSize.toString();
                    maxTeam.innerHTML = delivInfo.maxTeamSize.toString();
                }
            }

            UI.showSection('studentSelectPartnerDiv');
            return;
        }
    }

    private async formTeam(selectedDeliv: string): Promise<TeamTransport> {
        Log.info("MDSView::formTeam() - start");
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

        Log.info("MDSView::formTeam() - URL: " + url + "; payload: " + JSON.stringify(payload));
        const response = await fetch(url, options);

        Log.info("MDSView::formTeam() - responded");

        const body = await response.json() as Payload;

        Log.info("MDSView::formTeam() - response: " + JSON.stringify(body));

        if (typeof body.success !== 'undefined') {
            // worked
            UI.notificationToast(`Successfully formed team with: ${JSON.stringify(idArray)}`);
            return body.success as TeamTransport;
        } else if (typeof body.failure !== 'undefined') {
            // failed
            UI.showError(body);
            return null;
        } else {
            Log.error("MDSView::formTeam() - else ERROR: " + JSON.stringify(body));
        }
    }

    private async renderFinalGrade(): Promise<void> {
        Log.info(`CS340View::renderFinalGrade(..) - start`);

        // checking if final grade is released

        const result = await this.fetchData(`/portal/cs340/isFinalGradeReleased`);
        // const result = true;
        if (result) {
            Log.info(`CS340View::renderFinalGrade(..) - Grades released; rendering`);

            const headers: TableHeader[] = [{
                id: 'itemId',
                text: "Item",
                sortable: true,
                defaultSort: false,
                sortDown: false,
                style: 'padding-left: 1em; padding-right: 1em; text-align: left',
            }, {
                id: 'rawGrade',
                text: 'Raw Grade',
                sortable: false,
                defaultSort: false,
                sortDown: false,
                style: 'padding-left: 1em; padding-right: 1em; text-align: center;'
            }, {
                id: 'maxGrade',
                text: 'Max Grade',
                sortable: false,
                defaultSort: false,
                sortDown: false,
                style: 'padding-left: 1em; padding-right: 1em; text-align: center;'
            }, {
                id: 'weight',
                text: 'Weight',
                sortable: false,
                defaultSort: false,
                sortDown: false,
                style: 'padding-left: 1em; padding-right: 1em; text-align: center;'
            }, {
                id: 'weightedGrade',
                text: 'Weighted Grade',
                sortable: false,
                defaultSort: false,
                sortDown: false,
                style: 'padding-left: 1em; padding-right: 1em; text-align: center;'
            }, {
                id: 'weightedTotal',
                text: 'Weighted Total',
                sortable: false,
                defaultSort: false,
                sortDown: false,
                style: 'padding-left: 1em; padding-right: 1em; text-align: center;'
            }];

            // prepare table
            const st = new SortableTable(headers, "#studentFinalGradeTable");
            let totalWeightedGrade: number = 0;
            let totalWeightedMaxGrade: number = 0;

            // get each deliverable and render
            for (const deliverableTransport of this.deliverables) {
                // get grade
                let score = 0;
                if (this.delivGradeMap.has(deliverableTransport.id)) {
                    Log.info(`CS340View::renderFinalGrades(..) - retriving score`);

                    const grade: GradeTransport = this.delivGradeMap.get(deliverableTransport.id);
                    score = grade.score;
                }

                let maxScore = score;
                if (deliverableTransport.rubric !== null && typeof deliverableTransport.rubric !== "undefined") {
                    // get max grade
                    Log.info(`CS340View::renderFinalGrades(..) - calculating maxScore`);
                    maxScore = this.getMaxScore(deliverableTransport.rubric as AssignmentRubric);
                }

                let weight = 1;

                if (typeof (deliverableTransport.custom as any).assignment !== "undefined" &&
                    (deliverableTransport.custom as any).assignment !== null) {
                    weight = (deliverableTransport.custom as any).assignment.courseWeight;
                }

                const weightedScore = score * weight;
                const weightedTotal = maxScore * weight;

                totalWeightedGrade += weightedScore;
                totalWeightedMaxGrade += weightedTotal;

                // TODO: Complete this
                const newRow: TableCell[] = [];
                newRow.push({
                    value: `${deliverableTransport.id}`,
                    html: `${deliverableTransport.id}`
                });

                newRow.push({
                    value: `${score}`,
                    html: `${score}`
                });

                newRow.push({
                    value: `${maxScore}`,
                    html: `${maxScore}`
                });

                newRow.push({
                    value: `${weight}`,
                    html: `${weight}`
                });

                newRow.push({
                    value: `${weightedScore}`,
                    html: `${weightedScore}`
                });

                newRow.push({
                    value: `${weightedTotal}`,
                    html: `${weightedTotal}`
                });

                st.addRow(newRow);
            }

            const totalRow: TableCell[] = [];

            totalRow.push({
                value: `Total`,
                html: `<b>Total</b>`
            });

            totalRow.push({
                value: ``,
                html: ``
            });

            totalRow.push({
                value: ``,
                html: ``
            });

            const percentRaw: number = (totalWeightedGrade / totalWeightedMaxGrade) * 100;

            totalRow.push({
                value: `${percentRaw.toFixed(2)}%`,
                html: `${percentRaw.toFixed(2)}%`,
            });

            totalRow.push({
                value: `${totalWeightedGrade}`,
                html: `${totalWeightedGrade}`
            });

            totalRow.push({
                value: `${totalWeightedMaxGrade}`,
                html: `${totalWeightedMaxGrade}`
            });

            st.addRow(totalRow);

            st.generate();
            UI.showSection("studentFinalGradeSection");

        } else {
            Log.info(`CS340View::renderFinalGrade(..) - Grades not released; hiding section`);
            UI.hideSection("studentFinalGradeSection");

        }

        return;
    }

    private getMaxScore(deliverableRubric: AssignmentRubric): number {
        Log.info(`CS340View::getMaxScore(..) - start`);
        if (deliverableRubric === null || typeof deliverableRubric.questions === "undefined") {
            Log.info(`CS340View::getMaxScore(..) - No rubric`);
            return 0;
        }

        let maxScore = 0;
        for (const question of deliverableRubric.questions) {
            for (const subQuestion of question.subQuestions) {
                maxScore += subQuestion.outOf * subQuestion.weight;
            }
        }

        return maxScore;
    }

    // private async renderTeams(teams: TeamTransport[]): Promise<void> {
    //     Log.trace('MDSView::renderTeams(..) - start');
    //     const that = this;
    //
    //     // make sure these are hidden
    //     UI.hideSection('studentSelectPartnerDiv');
    //     UI.hideSection('studentPartnerDiv');
    //
    //     // skip this all for now; we will redeploy when teams can be formed
    //     // if (Date.now() > 0) {
    //     //     return;
    //     // }
    //
    //     let projectTeam = null;
    //     for (const team of teams) {
    //         if (team.delivId === "project") {
    //             projectTeam = team;
    //         }
    //     }
    //
    //     if (projectTeam === null) {
    //         // no team yet
    //
    //         const button = document.querySelector('#studentSelectPartnerButton') as OnsButtonElement;
    //         button.onclick = function(evt: any) {
    //             Log.info('MDSView::renderTeams(..)::createTeam::onClick');
    //             that.formTeam().then(function(team) {
    //                 Log.info('MDSView::renderTeams(..)::createTeam::onClick::then - team created');
    //                 that.teams.push(team);
    //                 if (team !== null) {
    //                     that.renderPage({}); // simulating refresh
    //                 }
    //             }).catch(function(err) {
    //                 Log.info('MDSView::renderTeams(..)::createTeam::onClick::catch - ERROR: ' + err);
    //             });
    //         };
    //
    //         UI.showSection('studentSelectPartnerDiv');
    //     } else {
    //         // already on team
    //         UI.showSection('studentPartnerDiv');
    //
    //         const teamElement = document.getElementById('studentPartnerTeamName');
    //         // const partnerElement = document.getElementById('studentPartnerTeammates');
    //         const team = projectTeam;
    //         teamElement.innerHTML = team.id;
    //     }
    // }

/*
    private async formTeam(): Promise<TeamTransport> {
        Log.info("MDSView::formTeam() - start");
        const otherId = UI.getTextFieldValue('studentSelectPartnerText');
        const myGithubId = this.getStudent().githubId;
        const payload: TeamFormationTransport = {
            delivId:   'project', // only one team in cs310 (and it is always called project)
            githubIds: [myGithubId, otherId]
        };
        const url = this.remote + '/portal/team';
        const options: any = this.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(payload);

        Log.info("MDSView::formTeam() - URL: " + url + "; payload: " + JSON.stringify(payload));
        const response = await fetch(url, options);

        Log.info("MDSView::formTeam() - responded");

        const body = await response.json() as Payload;

        Log.info("MDSView::formTeam() - response: " + JSON.stringify(body));

        if (typeof body.success !== 'undefined') {
            // worked
            return body.success as TeamTransport;
        } else if (typeof body.failure !== 'undefined') {
            // failed
            UI.showError(body);
            return null;
        } else {
            Log.error("MDSView::formTeam() - else ERROR: " + JSON.stringify(body));
        }
    }
*/

}
