import * as fs from "fs-extra";
import Container from "../Container";
import Log from "../Log";
import Util from "../Util";
import Deliverable from "./Deliverable";
import { IRunReport, ITestNames } from "./Deliverable";

export default class D0 extends Deliverable {
    private coverageReport: string;
    private testReportRun1: string;
    private testReportRun2: string;
    private testsAllowedPass: string[];

    constructor(container: Container) {
        super(container);
        this.coverageReport = `${container.projectDir}/coverage/coverage-summary.json`;
        this.testReportRun1 = `${container.ioDir}/testReportRun1.json`;
        this.testReportRun2 = `${container.ioDir}/testReportRun2.json`;
        this.testsAllowedPass = [`Should run test queries`];
    }

    public async run(): Promise<IRunReport> {
        Log.info(`D0::run() - Running script to test students code.`);

        const report: IRunReport = {
            code: 0,
            custom: [],
            errorNames: [],
            failNames: [],
            feedback: "",
            passNames: [],
            scoreCover: 0,
            scoreOverall: 0,
            scoreTest: 0,
            skipNames: [],
        };

        Log.info(`D0::run() - Copying files to student project directory from solution.`);
        let src: string;
        let dst: string;
        try {
            src = `${this.container.deliverableDir}/package.json`;
            dst = `${this.container.projectDir}/package.json`;
            Log.trace(`D0::run() - Copying ${src} to ${dst}`);
            await fs.copy(src, dst);

            src = `${this.container.deliverableDir}/tsconfig.json`;
            dst = `${this.container.projectDir}/tsconfig.json`;
            Log.trace(`D0::run() - Copying ${src} to ${dst}`);
            await fs.copy(src, dst);

            src = `${this.container.deliverableDir}/tslint.json`;
            dst = `${this.container.projectDir}/tslint.json`;
            Log.trace(`D0::run() - Copying ${src} to ${dst}`);
            await fs.copy(src, dst);

            src = `${this.container.deliverableDir}/node_modules`;
            dst = `${this.container.projectDir}/node_modules`;
            await fs.copy(src, dst);

            Log.info(`D0::run() - SUCCESS Copying files.`);
        } catch (err) {
            Log.error(`D0::run() - ERROR Copying files. ${err}`);
            report.code = 4;
            report.feedback = `AutoTest experienced an internal error. Trying committing your code again.`;
            return report;
        }

        let cmd;
        Log.info(`D0::run() - Building student project.`);
        try {
            cmd = await Util.yarn(`build`, { cwd: this.container.projectDir });
        } catch (err) {
            cmd = err;
            const feedback = `
            Your code failed to build. You cannot request your grade until your code compiles cleanly. Output from \`yarn build\` follows:
            \`\`\`
            ${cmd.output}
            \`\`\`
            `;

            if (!report.feedback) {
                report.feedback = feedback;
            }
            report.code = 1;
            // throw new Error()
        } finally {
            Log.cmd(cmd.output);
            if (cmd.code === 0) {
                Log.info(`D0::run() - SUCCESS Building student project.`);
            } else {
                Log.error(`D0::run() - ERROR Building student project. Yarn exit code ${cmd.code}.`);
            }
        }

        Log.info(`D0::run() - Linting student project.`);
        try {
            cmd = await Util.yarn(`lint:test`, { cwd: this.container.projectDir });
        } catch (err) {
            cmd = err;
            const feedback = `
            Your code failed to lint. You cannot request your grade until your code is free of linting errors. Output from \`yarn lint\` follows:
            \`\`\`
            ${cmd.output}
            \`\`\`
            `;

            if (!report.feedback) {
                report.feedback = feedback;
            }

            report.code = 2;
            // throw new Error()
        } finally {
            Log.cmd(cmd.output);
            if (cmd.code === 0) {
                Log.info(`D0::run() - SUCCESS Linting student project.`);
            } else {
                Log.error(`D0::run() - ERROR Linting student project. Yarn exit code ${cmd.code}.`);
            }
        }

        Log.info(`D0::run() - Running student tests against invalid implementation.`);
        const env = process.env;
        env[`MOCHAWESOME_REPORTDIR`] = this.container.ioDir;
        env[`MOCHAWESOME_REPORTFILENAME`] = this.testReportRun1;

        try {
            cmd = await Util.yarn(`autotestcover`, { cwd: this.container.projectDir, env });
        } catch (err) {
            cmd = err;
            // throw new Error()
        } finally {
            Log.cmd(cmd.output);
            if (cmd.code === 0) {
                Log.info(`D0::run() - SUCCESS Running student tests against invalid implementation.`);
            } else {
                Log.error(`D0::run() - ERROR Running student tests against invalid implementation. Yarn exit code ${cmd.code}.`);
            }
        }

        Log.info(`D0::run() - Running student tests against solution implementation.`);
        try {
            Log.trace(`D0::run() - Replacing student src with solution src.`);
            await fs.copy(`${process.env.DELIV_DIR}/src`, `${process.env.PROJECT_DIR}/src`);

            Log.trace(`D0::run() - Building student project with solution src. Errors are ignored.`);
            try {
                cmd = await Util.yarn(`build`, { cwd: this.container.projectDir });
            } catch (err) {
                cmd = err;
            } finally {
                Log.trace(`D0::run() - Build output:\n${cmd.output}`);
            }

            Log.trace(`D0::run() - Running student tests.`);
            env[`MOCHAWESOME_REPORTFILENAME`] = this.testReportRun2;
            cmd = await Util.yarn(`autotestcover`, { cwd: this.container.projectDir, env });
        } catch (err) {
            cmd = err;
            // throw new Error()
        } finally {
            Log.cmd(cmd.output);
            if (cmd.code === 0) {
                Log.info(`D0::run() - SUCCESS Running student tests against solution implementation.`);
            } else {
                Log.error(`D0::run() - ERROR Running student tests against solution implementation. Yarn exit code ${cmd.code}.`);
            }
        }

        try {
            await fs.remove(`${this.container.ioDir}/assets`);
        } catch (err) {
            Log.error(`D0::run() - Failed to remove ${this.container.ioDir}/assets. ${err}`);
        }

        Log.info(`D0::run() - Computing grade.`);
        let finalReport = report;
        try {
            finalReport = await this.grade(report);
            Log.info(`D0::run() - SUCCESS Computing grade.`);
        } catch (err) {
            Log.error(`D0::run() - ERROR Computing grade. ${err}`);
        }

        return report;
    }

    private async grade(report: IRunReport): Promise<IRunReport> {
        const coverageReport: any = await fs.readJson(this.coverageReport);
        const testReportRun1: any = await fs.readJson(this.testReportRun1);
        const testReportRun2: any = await fs.readJson(this.testReportRun2);
        const testNames1: ITestNames = Deliverable.extractTestNames(testReportRun1);
        const testNames2: ITestNames = Deliverable.extractTestNames(testReportRun2);

        const validTests = testNames1.fail;
        const invalidTests = testNames2.pass.filter((name: string) => this.testsAllowedPass.indexOf(name) === -1 );

        const scoreCover = parseFloat((Math.pow(Math.min(coverageReport.total.lines.pct + 5, 100) / 100, 2) * 100).toFixed(2));
        const scoreTest = parseFloat((validTests.length / (validTests.length + invalidTests.length) * 100).toFixed(2));
        const scoreOverall = parseFloat((0.8 * scoreCover + 0.2 * scoreTest).toFixed(2));

        let feedback = `Your grade is ${scoreOverall}%.`;
        if (invalidTests.length !== 0) {
            feedback += ` The following tests passed unexpectedly:${invalidTests.join("\n-")}`;
        }

        // D1 Grading logic
        //   const passCount: number = testNames.pass.length;
        //   const failCount: number = testNames.fail.length;
        //   const skipCount: number = testNames.skip.length;
        //   scoreTest = passCount / (passCount + failCount + skipCount) * 100;
        //   scoreOverall = parseFloat((0.8 * scoreTest + 0.2 * Math.min(scoreCover + 5, 100)).toFixed(2));

        report.scoreCover = scoreCover;
        report.scoreTest = scoreTest;
        report.scoreOverall = scoreOverall;

        report.passNames = testNames2.pass;
        report.failNames = testNames2.fail;
        report.skipNames = testNames2.skip;

        if (!report.feedback) {
            report.feedback = feedback;
        }
        Log.trace(JSON.stringify(report));
        return report;
    }
}
