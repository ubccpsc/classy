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
            return that.fetchData();
        }).then(function() {
            return that.renderTeams(that.teams);
        }).then(function() {
            UI.hideModal();
            Log.info('CS310View::renderPage(..) - prep & render took: ' + UI.took(start));
        }).catch(function(err) {
            Log.error('CS310View::renderPage() - ERROR: ' + err);
            UI.hideModal();
        });
    }

    private async fetchData(): Promise<void> {
        UI.showModal('Fetching Data');
        this.teams = null;

        const url = this.remote + '/portal/teams';
        const response = await fetch(url, super.getOptions());
        if (response.status === 200) {
            Log.trace('CS310View::fetchData(..) - teams 200 received');
            const json = await response.json();
            Log.trace('CS310View::fetchData(..) - teams payload: ' + JSON.stringify(json));
            if (typeof json.success !== 'undefined') {
                Log.trace('CS310View::fetchData(..) - teams success: ' + json.success);
                this.teams = json.success as TeamTransport[];
            } else {
                Log.trace('CS310View::fetchData(..) - teams ERROR: ' + json.failure.message);
                UI.showError(json.failure);
            }
        } else {
            Log.trace('CS310View::fetchData(..) - teams !200 received');
        }

        UI.hideModal();
        return;
    }

    private async renderTeams(teams: TeamTransport[]): Promise<void> {
        Log.trace('CS310View::renderTeams(..) - start');
        const that = this;

        // make sure these are hidden
        UI.hideSection('studentSelectPartnerDiv');
        UI.hideSection('studentPartnerDiv');

        // 310 only has one team so we don't need to check to see if it's the right one
        if (teams.length < 1) {
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
            const team = this.teams[0];

            if (team.URL !== null) {
                tName.innerHTML = '<a href="' + team.URL + '">' + team.id + '</a>';
            } else {
                tName.innerHTML = team.id;
            }
            pName.innerHTML = JSON.stringify(team.people);
        }
    }

    private async formTeam(): Promise<TeamTransport> {
        Log.info("CS310View::formTeam() - start");
        const otherId = UI.getTextFieldValue('studentSelectPartnerText');
        const myGithubId = this.getStudent().githubId;
        const payload: TeamFormationTransport = {
            delivId:   'proj', // only one team in cs310 (and it is always called project)
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
