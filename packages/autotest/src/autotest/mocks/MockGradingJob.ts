import Log from "@common/Log";
import { AutoTestResult } from "@common/types/AutoTestTypes";
import { ContainerInput, ContainerOutput, ContainerState, GradeReport } from "@common/types/ContainerTypes";
import Util from "@common/Util";

import { GradingJob } from "../GradingJob";

export class MockGradingJob extends GradingJob {
	public static readonly JOB_WAIT = 200;

	constructor(input: ContainerInput) {
		super(input);
	}

	public async prepare(): Promise<void> {
		return;
	}

	public async run(docker: any): Promise<AutoTestResult> {
		try {
			Log.info(
				"MockGrader::execute() - start; repo: " +
					this.input.target.repoId +
					"; deliv: " +
					this.input.target.delivId +
					"; sha: " +
					Util.shaHuman(this.input.target.commitSHA)
			);
			// const oracleToken = Config.getInstance().getProp(ConfigKey.githubOracleToken);
			// const dockerId = Config.getInstance().getProp(ConfigKey.dockerId);
			// const workspace = Config.getInstance().getProp(ConfigKey.workspace);

			// TODO: This should really become TestDocker.ts or something that can be instantiated
			// let timeout = 1000;
			// if (Config.getInstance().getProp(ConfigKey.name) === Config.getInstance().getProp(ConfigKey.testname)) {
			//     timeout = 200; // do not slow down tests; do not need a lot to get out of order here
			// }

			await Util.delay(MockGradingJob.JOB_WAIT); // simulate the container taking longer than the rest of the process

			const gradeReport: GradeReport = {
				scoreOverall: 50,
				scoreTest: 50,
				scoreCover: 50,
				passNames: [],
				failNames: [],
				errorNames: [],
				skipNames: [],
				custom: {},
				feedback: "Test execution complete.",
				result: "SUCCESS",
				attachments: [],
			};

			const out: ContainerOutput = {
				// commitURL:          this.input.pushInfo.commitURL,
				timestamp: Date.now(),
				report: gradeReport,
				// feedback:           "Test execution complete.",
				postbackOnComplete: false,
				custom: {},
				state: ContainerState.SUCCESS,
				graderTaskId: "",
			};

			// just a hack to test postback events
			if (this.input.target.postbackURL === "POSTBACK") {
				Log.info("MockGrader::execute() - overriding for postback");
				out.postbackOnComplete = true;
				out.report.feedback = "Build Problem Encountered.";
				out.report.result = "FAIL_COMPILE";
			}

			const ret: AutoTestResult = {
				delivId: this.input.target.delivId,
				repoId: this.input.target.repoId,
				commitURL: this.input.target.commitURL,
				commitSHA: this.input.target.commitSHA,
				input: this.input,
				output: out,
			};

			Log.info(
				"MockGrader::execute() - execution complete; repo: " +
					this.input.target.repoId +
					"; deliv: " +
					this.input.target.delivId +
					"; sha: " +
					Util.shaHuman(this.input.target.commitSHA) +
					"; feedback: " +
					ret.output.report.feedback
			);
			return ret;
		} catch (err) {
			Log.error("MockGrader::execute() - ERROR: " + err);
			throw err;
		}
	}
}
