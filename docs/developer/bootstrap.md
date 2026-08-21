# Bootstrapping Classy for Development

Although Classy is containerized, configuring your development instance does not require building Docker containers. The [Classy](https://github.com/ubccpsc/classy) repository consists of two REST-based projects and a JavaScript front-end application that is served by one of the REST APIs as static HTML content. These applications can be run separately, or together, in your IDE or from the command line in debugging mode. TypeScript source maps are produced during compilation for debugging the application during runtime.

## Software Dependencies

The software dependencies that are currently used in production and recommended to work in development:

- Node JS v22 (`>= 22.0.0 < 24`, as declared in the root `package.json`) [Download](https://nodejs.org/en/download/). The repo ships a `.nvmrc` (`lts/jod`), so `nvm install` / `nvm use` in `classy/` selects the right version. CI builds on `cimg/node:22.23.2`.
- Yarn v1 (classic) [Installation](https://yarnpkg.com/lang/en/docs/install). The repo pins its own copy through `.yarnrc` (`.yarn/releases/yarn-1.18.0.cjs`), so whichever Yarn 1.x launcher you have installed will defer to that version.
- Docker [Install](https://docs.docker.com/install/). Needed to run MongoDB, and by the AutoTest specs that build grading containers.
- IDE: Webstorm is recommended, VSCode is supported.
- MongoDB v5 (Docker: `docker run -p 27017:27017 mongo:5.0`, or [Install](https://docs.mongodb.com/manual/installation/))

**NOTE**: MongoDB must be running before starting **AutoTest** or **Portal**, or before running the test suite.

### macOS: the Docker socket

The AutoTest service talks to the Docker daemon over `/var/run/docker.sock`. Docker Desktop for macOS does not create that path by default; enable **Settings → Advanced → "Allow the default Docker socket to be used"** (it will ask for your password). Without it, the AutoTest specs that build images fail with `connect ENOENT /var/run/docker.sock`.

## Environmental Config

You will need to ensure the required environment variables, which you can see in `packages/common/src/Config.ts`, are set. This can be done by copying `.env.sample` to `.env` in the root of the project and modifying as needed. It is ***CRUCIAL*** that your `.env` file is never committed to version control.

`Config` loads the root `.env` itself (using a path relative to its own location), so the variables resolve no matter which directory you launch a process from.

The sample configuration file includes a lot of documentation inline so [take a look](https://github.com/ubccpsc/classy/blob/main/.env.sample).

Two settings deserve attention when configuring a machine for local development:

- `DB_URL` should point at your local Mongo (e.g., `mongodb://localhost:27017` for an instance started without authentication).
- `BACKEND_URL` must use **http** for local test runs. The specs start their own backend, and `BackendServer` is only started in https mode when `CI` is set; with `BACKEND_URL=https://localhost` the AutoTest `ClassPortal` and `GitHub Event Parser` specs cannot reach it and fail. Use `https` only when running the real backend or `docker compose`.

## GitHub Setup

Classy manages administrators using GitHub teams. The GitHub organization that the course uses should have a `staff` and `admin` team. Users on the GitHub `staff` and `admin` teams will have access to the Classy Admin Portal, although users on the `staff` team will have greater privileges (e.g., the ability to configure the course). The bot user should be added as an owner of the organization.

## Install/Build

To install Classy for development:

1. Type `git clone https://github.com/ORGNAME/classy`
2. `cd classy` to navigate inside the directory.
3. `nvm install` to install and select the Node version named in `.nvmrc` (`nvm use` on its own only works once that version is present locally).
4. Inside the directory, type `yarn install` to fetch library dependencies.
5. Then type `yarn run build` to build the project.

   During the build step, a source-map was produced with the built code, which allows you to set breakpoints and debug in your IDE.

6. You are ready to run any of the applications (commands found in `package.json` files under respective application package directories).

**NOTE**: `tsc` emits the compiled `.js` beside each `.ts` file, and both the daemons and the test suite run that emitted JavaScript. Re-run `yarn run build` after every source change or you will be running stale code.

## Running MongoDB

Mongo is easiest to run as a container; the tests and both services expect it on port 27017:

```
docker run --name classy-mongo -p 27017:27017 -d mongo:5.0
```

On subsequent sessions, `docker start classy-mongo` is enough.

## Running as dev

There are a variety of services you may want to run independently while developing.
Most will require configuring mongo to run in dev mode (see `DB_URL` in `.env`).
The most common of these services can be invoked through either the terminal or IDE:

* Classy backend: `yarn run backend` from `packages/portal/backend/`
* Classy frontend: Instructions in `packages/portal/frontend/README.md`
* AutoTest backend: `yarn run autotest` from `packages/autotest/`

Some handy dev scripts also exist; these can be found in `packages/portal/backend/src-util/`; use these with care, many modify the database or GitHub repos in unrecoverable ways.

## Running the test suite

The automated test suite is stored in:
* `packages/autotest/test/`
* `packages/portal/backend/test/`

Run it from the `classy/` root, after `yarn run build`:

```
yarn run test:backend
yarn run test:autotest
yarn run test
```

**Run from the repo root.** `yarn run test` also works inside `packages/portal/backend/`, but the AutoTest specs read their fixtures through a repo-root-relative path when `CI` is unset, so running them from `packages/autotest/` fails with `ENOENT ... test/githubEvents/*.json`.

Set `LOG_LEVEL=WARN` for a readable run (e.g., `LOG_LEVEL=WARN yarn run test:backend`); the default `TRACE` buries the Mocha summary under thousands of lines.

To run these in the IDE create a Mocha target in Webstorm with `-r tsconfig-paths/register` as the node options, `--exit` as the mocha options, and the `classy/` root as the working directory.

### Coverage

The best way to run coverage locally is to execute `yarn run cover` in `classy/`. The coverage report will be generated in `testOutput/coverage/index.html`. NOTE: when executing locally, mocks are extensively used so the report will not be as comprehensive as executing on CI.

## Testing the containers locally

QA item 7 (`docker compose build` / `docker compose up`) can be run on a dev machine, but the container stack needs different configuration than host-local development does. The values that must change are the ones that name other services: inside a container, `localhost` is that container, not its neighbour.

Keep a second env file, `.env.docker`, alongside your normal `.env` (both are gitignored). It differs only in:

| Setting | Host-local | Containers |
| --- | --- | --- |
| `DB_URL` | `mongodb://localhost:27017` | `mongodb://USER:PASS@db:27017/?authMechanism=DEFAULT` (the `db` container enables auth from `MONGO_INITDB_ROOT_*`) |
| `AUTOTEST_URL` | `http://localhost` | `http://autotest` |
| `BACKEND_URL` | `http://localhost` | `https://portal` |
| `PERSIST_DIR` | a relative path (e.g., `persist`) | an absolute path (e.g., `/output`) |

`PERSIST_DIR` is the easy one to miss: it is a mount target in `docker-compose.yml`, and a relative value fails with `invalid mount path: 'persist' mount path must be absolute`.

`docker-compose.yml` hardcodes `env_file: .env` and the Dockerfiles `COPY .env`, so `.env.docker` cannot be passed in with `--env-file`; it has to be swapped into place for the duration of the run:

```
cp .env .env.bak && cp .env.docker .env
./helper-scripts/bootstrap-plugin.sh
docker compose -f docker-compose.yml up -d --build
```

Then check the stack is actually serving (the certs are self-signed, hence `-k`):

```
curl -k https://localhost/              # landing page through nginx
curl -k https://localhost/portal/config # portal + database
```

`/portal/config` is the useful probe: it exercises nginx to portal over https and portal to Mongo. `docker compose logs portal | grep "AT status"` should report `success`, which confirms portal can reach AutoTest.

Finally, tear down and put your `.env` back:

```
docker compose -f docker-compose.yml down && cp .env.bak .env
```

Notes:

- **`-f docker-compose.yml` is deliberate.** It skips `docker-compose.override.yml`, which `bootstrap-plugin.sh` copies from the plugin. The default plugin's override is identical to the root compose file except that it hardcodes the db volume as `/var/opt/classy/db`; on a dev machine that path is created root-owned while the container runs as `${UID}`, and Mongo dies with `Attempted to create a lock file on a read-only directory: /data/db`. Dropping the override lets the db volume follow `${HOST_DIR}` instead. Include the override when you specifically want to test plugin behaviour, and create that directory yourself first. (CI does include it: `build_only` runs as root, so the hardcoded path is writable there.)
- Stop any other Mongo you have bound to 27017 first; the `db` service publishes that port.
- `restart: always` means a crashed service comes straight back, so a failing request can look like a 502 from nginx rather than a crash. Check `docker compose logs portal` before concluding the proxy is at fault.
- The built images contain a copy of your `.env`. They are fine locally, but do not push them anywhere.

## QA Checklist

More checks may need to be made depending on the nature of your work, but these are the recommended checks:

1. [ ] Portal backend compiles
2. [ ] Portal frontend compiles
3. [ ] AutoTest compiles
4. [ ] Formatting is clean (`yarn run prettier:check`; `yarn run prettier:fix` to apply)
5. [ ] CI tests pass for Portal Back-end
6. [ ] CI tests pass for AutoTest
7. [ ] Project containers build successfully (`docker compose build` and `docker compose up`)

*NOTE*:

- Items 1-6 can all be verified both locally and by CircleCI.
- Item 7 is executed by the `build_only` CI job, which builds the images, starts the stack, and polls `/portal/config` until it answers. Run it locally too when you are changing anything the containers depend on; see [Testing the containers locally](#testing-the-containers-locally).
- Item 7 requires a properly-setup `.env` file with SSL certificates.
- Some specs (e.g., the AutoTest specs that build Docker images) are skipped on CI and only run locally, so a green CI build is not by itself proof that a change works end-to-end.
