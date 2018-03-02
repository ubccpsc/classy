import Log from "../util/Log";
import Util from "../util/Util";
import {RepositoryController} from "./RepositoryController";
import {DatabaseController} from "./DatabaseController";
import {GradesController} from "./GradesController";
import {Team} from "../Types";

export class SDDMController {

    private dc = DatabaseController.getInstance();
    private rc = new RepositoryController();
    private gc = new GradesController();

    constructor() {
        Log.trace("SDDMController::<init> - start");
    }

    /**
     * Status chain:
     *
     * D0PRE
     * D0
     * D1UNLOCKED
     * D1TEAMSET
     * D1
     * D2
     * D3PRE
     * D3
     *
     * @param {string} org
     * @param {string} personId
     * @returns {Promise<string>}
     */
    public async getStatus(org: string, personId: string): Promise<string> {
        Log.info("XXX::getStatus( " + org + ', ' + personId + ' ) - start');
        const start = Date.now();
        try {
            const person = await this.dc.getPerson(org, personId);
            if (person === null) {
                Log.info("XXX::getStatus(..) - ERROR; person null");
                return;
            }

            // let currentStatus = person.custom.sddmStatus;
            let currentStatus = "D0PRE";

            // D0PRE
            if (currentStatus === "D0PRE") {
                // make sure d0 doesn't exist for a person, if it does, make them D0

                let d0Repo = null;
                let repos = await this.rc.getReposForPerson(person);
                for (const r of repos) {
                    if (r.custom.d0enabled === true) {
                        d0Repo = r;
                    }

                    if (d0Repo !== null) {
                        Log.info("XXX::getStatus(..) - elevating D0PRE to D0");
                        currentStatus = "D0";
                    } else {
                        Log.info("XXX::getStatus(..) - NOT elevating from D0PRE");
                    }
                }
            }

            // D0
            if (currentStatus === "D0") {
                // if their d0 score >= 60, make them D1UNLOCKED
                const d0Grade = await this.dc.getGrade(org, personId, "d0");
                if (d0Grade && d0Grade.score >= 60) {
                    Log.info("XXX::getStatus(..) - elevating D0 to D1UNLOCKED");
                    currentStatus = "D1UNLOCKED";
                } else {
                    Log.info("XXX::getStatus(..) - NOT elevating from D0");
                }
            }

            // D1UNLOCKED
            if (currentStatus === "D1UNLOCKED") {
                // if they have a d1 team, make them D1TEAMSET
                const teams = await this.dc.getTeamsForPerson(org, personId);

                // XXX: check to see if one of them is a d0 team
                let d1team: Team = null;
                for (const t of teams) {
                    if (t.custom.sdmmd1 === true) {
                        d1team = t;
                    }
                }

                if (d1team !== null) {
                    Log.info("XXX::getStatus(..) - elevating D1UNLOCKED to D1TEAMSET");
                    currentStatus = "D1TEAMSET";
                } else {
                    Log.info("XXX::getStatus(..) - NOT elevating from D1UNLOCKED");
                }
            }

            // D1TEAMSET
            if (currentStatus === "D1TEAMSET") {
                // if they have a d1 repo, make them D1
                const repos = await this.rc.getReposForPerson(person);
                let d1repo = null;
                for (const r of repos) {
                    if (r.custom.d1enabled === true) {
                        d1repo = r;
                    }
                }
                if (d1repo !== null) {
                    Log.info("XXX::getStatus(..) - elevating D1TEAMSET to D1");
                    currentStatus = "D1";
                } else {
                    Log.info("XXX::getStatus(..) - NOT elevating from D1TEAMSET");
                }
            }

            // D1
            if (currentStatus === "D1") {
                // if their d1 score > 60, make them D2
                let d1Grade = await this.gc.getGrade(org, personId, "d1");
                if (d1Grade && d1Grade.score >= 60) {
                    Log.info("XXX::getStatus(..) - elevating D1 to D2");
                    let allRepos = await this.rc.getReposForPerson(person);
                    for (const r of allRepos) {
                        if (r.custom.d1enabled === true) {
                            // is a project repo
                            r.custom.d2enabled = true;
                        }
                    }
                } else {
                    Log.info("XXX::getStatus(..) - NOT elevating from D1");
                }
            }

            // D2
            if (currentStatus === "D2") {
                // if their d2 core > 60, make them D3PRE
                let d2Grade = await this.gc.getGrade(org, personId, "d2");
                if (d2Grade && d2Grade.score >= 60) {
                    Log.info("XXX::getStatus(..) - elevating D2 to D3PRE");
                } else {
                    Log.info("XXX::getStatus(..) - NOT elevating from D2");
                }
            }

            // D3PRE
            if (currentStatus === "D3PRE") {
                // if their d1 repo has custom.sddmD3pr===true, make them D3
                let allRepos = await this.rc.getReposForPerson(person);
                let prComplete = false;
                for (const r of allRepos) {
                    if (r.custom.d2enabled === true && r.custom.sddmD3pr === true) {
                        // is a project repo and has had the pr completed
                        prComplete = true;
                    }
                }
                if (prComplete === true) {
                    Log.info("XXX::getStatus(..) - elevating D3PRE to D3");
                    currentStatus = "D3";
                } else {
                    Log.info("XXX::getStatus(..) - NOT elevating from D3PRE");
                }
            }

            // D3
            // nothing else to be done
            if (currentStatus === "D3") {
                let allRepos = await this.rc.getReposForPerson(person);
                for (const r of allRepos) {
                    if (r.custom.d2enabled === true) {
                        // is a project repo
                        r.custom.d3enabled = true;
                    }
                }
                Log.info("XXX::getStatus(..) - NOT elevating from D3");
            }
            Log.info("XXX::getStatus( " + org + ', ' + personId + ' ) - done; took: ' + Util.took(start));
            return currentStatus;
        }
        catch
            (err) {
            Log.error("XXX::getStatus( " + org + ', ' + personId + ' ) - ERROR: ' + err);
            return "UNKNOWN";
        }

    }
}