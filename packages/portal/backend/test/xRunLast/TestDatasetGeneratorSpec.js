"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("mocha");
const PersonController_1 = require("../../src/controllers/PersonController");
const DeliverablesController_1 = require("../../src/controllers/DeliverablesController");
const TeamController_1 = require("../../src/controllers/TeamController");
const GlobalSpec_1 = require("../GlobalSpec");
const RepositoryController_1 = require("../../src/controllers/RepositoryController");
const DatabaseController_1 = require("../../src/controllers/DatabaseController");
const Config_1 = require("../../../../common/Config");
const loadFirst = require('../GlobalSpec');
describe('TestDatasetGenerator', function () {
    it('Can generate the course object', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = DatabaseController_1.DatabaseController.getInstance();
            let course = {
                id: Config_1.default.getInstance().getProp(Config_1.ConfigKey.testname),
                defaultDeliverableId: 'd0',
                custom: {}
            };
            yield dc.writeCourseRecord(course);
        });
    });
    it('Can generate some students', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const pc = new PersonController_1.PersonController();
            // create an admin
            let p = {
                id: GlobalSpec_1.Test.USERNAMEADMIN,
                csId: GlobalSpec_1.Test.USERNAMEADMIN,
                githubId: GlobalSpec_1.Test.USERNAMEADMIN,
                studentNumber: -1,
                fName: 'adminFirst',
                lName: 'adminLast',
                kind: null,
                URL: null,
                labId: null,
                custom: {}
            };
            yield pc.createPerson(p);
            // create a student
            p = {
                id: GlobalSpec_1.Test.USERNAME1,
                csId: GlobalSpec_1.Test.USERNAME1,
                githubId: GlobalSpec_1.Test.USERNAME1,
                studentNumber: -1,
                fName: 'adminFirst',
                lName: 'adminLast',
                kind: 'student',
                URL: null,
                labId: null,
                custom: {}
            };
            yield pc.createPerson(p);
            for (let i = 0; i < 40; i++) {
                const pid = 'p' + i;
                let p = {
                    id: pid,
                    csId: pid,
                    githubId: pid,
                    studentNumber: i,
                    fName: pid + 'first',
                    lName: pid + 'last',
                    kind: 'student',
                    URL: null,
                    labId: 'l1a',
                    custom: {}
                };
                yield pc.createPerson(p);
            }
        });
    });
    it('Can generate some auth tokens', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = DatabaseController_1.DatabaseController.getInstance();
            // create for an admin
            let a = { personId: GlobalSpec_1.Test.USERNAMEADMIN, token: 'TEST_TOKENADMIN' };
            yield dc.writeAuth(a);
            // create for a student
            a = { personId: GlobalSpec_1.Test.USERNAME1, token: 'TEST_TOKENSTUDENT' };
            yield dc.writeAuth(a);
        });
    });
    it('Can generate some teams', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const tc = new TeamController_1.TeamController();
            const pc = new PersonController_1.PersonController();
            let pA = yield pc.getPerson('p1');
            let pB = yield pc.getPerson('p2');
            yield tc.createTeam(GlobalSpec_1.Test.TEAMNAME1, [pA, pB], {});
            pA = yield pc.getPerson('p3');
            pB = yield pc.getPerson('p4');
            let pC = yield pc.getPerson('p5');
            yield tc.createTeam(GlobalSpec_1.Test.TEAMNAME2, [pA, pB, pC], {});
        });
    });
    it('Can generate some repos', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const tc = new TeamController_1.TeamController();
            const teams = yield tc.getAllTeams();
            const rc = new RepositoryController_1.RepositoryController();
            yield rc.createRepository(GlobalSpec_1.Test.REPONAME1, [teams[0]], {});
            yield rc.createRepository(GlobalSpec_1.Test.REPONAME2, [teams[1]], {});
        });
    });
    it('Can generate some deliverables', function () {
        return __awaiter(this, void 0, void 0, function* () {
            const dc = new DeliverablesController_1.DeliverablesController();
            const d = {
                id: '',
                URL: 'http://NOTSET',
                openTimestamp: -1,
                closeTimestamp: -1,
                gradesReleased: false,
                // delay:          300,
                teamMinSize: 1,
                teamMaxSize: 2,
                teamSameLab: true,
                teamStudentsForm: true,
                teamPrefix: 'team_',
                repoPrefix: '',
                // bootstrapUrl:     '',
                autotest: {
                    dockerImage: 'testImage',
                    studentDelay: 60 * 60 * 12,
                    maxExecTime: 300,
                    regressionDelivIds: [],
                    custom: {}
                },
                custom: {}
            };
            for (let i = 0; i < 5; i++) {
                const deliv = JSON.parse(JSON.stringify(d));
                deliv.id = 'd' + i;
                deliv.repoPrefix = 'd' + i + '_';
                deliv.openTimestamp = new Date().getTime();
                deliv.closeTimestamp = new Date().getTime();
                yield dc.saveDeliverable(deliv);
            }
        });
    });
});
//# sourceMappingURL=TestDatasetGeneratorSpec.js.map