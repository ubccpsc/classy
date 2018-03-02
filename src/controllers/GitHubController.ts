import {DatabaseController} from "./DatabaseController";
import Log from "../util/Log";
import {Team} from "../Types";
import {RepositoryController} from "./RepositoryController";
import {GradesController} from "./GradesController";
import Util from "../util/Util";


export class GitHubController {



    public createD0repository(org: string, personId: string) {

    }

    public createD1repository(org: string, teamId: string) {
        // check that the team exists
        // make sure any team members have d0 grade > 60
        // make sure any team members do not already have d1 repos
    }

    public createD3pr(org: string, repoId: string) {

    }


}