import {expect} from "chai";
import "mocha";

import {Test} from "../../GlobalSpec";

import {GradesController} from "../../../src/controllers/GradesController";
import {AssignmentController} from "../../../src/controllers/340/AssignmentController";
import {RepositoryController} from "../../../src/controllers/RepositoryController";
import {TeamController} from "../../../src/controllers/TeamController";
import {Deliverable, Grade, Repository, Team} from "../../../src/Types";
import {
    AssignmentGrade,
    AssignmentGradingRubric,
    AssignmentInfo,
    AssignmentStatus
} from "../../../../../common/types/CS340Types";
import Log from "../../../../../common/Log";
import {GitHubController} from "../../../src/controllers/GitHubController";
import {GitHubActions} from "../../../src/controllers/GitHubActions";
import {DeliverablesController} from "../../../src/controllers/DeliverablesController";
import Config, {ConfigKey} from "../../../../../common/Config";
import {PersonController} from "../../../src/controllers/PersonController";
import {DatabaseController} from "../../../src/controllers/DatabaseController";

const loadFirst = require('../../GlobalSpec');
const dFirst = require('../GradeControllerSpec');

const TEST_ORG = "CPSC340";
const TEST_STUDENT_ID_0 = "student0";
const TEST_STUDENT_ID_1 = "student1";
const TEST_STUDENT_ID_2 = "student2";
const TEST_STUDENT_ID_3 = "student3";

const TEST_STUDENT_MAP = [
    TEST_STUDENT_ID_0,
    TEST_STUDENT_ID_1,
    TEST_STUDENT_ID_2,
    TEST_STUDENT_ID_3
];


const TEST_ASSIGN_NAME = "test_assignDeliv3";
const TEST_REPO_PREFIX = "test_assignDeliv3_";
const ORIGINAL_ORG = Config.getInstance().getProp(ConfigKey.org);


const TIMEOUT = 7500;

let DELAY_SEC = 1000;
let DELAY_SHORT = 200;


describe("CS340: AssignmentController", () => {
    let ac: AssignmentController = new AssignmentController();
    let gc: GradesController = new GradesController();
    let tc: TeamController = new TeamController();
    let rc: RepositoryController = new RepositoryController();
    let dc: DeliverablesController = new DeliverablesController();
    let pc: PersonController = new PersonController();
    let gh: GitHubController = new GitHubController();
    let gha: GitHubActions;
    let db: DatabaseController = DatabaseController.getInstance();

    let numberOfStudents: number;

    before(async () => {
        let peopleList = await pc.getAllPeople();
        numberOfStudents = peopleList.length;

        // change org to testing org for safety
        Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
        gha = new GitHubActions();
        // create assignment Deliverables
        let newAssignmentStatus: AssignmentStatus = AssignmentStatus.INACTIVE;

        let newAssignmentGradingRubric: AssignmentGradingRubric = {
            name : TEST_ASSIGN_NAME,
            comment : "test assignment",
            questions : [
                {
                    name : "question 1",
                    comment : "",
                    subQuestions : [
                        {
                            name : "rubric",
                            comment : "rubric question",
                            outOf : 5,
                            weight : 0.25,
                            modifiers : null
                        }
                    ]
                },
                {
                    name : "question 2",
                    comment : "",
                    subQuestions : [
                        {
                            name : "code quality",
                            comment : "",
                            outOf : 6,
                            weight : 0.5,
                            modifiers : null
                        }
                    ]
                }
            ]
        };


        let newAssignmentInfo: AssignmentInfo = {
            seedRepoURL: "https://github.com/SECapstone/capstone",
                seedRepoPath: "",
                status: newAssignmentStatus,
                rubric: newAssignmentGradingRubric,
                repositories: [],
        };

        let newDeliv: Deliverable = {
            id: TEST_ASSIGN_NAME,
            URL: "",
            repoPrefix: TEST_REPO_PREFIX,
            openTimestamp: -1 ,
            closeTimestamp: -2,
            gradesReleased: false,
            teamMinSize: 1,
            teamMaxSize: 1,
            teamSameLab: false,
            teamStudentsForm: false,
            teamPrefix: TEST_REPO_PREFIX,
            autotest: null,
            custom: newAssignmentInfo
        };


        let newDelivSuccess = await dc.saveDeliverable(newDeliv);

        expect(newDelivSuccess).to.not.be.null;
        Log.info("Successfully created new Assignment Deliverable for testing")

        // this.ac
        // this.gc
        // this.tc
        // this.rc
        // this.dc
        // this.pc
        // this.gh
        // this.gha
    });

    beforeEach(() => {
        // initialize a new controller before each tests
        ac = new AssignmentController();
    });

    after(() => {
        Log.test("AssignmentControllerSpec::after() - start; replacing original org");
        // return to original org
        Config.getInstance().setProp(ConfigKey.org, ORIGINAL_ORG);
    });

    it("Attempting to retrieve an assignment grade that doesn't exist should return null.", async () => {
        let assignmentGrades = await ac.getAssignmentGrade("student1", "a1");
        expect(assignmentGrades).equals(null);
    });

    it("Should be able to create an assignment grade.", async () => {
        // Check there is no grade associated with the assignment specified
        let assignmentGrade = await ac.getAssignmentGrade(TEST_STUDENT_ID_0, "a2");
        expect(assignmentGrade).equals(null);

        let aPayload = {
            assignmentID: "a2",
            studentID:    TEST_STUDENT_ID_0,
            questions:    [
                {
                    questionName: "Question 1",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       4,
                            feedback:    "Good job!"
                        },
                        {
                            sectionName: "reasoning",
                            grade:       5,
                            feedback:    ""
                        }
                    ]
                },
                {
                    questionName: "Question 2",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       2,
                            feedback:    "Improper implementation"
                        }
                    ]
                }
            ]
        };
        let team1: Team = await tc.getTeam(Test.TEAMNAME1);

        let repo3: Repository = await rc.createRepository(Test.REPONAME3, [team1], null);

        await ac.setAssignmentGrade(Test.REPONAME3, TEST_ASSIGN_NAME, aPayload);

        let aGrade: AssignmentGrade = await ac.getAssignmentGrade(Test.USERNAME1, TEST_ASSIGN_NAME);
        let grade: Grade = await gc.getGrade(Test.USERNAME1, TEST_ASSIGN_NAME);
        // Check if the assignment information is set properly
        expect(aGrade).to.not.be.null;
        expect(aGrade.assignmentID).equals("a2");
        expect(aGrade.studentID).equals(TEST_STUDENT_ID_0);
        expect(aGrade.questions).to.have.lengthOf(2);

        // Check if the grade is set properly
        expect(grade).to.not.be.null;
        expect(grade.score).equals(11);
    });

    it("Should be able to update a grade.", async () => {
        let team1: Team = await tc.getTeam(Test.TEAMNAME1);
        let repo2: Repository = await rc.getRepository(Test.REPONAME3);

        let previousGradeRecords = await gc.getAllGrades(); // Pre command count

        let aPayload = {
            assignmentID: "a2",
            studentID:    TEST_STUDENT_ID_0,
            questions:    [
                {
                    questionName: "Question 1",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       3,
                            feedback:    ""
                        }
                    ]
                },
                {
                    questionName: "Question 2",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       5,
                            feedback:    "Nice job"
                        }
                    ]
                }
            ]
        };

        await ac.setAssignmentGrade(Test.REPONAME3, TEST_ASSIGN_NAME, aPayload);

        let afterGradeRecords = await gc.getAllGrades(); // Post command count

        expect(previousGradeRecords.length - afterGradeRecords.length).to.equal(0);

        let grade: Grade = await gc.getGrade(Test.USERNAME1, TEST_ASSIGN_NAME);
        expect(grade).to.not.be.null;
        expect(grade.score).to.equal(8);
    });

    it("Should be able to handle arbitrary subquestion sizes.", async () => {
        let aPayload = {
            assignmentID: "a2",
            studentID:    TEST_STUDENT_ID_0,
            questions:    [
                {
                    questionName: "Question 1",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       3,
                            feedback:    ""
                        },
                        {
                            sectionName: "writing",
                            grade:       1,
                            feedback:    ""
                        },
                        {
                            sectionName: "logic",
                            grade:       10,
                            feedback:    ""
                        },
                        {
                            sectionName: "quality",
                            grade:       6,
                            feedback:    ""
                        },
                        {
                            sectionName: "grammar",
                            grade:       6,
                            feedback:    ""
                        }
                    ]
                },
                {
                    questionName: "Question 2",
                    commentName:  "",
                    subQuestion:  [
                        {
                            sectionName: "code",
                            grade:       5,
                            feedback:    "Nice job"
                        }
                    ]
                }
            ]
        };

        let success = await ac.setAssignmentGrade(Test.REPONAME3, TEST_ASSIGN_NAME, aPayload);
        expect(success).to.be.true;

        let newGrade = await gc.getGrade(Test.USERNAME1, TEST_ASSIGN_NAME);
        expect(newGrade).to.not.be.null;
        expect(newGrade.score).to.be.equal(31);

        let aGrade = await ac.getAssignmentGrade(Test.USERNAME1, TEST_ASSIGN_NAME);

        expect(aGrade.studentID).to.be.equal(aPayload.studentID);
        expect(aGrade.assignmentID).to.be.equal(aPayload.assignmentID);
    });

    it("Clean stale repositories.", async function() {
        Log.info("Cleaning stale repositories");
        await deleteStale();
        Log.info("Cleaned all stale information");
    }).timeout( 2 * TIMEOUT);

    it("Should be able to create an Assignment Repos.", async function() {
        const exec = Test.runSlowTest();

        if(exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        let allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        let allTeams = await tc.getAllTeams();
        expect(allTeams.length).to.be.greaterThan(0);

        let newAssignRepo: Repository = await ac.createAssignmentRepo(TEST_REPO_PREFIX +
            allStudents[0].id,
            TEST_ASSIGN_NAME, [allTeams[0]]);

        expect(newAssignRepo).to.not.be.null;
    }).timeout(3 * TIMEOUT);

    it("Should be able to release an Assignment Repo.", async function() {
        const exec = Test.runSlowTest();

        if(exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        let allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        let success = await ac.publishAssignmentRepo(TEST_REPO_PREFIX + allStudents[0].id);
        expect(success).to.be.true;
    }).timeout(2 * TIMEOUT);

    it("Should be able to delete Assignment Repo, along with it's records.", async function() {
        const exec = Test.runSlowTest();

        if(exec) {
            Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
        } else {
            Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
            this.skip();
        }

        let allStudents = await pc.getAllPeople();
        expect(allStudents.length).to.be.greaterThan(0);

        let repoName = TEST_REPO_PREFIX + allStudents[0].id;

        let success: boolean = await ac.deleteAssignmentRepository(repoName, TEST_ASSIGN_NAME, true);
        expect(success).to.be.true;
        // TODO: verify records are deleted
    });

    it("Clean stale repositories", async function() {
        Log.info("Cleaning stale repositories");
        await deleteStale();
        Log.info("Cleaned all stale information");
    }).timeout( 2 * TIMEOUT);

    describe("Slow Assignment Tests", () => {

        before(function() {
            Config.getInstance().setProp(ConfigKey.org, Config.getInstance().getProp(ConfigKey.testorg));
            gha = new GitHubActions();

            it("Clean stale repositories", async function() {
                Log.info("Cleaning stale repositories");
                await deleteStale();
                Log.info("Cleaned all stale information");
            }).timeout( 2 * TIMEOUT);

        });

        after( function() {
            Config.getInstance().setProp(ConfigKey.org, ORIGINAL_ORG);

            it("Clean stale repositories", async function() {
                Log.info("Cleaning stale repositories");
                await deleteStale();
                Log.info("Cleaned all stale information");
            }).timeout( 2 * TIMEOUT);

        });

        beforeEach(function () {
            const exec = Test.runSlowTest();

            if(exec) {
                Log.test("AssignmentControllerSpec::slowTests - running; this may take a while...");
            } else {
                Log.test("AssignmentControllerSpec::slowTests - skipping (would take multiple minutes otherwise)");
                this.skip();
            }
        });

        it("Should be able to create all Assignment Repositories at once.", async function() {
            let allStudents = await pc.getAllPeople();
            let studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            let oldGithubRepoArray = await gha.listRepos();
            let oldGithubRepoCount = oldGithubRepoArray.length;

            let success = await ac.initializeAllRepositories(TEST_ASSIGN_NAME);
            expect(success).to.be.true;

            let newGithubRepoArray = await gha.listRepos();
            let newGithubRepoCount = newGithubRepoArray.length;

            expect(newGithubRepoCount).to.be.at.least(oldGithubRepoCount);
        }).timeout(numberOfStudents * 2 * TIMEOUT);

        it("Should be able to publish all Assignment Repositories at once.", async function() {
            let allStudents = await pc.getAllPeople();
            let studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            let success = await ac.publishAllRepositories(TEST_ASSIGN_NAME);
            expect(success).to.be.true;

            // TODO: Verify
        }).timeout(numberOfStudents * TIMEOUT);

        it("Should be able to delete all Assignment Repositories, along with their records", async function() {
            let allStudents = await pc.getAllPeople();
            let studentCount = allStudents.length;
            expect(studentCount).to.be.greaterThan(0);

            let oldGithubRepoArray = await gha.listRepos();
            let oldGithubRepoCount = oldGithubRepoArray.length;

            let success = await ac.deleteAllAssignmentRepositories(TEST_ASSIGN_NAME);
            expect(success).to.be.true;

            let newGithubRepoArray = await gha.listRepos();
            let newGithubRepoCount = newGithubRepoArray.length;

            expect(newGithubRepoCount).to.be.at.most(oldGithubRepoCount);
        }).timeout(numberOfStudents * 2 * TIMEOUT);



    });


    /*
     *
     */






    /*
        ========= IMPORTED CODE FROM GITHUBACTIONSPEC ===========
     */

    const OLDORG = Config.getInstance().getProp(ConfigKey.org);

    async function deleteStale(): Promise<true> {
        Log.test('GitHubActionSpec::deleteStale() - start');
        let gh: GitHubActions = new GitHubActions();
        let repos = await gh.listRepos();
        expect(repos).to.be.an('array');
        // expect(repos.length > 0).to.be.true; // test org can be empty

        // delete test repos if needed
        for (const repo of repos as any) {
            for (const r of TESTREPONAMES) {
                if (repo.name === r) {
                    Log.info('Removing stale repo: ' + repo.name);
                    let val = await gh.deleteRepo(r);
                    await gh.delay(DELAY_SHORT);
                    // expect(val).to.be.true;
                }
            }
        }

        repos = await gh.listRepos();
        // delete test repos if needed
        for (const repo of repos as any) {
            Log.info('Evaluating repo: ' + repo.name);
            if (repo.name.indexOf('TEST__X__') === 0 ||
                repo.name.startsWith(REPONAME) ||
                repo.name.startsWith("test_")) {
                Log.info('Removing stale repo: ' + repo.name);
                let val = await gh.deleteRepo(repo.name);
                // expect(val).to.be.true;
                let teamName = repo.name.substr(15);
                Log.info('Adding stale team name: ' + repo.name);
                TESTTEAMNAMES.push(teamName);
            }
        }

        // delete teams if needed
        let teams = await gh.listTeams();
        expect(teams).to.be.an('array');
        // expect(teams.length > 0).to.be.true; // can have 0 teams
        Log.test('All Teams: ' + JSON.stringify(teams));
        Log.test('Stale Teams: ' + JSON.stringify(TESTTEAMNAMES));
        for (const team of teams as any) {
            // Log.info('Evaluating team: ' + JSON.stringify(team));
            let done = false;
            for (const t of TESTTEAMNAMES) {
                if (team.name === t ||
                    team.name.startsWith(TEST_REPO_PREFIX)
                ) {
                    Log.test("Removing stale team: " + team.name);
                    let val = await gh.deleteTeam(team.id);
                    await gh.delay(DELAY_SHORT);
                    done = true;
                }
            }
            if (done === false) {
                if (team.name.startsWith(TEAMNAME) === true) {
                    Log.test("Removing stale team: " + team.name);
                    let val = await gh.deleteTeam(team.id);
                    await gh.delay(DELAY_SHORT);
                }
            }
        }
        Log.test('GitHubActionSpec::deleteStale() - done');
        return true;
    }

});

const REPONAME = getProjectPrefix() + TEST_ASSIGN_NAME;
const REPONAME3 = getProjectPrefix() + Test.REPONAME3;
const TEAMNAME = getTeamPrefix() + Test.TEAMNAME1;

let TESTREPONAMES = [
    "testtest__repo1",
    "secap_cpscbot",
    "secap_rthse2",
    "secap_ubcbot",
    "secap_testtest__repo1",
    "TESTrepo1",
    "TESTrepo2",
    "TESTrepo3",
];

let TESTTEAMNAMES = [
    "rtholmes",
    "ubcbot",
    "rthse2",
    "cpscbot",
    "TEST__X__t_TESTteam1",
    "TESTteam1",
    "TESTteam2",
    "TESTteam3",
];

function getProjectPrefix(): string {
    return "TEST__X__secap_";
}

function getTeamPrefix() {
    return "TEST__X__t_";
}
