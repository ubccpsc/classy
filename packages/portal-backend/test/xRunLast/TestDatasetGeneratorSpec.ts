import {expect} from "chai";
import "mocha";

import {PersonController} from "../../src/controllers/PersonController";
import {Auth, Course, Deliverable, Person} from "../../src/Types";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {TeamController} from "../../src/controllers/TeamController";
import {Test} from "../GlobalSpec";
import {RepositoryController} from "../../src/controllers/RepositoryController";
import {DatabaseController} from "../../src/controllers/DatabaseController";
import Config, {ConfigKey} from "../../../common/Config";

const loadFirst = require('../GlobalSpec');

describe('TestDatasetGenerator', function () {


    it('Can generate the course object', async function () {
        const dc: DatabaseController = DatabaseController.getInstance();

        let course: Course = {
            id:                   Config.getInstance().getProp(ConfigKey.testname),
            defaultDeliverableId: 'd0',
            custom:               {}
        };

        await dc.writeCourseRecord(course);

    });

    it('Can generate some students', async function () {
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
        await pc.createPerson(p);

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
        await pc.createPerson(p);

        for (let i = 0; i < 40; i++) {
            const pid = 'p' + i;

            let p: Person = {
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

            await pc.createPerson(p);
        }
    });

    it('Can generate some auth tokens', async function () {
        const dc: DatabaseController = DatabaseController.getInstance();

        // create for an admin
        let a: Auth = {personId: Test.USERNAMEADMIN, token: 'TEST_TOKENADMIN'};
        await dc.writeAuth(a);

        // create for a student
        a = {personId: Test.USERNAME1, token: 'TEST_TOKENSTUDENT'};
        await dc.writeAuth(a);
    });

    it('Can generate some teams', async function () {
        const tc: TeamController = new TeamController();
        const pc: PersonController = new PersonController();
        let pA = await pc.getPerson('p1');
        let pB = await pc.getPerson('p2');
        await tc.createTeam(Test.TEAMNAME1, [pA, pB], {});

        pA = await pc.getPerson('p3');
        pB = await pc.getPerson('p4');
        let pC = await pc.getPerson('p5');
        await tc.createTeam(Test.TEAMNAME2, [pA, pB, pC], {});
    });


    it('Can generate some repos', async function () {
        const tc: TeamController = new TeamController();

        const teams = await tc.getAllTeams();
        const rc: RepositoryController = new RepositoryController();

        await rc.createRepository(Test.REPONAME1, [teams[0]], {});
        await rc.createRepository(Test.REPONAME2, [teams[1]], {});
    });


    it('Can generate some deliverables', async function () {
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

            await dc.saveDeliverable(deliv);
        }
    });


});