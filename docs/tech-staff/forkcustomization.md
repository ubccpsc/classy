# Fork Customization

Each CPSC course that uses Classy requires a fork of the `root` [https://github.com/ubccpsc/classy] repository. The fork is used to change code that is custom to a course. Even if you do not plan to change the default Classy code, it is required that you create a fork of the repository because your fork will act as a stable code source that technical staff can run your Classy server off of.

Any user can fork the [UBCCPSC Classy](https://github.com/ubccpsc/classy) respository because it is open-source. Technical staff should setup the fork to ensure that technical staff have access to a secure fork environment. It is necessary that you add the instructor of the course to the fork as an owner of the organization. With owner permissions, the instructor can manage adding students and staff to the organization when it is necessary.

## Test Fork Customization

Continuous Integration (CI) tests can be run to ensure that your front-end and back-end implementations work. If all tests pass, then Classy will run in Production. To implement CI tests, follow the [`/docs/continuous-integration-setup.md`](/docs/continuous-integration-setup.md) instructions.
