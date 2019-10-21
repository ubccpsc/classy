# Fork Customization

Each CPSC course that uses Classy requires a fork of the `root` [https://github.com/ubccpsc/classy] repository. The fork is used to change code that is custom to a course. Even if you do not plan to change the default Classy code, it is required that you create a fork of the repository because your fork will act as a stable code source that technical staff can run your Classy server off of.

Any user can fork the [UBCCPSC Classy](https://github.com/ubccpsc/classy) respository because it is open-source. It is strongly recommended that technical staff  setup the fork for an instructor to ensure that technical staff always have access to the fork. Access to the fork is necessary to pull in code changes from the instructor's fork into their Classy server. It is necessary that you add the instructor of the course to the fork as an owner of the organization. With owner permissions, the instructor can manage adding students and staff to the organization when it is necessary.

- [ ] Setup fork for instructor on Github.com
  - Use format `ubccpsc999` for organization name
- [ ] Give instructor access to fork with owner permissions
- [ ] Add relevant technical staff to the fork with owner permissions
- [ ] Setup branch permissions so that the `master` branch is protected.

## Test Fork Customization

Continuous Integration (CI) tests can be run on code in a fork to ensure that major features are not broken. This use case is reccomended if the instructor is doing development on AutoTest or Portal Back-End. 

Continuous Integration tests will notify the instructor, and developers, when tests fail on a fork. This redundancy minimizes the risk that broken features do not make their way into a production Classy environment.

- [ ] If an instructor will be doing custom development work on AutoTest, check to see if integration tests are required for the type of work that the instructor is doing.
- [ ] To implement CI tests, follow the [`/docs/continuous-integration-setup.md`](/docs/continuous-integration-setup.md) instructions.
