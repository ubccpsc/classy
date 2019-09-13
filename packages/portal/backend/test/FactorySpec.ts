import {expect} from "chai";
import "mocha";
import Log from "../../../common/Log";

import {Factory} from "../src/Factory";

import './GlobalSpec';

describe('Factory', function() {

    /**
     * These are all terrible tests and just make sure that _some_ object is returned.
     */
    it('Can get the route handler for courses', async function() {
        let actual = Factory.getCustomRouteHandler('classytest');
        expect(actual).to.not.be.null;

        actual = Factory.getCustomRouteHandler('sdmm');
        expect(actual).to.not.be.null;

        actual = Factory.getCustomRouteHandler('cs310');
        expect(actual).to.not.be.null;

        actual = Factory.getCustomRouteHandler('cs340');
        expect(actual).to.not.be.null;

        actual = null;
        let ex = null;
        try {
            actual = Factory.getCustomRouteHandler('INVALIDcourseNAME');
        } catch (err) {
            ex = err;
        }
        expect(actual).to.not.be.null; // NoRouteHandler
        expect(ex).to.be.null;
    });

    it('Can get the course controller for courses', async function() {
        // should be able to get our test controller
        const actual = await Factory.getCourseController(null, 'classytest');
        Log.test("Controller should not be null: " + actual);
        expect(actual).to.not.be.null;

        // NOTE: this behaviour is different now: we just return the CustomCourseController no matter what.

        // should fail to get a controller for a course that doesn't exist
        // actual = null;
        // let ex = null;
        // try {
        //     actual = await Factory.getCourseController(null, 'INVALIDcourseNAME');
        //     Log.test("Controller should be null: " + actual);
        // } catch (err) {
        //     ex = err;
        // }
        // expect(actual).to.be.null;
        // expect(ex).to.not.be.null;

        // actual = null;
        // ex = null;
        // try {
        //     // won't error because it uses the default name
        //     actual = Factory.getCourseController();
        // } catch (err) {
        //     ex = err;
        // }
        // expect(actual).to.be.null;
        // expect(ex).to.not.be.null;
    });

});
