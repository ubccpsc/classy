// import {expect} from "chai";
// import Server from "grader/src/server/Server";
// import * as rp from "request-promise-native";
// import {AutoTestResult} from "../../common/types/AutoTestTypes";
// import {ContainerInput} from "../../common/types/ContainerTypes";
// import {AutoTest} from "../src/autotest/AutoTest";
//
// class AutoTestMock extends AutoTest {
//     protected async processExecution(data: AutoTestResult): Promise<void> {
//         return Promise.resolve();
//     }
// }
//
// describe("AutoTest", function() {
//     describe("#sendGradeTask", async function() {
//         const graderUrl: string = "http://127.0.0.1";
//         const graderPort: number = 8385;
//         const input: ContainerInput = {
//             delivId: "dX",
//             target: {
//                 delivId: "dX",
//                 repoId: "fake",
//                 botMentioned: true,
//                 personId: "123",
//                 cloneURL: "https://fake.com",
//                 commitSHA: "dsf445jhtr",
//                 commitURL: "https://fake.com/commit/dsf445jhtr",
//                 postbackURL: "https://fake.com/comment",
//                 timestamp: Date.now()
//             },
//             containerConfig: {
//                 dockerImage: "N/A",
//                 studentDelay: -1,
//                 maxExecTime: -1,
//                 regressionDelivIds: [],
//                 custom: {}
//             }
//         };
//         const gradeServiceOpts: rp.OptionsWithUrl = {
//             method:  "POST",
//             url:     `${graderUrl}:${graderPort}/task`,
//             body:    input,
//             json:    true, // Automatically stringifies the body to JSON,
//             // timeout: 360000  // enough time that the container will have timed out
//         };
//         let sendGradeTask: any;
//         const s = new Server("Grader");
//
//         before(async function() {
//             const at = new AutoTestMock(null, null);
//             sendGradeTask = at["sendGradeTask"];
//
//             await s.start(graderPort);
//         });
//
//         after(async function() {
//             await s.stop();
//         });
//
//         it("Should work", async function() {
//             const result = await sendGradeTask(gradeServiceOpts);
//             expect(result).to.hasOwnProperty("timestamp");
//         });
//     });
// });
