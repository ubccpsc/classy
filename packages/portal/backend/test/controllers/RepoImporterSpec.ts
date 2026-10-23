import { expect } from "chai";
import "mocha";

import { RepoImporter } from "@backend/controllers/RepoImporter";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";

import "@common/GlobalSpec"; // load first

/**
 * RepoImporter runs git with the bot token embedded in the remote URL, so a failed command's
 * error message carries the token. The log line inside the importer was redacted, but the error
 * itself was rethrown as-is and logged twice more upstream, unredacted. These tests drive a
 * clone that fails immediately (a closed local port, so no DNS and nothing left behind) and
 * check what escapes.
 */
describe("RepoImporter", function () {
	const bareToken = "ghp_FAKE_TOKEN_FOR_THIS_TEST_0123456789";
	const configToken = "token " + bareToken;
	const unreachable = "https://localhost:1/does-not-exist.git";

	before(async function () {
		await TestHarness.suiteBefore("RepoImporter");
	});

	after(function () {
		TestHarness.suiteAfter("RepoImporter");
	});

	it("Should not leak the token in the error it throws when a git command fails", async function () {
		const importer = new RepoImporter(unreachable, "https://localhost:1/student.git", configToken);

		let err: Error = null;
		try {
			await importer.import();
		} catch (e) {
			err = e;
		}
		Log.test("thrown: " + err?.message);

		expect(err, "the clone cannot succeed, so import() must reject").to.not.be.null;
		expect(err.message, "the failed command should still be named").to.contain("git clone");
		expect(err.message).to.contain("<REDACTED>");
		expect(err.message).to.not.contain(bareToken);
		expect(err.message).to.not.contain(configToken);
	}).timeout(TestHarness.TIMEOUT);
});
