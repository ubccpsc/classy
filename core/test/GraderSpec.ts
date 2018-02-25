/* tslint:disable:no-unused-expression */
/* tslint:disable:max-classes-per-file */
import {expect} from "chai";
import * as fs from "fs-extra";
import * as path from "path";
import Grader from "../src/autotest/Grader";
import {Config} from "../src/Config";
import {IDockerContainer} from "../src/docker/DockerContainer";
import { IContainerInput } from "../src/Types";

// class DockerContainerMock implements IDockerContainer {
//     public reportToOutput: string;
//     public reportContent: string;
//     public logContent: string;

//     constructor (reportToOutput: string, reportContent: string, logContent: string) {
//         this.reportToOutput = reportToOutput;
//         this.reportContent = reportContent;
//         this.logContent = logContent;
//     }

//     public getLog(): Promise<string> {
//         return Promise.resolve(this.logContent);
//     }

//     public async start(timeout: number): Promise<number> {
//         await fs.writeFile(this.reportToOutput, this.reportContent);
//         return 0;
//     }
// }

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

    describe("execute", () => {
        it("Should run a container.", async () => {
            const input: IContainerInput = {
                pushInfo: {
                    branch: "master", // really refs
                    repo: "d1_team99999", // repo name
                    commitSHA: "2830624", // SHA
                    commitURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_team99999/commit/28306246ac478198550b03d44884cb38a443de94", // full url to commit
                    org: "CPSC310-2017W-T2", // orgName
                    projectURL: "https://github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_team99999", // full url to project
                    postbackURL: "", // where to send postback results
                    timestamp: 0, // timestamp of push event
                },
                delivId: "d1",
                courseId: "310"
            }
            const grader: Grader = new Grader();
            await grader.execute(input);
        });
    });

    // describe("grade", () => {
    //     before(async () => {
    //         await grader.initWorkspace(workspace);
    //     });
    //     it("Should grade a valid assignment with a valid Docker image that finishes in the alloted time.", async () => {
    //         const reportFilename: string = `${workspace}/store/report.json`;
    //         const reportContent: string = JSON.stringify("This is a result record.");
    //         const logContent: string = "Mock container log";
    //         const container: DockerContainerMock = new DockerContainerMock(reportFilename, reportContent, logContent);
    //         let actual: any;
    //         let log: any;
    //         try {
    //             actual = await grader.grade(container, 10);
    //             log = (await fs.readFile(`${workspace}/store/stdio.txt`)).toString();
    //         } catch (err) {
    //             actual = err;
    //         } finally {
    //             expect(actual).to.be.equal(JSON.parse(reportContent));
    //             expect(log).to.be.equal(logContent);
    //         }
    //     });
    // });

    // describe("archiveGradingArtifacts", () => {
    //     const rootDir: string = "store";
    //     const basenames: string[] = ["mock.json", "mock2.json", "mock3.json"];
    //     const filenames: string[] = basenames.map((basename) => `${rootDir}/${basename}`);
    //     // Removed by parent afterEach
    //     beforeEach(async () => {
    //         const p: Array<Promise<any>> = [];
    //         for (const filename of filenames) {
    //             p.push(fs.ensureFile(`${workspace}/${filename}`));
    //         }
    //         await Promise.all(p);
    //     });

    //     it("Should create a zip at a valid destination for each file in the keepDir.", async () => {
    //         const dest: string = `${workspace}/archive`;
    //         let actual: any;
    //         try {
    //             await fs.ensureDir(dest);
    //             actual = await grader.archiveGradingArtifacts(dest);
    //         } catch (err) {
    //             actual = err;
    //         } finally {
    //             expect(actual).to.be.an(`array`).that.has.length(3);
    //             expect(await fs.readdir(dest)).to.deep.equal(basenames.map((e) => `${e}.zip`));
    //         }
    //     });
    //     it("Should fail if the destination is invalid.", async () => {
    //         const invalidDest: string = `/path/does/not/exist`;
    //         let actual: any;
    //         try {
    //             actual = await grader.archiveGradingArtifacts(invalidDest);
    //         } catch (err) {
    //             actual = err;
    //         } finally {
    //             expect(actual).to.be.instanceof(Error);
    //             expect(actual.message).to.contain(`ENOENT: no such file or directory, open \'${invalidDest}/`);
    //         }
    //     });
    // });

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


// /* tslint:disable:no-unused-expression */
// import {expect} from "chai";
// import * as fs from "fs-extra";
// import Grader from "../src/autotest/Grader";
// import GraderManager from "../src/autotest/GraderManager";
// import {Config} from "../src/Config";

// describe("GraderManager", () => {
//     describe("fetchRepository", () => {
//         const token: string = config.getProp("githubOrgToken");
//         const commit: string = `2fa9311`;

//         it("Should collect a student's assignment from a valid URL and check out a valid commit.", async () => {
//             const url: string = `https://${token}@github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_team99999.git`;
//             let actual: any;
//             try {
//                 actual = await grader.collectAssignment(url, commit);
//             } catch (err) {
//                 actual = err;
//             } finally {
//                 expect(actual).to.be.undefined;
//             }
//         });
//         it("Should fail if the URL does not reference a git repository.", async () => {
//             const invalidUrl: string = `https://${token}@github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/does-not-exist583.git`;
//             let actual: any;
//             try {
//                 actual = await grader.collectAssignment(invalidUrl, commit);
//             } catch (err) {
//                 actual = err;
//             } finally {
//                 expect(actual).to.be.instanceof(Error);
//                 expect(actual.message).to.contain(`Command failed: git clone ${invalidUrl}`);
//             }
//         });
//         it("Should fail if the URL specifies invalid credentials.", async () => {
//             const invalidToken: string = `asdj3jdf83h87sdfh3er435f43`;
//             const url: string = `https://${invalidToken}@github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_team99999.git`;
//             let actual: any;
//             try {
//                 actual = await grader.collectAssignment(url, commit);
//             } catch (err) {
//                 actual = err;
//             } finally {
//                 expect(actual).to.be.instanceof(Error);
//                 expect(actual.message).to.contain(`Command failed: git clone ${url}`);
//             }
//         });
//         it("Should fail if the commit does not exist.", async () => {
//             const url: string = `https://${token}@github.ugrad.cs.ubc.ca/CPSC310-2017W-T2/d1_team99999.git`;
//             const invalidCommit: string = `xxxxxxxxx`;
//             let actual: any;
//             try {
//                 actual = await grader.collectAssignment(url, invalidCommit);
//             } catch (err) {
//                 actual = err;
//             } finally {
//                 expect(actual).to.be.instanceof(Error);
//                 expect(actual.message).to.contain(`Command failed: git checkout ${invalidCommit}`);
//             }
//         });
//     });

//     // describe("copySolution", () => {
//     //     it("Should copy the contents of a directory containing the solution.", async () => {
//     //         const fakeSolnDir: string = `${workspace}/fakeSolution`;
//     //         let actual: any;
//     //         let files: string[];
//     //         try {
//     //             await fs.outputFile(`${fakeSolnDir}/soln.txt`, `Sample soln`);
//     //             actual = await grader.copySolution(fakeSolnDir);
//     //             files = await fs.readdir(`${workspace}/solution`);
//     //             await fs.remove(fakeSolnDir);
//     //         } catch (err) {
//     //             actual = err;
//     //         } finally {
//     //             expect(actual).to.be.undefined;
//     //             expect(files).to.deep.equal(["soln.txt"]);
//     //         }
//     //     });
//     //     it("Should fail if the solution directory is invalid.", async () => {
//     //         const invalidSrcDir: string = `/path/that/does/not/exist`;
//     //         let actual: any;
//     //         try {
//     //             actual = await grader.copySolution(invalidSrcDir);
//     //         } catch (err) {
//     //             actual = err;
//     //         } finally {
//     //             expect(actual).to.be.instanceof(Error);
//     //             expect(actual.message).to.equal(`ENOENT: no such file or directory, lstat \'${invalidSrcDir}\'`);
//     //         }
//     //     });
//     // });

//     describe("execute", () => {
//         //TODO
//     });
// });
