import { GradingJob } from "@autotest/autotest/GradingJob";
import { ContainerInput, ContainerState, GradeReport } from "@common/types/ContainerTypes";
import { expect } from "chai";
import * as Docker from "dockerode";
import * as fs from "fs-extra";
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

	/**
	 * run() turns a container exit code and a report file into what the student sees.
	 *
	 * The branching here is the whole point of the function and none of it was covered: the file
	 * sat at 40%, with runDirectory and runContainer tested and run() and prepare() not. Every
	 * branch below decides a message a student reads and whether it is posted back at all, and
	 * they are reached by a container crashing, hanging, or producing nothing -- which is to say,
	 * routinely.
	 *
	 * Docker is faked rather than stubbed at the socket: run() only needs createContainer, and
	 * the container only needs the five methods it calls.
	 */
	describe("#run", function () {
		/**
		 * A container that exits with a chosen code, optionally after a delay so the maxExecTime
		 * timer in runContainer fires first.
		 */
		class FakeContainer {
			public modem = { demuxStream: (): void => undefined };
			private resolveWait: any = null;
			private timer: any = null;

			public constructor(
				private readonly statusCode: number,
				private readonly waitMs: number = 0
			) {}

			public async start(): Promise<any> {
				return null;
			}

			public async update(): Promise<any> {
				return null;
			}

			public async attach(): Promise<any> {
				return { on: (): void => undefined, pipe: (): void => undefined };
			}

			public async stop(): Promise<any> {
				// runContainer's timeout path stops the container; the pending wait must settle
				clearTimeout(this.timer);
				if (this.resolveWait !== null) {
					this.resolveWait({ StatusCode: this.statusCode });
				}
				return { StatusCode: this.statusCode };
			}

			public wait(): Promise<any> {
				return new Promise<any>((resolve) => {
					if (this.waitMs <= 0) {
						resolve({ StatusCode: this.statusCode });
					} else {
						this.resolveWait = resolve;
						this.timer = setTimeout(() => resolve({ StatusCode: this.statusCode }), this.waitMs);
					}
				});
			}
		}

		function dockerReturning(container: any): any {
			return { createContainer: async (): Promise<any> => container };
		}

		/**
		 * A job with its run directory prepared the way prepare() would leave it, minus the clone:
		 * run() writes staff/stdio.txt and reads staff/report.json.
		 */
		async function jobWith(report: any | null, maxExecTime: number = 0): Promise<GradingJob> {
			const input = JSON.parse(JSON.stringify(TestData.inputRecordA)) as ContainerInput;
			input.containerConfig.maxExecTime = maxExecTime;
			// a distinct SHA per job keeps the run directories from colliding between tests
			input.target.commitSHA = "runspec" + Date.now() + Math.floor(Math.random() * 100000);

			const job = new GradingJob(input);
			await fs.emptyDir(job.path);
			await fs.mkdirp(job.path + "/staff");
			await fs.mkdirp(job.path + "/assn");
			if (report !== null) {
				await fs.writeJson(job.path + "/staff/report.json", report);
			}
			return job;
		}

		const goodReport: GradeReport = {
			scoreOverall: 80,
			scoreCover: null,
			scoreTest: null,
			feedback: "8/10 passed.",
			passNames: [],
			skipNames: [],
			failNames: [],
			errorNames: [],
			result: ContainerState.SUCCESS,
			attachments: [],
			custom: {},
		};

		afterEach(async function () {
			// leave nothing behind in persist/runs
			for (const dir of created) {
				await fs.remove(dir);
			}
			created = [];
		});

		let created: string[] = [];

		it("Should report SUCCESS and read the report when the container exits 0.", async function () {
			const job = await jobWith(goodReport);
			created.push(job.path);

			const result = await job.run(dockerReturning(new FakeContainer(0)) as any);

			expect(result.output.state).to.equal(ContainerState.SUCCESS);
			expect(result.output.report.feedback, "the container's own feedback must survive").to.equal("8/10 passed.");
			expect(result.output.postbackOnComplete, "a clean exit posts nothing back on its own").to.be.false;
		});

		it("Should post back when the container exits non-zero but still produced a report.", async function () {
			// the documented "free feedback" path: a container signals "tell the student" by
			// exiting non-zero while still writing a report
			const job = await jobWith(goodReport);
			created.push(job.path);

			const result = await job.run(dockerReturning(new FakeContainer(3)) as any);

			expect(result.output.state).to.equal(ContainerState.SUCCESS);
			expect(result.output.postbackOnComplete).to.be.true;
			expect(result.output.report.feedback).to.equal("8/10 passed.");
		});

		it("Should report FAIL and always post back when the container exits -10.", async function () {
			const job = await jobWith(goodReport);
			created.push(job.path);

			const result = await job.run(dockerReturning(new FakeContainer(-10)) as any);

			expect(result.output.state).to.equal(ContainerState.FAIL);
			expect(result.output.report.result).to.equal(ContainerState.FAIL);
			expect(result.output.postbackOnComplete, "a failed container must always tell the student").to.be.true;
			expect(result.output.report.feedback).to.contain("Container failed");
		});

		it("Should report TIMEOUT with the slow-code explanation when the container overruns.", async function () {
			// maxExecTime is in seconds; the container outlasts it, so runContainer stops it and
			// returns -1. This is the message students see most often when their code hangs.
			const job = await jobWith(goodReport, 0.05);
			created.push(job.path);

			const result = await job.run(dockerReturning(new FakeContainer(0, 400)) as any);

			expect(result.output.state).to.equal(ContainerState.TIMEOUT);
			expect(result.output.report.result).to.equal(ContainerState.TIMEOUT);
			expect(result.output.postbackOnComplete).to.be.true;
			expect(result.output.report.feedback, "the timeout message must say why").to.contain("allotted time");
		});

		it("Should report NO_REPORT when the container exits cleanly but writes nothing.", async function () {
			// the container ran, said nothing, and the student would otherwise get the constructor's
			// default feedback with no explanation
			const job = await jobWith(null);
			created.push(job.path);

			const result = await job.run(dockerReturning(new FakeContainer(0)) as any);

			expect(result.output.state).to.equal(ContainerState.NO_REPORT);
			expect(result.output.report.result).to.equal(ContainerState.NO_REPORT);
			expect(result.output.report.feedback).to.contain("Make a new commit");
		});

		it("Should remove the cloned assignment directory when it is done.", async function () {
			// the clone is the largest thing on disk and there is one per run; leaving them fills
			// the volume mid-term
			const job = await jobWith(goodReport);
			created.push(job.path);
			expect(await fs.pathExists(job.path + "/assn"), "setup").to.be.true;

			await job.run(dockerReturning(new FakeContainer(0)) as any);

			expect(await fs.pathExists(job.path + "/assn"), "the clone must not be left behind").to.be.false;
		});
	});
});
