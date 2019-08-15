import {expect} from "chai";
import "mocha";

import Log from "../../../common/Log";
import {ClasslistAgent} from "../src/server/common/ClasslistAgent";

import "./GlobalSpec";
import {Test} from './TestHarness';

describe('ClasslistAgent', function() {

    const ca: ClasslistAgent = new ClasslistAgent();

    it('Should be able to process an empty classlist', async function() {
        const path = __dirname + '/data/classlistEmpty.csv';
        const rows = await ca.processClasslist(Test.ADMIN1.id, path, null);
        Log.test('# rows processed: ' + rows.length);
        expect(rows).to.have.lengthOf(0);
    });

    it('Should be able to process a vaild classlist', async function() {
        const path = __dirname + '/data/classlistValid.csv';
        const rows = await ca.processClasslist(Test.ADMIN1.id, path, null);
        Log.test('# rows processed: ' + rows.length);
        expect(rows).to.have.lengthOf(5);
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
        const rows = await ca.processClasslist(Test.ADMIN1.id, path, null);
        Log.test('# rows processed: ' + rows.length);
        expect(rows).to.have.lengthOf(5);
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
});
