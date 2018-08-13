import {expect} from "chai";
import "mocha";

import Config, {ConfigCourses, ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {IContainerInput, IContainerOutput} from "../../../common/types/AutoTestTypes";
import Util from "../../../common/Util";

import {DatabaseController} from "../src/controllers/DatabaseController";
import {Deliverable, Grade, Person, Repository, Result, Team} from "../src/Types";

if (typeof it === 'function') {
    // only if we're running in mocha
    before(async () => {
        Log.info('GlobalSpec::before() - start');

        Config.getInstance();

        Config.getInstance().setProp(ConfigKey.name, ConfigCourses.classytest); // force testing env

        const db = DatabaseController.getInstance();
        await db.clearData(); // nuke everything

        Log.info('GlobalSpec::before() - done');
    });

    after(() => {
        Log.info('GlobalSpec::after()');
    });
}

export class Test {

    /**
     * Determines whether slow tests should be executed. They will _always_ run on CI, but
     * you can also set override = true to execute them locally. This is important if you
     * are editing code that touches the stuff that might be slow (e.g., specifically
     * GitHub-related functions.
     *
     * @returns {boolean}
     */
    public static runSlowTest() {
        // set to true if you want to run these slow tests locally (they will always run on CI)
        const override = false; // NOTE: should NOT be commented out when committing
        // const override = true; // NOTE: should be commented out when committing

        const ci = process.env.CI;
        if (override || typeof ci !== 'undefined' && Boolean(ci) === true) {
            Log.test("Test::runSlowTest() - running in CI or overriden; not skipping");
            return true;
        } else {
            Log.test("Test::runSlowTest() - skipping (not CI)");
            return false;
        }
    }

    public static readonly TEAMNAME1 = 'TESTteam1';
    public static readonly TEAMNAME2 = 'TESTteam2';
    public static readonly TEAMNAME3 = 'TESTteam3';
    public static readonly TEAMNAME4 = 'TESTteam4';

    public static readonly USERNAMEADMIN = 'ubcbot'; // should be admin on any test org
    public static readonly USERNAME1 = 'rthse2'; // real account for testing users
    public static readonly USERNAME2 = 'user2';
    public static readonly USERNAME3 = 'user3';

    public static readonly USERNAMEGITHUB1 = "cpscbot";
    public static readonly USERNAMEGITHUB2 = "rthse2";
    public static readonly USERNAMEGITHUB3 = "ubcbot";

    public static readonly DELIVIDPROJ = 'project';
    public static readonly DELIVID0 = 'd0';
    public static readonly DELIVID1 = 'd1';
    public static readonly DELIVID2 = 'd2';
    public static readonly DELIVID3 = 'd3';

    public static readonly REPONAME1 = 'TESTrepo1';
    public static readonly REPONAME2 = 'TESTrepo2';
    public static readonly REPONAME3 = 'TESTrepo3';

    public static getDeliverable(delivId: string): Deliverable {
        const deliv: Deliverable = {
            id: delivId,

            URL:              'https://NOTSET',
            openTimestamp:    -1,
            closeTimestamp:   -1,
            gradesReleased:   false,
            // delay:            -1,
            teamMinSize:      1,
            teamMaxSize:      1,
            teamSameLab:      false,
            teamStudentsForm: false,
            teamPrefix:       'team_',
            repoPrefix:       '',
            // bootstrapUrl:     '',
            autotest:         {
                dockerImage:        'testImage',
                studentDelay:       60 * 60 * 12, // 12h
                maxExecTime:        300,
                regressionDelivIds: [],
                custom:             {}
            },
            custom:           {}
        };
        return Util.clone(deliv) as Deliverable;
    }

    public static getPerson(id: string): Person {
        const p: Person = {
            id:            id,
            csId:          id,
            githubId:      id,
            studentNumber: null,

            fName: 'f' + id,
            lName: 'l' + id,
            kind:  null,
            URL:   null,

            labId: null,

            custom: {}
        };
        return Util.clone(p) as Person;
    }

    public static getGrade(delivId: string, personId: string, score: number): Grade {
        const grade: Grade = {
            personId: personId,
            delivId:  delivId,

            score:     score,
            comment:   '',
            timestamp: Date.now(),

            urlName: 'urlName',
            URL:     'url',

            custom: {}
        };
        return Util.clone(grade) as Grade;
    }

    public static getTeam(teamId: string, delivId: string, people: string[]): Team {
        const team: Team = {
            id:        teamId,
            delivId:   delivId,
            URL:       Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
                       Config.getInstance().getProp(ConfigKey.org) + '/teams/' + teamId,
            personIds: people,
            custom:    {}
        };
        return Util.clone(team) as Team;
    }

    public static getRepository(id: string, teamId: string): Repository {
        const repo: Repository = {
            id:       id,
            URL:      Config.getInstance().getProp(ConfigKey.githubHost) + '/' + id,
            cloneURL: Config.getInstance().getProp(ConfigKey.githubHost) + '/' + id + '.git',
            teamIds:  [teamId],
            custom:   {}
        };
        return Util.clone(repo) as Repository;
    }

    public static getResult(delivId: string, repoId: string, people: string[], score: number): Result {

        const ts = Date.now() - Math.random() * 1000 * 600;
        const projectURL = Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            Config.getInstance().getProp(ConfigKey.org) + '/' + repoId;
        const commitURL = projectURL + '/commits/FOOOSHA';
        const output: IContainerOutput = {
            // commitURL:          commitURL,
            timestamp:          ts,
            report:             {
                scoreOverall: score,
                scoreTest:    Math.random() * 100,
                scoreCover:   Math.random() * 100,
                passNames:    [],
                failNames:    [],
                errorNames:   [],
                skipNames:    [],
                custom:       {},
                feedback:     'feedback'
            },
            postbackOnComplete: true,
            custom:             {},
            attachments:        [],
            state:              'SUCCESS' // enum: SUCCESS, FAIL, TIMEOUT, INVALID_REPORT
        };

        const input: IContainerInput = {
            pushInfo:        {
                delivId: delivId,
                repoId:  repoId,

                // branch:    'master',
                cloneURL:  'cloneURL',
                commitSHA: 'sha',
                commitURL: commitURL,

                // projectURL:  projectURL,
                postbackURL: 'postbackURL',
                timestamp:   ts
            },
            containerConfig: {
                dockerImage:        "imageName",
                studentDelay:       300,
                maxExecTime:        6000,
                regressionDelivIds: [],
                custom:             {}
            },
            delivId:         delivId
        };

        const result: Result = {
            delivId:   delivId,
            repoId:    repoId,
            // timestamp: ts,
            commitURL: commitURL,
            commitSHA: 'SHA',
            input:     input,
            output:    output,
            people:    people
        };

        return Util.clone(result) as Result;
    }
}
