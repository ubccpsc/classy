import { expect } from "chai";
import "mocha";

import { Command } from "@common/commands/Command";

import "@common/GlobalSpec"; // load first

describe("Command", function () {
	// Regression: executeCommand rejected with a [code, out] tuple, so every catcher that read
	// err.message got "undefined" -- GradingJob::prepare logged "ERROR: undefined" for a failed clone.
	it("Should reject a failing command with an Error that has a message and the exit code.", async function () {
		let caught: any = null;
		try {
			await new Command("false").executeCommand([]);
		} catch (err) {
			caught = err;
		}

		expect(caught).to.be.instanceOf(Error);
		expect(caught.message, "a real message, not undefined").to.be.a("string").and.not.equal("undefined");
		expect(caught.message).to.contain("false");
		expect(caught.code).to.equal(1);
	});

	it("Should still resolve a succeeding command to the [code, output] tuple.", async function () {
		const [code, out] = await new Command("echo").executeCommand(["hello"]);

		expect(code).to.equal(0);
		expect(out).to.equal("hello");
	});
});
