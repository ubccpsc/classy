import {expect} from "chai";
import "mocha";

import Log from "../../../common/Log";
import {Test} from '../../../common/TestHarness';
import {ClasslistChangesTransportPayload} from "../../../common/types/PortalTypes";
import {ClasslistAgent} from "../src/server/common/ClasslistAgent";

import "./GlobalSpec";

describe('ClasslistAgent', function() {

    const mockAPIData = [{
        SNUM: '8888888', FIRST: 'Todd', LAST: 'Smith', PREF: 'Ted',  ACCT: 'x1x1x', CRS: '999',
        CWL: 'tsmitht', SEC: '101', LAB: 'L1Y', TUT: ''
    },
    {
        SNUM: '7777777', FIRST: 'John', LAST: 'Smith', PREF: 'Jay', ACCT: 'z1z1z', CRS: '991',
        CWL: 'jaysmith7', SEC: '201', LAB: 'L2F', TUT: ''
    },
    {
        SNUM: '6666666', FIRST: 'Cletus', LAST: 'Smith', PREF: 'Clé', ACCT: 'c1c1c', CRS: '210',
        CWL: 'cletus1', SEC: '101', LAB: 'L1Y', TUT: ''
    }];

    const ca: ClasslistAgent = new ClasslistAgent();

    it('Should be able to process an empty classlist', async function() {
        const path = __dirname + '/data/classlistEmpty.csv';
        const classlistChanges = await ca.processClasslist(Test.ADMIN1.id, path, null);
        Log.test('# rows processed: ' + classlistChanges.updated.length + classlistChanges.created.length);
        expect(classlistChanges.updated.length + classlistChanges.created.length).to.equal(0);
    });

    it('Should be able to process a vaild classlist', async function() {
        const path = __dirname + '/data/classlistValid.csv';
        const classlistChanges = await ca.processClasslist(Test.ADMIN1.id, path, null);
        const numChanges = classlistChanges.updated.length + classlistChanges.created.length;
        Log.test('# rows processed: ' + classlistChanges.updated.length + classlistChanges.created.length);
        expect(classlistChanges.updated.length + classlistChanges.created.length).to.equal(5);
    });

    it('Should reject a classlist with empty field in fields: CWL, ACCT', async function() {
        const path = __dirname + '/data/classlistEmptyField.csv';
        let ex = null;
        try {
            await ca.processClasslist(Test.ADMIN1.id, path, null);
        } catch (err) {
            ex = err;
        }
        expect(ex).to.not.be.null;
    });

    it('Should reject a classlist with duplicate data in fields: CWL, ACCT', async function() {
        const path = __dirname + '/data/classlistDuplicateField.csv';
        let ex = null;
        try {
            await ca.processClasslist(Test.ADMIN1.id, path, null);
        } catch (err) {
            ex = err;
        }
        expect(ex).to.not.be.null;
    });

    it('Should be able to process an updated classlist', async function() {
        const path = __dirname + '/data/classlistValidUpdate.csv';
        const classlistChanges = await ca.processClasslist(Test.ADMIN1.id, path, null);
        Log.test('# rows processed: ' + classlistChanges.classlist.length);
        expect(classlistChanges.classlist.length).to.equal(5);
    });

    it('Should not be able to process an invalid classlist', async function() {
        let rows = null;
        let ex = null;
        try {
            const path = __dirname + '/data/classlistInvalid.csv';
            rows = await ca.processClasslist(Test.ADMIN1.id, path, null);
        } catch (err) {
            ex = err;
        }
        expect(rows).to.be.null;
        expect(ex).to.not.be.null;
    });

    it('Should produce a list of CREATED users if a new user has been created via classlist API', async function() {
        const data = mockAPIData.slice();
        const classlistChanges = await ca.processClasslist(Test.ADMIN1.id, null, data);
        expect(classlistChanges.created.length).to.equal(data.length);
    });

    it('Should produce a list of REMOVED users if user is NOT on second classlist API update', async function() {
        const data = mockAPIData.slice();
        const firstUpdate = await ca.processClasslist(Test.ADMIN1.id, null, data);
        data.splice(2, 1); // remove 1 student
        const secondUpdate = await ca.processClasslist(Test.ADMIN1.id, null, data);
        const afterRemovedNum = secondUpdate.removed.length;
        expect(firstUpdate.removed.length).to.be.lessThan(secondUpdate.removed.length);
        expect(secondUpdate.removed.length).to.equal(firstUpdate.removed.length + 1);
    });

    it('Should produce a list of UPDATED users if a property has changed via classlist API', async function() {
        const data = mockAPIData.slice();
        const firstUpdate = await ca.processClasslist(Test.ADMIN1.id, null, data);
        // ONLY CWL AND LABID ARE PROGRAMMED TO CHANGE
        data[2].CWL = 'newCWL';
        const secondUpdate = await ca.processClasslist(Test.ADMIN1.id, null, data);
        expect(firstUpdate.updated.length).to.equal(0);
        expect(secondUpdate.updated.length).to.equal(1);
        await ca.processClasslist(Test.ADMIN1.id, null, data);
    });
});
