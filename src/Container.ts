import { fork } from "child_process";
import * as fs from "fs-extra";
import { IRunReport } from "./deliverables/Deliverable";
import Log from "./Log";
import Util from "./Util";

interface IUserInfo {
    username: string;
    csid: string;
    snum: string;
    profileUrl: string;
    fname: string;
    lname: string;
}

interface IPushInfo {
    branch: string;
    repo: string;
    commit: string;
    commitUrl: string;
    projectUrl: string;
    timestamp: number;
}

interface IContainer {
    branch: string;
    suiteVersion: string;
    image: string;
    exitcode: number;
}

interface IDeliverableInfo {
    solutionsUrl: string;
    deliverableCommit: string;
    deliverableUrl: string;
    deliverableToMark: string;
    githubKey: string;
}

export interface IRuntime {
    userInfo: IUserInfo;
    pushInfo: IPushInfo;
    container: IContainer;
    deliverableInfo: IDeliverableInfo;
    dockerImage: string;
    githubKey: string;
    githubOrg: string;
    custom: object;
    teamId: string;
    courseNum: number;
    stdioRef: string;
}

interface IContainerRecord {
    team: string;
    commitUrl: string;
    timestamp: number;
    repo: string;
    ref: string;
    report: any; // grade report
    container: {
        scriptVersion: string;
        suiteVersion: string;
        image: string;
        exitCode: number;
    };
    postbackOnComplete: boolean;
    projectUrl: string;
    courseNum: number;
    orgName: string;
    custom: object;
    gradeRequested: boolean;
    gradeRequestedTimestamp: number;
    deliverable: string;
    user: string;
    githubFeedback: string;
    idStamp: string;
    attachments: Array<{
        name: string;
        data: string;
        content_type: string;
    }>;
}

interface IGradeReport {
    scoreOverall: number;
    scoreTest: number;
    scoreCover: number;
    passNames: string[];
    failNames: string[];
    errorNames: string[];
    skipNames: string[];
    custom: any[];
    comment: string;
}

export default class Container {
    public static nodeCmd = process.env.NODE_PATH;
    private static scriptVersion: string = "0.0.1";

    public runtime: IRuntime;
    public ioDir: string;
    public projectDir: string;
    public deliverableDir: string;
    public rootDir: string;

    private suiteVersion: string;
    private image: string;
    private exitCode: number;

    constructor(runtime: IRuntime) {
        this.ioDir = process.env.IO_DIR;
        this.projectDir = process.env.PROJECT_DIR;
        this.deliverableDir = process.env.DELIV_DIR;
        this.rootDir = process.env.ROOT_DIR;

        this.runtime = runtime;
        this.suiteVersion = runtime.container.suiteVersion;
        this.image = runtime.container.image;
    }

    public async init() {
        Log.info(`Container::init() - Initializing container scripts.`);

        const projectGithubKey = this.runtime.githubKey;
        const deliverableGithubKey = this.runtime.githubKey;
        const project = {
            cloneUrl: this.runtime.pushInfo.projectUrl.replace(`https://`, `https://${projectGithubKey}@`) + `.git`,
            commit: this.runtime.pushInfo.commit,
            path: this.projectDir,
            url: this.runtime.pushInfo.projectUrl,
        };
        const deliverable = {
            branch: this.runtime.deliverableInfo.deliverableToMark,
            cloneUrl: this.runtime.deliverableInfo.deliverableUrl
                        .replace(`https://`, `https://${deliverableGithubKey}@`) + `.git`,
            path: this.deliverableDir,
            url: this.runtime.deliverableInfo.deliverableUrl,
        };

        let cmd;

        Log.info(`Container::init() - Configuring student repository.`);
        try {
            cmd = await Util.git([`clone`, project.cloneUrl, project.path], { cwd: this.rootDir });
            cmd = await Util.git([`checkout`, project.commit], { cwd: project.path });
        } catch (err) {
            cmd = err;
            this.kill(2);
        } finally {
            Log.cmd(cmd.output);
            if (cmd.code === 0) {
                Log.info(`Container::init() - SUCCESS Configuring student repository.`);
            } else {
                Log.error(`Container::init() - ERROR Configuring student repository. Git exit code ${cmd.code}.`);
            }
        }

        Log.info(`Container::init() - Configuring reference solution repository.`);
        try {
            cmd = await Util.git([`clone`, deliverable.cloneUrl, deliverable.path], { cwd: this.rootDir });
            cmd = await Util.git([`checkout`, deliverable.branch], { cwd: deliverable.path });
        } catch (err) {
            cmd = err;
            this.kill(3);
        } finally {
            Log.cmd(cmd.output);
            if (cmd.code === 0) {
                Log.info(`Container::init() - SUCCESS Configuring reference solution repository.`);
            } else {
                Log.error(
                    `Container::init() - ERROR Configuring reference solution repository. Git exit code ${cmd.code}.`);
            }
        }

        Log.info(`Container::init() - Installing node packages for deliverable.`);
        try {
            cmd = await Util.yarn(`install`, { cwd: deliverable.path });
        } catch (err) {
            cmd = err;
            this.kill(4);
        } finally {
            Log.cmd(cmd.output);
            if (cmd.code === 0) {
                Log.info(`Container::init() - SUCCESS Installing node packages for deliverable.`);
            } else {
                Log.error(
                    `Container::init() - ERROR Installing node packages for deliverable. Yarn exit code ${cmd.code}.`);
            }
        }

        Log.info(`Container::init() - Blocking network traffic.`);
        Log.warn(`NOT IMPLEMENTED: Default firewall setting in use. Network traffic is *NOT* being blocked.`);

        Log.info(`Container::init() - Initialization completed successfully.`);
    }

    public async run(): Promise<number> {
        Log.info(`Container::run() - Starting new node process as a standard user.`);
        const env = process.env;
        env[`isFork`] = `true`;
        env[`deliverable`] = this.runtime.deliverableInfo.deliverableToMark;

        const options = {
            cwd: `/grading`,
            env,
            execPath: Container.nodeCmd,
            gid: 1000,
            silent: true,
            timeout: 5 * 60 * 1000,
            uid: 1000,
        };

        // fork a child node process
        const childPromise =  new Promise<number>((resolve, reject) => {
            const cmd = fork(`src/Main.js`, [], options);

            cmd.on(`error`, (err) => {
                Log.error(`Container::run() - ERROR Creating child node process. ${err}`);
                reject(err);
            });

            // cmd.stdout.on(`data`, (data) => {
            //     const stdout = data.toString();
            //     writeBuffer(stdout);
            // });

            // cmd.stderr.on(`data`, (data) => {
            //     const stderr = data.toString();
            //     writeBuffer(stderr);
            // });

            cmd.on(`close`, (code) => {
                if (code === 0) {
                    resolve(code);
                } else {
                    reject(code);
                }
            });
        });

        Log.info(`Container::run() - Child node process started.`);
        return childPromise;
    }

    public async kill(code: number) {
        this.exitCode = code;
    }

    public generateRecord(runReport: IRunReport): IContainerRecord {
        const ref = this.runtime.pushInfo.branch;
        const deliverable = this.runtime.deliverableInfo.deliverableToMark;
        const user = this.runtime.userInfo.username;
        const repo = this.runtime.pushInfo.repo;

        const gradeReport = runReport;
        delete gradeReport.feedback;
        delete gradeReport.code;

        const record: IContainerRecord = {
            attachments: [],
            commitUrl: this.runtime.pushInfo.commitUrl,
            container: {
                exitCode: this.exitCode,
                image: this.image,
                scriptVersion: Container.scriptVersion,
                suiteVersion: this.suiteVersion,
            },
            courseNum: this.runtime.courseNum,
            custom: this.runtime.custom,
            deliverable,
            githubFeedback: runReport.feedback,
            gradeRequested: false,
            gradeRequestedTimestamp: -1,
            idStamp: `${new Date().toUTCString()}|${ref}|${deliverable}|${user}|${repo}`,
            orgName: this.runtime.githubOrg,
            postbackOnComplete: runReport.code !== 0,
            projectUrl: this.runtime.pushInfo.projectUrl,
            ref,
            repo,
            report: gradeReport,
            team: this.runtime.teamId,
            timestamp: this.runtime.pushInfo.timestamp,
            user,
        };

        return record;
    }

    // call the REST endpoint and do other "stuff" here to
    // store the record on the server.
    public async sendRecord(record: IContainerRecord) {
        // TODO http request to send info
    }
}
