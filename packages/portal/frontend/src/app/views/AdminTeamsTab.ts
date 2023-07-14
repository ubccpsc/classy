import Log from "@common/Log";

import {CourseTransport, RepositoryTransport, StudentTransport, TeamTransport, TeamTransportPayload} from "@common/types/PortalTypes";

import {SortableTable, TableCell, TableHeader} from "../util/SortableTable";
import {UI} from "../util/UI";

import {AdminPage} from "./AdminPage";
import {AdminResultsTab} from "./AdminResultsTab";
import {AdminStudentsTab} from "./AdminStudentsTab";
import {AdminView} from "./AdminView";
import {AdminDeliverablesTab} from "./AdminDeliverablesTab";

export class AdminTeamsTab extends AdminPage {

    private teams: TeamTransport[] = [];
    private students: StudentTransport[] = [];
    private staff: StudentTransport[] = [];
    private course: CourseTransport = null;
    private repos: RepositoryTransport[] = [];

    constructor(remote: string) {
        super(remote);
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info("AdminTeamsTab::init(..) - start; opts: " + JSON.stringify(opts));
        const start = Date.now();

        document.getElementById("teamsListTable").innerHTML = ""; // clear target
        // document.getElementById("teamsIndividualListTable").innerHTML = ""; // clear target

        this.students = [];
        this.teams = [];
        this.repos = [];

        UI.showModal("Retrieving teams.");
        this.course = await AdminView.getCourse(this.remote);

        const provisionDelivs = (await AdminDeliverablesTab.getDeliverables(this.remote))
            .filter((deliv) => deliv.shouldProvision);
        this.repos = await AdminResultsTab.getRepositories(this.remote);
        this.teams = await AdminTeamsTab.getTeams(this.remote);
        this.students = await AdminStudentsTab.getStudents(this.remote);

        this.staff = await AdminStudentsTab.getStaff(this.remote);

        if (typeof opts.delivId === "undefined") {
            const defaultDelivProvisions = provisionDelivs
                .some((deliv) => deliv.id === this.course.defaultDeliverableId);
            if (defaultDelivProvisions) {
                opts.delivId = this.course.defaultDeliverableId;
            } else {
                opts.delivId = "-None-";
            }
        }

        if (typeof opts.labSection === "undefined") {
            opts.labSection = "-All-";
        }

        const dStr = ["-None-"];
        for (const deliv of provisionDelivs) {
            dStr.push(deliv.id);
        }
        // opts = opts.sort();
        UI.setDropdownOptions("teamsListSelect", dStr, opts.delivId);

        const delivSelector = document.querySelector("#teamsListSelect") as HTMLSelectElement;
        const statusSelector = document.querySelector("#teamsListStatusSelect") as HTMLSelectElement;

        const that = this;

        const updateTeamTable = function () {
            const delivValue = delivSelector.value.valueOf();
            const statusValue = statusSelector.value.valueOf();
            Log.info("AdminTeamsTab::init(..)::updateTeamTable() - deliv: " +
                delivValue + "; status: " + statusValue);

            if (statusValue === "formed") {
                Log.info("AdminTeamsTab::init(..)::updateTeamTable() - rendering formed");
                that.renderTeams(that.teams, delivValue, opts.labSection); // if cached data is ok
            } else {
                Log.info("AdminTeamsTab::init(..)::updateTeamTable() - rendering unformed");
                that.renderIndividuals(that.teams, that.students, delivValue, opts.labSection); // if cached data is ok
            }
        };

        delivSelector.onchange = function (evt) {
            Log.info("AdminTeamsTab::init(..) - deliv changed");
            evt.stopPropagation(); // prevents list item expansion
            updateTeamTable();
        };

        statusSelector.onchange = function (evt) {
            Log.info("AdminTeamsTab::init(..) - status changed");
            evt.stopPropagation(); // prevents list item expansion

            updateTeamTable();
        };

        const labSelector = document.querySelector("#teamsListLabSelect") as HTMLSelectElement;
        labSelector.onchange = function (evt) {
            Log.info("AdminTeamsTab::init(..) - lab changed");
            evt.stopPropagation(); // prevents list item expansion

            const val = labSelector.value.valueOf();
            opts.labSection = val;
            updateTeamTable();
        };

        updateTeamTable();

        UI.hideModal();
    }

    // private render(teams: TeamTransport[], delivId: string): void {
    //     this.renderTeams(teams, delivId);
    // }

    private renderTeams(teams: TeamTransport[], delivId: string, labSection: string): void {
        Log.trace("AdminTeamsTab::renderTeams(.., " + delivId + ", " + labSection + ") - start");
        const headers: TableHeader[] = [
            {
                id: "num",
                text: "#",
                sortable: true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown: false, // Whether the column should initially sort descending or ascending.
                style: "padding-left: 1em; padding-right: 1em;"
            },
            {
                id: "id",
                text: "Team Id",
                sortable: true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown: false, // Whether the column should initially sort descending or ascending.
                style: "padding-left: 1em; padding-right: 1em;"
            },
            {
                id: "repo",
                text: "Repository",
                sortable: true,
                defaultSort: false,
                sortDown: false,
                style: "padding-left: 1em; padding-right: 1em;"
            },
            {
                id: "labs",
                text: "Labs",
                sortable: true,
                defaultSort: false,
                sortDown: false,
                style: "padding-left: 1em; padding-right: 1em;"
            },
            {
                id: "p1",
                text: "First Member",
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: "padding-left: 1em; padding-right: 1em;"
            },
            {
                id: "p2",
                text: "Second Member",
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: "padding-left: 1em; padding-right: 1em;"
            },
            {
                id: "p3",
                text: "Third Member",
                sortable: true,
                defaultSort: false,
                sortDown: true,
                style: "padding-left: 1em; padding-right: 1em;"
            }
        ];

        let labSectionsOptions = ["-All-", "-Unspecified-"];
        const st = new SortableTable(headers, "#teamsListTable");
        let listContainsStudents = false;

        let count = 1;
        for (const team of teams) {
            let p1 = "";
            let p2 = "";
            let p3 = "";
            if (team.people.length === 0) {
                // do nothing
            } else if (team.people.length === 1) {
                p1 = this.getPersonCell(team.people[0]);
            } else if (team.people.length === 2) {
                p1 = this.getPersonCell(team.people[0]);
                p2 = this.getPersonCell(team.people[1]);
            } else if (team.people.length === 3) {
                p1 = this.getPersonCell(team.people[0]);
                p2 = this.getPersonCell(team.people[1]);
                p3 = this.getPersonCell(team.people[2]);
            }

            let repoName = null;
            let repoURL = null;
            for (const repo of this.repos) {
                if (repo.id === team.id) {
                    repoName = repo.id;
                    repoURL = repo.URL;
                }
            }
            let repoDisplay = "<a class='selectable' href='" + repoURL + "'>" + repoName + "</a>";
            if (repoURL === null) {
                // repo not yet provisioned; do not show anything
                repoDisplay = "";
            }

            let teamDisplay = "<a class='selectable' href='" + team.URL + "'>" + team.id + "</a>";
            if (team.URL === null) {
                // team not yet provisioned, do not turn this into a link
                teamDisplay = team.id;
            }

            const labs = this.getLabsCell(team.people);

            const row: TableCell[] = [
                {value: count, html: count + ""},
                {value: team.id, html: teamDisplay},
                {value: repoName, html: repoDisplay},
                {value: labs, html: labs},
                {value: p1, html: p1},
                {value: p2, html: p2},
                {value: p3, html: p3}
            ];

            if (labSectionsOptions.indexOf(labs) < 0 && labs !== "" && labs !== null) {
                labSectionsOptions.push(labs);
            }

            if (delivId === team.delivId && team.people.length > 0) {
                count++;

                if (labSection === labs ||
                    labSection === "-All-" ||
                    (labSection === "-Unspecified-" &&
                        (labs === "" || labs === null))) {
                    st.addRow(row);
                }
                // st.addRow(row);
                listContainsStudents = true;
            }
        }

        st.generate();

        labSectionsOptions = labSectionsOptions.sort();
        UI.setDropdownOptions("teamsListLabSelect", labSectionsOptions, labSection); // TODO: last should be labSection

        // if (st.numRows() > 0) {
        //     UI.showSection("teamsListTable");
        //     UI.hideSection("teamsListTableNone");
        // } else {
        //     UI.hideSection("teamsListTable");
        //     UI.showSection("teamsListTableNone");
        // }
    }

    private getLabsCell(people: string[]): string {
        const labs = people
            .map((personId) => this.getPerson(personId)?.labId)
            .filter((lab) => !!lab);
        return [...new Set(labs)].sort().join(",");
    }

    private getPerson(personId: string): StudentTransport | null {
        return this.students.find((student) => student.id === personId) ?? null;
    }

    private getStaff(personId: string): StudentTransport | null {
        return this.staff.find((staff) => staff.id === personId) ?? null;
    }

    /**
     * Convert personId to a more useful representation for staff to understand.
     *
     * Also add links if available.
     *
     * @param {string} personId
     * @returns {string}
     */
    private getPersonCell(personId: string): string {
        let render = personId;

        const student = this.getPerson(personId);
        if (student === null) {
            // user is either a staff or a withdrawn student
            const staff = this.getStaff(personId);
            // atest ids are often used for sample repos course staff can work with
            if (staff === null && personId.startsWith("atest-") === false) {
                // withdrawn student
                render = "Withdrawn: " + personId;
            } else {
                // staff
                render = "Staff: " + personId;
            }
            return render;
        }

        if (student?.id === personId) {
            if (student.userUrl !== null && student.userUrl.startsWith("http") === true) {
                render = "<a class='selectable' href='" + student.userUrl + "'>" +
                    student.githubId + "</a> [" + student.id + "] (" + student.firstName + " " + student.lastName + ")";
            } else {
                render = student.githubId + " (" + student.firstName + " " + student.lastName + ")";
            }
        }
        return render;
    }

    private renderIndividuals(teams: TeamTransport[], students: StudentTransport[], delivId: string, labSection: string): void {
        Log.trace("AdminTeamsTab::renderIndividuals(.., " + delivId + ", " + labSection + ") - start");

        const headers: TableHeader[] = [
            {
                id: "num",
                text: "#",
                sortable: true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: false, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown: false, // Whether the column should initially sort descending or ascending.
                style: "padding-left: 1em; padding-right: 1em;"
            },
            {
                id: "lab",
                text: "Lab",
                sortable: true,
                defaultSort: false,
                sortDown: false,
                style: "padding-left: 1em; padding-right: 1em;"
            },
            {
                id: "id",
                text: "Student",
                sortable: true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown: false, // Whether the column should initially sort descending or ascending.
                style: "padding-left: 1em; padding-right: 1em;"
            }
        ];

        let labSectionsOptions = ["-All-", "-Unspecified-"];
        const st = new SortableTable(headers, "#teamsListTable");

        const studentsOnTeams: string[] = [];
        for (const team of teams) {

            if (team.delivId === delivId) {
                for (const p of team.people) {
                    studentsOnTeams.push(p);
                }
            }
        }

        let listContainsStudents = false;
        let count = 1;
        for (const student of students) {
            if (studentsOnTeams.indexOf(student.id) < 0) {

                const lab = student.labId ?? "";

                if (labSectionsOptions.indexOf(lab) < 0 && lab !== "" && lab !== null) {
                    labSectionsOptions.push(lab);
                }

                const studentHTML = student.firstName + " " + student.lastName +
                    " <a class='selectable' href='" + student.userUrl + "'>" +
                    student.githubId + "</a> (" + student.firstName + " " +
                    student.lastName + ")";

                const row: TableCell[] = [
                    {value: count, html: count++ + ""},
                    {value: lab, html: lab},
                    {value: student.id, html: studentHTML}
                ];
                if (delivId !== "-None-") {

                    if (labSection === lab ||
                        labSection === "-All-" ||
                        (labSection === "-Unspecified-" &&
                            (lab === "" || lab === null))) {
                        st.addRow(row);
                    }
                    // st.addRow(row);
                    listContainsStudents = true;
                }
            }
        }

        labSectionsOptions = labSectionsOptions.sort();
        UI.setDropdownOptions("teamsListLabSelect", labSectionsOptions, labSection);

        st.generate();

        // if (st.numRows() > 0) {
        //     UI.showSection("teamsIndividualListTable");
        //     UI.hideSection("teamsIndividualListTableNone");
        // } else {
        //     UI.hideSection("teamsIndividualListTable");
        //     UI.showSection("teamsIndividualListTableNone");
        // }

    }

    public static async getTeams(remote: string): Promise<TeamTransport[]> {
        Log.info("AdminTeamsTab::getTeams( .. ) - start");
        try {
            const start = Date.now();
            const options = AdminView.getOptions();
            const url = remote + "/portal/admin/teams";
            const response = await fetch(url, options);

            if (response.status === 200) {
                Log.trace("AdminTeamsTab::getTeams(..) - 200 received");
                const json: TeamTransportPayload = await response.json();
                if (typeof json.success !== "undefined" && Array.isArray(json.success)) {
                    Log.trace("AdminTeamsTab::getTeams(..)  - worked; # teams: " +
                        json.success.length + "; took: " + UI.took(start));
                    return json.success;
                } else {
                    Log.trace("AdminTeamsTab::getTeams(..)  - ERROR: " + json.failure.message);
                    AdminView.showError(json.failure); // FailurePayload
                }
            } else {
                Log.trace("AdminTeamsTab::getTeams(..)  - !200 received: " + response.status);
                const text = await response.text();
                AdminView.showError(text);
            }
        } catch (err) {
            AdminView.showError("Getting teams failed: " + err.message);
        }
        return [];
    }
}
