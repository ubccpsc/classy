
# AutoTest


## Dev Instructions

This assumes you're working with WebStorm.
    
## Testing

0) 	`yarn run install`

1) Configure WebStorm for testing (only needs to happen once):
	* Create `Mocha` execution profile
	* Node options: `--require dotenv/config`
	* Mocha package: `<classy-dir>/packages/autotest/node_modules/mocha`
	* Extra Mocha options: `dotenv_config_path=<classy-dir>/.env`
	* Test directory: `<classy-dir>/packages/autotest/test`

2) Make sure `portal-backend` is running on `localhost:5000`

3) Run the tests.