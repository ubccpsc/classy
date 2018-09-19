/**
 * This is the main student page for the SDDM.
 *
 * Other courses should _not_ modify this but instead build their own
 * student views, as they need for their own courses.
 */

import {OnsButtonElement} from "onsenui";
import Log from "../../../../../../common/Log";
import {Payload, TeamFormationTransport, TeamTransport} from "../../../../../../common/types/PortalTypes";

import {UI} from "../../util/UI";
import {StudentView} from "../StudentView";

export class CS310View extends StudentView {

    private teams: TeamTransport[];

    constructor(remoteUrl: string) {
        super();
        Log.info("CS310View::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('CS310View::renderPage() - start; options: ' + opts);
        const that = this;
        const start = Date.now();

        UI.showModal("Fetching data.");
        super.render().then(function() {
            // super render complete; do custom work
            return that.renderStudentPage();
        }).then(function() {
            Log.info('CS310View::renderPage(..) - prep & render took: ' + UI.took(start));
            UI.hideModal();
        }).catch(function(err) {
            Log.error('CS310View::renderPage() - ERROR: ' + err);
            UI.hideModal();
        });
    }

    private async renderStudentPage(): Promise<void> {
        UI.showModal('Fetching Data');
        try {
            // grades done in StudentView
            // repos done in StudentView

            // teams
            const teams = await this.fetchTeamData();
            this.teams = teams;
            await this.renderTeams(teams);

            Log.info('CS310View::renderStudentPage(..) - done');
        } catch (err) {
            Log.error('Error encountered: ' + err.message);
        }
        UI.hideModal();
        return;
    }

    // private async fetchData(endpoint: string): Promise<any> {
    //     const url = this.remote + endpoint;
    //     const response = await fetch(url, super.getOptions());
    //     if (response.status === 200) {
    //         Log.trace('CS310View::fetchData( ' + endpoint + ' ) - 200 received');
    //         const json = await response.json();
    //         Log.trace('CS310View::fetchData( ' + endpoint + ' ) - payload: ' + JSON.stringify(json));
    //         if (typeof json.success !== 'undefined') {
    //             Log.trace('CS310View::fetchData( ' + endpoint + ' ) - success: ' + json.success);
    //             return json.success;
    //         } else {
    //             Log.trace('CS310View::fetchData( ' + endpoint + ' ) - ERROR: ' + json.failure.message);
    //             throw new Error(json.failure.message);
    //             // UI.showError(json.failure);
    //         }
    //     } else {
    //         Log.trace('CS310View::fetchData( ' + endpoint + ' ) - teams !200 received');
    //     }
    //
    //     UI.hideModal();
    //     return [];
    // }

    private async fetchTeamData(): Promise<TeamTransport[]> {

        // this.teams = null;

        // const url = this.remote + '/portal/teams';
        // const response = await fetch(url, super.getOptions());
        // if (response.status === 200) {
        //     Log.trace('CS310View::fetchTeamData(..) - teams 200 received');
        //     const json = await response.json();
        //     Log.trace('CS310View::fetchTeamData(..) - teams payload: ' + JSON.stringify(json));
        //     if (typeof json.success !== 'undefined') {
        //         Log.trace('CS310View::fetchTeamData(..) - teams success: ' + json.success);
        //         return json.success as TeamTransport[];
        //     } else {
        //         Log.trace('CS310View::fetchTeamData(..) - teams ERROR: ' + json.failure.message);
        //         UI.showError(json.failure);
        //     }
        // } else {
        //     Log.trace('CS310View::fetchTeamData(..) - teams !200 received');
        // }
        try {
            this.teams = null;
            let data: TeamTransport[] = await this.fetchData('/portal/teams');
            if (data === null) {
                data = [];
            }
            this.teams = data;
            return data;
        } catch (err) {
            Log.error('CS310View::fetchTeamData(..)' + err.message);
            this.teams = [];
            return [];
        }

    }

    private async renderTeams(teams: TeamTransport[]): Promise<void> {
        Log.trace('CS310View::renderTeams(..) - start');
        const that = this;

        // make sure these are hidden
        UI.hideSection('studentSelectPartnerDiv');
        UI.hideSection('studentPartnerDiv');

        // skip this all for now; we will redeploy when teams can be formed
        // if (Date.now() > 0) {
        //     return;
        // }

        let projectTeam = null;
        for (const team of teams) {
            if (team.delivId === "project") {
                projectTeam = team;
            }
        }

        if (projectTeam === null) {
            // no team yet

            const button = document.querySelector('#studentSelectPartnerButton') as OnsButtonElement;
            button.onclick = function(evt: any) {
                Log.info('CS310View::renderTeams(..)::createTeam::onClick');
                that.formTeam().then(function(team) {
                    Log.info('CS310View::renderTeams(..)::createTeam::onClick::then - team created');
                    that.teams.push(team);
                    if (team !== null) {
                        that.renderPage({}); // simulating refresh
                    }
                }).catch(function(err) {
                    Log.info('CS310View::renderTeams(..)::createTeam::onClick::catch - ERROR: ' + err);
                });
            };

            UI.showSection('studentSelectPartnerDiv');
        } else {
            // already on team
            UI.showSection('studentPartnerDiv');

            const tName = document.getElementById('studentPartnerTeamName');
            const pName = document.getElementById('studentPartnerTeammates');
            const team = projectTeam;

            // if (team.URL !== null) {
            //     tName.innerHTML = '<a href="' + team.URL + '">' + team.id + '</a>';
            // } else {
            tName.innerHTML = team.id;
            // }
            pName.innerHTML = team.people[0]; // JSON.stringify(team.people);
        }
    }

    private async formTeam(): Promise<TeamTransport> {
        Log.info("CS310View::formTeam() - start");
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

        Log.info("CS310View::formTeam() - URL: " + url + "; payload: " + JSON.stringify(payload));
        const response = await fetch(url, options);

        Log.info("CS310View::formTeam() - responded");

        const body = await response.json() as Payload;

        Log.info("CS310View::formTeam() - response: " + JSON.stringify(body));

        if (typeof body.success !== 'undefined') {
            // worked
            return body.success as TeamTransport;
        } else if (typeof body.failure !== 'undefined') {
            // failed
            UI.showError(body);
            return null;
        } else {
            Log.error("CS310View::formTeam() - else ERROR: " + JSON.stringify(body));
        }
    }

}
