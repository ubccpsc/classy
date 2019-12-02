# CIRCLECI CONTINUOUS INTEGRATION SETUP

## Overview

A pull-request MUST pass all tests in the continuous integration (CI) test suite before it is merged into the `master` branch of the root `ubccpsc` project. This setup ensures that code may only be merged into the `master` branch:

1. Through a pull-request opened on Github.
2. Approved by at least one member of the project, AND ONLY (c.)
3. ONLY after all tests pass.

   Code will be tested on any branch pushed to the remote `origin` of your fork. A passing CircleCI check is necessary to merge code into your main `master` branch, which will be enforced by Github and code contributors.

## Services to Integrate

There are three services that must be integrated to successfully setup CI for Classy: 

- Github.com/Github Enterprise
- Circle CI
- Coveralls

## Services Overview

### Circle CI

Circle CI is a testing tool that integrates directly with Github and is free for use on public repositories. It automatically runs test suites against code that is pushed to any remote Git repository branch. Circle CI allows environment variables to be, securely, included in your test runs while integrating with other services, such as Coveralls.

A `yml` file is included in the `./circleci` directory of the `classy` repository. The `yml` file contains the steps that Circle CI uses to run tests and create a coverage report. Necessary encrypted files, which are also included in the `.circleci` directory, are decrypted during Circle CI runtime using an an `ENVKEY` that is mentioned in the "Setup Instructions" in this README.

### Coveralls

Coveralls is a code coverage tool that visually charts the code coverage percentage of a Git repository. 

## How Continuous Integration Works

1. A developer pushes code to a Github branch
2. CircleCI Classy testsuite on code pushed to branch
3. CircleCI produces a coverage report that is sent to Coveralls
4. CircleCI notifies Github with test pass or fail status
5. Github denies or allows code to be merged based on pass or fail status

--------------

## Services Setup Instructions

### Circle CI Setup

Register for a CircleCI account on https://circleci.com and grant Circle CI access to the organization or user account where the `classy` fork is hosted. Click on "Add Projects" and select the `classy` repository from a list of repos under the organization or user account.

Click on the `classy` project. Under the `classy` project view, click on the cog-wheel on the right (not left panel). Underneath the "Build Settings", you must add the two environment variables below:

    COVERALLS_REPO_TOKEN: randomLongString
    ENVKEY: randomLongString

- The `ENVKEY` is private and you must ask a project owner for it.
- The `COVERALLS_REPO_TOKEN` is unique to each `classy` repository fork and found in the next step.

### Coveralls Setup

Register for an account on [Coveralls.io](https://coveralls.io) and grant Coveralls access to the organization or user account where `classy` is hosted. Click on "Add Repos" on the left panel and select the `classy` repository by (1.) clicking on the organization or user account where `classy` is located, and (2.) toggling the button beside the repo to "on". A `repo token` will be found underneath the repository's settings view of the repository that you added. This `repo token` is the `COVERALLS_REPO_TOKEN` that you must enter into Circle CI's "Build Settings" above.

### Github Setup

Underneath the repository settings area, select "Branches" on the left-panel and then:

- Add a Branch Protection Rule
- Enter the Branch Name Pattern to the Branch Protection Rule: `master`
- Under Rule Settings, select:
  -- Require pull request reviews before merging (1 or more approval required before merge)
  -- Require status checks to pass before merging (select `ci/circleci:build`, deselect `coverage/coveralls`)
  -- Include Administrators
