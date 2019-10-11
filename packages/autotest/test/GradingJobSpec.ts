import {expect} from "chai";
import * as Docker from "dockerode";
import {Test} from "../../common/TestHarness";
import {GradingJob} from "../src/autotest/GradingJob";

class ContainerMock extends Docker.Container {
    public timer: any;
    public waitTime: number = 0;
    private resolveWait: any;
    private isRunning: boolean = false;
    private isWaiting: boolean = false;

    public start(options?: {}): Promise<any> {
        return null;
    }

    public stop(options?: {}): Promise<any> {
        clearTimeout(this.timer);
        this.resolveWait({StatusCode: 0});
        return Promise.resolve({StatusCode: 0});
    }

    public wait(): Promise<any> {
        return new Promise<any>((resolve) => {
           if (this.waitTime <= 0) {
               resolve({StatusCode: 0});
           } else {
               this.resolveWait = resolve;
               this.timer = setTimeout(() => {
                   resolve({StatusCode: 0});
               }, this.waitTime * 1000);
           }
        });
    }
}

describe("GradingJob", function() {
    const containerMaxExecTime = 0.1;  // seconds

    describe("#runContainer", function() {
        let container: ContainerMock;

        beforeEach(function() {
            container = new ContainerMock(null, "test-container");
        });

        it("Should return the container's exit code", async function() {
            let result: any;
            try {
                result = await GradingJob.runContainer(container, containerMaxExecTime);
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.equal(0);
            }
        });

        it("Should return -1 if the container is stopped", async function() {
            container.waitTime = containerMaxExecTime + 0.05;
            let result: any;
            try {
                result = await GradingJob.runContainer(container, containerMaxExecTime);
            } catch (err) {
                result = err;
            } finally {
                expect(result).to.equal(-1);
            }
        });
    });
});
