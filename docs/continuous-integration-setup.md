# CONTINUOUS INTEGRATION SETUP

## Setup Overview 

A pull-request MUST pass the all tests in the continuous integration (CI) test suite before it is merged into the Master branch of the root project. This setup ensures that code may only be merged into the Master branch (a.) through a pull-request opened on Github, (b.) approved by at least one member of the project, and (c.) passes all CI tests.

**Three components:** Github Public or Github Enterprise, Circle CI, Coveralls

**CI Process:** User Pushes Code to Repo **==>** Circle CI Runs Tests **==>** Circle CI Sends Coverage Report to Coveralls **==>** Circle CI Notifies Github that Branch Passes or Fails Tests

## Github Public or Github Enterprise

Github Public contains the root `classy` repository, which is forked into various Github organizations and user accounts. This continuous integration setup can be re-created on any repository fork, as long as the organization or user account grants access to Circle CI.

## Circle CI

Circle CI is a testing tool that integrates directly with Github and is free for use on public repositories. It automatically runs test suites against branches that are pushed to a remote Git repository. Circle CI allows environment variables to be securely included in your test runs while integrating with other services, such as Coveralls.

A `yml` file is included in the `./circleci` directory of the `classy` repository. The `yml` file contains the steps that Circle CI runs to run tests and create a coverage report. Encrypted files are contained in the folder that are decrypted during Circle CI runtime using an an `ENVKEY` that is mentioned in the "Setup Instructions" in this README.

# Coveralls 

Coveralls is a code coverage tool that visually charts the code coverage percentage of a Git repository. 

--------------

# Setup Instructions: 

## Circle CI: 

Register for a CircleCI account on https://circleci.com and grant Circle CI access to the organization or user account where the `classy` fork is hosted. You may click on "Add Projects" and select the `classy` repository from a list of repos under the organization or user account.

Click on the `classy` project. Under the `classy` project, click on the cog-wheel on the right (not left panel). Underneath the "Build Settings", you must add the two environment variables below:

    COVERALLS_REPO_TOKEN: randomLongString
    ENVKEY: randomLongString

- The `ENVKEY` is private and you must ask a project owner for access to it.
- The `COVERALLS_REPO_TOKEN` is unique to each `classy` repository fork that you can create in next step.

## Coveralls: 

Register for an account on https://coveralls.io and grant Coveralls access to the organization or user account where `classy` is hosted. Click on "Add Repos" on the left panel and select the `classy` repository by (1.) clicking on the organization or user account where `classy` is located, and (2.) toggling the button beside the repo to "on". A `repo token` will exist underneath the settings of the repo that you added. This `repo token` is the `COVERALLS_REPO_TOKEN` that you must enter into Circle CI's "Build Settings". 

## Github: 

Underneath the repository settings area, select "Branches" on the left-panel and then:

- Add a Branch Protection Rule
- Enter the Branch Name Pattern to the Branch Protection Rule: `master`
- Under Rule Settings, select: 
  -- Require pull request reviews before merging (1 or more required approval reviews)
  -- Require status checks to pass before merging (select `ci/circleci:build`, deselect `coverage/coveralls`)
  -- Include Administrators
