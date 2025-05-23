import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { AutoTestResult, IFeedbackGiven } from "@common/types/AutoTestTypes";
import { CommitTarget } from "@common/types/ContainerTypes";
import Util from "@common/Util";

import { IDataStore } from "../DataStore";

/**
 * NOTE: this can have some unhappy consequences if a job is rapidly reading/writing
 * to this datastore w/o waiting appropriately (e.g., if many jobs are processing
 * at once in the test suite).
 *
 * Just know that race conditions are likely, if you are testing that kind of thing.
 */
export class MockDataStore implements IDataStore {
	// NOTE: this creates temp space but does not use the files in autotest/test/githubAutoTestData
	private readonly dir = Config.getInstance().getProp(ConfigKey.persistDir);
	// private readonly RECORD_PATH = this.dir + "/outputRecords.json";
	// private readonly COMMENT_PATH = this.dir + "/commentRecords.json";
	// private readonly PUSH_PATH = this.dir + "/pushRecords.json";
	// private readonly FEEDBACK_PATH = this.dir + "/feedbackRecords.json";

	private results: AutoTestResult[];
	private comments: CommitTarget[];
	private pushes: CommitTarget[];
	private feedback: IFeedbackGiven[];

	constructor() {
		Log.info("MockDataStore::<init> - start; dir: " + this.dir);

		try {
			if (this.dir === null) {
				throw new Error("DataStore::<init> - persistDir must be specified in Config");
			}

			// fs.ensureDirSync(this.dir);
			//
			// // these are terrible, but .ensureFileSync does not tell us if we just created a new file
			// // write an empty array to each file if it was just created above
			// if (!fs.existsSync(this.RECORD_PATH)) {
			//     fs.writeJSONSync(this.RECORD_PATH, []);
			// }
			// if (!fs.existsSync(this.COMMENT_PATH)) {
			//     fs.writeJSONSync(this.COMMENT_PATH, []);
			// }
			// if (!fs.existsSync(this.PUSH_PATH)) {
			//     fs.writeJSONSync(this.PUSH_PATH, []);
			// }
			// if (!fs.existsSync(this.FEEDBACK_PATH)) {
			//     fs.writeJSONSync(this.FEEDBACK_PATH, []);
			// }
			// this.clearData();

			this.results = [];
			this.comments = [];
			this.pushes = [];
			this.feedback = [];
		} catch (err) {
			Log.info("MockDataStore::<init> - ERROR: " + err);
		}
	}

	/**
	 * Gets the push event record for a given commitURL
	 */
	public async getPushRecord(commitURL: string): Promise<CommitTarget | null> {
		// Log.info("MockDataStore::getPushRecord(..) - start");
		try {
			const start = Date.now();
			// read
			// const outRecords: CommitTarget[] = await fs.readJSON(this.PUSH_PATH);
			const outRecords: CommitTarget[] = this.pushes; // await fs.readJSON(this.PUSH_PATH);

			// find and return
			const candidates = [];
			for (const record of outRecords) {
				if (record !== null && typeof record.commitURL !== "undefined" && record.commitURL === commitURL) {
					Log.info("MockDataStore::getPushRecord(..) - found; took: " + Util.took(start));
					candidates.push(record);
				}
			}
			if (candidates.length === 0) {
				Log.info("MockDataStore::getPushRecord(..) - not found; took: " + Util.took(start));
				return null;
			} else if (candidates.length === 1) {
				Log.info("MockDataStore::getPushRecord(..) - one found; took: " + Util.took(start));
				return candidates[0];
			} else {
				for (const c of candidates) {
					if (c.ref === "refs/heads/main" || c.ref === "refs/heads/master") {
						Log.info("MockDataStore::getPushRecord(..) - multiple found, main/master chosen; took: " + Util.took(start));
						return c;
					}
				}
			}

			// not found
			Log.info("MockDataStore::getPushRecord(..) - not found; took: " + Util.took(start));
		} catch (err) {
			Log.error("MockDataStore::getPushRecord(..) - ERROR: " + err);
		}
		return null;
	}

	public async savePush(info: CommitTarget): Promise<void> {
		Log.info(
			"MockDataStore::savePush(..) - repo: " + info.repoId + "; deliv: " + info.delivId + "; sha: " + Util.shaHuman(info.commitSHA)
		);

		try {
			const start = Date.now();
			// read
			// const records = await fs.readJSON(this.PUSH_PATH);
			const records = this.pushes; // await fs.readJSON(this.PUSH_PATH);
			// append
			records.push(info);
			// write
			// await fs.writeJSON(this.PUSH_PATH, records);
			Log.info("MockDataStore::savePush(..) - done; #: " + records.length + "; took: " + Util.took(start));
		} catch (err) {
			Log.error("MockDataStore::savePush(..) - ERROR: " + err);
		}
	}

	public async saveComment(info: CommitTarget): Promise<void> {
		Log.info(
			"MockDataStore::saveComment(..) - repo: " + info.repoId + "; deliv: " + info.delivId + "; sha: " + Util.shaHuman(info.commitSHA)
		);

		try {
			const start = Date.now();

			// read
			// const records = await fs.readJSON(this.COMMENT_PATH);
			// const records = this.comments; //await fs.readJSON(this.COMMENT_PATH);
			// append
			// records.push(info);
			this.comments.push(info);
			// write
			// await fs.writeJSON(this.COMMENT_PATH, records);

			Log.info("MockDataStore::saveComment(..) - done; took: " + Util.took(start));
		} catch (err) {
			Log.error("MockDataStore::saveComment(..) - ERROR: " + err);
		}
	}

	public async getCommentRecord(commitURL: string, delivId: string, kind: string): Promise<CommitTarget | null> {
		// Log.info("MockDataStore::getCommentRecord(..) - start");
		try {
			const start = Date.now();
			// read
			// const outRecords: CommitTarget[] = await fs.readJSON(this.COMMENT_PATH);
			const outRecords: CommitTarget[] = this.comments; // await fs.readJSON(this.COMMENT_PATH);

			// find and return
			for (const record of outRecords) {
				if (
					record !== null &&
					typeof record.commitURL !== "undefined" &&
					record.commitURL === commitURL &&
					record.delivId === delivId &&
					record.kind === kind
				) {
					Log.info("MockDataStore::getCommentRecord(..) - found; took: " + Util.took(start));
					return record;
				}
			}

			// not found
			Log.info("MockDataStore::getCommentRecord(..) - not found; took: " + Util.took(start));
		} catch (err) {
			Log.error("MockDataStore::getCommentRecord(..) - ERROR: " + err);
		}
		return null;
	}

	public async saveResult(outputInfo: AutoTestResult): Promise<void> {
		Log.info(
			"MockDataStore::saveResult(..) - repo: " +
				outputInfo.repoId +
				"; deliv: " +
				outputInfo.delivId +
				"; sha: " +
				Util.shaHuman(outputInfo.commitSHA)
		);

		try {
			const start = Date.now();
			// read
			// const outRecords = await fs.readJSON(this.RECORD_PATH);
			// const outRecords = this.records; // await fs.readJSON(this.RECORD_PATH);
			// append
			// outRecords.push(outputInfo);
			this.results.push(outputInfo);
			// write
			// await fs.writeJSON(this.RECORD_PATH, outRecords);

			Log.info("MockDataStore::saveResult(..) - done; took: " + Util.took(start));
		} catch (err) {
			Log.error("MockDataStore::saveResult(..) - ERROR: " + err);
		}
	}

	public async getResult(delivId: string, repoId: string): Promise<AutoTestResult | null> {
		Log.info("MockDataStore::getResult(..) - start");
		try {
			const start = Date.now();

			// read
			// const outRecords: AutoTestResult[] = await fs.readJSON(this.RECORD_PATH);
			const outRecords: AutoTestResult[] = this.results;
			Log.info("MockDataStore::getResult(..) - # records: " + outRecords.length);
			// find and return
			for (const record of outRecords) {
				if (record !== null && typeof record.delivId !== "undefined" && record.delivId === delivId && record.repoId === repoId) {
					Log.info("MockDataStore::getResult(..) - found; took: " + Util.took(start));
					return record;
				}
			}
			// not found
			Log.info("MockDataStore::getResult(..) - not found; took: " + Util.took(start));
		} catch (err) {
			Log.error("MockDataStore::getResult(..) - ERROR: " + err);
		}
		return null;
	}

	public async saveFeedbackGivenRecord(info: IFeedbackGiven): Promise<void> {
		Log.info("MockDataStore::saveFeedbackGivenRecord(..) - start" + "; deliv: " + info.delivId + "; commit: " + info.commitURL);

		try {
			const start = Date.now();
			// read
			// const records = await fs.readJSON(this.FEEDBACK_PATH);
			// const records = this.feedback; // await fs.readJSON(this.FEEDBACK_PATH);
			// append
			// records.push(info);
			this.feedback.push(info);
			// write
			// await fs.writeJSON(this.FEEDBACK_PATH, records);

			Log.info("MockDataStore::saveFeedbackGivenRecord(..) - done; took: " + Util.took(start));
		} catch (err) {
			Log.error("MockDataStore::saveFeedbackGivenRecord(..) - ERROR: " + err);
		}
	}

	public async getLatestFeedbackGivenRecord(delivId: string, userName: string, kind: string): Promise<IFeedbackGiven | null> {
		// Log.trace("MockDataStore::getLatestFeedbackGivenRecord(..) - start");
		let ret: IFeedbackGiven | null = null;
		try {
			const start = Date.now();
			// const records: IFeedbackGiven[] = await fs.readJSON(this.FEEDBACK_PATH);
			const records: IFeedbackGiven[] = this.feedback;
			const shortList: IFeedbackGiven[] = [];
			for (const req of records) {
				if (req !== null && req.delivId === delivId && req.personId === userName && req.kind === kind) {
					shortList.push(req);
				}
			}

			if (shortList.length === 0) {
				Log.info("MockDataStore::getLatestFeedbackGivenRecord(..) - not found; took: " + Util.took(start));
				ret = null;
			} else {
				Math.max.apply(
					Math,
					shortList.map(function (o: IFeedbackGiven) {
						Log.info("MockDataStore::getLatestFeedbackGivenRecord(..) - found; took: " + Util.took(start));
						ret = o;
					})
				);
			}
		} catch (err) {
			Log.error("MockDataStore::getLatestFeedbackGivenRecord(..) - ERROR: " + err);
			ret = null;
		}
		return ret;
	}

	public async getFeedbackGivenRecordForCommit(target: CommitTarget): Promise<IFeedbackGiven | null> {
		// Log.trace("MockDataStore::getFeedbackGivenRecordForCommit(..) - start");
		Log.info(
			"MockDataStore::getFeedbackGivenRecordForCommit(..) - repo: " +
				target.repoId +
				"; deliv: " +
				target.delivId +
				"; sha: " +
				Util.shaHuman(target.commitSHA)
		);

		let ret: IFeedbackGiven | null = null;
		try {
			const commitURL = target.commitURL;
			const delivId = target.delivId;
			const userName = target.personId;

			const start = Date.now();
			// const records: IFeedbackGiven[] = await fs.readJSON(this.FEEDBACK_PATH);
			const records: IFeedbackGiven[] = this.feedback;
			for (const feedback of records) {
				if (
					feedback !== null &&
					feedback.commitURL === commitURL &&
					feedback.personId === userName &&
					feedback.delivId === delivId
				) {
					Log.info("MockDataStore::getFeedbackGivenRecordForCommit(..) - found; took: " + Util.took(start));
					ret = feedback;
					break;
				}
			}
			if (ret === null) {
				Log.info("MockDataStore::getFeedbackGivenRecordForCommit(..) - not found; took: " + Util.took(start));
			}
		} catch (err) {
			Log.error("MockDataStore::getFeedbackGivenRecordForCommit(..) - ERROR: " + err);
			ret = null;
		}
		return ret;
	}

	public async getAllData(): Promise<{
		records: AutoTestResult[];
		comments: CommitTarget[];
		pushes: CommitTarget[];
		feedback: IFeedbackGiven[];
	}> {
		Log.info("MockDataStore::getAllData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");

		try {
			Log.info("MockDataStore::getAllData() - before records");
			// const records: AutoTestResult[] = await fs.readJSON(this.RECORD_PATH);
			const records: AutoTestResult[] = this.results;
			Log.info("MockDataStore::getAllData() - # results: " + records.length);
			// const comments: CommitTarget[] = await fs.readJSON(this.COMMENT_PATH);
			const comments: CommitTarget[] = this.comments;
			Log.info("MockDataStore::getAllData() - # comments: " + comments.length);
			// const pushes: CommitTarget[] = await fs.readJSON(this.PUSH_PATH);
			const pushes: CommitTarget[] = this.pushes;
			Log.info("MockDataStore::getAllData() -  # pushes: " + pushes.length);
			// const feedback: IFeedbackGiven[] = await fs.readJSON(this.FEEDBACK_PATH);
			const feedback: IFeedbackGiven[] = this.feedback;
			Log.info("MockDataStore::getAllData() - # feedback: " + feedback.length);
			return { records, comments, pushes, feedback };
		} catch (err) {
			throw new Error("MockDataStore::getAllData() - error populating data: " + err.message);
		}
	}

	public clearData(): Promise<void> {
		Log.warn("MockDataStore::clearData() - start (WARNING: ONLY USE THIS FOR DEBUGGING!)");
		const testname = Config.getInstance().getProp(ConfigKey.testname);
		if (Config.getInstance().getProp(ConfigKey.name) === testname) {
			// do it
			// fs.removeSync(this.RECORD_PATH);
			// fs.removeSync(this.COMMENT_PATH);
			// fs.removeSync(this.PUSH_PATH);
			// fs.removeSync(this.FEEDBACK_PATH);
			//
			// if (!fs.existsSync(this.RECORD_PATH)) {
			//     fs.writeJSONSync(this.RECORD_PATH, []);
			// }
			// if (!fs.existsSync(this.COMMENT_PATH)) {
			//     fs.writeJSONSync(this.COMMENT_PATH, []);
			// }
			// if (!fs.existsSync(this.PUSH_PATH)) {
			//     fs.writeJSONSync(this.PUSH_PATH, []);
			// }
			// if (!fs.existsSync(this.FEEDBACK_PATH)) {
			//     fs.writeJSONSync(this.FEEDBACK_PATH, []);
			// }

			this.results = [];
			this.comments = [];
			this.pushes = [];
			this.feedback = [];
			Log.info("MockDataStore::clearData() - all data files removed");
		} else {
			throw new Error("MockDataStore::clearData() - can only be called on test configurations");
		}
		return Promise.resolve();
	}
}
