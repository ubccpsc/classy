/* tslint:disable:max-classes-per-file */
import {expect} from "chai";
import chai = require("chai");
import chaiHttp = require("chai-http");
import * as EventSource from "eventsource";
import * as fs from "fs-extra";
import * as http from "http";
import {Attachment, ContainerInput, ContainerOutput} from "../../common/types/ContainerTypes";
import {TaskController, TaskEvent} from "../src/controllers/TaskController";
import {GradeTask} from "../src/model/GradeTask";
import {Task, TaskStatus} from "../src/model/Task";
import Server from "../src/server/Server";

// The restify onerror event is registered each time the server is started. This causes an EventEmitter memory leak warning.
// For testing, we can just ignore it.
// process.on('warning', e => console.warn(e.stack));

chai.use(chaiHttp);
describe("Task Endpoint", async function() {
    const port: number = 4321;
    const url: string = `http://127.0.0.1:${port}`;
    const restify = new Server("GraderTest");

    beforeEach(async function() {
        await restify.start(port);
    });

    afterEach(async function() {
        await restify.stop();
    });

    describe("/GET task/notify", async function() {
        class GradeTaskMock extends GradeTask {
            constructor(id: string) {
                super(id, null, null);
            }

            public async execute(): Promise<ContainerOutput> {
                this.status = TaskStatus.Created;

                setTimeout(() => {
                    this.status = TaskStatus.Running;
                }, 10);

                setTimeout(() => {
                    this.status = TaskStatus.Done;
                }, 40);
                return null;
            }
        }

        class TaskControllerMock extends TaskController {
            constructor() {
                super(restify["taskRoute"]["tasks"]);
            }

            public create(input: ContainerInput): string {
                const id = "1";
                const task = new GradeTaskMock(id);
                restify["taskRoute"]["tasks"].set(id, task);
                const result = task.execute();

                task.on("change", (status: TaskStatus) => {
                    this.tasks.emit("change", {id, status});
                });

                return id;
            }
        }

        // Use the same event message for every test (set in the TaskControllerMock constructor)
        const expectedData: string = JSON.stringify({taskId: "1", body: {}});

        // class TaskControllerMock extends TaskController {
        //     public task: Task;
        //     constructor() {
        //         super();
        //         this.task = new Task();
        //         this.task.statusEmitter.on("change", (status) => {
        //             const event: TaskEvent = {
        //                 id: "1",
        //                 event: status,
        //                 body: {}
        //             };
        //             this.emitter.emit("change", event);
        //         });
        //
        //     }
        //
        //     public create(input: ContainerInput): string {
        //         this.task.status = TaskStatus.Created;
        //
        //         setTimeout(() => {
        //             this.task.status = TaskStatus.Running;
        //         }, 10);
        //
        //         setTimeout(() => {
        //             this.task.status = TaskStatus.Done;
        //         }, 40);
        //
        //         return "";
        //     }
        // }

        class TaskControllerFailEvent extends TaskControllerMock {
            public create(input: ContainerInput): string {
                // this.task.status = TaskStatus.Created;
                //
                // setTimeout(() => {
                //     this.task.status = TaskStatus.Running;
                // }, 10);
                //
                // setTimeout(() => {
                //     this.task.status = TaskStatus.Failed;
                // }, 40);

                return "";
            }
        }

        class TaskControllerSlowMock extends TaskControllerMock {
            public delay: number;
            constructor(delay: number) {
                super();
                this.delay = delay;
            }

            public create(input: ContainerInput): string {
                // this.task.status = TaskStatus.Created;
                //
                // setTimeout(() => {
                //     this.task.status = TaskStatus.Running;
                // }, 10);
                //
                // setTimeout(() => {
                //     this.task.status = TaskStatus.Done;
                // }, this.delay);

                return "";
            }
        }

        it("Should respond with status 200 and content-type = text/event-stream", async function() {
            let res: any;

            try {
                res = await new Promise((resolve) => {
                    const client: http.ClientRequest = http.get(url + "/task/notify", (resp) => {
                        // Don't want to wait for anymore events so close the connection (this lets the server close)
                        client.abort();
                        resolve(resp);
                    });
                });
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(200);
                expect(res).to.have.header("Content-Type", "text/event-stream");
            }
        });
        it("Should notify that a task is DONE", async function() {
            // @ts-ignore
            restify["taskRoute"]["taskController"] = new TaskControllerMock();

            const eventSource = new EventSource(url + "/task/notify");
            eventSource.onopen = () => {
                restify["taskRoute"]["taskController"].create(null);
                // const id = "1";
                // const task = new GradeTaskMock(id);
                // restify["taskRoute"]["tasks"].set(id, task);
                // const result = task.execute();
            };
            let event: any;
            try {
                event = await new Promise((resolve, reject) => {
                    eventSource.addEventListener(TaskStatus.Done, resolve);
                    eventSource.onerror = reject;
                });
            } catch (err) {
                event = err;
            } finally {
                // Clean up--required for mocha to end the tests
                eventSource.close();
                expect(event).to.haveOwnProperty("data").equal(expectedData);
            }
        });
        it("Should notify that a task is FAILED", async function() {
            // @ts-ignore
            restify["taskRoute"]["taskController"] = new TaskControllerFailEvent();

            const eventSource = new EventSource(url + "/task/notify");
            eventSource.onopen = () => {
                restify["taskRoute"]["taskController"].create(null);
            };
            let event: any;
            try {
                event = await new Promise((resolve, reject) => {
                    eventSource.addEventListener(TaskStatus.Failed, resolve);
                    eventSource.onerror = reject;
                });
            } catch (err) {
                event = err;
            } finally {
                eventSource.close();
                // Doesn't actually matter what the value is, just want to check that the eventListener works
                expect(event).to.haveOwnProperty("data").equal(expectedData);
            }
        });
        it("Should keep connection open during long running tasks", async function() {
            const heartbeatInterval = 150;
            const connectionTimeout = heartbeatInterval + 50; // just needs to be bigger than the heartbeatInterval
            const responseDelay = 2 * connectionTimeout; // make sure the connection would be killed if no heartbeats

            restify["taskRoute"].heartbeatInterval = 150;
            restify["rest"].server.setTimeout(connectionTimeout);
            // @ts-ignore
            restify["taskRoute"]["taskController"] = new TaskControllerSlowMock(responseDelay);

            const eventSource = new EventSource(url + "/task/notify");
            eventSource.onopen = () => {
                restify["taskRoute"]["taskController"].create(null);
            };
            let event: any;
            try {
                event = await new Promise((resolve, reject) => {
                    eventSource.addEventListener(TaskStatus.Done, resolve);
                    eventSource.onerror = reject;
                });
            } catch (err) {
                event = err;
            } finally {
                // Clean up--required for mocha to end the tests
                eventSource.close();
                // Doesn't actually matter what the value is, just want to check that heartbeat keeps the connection
                // alive
                expect(event).to.haveOwnProperty("data").equal(expectedData);
            }
        });
    });

    describe("/GET task/:id/attachment/*", function() {
        const basePath = "/tmp/classy/grader/workspace";
        const attachments: Attachment[] = [
            {name: "stdio", path: "stdio.txt", content_type: "text/plain"},
            {name: "report", path: "report.json", content_type: "application/json"},
            {name: "coverage", path: "output/coverage/coverage-summary.json", content_type: "application/json"}
        ];
        const attachmentContent: {[name: string]: any} = {
          stdio: "filename: stdio.txt\ncontent_type: text/plain",
          report: {filename: "report.json", content_type: "application/json"},
          coverage: {filename: "coverage-summary.json", content_type: "application/json"}
        };

        class TaskControllerMock extends TaskController {
            public getAttachmentBasePath(id: string): string {
                // In the actual impl we would include the id
                return basePath;
            }
        }

        before(async function() {
            // Create the attachment files so the endpoint has something to serve
            for (const attachment of attachments) {
                const file: string = basePath + "/" + attachment.path;
                await fs.ensureFile(file);
                await fs.writeJSON(file, attachmentContent[attachment.name]);
            }
            // @ts-ignore
            restify["taskRoute"]["taskController"] = new TaskControllerMock();

        });

        after(async function() {
           await fs.remove(basePath);
        });

        it("Should respond with status 200 and the requested file contents", async function() {
            const attachment: Attachment = attachments.filter((x) => x.name === "stdio")[0];
            const content: string = JSON.stringify(attachmentContent["stdio"]) + "\n";
            let res: any;

            try {
                res = await chai.request(url).get("/task/1/attachment/" + attachment.path);
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(200);
                // chai-http automatically builds the blob
                expect(res).to.have.haveOwnProperty("text").equal(content);
            }
        });
        it("Should respond with status 200 and the requested file contents when the format is JSON", async function() {
            const attachment: Attachment = attachments.filter((x) => x.name === "report")[0];
            const content: string = JSON.stringify(attachmentContent["report"]) + "\n";
            let res: any;

            try {
                res = await chai.request(url).get("/task/1/attachment/" + attachment.path);
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(200);
                expect(res).to.have.haveOwnProperty("text").equal(content);
            }
        });
        it("Should respond with status 200 and the requested file contents when the file is nested", async function() {
            const attachment: Attachment = attachments.filter((x) => x.name === "coverage")[0];
            const content: string = JSON.stringify(attachmentContent["coverage"]) + "\n";
            let res: any;

            try {
                res = await chai.request(url).get("/task/1/attachment/" + attachment.path);
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(200);
                expect(res).to.have.haveOwnProperty("text").equal(content);
            }
        });
        // it("Should respond with status 404 when the id doesn't exist", async function() {
        //     restify["taskRoute"]["taskController"].getResult = resultThrowsNoId;
        //
        //     let res: any;
        //
        //     try {
        //         res = await chai.request(url).get("/task/-1/notify");
        //     } catch (err) {
        //         res = err;
        //     } finally {
        //         expect(res).to.have.status(404);
        //         expect(res).to.haveOwnProperty("body").equal("id -1 not found");
        //     }
        // });
        it("Should respond with status 404 when the file doesn't exist", async function() {
            let res: any;

            try {
                res = await chai.request(url).get("/task/1/attachment/path/to/non-existent/file.fake");
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(404);
                // chai-http automatically builds the blob
                expect(res).to.have.haveOwnProperty("text").equal(
                    '"ENOENT: no such file or directory, open \'/tmp/classy/grader/workspace/path/to/non-existent/file.fake\'"');
            }
        });
        it("Should respond with status 500 when the requesting a directory", async function() {
            let res: any;

            try {
                res = await chai.request(url).get("/task/1/attachment/output");
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(500);
                // chai-http automatically builds the blob
                expect(res).to.have.haveOwnProperty("text").equal('"EISDIR: illegal operation on a directory, read"');
            }
        });
    });

    describe("/POST task", function() {
        class TaskControllerMock extends TaskController {
            public create(input: any): string {
                return input.id;
            }
        }

        before(function() {
            // @ts-ignore
            restify["taskRoute"]["taskController"] = new TaskControllerMock();

        });

        it("Should create a new task", async function() {
            let res: any;

            try {
                res = await chai.request(url)
                    .post("/task")
                    .send({id: "hello"});
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(201);
                expect(res.body).have.property("id").equal("hello");
            }
        });
    });
});
