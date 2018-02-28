/**
 * not sure we can validate this here
 */
export interface IConfig {
    githubClientId: string;
    githubClientSecret: string;
    sslCertPath: string;
    sslKeyPath: string;
    sslIntCert: string;
    frontendPort: number;
    backendPort: number;
    backendUrl: string;
    frontendUrl: string;
    dbName: string;
}

/**
 * Common queries:
 *
 * 1) List all people (easy)
 * 2) List all teams (easy, just join with people)
 * 3) List most recent results for a deliverable (easy, straight from results)
 * 3) List all results for a deliverable for each user
 *     Harder. Problem is we don't have a 1:1 mapping between repo and deliverable.
 *     Or maybe we just need to roll with this:
 *          Join person with Teams (on Person.id -> Teams.members) as t and to Repositories (t.id ->  Repository.teams) as r
 *          Iterate through each person record.
 *              Find all results for the desired delivId for any r above. Return for each person.
 *              This doesn't combine teams, but makes it so people won't be missed.
 *              Result: PersonRecord[]
 *
 * 4) List most recent results for a team (date limit)
 *
 *
 *
 */

export interface Person {
    readonly id: string; // key (where key is the githubId | csId)
    readonly csId: string;
    readonly githubId: string;
    readonly studentNumber: number | null; // potential key; can be null for non-students

    readonly org: string;
    readonly fName: string;
    readonly lName: string;
    readonly kind: string; // student, ta, prof, ops
    url: string | null; // null when not yet validated (e.g., logged in)

    labId: string | null; // can be null for non-students
}


export interface Deliverable {
    readonly id: string; // is the shortname of the deliverable
    readonly org: string;

    openTimestamp: number;
    closeTimestamp: number;
    gradesReleased: boolean;
    delay: number;

    teamMinSize: number;
    teamMaxSize: number;
    teamSameLab: boolean;
    teamStudentsForm: boolean;
}

export interface Team {
    readonly id: string; // invariant; is the name of the team
    readonly org: string; // invariant
    url: string | null; // null when not yet created
    memberIds: string[]; // Person.id[] - foreign key
}

export interface Repository {
    readonly id: string; // invariant; is the name of the repo
    readonly org: string; // invariant
    url: string | null; // null when not yet created
    teamIds: string[]; // Team.id[] - foreign key
}

export interface Grade {
    // this should be the personId associated with the repo, not a staff who invoked it!
    readonly personId: string; // Person.id - foreign key // could be a Person, but this is just easier
    readonly delivId: string; // Deliverable.id - foreign key // could be a Deliverable, but this is just easier
    readonly org: string;
    score: number;
    comment: string;
    url: string | null; // for traceability
}

/**
 *
 *
 * Types below are not in DB but are projections for sending to the frontend.
 *
 *
 */
export interface PersonRecord {
    person: Person;
    delivId: string;
    org: string;
    results: ResultSummary[];
}

export interface ResultSummary {
    timestamp: number;
    grade: number;
    url: string;
}