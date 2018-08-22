# Classy

[![CircleCI](https://circleci.com/gh/ubccpsc/classy.svg?style=svg)](https://circleci.com/gh/ubccpsc/classy)
[![Coverage Status](https://coveralls.io/repos/github/ubccpsc/classy/badge.svg?branch=master)](https://coveralls.io/github/ubccpsc/classy?branch=master)

Classy is a classroom management system developed by the Department of Computer Science at UBC. Classy is tightly integrated with GitHub and has the ability to automatically provision student repositories, create teams, and mark assignments. Administrators can configure deliverables, enter grades, and view comprehensive dashboards of all student test executions. Students can use the system to create teams (if required) and view their grades and assignment feedback.

Primary contributors:

* [Reid Holmes](https://www.cs.ubc.ca/~rtholmes/)
* [Nick Bradley](https://nickbradley.github.io/)

## Configuration

Full details about how classy should be configured can be found in [docs/config.md](docs/config.md).

## Dev overview

All Classy development takes place in the public GitHub instance. Commits and Pull Requests are sent to a Continuous Integration service (CircleCI) for validation. All contributions to Classy must be made via Pull Request.

Any contributions must pass the following criteria:

1. The Pull Request must pass all existing tests. New contributions should not require existing tests to be changed as other courses might depend on the modified behaviour; if you feel such a change is needed, please mention the rationale in the Pull Request comments.

2. The test coverage of the system must be maintained; the expected coverage rate for any given file should be 90%+. We require tests be provided for any new contributions as without these it is extremely challenging to ensure that future development for other courses will not break your new contribution.

3. Finally, any contributions must lint before they can be accepted. This can be run using `yarn run lint` in `classy/`. The global rules in `/tslint.json` should not be changed.

### About dev packages

Wherever possible, please try to minimize external package dependencies. Classy has been configured to use [yarn workspaces](https://yarnpkg.com/lang/en/docs/workspaces/#toc-how-to-use-it).
You should add global dependencies to the root `package.json` and package-specific dependencies in the package-level `package.json`.

Specific dev instructions are included in [`packages/portal/backend/README.md`](packages/portal/backend/README.md), [`packages/portal/frontend/README.md`](packages/portal/frontend/README.md), and [`packages/autotest/README.md`](packages/autotest/README.md).

## License

[MIT](LICENSE)
