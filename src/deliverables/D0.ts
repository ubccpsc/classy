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

    constructor() {
        super();
        this.coverageReport = `coverage.json`;
        this.testReportRun1 = `testReportRun1.json`;
        this.testReportRun2 = `testReportRun2.json`;
        this.testsAllowedPass = [];
    }

    public async run(container: Container): Promise<IRunReport> {
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
            src = `${container.deliverableDir}/package.json`;
            dst = `${container.projectDir}/package.json`;
            Log.trace(`D0::run() - Copying ${src} to ${dst}`);
            await fs.copy(src, dst);

            src = `${container.deliverableDir}/tsconfig.json`;
            dst = `${container.projectDir}/tsconfig.json`;
            Log.trace(`D0::run() - Copying ${src} to ${dst}`);
            await fs.copy(src, dst);

            src = `${container.deliverableDir}/tslint.json`;
            dst = `${container.projectDir}/tslint.json`;
            Log.trace(`D0::run() - Copying ${src} to ${dst}`);
            await fs.copy(src, dst);

            src = `${container.deliverableDir}/node_modules`;
            dst = `${container.projectDir}/node_modules`;
            await fs.copy(src, dst);

            Log.info(`D0::run() - SUCCESS Copying files.`);
        } catch (err) {
            Log.error(`D0::run() - ERROR Copying files. ${err}`);
            container.kill(3);
        }

        let cmd;
        Log.info(`D0::run() - Building student project.`);
        try {
            cmd = await Util.yarn(`build`, { cwd: container.projectDir });
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
            cmd = await Util.yarn(`lint:test`, { cwd: container.projectDir });
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
        const env = {
            MOCHAWESOME_REPORTDIR: container.ioDir,
            MOCHAWESOME_REPORTFILENAME: this.testReportRun1,
        };

        try {
            cmd = await Util.yarn(`autotestcover`, { cwd: container.projectDir, env });
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
                cmd = await Util.yarn(`build`, { cwd: container.projectDir });
            } catch (err) {
                cmd = err;
            } finally {
                Log.trace(`D0::run() - Build output:\n${cmd.output}`);
            }

            Log.trace(`D0::run() - Running student tests.`);
            env[`MOCHAWESOME_REPORTFILENAME`] = this.testReportRun2;
            cmd = await Util.yarn(`autotestcover`, { cwd: container.projectDir, env })
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

        const scoreCover = coverageReport.total.lines.pct;
        const scoreTest = validTests.length / (validTests.length + invalidTests.length) * 100;
        const scoreOverall = parseFloat((0.8 * Math.min(scoreCover + 5, 100) + 0.2 * scoreTest).toFixed(2));

        const feedback = `Your grade is ${scoreOverall}.`;

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

        return report;
    }
}
