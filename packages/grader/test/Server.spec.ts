/* tslint:disable:max-classes-per-file */
import {expect} from "chai";
import chai = require("chai");
import chaiHttp = require("chai-http");
import * as EventSource from "eventsource";
import {Attachment, ContainerOutput} from "../../common/types/ContainerTypes";
import {TaskController} from "../src/controllers/TaskController";
import Server from "../src/server/Server";

chai.use(chaiHttp);
describe("Task Endpoint", async function() {
    const port: number = 4321;
    const url: string = `http://127.0.0.1:${port}`;

    const restify = new Server("GraderTest");
    const server = restify["rest"];

    const basePath = "/tmp/classy/grader/workspace";
    const attachments: Attachment[] = [
        {name: "stdio", path: "stdio.txt", content_type: "text/plain"},
        {name: "report", path: "output/report.json", content_type: "application/json"},
        {name: "coverageReport", path: "output/coverage/coverage-summary.json", content_type: "application/json"}
    ];

    // Mocks for TaskController.create() so we don't actually run any containers
    class TaskControllerMock extends TaskController {
        public create(input: any): string {
            return input.id;
        }

        public getAttachmentBasePath(id: string): string {
            return basePath + "/" + id;
        }

        public getResult(id: string): Promise<ContainerOutput> {
            // @ts-ignore
            return Promise.resolve({});
        }
    }

    before(function() {
        // @ts-ignore
        restify["taskRoute"]["taskController"] = new TaskControllerMock();

    });

    beforeEach(async function() {
        await new Promise((resolve) => {
           server.listen(port, resolve);
        });
    });

    afterEach(async function() {
        await new Promise((resolve) => {
           server.close(resolve);
        });
    });

    describe("/GET task/:id/notify", async function() {
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
            restify["taskRoute"]["taskController"].getResult = (id: string) => {
                return Promise.reject("Exception from GradeTask.execute()");
            };

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
            restify["taskRoute"]["taskController"].getResult = (id: string) => {
                throw new Error("id " + id + " not found.");
            };

            let res: any;

            try {
                res = await chai.request(url).get("/task/-1/notify");
            } catch (err) {
                res = err;
            } finally {
                expect(res).to.have.status(404);
                expect(res).to.haveOwnProperty("body").equal("id -1 not found.");
            }
        });
    });

    describe("/GET task/:id/attachment/:name", function() {
        // TODO
    });

    describe("/POST task", function() {
        class TaskControllerMock1 extends TaskController {
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
                res = await chai.request(server)
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
