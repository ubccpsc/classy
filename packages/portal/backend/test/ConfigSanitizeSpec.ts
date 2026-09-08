import { expect } from "chai";
import "mocha";

import Config, { ConfigKey } from "@common/Config";

import "@common/GlobalSpec"; // load first

describe("Config.sanitize", function () {
	// Only the two keys added on 2026-09-08 are set here. githubBotToken is deliberately left
	// alone: it comes from .env and the GitHub-backed suites depend on its real value.
	const DOCKER = ConfigKey.githubDockerToken;
	const CLASSLIST = ConfigKey.classlist_password;
	let savedDocker: string;
	let savedClasslist: string;

	before(function () {
		const c = Config.getInstance();
		savedDocker = c.hasProp(DOCKER) ? c.getProp(DOCKER) : "";
		savedClasslist = c.hasProp(CLASSLIST) ? c.getProp(CLASSLIST) : "";
	});

	after(function () {
		const c = Config.getInstance();
		c.setProp(DOCKER, savedDocker);
		c.setProp(CLASSLIST, savedClasslist);
	});

	it("Should redact the Docker build token.", function () {
		Config.getInstance().setProp(DOCKER, "ghp_dockerTOKEN0123456789");
		const out = Config.sanitize("error fetching: fatal: could not read Password for 'https://ghp_dockerTOKEN0123456789@github.com'");

		expect(out).to.not.contain("ghp_dockerTOKEN0123456789");
		expect(out).to.contain("ghp_-xxxxxx");
	});

	it("Should redact the classlist password.", function () {
		Config.getInstance().setProp(CLASSLIST, "registrarSecret!99");
		const out = Config.sanitize("request to https://svc:registrarSecret!99@www.cs.ubc.ca failed");

		expect(out).to.not.contain("registrarSecret!99");
		expect(out).to.contain("regi-xxxxxx");
	});

	it("Should redact a secret that contains regex metacharacters.", function () {
		// the old implementation handed the raw value to RegExp, so "a+b.c$" would not match itself
		Config.getInstance().setProp(DOCKER, "tok+en.with$meta(chars)");
		const out = Config.sanitize("url: https://tok+en.with$meta(chars)@host/x -- and again tok+en.with$meta(chars)");

		expect(out).to.not.contain("tok+en.with$meta(chars)");
		expect(out.match(/tok\+-xxxxxx/g), "both occurrences replaced").to.have.lengthOf(2);
	});

	it("Should leave input alone when a secret is empty or very short.", function () {
		// an empty value would otherwise match at every position and shred the string
		Config.getInstance().setProp(DOCKER, "");
		Config.getInstance().setProp(CLASSLIST, "abc");
		const input = "nothing sensitive here, abc included";

		expect(Config.sanitize(input)).to.equal(input);
	});
});
