/* tslint:disable:no-unused-expression */
/* tslint:disable:max-classes-per-file */
import {expect} from "chai";
import * as fs from "fs-extra";
import * as path from "path";
import Grader from "../src/autotest/Grader";
import {Config} from "../src/Config";
import {IDockerContainer} from "../src/docker/DockerContainer";

class DockerContainerMock implements IDockerContainer {
    public reportToOutput: string;
    public reportContent: string;
    public logContent: string;

    constructor (reportToOutput: string, reportContent: string, logContent: string) {
        this.reportToOutput = reportToOutput;
        this.reportContent = reportContent;
        this.logContent = logContent;
    }

    public getLog(): Promise<string> {
        return Promise.resolve(this.logContent);
    }

    public async start(timeout: number): Promise<number> {
        await fs.writeFile(this.reportToOutput, this.reportContent);
        return 0;
    }
}

describe("Grader", () => {
    const config: Config = Config.getInstance();
    const workspace: string = `${__dirname}/scratch`;
    let grader: Grader;

    before(async () => {
        grader = new Grader();
    });

    beforeEach(async () => {
        await fs.mkdirp(workspace);
    });

    afterEach(async () => {
        try {
            await fs.remove(workspace);
        } catch (err) {
            // Do nothing
        }
    });

    describe("initWorkspace", () => {
        it("Should create subdirectories under a valid workspace directory.", async () => {
            let actual: any;
            try {
                actual = await grader.initWorkspace(workspace);
            } catch (err) {
                actual = err;
            } finally {
                expect(actual).to.be.an(`array`).with.length(3);
            }
        });
    });

    describe("grade", () => {
        before(async () => {
            await grader.initWorkspace(workspace);
        });
        it("Should grade a valid assignment with a valid Docker image that finishes in the alloted time.", async () => {
            const reportFilename: string = `${workspace}/store/report.json`;
            const reportContent: string = JSON.stringify("This is a result record.");
            const logContent: string = "Mock container log";
            const container: DockerContainerMock = new DockerContainerMock(reportFilename, reportContent, logContent);
            let actual: any;
            let log: any;
            try {
                actual = await grader.grade(container, 10);
                log = (await fs.readFile(`${workspace}/store/stdio.txt`)).toString();
            } catch (err) {
                actual = err;
            } finally {
                expect(actual).to.be.equal(JSON.parse(reportContent));
                expect(log).to.be.equal(logContent);
            }
        });
    });

    describe("archiveGradingArtifacts", () => {
        const rootDir: string = "store";
        const basenames: string[] = ["mock.json", "mock2.json", "mock3.json"];
        const filenames: string[] = basenames.map((basename) => `${rootDir}/${basename}`);
        // Removed by parent afterEach
        beforeEach(async () => {
            const p: Array<Promise<any>> = [];
            for (const filename of filenames) {
                p.push(fs.ensureFile(`${workspace}/${filename}`));
            }
            await Promise.all(p);
        });

        it("Should create a zip at a valid destination for each file in the keepDir.", async () => {
            const dest: string = `${workspace}/archive`;
            let actual: any;
            try {
                await fs.ensureDir(dest);
                actual = await grader.archiveGradingArtifacts(dest);
            } catch (err) {
                actual = err;
            } finally {
                expect(actual).to.be.an(`array`).that.has.length(3);
                expect(await fs.readdir(dest)).to.deep.equal(basenames.map((e) => `${e}.zip`));
            }
        });
        it("Should fail if the destination is invalid.", async () => {
            const invalidDest: string = `/path/does/not/exist`;
            let actual: any;
            try {
                actual = await grader.archiveGradingArtifacts(invalidDest);
            } catch (err) {
                actual = err;
            } finally {
                expect(actual).to.be.instanceof(Error);
                expect(actual.message).to.contain(`ENOENT: no such file or directory, open \'${invalidDest}/`);
            }
        });
    });

    describe("clearWorkspace", () => {
        it("Should remove all files and directories from the workspace.", async () => {
            let result: any;
            try {
                const p: Array<Promise<any>> = [];
                for (const filename of ["fake1.txt", "assign/fake1.json", "result/result.md"]) {
                    p.push(fs.ensureFile(`${workspace}/${filename}`));
                }
                await Promise.all(p);
                await grader.clearWorkspace();
                await fs.readdir(workspace);
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.be.instanceof(Error);
                expect(result.message).to.be.equal(`ENOENT: no such file or directory, scandir \'${workspace}\'`);
            }
        });
    });
});
