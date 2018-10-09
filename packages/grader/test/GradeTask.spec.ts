import {expect} from "chai";
import * as fs from "fs-extra";
import {ContainerInput, ContainerOutput, ContainerState} from "../../common/types/ContainerTypes";
import {GradeTask} from "../src/model/GradeTask";
import {Workspace} from "../src/model/Workspace";

/* tslint:disable-next-line: no-var-requires */
const MockSpawn = require("mock-spawn");

// The most important requirement is that the GradeTask should ALWAYS produce a valid ContainerOutput record.
describe("GradeTask", function() {
    const taskId: string = "1a2b3c";
    const workspaceDir: string = "/tmp/classy/test";
    const input: ContainerInput = {
        delivId: "d0",
        target: {
            delivId: "d0",
            repoId: "d0_r5t0b",
            botMentioned: false,
            personId: null,
            cloneURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/d0_r5t0b.git",
            commitSHA: "ac5e1153ea4f57a086f50e4dffa492caa730a873",
            commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2018W-T1/d0_r5t0b/commit/ac5e1153ea4f57a086f50e4dffa492caa730a873",
            postbackURL: "",
            timestamp: 0
        },
        containerConfig: {
            dockerImage: "dockerImage",
            studentDelay: -1,
            maxExecTime: 1.2,  // seconds
            regressionDelivIds: [],
            custom: {}
        }
    };
    const sampleOutput: ContainerOutput = {
        timestamp:          Date.now(),
        report:             {
            scoreOverall: 0,
            scoreCover:   null,
            scoreTest:    null,
            feedback:     'Internal error: The grading service failed to handle the request.',
            passNames:    [],
            skipNames:    [],
            failNames:    [],
            errorNames:   [],
            custom:       {},
            result:       "SUCCESS",
            attachments:  [],
        },
        postbackOnComplete: false,
        custom:             {},
        state:              ContainerState.SUCCESS,
        graderTaskId:        ""
    };

    let workspace: Workspace;
    let gradeTask: GradeTask;
    let mockSpawnRepo: any;
    let mockSpawnContainer: any;

    before(async function() {
        await fs.ensureDir(workspaceDir);
        workspace = new Workspace(workspaceDir + "/" + taskId, 1000);
    });

    beforeEach(async function() {
        await fs.remove(workspaceDir + "/" + taskId);
        gradeTask = new GradeTask(taskId, input, workspace);

        mockSpawnRepo = MockSpawn();
        // GradeTask first calls prepareRepo which in turn makes 3 spawn calls
        mockSpawnRepo.sequence.add(mockSpawnRepo.simple(0, "git clone"));
        mockSpawnRepo.sequence.add(mockSpawnRepo.simple(0, "git checkout"));
        mockSpawnRepo.sequence.add(mockSpawnRepo.simple(0, "git rev-parse HEAD"));
        // @ts-ignore
        gradeTask["repo"]["spawn"] = mockSpawnRepo;

        mockSpawnContainer = MockSpawn();

        // @ts-ignore
        gradeTask["container"]["spawn"] = mockSpawnContainer;
    });

    it("Should execute a valid task.", async function() {
        // create, start, wait (write report.json), ps, log, rm
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "z1x2c3"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(function(cb: any) {
            // This could be slow enough to cause a timeout
            fs.writeJsonSync(workspaceDir + "/" + taskId + "/output/report.json", "{}");
            cb(0);
        });
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "Exited (0)"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        const output = await gradeTask.execute();
        expect(output).to.be.an("object").that.has.all.keys(sampleOutput);
        expect(output.state).to.equal("SUCCESS");
        expect(output.postbackOnComplete).to.be.false;
    });
    it("Should complete with state FAIL when the specified image doesn't exist", async function() {
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(1, "Image does not exist"));
        const output = await gradeTask.execute();
        expect(output).to.be.an("object").that.has.all.keys(sampleOutput);
        expect(output.state).to.equal("FAIL");
        expect(output.postbackOnComplete).to.be.true;
        expect(output.report.result).to.equal("FAIL");
        expect(output.report.feedback).to.equal("Internal error: The grading service failed to handle the request.");
    });
    it("Should complete with state TIMEOUT when the container times out.", async function() {
        // create, start, wait, stop, ps, ps, rm
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "z1x2c3"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(function(cb: any) {
            setTimeout(function() { return cb(0); }, 1500);
        });
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "Exited (125)"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "Exited (125)"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        const output = await gradeTask.execute();
        expect(output).to.be.an("object").that.has.all.keys(sampleOutput);
        expect(output.state).to.equal("TIMEOUT");
        expect(output.postbackOnComplete).to.be.true;
        expect(output.report.feedback).to.equal("Container did not complete in the allotted time.");
        expect(output.report.result).to.equal("FAIL");
    });
    it("Should complete with state NO_REPORT when container doesn't produce a grade record.", async function() {
        // create, start, wait, ps, rm
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "z1x2c3"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "Exited (1)"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        const output = await gradeTask.execute();
        expect(output).to.be.an("object").that.has.all.keys(sampleOutput);
        expect(output.state).to.equal("NO_REPORT");
        expect(output.postbackOnComplete).to.be.true;
        expect(output.report.feedback).to.equal("Failed to read grade report.");
        expect(output.report.result).to.equal("FAIL");
    });
    it("Should remove the container after it has exited successfully.", async function() {
        let dockerRemoveCalled: boolean = false;
        // create, start, wait (write report.json), ps, log, rm
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "z1x2c3"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(function(cb: any) {
            // This could be slow enough to cause a timeout
            fs.writeJsonSync(workspaceDir + "/" + taskId + "/output/report.json", "{}");
            cb(0);
        });
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "Exited (0)"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(function(cb: any) {
            dockerRemoveCalled = true;
            cb(0);
        });
        await gradeTask.execute();
        expect(dockerRemoveCalled).to.be.true;
    });
    it("Should remove the container after it has failed.", async function() {
        let dockerRemoveCalled: boolean = false;
        // create, start, wait (exit 5), rm
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "z1x2c3"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(5));
        mockSpawnContainer.sequence.add(function(cb: any) {
            dockerRemoveCalled = true;
            cb(0, "output removing container");
        });
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "Exited (5)"));

        await gradeTask.execute();
        expect(dockerRemoveCalled).to.be.true;
    });
    it("Should ignore errors when removing a container.", async function() {
        // create, start, wait (write report), ps, log, rm
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "z1x2c3"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(function(cb: any) {
            // This could be slow enough to cause a timeout
            fs.writeJsonSync(workspaceDir + "/" + taskId + "/output/report.json", "{}");
            cb(0);
        });
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0, "Exited (0)"));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(0));
        mockSpawnContainer.sequence.add(mockSpawnContainer.simple(5));

        const output = await gradeTask.execute();
        expect(output).to.be.an("object").that.has.all.keys(sampleOutput);
        expect(output.state).to.equal("SUCCESS");
        expect(output.postbackOnComplete).to.be.false;
    });
});
