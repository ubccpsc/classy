import {OnsButtonElement} from "onsenui";
import Log from "../../../../../common/Log";
import {Payload, TeamFormationTransport, TeamTransport} from "../../../../../common/types/PortalTypes";

import {UI} from "../util/UI";
import {AbstractStudentView} from "../views/AbstractStudentView";

/**
 * CS 310 student view does not differ from the stock student view, except that it provides
 * UI for forming teams.
 */
export class ClassyStudentView extends AbstractStudentView {

    private teams: TeamTransport[];

    constructor(remoteUrl: string) {
        super();
        Log.info("CustomStudentView::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('CustomStudentView::renderPage() - start; options: ' + opts);
        const that = this;
        const start = Date.now();

        UI.showModal("Fetching data.");
        super.render().then(function() {
            // super render complete; do custom work
            return that.renderStudentPage();
        }).then(function() {
            Log.info('CustomStudentView::renderPage(..) - prep & render took: ' + UI.took(start));
            UI.hideModal();
        }).catch(function(err) {
            Log.error('CustomStudentView::renderPage() - ERROR: ' + err);
            UI.hideModal();
        });
    }

    private async renderStudentPage(): Promise<void> {
        UI.showModal('Fetching Data');
        try {
            Log.info('CustomStudentView::renderStudentPage(..) - start');

            // grades renedered in AbstractStudentView

            // repos rendered in AbstractStudentView

            // teams rendered here
            const teams = await this.fetchTeamData();
            this.teams = teams;
            await this.renderTeams(teams);

            Log.info('CustomStudentView::renderStudentPage(..) - done');
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
            Log.error('CustomStudentView::fetchTeamData(..) - ERROR: ' + err.message);
            this.teams = [];
            return [];
        }
    }

    private async renderTeams(teams: TeamTransport[]): Promise<void> {
        Log.trace('CustomStudentView::renderTeams(..) - start');
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
                Log.info('CustomStudentView::renderTeams(..)::createTeam::onClick');
                that.formTeam().then(function(team) {
                    Log.info('CustomStudentView::renderTeams(..)::createTeam::onClick::then - team created');
                    that.teams.push(team);
                    if (team !== null) {
                        that.renderPage({}); // simulating refresh
                    }
                }).catch(function(err) {
                    Log.info('CustomStudentView::renderTeams(..)::createTeam::onClick::catch - ERROR: ' + err);
                });
            };

            UI.showSection('studentSelectPartnerDiv');
        } else {
            // already on team
            UI.showSection('studentPartnerDiv');

            const teamElement = document.getElementById('studentPartnerTeamName');
            // const partnerElement = document.getElementById('studentPartnerTeammates');
            const team = projectTeam;
            teamElement.innerHTML = team.id;
        }
    }

    private async formTeam(): Promise<TeamTransport> {
        Log.info("CustomStudentView::formTeam() - start");
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

        Log.info("CustomStudentView::formTeam() - URL: " + url + "; payload: " + JSON.stringify(payload));
        const response = await fetch(url, options);

        Log.info("CustomStudentView::formTeam() - responded");

        const body = await response.json() as Payload;

        Log.info("CustomStudentView::formTeam() - response: " + JSON.stringify(body));

        if (typeof body.success !== 'undefined') {
            // worked
            return body.success as TeamTransport;
        } else if (typeof body.failure !== 'undefined') {
            // failed
            UI.showError(body);
            return null;
        } else {
            Log.error("CustomStudentView::formTeam() - else ERROR: " + JSON.stringify(body));
        }
    }

}
