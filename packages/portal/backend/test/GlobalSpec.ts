import {expect} from "chai";
import "mocha";

import Config, {ConfigCourses, ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {IContainerInput, IContainerOutput} from "../../../common/types/AutoTestTypes";
import {GradePayload} from "../../../common/types/SDMMTypes";
import Util from "../../../common/Util";

import {DatabaseController} from "../src/controllers/DatabaseController";
import {DeliverablesController} from "../src/controllers/DeliverablesController";
import {GradesController} from "../src/controllers/GradesController";
import {PersonController} from "../src/controllers/PersonController";
import {RepositoryController} from "../src/controllers/RepositoryController";
import {TeamController} from "../src/controllers/TeamController";
import {Auth, Deliverable, Grade, Person, Repository, Result, Team} from "../src/Types";

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

    public static async suiteBefore(suiteName: string) {
        Log.test("Test::suiteBefore( ... ) - suite: " + suiteName);

        const dc = DatabaseController.getInstance();
        await dc.clearData();
    }

    public static suiteAfter(suiteName: string) {
        Log.test("Test::suiteAfter( ... ) - suite: " + suiteName);
    }

    public static async prepareDeliverables(): Promise<void> {
        const dc = DatabaseController.getInstance();

        let d = Test.createDeliverable(Test.DELIVID0);
        await dc.writeDeliverable(d);

        d = Test.createDeliverable(Test.DELIVID1);
        await dc.writeDeliverable(d);

        d = Test.createDeliverable(Test.DELIVID2);
        await dc.writeDeliverable(d);

        d = Test.createDeliverable(Test.DELIVID3);
        await dc.writeDeliverable(d);

        d = Test.createDeliverable(Test.DELIVIDPROJ);
        await dc.writeDeliverable(d);
    }

    public static async preparePeople(): Promise<void> {
        Log.test("Test::preparePeople() - start");
        const dc = DatabaseController.getInstance();

        let p = Test.createPerson(Test.USER1.id, Test.USER1.csId, Test.USER1.github, 'student');
        await dc.writePerson(p);

        p = Test.createPerson(Test.USER2.id, Test.USER2.csId, Test.USER2.github, 'student');
        await dc.writePerson(p);

        p = Test.createPerson(Test.USER3.id, Test.USER3.csId, Test.USER3.github, 'student');
        await dc.writePerson(p);

        // staff person (this username should be on the 'staff' team, but not the 'admin' team in the github org)
        p = Test.createPerson(Test.STAFF1.id, Test.STAFF1.csId, Test.STAFF1.github, null);
        await dc.writePerson(p);

        // admin person (this username should be on the 'staff' team, and the 'admin' team in the github org)
        p = Test.createPerson(Test.ADMIN1.id, Test.ADMIN1.csId, Test.ADMIN1.github, null);
        await dc.writePerson(p);
        Log.test("Test::preparePeople() - end");
    }

    public static async prepareTeams(): Promise<void> {
        Log.test("Test::prepareTeams() - start");
        try {
            const pc = new PersonController();
            const p1 = await pc.getPerson(Test.USER1.id);
            const p2 = await pc.getPerson(Test.USER2.id);

            const dc = new DeliverablesController();
            const deliv = await dc.getDeliverable(Test.DELIVID0);
            const tc = new TeamController();
            const team = await tc.createTeam(Test.TEAMNAME1, deliv, [p1, p2], {});
        } catch (err) {
            Log.error("Test::prepareTeams() - ERROR: " + err);
        }
        Log.test("Test::prepareTeams() - end");
    }

    public static async prepareRepositories(): Promise<void> {
        Log.test("Test::prepareRepositories() - start");
        try {
            const tc = new TeamController();
            const team = await tc.getTeam(Test.TEAMNAME1);

            const rc = new RepositoryController();
            const repo = await rc.createRepository(Test.REPONAME1, [team], {});
        } catch (err) {
            Log.error("Test::prepareRepositories() - ERROR: " + err);
        }
        Log.test("Test::prepareRepositories() - end");
    }

    public static async prepareGrades(): Promise<void> {
        const grade: GradePayload = {
            score:     100,
            comment:   'comment',
            urlName:   'urlName',
            URL:       'URL',
            timestamp: new Date(Date.UTC(2018, 1, 1, 1, 1)).getTime(),
            custom:    {}
        };

        const gc = new GradesController();
        const valid = await gc.createGrade(Test.REPONAME1, Test.DELIVID1, grade);
    }

    public static async prepareAuth(): Promise<void> {
        const dc = DatabaseController.getInstance();

        let auth: Auth = {
            personId: Test.USER1.id,
            token:    Test.REALTOKEN
        };
        await dc.writeAuth(auth);

        auth = {
            personId: Test.ADMIN1.id,
            token:    Test.REALTOKEN
        };
        await dc.writeAuth(auth);
    }

    public static createDeliverable(delivId: string): Deliverable {
        const d: Deliverable = {
            id: delivId,

            URL:            'http://NOTSET',
            openTimestamp:  -1,
            closeTimestamp: -1,
            gradesReleased: false,
            // delay:          300,

            teamMinSize:      1,
            teamMaxSize:      2,
            teamSameLab:      true,
            teamStudentsForm: true,
            teamPrefix:       'team_',
            repoPrefix:       '',
            // bootstrapUrl:     '',

            autotest: {
                dockerImage:        'testImage',
                studentDelay:       60 * 60 * 12, // 12h
                maxExecTime:        300,
                regressionDelivIds: [],
                custom:             {}
            },

            custom: {}
        };

        return d;
    }

    public static createPerson(id: string, csId: string, githubId: string, kind: string | null): Person {
        const p: Person = {
            id:            id,
            csId:          csId,
            githubId:      githubId,
            studentNumber: null,

            fName: 'first_' + id,
            lName: 'last_' + id,
            kind:  kind,
            URL:   Config.getInstance().getProp(ConfigKey.githubHost) + '/' + githubId,

            labId: null,

            custom: {}
        };
        return p;
    }

    // public static testBefore() {
    //     // Log.test('Test::testBefore( ... ) - test: ' + testObj.currentTest.title);
    // }

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

    public static readonly USER1 = {id: 'user1id', csId: 'user1id', github: 'user1gh'};
    public static readonly USER2 = {id: 'user2id', csId: 'user2id', github: 'user2gh'};
    public static readonly USER3 = {id: 'user3id', csId: 'user3id', github: 'user3gh'};

    // public static readonly ADMIN1 = {id: 'ubcbot', csId: 'ubcbot', github: 'ubcbot'};
    public static readonly ADMIN1 = {id: 'classyadmin', csId: 'classyadmin', github: 'classyadmin'};
    public static readonly STAFF1 = {id: 'classystaff', csId: 'classystaff', github: 'classystaff'};

    // public static readonly USERNAMEADMIN = 'ubcbot'; // should be admin on any test org
    // public static readonly USERNAMESTAFF = 'ubcbot'; // should be admin on any test org
    // public static readonly USERNAME1 = 'rthse2'; // real account for testing users
    // public static readonly USERNAME2 = 'user2';
    // public static readonly USERNAME3 = 'user3';

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

    public static readonly REALTOKEN = 'realtoken';
    public static readonly FAKETOKEN = 'faketoken';

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
