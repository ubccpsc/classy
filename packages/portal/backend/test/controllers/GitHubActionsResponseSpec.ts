import { expect } from "chai";
import "mocha";

import { GitHubActions, GitHubError } from "@backend/controllers/GitHubActions";
import Log from "@common/Log";
import { TestHarness } from "@common/TestHarness";
import { Response } from "node-fetch";

import "@common/GlobalSpec"; // load first

/**
 * What GitHubActions makes of the HTTP answers it gets, with the transport stubbed. No GitHub:
 * the point is the interpretation, and the case that matters cannot be produced on demand from
 * a real host (it is what an off-VPN machine sees: a login page, 200 text/html, for every URL).
 */
describe("GitHubActions response handling", function () {
	before(async function () {
		await TestHarness.suiteBefore("GitHubActions response handling");
	});

	after(function () {
		TestHarness.suiteAfter("GitHubActions response handling");
	});

	function answering(status: number, contentType: string, body: string): GitHubActions {
		// forceReal: the mock has no transport to stub. Nothing is sent; fetchWithRetry is replaced.
		const gha = GitHubActions.getInstance(true) as GitHubActions;
		(gha as any).fetchWithRetry = async () => new Response(body, { status: status, headers: { "content-type": contentType } });
		return gha;
	}

	it("Should report a repo as present on a JSON 200", async function () {
		const gha = answering(200, "application/json; charset=utf-8", '{"id": 1, "name": "someRepo"}');
		expect(await gha.repoExists("someRepo")).to.be.true;
	});

	it("Should report a repo as absent on a 404", async function () {
		const gha = answering(404, "application/json; charset=utf-8", '{"message":"Not Found"}');
		expect(await gha.repoExists("someRepo")).to.be.false;
	});

	it("Should not mistake a 200 web page for an existing repo", async function () {
		// used to return true here, so provisioning thought every planned repo was already on GitHub
		const gha = answering(200, "text/html; charset=utf-8", "<!DOCTYPE html><html><head><title>Sign in</title></head></html>");

		let caught: GitHubError = null;
		try {
			await gha.repoExists("someRepo");
		} catch (err) {
			caught = err;
		}
		Log.test("thrown: " + caught?.message);

		expect(caught, "a non-JSON answer must not be taken as an answer").to.be.instanceOf(GitHubError);
		expect(caught.message).to.contain("text/html");
		expect(caught.fatal, "every other call will get the same page, so the run should stop").to.be.true;
	});
});
