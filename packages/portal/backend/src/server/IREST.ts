// biome-ignore-all lint/style/useFilenamingConvention: IREST is an interface name (the I-prefix convention this codebase uses), not camelCase or PascalCase

import type { FastifyInstance, FastifyRequest } from "fastify";

/**
 * The request type Classy route handlers take.
 *
 * Fastify types params/body/querystring as `unknown` unless a route declares generics for them,
 * which would mean spelling out a type for each of the ~56 routes. This alias instead states the
 * shape they all actually have: string path parameters, an arbitrary JSON body, and single-valued
 * headers. That is enough for `req.params.delivId` and `req.headers.user` to type as `string`
 * rather than `any`, without per-route churn.
 *
 * NOTE: `Body` is deliberately `any`. Bodies here are validated by the *Transport validators in
 * the controllers rather than by a Fastify schema, so a stricter type would be a claim the code
 * does not actually check.
 */
export type ClassyRequest = FastifyRequest<{
	Params: Record<string, string>;
	Querystring: Record<string, string>;
	Headers: Record<string, string>;
	// biome-ignore lint/suspicious/noExplicitAny: request bodies are validated in the controllers
	Body: any;
}>;

export default interface IREST {
	// NOTE: this used to take a restify.Server. Forks that implement this interface need to
	// update their signature once; the handler bodies are (req, res, next) => ... in both, but
	// the second argument is now a FastifyReply and the third is gone. See the route files in
	// server/common/ for what the ported handlers look like.
	registerRoutes(server: FastifyInstance): void;
}
