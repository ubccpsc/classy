import {expect} from "chai";
import "mocha";

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
        let actual = Factory.getCourseController(null, 'classytest');
        expect(actual).to.not.be.null;

        actual = Factory.getCourseController(null, 'sdmm');
        expect(actual).to.not.be.null;

        actual = Factory.getCourseController(null, 'cs310');
        expect(actual).to.not.be.null;

        actual = Factory.getCourseController(null, 'cs340');
        expect(actual).to.not.be.null;

        actual = null;
        let ex = null;
        try {
            actual = Factory.getCourseController(null, 'INVALIDcourseNAME');
        } catch (err) {
            ex = err;
        }
        expect(actual).to.be.null;
        expect(ex).to.not.be.null;

        actual = null;
        ex = null;
        try {
            actual = Factory.getCourseController(); // won't error because it uses the default name
        } catch (err) {
            ex = err;
        }
        expect(actual).to.not.be.null;
        expect(ex).to.be.null;
    });

});
