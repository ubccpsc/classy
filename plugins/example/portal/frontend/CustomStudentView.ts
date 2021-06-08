/**
 * This is the Default Student View for Classy.
 *
 */

import {OnsButtonElement, OnsSelectElement} from "onsenui";

import Log from "@common/Log";
import {
    ConfigTransport,
    DeliverableTransport,
    Payload,
    TeamFormationTransport,
    TeamTransport,
} from "@common/types/PortalTypes";
import {UI} from "@frontend/util/UI";
import {AbstractStudentView} from "@frontend/views/AbstractStudentView";

import fetch from 'node-fetch';
export interface TeamFormationDeliverable {
    id: string;
}

export class CustomStudentView extends AbstractStudentView {

    private teams: TeamTransport[];
    private studentsFormTeamDelivIds: string[];

    constructor(remoteUrl: string) {
        super();
        Log.info("DefaultView::<init>");
        this.remote = remoteUrl;
    }

    public renderPage(opts: {}) {
        Log.info('CustomStudentView::renderPage() - start; options: ' + opts);
        const that = this;
        const start = Date.now();

        UI.showModal("Fetching data.");
        super.render().then(function() {
            // super render complete; do Default work
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

            // custom feature rendered here
            await this.renderCustomFeature();

            // grades renedered in StudentView

            // repos rendered in StudentView

            // teams rendered here
            const teams = await this.fetchTeamData();
            this.teams = teams;
            await this.renderTeams(teams);

            // team deliverable selection rendered here
            this.studentsFormTeamDelivIds = await this.fetchStudentFormTeamDelivs();
            await this.renderDeliverableSelectMenu(this.studentsFormTeamDelivIds);

            Log.info('CustomStudentView::renderStudentPage(..) - done');
        } catch (err) {
            Log.error('Error encountered: ' + err.message);
        }
        UI.hideModal();
        return;
    }

    private async fetchStudentFormTeamDelivs(): Promise<string[]> {
        try {
            this.studentsFormTeamDelivIds = null;
            const data: ConfigTransport = await this.fetchData('/portal/config');
            Log.info('ClassyStudentView::fetchStudentFormTeamDelivs(..) - data', data);
            return data.studentsFormTeamDelivIds;
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
            Log.error('CustomStudentView::fetchTeamData(..) - ERROR: ' + err.message);
            this.teams = [];
            return [];
        }
    }

    private async renderCustomFeature(): Promise<void> {
        Log.trace('CustomStudentView::renderTeams(..) - start');
        const customFeatureDiv = document.getElementById('studentCustomFeature');
        const response = await this.fetchData('/portal/custom/helloWorld');
        const {helloWorldData}: any = await response.json();

        for (const str of helloWorldData) {
                const item = UI.createListItem(str);
                customFeatureDiv.appendChild(item);
            }
    }

    private async renderTeams(teams: TeamTransport[]): Promise<void> {
        Log.trace('CustomStudentView::renderTeams(..) - start');
        const that = this;

        // configure team creation menus
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
        Log.info("CustomStudentView::formTeam() - start");
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

        Log.info("CustomStudentView::formTeam() - URL: " + url + "; payload: " + JSON.stringify(payload));
        const response = await fetch(url, options);

        Log.info("CustomStudentView::formTeam() - responded");

        const body = await response.json() as Payload;

        Log.info("CustomStudentView::formTeam() - response: " + JSON.stringify(body));

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
            Log.error("CustomStudentView::formTeam() - else ERROR: " + JSON.stringify(body));
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
        Log.info(this.studentsFormTeamDelivIds);
    }

}
