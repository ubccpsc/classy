import * as path from "node:path";

import AdmZip = require("adm-zip");

import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import { HandbackTransport, HandbackUploadSummary } from "@common/types/PortalTypes";
import Util from "@common/Util";
import * as fs from "fs-extra";

import { AuditLabel, Handback, Person } from "../Types";
import { DatabaseController } from "./DatabaseController";

/**
 * Files handed back to individual students: a marked midterm, a code review, anything course
 * staff want one student (and only that student) to be able to download from the portal.
 *
 * Files live under <persistDir>/handbacks/<delivId>/<personId>/<fileName>. That is beside the
 * AutoTest runs directory, not inside it, so the cron job that archives old runs leaves them
 * alone. A Handback record per file is what the student page lists and what access is checked
 * against; the person is always resolved from the caller's identity, never from the URL, which is
 * what makes a predictable file name safe.
 *
 * Uploads are matched to students by CSID: a zip whose entries are named <csid>.pdf (or
 * <csid>_anything.pdf), which is what a marking tool's per-student export looks like, or a single
 * file for one named student.
 */
export class HandbackController {
	/**
	 * Separators allowed between the CSID and the rest of an uploaded file's name.
	 */
	private static readonly CSID_SEPARATORS = ["_", "-", "."];

	private readonly dbc = DatabaseController.getInstance();

	public static rootDir(): string {
		return Config.getInstance().getProp(ConfigKey.persistDir) + "/handbacks";
	}

	/**
	 * Where a handback is on disk. Every component has been sanitised before it gets here: the
	 * deliverable and person are looked up, and the file name came through safeFileName.
	 */
	public static pathFor(handback: { delivId: string; personId: string; fileName: string }): string {
		return path.join(HandbackController.rootDir(), handback.delivId, handback.personId, handback.fileName);
	}

	/**
	 * Reduces an uploaded name to a base name that is safe to put on disk, or null if nothing
	 * usable is left. Directory components are dropped (a zip entry may carry a folder), and
	 * anything outside a conservative character set is replaced.
	 */
	public static safeFileName(name: string): string | null {
		if (typeof name !== "string") {
			return null;
		}
		const base = name.split(/[\\/]/).pop() ?? "";
		const safe = base.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "");
		if (safe.length === 0 || safe.length > 200) {
			return null;
		}
		return safe;
	}

	/**
	 * The CSID an uploaded file name is for: the name up to the extension, or up to the first
	 * separator, whichever comes first. "a1b2c.pdf", "a1b2c_midterm.pdf" and "A1B2C-v2.pdf" all
	 * name a1b2c. Compared case-insensitively since marking tools are not consistent about it.
	 */
	public static csIdFromFileName(fileName: string): string {
		let stem = fileName;
		const dot = stem.indexOf(".");
		if (dot > 0) {
			stem = stem.substring(0, dot);
		}
		for (const sep of HandbackController.CSID_SEPARATORS) {
			const at = stem.indexOf(sep);
			if (at > 0) {
				stem = stem.substring(0, at);
			}
		}
		return stem.toLowerCase();
	}

	public async getHandbacksForPerson(personId: string): Promise<Handback[]> {
		const records = await this.dbc.getHandbacksForPerson(personId);
		return HandbackController.sorted(records);
	}

	public async getHandbacksForDeliverable(delivId: string): Promise<Handback[]> {
		const records = await this.dbc.getHandbacksForDeliverable(delivId);
		return HandbackController.sorted(records);
	}

	public async getHandback(delivId: string, personId: string, fileName: string): Promise<Handback | null> {
		return await this.dbc.getHandback(delivId, personId, fileName);
	}

	/**
	 * Stores one file for one student, replacing a previous file of the same name.
	 *
	 * @param delivId
	 * @param person
	 * @param fileName the name the student will see; sanitised here
	 * @param srcPath where the uploaded bytes are
	 * @param uploadedBy Person.id of the staff member
	 * @returns {Promise<{ handback: Handback; replaced: boolean }>}
	 */
	public async store(
		delivId: string,
		person: Person,
		fileName: string,
		srcPath: string,
		uploadedBy: string
	): Promise<{ handback: Handback; replaced: boolean }> {
		const safe = HandbackController.safeFileName(fileName);
		if (safe === null) {
			throw new Error("Unusable file name: " + fileName);
		}
		const handback: Handback = {
			personId: person.id,
			delivId: delivId,
			fileName: safe,
			size: fs.statSync(srcPath).size,
			uploadedBy: uploadedBy,
			timestamp: Date.now(),
		};
		const dest = HandbackController.pathFor(handback);
		const replaced = fs.existsSync(dest);
		fs.ensureDirSync(path.dirname(dest));
		fs.copySync(srcPath, dest, { overwrite: true });
		await this.dbc.writeHandback(handback);
		Log.info("HandbackController::store( " + delivId + ", " + person.id + ", " + safe + " ) - stored; replaced: " + replaced);
		return { handback: handback, replaced: replaced };
	}

	/**
	 * Stores every file in a zip for the student its name identifies. Entries that match no
	 * student are reported, not stored; a partial import is still an import, since re-uploading
	 * the same zip simply replaces what was stored the first time.
	 */
	public async importZip(delivId: string, zipPath: string, uploadedBy: string): Promise<HandbackUploadSummary> {
		const start = Date.now();
		Log.info("HandbackController::importZip( " + delivId + " ) - start");
		const summary: HandbackUploadSummary = { delivId: delivId, stored: [], replaced: [], unmatched: [], skipped: [] };

		const byCsId = await this.peopleByCsId();
		const zip = new AdmZip(zipPath);
		fs.ensureDirSync(HandbackController.rootDir());
		const scratch = fs.mkdtempSync(path.join(HandbackController.rootDir(), ".import-"));
		try {
			for (const entry of zip.getEntries()) {
				if (entry.isDirectory === true) {
					continue;
				}
				const safe = HandbackController.safeFileName(entry.entryName);
				// marking tools put per-student files in a folder; __MACOSX and dotfiles are noise
				if (safe === null || entry.entryName.indexOf("__MACOSX") >= 0 || safe.startsWith("._")) {
					summary.skipped.push(entry.entryName);
					continue;
				}
				const person = byCsId[HandbackController.csIdFromFileName(safe)];
				if (typeof person === "undefined") {
					summary.unmatched.push(safe);
					continue;
				}
				const tmp = path.join(scratch, safe);
				fs.writeFileSync(tmp, entry.getData());
				const result = await this.store(delivId, person, safe, tmp, uploadedBy);
				summary.stored.push({ csId: person.csId, fileName: result.handback.fileName });
				if (result.replaced === true) {
					summary.replaced.push(result.handback.fileName);
				}
			}
		} finally {
			fs.removeSync(scratch);
		}

		await this.dbc.writeAudit(
			AuditLabel.HANDBACK_UPLOAD,
			uploadedBy,
			{},
			{},
			{
				delivId: delivId,
				stored: summary.stored.length,
				replaced: summary.replaced.length,
				unmatched: summary.unmatched,
				skipped: summary.skipped,
			}
		);
		Log.info(
			"HandbackController::importZip( " +
				delivId +
				" ) - done; stored: " +
				summary.stored.length +
				"; unmatched: " +
				summary.unmatched.length +
				"; skipped: " +
				summary.skipped.length +
				"; took: " +
				Util.took(start)
		);
		return summary;
	}

	/**
	 * Stores one uploaded file for the student with this CSID.
	 */
	public async importSingle(
		delivId: string,
		csId: string,
		fileName: string,
		srcPath: string,
		uploadedBy: string
	): Promise<HandbackUploadSummary> {
		const summary: HandbackUploadSummary = { delivId: delivId, stored: [], replaced: [], unmatched: [], skipped: [] };
		const byCsId = await this.peopleByCsId();
		const person = byCsId[(csId ?? "").trim().toLowerCase()];
		if (typeof person === "undefined") {
			throw new Error("No student with CSID: " + csId);
		}
		const result = await this.store(delivId, person, fileName, srcPath, uploadedBy);
		summary.stored.push({ csId: person.csId, fileName: result.handback.fileName });
		if (result.replaced === true) {
			summary.replaced.push(result.handback.fileName);
		}
		await this.dbc.writeAudit(
			AuditLabel.HANDBACK_UPLOAD,
			uploadedBy,
			{},
			{},
			{
				delivId: delivId,
				personId: person.id,
				fileName: result.handback.fileName,
				replaced: result.replaced,
			}
		);
		return summary;
	}

	public async remove(handback: Handback, removedBy: string): Promise<boolean> {
		const file = HandbackController.pathFor(handback);
		if (fs.existsSync(file)) {
			fs.removeSync(file);
		}
		const ok = await this.dbc.deleteHandback(handback);
		await this.dbc.writeAudit(AuditLabel.HANDBACK_DELETE, removedBy, handback, {}, {});
		Log.info("HandbackController::remove( " + handback.delivId + ", " + handback.personId + ", " + handback.fileName + " ) - done: " + ok);
		return ok;
	}

	/**
	 * @param handback
	 * @param forAdmin whether the URL should be the admin one (which names the student) or the
	 *                 student's own
	 */
	public static toTransport(handback: Handback, forAdmin: boolean): HandbackTransport {
		const file = encodeURIComponent(handback.fileName);
		const url =
			forAdmin === true
				? "/portal/admin/handback/" + handback.delivId + "/" + encodeURIComponent(handback.personId) + "/" + file
				: "/portal/handback/" + handback.delivId + "/" + file;
		return {
			personId: handback.personId,
			delivId: handback.delivId,
			fileName: handback.fileName,
			size: handback.size,
			timestamp: handback.timestamp,
			URL: url,
		};
	}

	/**
	 * A content type for the download, from the extension. Browsers are told to download rather
	 * than render regardless (Content-Disposition), so this only has to be roughly right.
	 */
	public static contentType(fileName: string): string {
		const ext = (fileName.split(".").pop() ?? "").toLowerCase();
		const known: { [extension: string]: string } = {
			pdf: "application/pdf",
			txt: "text/plain; charset=utf-8",
			md: "text/markdown; charset=utf-8",
			csv: "text/csv; charset=utf-8",
			html: "text/html; charset=utf-8",
			json: "application/json",
			png: "image/png",
			jpg: "image/jpeg",
			jpeg: "image/jpeg",
			zip: "application/zip",
		};
		return known[ext] ?? "application/octet-stream";
	}

	private async peopleByCsId(): Promise<{ [csId: string]: Person }> {
		const byCsId: { [csId: string]: Person } = {};
		for (const person of await this.dbc.getPeople()) {
			if (typeof person.csId === "string" && person.csId.length > 0) {
				byCsId[person.csId.toLowerCase()] = person;
			}
		}
		return byCsId;
	}

	private static sorted(records: Handback[]): Handback[] {
		return records.sort((a, b) => a.delivId.localeCompare(b.delivId) || a.fileName.localeCompare(b.fileName));
	}
}
