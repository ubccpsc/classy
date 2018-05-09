
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

## Insstructions TODO

    * `webpack` description missing 