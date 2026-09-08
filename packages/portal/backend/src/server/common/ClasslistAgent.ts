import { JobContext } from "@backend/controllers/JobController";
import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { ClasslistChangesTransport, ClasslistTransport, PersonTransport } from "@common/types/PortalTypes";
import Util from "@common/Util";

import fetch from "node-fetch";

import { DatabaseController } from "../../controllers/DatabaseController";
import { PersonController } from "../../controllers/PersonController";
import { AuditLabel, Person, PersonKind } from "../../Types";
import { CSVParser } from "./CSVParser";

export class ClasslistAgent {
	private pc = new PersonController();
	private db = DatabaseController.getInstance();

	public constructor() {
		//
	}

	public async fetchClasslist(): Promise<ClasslistTransport[]> {
		Log.info("ClasslistAgent::fetchClasslist - start");
		try {
			const { uri, headers } = this.getClasslistRequest();
			// NOTE: no custom https.Agent. This used to pass rejectUnauthorized:false, which disabled
			// TLS verification on the one outbound call that carries a shared password. The registrar
			// endpoint presents a publicly-trusted certificate (checked 2026-09-08), so the default
			// agent is correct. If that ever changes, pin its CA with https.Agent({ ca }) rather than
			// turning verification off.
			const res = await fetch(uri, { headers });
			if (res.ok === false) {
				throw new Error("registrar answered HTTP " + res.status);
			}
			// await, not a bare return: `return res.json()` inside try rejects the *caller's* await
			// when the body is not JSON, so this catch -- and its sanitized message -- never ran.
			return await res.json();
		} catch (err) {
			const msg = Config.sanitize(String(err?.message ?? err));
			Log.error("ClasslistAgent::fetchClasslist - ERROR: " + msg);
			throw new Error("Could not fetch Classlist: " + msg);
		}
	}

	/**
	 * Pulls the classlist from the Classlist API and applies it. This job is
	 * not cancellable: the people are written in one Promise.all, so there is
	 * no safe checkpoint to stop at.
	 *
	 * @param personId Person.id of whoever asked; audited by processClasslist
	 * @param ctx when this runs as a job: for progress
	 * @returns {Promise<ClasslistChangesTransport>}
	 */
	public async updateClasslist(personId: string = null, ctx: JobContext = null): Promise<ClasslistChangesTransport> {
		Log.info("ClasslistAgent::updateClasslist( " + personId + " ) - start");

		await ctx?.progress(0, 0, "fetching the classlist");
		const data = await this.fetchClasslist();

		const total = Array.isArray(data) ? data.length : 0;
		await ctx?.progress(0, total, "processing " + total + " records");
		const changes = await this.processClasslist(personId, null, data);

		if (changes.classlist.length === 0) {
			// the old route answered 400 here; as a job this is a failure the UI can show
			throw new Error("Classlist update not successful; no students were processed from classlist service.");
		}

		await ctx?.progress(changes.classlist.length, total, "done");
		Log.info("ClasslistAgent::updateClasslist( " + personId + " ) - done; # students: " + changes.classlist.length);
		return changes;
	}

	public async processClasslist(personId: string = null, path: string = null, data: any): Promise<ClasslistChangesTransport> {
		Log.trace("ClasslistAgent::processClasslist(...) - start");
		const peopleBefore: Person[] = await this.pc.getAllPeople();

		if (path !== null) {
			data = await new CSVParser().parsePath(path);
		}

		this.duplicateDataCheck(data, ["ACCT", "CWL"]);
		this.missingDataCheck(data, ["ACCT", "CWL"]);
		// Validate EVERY row before ANY write. The per-row guard in the loop below used to be the only
		// check for SNUM/LAST/LAB and the name columns, and it ran inside the write loop: one bad row
		// rejected its promise after every other createPerson() had already fired, so the job said
		// FAILED with several hundred people created -- wrong in exactly the direction that causes
		// re-runs. These pre-flights apply the row guard's exact contract up front: the columns must
		// be PRESENT. Empty is allowed (a student with no lab section yet has LAB === ""), which is
		// why this is not missingDataCheck(), whose rule is non-empty.
		this.requiredColumnsCheck(data, ["SNUM", "LAST", "LAB"]);
		this.missingNameCheck(data);
		const peoplePromises: Array<Promise<Person>> = [];

		for (const row of data) {
			// Log.trace(JSON.stringify(row));
			if (
				typeof row.ACCT !== "undefined" &&
				typeof row.CWL !== "undefined" &&
				typeof row.SNUM !== "undefined" &&
				typeof row.LAST !== "undefined" &&
				typeof row.LAB !== "undefined" &&
				(typeof row.FIRST !== "undefined" || typeof row.PREF !== "undefined")
			) {
				const p: Person = {
					id: row.ACCT.toLowerCase(), // id is CSID since this cannot be changed
					csId: row.ACCT.toLowerCase(),
					// github.ugrad.cs wanted row.ACCT; github.students.cs and github.ubc want row.CWL
					githubId: row.CWL.toLowerCase(),
					studentNumber: row.SNUM,
					fName: row.PREF || row.FIRST,
					lName: row.LAST,
					kind: PersonKind.STUDENT,
					URL: null,
					labId: row.LAB,
					custom: {},
				};
				peoplePromises.push(this.pc.createPerson(p));
			} else {
				Log.error("ClasslistAgent::processClasslist(..) - column missing from: " + JSON.stringify(row));
				peoplePromises.push(Promise.reject("Required column missing (required: ACCT, CWL, SNUM, FIRST, LAST, LAB)."));
			}
		}
		const peopleAfter = await Promise.all(peoplePromises);
		const classlistChanges = this.getClasslistChanges(peopleBefore, peopleAfter);

		// audit
		await this.db.writeAudit(AuditLabel.CLASSLIST_UPLOAD, personId, {}, {}, { numPoeple: classlistChanges.classlist.length });

		return classlistChanges;
	}

	/**
	 * The registrar request: the URI plus an Authorization header.
	 *
	 * The credential used to be embedded in the URI as https://user:pass@host. node-fetch puts the
	 * full URL in its error messages ("request to https://user:pass@... failed"), so a bad day at
	 * the registrar wrote the classlist password into the job record and onto the admin screen. A
	 * header is never echoed that way.
	 */
	private getClasslistRequest(): { uri: string; headers: { [key: string]: string } } {
		const config = Config.getInstance();
		const uri = config.getProp(ConfigKey.classlist_uri);
		if (typeof uri !== "string" || uri.indexOf("https://") !== 0) {
			throw new Error("https:// protocol is required for API integration");
		}

		const credential = config.getProp(ConfigKey.classlist_username) + ":" + config.getProp(ConfigKey.classlist_password);
		const headers = {
			Authorization: "Basic " + Buffer.from(credential, "utf8").toString("base64"),
			"User-Agent": "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.0", // for testing
		};
		return { uri, headers };
	}

	/**
	 * Produces a report of student updates:
	 * - new students added, old students removed, student data updated
	 * @param beforePeople A list of students before the Classlist update
	 * @param afterPeople A list of students after the Classlist update
	 */
	private getClasslistChanges(beforePeople: Person[], afterPeople: Person[]): ClasslistChangesTransport {
		Log.info("ClasslistAgent::getClasslistChanges(..) - start");
		const beforeCSIDs = beforePeople.map(function (person) {
			return person.csId;
		});
		const afterCSIDs = afterPeople.map(function (person) {
			return person.csId;
		});
		const classlist: PersonTransport[] = afterPeople.map(function (person) {
			return PersonController.personToTransport(person);
		});

		const changeReport: ClasslistChangesTransport = {
			message: "Successfully uploaded classlist.",
			created: [], // new registrations
			updated: [], // only students whose CWL or lab has changed
			removed: [], // precludes withdrawn students; next step should be to withdraw students who end up appearing here
			classlist, // created from list of people in the classlist upload returned from data layer
		};

		afterPeople.forEach(function (afterPerson) {
			if (beforeCSIDs.indexOf(afterPerson.csId) === -1) {
				const student = PersonController.personToTransport(afterPerson);
				changeReport.created.push(student);
			} else {
				const beforePerson = beforePeople.find(function (befPerson) {
					if (befPerson.csId === afterPerson.csId) {
						return true;
					}
				});
				if (JSON.stringify(afterPerson) !== JSON.stringify(beforePerson)) {
					const student = PersonController.personToTransport(afterPerson);
					changeReport.updated.push(student);
				}
			}
		});

		beforePeople.forEach(function (person) {
			if (afterCSIDs.indexOf(person.csId) === -1 && person.kind === PersonKind.STUDENT) {
				const student = PersonController.personToTransport(person);
				changeReport.removed.push(student);
			}
		});

		const crPrint = Util.clone(changeReport);
		delete crPrint.classlist; // this field is too verbose
		Log.info("ClasslistAgent::getClasslistChanges(..) - results: " + JSON.stringify(crPrint));

		return changeReport;
	}

	private duplicateDataCheck(data: any[], columnNames: string[]) {
		Log.trace("ClasslistAgent::duplicateDataCheck -- start");
		const dupColumnData: any = {};
		columnNames.forEach((column) => {
			Object.assign(dupColumnData, { [column]: this.getDuplicateRowsByColumn(data, column) });
		});
		columnNames.forEach((column) => {
			if (dupColumnData[column].length) {
				Log.error("ClasslistAgent::duplicateDataCheck(..) - ERROR: Duplicate Data Check Error" + JSON.stringify(dupColumnData));
				throw new Error("Duplicate Data Check Error: " + JSON.stringify(dupColumnData));
			}
		});
	}

	private getDuplicateRowsByColumn(data: any[], column: string): any[] {
		Log.trace("ClasslistAgent::getDuplicateRowsByColumn -- start");
		const set = new Set();
		return data.filter((row) => {
			if (set.has(row[column].toLowerCase())) {
				return true;
			}
			set.add(row[column].toLowerCase());
			return false;
		});
	}

	private getMissingDataRowsByColumn(data: any[], column: string): any[] {
		Log.trace("ClasslistAgent::getMissingDataRowsByColumn -- start");
		return data.filter((row) => {
			if (typeof row[column] === "undefined" || row[column] === "") {
				return true;
			}
			return false;
		});
	}

	/** Every row must carry each of these columns (present, not necessarily non-empty). */
	private requiredColumnsCheck(data: any[], columns: string[]) {
		const rows = data.filter((row) => columns.some((column) => typeof row[column] === "undefined"));
		if (rows.length > 0) {
			Log.error("ClasslistAgent::requiredColumnsCheck(..) - ERROR: rows missing one of " + columns.join("/") + ": " + JSON.stringify(rows));
			throw new Error("Required column missing (required: ACCT, CWL, SNUM, FIRST, LAST, LAB).");
		}
	}

	/**
	 * A row needs FIRST or PREF to be present; requiredColumnsCheck() cannot express either-or.
	 * Same message as the row guard used to reject with, so callers see one vocabulary.
	 */
	private missingNameCheck(data: any[]) {
		const rows = data.filter((row) => typeof row.FIRST === "undefined" && typeof row.PREF === "undefined");
		if (rows.length > 0) {
			Log.error("ClasslistAgent::missingNameCheck(..) - ERROR: rows with neither FIRST nor PREF: " + JSON.stringify(rows));
			throw new Error("Required column missing (required: ACCT, CWL, SNUM, FIRST, LAST, LAB).");
		}
	}

	private missingDataCheck(data: any[], columns: string[]) {
		Log.trace("ClasslistAgent::missingDataCheck -- start");
		const missingData: any = {};
		columns.forEach((column) => {
			Object.assign(missingData, { [column]: this.getMissingDataRowsByColumn(data, column) });
		});
		columns.forEach((column) => {
			if (missingData[column].length) {
				Log.error("ClasslistAgent::missingDataCheck(..) - ERROR: Certain fields cannot be empty: " + JSON.stringify(missingData));
				throw new Error("Certain fields cannot be empty: " + JSON.stringify(missingData));
			}
		});
	}
}
