# Bootstrapping Classy for Development

Classy is two REST services (`portal/backend` and `autotest`) plus a frontend that the backend serves as
static content. All of them run from an IDE or the command line without building containers.

## Software Dependencies

| Dependency | Notes |
| --- | --- |
| Node 22 (`>= 22.0.0 < 24`) | `nvm install` picks the version from `.nvmrc` (`lts/jod`); CI builds on `cimg/node:22.23.2`. Node 24 does **not** work: `restify` pulls in `spdy`, which calls the `http_parser` binding that Node 24 removed. |
| Yarn 1 (classic) | `.yarnrc` pins the repo's own copy, so whichever Yarn 1.x launcher you have defers to it. |
| Docker | Runs MongoDB, and the AutoTest specs that build grading images. |
| MongoDB 5 | `docker run --name classy-mongo -p 27017:27017 -d mongo:5.0`, then `docker start classy-mongo` on later sessions. |

Mongo must be running before you start AutoTest, Portal, or the test suite.

On macOS the AutoTest Docker specs need `/var/run/docker.sock`, which Docker Desktop does not create by
default: enable **Settings → Advanced → "Allow the default Docker socket to be used"**.

## Configuring an Instance

Copy `.env.sample` to `.env` in the repo root and fill it in. The sample documents each variable inline
and `packages/common/src/Config.ts` is the authoritative list. ***Never commit `.env`.*** `Config` loads
it by a path relative to itself, so it resolves no matter which directory you launch from.

Two settings matter specifically for local development:

- `DB_URL` — your local Mongo, e.g. `mongodb://localhost:27017`.
- `BACKEND_URL` — must be **http** for local test runs. The specs start their own backend, and
  `BackendServer` only listens over https when `CI` is set; with `https://localhost` the AutoTest
  `ClassPortal` and `GitHub Event Parser` specs cannot reach it.

Classy manages administrators through GitHub teams, so the org needs `staff` and `admin` teams, and the
bot user should be an owner of the organization.

## Install/Build/Run

```
nvm install     # selects the node version named in .nvmrc
yarn install
yarn run build
```

`tsc` emits each `.js` beside its `.ts`, and both the daemons and the test suite run that emitted
JavaScript. **Re-run `yarn run build` after every source change** or you will be running stale code.

To run a service:

- backend: `yarn run backend` from `packages/portal/backend/`
- autotest: `yarn run autotest` from `packages/autotest/`
- frontend: see `packages/portal/frontend/README.md`

`packages/portal/backend/src-util/` holds batch utilities. Several of them modify the database or GitHub
irreversibly, so read them carefully before running any of these.

## Running the test suite

From the repo root, after `yarn run build`:

```
yarn run test:backend
yarn run test:autotest
yarn run test
```

- **Run from the repo root.** The AutoTest specs resolve their fixtures relative to the root when `CI` is
  unset, so running from `packages/autotest/` fails with `ENOENT ... test/githubEvents/*.json`.
- Set `LOG_LEVEL=WARN` for a readable run; the default `TRACE` buries the Mocha summary under thousands
  of lines.
- Specs that hit live GitHub skip themselves unless `CI` is set, so a local run leaves ~100 pending. To
  exercise them, set `CI=true` — which also switches the backend to https, so generate certs first:
  ```
  mkdir -p packages/portal/backend/ssl && openssl req -new -newkey rsa:2048 -days 365 -nodes -x509 \
    -keyout packages/portal/backend/ssl/privkey.pem \
    -out packages/portal/backend/ssl/fullchain.pem -subj "/CN=localhost"
  ```
- `yarn run cover` writes coverage to `testOutput/coverage/index.html`. Locally it under-reports, because
  mocks stand in for much of what CI exercises for real.

In WebStorm, create a Mocha target with node options `-r tsconfig-paths/register`, mocha options
`--exit`, and the repo root as the working directory.

## TypeScript 7 gotchas

- **There is no `baseUrl`.** Path mappings are relative to the `tsconfig.json` they appear in.
  `tsconfig-paths` resolves the `@common`/`@backend` aliases *at runtime* and still needs one, so the
  scripts export `TS_NODE_BASEURL=.` (the Dockerfiles set it as an `ENV`). Running mocha or a daemon by
  hand without it fails with `Cannot find module '@common/Log'`.
- **`strict` is pinned to `false`** in each `tsconfig.json` to keep pre-7 semantics. Turning it on
  surfaces roughly 1250 null/undefined diagnostics, so treat that as its own project.
- **`esModuleInterop` is always on and cannot be disabled.** CommonJS packages that are called or
  constructed (`supertest`, `dockerode`, `csv-parse`, `client-oauth2`, `moment`, `parse-link-header`)
  must use `import x from "y"`, not `import * as x from "y"`.
- The compiler is a native binary with no JavaScript API, so tools built on it do not work: `ts-loader`,
  `tsconfig-paths-webpack-plugin`, `tslint`, and `ts-node`. Linting and formatting run through Biome
  (`yarn lint`, `yarn lint:fix`); the frontend runs `tsc` first and points webpack at the emitted `.js`,
  with `resolve.alias` standing in for the path mappings.

## Building and launching the containers

Containers need different configuration than host-local development, because inside a container
`localhost` is that container rather than its neighbour. Keep a second `.env.docker` (also gitignored)
that differs only in:

| Setting | Host-local | Containers |
| --- | --- | --- |
| `DB_URL` | `mongodb://localhost:27017` | `mongodb://USER:PASS@db:27017/?authMechanism=DEFAULT` |
| `AUTOTEST_URL` | `http://localhost` | `http://autotest` |
| `BACKEND_URL` | `http://localhost` | `https://portal` |
| `PERSIST_DIR` | relative, e.g. `persist` | absolute, e.g. `/output` — a relative value fails with `mount path must be absolute` |

`docker-compose.yml` hardcodes `env_file: .env` and the Dockerfiles `COPY .env`, so `.env.docker` cannot
be passed with `--env-file`; it has to be swapped into place for the run:

```
cp .env .env.bak && cp .env.docker .env
./helper-scripts/bootstrap-plugin.sh
docker compose -f docker-compose.yml up -d --build
curl -k https://localhost/portal/config      # exercises nginx -> portal -> Mongo
docker compose -f docker-compose.yml down && cp .env.bak .env
```

- **`-f docker-compose.yml` is deliberate.** It skips `docker-compose.override.yml`, which
  `bootstrap-plugin.sh` copies from the plugin and which hardcodes the db volume at
  `/var/opt/classy/db`. On a dev machine that path is created root-owned while the container runs as
  `${UID}`, so Mongo dies with `read-only directory: /data/db`. Include the override only when you are
  specifically testing plugin behaviour, and create that directory yourself first. (CI includes it:
  `build_only` runs as root, where the path is writable.)
- Stop any other Mongo bound to 27017 first; the `db` service publishes that port.
- `restart: always` means a crashed service comes straight back, so a failure can look like a 502 from
  nginx rather than a crash. Check `docker compose logs portal` before blaming the proxy.
- The built images contain a copy of your `.env`. Fine locally; do not push them anywhere.

## Sending work to CI

CircleCI runs two jobs per push:

- **`build_and_test`** — compiles every package, checks formatting and lint rules with Biome, then runs
  the Portal and AutoTest suites.
- **`build_only`** — builds the images, starts the stack, and polls `/portal/config` until it answers.

CI decrypts its own `.env` from `.circleci/env.enc`, so your local `.env` is never involved.

When a build fails, the test results are in the build's artifacts as
`testOutput/backend/test/test-results.xml` — **including on red builds**. Read that rather than the step
output: CircleCI truncates step output at 400KB and this suite exceeds it, so the earliest specs scroll off.

A nightly scheduled build runs the same job against live GitHub. It catches breakage caused by external
state drift (a changed template repo, an expired token) rather than by commits, so a nightly failure on
unchanged code is a real signal, not a flake.

### Before you push

1. [ ] Portal backend, Portal frontend, and AutoTest all compile
2. [ ] `yarn lint` is clean (`yarn lint:fix` to apply)
3. [ ] Portal and AutoTest suites pass
4. [ ] Containers build and come up — only when changing something they depend on

Items 1–3 are exactly what `build_and_test` checks. Some specs behave differently locally than on CI
(the AutoTest Docker ones, and anything gated on live GitHub), so a green local run is not proof of a
green build, nor the reverse.
