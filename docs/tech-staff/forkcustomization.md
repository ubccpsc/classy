# Fork Customization

Each course that wants to use Classy must fork the `root` [https://github.com/ubccpsc/classy] project. The fork is used as a place to maintain stable code and custom development work for the course. Even if you do not plan to change the default Classy code, it is required that you create a fork of the repository because your fork will act as a stable code source during the semester, even while code is being developed upstream.

Any user can fork the [UBCCPSC Classy](https://github.com/ubccpsc/classy) respository, but it is strongly recommended that technical staff create the fork in an organization for an instructor. This will give technical staff access to your fork. Access to the fork allows technical staff to maintain Classy for your course by downstreaming changes to your fork. The instructor of the course should always be an owner in the organization. With owner permissions, the instructor can manage adding students, TAs, or instructors to the organization when necessary.

## Forking Checklist

- [ ] Setup fork for instructor on Github.com
  - Use format `ubccpsc999` for organization name
- [ ] Give instructor access to fork with owner permissions
- [ ] Add relevant technical staff to the fork with owner permissions
- [ ] Setup branch permissions so that the `master` branch is protected.

## CI on a Fork

Continuous Integration (CI) tests can be run on a fork to ensure that major features are not broken during development or updates. CI tests are *highly* reccomended if the instructor is doing development work on Classy.

Continuous Integration tests will notify contributors when tests fail on the fork. This redundancy minimizes the risk that broken features do not make their way into a production Classy environment.

- [ ] If an instructor will be doing custom development work on AutoTest, check to see if integration tests are required for the type of work that the instructor is doing.
- [ ] To implement CI tests, follow the [Continuous Integration Setup](/docs/developer/continuousintegration.md) instructions.
