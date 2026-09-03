import { GradingJob } from "@autotest/autotest/GradingJob";
import { ContainerInput } from "@common/types/ContainerTypes";
import { expect } from "chai";
import * as Docker from "dockerode";
import { TestData } from "./TestData";

class ContainerMock extends Docker.Container {
	public timer: any;
	public waitTime: number = 0;
	private resolveWait: any;
	// private isRunning: boolean = false;
	// private isWaiting: boolean = false;

	public start(options?: {}): Promise<any> {
		return null;
	}

	public stop(options?: {}): Promise<any> {
		clearTimeout(this.timer);
		this.resolveWait({ StatusCode: 0 });
		return Promise.resolve({ StatusCode: 0 });
	}

	public wait(): Promise<any> {
		return new Promise<any>((resolve) => {
			if (this.waitTime <= 0) {
				resolve({ StatusCode: 0 });
			} else {
				this.resolveWait = resolve;
				this.timer = setTimeout(() => {
					resolve({ StatusCode: 0 });
				}, this.waitTime * 1000);
			}
		});
	}
}

describe("GradingJob", function () {
	const containerMaxExecTime = 0.1; // seconds

	describe("#runDirectory", function () {
		function jobFor(ref: string | undefined): GradingJob {
			const input = JSON.parse(JSON.stringify(TestData.inputRecordA)) as ContainerInput;
			input.target.ref = ref;
			return new GradingJob(input);
		}

		it("Should give two refs on the same commit separate run directories.", function () {
			// Regression: the queue admits one job per (commit, deliv, ref) -- Queue.indexOf and
			// AutoTest.isCommitExecuting both include ref -- so the same SHA pushed to two refs runs
			// twice, concurrently. Both jobs used to resolve to one directory and cross-delete each
			// other's report.json (emptyDir in prepare, removeSync of /assn in run).
			const a = jobFor("refs/heads/main");
			const b = jobFor("refs/heads/feature");

			// the id is the container's EXEC_ID and the record's graderTaskId: deliberately unchanged
			expect(a.id).to.equal(b.id);
			expect(a.path).to.not.equal(b.path);
		});

		it("Should keep a student-authored ref inside the runs directory.", function () {
			// branch names are student-controlled, so the ref must never introduce a path separator
			const job = jobFor("refs/heads/../../../etc/passwd");

			expect(job.dirName).to.not.contain("/");
			expect(job.dirName).to.not.contain("\\");
			expect(job.path).to.contain("/runs/" + job.dirName);
		});

		it("Should separate refs that differ only in punctuation.", function () {
			// sanitizing alone would map both of these to the same string; the hash is what
			// actually keeps them apart
			const a = jobFor("refs/heads/a/b");
			const b = jobFor("refs/heads/a_b");

			expect(a.path).to.not.equal(b.path);
		});

		it("Should use the bare id when there is no ref.", function () {
			// ContainerInput.target.ref is optional; comment-triggered jobs have none
			const job = jobFor(undefined);

			expect(job.dirName).to.equal(job.id);
		});
	});

	describe("#runContainer", function () {
		let container: ContainerMock;

		beforeEach(function () {
			container = new ContainerMock(null, "test-container");
		});

		it("Should return the exit code for the container.", async function () {
			let result: any;
			try {
				result = await GradingJob.runContainer(container, containerMaxExecTime);
			} catch (err) {
				result = err;
			} finally {
				expect(result).to.equal(0);
			}
		});

		it("Should return -1 if the container is stopped.", async function () {
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
