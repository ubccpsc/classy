import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import * as http from "http";
import type { AddressInfo } from "net";

/**
 * A stand-in for GitHub's OAuth and user endpoints, for the /authCallback flow.
 *
 * AuthRoutes.performAuthCallback makes two external calls -- it exchanges the code for a token at
 * `githubHost/login/oauth/access_token`, then reads `githubAPI/user` to learn the username -- so
 * without something listening only its failure path can run. That left the whole of the login flow
 * untested, including the `person.kind = null` reset that the rest of Classy depends on.
 *
 * NOTE: binds an ephemeral port on loopback and points Classy's config at it for the duration of the
 * test, rather than assuming GH_HOST/GH_API name something reachable. That is what makes it work the
 * same on a dev machine and on CI, and it cannot collide with a real service. Same approach as
 * StubAutoTestService.
 */
export class StubGitHubService {
	/**
	 * The login returned by GET /user. Tests set this to choose which person is logging in.
	 */
	public login = "unset";

	/**
	 * Set false to make the token exchange fail, which is what an expired or replayed code looks
	 * like to Classy.
	 */
	public tokenExchangeSucceeds = true;

	public readonly accessToken = "stub-access-token";

	public readonly requests: Array<{ method: string; url: string }> = [];

	private server: http.Server = null;
	private realHost: string = null;
	private realApi: string = null;

	public async start(): Promise<void> {
		this.server = http.createServer((req, res) => {
			// the body is never inspected here, but it still has to be consumed or "end" never fires
			req.resume();
			req.on("end", () => {
				this.requests.push({ method: req.method, url: req.url });
				Log.test("StubGitHubService - " + req.method + " " + req.url);

				if (req.url.indexOf("/login/oauth/access_token") === 0) {
					if (this.tokenExchangeSucceeds === false) {
						// GitHub answers 200 with an error body for a bad code; client-oauth2 turns
						// that into a rejection, which is the path Classy reports as a failed login
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ error: "bad_verification_code", error_description: "The code is incorrect or expired." }));
						return;
					}
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ access_token: this.accessToken, token_type: "bearer", scope: "" }));
					return;
				}

				if (req.url.indexOf("/user") === 0) {
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ login: this.login }));
					return;
				}

				res.writeHead(404, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ message: "unexpected path: " + req.url }));
			});
		});

		await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
		const port = (this.server.address() as AddressInfo).port;
		const base = "http://127.0.0.1:" + port;

		const config = Config.getInstance();
		this.realHost = config.getProp(ConfigKey.githubHost);
		this.realApi = config.getProp(ConfigKey.githubAPI);
		config.setProp(ConfigKey.githubHost, base);
		config.setProp(ConfigKey.githubAPI, base);
		Log.test("StubGitHubService - listening on " + base);
	}

	public async stop(): Promise<void> {
		const config = Config.getInstance();
		config.setProp(ConfigKey.githubHost, this.realHost);
		config.setProp(ConfigKey.githubAPI, this.realApi);

		if (this.server !== null) {
			await new Promise<void>((resolve) => this.server.close(() => resolve()));
			this.server = null;
		}
	}

	public reset(): void {
		this.requests.length = 0;
		this.tokenExchangeSucceeds = true;
		this.login = "unset";
	}
}
