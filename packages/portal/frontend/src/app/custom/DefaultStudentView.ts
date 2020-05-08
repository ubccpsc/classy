/**
 * This is the Default Student View for Classy.
 *
 */

import {OnsButtonElement, OnsSelectElement} from "onsenui";
import Log from "../../../../../common/Log";
import {
    ConfigTransport,
    DeliverableTransport,
    Payload,
    TeamFormationTransport,
    TeamTransport,
} from "../../../../../common/types/PortalTypes";
import {UI} from "../util/UI";
import {AbstractStudentView} from "../views/AbstractStudentView";

export interface TeamFormationDeliverable {
    id: string;
}

export class DefaultStudentView extends AbstractStudentView {

    private teams: TeamTransport[];
    private teamDeliverableIds: string[];

    constructor(remoteUrl: string) {
        super();
        Log.info("DefaultView::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('DefaultStudentView::renderPage() - start; options: ' + opts);
        const that = this;
        const start = Date.now();

        UI.showModal("Fetching data.");
        super.render().then(function() {
            // super render complete; do Default work
            return that.renderStudentPage();
        }).then(function() {
            Log.info('DefaultStudentView::renderPage(..) - prep & render took: ' + UI.took(start));
            UI.hideModal();
        }).catch(function(err) {
            Log.error('DefaultStudentView::renderPage() - ERROR: ' + err);
            UI.hideModal();
        });
    }

    private async renderStudentPage(): Promise<void> {
        UI.showModal('Fetching Data');
        try {
            Log.info('DefaultStudentView::renderStudentPage(..) - start');

            // grades renedered in StudentView

            // repos rendered in StudentView

            // teams rendered here
            const teams = await this.fetchTeamData();
            this.teams = teams;
            await this.renderTeams(teams);

            // team deliverable selection rendered here
            this.teamDeliverableIds = await this.fetchStudentFormTeamDelivs();
            await this.renderDeliverableSelectMenu(this.teamDeliverableIds);

            Log.info('DefaultStudentView::renderStudentPage(..) - done');
        } catch (err) {
            Log.error('Error encountered: ' + err.message);
        }
        UI.hideModal();
        return;
    }

    private async fetchStudentFormTeamDelivs(): Promise<string[]> {
        try {
            this.teamDeliverableIds = null;
            const data: ConfigTransport = await this.fetchData('/portal/config');
            Log.info('ClassyStudentView::fetchStudentFormTeamDelivs(..) - data', data);
            return data.teamDeliverableIds;
        } catch (err) {
            Log.error('ClassyStudentView::fetchStudentFormTeamDelivs(..) - ERROR ', err);
        }
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
            Log.error('DefaultStudentView::fetchTeamData(..) - ERROR: ' + err.message);
            this.teams = [];
            return [];
        }
    }

    private async renderTeams(teams: TeamTransport[]): Promise<void> {
        Log.trace('DefaultStudentView::renderTeams(..) - start');
        const that = this;

        // configure team creation menus
        const button = document.querySelector('#studentSelectPartnerButton') as OnsButtonElement;
        button.onclick = function(evt: any) {
            Log.info('DefaultStudentView::renderTeams(..)::createTeam::onClick');
            that.formTeam().then(function(team) {
                Log.info('DefaultStudentView::renderTeams(..)::createTeam::onClick::then - team created');
                that.teams.push(team);
                if (team !== null) {
                    that.renderPage({}); // simulating refresh
                }
            }).catch(function(err) {
                Log.info('DefaultStudentView::renderTeams(..)::createTeam::onClick::catch - ERROR: ' + err);
            });
        };

        const teamsListDiv = document.getElementById('studentPartnerDiv');
        const teamElement = document.getElementById('studentPartnerTeamName');

        if (teams.length) {
            const studentNotOnTeamMsg = document.getElementById('studentNotOnTeamMsg');
            if (studentNotOnTeamMsg) {
                studentNotOnTeamMsg.remove();
            }

            const teamItems = teamsListDiv.querySelectorAll('ons-list-item');
            // tslint:disable-next-line:prefer-for-of
            for (let i = 0; i < teamItems.length; i++) {
                teamItems[i].remove();
            }
            for (const team of teams) {
                const item = UI.createListItem(team.id);
                teamsListDiv.appendChild(item);
            }
        }
    }

    private async formTeam(): Promise<TeamTransport> {
        Log.info("DefaultStudentView::formTeam() - start");
        const studentSelectPartner = document.getElementById('studentSelectPartnerText') as HTMLInputElement;
        const otherIds = studentSelectPartner.value.replace(' ', '').split(',');
        const delivMenu = document.getElementById('studentSelectDeliverable') as OnsSelectElement;
        const myGithubId = this.getStudent().githubId;
        const payload: TeamFormationTransport = {
            delivId:   delivMenu.options[delivMenu.selectedIndex].value,
            githubIds: [myGithubId, ...otherIds]
        };
        const url = this.remote + '/portal/team';
        const options: any = this.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(payload);

        Log.info("DefaultStudentView::formTeam() - URL: " + url + "; payload: " + JSON.stringify(payload));
        const response = await fetch(url, options);

        Log.info("DefaultStudentView::formTeam() - responded");

        const body = await response.json() as Payload;

        Log.info("DefaultStudentView::formTeam() - response: " + JSON.stringify(body));

        if (typeof body.success !== 'undefined') {
            // worked
            UI.notification('Team ' + body.success[0].id + ' created.');
            studentSelectPartner.value = '';
            return body.success as TeamTransport;
        } else if (typeof body.failure !== 'undefined') {
            // failed
            UI.showError(body);
            return null;
        } else {
            Log.error("DefaultStudentView::formTeam() - else ERROR: " + JSON.stringify(body));
        }
    }

    private async renderDeliverableSelectMenu(deliverableIds: string[]): Promise<void> {
        Log.info('rendering deliverable select menu');
        const delivSelect = document.getElementById('studentSelectDeliverable') as OnsSelectElement;
        if (delivSelect.options.length === 0) {
            deliverableIds.forEach((id) => {
                const opt = UI.createOption(id, id);
                delivSelect.firstChild.appendChild(opt);
            });
        }
        Log.info(this.teamDeliverableIds);
    }

}
