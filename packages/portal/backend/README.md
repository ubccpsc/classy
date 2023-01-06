
# Portal BackendDaemon

## Dev Instructions

Follow the one-time instructions below. Once those are done do the following:

### To run a dev instance

* Install docker.
* Install dependencies (`yarn run install`).
* Make sure the `.env` is configured correctly (and is NOT added to version control).
* Start mongo (`docker run -p 27017:27017 mongo`).
* Build the backend (`yarn run build`).
* Start the backend (`yarn run backend` in `backend/` or from WebStorm).
* Start the frontend (`yarn run frontend` in `frontend/`).
* In the browser, visit `https://localhost:3000/`
* For sample data, execute `node -r tsconfig-paths/register packages/portal/backend/src-util/FrontendDatasetGenerator.js`

## To run the tests / coverage

* In `portal/backend/`:
  * Build: `yarn run build`
  * Tests: `yarn run test`
  * Coverage: `yarn run cover` (reports are in `portal/backend/coverage/`).

### One-time setup

* Create `classy/ssl/XXX` and `classy/ssl/XXX`.
	* Instructions for this are in `classy/README.md`.
* Copy `classy/ssl/` into `classy/packages/portal/backend/ssl/`.

* When configuring a WebStorm Run config:

	* Node parameters: `--require dotenv/config`.
	* JavaScript File: `src/server/BackendDaemon.js`.


## Configuring Webstorm

* Configure WebStorm for testing (only needs to happen once):
	* Create `Mocha` execution profile
	* Node options: `--require dotenv/config -r tsconfig-paths/register`
	* Mocha package: `<classy-dir>/packages/portal/backend/node_modules/mocha`
	* Extra Mocha options: `--exit`
	* Test directory: `<classy-dir>/packages/portal/backend/test` (select `Include subdirectories`)

* Configure WebStorm for interactive execution (only needs to happen once):
    * Create `Node.js` execution profile
    * Node options: `-r dotenv/config -r tsconfig-paths/register`
    * Working directory: `<classy-dir>/packages/portal/backend`
    * JavaScript file: `src/BackendDaemon.js`
