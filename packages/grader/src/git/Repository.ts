import { exec } from "child_process";
import * as fs from "fs-extra";
import * as path from "path";

/**
 * Wrapper for some git commands.
 */
export class Repository {
    public path: string;

    constructor() {
    }

    /**
     * Wrapper for git-checkout.
     * @param commit The commit SHA to checkout.
     * @throws When the commit cannot be checked-out.
     */
    public async checkout(commit: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            exec(`git checkout ${commit}`, { cwd: this.path }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                resolve();
            });
        });
    }

    /**
     * [NOT IMPLEMENTED] Creates a copy of the repository at the destination, keeping only the commit version.
     * @param commit The tree or commit to checkout.
     * @param dest The location the to put the checked-out version of the repository.
     */
    public async checkoutTo(commit: string, dest: string): Promise<void> {
        // TODO
        // NOTE https://git-scm.com/docs/git-archive
        // NOTE https://stackoverflow.com/questions/160608/do-a-git-export-like-svn-export/163769#163769
        // NOTE https://stackoverflow.com/questions/4479960/git-checkout-to-a-specific-folder
        throw new Error(`Not implemented`);
    }

    /**
     * Wrapper for git-clone. Credentials with read permission on the repository should be specified in the url.
     * @param url The location, including credentials, of the repository.
     * @param dir The path on the locally machine to clone the files.
     * @throws When the repository cannot be cloned.
     */
    public async clone(url: string, dir: string): Promise<void> {
        this.path = path.resolve(dir);
        return new Promise<void>((resolve, reject) => {
            exec(`git clone ${url} ${this.path}`, { env: {GIT_TERMINAL_PROMPT: 0} }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                console.log("GIT CLONE", stdout, stderr);
                resolve();
            });
        });
    }

    public async getSha(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            exec(`git rev-parse HEAD`, { cwd: this.path }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
                resolve(stdout);
            });
        });
    }

    /**
     * Deletes the locally-stored copy of the repository.
     * @throws if the directory cannot be deleted.
     */
    public async remove(): Promise<void> {
        return fs.remove(this.path);
    }

    /**
     * [NOT IMPLEMENTED] Pulls changes from all branches from the origin remote.
     * @returns a promise that resolves to the SHA of the latest commit.
     * @throws if there was a problem pulling changes.
     */
    public async update(): Promise<string> {
        // TODO
        throw new Error(`Not implemented`);
    }
}
