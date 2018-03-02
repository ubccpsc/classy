import {SDDMController} from "../src/controllers/SDDMController";
import {expect} from "chai";
import "mocha";

import {Config} from "../src/Config";
import {GradesController} from "../src/controllers/GradesController";
import {RepositoryController} from "../src/controllers/RepositoryController";
import {TeamController} from "../src/controllers/TeamController";
import {PersonController} from "../src/controllers/PersonController";

const loadFirst = require('./GlobalSpec');

describe("SDDMController", () => {

    let ORGNAME: string;
    let sc: SDDMController;
    let gc: GradesController;
    let tc: TeamController;
    let rc: RepositoryController;
    let pc: PersonController;

    // const TEAMNAME1 = 'team1';
    const TEAMD0 = "sddmd0test";
    const TEAMD1 = "sddmd1test";

    const REPOD0 = "sddmd0repotest";
    const REPOD1 = "sddmd1repotest";

    const USER = "sddmdusertest";

    const PRNAME = "prd3id";

    before(async () => {
        ORGNAME = Config.getInstance().getProp('org');
    });

    beforeEach(() => {
        sc = new SDDMController();
        rc = new RepositoryController();
        gc = new GradesController();
        tc = new TeamController();
        pc = new PersonController();
    });

    it("Should be able to get a D0PRE status.", async () => {
        await pc.getPerson(ORGNAME, USER); // provisions user

        let status = await sc.getStatus(ORGNAME, USER);
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
        let status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D0PRE");

        const person = await pc.getPerson(ORGNAME, USER);
        const team = await tc.createTeam(ORGNAME, TEAMD0, [person], {sdmmd0: true});
        const repo = await rc.createRepository(ORGNAME, REPOD0, [team], {d0enabled: true});
        expect(repo).to.not.be.null;

        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D0");
    });

    it("Should be able to get a D1UNLOCKED status.", async () => {
        let status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D0");

        await gc.createGrade(ORGNAME, USER, "d0", 59, '', '');
        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D0"); // 59 is too low

        await gc.createGrade(ORGNAME, USER, "d0", 61, '', '');
        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D1UNLOCKED");
    });

    it("Should be able to get a D1TEAMSET status.", async () => {
        let status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D1UNLOCKED");

        const person = await pc.getPerson(ORGNAME, USER);
        const team = await tc.createTeam(ORGNAME, TEAMD1, [person], {sdmmd1: true});
        expect(team).to.not.be.null;

        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D1TEAMSET");
    });

    it("Should be able to get a D1 status.", async () => {
        let status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D1TEAMSET");

        const team = await tc.getTeam(ORGNAME, TEAMD1);
        const repo = await rc.createRepository(ORGNAME, REPOD1, [team], {d1enabled: true});
        expect(repo).to.not.be.null;

        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D1");
    });

    it("Should be able to get a D2 status.", async () => {
        let status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D1");

        await gc.createGrade(ORGNAME, USER, "d1", 59, '', '');
        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D1"); // 59 is too low

        await gc.createGrade(ORGNAME, USER, "d1", 61, '', '');

        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D2");
    });

    it("Should be able to get a D3PRE status.", async () => {
        let status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D2");

        await gc.createGrade(ORGNAME, USER, "d2", 59, '', '');
        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D2"); // 59 is too low

        await gc.createGrade(ORGNAME, USER, "d2", 61, '', '');

        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D3PRE");
    });

    it("Should be able to get a D3 status.", async () => {
        let status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D3PRE");

        const repo = await rc.createPullRequest(ORGNAME, REPOD1, PRNAME, {sddmD3pr: true});
        expect(repo).to.not.be.null;
        expect(repo.custom.sddmD3pr).to.be.true;

        status = await sc.getStatus(ORGNAME, USER);
        expect(status).to.equal("D3");
    });

});
