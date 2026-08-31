import Config, { ConfigKey } from "@common/Config";
import Log from "@common/Log";
import * as http from "http";
import type { AddressInfo } from "net";

/**
 * A stand-in for the AutoTest service, for the portal routes that forward to it.
 *
 * Several AutoTestRoutes handlers (the Docker image endpoints, the GitHub webhook) are proxies: they
 * check the caller, then pass the request to AutoTest and hand its answer back. Without something
 * listening, only their failure paths can ever run, which is why those handlers were the least
 * covered code in the backend.
 *
 * NOTE: this binds an ephemeral port on the loopback interface and points Classy's config at it for
 * the duration of the test, rather than assuming AUTOTEST_URL/AUTOTEST_PORT name something reachable.
 * That is what makes it work identically on a dev machine and on CI (where no AutoTest container
 * runs at all), and it cannot collide with a real service or another test run.
 */
export class StubAutoTestService {
	/**
	 * Every request the routes forwarded, in order. Assertions about *what* was proxied go here.
	 */
	public readonly requests: Array<{ method: string; url: string; body: string }> = [];

	/**
	 * What to answer with. Tests change this to exercise the error paths.
	 */
	public status = 200;
	public body: any = {};

	private server: http.Server = null;
	private realUrl: string = null;
	private realPort: string = null;

	public async start(): Promise<void> {
		this.server = http.createServer((req, res) => {
			let raw = "";
			req.on("data", (chunk) => {
				raw += chunk;
			});
			req.on("end", () => {
				this.requests.push({ method: req.method, url: req.url, body: raw });
				Log.test("StubAutoTestService - " + req.method + " " + req.url + " -> " + this.status);
				res.writeHead(this.status, { "Content-Type": "application/json" });
				res.end(JSON.stringify(this.body));
			});
		});

		await new Promise<void>((resolve) => this.server.listen(0, "127.0.0.1", resolve));
		const port = (this.server.address() as AddressInfo).port;

		const config = Config.getInstance();
		this.realUrl = config.getProp(ConfigKey.autotestUrl);
		this.realPort = config.getProp(ConfigKey.autotestPort);
		config.setProp(ConfigKey.autotestUrl, "http://127.0.0.1");
		config.setProp(ConfigKey.autotestPort, String(port));
		Log.test("StubAutoTestService - listening on 127.0.0.1:" + port);
	}

	public async stop(): Promise<void> {
		const config = Config.getInstance();
		config.setProp(ConfigKey.autotestUrl, this.realUrl);
		config.setProp(ConfigKey.autotestPort, this.realPort);

		if (this.server !== null) {
			await new Promise<void>((resolve) => this.server.close(() => resolve()));
			this.server = null;
		}
	}

	/**
	 * The single request made since the last reset; fails loudly if there was not exactly one.
	 */
	public onlyRequest(): { method: string; url: string; body: string } {
		if (this.requests.length !== 1) {
			throw new Error("StubAutoTestService: expected exactly one request, saw " + this.requests.length);
		}
		return this.requests[0];
	}

	public reset(): void {
		this.requests.length = 0;
		this.status = 200;
		this.body = {};
	}
}
