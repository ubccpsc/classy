/**
 * This is the main student page for CS310.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsButtonElement} from "onsenui";
import Log from "../../../../../../common/Log";
import {
    DeliverableTransport, GradeTransport,
    Payload, RepositoryTransport, StudentTransport,
    TeamFormationTransport,
    TeamTransport
} from "../../../../../../common/types/PortalTypes";

import {UI} from "../../util/UI";
import {StudentView} from "../StudentView";

export class CS340View extends StudentView {

    private teams: TeamTransport[];
    private deliverables: DeliverableTransport[];

    constructor(remoteUrl: string) {
        super();
        Log.info("CS340View::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('CS340View::renderPage() - start; options: ' + opts);
        const that = this;
        const start = Date.now();

        UI.showModal("Fetching data.");

        super.render().then(function() {
            // super render complete; do custom work
            return that.renderStudentPage();
        }).then(function() {
            Log.info('CS340View::renderPage(..) - prep & render took: ' + UI.took(start));
            UI.hideModal();
        }).catch(function(err) {
            Log.error('CS340View::renderPage() - ERROR: ' + err);
            UI.hideModal();
        });
    }

    private async renderStudentPage(): Promise<void> {
        UI.showModal('Fetching Data');
        try {
            Log.info('CS340View::renderStudentPage(..) - start');

            // grades rendered in StudentView

            // teams rendered here
            const teams = await this.fetchTeamData();
            this.teams = teams;
            // await this.renderTeams(teams);

            await this.fetchDeliverableData();

            await this.renderDeliverables();

            Log.info('CS340View::renderStudentPage(..) - done');
        } catch (err) {
            Log.error('Error encountered: ' + err.message);
        }
        UI.hideModal();
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
            Log.error('CS340View::fetchTeamData(..) - ERROR: ' + err.message);
            this.teams = [];
            return [];
        }
    }

    private async fetchDeliverableData(): Promise<DeliverableTransport[]> {
        Log.info(`CS340AdminView::fetchDeliverableData() - Start`);
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

    private async renderDeliverables(): Promise<void> {
        Log.info(`CS340View:L:renderDeliverables(..) - start`);

        const that = this;
        const deliverables = this.deliverables;
        const delivSelectElement = document.getElementById("studentDeliverableSelect") as HTMLSelectElement;
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

        Log.info(`CS340View::renderDeliverables(..) - hooking event listener`);

        delivSelectElement.addEventListener("change", async (evt) => {
            await that.updateTeams();
        });

        Log.info(`CS340View::renderDeliverables(..) - finished hooking event listener`);

        Log.info("CS340View::renderDeliverables(..) - finished rendering deliverable");

        return;
    }

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
                    minTeam.innerHTML = delivInfo.minTeamSize.toString();
                    maxTeam.innerHTML = delivInfo.maxTeamSize.toString();
                }
            }

            UI.showSection('studentSelectPartnerDiv');
            return;
        }
    }

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

    // private async renderTeams(teams: TeamTransport[]): Promise<void> {
    //     Log.trace('CS340View::renderTeams(..) - start');
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
    //         const teamElement = document.getElementById('studentPartnerTeamName');
    //         // const partnerElement = document.getElementById('studentPartnerTeammates');
    //         const team = projectTeam;
    //         teamElement.innerHTML = team.id;
    //     }
    // }

/*
    private async formTeam(): Promise<TeamTransport> {
        Log.info("CS340View::formTeam() - start");
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
*/

}
