import Log from "../Log";

export class GithubUtil {

    public static getTeamOrProject(repositoryName: string): string {
        // NOTE assume repository name is of the form: CS310-2016Fall/cpsc310project_team10
        const idx = repositoryName.lastIndexOf("_") + 1;
        const val = repositoryName.slice(idx);
        Log.trace("GithubUtil::getTeamOrProject() - input: " + repositoryName + "; output: " + val);
        return val;
    }

    public static parseDeliverable(fullRepoName: string): string | null {
        const deliverable = fullRepoName.match(/^[^_]+(?=_)/);
        if (deliverable) {
            const val = deliverable.pop();
            Log.trace("GithubUtil::parseDeliverable() - input: " + fullRepoName + "; output: " + val);
            return val;
        }
        return null;
    }

    public static parseDeliverableFromComment(message: any): string | null {
        // if a deliverable is specified, say it here
        return null;
    }
}

export class Commit {
    private commitString: string;

    constructor(commitString: string) {
        if (!Commit.isValid(commitString)) {
            throw new Error("Invalid commit string.");
        }
        this.commitString = commitString;
    }

    public static isValid(commitString: string): boolean {
        return /^[a-z0-9]{40}$/.test(commitString);
    }

    get short(): string {
        return this.commitString.substring(0, 7);
    }

    public toString(): string {
        return this.commitString;
    }
}
