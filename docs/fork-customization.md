# Fork Customization

Each CPSC course that uses Classy requires a fork of the `root` [https://github.com/ubccpsc/classy] repository. The fork is used to change code that is custom to a course. Even if you do not plan to change the default Classy code, it is required that you create a fork of the repository because your fork will act as a stable code source that technical staff can run your Classy instance on.

Process Overview: Fork Code from Root Classy Repository --> Optional: Modify Forked Classy Code --> Technical Staff Hosts Code on Server

## Restoring Default Application State

The default files used to create the custom boilerplate files can be found in the `default-file-setup.sh` script. To revert to the default state, remove all of the custom files from front-end and back-end applications, and then re-run `default-file-setup.sh` from the `./Classy` directory.

## Test Fork Customization

Continuous Integration (CI) tests can be run to ensure that your front-end and back-end implementations work. If all tests pass, then Classy will run in Production. To implement CI tests, follow the [`/docs/continuous-integration-setup.md`](/docs/continuous-integration-setup.md) instructions.
