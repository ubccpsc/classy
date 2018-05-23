
# Portal Backend



## Dev Instructions

This assumes you're working with WebStorm.

* Create `classy/ssl/XXX` and `classy/ssl/XXX`.
	* Instructions for this are in `classy/README.md`.
* Copy `classy/ssl/` into `classy/packages/portal-backend/ssl/`.

When configuring a WebStorm Run config:

	* Node parameters: `--require dotenv/config`.
	* JavaScript File: `src/server/BackendServer.js`.
	* Application parameters (for your path): `dotenv_config_path=/Users/rtholmes/GoogleDrive/dev/classy/.env`.

## Instructions TODO

    * `webpack` description missing
    
## Testing

0) 	`yarn run install`

1) Configure WebStorm (only needs to happen once):
	* Create `Mocha` execution profile
	* Node options: `--require dotenv/config`
	* Mocha package: `<classy-dir>/packages/portal-backend/node_modules/mocha`
	* Extra Mocha options: `dotenv_config_path=<classy-dir>/.env`
	* Test directory: `<classy-dir>/packages/portal-backend/test`
	
2) Start db: `docker run -p 27017:27017 mongo`

3) Make sure you have `GH_CLIENT_ID` and `GH_CLIENT_SECRET` set to a GitHub OAuth client that redirects to `https://localhost:5000/githubCallback?orgName=YOURORG` so you can authenticate with your test instance. 

4) Run the tests / Run the service for interactive work (this will require running `portal-frontend` too and accessing it all via `https://localhost:3000`).

