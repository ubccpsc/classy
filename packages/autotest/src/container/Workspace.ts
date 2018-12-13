import {exec} from "child_process";
import * as fs from "fs-extra";
import Log from "../../../common/Log";

export class Workspace {
    public readonly rootDir: string;
    public readonly owner: number;

    constructor(dir: string, uid: number) {
        this.rootDir = dir;
        this.owner = uid;
    }

    // should try and return something more useful
    // TODO: This should be done using a library.
    public async chown(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            exec(`chown -R ${this.owner} ${this.rootDir}`, (error) => {
                if (error) {
                    Log.error("GradeTask::execute() - Failed to change owner. " + error);
                    reject(error);
                }
                resolve();
            });
        });
    }

    public async empty(): Promise<void> {
        return fs.emptyDir(this.rootDir);
    }

    public async mkdir(relPath: string): Promise<void> {
        return fs.mkdirp(this.rootDir + "/" + relPath);
    }

    public async readJson(filename: string): Promise<any> {
        return fs.readJson(this.rootDir + "/" + filename);
    }

    public async rmdir(relPath: string): Promise<void> {
        return fs.remove(this.rootDir + "/" + relPath);
    }

    public async writeFile(filename: string, content: any): Promise<void> {
        return fs.writeFile(this.rootDir + "/" + filename, content);
    }

    public toString(): string {
        return this.rootDir;
    }
}
