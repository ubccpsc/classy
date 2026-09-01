import { expect } from "chai";
import "mocha";

import { GitHubError } from "@backend/controllers/GitHubActions";
import { ProvisionAbortedError, ProvisionFailurePolicy } from "@backend/controllers/ProvisionFailurePolicy";
import Log from "@common/Log";

import "@common/GlobalSpec"; // load first

/**
 * When a provisioning run should give up.
 *
 * NOTE: no GitHub, no database -- this is the policy itself. Getting it wrong is expensive in both
 * directions: too eager and a run that would mostly have worked is abandoned; too patient and 450
 * doomed attempts take twenty minutes to tell you the token expired.
 */
describe("ProvisionFailurePolicy", function () {
	describe("classifying a GitHub failure", function () {
		const fatal: Array<[number, string, string]> = [
			[401, "", "an expired or revoked token"],
			[200, '{"message":"Bad credentials"}', "a body GitHub returns with several statuses"],
			[403, '{"message":"API rate limit exceeded"}', "the rate limit"],
			[403, '{"message":"You have exceeded a secondary rate limit; please wait"}', "a secondary rate limit"],
			[0, "getaddrinfo ENOTFOUND github.students.cs.ubc.ca", "an unreachable host"],
		];

		for (const [status, body, why] of fatal) {
			it("Should treat " + why + " as fatal.", function () {
				expect(GitHubError.isFatal(status, body), why).to.be.true;
			});
		}

		const survivable: Array<[number, string, string]> = [
			[404, '{"message":"Not Found"}', "one repo that does not exist"],
			[422, '{"message":"Repository creation failed"}', "one repo GitHub would not create"],
			[500, "", "GitHub having a bad minute"],
			[403, '{"message":"Resource not accessible"}', "a permission problem on one resource"],
		];

		for (const [status, body, why] of survivable) {
			it("Should not treat " + why + " as fatal.", function () {
				expect(GitHubError.isFatal(status, body), why).to.be.false;
			});
		}

		it("Should carry the status on the error it throws.", function () {
			const err = new GitHubError("GitHub returned 401", 401, '{"message":"Bad credentials"}');
			expect(err.status).to.equal(401);
			expect(err.fatal).to.be.true;
			expect(err.message).to.contain("401");
		});
	});

	describe("deciding when to stop", function () {
		it("Should keep going while failures are occasional.", function () {
			const policy = new ProvisionFailurePolicy("spec");
			for (let i = 0; i < 19; i++) {
				policy.recordSuccess();
			}
			expect(policy.recordFailure(null), "1 in 20 is not a broken run").to.be.null;
		});

		it("Should stop immediately on a fatal failure.", function () {
			const policy = new ProvisionFailurePolicy("spec");
			policy.recordSuccess(); // even after a success

			const reason = policy.recordFailure(new GitHubError("nope", 401));
			Log.test("reason: " + reason);
			expect(reason).to.not.be.null;
			expect(reason).to.contain("fatally");
		});

		it("Should stop when the first three attempts all fail.", function () {
			const policy = new ProvisionFailurePolicy("spec");
			expect(policy.recordFailure(null), "one failure is not a pattern").to.be.null;
			expect(policy.recordFailure(null), "two is not either").to.be.null;

			const reason = policy.recordFailure(null);
			Log.test("reason: " + reason);
			expect(reason).to.contain("first 3");
		});

		it("Should not apply the startup rule once something has worked.", function () {
			// a deliverable where the first few repos are stale leftovers is not a broken run
			const policy = new ProvisionFailurePolicy("spec");
			policy.recordSuccess();
			expect(policy.recordFailure(null)).to.be.null;
			expect(policy.recordFailure(null)).to.be.null;
			expect(policy.recordFailure(null)).to.be.null;
		});

		it("Should wait for a meaningful sample before using the failure rate.", function () {
			// 18 of 19 failed, but the startup rule cannot fire (there was a success) and the rate
			// rule will not fire below the minimum sample
			const policy = new ProvisionFailurePolicy("spec");
			policy.recordSuccess();
			let reason: string = null;
			for (let i = 0; i < 18; i++) {
				reason = policy.recordFailure(null);
			}
			expect(reason, "19 completions is below the minimum sample").to.be.null;
		});

		it("Should stop above a 20% failure rate.", function () {
			const policy = new ProvisionFailurePolicy("spec");
			for (let i = 0; i < 16; i++) {
				policy.recordSuccess();
			}
			expect(policy.recordFailure(null)).to.be.null; // 1/17
			expect(policy.recordFailure(null)).to.be.null; // 2/18
			expect(policy.recordFailure(null)).to.be.null; // 3/19, still below the sample
			expect(policy.recordFailure(null), "4 of 20 is exactly 20%, which is allowed").to.be.null;

			const reason = policy.recordFailure(null); // 5 of 21
			Log.test("reason: " + reason);
			expect(reason).to.contain("of 21 failed");
		});

		it("Should carry the partial summary when it aborts.", function () {
			const policy = new ProvisionFailurePolicy("provisioning");
			let caught: ProvisionAbortedError = null;
			try {
				policy.abort("everything is on fire", { provisioned: 37 });
			} catch (err) {
				caught = err;
			}

			// the summary is what lets a failed job still report "37 of 450 provisioned"
			expect(caught).to.be.instanceOf(ProvisionAbortedError);
			expect(caught.summary.provisioned).to.equal(37);
			expect(caught.message).to.contain("provisioning stopped early");
		});
	});
});
