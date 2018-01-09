/* tslint:disable:no-console */
import { execSync, fork } from "child_process";
import * as fs from "fs-extra";
import * as rp from "request-promise-native";
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
    githubKeys: {
        delivKey: string;
        solutionsKey: string;
        orgKey: string;
    };
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
    attachments: IAttachment[];
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
}

interface IAttachment {
    name: string;
    data: string;
    content_type: string;
}

export default class Container {
    // public static nodeCmd = ;
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

        execSync(`chmod -R 777 /output`);

        const projectGithubKey = this.runtime.githubKeys.orgKey;
        const deliverableGithubKey = this.runtime.githubKeys.delivKey;
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
            throw new Error(`Failed to clone student repository.`);
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
            throw new Error(`Failed to clone solution repository.`);
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
            throw new Error(`Failed to install packages for the deliverable.`);
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
        env[`IS_FORK`] = `true`;

        const options = {
            cwd: `${process.env.ROOT_DIR}/grading`,
            env,
            execPath: process.env.NODE_PATH,
            gid: 1000,
            silent: true,
            timeout: 5 * 60 * 1000,
            uid: 1000,
        };

        // fork a child node process
        const childPromise = new Promise<number>((resolve, reject) => {
            const cmd = fork(`bin/Main.js`, [], options);

            cmd.on(`error`, (err) => {
                Log.error(`Container::run() - ERROR Creating child node process. ${err}`);
                reject(err);
            });

            cmd.stdout.on(`data`, (data) => {
                console.log(data.toString());
            });

            cmd.stderr.on(`data`, (data) => {
                console.log(data.toString());
            });

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

    public async generateRecord(runReport: IRunReport): Promise<IContainerRecord> {
        const ref = this.runtime.pushInfo.branch;
        const deliverable = this.runtime.deliverableInfo.deliverableToMark;
        const user = this.runtime.userInfo.username;
        const repo = this.runtime.pushInfo.repo;

        const feedback = runReport.feedback.replace(/^\s+/gm, ``).replace(/\n+$/g, ``);
        const code = runReport.code;

        delete runReport.feedback;
        delete runReport.code;

        let attachments: IAttachment[] = [];
        try {
            attachments = await this.generateAttachments(runReport as IGradeReport);
        } catch (err) {
            Log.warn(`Container::generateRecord() - ERROR Generating attachements. ${err}`);
        }

        const record: IContainerRecord = {
            attachments: attachments,
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
            githubFeedback: feedback,
            gradeRequested: false,
            gradeRequestedTimestamp: -1,
            idStamp: `${new Date().toUTCString()}|${ref}|${deliverable}|${user}|${repo}`,
            orgName: this.runtime.githubOrg,
            postbackOnComplete: code !== 0,
            projectUrl: this.runtime.pushInfo.projectUrl,
            ref,
            repo,
            report: runReport,
            team: this.runtime.teamId,
            timestamp: this.runtime.pushInfo.timestamp,
            user,
        };

        return record;
    }

    // call the REST endpoint and do other "stuff" here to
    // store the record on the server.
    public async sendRecord(record: IContainerRecord): Promise<rp.FullResponse> {
        Log.info(`Container::sendRecord() - START`);
        const options = {
            body: { response: record },
            headers: {
                Accept: `application/json`,
            },
            json: true,
            method: `POST`,
            uri: process.env.DB_ENDPOINT,
        };

        let response: rp.FullResponse;
        try {
            Log.trace(`Container::sendRecord() - Sending record ${JSON.stringify(record)}`);
            response = await rp(options);
            Log.info(`Container::sendRecord() - SUCCESS Sending record. Response: ${response}`);
        } catch (err) {
            Log.error(`Container::sendRecord() - ERROR Sending record to database. ${err}`);
            // throw new Error(err);
        }

        return response;
    }

    private async generateAttachments(report: IGradeReport): Promise<IAttachment[]> {
        // We read the coverage report as text to avoid MongoDB complaining about '.' in the key name
        const attachments: any[] = [
            { name: `docker_SHA.json`, data: "", content_type: `application/json`, path: `${this.ioDir}/docker_SHA.json` },
            { name: `coverage.json`, data: "", content_type: `application/text`, path: `${this.projectDir}/coverage/coverage-summary.json` },
            { name: `coverage-full.json`, data: "", content_type: `application/text`, path: `${this.projectDir}/coverage/coverage-final.json` },
            { name: `testsAgainstInvalid.json`, data: "", content_type: `application/json`, path: `${this.ioDir}/testReportRun1.json` },
            { name: `testsAgainstValid.json`, data: "", content_type: `application/json`, path: `${this.ioDir}/testReportRun2.json` },
        ];

        for (const attachment of attachments) {
            if (attachment.path) {
                try {
                    if (attachment.content_type === `application/json`) {
                        attachment.data = await fs.readJson(attachment.path);
                    } else {
                        attachment.data = (await fs.readFile(attachment.path)).toString();
                    }
                    delete attachment.path;
                } catch (err) {
                    Log.warn(`Container::generateAttachments() - ERROR Reading attachment data for ${attachment.name} from ${attachment.path}`);
                }
            }
        }

        return attachments;
    }

}
