import {expect} from "chai";
import "mocha";

import Config, {ConfigCourses, ConfigKey} from "../../../common/Config";
import Log from "../../../common/Log";
import {IContainerInput, IContainerOutput} from "../../../common/types/AutoTestTypes";
import {AssignmentGradingRubric, AssignmentInfo, AssignmentStatus} from "../../../common/types/CS340Types";
import {GradePayload} from "../../../common/types/SDMMTypes";
import Util from "../../../common/Util";

import {DatabaseController} from "../src/controllers/DatabaseController";
import {DeliverablesController} from "../src/controllers/DeliverablesController";
import {GitHubActions, IGitHubActions} from "../src/controllers/GitHubActions";
import {GradesController} from "../src/controllers/GradesController";
import {PersonController} from "../src/controllers/PersonController";
import {RepositoryController} from "../src/controllers/RepositoryController";
import {TeamController} from "../src/controllers/TeamController";
import {Auth, Course, Deliverable, Grade, Person, Repository, Result, Team} from "../src/Types";

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

    public static readonly TIMEOUT = 1000 * 10;
    public static readonly TIMEOUTLONG = 1000 * 300; // 5 minutes

    public static async suiteBefore(suiteName: string) {
        Log.test("Test::suiteBefore( ... ) - suite: " + suiteName);

        const dc = DatabaseController.getInstance();
        await dc.clearData();
    }

    public static suiteAfter(suiteName: string) {
        Log.test("Test::suiteAfter( ... ) - suite: " + suiteName);
    }

    public static async prepareAll() {
        await Test.preparePeople();
        await Test.prepareAuth();
        await Test.prepareDeliverables();
        await Test.prepareTeams();
        await Test.prepareRepositories();
        await Test.prepareGrades();
        await Test.prepareResults();
    }

    public static async prepareAllReal() {
        const dbc = DatabaseController.getInstance();

        await Test.prepareDeliverables();

        let person = await Test.createPerson(Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB1, 'student');
        await dbc.writePerson(person);
        person = await Test.createPerson(Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB2, Test.USERNAMEGITHUB2, 'student');
        await dbc.writePerson(person);
        person = await Test.createPerson(Test.ADMIN1.id, Test.ADMIN1.id, Test.ADMIN1.id, 'adminstaff');
        await dbc.writePerson(person);

        await Test.prepareAuth(); // adds admin token (and user1 which is not real)
        // create a team
        const team = await Test.createTeam(Test.TEAMNAMEREAL, Test.DELIVID0, [Test.USERNAMEGITHUB1, Test.USERNAMEGITHUB2]);
        await dbc.writeTeam(team);
    }

    public static async prepareDeliverables(): Promise<void> {
        const dc = DatabaseController.getInstance();

        let d = Test.createDeliverable(Test.DELIVID0);
        d.teamMinSize = 1;
        d.teamMaxSize = 1;
        await dc.writeDeliverable(d);

        d = Test.createDeliverable(Test.DELIVID1);
        d.shouldProvision = false;
        await dc.writeDeliverable(d);

        d = Test.createDeliverable(Test.DELIVID2);
        await dc.writeDeliverable(d);

        d = Test.createDeliverable(Test.DELIVID3);
        d.teamStudentsForm = false;
        await dc.writeDeliverable(d);

        d = Test.createDeliverable(Test.DELIVIDPROJ);
        await dc.writeDeliverable(d);
    }

    public static async preparePeople(): Promise<void> {
        Log.test("Test::preparePeople() - start");
        const dc = DatabaseController.getInstance();

        let p = Test.createPerson(Test.REALUSER1.id, Test.REALUSER1.csId, Test.REALUSER1.github, 'student');
        await dc.writePerson(p);

        p = Test.createPerson(Test.REALUSER2.id, Test.REALUSER2.csId, Test.REALUSER2.github, 'student');
        await dc.writePerson(p);

        p = Test.createPerson(Test.USER1.id, Test.USER1.csId, Test.USER1.github, 'student');
        p.labId = 'l1a';
        await dc.writePerson(p);

        p = Test.createPerson(Test.USER2.id, Test.USER2.csId, Test.USER2.github, 'student');
        p.labId = 'l1a';
        await dc.writePerson(p);

        p = Test.createPerson(Test.USER3.id, Test.USER3.csId, Test.USER3.github, 'student');
        p.labId = 'l1a';
        await dc.writePerson(p);

        p = Test.createPerson(Test.USER4.id, Test.USER4.csId, Test.USER4.github, 'student');
        p.labId = 'l2c';
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
            const db = DatabaseController.getInstance();

            let team = await Test.createTeam(Test.TEAMNAME1, Test.DELIVID0, [Test.USER1.id, Test.USER2.id]);
            await db.writeTeam(team);

            // user 1 has a different partner for d1
            team = await Test.createTeam(Test.TEAMNAME2, Test.DELIVID1, [Test.USER1.id, Test.USER3.id]);
            await db.writeTeam(team);

        } catch (err) {
            Log.error("Test::prepareTeams() - ERROR: " + err);
        }
        Log.test("Test::prepareTeams() - end");
    }

    public static async createTeam(teamId: string, delivId: string, personIds: string[]): Promise<Team> {
        const pc = new PersonController();
        const people: Person[] = [];

        for (const pid of personIds) {
            const p = await pc.getPerson(pid);
            people.push(p);
        }
        const dc = new DeliverablesController();
        const deliv = await dc.getDeliverable(delivId);
        const tc = new TeamController();
        const team = await tc.createTeam(teamId, deliv, people, {});
        return team;
    }

    public static async createRepository(repoName: string, delivName: string, teamName: string): Promise<Repository> {
        const tc = new TeamController();
        const rc = new RepositoryController();
        const dc = new DeliverablesController();

        const deliv = await dc.getDeliverable(delivName);
        const team = await tc.getTeam(teamName);
        const repo = await rc.createRepository(repoName, deliv, [team], {});

        return repo;
    }

    public static async prepareRepositories(): Promise<void> {
        Log.test("Test::prepareRepositories() - start");
        try {
            const db = DatabaseController.getInstance();
            // const tc = new TeamController();
            // const rc = new RepositoryController();
            //
            // let team = await tc.getTeam(Test.TEAMNAME1);
            // let repo = await rc.createRepository(Test.REPONAME1, [team], {});

            let repo = await Test.createRepository(Test.REPONAME1, Test.DELIVID1, Test.TEAMNAME1);
            await db.writeRepository(repo);

            // team = await tc.getTeam(Test.TEAMNAME2);
            // repo = await rc.createRepository(Test.REPONAME2, [team], {});
            repo = await Test.createRepository(Test.REPONAME2, Test.DELIVID1, Test.TEAMNAME2);
            await db.writeRepository(repo);

        } catch (err) {
            Log.error("Test::prepareRepositories() - ERROR: " + err);
        }
        Log.test("Test::prepareRepositories() - end");
    }

    public static async prepareGrades(): Promise<void> {

        // NOTE: see FrontendDatasetGenerator for ideas
        const grade: GradePayload = {
            score:     100,
            comment:   'comment',
            urlName:   'urlName',
            URL:       'URL',
            timestamp: new Date(Date.UTC(2018, 1, 1, 1, 1)).getTime(),
            custom:    {}
        };

        const gc = new GradesController();
        // const valid =
        await gc.createGrade(Test.REPONAME1, Test.DELIVID1, grade);
    }

    public static async prepareResults(): Promise<void> {
        // NOTE: see FrontendDatasetGenerator for ideas
        const dc = DatabaseController.getInstance();

        const tuples = [];
        tuples.push({team: await dc.getTeam(Test.TEAMNAME1), repo: await dc.getRepository(Test.REPONAME1)});
        tuples.push({team: await dc.getTeam(Test.TEAMNAME2), repo: await dc.getRepository(Test.REPONAME2)});
        for (const tuple of tuples) {
            for (let i = 0; i < 10; i++) {
                const score = Test.getRandomInt(100);

                const result = Test.createResult(tuple.team.delivId, tuple.repo.id, tuple.team.personIds, score);
                await dc.writeResult(result);
            }
        }
    }

    private static getRandomInt(max: number) {
        return Math.floor(Math.random() * Math.floor(max));
    }

    public static async prepareAuth(): Promise<void> {
        const dc = DatabaseController.getInstance();

        let auth: Auth = {
            personId: Test.USER1.id,
            token:    Test.REALTOKEN
        };
        await dc.writeAuth(auth);

        auth = {
            personId: Test.USERNAMEGITHUB1,
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
            openTimestamp:  new Date(1400000000000).getTime(),
            closeTimestamp: new Date(1500000000000).getTime(),
            gradesReleased: false,

            shouldProvision:  true,
            importURL:        'https://github.com/classytest/PostTestDoNotDelete.git', // TODO: create ImportTestDoNotDelete
            teamMinSize:      2,
            teamMaxSize:      2,
            teamSameLab:      true,
            teamStudentsForm: true,
            teamPrefix:       't',
            repoPrefix:       '',

            visibleToStudents: true,

            shouldAutoTest: true,
            autotest:       {
                dockerImage:        'testImage',
                studentDelay:       60 * 60 * 12, // 12h
                maxExecTime:        300,
                regressionDelivIds: [],
                custom:             {}
            },

            rubric: {},
            custom: {}
        };

        return d;
    }

    public static createGrade(personId: string, delivId: string, score: number): Grade {
        const grade: Grade = {
            personId,
            delivId,
            score,
            comment:   'comment',
            timestamp: Date.now(),
            urlName:   'name',
            URL:       'URL',
            custom:    {}
        };
        return grade;
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

    public static async prepareAssignment() {
        const dc: DeliverablesController = new DeliverablesController();

        const newAssignmentStatus: AssignmentStatus = AssignmentStatus.INACTIVE;

        const newAssignmentGradingRubric: AssignmentGradingRubric = {
            name:      Test.ASSIGNID0,
            comment:   "test assignment",
            questions: [
                {
                    name:         "question 1",
                    comment:      "",
                    subQuestions: [
                        {
                            name:      "rubric",
                            comment:   "rubric question",
                            outOf:     5,
                            weight:    0.25,
                            modifiers: null
                        }
                    ]
                },
                {
                    name:         "question 2",
                    comment:      "",
                    subQuestions: [
                        {
                            name:      "code quality",
                            comment:   "",
                            outOf:     6,
                            weight:    0.5,
                            modifiers: null
                        }
                    ]
                }
            ]
        };

        const newAssignmentInfo: AssignmentInfo = {
            seedRepoURL:  "https://github.com/SECapstone/capstone",
            seedRepoPath: "",
            mainFilePath: "",
            courseWeight: 0.5,
            status:       newAssignmentStatus,
            rubric:       newAssignmentGradingRubric,
            repositories: []
        };

        const openDate: Date = new Date();
        openDate.setHours(openDate.getHours() + 4);

        const closeDate: Date = new Date();
        closeDate.setDate(closeDate.getDate() + 4);

        const openNumber: number = Date.parse(openDate.toISOString());
        const closeNumber: number = Date.parse(closeDate.toISOString());

        const newDeliv: Deliverable = {
            id:                Test.ASSIGNID0,
            URL:               "",
            repoPrefix:        Test.ASSIGNID0 + "_",
            openTimestamp:     openNumber,
            closeTimestamp:    closeNumber,
            gradesReleased:    false,
            shouldProvision:   true,
            importURL:         null,
            teamMinSize:       1,
            teamMaxSize:       1,
            teamSameLab:       false,
            teamStudentsForm:  false,
            teamPrefix:        Test.ASSIGNID0 + "_",
            shouldAutoTest:    true,
            autotest:          {
                dockerImage:        'testImage',
                studentDelay:       60 * 60 * 12, // 12h
                maxExecTime:        300,
                regressionDelivIds: [],
                custom:             {}
            },
            visibleToStudents: true,

            rubric: {},
            custom: {
                assignment: newAssignmentInfo
            }
        };

        // const newDelivSuccess =
        await dc.saveDeliverable(newDeliv);

        // await this.createTeam(this.ASSIGNTEAMNAME0, Test.ASSIGNID0, [Test.REALUSER1.id]);
    }

    public static async prepareAssignmentTeam() {
        await this.createTeam(this.ASSIGNTEAMNAME0, Test.ASSIGNID0, [Test.REALUSER1.id]);
    }

    public static async prepareAssignmentTeam2() {
        await this.createTeam(Test.ASSIGNTEAMNAME1, Test.ASSIGNID1, [Test.REALUSER1.id]);
    }

    public static async prepareAssignment2() {
        const dc: DeliverablesController = new DeliverablesController();

        const newAssignmentStatus: AssignmentStatus = AssignmentStatus.INACTIVE;

        const newAssignmentGradingRubric: AssignmentGradingRubric = {
            name:      Test.ASSIGNID1,
            comment:   "test assignment2",
            questions: []
        };

        const newAssignmentInfo: AssignmentInfo = {
            seedRepoURL:  "https://github.com/CPSC340/test_repository",
            seedRepoPath: "labs/lab2/*",
            mainFilePath: "labs/lab2/a2.tex",
            courseWeight: 0.5,
            status:       newAssignmentStatus,
            rubric:       newAssignmentGradingRubric,
            repositories: []
        };

        const openDate: Date = new Date();
        openDate.setHours(openDate.getHours() + 4);

        const closeDate: Date = new Date();
        closeDate.setDate(closeDate.getDate() + 4);

        const openNumber: number = Date.parse(openDate.toISOString());
        const closeNumber: number = Date.parse(closeDate.toISOString());

        const newDeliv: Deliverable = {
            id:                Test.ASSIGNID1,
            URL:               "",
            repoPrefix:        "",
            visibleToStudents: false,
            rubric:            {},
            openTimestamp:     openNumber,
            closeTimestamp:    closeNumber,
            gradesReleased:    false,
            shouldProvision:   true,
            importURL:         null,
            teamMinSize:       1,
            teamMaxSize:       1,
            teamSameLab:       false,
            teamStudentsForm:  false,
            teamPrefix:        "",
            shouldAutoTest:    true,
            autotest:          {
                dockerImage:        'testImage',
                studentDelay:       60 * 60 * 12, // 12h
                maxExecTime:        300,
                regressionDelivIds: [],
                custom:             {}
            },
            custom:            {
                assignment: newAssignmentInfo
            }
        };

        // const newDelivSuccess =
        await dc.saveDeliverable(newDeliv);

        // await this.createTeam(Test.ASSIGNTEAMNAME1, Test.ASSIGNID1, [Test.REALUSER1.id]);
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

    public static readonly TEAMNAME1 = 't_d0_user1id_user2id';
    public static readonly TEAMNAME2 = 'TESTteam2';
    public static readonly TEAMNAME3 = 'TESTteam3';
    public static readonly TEAMNAME4 = 'TESTteam4';
    public static readonly TEAMNAMEREAL = 't_d0_cpscbot_rthse2';
    public static readonly INVALIDTEAMNAME = "InvalidTeamNameShouldNotExist";

    public static readonly USER1 = {id: 'user1id', csId: 'user1id', github: 'user1gh'};
    public static readonly USER2 = {id: 'user2id', csId: 'user2id', github: 'user2gh'};
    public static readonly USER3 = {id: 'user3id', csId: 'user3id', github: 'user3gh'};
    public static readonly USER4 = {id: 'user4id', csId: 'user4id', github: 'user4gh'};

    public static readonly INVALIDUSER1 = {id: 'invalidUser1id', csId: 'invalidUser1id', github: 'invalidUser1gh'};

    public static readonly ADMIN1 = {id: 'classyadmin', csId: 'classyadmin', github: 'classyadmin'};
    // public static readonly ADMIN1 = {id: 'atest-01', csId: 'atest-01', github: 'atest-01'}; // github-dev.ugrad
    public static readonly STAFF1 = {id: 'classystaff', csId: 'classystaff', github: 'classystaff'};
    // public static readonly STAFF1 = {id: 'atest-02', csId: 'atest-02', github: 'atest-02'}; // github-dev.ugrad (not provisioned yet)

    public static readonly REALUSER1 = {id: 'rthse2', csId: 'rthse2', github: 'rthse2'}; // real account for testing users
    public static readonly REALUSER2 = {id: "jopika", csId: "jopika", github: "jopika"}; // real account for testing users
    public static readonly REALUSER3 = {id: "atest-01", csId: "atest-01", github: "atest-01"}; // real account for testing users

    public static readonly USERNAMEGITHUB1 = "cpscbot";
    public static readonly USERNAMEGITHUB2 = "rthse2";
    // public static readonly USERNAMEGITHUB1 = "atest-01"; // "cpscbot"; // github-dev.ugrad
    // public static readonly USERNAMEGITHUB2 = "atest-02"; // "rthse2"; // github-dev.ugrad
    public static readonly USERNAMEGITHUB3 = "ubcbot";
    public static readonly USERNAMEGITHUB4 = "classystaff";

    public static readonly DELIVIDPROJ = 'project';
    public static readonly DELIVID0 = 'd0';
    public static readonly DELIVID1 = 'd1';
    public static readonly DELIVID2 = 'd2';
    public static readonly DELIVID3 = 'd3';
    public static readonly ASSIGNID0 = 'a0';
    public static readonly ASSIGNID1 = 'a1';

    public static readonly REPONAME1 = 'TESTrepo1';
    public static readonly REPONAME2 = 'TESTrepo2';
    public static readonly REPONAME3 = 'TESTrepo3';
    public static readonly REPONAMEREAL = 'd0_cpscbot_rthse2';
    public static readonly INVALIDREPONAME = "InvalidRepoNameShouldNotExist";

    public static readonly REALTOKEN = 'realtoken';
    public static readonly FAKETOKEN = 'faketoken';

    public static readonly ASSIGNTEAMNAME0 = Test.ASSIGNID0 + "__" + Test.REALUSER1.id;
    public static readonly ASSIGNTEAMNAME1 = Test.ASSIGNID1 + "__" + Test.REALUSER1.id;

    public static getDeliverable(delivId: string): Deliverable {
        const deliv: Deliverable = {
            id: delivId,

            URL:               'https://NOTSET',
            openTimestamp:     -1,
            closeTimestamp:    -1,
            gradesReleased:    false,
            // delay:            -1,
            shouldProvision:   false,
            importURL:         'https://github.com/classytest/PostTestDoNotDelete.git',
            teamMinSize:       1,
            teamMaxSize:       1,
            teamSameLab:       false,
            teamStudentsForm:  false,
            teamPrefix:        'team',
            repoPrefix:        '',
            // bootstrapUrl:     '',
            shouldAutoTest:    true,
            autotest:          {
                dockerImage:        'testImage',
                studentDelay:       60 * 60 * 12, // 12h
                maxExecTime:        300,
                regressionDelivIds: [],
                custom:             {}
            },
            visibleToStudents: true,
            rubric:            {},
            custom:            {}
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
            // URL:       Config.getInstance().getProp(ConfigKey.githubHost) + '/' +
            //            Config.getInstance().getProp(ConfigKey.org) + '/teams/' + teamId,
            URL:       null,
            personIds: people,
            custom:    {}
        };
        return Util.clone(team) as Team;
    }

    public static getRepository(id: string, delivId: string, teamId: string): Repository {
        const repo: Repository = {
            id:       id,
            delivId:  delivId,
            URL:      Config.getInstance().getProp(ConfigKey.githubHost) + '/' + id,
            cloneURL: Config.getInstance().getProp(ConfigKey.githubHost) + '/' + id + '.git',
            teamIds:  [teamId],
            custom:   {}
        };
        return Util.clone(repo) as Repository;
    }

    public static createCourseRecord(): Course {
        const courseId = Config.getInstance().getProp(ConfigKey.name);
        const out: Course = {
            id:                   courseId,
            defaultDeliverableId: null,
            custom:               {}
        };
        return out;
    }

    public static createResult(delivId: string, repoId: string, people: string[], score: number): Result {

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

    public static async deleteStaleRepositories(): Promise<boolean> {
        Log.test('GlobalSpec::deleteStaleRepositories() - start');
        const gh: IGitHubActions = GitHubActions.getInstance(true);
        const repos = await gh.listRepos();

        const TESTREPONAMES = [
            "testtest__repo1",
            "secap_cpscbot",
            "secap_rthse2",
            "secap_ubcbot",
            "secap_testtest__repo1",
            "TESTrepo1",
            "TESTrepo2",
            "TESTrepo3",
            "a0__rthse2",
            "a0_rthse2",
            this.REPONAME1,
            this.REPONAMEREAL
        ];

        const TESTTEAMNAMES = [
            "rtholmes",
            "ubcbot",
            "rthse2",
            "cpscbot",
            "TEST__X__t_TESTteam1",
            "TESTteam1",
            "TESTteam2",
            "TESTteam3",
            this.TEAMNAMEREAL
        ];

        const DELAY_SHORT = 200;
        const ASSIGNREPO1 = "TEST__X__secap_" + Test.ASSIGNID0;
        const ASSIGNREPO2 = "TEST__X__secap_" + Test.ASSIGNID1;
        const TEAMNAME = "TEST__X__t_" + Test.TEAMNAME1;

        // delete test repos if needed
        for (const repo of repos as any) {
            for (const r of TESTREPONAMES) {
                if (repo.name === r) {
                    Log.info('Removing stale repo: ' + repo.name);
                    const val = await gh.deleteRepo(r);
                    await Util.delay(DELAY_SHORT);
                    // expect(val).to.be.true;
                }
            }
        }

        // delete test repos if needed
        for (const repo of repos as any) {
            Log.info('Evaluating repo: ' + repo.name);
            if (repo.name.indexOf('TEST__X__') === 0 ||
                repo.name.startsWith(ASSIGNREPO1) ||
                repo.name.startsWith(ASSIGNREPO2) ||
                repo.name.startsWith("test_") ||
                repo.name.startsWith(Test.ASSIGNID0 + "_") ||
                repo.name.startsWith(Test.ASSIGNID1 + "_") ||
                repo.name.endsWith("_grades")) {
                Log.info('Removing stale repo: ' + repo.name);
                const val = await gh.deleteRepo(repo.name);
                // expect(val).to.be.true;
                const teamName = repo.name.substr(15);
                Log.info('Adding stale team name: ' + repo.name);
                TESTTEAMNAMES.push(teamName);
            }
        }

        // delete teams if needed
        const teams = await gh.listTeams();
        expect(teams).to.be.an('array');
        // expect(teams.length > 0).to.be.true; // can have 0 teams
        Log.test('All Teams: ' + JSON.stringify(teams));
        Log.test('Stale Teams: ' + JSON.stringify(TESTTEAMNAMES));
        for (const team of teams as any) {
            // Log.info('Evaluating team: ' + JSON.stringify(team));
            let done = false;
            for (const t of TESTTEAMNAMES) {
                if (team.name === t ||
                    team.name.startsWith(Test.ASSIGNID0 + "_")
                ) {
                    Log.test("Removing stale team: " + team.name);
                    const val = await gh.deleteTeam(team.id);
                    await Util.delay(DELAY_SHORT);
                    done = true;
                }
            }
            if (done === false) {
                if (team.name.startsWith(TEAMNAME) === true) {
                    Log.test("Removing stale team: " + team.name);
                    await gh.deleteTeam(team.id);
                    await Util.delay(DELAY_SHORT);
                }
            }
        }
        Log.test('GitHubActionSpec::deleteStale() - done');
        return true;
    }
}
