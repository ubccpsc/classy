import Log from "../../../common/Log";
import {Test} from "../../../common/TestHarness";
import {AdminController} from "../src/controllers/AdminController";
/* istanbul ignore file */
import {DatabaseController} from "../src/controllers/DatabaseController";
import {GitHubActions} from "../src/controllers/GitHubActions";
import {GitHubController} from "../src/controllers/GitHubController";
import {TeamController} from "../src/controllers/TeamController";
import {Factory} from "../src/Factory";
import {PersonKind} from "../src/Types";

/**
 * This sample file shows how to create a bunch of fake data for course testing.
 */
export class FrontendDatasetGenerator {

    private dc: DatabaseController = null;
    private ghc = new GitHubController(GitHubActions.getInstance());
    private cc: AdminController = new AdminController(this.ghc);

    constructor() {
        this.dc = DatabaseController.getInstance();
    }

    public async create(): Promise<void> {
        Log.info("FrontendDatasetGenerator::create() - start");
        await this.createDeliverables();
        await this.createPeople();
        await this.createTeams();
        await this.createRepositories();
        await this.createGrades();
        await this.createResults();
        Log.info("FrontendDatasetGenerator::create() - done");
    }

    private async createDeliverables(): Promise<void> {
        Log.info("FrontendDatasetGenerator::createDeliverables() - start");

        let deliv = Test.getDeliverable(Test.DELIVID0);
        deliv.gradesReleased = true;
        await this.dc.writeDeliverable(deliv);

        deliv = Test.getDeliverable(Test.DELIVID1);
        deliv.gradesReleased = true;
        await this.dc.writeDeliverable(deliv);

        deliv = Test.getDeliverable(Test.DELIVID2);
        deliv.gradesReleased = true;
        await this.dc.writeDeliverable(deliv);

        deliv = Test.getDeliverable(Test.DELIVIDPROJ);
        deliv.shouldProvision = true;
        deliv.gradesReleased = true;
        deliv.repoPrefix = '';
        deliv.teamPrefix = 'team';
        await this.dc.writeDeliverable(deliv);
    }

    private async createPeople(): Promise<void> {
        Log.info("FrontendDatasetGenerator::createPeople() - start");

        let person = Test.getPerson(Test.ADMIN1.id);
        person.kind = null;
        await this.dc.writePerson(person);

        person = Test.getPerson(Test.USER1.id);
        person.kind = PersonKind.STUDENT;
        await this.dc.writePerson(person);

        person = Test.getPerson(Test.USER2.id);
        person.kind = PersonKind.STUDENT;
        await this.dc.writePerson(person);

        person = Test.getPerson(Test.USER3.id);
        person.kind = PersonKind.STUDENT;
        await this.dc.writePerson(person);

        for (let i = 0; i < 50; i++) {
            person = Test.getPerson('student-' + i);
            person.kind = PersonKind.STUDENT;
            await this.dc.writePerson(person);
        }
    }

    private async createTeams(): Promise<void> {
        Log.info("FrontendDatasetGenerator::createTeams() - start");
        const cc = await Factory.getCourseController(this.ghc);

        const tc = new TeamController();
        const delivs = await this.dc.getDeliverables();

        for (let i = 0; i < 50; i++) {
            // try i times to make a team
            const p1 = Test.getPerson('student-' + this.getRandomInt(50));
            const p2 = Test.getPerson('student-' + this.getRandomInt(50));
            if (p1.id !== p2.id) {

                const p1Teams = await tc.getTeamsForPerson(p1);
                const p2Teams = await tc.getTeamsForPerson(p2);
                let p1Team = null;
                let p2Team = null;

                // const deliv = delivs[this.getRandomInt(delivs.length)];
                const deliv = await this.dc.getDeliverable(Test.DELIVIDPROJ);

                for (const t of p1Teams) {
                    if (t.delivId === deliv.id) {
                        p1Team = t;
                    }
                }
                for (const t of p2Teams) {
                    if (t.delivId === deliv.id) {
                        p2Team = t;
                    }
                }

                if (p1Team === null && p2Team === null) {

                    const names = await cc.computeNames(deliv, [p1, p2]);
                    // both members not on a team
                    const team = Test.getTeam(names.teamName, deliv.id, [p1.id, p2.id]);
                    Log.info("FrontendDatasetGenerator::createTeams() - creating team: " + team.id);
                    await this.dc.writeTeam(team);
                }
            }
        }
    }

    private async createGrades(): Promise<void> {
        Log.info("FrontendDatasetGenerator::createGrades() - start");

        // public static getGrade(delivId: string, personId: string, score: number): Grade {
        let grade = Test.getGrade(Test.DELIVID0, Test.USER1.id, 65);
        await this.dc.writeGrade(grade);

        grade = Test.getGrade(Test.DELIVID1, Test.USER1.id, 78);
        await this.dc.writeGrade(grade);

        grade = Test.getGrade(Test.DELIVID0, Test.USER2.id, 80);
        await this.dc.writeGrade(grade);

        grade = Test.getGrade(Test.DELIVID2, Test.USER2.id, 80);
        await this.dc.writeGrade(grade);

        grade = Test.getGrade(Test.DELIVID1, Test.USER3.id, 99);
        await this.dc.writeGrade(grade);

        // 100 random scores
        const delivnames = [Test.DELIVID0, Test.DELIVID1, Test.DELIVID3];
        for (let i = 0; i < 100; i++) {
            const user = 'student-' + this.getRandomInt(50);
            const deliv = delivnames[this.getRandomInt(3)];
            const score = this.getRandomInt(100);

            grade = Test.getGrade(deliv, user, score);
            await this.dc.writeGrade(grade);
        }
    }

    private async createRepositories(): Promise<void> {
        Log.info("FrontendDatasetGenerator::createRepositories() - start");
        // make a repository for each team

        // these will be created by provision

        const teams = await this.dc.getTeams();
        for (const team of teams) {
            const repoName = team.id;
            const repo = Test.getRepository(repoName, Test.DELIVID0, team.id);
            await this.dc.writeRepository(repo);
        }
    }

    private async createResults(): Promise<void> {
        Log.info("FrontendDatasetGenerator::createResults() - start");

        // 100 random results
        const teams = await this.dc.getTeams();

        for (let i = 0; i < 100; i++) {
            const index = this.getRandomInt(teams.length);
            const team = teams[index];

            const score = this.getRandomInt(100);
            // NOTE: THIS IS NOT RIGHT; team.id should be repo.id
            const result = Test.createResult(team.delivId, team.id, team.personIds, score);
            await this.dc.writeResult(result);
        }
    }

    private getRandomInt(max: number) {
        return Math.floor(Math.random() * Math.floor(max));
    }
}

if (typeof it === 'function') {
    Log.warn("Frontend data not generated (test suite execution)");
} else {
    const fedg = new FrontendDatasetGenerator();
    fedg.create().then(function() { // done
        Log.info('create done');
        process.exit();
    }).catch(function(err) {
        Log.error('create ERROR: ' + err);
    });
}
