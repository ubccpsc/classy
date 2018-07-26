/* istanbul ignore file */
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {Test} from "../GlobalSpec";
import Log from "../../../../common/Log";

export class FrontendDatasetGenerator {

    private dc: DatabaseController = null;

    constructor() {
        this.dc = DatabaseController.getInstance();
    }

    async create(): Promise<void> {
        Log.info("FrontendDatasetGenerator::create() - start");
        await this.createDeliverables();
        await this.createPeople();
        await this.createTeams();
        await this.createGrades();
        Log.info("FrontendDatasetGenerator::create() - done");
    }

    async createDeliverables(): Promise<void> {
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
    }

    async createPeople(): Promise<void> {
        Log.info("FrontendDatasetGenerator::createPeople() - start");

        let person = Test.getPerson(Test.USERNAMEADMIN);
        person.kind = null;
        await this.dc.writePerson(person);

        person = Test.getPerson(Test.USERNAME1);
        person.kind = 'student';
        await this.dc.writePerson(person);

        person = Test.getPerson(Test.USERNAME2);
        person.kind = 'student';
        await this.dc.writePerson(person);

        person = Test.getPerson(Test.USERNAME3);
        person.kind = 'student';
        await this.dc.writePerson(person);

        for (let i = 0; i < 50; i++) {
            person = Test.getPerson('student_' + i);
            person.kind = 'student';
            await this.dc.writePerson(person);
        }
    }

    async createTeams(): Promise<void> {
        Log.info("FrontendDatasetGenerator::createTeams() - start");

        return null;
    }

    async createGrades(): Promise<void> {
        Log.info("FrontendDatasetGenerator::createGrades() - start");

        // public static getGrade(delivId: string, personId: string, score: number): Grade {
        let grade = Test.getGrade(Test.DELIVID0, Test.USERNAME1, 65);
        await this.dc.writeGrade(grade);

        grade = Test.getGrade(Test.DELIVID1, Test.USERNAME1, 78);
        await this.dc.writeGrade(grade);

        grade = Test.getGrade(Test.DELIVID0, Test.USERNAME2, 80);
        await this.dc.writeGrade(grade);

        grade = Test.getGrade(Test.DELIVID2, Test.USERNAME2, 80);
        await this.dc.writeGrade(grade);

        grade = Test.getGrade(Test.DELIVID1, Test.USERNAME3, 99);
        await this.dc.writeGrade(grade);

        // 100 random scores
        let delivnames = [Test.DELIVID0, Test.DELIVID1, Test.DELIVID3];
        for (let i = 0; i < 100; i++) {
            let user = 'student_' + this.getRandomInt(50);
            let deliv = delivnames[this.getRandomInt(3)];
            let score = this.getRandomInt(100);

            grade = Test.getGrade(deliv, user, score);
            await this.dc.writeGrade(grade);
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
    fedg.create().then(function (done) {
        Log.info('create done');
        process.exit();
    }).catch(function (err) {
        Log.error('create ERROR: ' + err);
    });
}

