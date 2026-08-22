// biome-ignore-all lint/style/useFilenamingConvention: IREST is an interface name (the I-prefix convention this codebase uses), not camelCase or PascalCase

import * as restify from "restify";

export default interface IREST {
	// Restify cheatsheet (great resource): https://gist.github.com/LeCoupa/0664e885fd74152d1f90
	registerRoutes(server: restify.Server): void;
}
