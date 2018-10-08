/* tslint:disable:max-classes-per-file */
import {expect} from "chai";
import chai = require("chai");
import chaiHttp = require("chai-http");
import * as EventSource from "eventsource";
import * as fs from "fs-extra";
import {Attachment, ContainerOutput} from "../../common/types/ContainerTypes";
import {TaskController} from "../src/controllers/TaskController";
import Server from "../src/server/Server";

chai.use(chaiHttp);
describe("Task Endpoint", async function() {
    const port: number = 4321;
    const url: string = `http://127.0.0.1:${port}`;
    const restify = new Server("GraderTest");
    const resultThrowsNoId = (id: string) => {
        throw new Error("id " + id + " not found");
    };
    const resultPromiseRejects = (id: string) => {
        return Promise.reject("Exception from GradeTask.execute()");
    };

    beforeEach(async function() {
        await restify.start(port);
    });

    afterEach(async function() {
        await restify.stop();
    });

    describe("/GET task/:id/notify", async function() {
        class TaskControllerMock extends TaskController {
            public getResult(id: string): Promise<ContainerOutput> {
                // @ts-ignore
                return Promise.resolve({});
            }
        }

        before(function() {
            // @ts-ignore
            restify["taskRoute"]["taskController"] = new TaskControllerMock();

        });

        it("Should respond with status 200 and content-type = text/event-stream", async function() {
            let res: any;

            try {
                res = await chai.request(url).get("/task/0/notify");
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(200);
                expect(res).to.have.header("Content-Type", "text/event-stream");
            }
        });
        it("Should emit done event and close once container is finished executing", async function() {
            const eventSource = new EventSource(url + "/task/1/notify");
            let event: any;
            try {
                event = await new Promise((resolve, reject) => {
                    eventSource.addEventListener("done", resolve);
                    eventSource.onerror = reject;
                });
            } catch (err) {
                event = err;
            } finally {
                // Clean up--required for mocha to end the tests
                eventSource.close();
                expect(event).to.haveOwnProperty("data").equal("{}");
            }
        });
        it("Should emit error event and close when the ContainerOutput promise rejects", async function() {
            restify["taskRoute"]["taskController"].getResult = resultPromiseRejects;

            const eventSource = new EventSource(url + "/task/1/notify");
            let event: any;
            try {
                event = await new Promise((resolve, reject) => {
                    eventSource.addEventListener("done", resolve);
                    eventSource.onerror = reject;
                });
            } catch (err) {
                event = err;
            } finally {
                eventSource.close();
                expect(event).to.haveOwnProperty("data").equal("Exception from GradeTask.execute()");
            }
        });
        it("Should respond with status 404 when id doesn't exist", async function() {
            restify["taskRoute"]["taskController"].getResult = resultThrowsNoId;

            let res: any;

            try {
                res = await chai.request(url).get("/task/-1/notify");
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(404);
                expect(res).to.haveOwnProperty("body").equal("id -1 not found");
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
        it("Should respond with status 404 when the id doesn't exist", async function() {
            restify["taskRoute"]["taskController"].getResult = resultThrowsNoId;

            let res: any;

            try {
                res = await chai.request(url).get("/task/-1/notify");
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(404);
                expect(res).to.haveOwnProperty("body").equal("id -1 not found");
            }
        });
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
