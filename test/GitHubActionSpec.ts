// const loadFirst = require('./GlobalSpec');
// const rFirst = require('./GradeControllerSpec');

import {expect} from "chai";
import "mocha";

import {Config} from "../src/Config";
import {GitHubActions} from "../src/controllers/GitHubController";
import Log from "../src/util/Log";

describe.only("GitHubActions", () => {

    let ORGNAME: string;
    let gh: GitHubActions;

    let TIMEOUT = 5000;

    const TEAMNAME1 = 'team1';

    const USERNAME1 = 'user1';
    const USERNAME2 = 'user2';

    const DELIVID1 = 'd1';
    const DELIVID2 = 'd2';

    const REPONAME1 = 'repo1';
    const REPONAME2 = 'repo2';

    before(async () => {
        ORGNAME = Config.getInstance().getProp('org');
    });

    beforeEach(function () {
        gh = new GitHubActions();
    });

    it("Should be able to create list some repos.", async () => {
        // really just checks that auth is correct
        let val = await gh.listRepos(ORGNAME);
        expect(val).to.be.an('array');
        expect(val.length > 0).to.be.true;

        for (let e of val as any) {
            if (e.full_name === "SECapstone/repo1") {
                Log.test("Old test repo found; removing");
                let val = await gh.deleteRepo(ORGNAME, REPONAME1);
                expect(val).to.be.true;
            }
        }
    });

    it("Should be able to create a repo.", async function () {
        let val = await gh.createRepo(ORGNAME, REPONAME1);
        expect(val).to.equal('https://github.com/SECapstone/repo1');
    }).timeout(TIMEOUT);

    it("Should be able to remove a repo.", async function () {
        let val = await gh.deleteRepo(ORGNAME, REPONAME1);
        expect(val).to.be.true;
    }).timeout(TIMEOUT);

    it("Should be able to create the repo again.", async function () {
        let val = await gh.createRepo(ORGNAME, REPONAME1);
        expect(val).to.equal('https://github.com/SECapstone/repo1');
    }).timeout(TIMEOUT);

    it("Should be able to list a webhook.", async function () {
        let val = await gh.listWebhooks(ORGNAME, REPONAME1);
        expect(val).to.be.empty;
    }).timeout(TIMEOUT);

    it("Should be able to create a webhook.", async function () {
        let hooks = await gh.listWebhooks(ORGNAME, REPONAME1);
        expect(hooks).to.be.empty;

        let createHook = await gh.addWebhook(ORGNAME, REPONAME1, 'https://localhost/test');
        expect(createHook).to.be.true;

        hooks = await gh.listWebhooks(ORGNAME, REPONAME1);
        expect(hooks).to.have.lengthOf(1);
    }).timeout(TIMEOUT);
});
