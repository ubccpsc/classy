import {expect} from "chai";
import "mocha";

import {PersonController} from "../../src/controllers/PersonController";
import {Deliverable, Person} from "../../src/Types";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";
import {TeamController} from "../../src/controllers/TeamController";
import {Test} from "../GlobalSpec";
import {RepositoryController} from "../../src/controllers/RepositoryController";

const loadFirst = require('../GlobalSpec');

describe('TestDatasetGenerator', function () {

    it('Can generate some students', async function () {
        const pc: PersonController = new PersonController();

        for (let i = 0; i < 100; i++) {
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