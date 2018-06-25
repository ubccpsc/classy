import {expect} from "chai";
import "mocha";
import {PersonController} from "../../src/controllers/PersonController";
import {Deliverable, Person} from "../../src/Types";
import {DeliverablesController} from "../../src/controllers/DeliverablesController";

const loadFirst = require('../GlobalSpec');
// const loadSecond = require('./server/RestifyAutoTestRoutesSpec');

describe.only('TestDatasetGenerator', function () {

    it('Can generate some students', async function () {
        const pc: PersonController = new PersonController();

        let p: Person = {
            id:            'p1',
            csId:          'p1',
            githubId:      'p1',
            studentNumber: 1,

            fName: 'p1first',
            lName: 'p1last',
            kind:  'student',
            URL:   null,

            labId: 'l1a',

            custom: {}
        };

        for (let i = 0; i < 100; i++) {
            const person = JSON.parse(JSON.stringify(p));
            person.id = 'p' + i;
            person.csid = 'p' + i;
            person.github = 'p' + i;
            person.studntNumber = i;
            person.fName = 'p' + i + 'first';
            person.lName = 'p' + i + 'last';

            await pc.createPerson(person);
        }
    });

    it('Can generate some deliverables', async function () {
        const dc: DeliverablesController = new DeliverablesController();

        const d: Deliverable = {
            id: '',

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