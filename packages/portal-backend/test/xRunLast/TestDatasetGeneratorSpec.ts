import {expect} from "chai";
import "mocha";

import {PersonController} from "../../src/controllers/PersonController";
import {Deliverable, Person} from "../../src/Types";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";

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

    it('Can generate some deliverables', async function () {
        const dc: DeliverablesController = new DeliverablesController();

        const d: Deliverable = {
            id: '',

            url:            'http://NOTSET',
            openTimestamp:  -1,
            closeTimestamp: -1,
            gradesReleased: false,
            delay:          300,

            teamMinSize:      1,
            teamMaxSize:      2,
            teamSameLab:      true,
            teamStudentsForm: true,

            custom: {}
        };

        for (let i = 0; i < 5; i++) {
            const deliv = JSON.parse(JSON.stringify(d));
            deliv.id = 'd' + i;
            deliv.openTimestamp = new Date().getTime();
            deliv.closeTimestamp = new Date().getTime();

            await dc.saveDeliverable(deliv);
        }
    });


});