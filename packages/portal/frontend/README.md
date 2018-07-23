
# Portal Frontend



## Dev Instructions

This assumes you're working with WebStorm.

### Configure your environment:

1) Setup SSL certificates (full instructions for this are in `classy/README.md`):
    * Create `classy/ssl/fullchain.pem` and `classy/ssl/privkey.pem` 
    * Copy `classy/ssl/` into `classy/packages/portal/frontend/ssl/`

2) Create a WebStorm execution profile (for interactive execution):
	* Node parameters: `--require dotenv/config`
	* JavaScript File: `src/server/FrontEndServer.js`

### Execution the frontend

1) Run WebPack (bundles TS into JS for the browser): `webpack --watch`

2) Run your execution profile in WebStorm (don't forget to start `portal/backend` first!).
