# Bootstrapping Classy for Development

Although Classy is containerized, configuring your development instance does not require building Docker containers. The [Classy](https://github.com/ubccpsc/classy) repository consists of two REST-based projects and a JavaScript front-end application that is served by on one of the REST APIs as static HTML content. These applications can be run separately, or together, in your IDE or from the command line in debugging mode. TypeScript source maps are produced during compilation for debugging the application during runtime.

## Software Dependencies

The software dependencies that are currently used in production and recommended to work in development:

- Node JS > v12.13.0 < v13 [Download](https://nodejs.org/en/download/) (or use `nvm`)
- Yarn v1.19.1+ [Installation](https://yarnpkg.com/lang/en/docs/install)
- Docker v19.03.4, build 9013bf583a [Install](https://docs.docker.com/install/)
- IDE: JetBrain's Webstorm is recommended; VSCode is supported
- MongoDB > 3.6.7 (Docker: `docker run -p 27017:27017 mongo`, or [Install](https://docs.mongodb.com/manual/installation/))

**NOTE**: MongoDB must be running before starting **AutoTest** or **Portal**.

## Environmental Config

You will need to ensure the required environment variables, which you can see in `packages/common/Config.ts`, are set. This can be done by copying `.env.sample` to `.env` in the root of the project and modifying as needed. It is ***CRUCIAL*** that your `.env` file is never committed to version control.

The sample configuration file includes a lot of documentation inline so [take a look](https://github.com/ubccpsc/classy/blob/main/.env.sample).

## GitHub Setup

Classy manages administrators using GitHub teams. The GitHub organization that the course uses should have a `staff` and `admin` team. Users on the GitHub `staff` and `admin` teams will have access to the Classy Admin Portal, although users on the `staff` team will have greater privileges (e.g., the ability to configure the course). The bot user should be added as an owner of the organization.

## Install/Build

To install Classy for development:

1. Type `git clone https://github.com/ORGNAME/classy`
2. `cd classy` to navigate inside the directory.
3. Inside the directory, type `yarn install` to fetch library dependencies.
4. Then type `yarn run build` to build the project.

   During the build step, a source-map was produced with the built code, which allows you to set breakpoints and debug in your IDE.

5. You are ready to run any of the applications (commands found in `package.json` files under respective application package directories).

## Running as dev

There are a variety of services you may want to run independently while developing.
Most will require configuring mongo to run in dev mode (see `DB_URL` in `.env`). 
The most common of these services can be invoked from the `classy/` directory through either the terminal or IDE:

* Classy backend: `node -r tsconfig-paths/register packages/portal/backend/src/BackendDaemon.js`
* Classy frontend: Instructions in `packages/portal/frontend/README.md`
* Autotest backend: `node packages/autotest/src/AutoTestDaemon.js`
 
Some handy dev scripts also exist; these can be found in `portal/backend/src-util/`; use these with care, many modify the database or GitHub repos in unrecoverable ways. 

The automated test suite is stored in:
* `packages/autotest/test/`
* `packages/portal/backend/test/`

To run these in the IDE create a Mocha target in Webstorm with `-r tsconfig-paths/register` as the node options and `--exit` as the mocha options.
To run these on the terminal, execute `yarn run test` in `packages/autotest/` or `packages/portal/backend/`

### Coverage

The best way to run coverage locally is to execute `yarn run cover` in `classy/`. The coverage report will be generated in `testOutput/coverage/index.html`. NOTE: when executing locally, mocks are extensively used so the report will not be as comprehensive as executing on CI.

## QA Checklist

More checks may need to be made depending on the nature of your work, but these are the recommended checks:

1. [ ] Portal Back-end compiles
2. [ ] Portal Front-end compiles
3. [ ] AutoTest compiles
4. [ ] CI tests pass for Portal Back-end
5. [ ] CI tests pass for AutoTest
6. [ ] Project containers build successfully (`docker compose build` and `docker compose up`)

*NOTE*:

- Items 1-5 can all be fulfilled by CircleCI integration.
- Item 6 can only be done manually at this time.
- Item 6 requires a properly-setup environmental file with SSL certificates.
