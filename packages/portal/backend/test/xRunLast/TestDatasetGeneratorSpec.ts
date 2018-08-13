import {expect} from "chai";
import "mocha";

import Config, {ConfigKey} from "../../../../common/Config";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";

import {PersonController} from "../../src/controllers/PersonController";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {TeamController} from "../../src/controllers/TeamController";
import {Auth, Course, Deliverable, Person} from "../../src/Types";

import {Test} from "../GlobalSpec";
// const loadFirst = require('../GlobalSpec');

describe('TestDatasetGenerator', function() {

    it('Can generate the course object', async function() {
        const dc: DatabaseController = DatabaseController.getInstance();

        const course: Course = {
            id:                   Config.getInstance().getProp(ConfigKey.testname),
            defaultDeliverableId: 'd0',
            custom:               {}
        };

        await dc.writeCourseRecord(course);

    });

    it('Can generate some students', async function() {
        const pc: PersonController = new PersonController();

        // create an admin
        let p: Person = {
            id:            Test.USERNAMEADMIN,
            csId:          Test.USERNAMEADMIN,
            githubId:      Test.USERNAMEADMIN,
            studentNumber: -1,

            fName: 'adminFirst',
            lName: 'adminLast',
            kind:  null,
            URL:   null,

            labId: null,

            custom: {}
        };

        try {
            await pc.createPerson(p);
        } catch (e) {
            // Person already exists, should fine fine
        }

        // create a student
        p = {
            id:            Test.USERNAME1,
            csId:          Test.USERNAME1,
            githubId:      Test.USERNAME1,
            studentNumber: -1,

            fName: 'adminFirst',
            lName: 'adminLast',
            kind:  'student',
            URL:   null,

            labId: null,

            custom: {}
        };

        try {
            await pc.createPerson(p);
        } catch (e) {
            // Person already exists, should fine fine
        }

        for (let i = 0; i < 40; i++) {
            const pid = 'p' + i;

            p = {
                id:            pid,
                csId:          pid,
                githubId:      pid,
                studentNumber: i,

                fName: pid + 'first',
                lName: pid + 'last',
                kind:  'student',
                URL:   null,

                labId: 'l1a',

                custom: {}
            };

            try {
                await pc.createPerson(p);
            } catch (e) {
                // Person already exists, should fine fine
            }
        }
    });

    it('Can generate some auth tokens', async function() {
        const dc: DatabaseController = DatabaseController.getInstance();

        // create for an admin
        let a: Auth = {personId: Test.USERNAMEADMIN, token: 'TEST_TOKENADMIN'};
        await dc.writeAuth(a);

        // create for a student
        a = {personId: Test.USERNAME1, token: 'TEST_TOKENSTUDENT'};
        await dc.writeAuth(a);
    });

    it('Can generate some deliverables', async function() {
        const dc: DeliverablesController = new DeliverablesController();

        const d: Deliverable = {
            id: '',

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

        for (let i = 0; i < 5; i++) {
            const deliv = JSON.parse(JSON.stringify(d));
            deliv.id = 'd' + i;
            deliv.repoPrefix = 'd' + i + '_';
            deliv.openTimestamp = new Date().getTime();
            deliv.closeTimestamp = new Date().getTime();
            try {
                await dc.saveDeliverable(deliv);
            } catch (e) {
                // Fail silently, it's fine, the deliverable already exists
            }
        }
    });

    it('Can generate some teams', async function() {
        const tc: TeamController = new TeamController();
        const pc: PersonController = new PersonController();
        const dc = DatabaseController.getInstance();

        let pA = await pc.getPerson('p1');
        let pB = await pc.getPerson('p2');
        const deliv = await dc.getDeliverable('d0');
        try {
            await tc.createTeam(Test.TEAMNAME3, deliv, [pA, pB], {});
        } catch (e) {
            // Fail silently, it's fine, the team already exists
        }

        pA = await pc.getPerson('p3');
        pB = await pc.getPerson('p4');
        const pC = await pc.getPerson('p5');
        try {
            await tc.createTeam(Test.TEAMNAME4, deliv, [pA, pB, pC], {});
        } catch (e) {
            // Fail silently, it's fine, the team already exists
        }
    });

    it('Can generate some repos', async function() {
        const tc: TeamController = new TeamController();

        const teams = await tc.getAllTeams();
        const rc: RepositoryController = new RepositoryController();

        try {
            await rc.createRepository(Test.REPONAME1, [teams[0]], {});
        } catch (e) {

        }

        try {
            await rc.createRepository(Test.REPONAME2, [teams[1]], {});
        } catch (e) {

        }
    });

});
