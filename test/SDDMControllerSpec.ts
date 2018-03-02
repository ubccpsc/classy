import {SDDMController} from "../src/controllers/SDDMController";
import {expect} from "chai";
import "mocha";
import {GradesController} from "../src/controllers/GradesController";
import {RepositoryController} from "../src/controllers/RepositoryController";
import {TeamController} from "../src/controllers/TeamController";
import {PersonController} from "../src/controllers/PersonController";
import {Test} from "./GlobalSpec";

const loadFirst = require('./GlobalSpec');

describe("SDDMController", () => {

    let sc: SDDMController;
    let gc: GradesController;
    let tc: TeamController;
    let rc: RepositoryController;
    let pc: PersonController;

    // NOTE: does not use the Test. values on purpose to make it easier
    // to validate status without having to nuke the db first
    const TEAMD0 = "sddmd0test";
    const TEAMD1 = "sddmd1test";

    const REPOD0 = "sddmd0repotest";
    const REPOD1 = "sddmd1repotest";

    const USER = "sddmdusertest";

    const PRNAME = "prd3id";

    before(async () => {
    });

    beforeEach(() => {
        sc = new SDDMController();
        rc = new RepositoryController();
        gc = new GradesController();
        tc = new TeamController();
        pc = new PersonController();
    });

    it("Should be able to get a D0PRE status.", async () => {
        await pc.getPerson(Test.ORGNAME, USER); // provisions user

        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0PRE");
    });


    /* D0PRE
        * D0
        * D1UNLOCKED
        * D1TEAMSET
        * D1
        * D2
        * D3PRE
        * D3
        */
    it("Should be able to get a D0 status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0PRE");

        const person = await pc.getPerson(Test.ORGNAME, USER);
        const team = await tc.createTeam(Test.ORGNAME, TEAMD0, [person], {sdmmd0: true});
        const repo = await rc.createRepository(Test.ORGNAME, REPOD0, [team], {d0enabled: true});
        expect(repo).to.not.be.null;

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0");
    });

    it("Should be able to get a D1UNLOCKED status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0");

        await gc.createGrade(Test.ORGNAME, REPOD0, "d0", 59, '', '');
        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D0"); // 59 is too low

        await gc.createGrade(Test.ORGNAME, REPOD0, "d0", 61, '', '');
        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1UNLOCKED");
    });

    it("Should be able to get a D1TEAMSET status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1UNLOCKED");

        const person = await pc.getPerson(Test.ORGNAME, USER);
        const team = await tc.createTeam(Test.ORGNAME, TEAMD1, [person], {sdmmd1: true});
        expect(team).to.not.be.null;

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1TEAMSET");
    });

    it("Should be able to get a D1 status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1TEAMSET");

        const team = await tc.getTeam(Test.ORGNAME, TEAMD1);
        const repo = await rc.createRepository(Test.ORGNAME, REPOD1, [team], {d1enabled: true});
        expect(repo).to.not.be.null;

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1");
    });

    it("Should be able to get a D2 status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1");

        await gc.createGrade(Test.ORGNAME, REPOD1, "d1", 59, '', '');
        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D1"); // 59 is too low

        await gc.createGrade(Test.ORGNAME, REPOD1, "d1", 61, '', '');

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D2");
    });

    it("Should be able to get a D3PRE status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D2");

        await gc.createGrade(Test.ORGNAME, REPOD1, "d2", 59, '', '');
        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D2"); // 59 is too low

        await gc.createGrade(Test.ORGNAME, REPOD1, "d2", 61, '', '');

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D3PRE");
    });

    it("Should be able to get a D3 status.", async () => {
        let status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D3PRE");

        const repo = await rc.createPullRequest(Test.ORGNAME, REPOD1, PRNAME, {sddmD3pr: true});
        expect(repo).to.not.be.null;
        expect(repo.custom.sddmD3pr).to.be.true;

        status = await sc.getStatus(Test.ORGNAME, USER);
        expect(status).to.equal("D3");
    });

});
