import {expect} from "chai";
import "mocha";

import {Factory} from "../src/Factory";

import './GlobalSpec';

describe('Factory', function() {

    /**
     * These are all terrible tests and just make sure that _some_ object is returned.
     */
    it('Can get the route handler for courses', async function() {
        let actual = Factory.getRouteHandler('classytest');
        expect(actual).to.not.be.null;

        actual = Factory.getRouteHandler('sdmm');
        expect(actual).to.not.be.null;

        actual = Factory.getRouteHandler('cs310');
        expect(actual).to.not.be.null;

        actual = Factory.getRouteHandler('cs340');
        expect(actual).to.not.be.null;

        actual = null;
        let ex = null;
        try {
            actual = Factory.getRouteHandler('INVALIDcourseNAME');
        } catch (err) {
            ex = err;
        }
        expect(actual).to.not.be.null; // NoRouteHandler
        expect(ex).to.be.null;
    });

    it('Can get the course controller for courses', async function() {
        // should be able to get our test controller
        let actual = await Factory.getCourseController(null, 'classytest');
        expect(actual).to.not.be.null;

        // should fail to get a controller for a course that doesn't exist
        actual = null;
        let ex = null;
        try {
            actual = await Factory.getCourseController(null, 'INVALIDcourseNAME');
        } catch (err) {
            ex = err;
        }
        expect(actual).to.be.null;
        expect(ex).to.not.be.null;

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
