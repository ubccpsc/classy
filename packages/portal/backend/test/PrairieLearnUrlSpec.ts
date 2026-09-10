import { expect } from "chai";
import "mocha";

import Util from "@common/Util";

import "@common/GlobalSpec"; // load first

describe("Util.toInstructorPrairieLearnUrl (instructor PrairieLearn links)", function () {
	// The frontend has no test harness, so the transform the admin Results and Dashboard tabs apply
	// lives in @common/Util and is pinned down here. The stored record is never changed; only what
	// an instructor's table renders.
	const STUDENT = "https://us.prairielearn.com/pl/course_instance/218182/assessment_instance/14694805";
	const INSTRUCTOR = "https://us.prairielearn.com/pl/course_instance/218182/instructor/assessment_instance/14694805";

	it("Should turn a student instance link into the instructor view of the same instance.", function () {
		expect(Util.toInstructorPrairieLearnUrl(STUDENT)).to.equal(INSTRUCTOR);
	});

	it("Should be idempotent: an instructor link stays as it is.", function () {
		expect(Util.toInstructorPrairieLearnUrl(INSTRUCTOR)).to.equal(INSTRUCTOR);
	});

	it("Should leave anything that is not a student instance link alone.", function () {
		const untouched = [
			"https://github.students.cs.ubc.ca/CPSC310-2026W-T1/d0_team999/commit/abe1b0918b872997de4c4d2baf4c263f8d4c6dc2",
			"https://us.prairielearn.com/pl/course_instance/218182/instructor/assessment/12345", // the deliverable link
			"https://us.prairielearn.com/pl/course_instance/218182", // no instance
			"/stdio.html?delivId=d0&repoId=r1&sha=abc",
			"",
		];
		for (const u of untouched) {
			expect(Util.toInstructorPrairieLearnUrl(u), u).to.equal(u);
		}
	});

	it("Should pass null and undefined through rather than throwing.", function () {
		expect(Util.toInstructorPrairieLearnUrl(null)).to.equal(null);
		expect(Util.toInstructorPrairieLearnUrl(undefined)).to.equal(undefined);
	});

	it("Should work for any PrairieLearn host and keep a query string.", function () {
		expect(Util.toInstructorPrairieLearnUrl("https://ca.prairielearn.com/pl/course_instance/7/assessment_instance/8?tab=log")).to.equal(
			"https://ca.prairielearn.com/pl/course_instance/7/instructor/assessment_instance/8?tab=log"
		);
	});
});
