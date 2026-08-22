import Log from "@common/Log";
import Util from "@common/Util";

const tmp = require("tmp-promise");
const exec = require("child-process-promise").exec;

/**
 * Rewrites a repository URL so it carries the bot token, producing
 * "https://longtokenstring@githuburi". Any ".git" suffix and the "#branch:path" specifier that
 * may follow it are dropped, so the result is always a plain clone URL.
 *
 * Shared with GitHubActions::addGithubAuthToken(..): both paths must authenticate URLs the same
 * way, and this used to be implemented twice with subtly different behaviour.
 */
export function addAuthTokenToUrl(url: string, gitHubAuthToken: string): string {
	try {
		const [cloneUrl] = url.split(".git");
		const startAppend = cloneUrl.indexOf("//") + 2;
		const authKey = gitHubAuthToken.substring(gitHubAuthToken.indexOf("token ") + 6) + "@";
		return cloneUrl.slice(0, startAppend) + authKey + cloneUrl.slice(startAppend);
	} catch (err) {
		Log.error("RepoImporter::addAuthTokenToUrl() - Unexpected error", err);
		return "";
	}
}

/**
 * Copies the contents of a seed repository into a (usually freshly created, empty) student
 * repository, without carrying the seed repository's history across.
 *
 * The seed can be specified in a few ways, all encoded in the import URL:
 *
 *   https://host/org/repo.git                  whole repo, default branch
 *   https://host/org/repo.git#branch           whole repo, specific branch
 *   https://host/org/repo.git#branch:sub/dir   only sub/dir of that branch
 *
 * and `seedFilePath` narrows it further (a glob relative to whatever the URL selected).
 *
 * When only part of the seed is wanted the repo is cloned to a scratch directory first and the
 * selected files are copied out of it; otherwise the clone directory is used directly. Either
 * way the .git directory is discarded and a fresh single-commit repository is pushed to the
 * student repo, so students do not inherit the seed's commit history.
 *
 * Extracted from GitHubActions::importRepoFS(..); this is a one-shot job object, create one per
 * import rather than reusing an instance.
 */
export class RepoImporter {
	private readonly importRepo: string;
	private readonly studentRepo: string;
	private readonly seedFilePath: string;
	private readonly gitHubAuthToken: string;

	/**
	 * @param importRepo the seed repository URL (see the class comment for the accepted forms)
	 * @param studentRepo the repository to push the seed contents into
	 * @param gitHubAuthToken the bot token, in "token abc123..." form
	 * @param seedFilePath optional path within the seed repo to narrow the import to
	 */
	public constructor(importRepo: string, studentRepo: string, gitHubAuthToken: string, seedFilePath?: string) {
		this.importRepo = importRepo;
		this.studentRepo = studentRepo;
		this.gitHubAuthToken = gitHubAuthToken;
		this.seedFilePath = seedFilePath;
	}

	/**
	 * Performs the import.
	 *
	 * @returns {Promise<boolean>} true if the seed was pushed to the student repo
	 * @throws if any of the git operations fail
	 */
	public async import(): Promise<boolean> {
		const start = Date.now();

		const authedImportRepo = addAuthTokenToUrl(this.importRepo, this.gitHubAuthToken);
		const authedStudentRepo = addAuthTokenToUrl(this.studentRepo, this.gitHubAuthToken);
		const importBranch = this.getImportBranch(this.importRepo);
		const importPath = this.selectPath(this.getPath(this.importRepo), this.seedFilePath);

		// only part of the seed is wanted, so it has to be cloned somewhere else first and the
		// selected files copied across into the directory that actually gets pushed
		const usesSeedPath = typeof importPath === "string" && importPath !== "";
		const label = usesSeedPath ? "GitHubAction::cloneRepo() seedPath" : "GitHubAction::cloneRepo()";

		const cloneTempDir = await tmp.dir({ dir: "/tmp", unsafeCleanup: true });
		let seedTempDir = null;

		try {
			if (usesSeedPath) {
				seedTempDir = await tmp.dir({ dir: "/tmp", unsafeCleanup: true });
				await this.cloneRepo(authedImportRepo, seedTempDir.path);
				await this.checkout(seedTempDir.path, importBranch);
				await this.moveFiles(seedTempDir.path, importPath, cloneTempDir.path);
			} else {
				await this.cloneRepo(authedImportRepo, cloneTempDir.path);
				await this.checkout(cloneTempDir.path, importBranch);
			}

			await this.removeGitDir(cloneTempDir.path);
			await this.initGitDir(cloneTempDir.path);
			await this.changeGitRemote(cloneTempDir.path, authedStudentRepo);
			await this.addFilesToRepo(cloneTempDir.path);
			await this.pushToNewRepo(cloneTempDir.path);

			Log.info(label + " - done; took: " + Util.took(start));
			return true; // made it cleanly
		} catch (err) {
			/* istanbul ignore next */
			// NOTE: redact; a failed git command puts the whole command line (which carries the
			// bot token in the remote URL) into the error message
			Log.error(label + " - ERROR: " + this.redact(String(err)));
			throw err;
		} finally {
			// cleanup has to happen on both paths, hence the finally
			if (seedTempDir !== null) {
				seedTempDir.cleanup();
			}
			cloneTempDir.cleanup();
		}
	}

	/**
	 * Extracts the branch from a "...#branch:path" URL specifier; "" when none is given.
	 */
	private getImportBranch(url: string): string {
		try {
			const [_cloneUrl, specifiers] = url.split("#");
			const [branch, _path] = (specifiers || "").split(":");
			return branch;
		} catch (err) {
			Log.error("GitHubActions::importRepoFS(..)::getImportBranch() - Unexpected error", err);
			return "";
		}
	}

	/**
	 * Extracts the path from a "...#branch:path" URL specifier, without surrounding slashes.
	 */
	private getPath(url: string): string {
		try {
			const [_cloneUrl, specifiers] = url.split(".git");
			const [_branch, pathSpecifier] = (specifiers || "").split(":");
			let path = pathSpecifier || "";
			path = path.startsWith("/") ? path.slice(1) : path;
			path = path.endsWith("/") ? path.slice(0, -1) : path;
			return path;
		} catch (err) {
			Log.error("GitHubActions::importRepoFS(..)::getPath() - Unexpected error", err);
			return "";
		}
	}

	/**
	 * Combines the path from the URL with the explicitly-provided seed file path.
	 */
	private selectPath(dirPath: string, filePath: string): string {
		let finalPath = filePath;
		if (dirPath && filePath) {
			finalPath = `${dirPath}/${filePath}`;
		} else if (dirPath) {
			finalPath = `${dirPath}/*`;
		}
		return finalPath;
	}

	private async cloneRepo(authedImportRepo: string, repoPath: string): Promise<void> {
		Log.info("GitHubActions::importRepoFS(..)::cloneRepo() - cloning: " + this.importRepo);
		const result = await exec(`git clone -q ${authedImportRepo} ${repoPath}`);
		Log.info("GitHubActions::importRepoFS(..)::cloneRepo() - done");
		this.report(result, "cloneRepo()");
	}

	private async checkout(repoPath: string, branch: string): Promise<void> {
		if (typeof branch !== "string" || branch === "") {
			Log.info(`GitHubActions::importRepoFS(..)::checkout() - Using default branch`);
			return;
		}
		Log.info(`GitHubActions::importRepoFS(..)::checkout() - Checking out "${branch}"`);
		const result = await exec(`cd ${repoPath} && git checkout ${branch}`);
		Log.info("GitHubActions::importRepoFS(..)::checkout() - done");
		this.report(result, "checkout()");
	}

	private async moveFiles(originPath: string, filesLocation: string, destPath: string): Promise<void> {
		Log.info("GitHubActions::importRepoFS(..)::moveFiles( " + originPath + ", " + filesLocation + ", " + destPath + ") - moving files");
		const result = await exec(`cp -r ${originPath}/${filesLocation} ${destPath}`);
		Log.info("GitHubActions::importRepoFS(..)::moveFiles(..) - done");
		this.report(result, "moveFiles(..)");
	}

	private async removeGitDir(repoPath: string): Promise<void> {
		Log.info("GitHubActions::importRepoFS(..)::removeGitDir() - removing .git from cloned repo");
		const result = await exec(`cd ${repoPath} && rm -rf .git`);
		Log.info("GitHubActions::importRepoFS(..)::removeGitDir() - done");
		this.report(result, "removeGitDir()");
	}

	private async initGitDir(repoPath: string): Promise<void> {
		Log.info("GitHubActions::importRepoFS(..)::initGitDir() - start");
		const result = await exec(`cd ${repoPath} && git init -q && git branch -m main`);
		Log.info("GitHubActions::importRepoFS(..)::initGitDir() - done");
		this.report(result, "initGitDir()");
	}

	private async changeGitRemote(repoPath: string, authedStudentRepo: string): Promise<void> {
		Log.info("GitHubActions::importRepoFS(..)::changeGitRemote() - start");
		const command = `cd ${repoPath} && git remote add origin ${authedStudentRepo}.git && git fetch --all -q`;
		const result = await exec(command);
		Log.info("GitHubActions::importRepoFS(..)::changeGitRemote() - done");
		this.report(result, "changeGitRemote()");
	}

	private async addFilesToRepo(repoPath: string): Promise<void> {
		Log.info("GitHubActions::importRepoFS(..)::addFilesToRepo() - start");
		const command = `cd ${repoPath} && git config user.email "classy@cs.ubc.ca" && git config user.name "classy" && git add . && git commit -q -m "Starter files"`;
		const result = await exec(command);
		Log.info("GitHubActions::importRepoFS(..)::addFilesToRepo() - done");
		this.report(result, "addFilesToRepo()");
	}

	private async pushToNewRepo(repoPath: string): Promise<void> {
		const pushStart = Date.now();
		Log.info("GitHubActions::importRepoFS(..)::pushToNewRepo() - start");
		const command = `cd ${repoPath} && git push -q origin main`;
		const result = await exec(command);
		Log.info("GitHubActions::importRepoFS(..)::pushToNewRepo() - done; took: " + Util.took(pushStart));
		this.report(result, "pushToNewRepo()");
	}

	/**
	 * Surfaces whatever the git invocation wrote to stdout/stderr; both are only interesting
	 * when non-empty, which is usually a sign something did not go as planned.
	 */
	/**
	 * Strips the bot token out of text that is about to be logged; see GitHubActions::redact.
	 *
	 * @param text
	 * @returns {string}
	 */
	private redact(text: string): string {
		const bare = this.gitHubAuthToken.substring(this.gitHubAuthToken.indexOf("token ") + 6);
		return Util.redactSecrets(text, [this.gitHubAuthToken, bare]);
	}

	private report(result: any, step: string): void {
		// NOTE: git writes the remote URL (with the embedded token) into its own diagnostics,
		// so both streams are redacted before they reach the log
		if (result.stdout) {
			Log.warn("GitHubActions::stdOut(..) - GitHubActions::importRepoFS(..)::" + step + ": " + this.redact(String(result.stdout)));
		}
		if (result.stderr) {
			Log.warn("GitHubActions::stdErr(..) - importRepoFS(..)::" + step + ": " + this.redact(String(result.stderr)));
		}
	}
}
