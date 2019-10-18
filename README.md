# Classy

[![CircleCI](https://circleci.com/gh/ubccpsc/classy.svg?style=svg)](https://circleci.com/gh/ubccpsc/classy)
[![Coverage Status](https://coveralls.io/repos/github/ubccpsc/classy/badge.svg?branch=master&service=github)](https://coveralls.io/github/ubccpsc/classy?branch=master)

Classy is a classroom management system developed by the Department of Computer Science at UBC. Classy is tightly integrated with GitHub and has the ability to automatically provision student repositories, create teams, and mark assignments. Administrators can configure deliverables, enter grades, and view comprehensive dashboards of all student test executions. Students can use the system to create teams (if required) and view their grades and assignment feedback.

Primary contributors:

* [Reid Holmes](https://www.cs.ubc.ca/~rtholmes/)
* [Nick Bradley](https://nickbradley.github.io/)

## Contributing to Classy

Each course that uses Classy requires a fork of the core Classy project ([ubccpsc/classy](https://github.com/ubccpsc/classy) where custom development can take place. If custom features are developed that suit the core project, you can request that the feature is merged into the core project by setting up a pull-request of the feature on a branch that is re-based to `ubccpsc/master`.

All core Classy development will take place on [ubccpsc/classy](https://github.com/ubccpsc/classy). This repository will contain the base Classy image, but will not contain any course-specific code. Reid Holmes will act as the `ubccpsc/classy` custodian for evaluating and merging bug fix PRs as well as the feature-based PRs below.

Forks are highly encouraged to issue PRs from their fork to `ubccpsc/classy` for any bug fixes; please make sure these fixes also pass the Classy test suite. The quality bar for these fixes will be high because we need to ensure they will not negatively impact other classes should they decide to pull from master.

For new features, forks are also encouraged to issue PRs _during_ the term for consideration during the merging period. Again, since this code will be going into master, please make sure that:

* The new feature should have been validated 'in production' in the fork's current course instance; we want to know for sure that code has worked for another class before adding it to `ubccpsc/classy`.
* It makes sense for the functionality to be in `ubccpsc/classy` rather than the course-specific fork (e.g., the feature should have broad appeal to many other course instances).
* The feature is well tested and the code of high quality.
* Any additional tests do not overly burden the overall test suite execution duration, and should be resilient to future changes.
* The contribution must lint before it can be accepted (e.g., `cd classy/; yarn run lint`).

We will do our best to merge new features as long as they make sense for `ubccpsc/classy`, but if a feature is not merged it can exist as a long-lived feature in a course's fork. These features can also be merged between forks via PR as well if it makes sense to do so.

Main course forks:

* [ubccpsc210/classy](https://github.com/ubccpsc210/classy)
* [ubccpsc221/classy](https://github.com/ubccpsc221/classy)
* [ubccpsc310/classy](https://github.com/ubccpsc310/classy)
* [cpsc340/classy](https://github.com/CPSC340/classy)
* [secapstone/classy](https://github.com/SECapstone/classy)
* [MDS TBD](NOTSETYET)

## Table of Contents

Instructions for getting started with Classy have been sorted into sections based on the following user roles:

### Instructors

<!-- TOC depthfrom:2 -->

- [1. Classy Features](/docs/instructor/features.md#overview)
    - [1.1 Portal](/docs/instructor/features.md#portal)
    - [1.2 AutoTest](/docs/instructor/features.md#autotest)
    - [1.4 Github & AutoTest Examples](/docs/instructor/features.md#github-and-autotest-examples)
- [2. Getting Started](/docs/instructor/gettingstarted.md#overview)
    - [2.1 Requesting Classy for Your Course](/docs/instructor/gettingstarted.md#requesting-classy-for-your-course)
    - [2.2 Default Front-end and Back-end Bootstrapping](/docs/instructor/gettingstarted.md#quick-front-end-and-back-end-bootstrapping)
    - [2.3 Optional Front-end Customization](/docs/instructor/gettingstarted.md#front-end-setup)
    - [2.4 Optional Back-end Customization](/docs/instructor/gettingstarted.md#back-end-setup)
- [3. AutoGrade Setup](/docs/instructor/autograde.md#overview)
    - [3.1 Build a Container Checklist](/docs/instructor/autograde.md#build-a-container-checklist)
    - [3.2 Test a Container Checklist](/docs/instructor/container.md#test-a-container-checklist)
- [4. Portal Manual](/docs/instructor/portal.md#overview)
    - [4.1 Classlist Enrollment](/docs/instructor/portal.md#classlistupload)
    - [4.2 Deliverable Configuration](/docs/instructors/portal.md#classlistupload)
    - [4.3 Distributing Assignments and Repository Creation](/docs/instructor/portal.md#repocreation)
- [5. AutoTest Manual](/docs/instructor/autotest.md#overview)
    - [5.1 User Types](/docs/instructor/autotest.md#user-types)
    - [5.2 Student AutoBot Commands](/docs/instructor/autotest.md#student-autobot-commands)
    - [5.3 Admin AutoBot Commands](/docs/instructor/autotest.md#admin-autobot-commands)
  
<!-- /TOC -->

### Tech Staff

<!-- TOC depthfrom:2 -->

- [1. Architecture](/docs/tech-staff/architecture.md)
- [2. Operations](/docs/tech-staff/operations.md)
    - [2.1 Hardware Requirements](/docs/tech-staff/hardware.md)
    - [2.2 Fork Customization](/docs/tech-staff/forkcustomization.md)
    - [2.3 Installation](/docs/tech-staff/install.md)
      -2.3.1 Software Dependencies](/docs/tech-staff/install.md#software-dependencies)
      -2.3.2 Install Classy](/docs/tech-staff/install.md#install-classy)
      -2.3.2 System Configuration](/docs/tech-staff/install.md#create-user-group)
      -2.3.3 Create SSL Certificates](/docs/tech-staff/install.md#create-ssl-certificates)
      -2.3.4 Configure Firewall Rules](/docs/tech-staff/install.md#create-firewall-rules)
    - [2.3 Github Setup](/docs/tech-staff/githubsetup.md)
    - [2.4 Backup Configuration](/docs/tech-staff/backups.md)
    - [2.5 Build/Start/Stop Classy](/docs/tech-staff/operatingclassy.md)
    - [2.6 Patching](/docs/tech-staff/updates.md)
      - [2.6.1 Hardware](/docs/tech-staff/updates.md#os)
      - [2.6.2 Software](/docs/tech-staff/updates.md#classy)
      - [2.6.3 SSL Certificates](/docs/tech-staff/updates.md#ssl-certificates) --> NEEDS INSTRUCTIONS
    - [2.7 Semester Transitions](/docs/tech-staff/semestertransitions.md#semester-transitions) --> NEEDS INSTRUCTIONS

<!-- /TOC -->

### Developers

<!-- TOC depthfrom:2 -->

- [1. Bootstrapping Classy for Development](/docs/developer/bootstrap.md)
- [2. Container Logic and Interfaces](/docs/developer/container.md)
- [3. Bootstrapping CI Testing Github Organization](/docs/developer/ci.md)] --> NEEDS INSTRUCTIONS
- [4. Continuous Integration Setup](/docs/developer/continuousintegration.md)

<!-- /TOC -->

## Modifying Classy on Your Own Fork

Tech staff will setup a fork of ([ubccpsc/classy](https://github.com/ubccpsc/classy) for each course that uses Classy.

During the term, `ubccpsc/classy` will only receive critical bug fixes so courses should feel comfortable pulling these into their forks if the bug fixes are relevant to them. Major changes will only be made to `ubccpsc/classy` during exam breaks (e.g., December, April, and August).

## Hosting Configuration

Full details about how Classy should be configured for a production instance can be found in [docs/config.md](docs/tech-staff/deploy.md).

## Development Configuration

Full details about how Classy should be configured for development work can be found in [docs/config.md](docs/developer/config.md).

## Developer Contribution Acceptance Criteria

All Classy development should take place in a course-specific fork. Bug fixes to core `ubccpsc/classy` code can be issued via PR back to `ubccpsc/classy` as required, as can feature-addition PRs (as described above). Classy has been configured with CircleCI for validating work and any PR that fails to pass CI will not be merged.

Forks are encouraged to work using PRs on their local repos as well as using these will make it easier to upstream fixes and new features back to `ubccpsc/classy`.

To do this you can:

```
# if you made some changes and forgot to branch:
git stash
git checkout -b <DESCRIPTIVE_BRANCH_NAME>
git stash pop
git commit -a
git push --set-upstream origin <DESCRIPTIVE_BRANCH_NAME>

# if you didn't forget to branch first:
git checkout -b <DESCRIPTIVE_BRANCH_NAME>
git commit -a
git push --set-upstream origin <DESCRIPTIVE_BRANCH_NAME>
```

<!--
You can open a PR on GitHub at any time for your branch, but it cannot be merged until the PR passes all CI checks.
-->

The following guidelines can be helpful for evaluating any PRs on a local fork (although obviously these are up to the fork maintainer and will only be enforced if PRs are made back to `ubccpsc/classy`):

1. The Pull Request must pass all existing tests. New contributions should not require existing tests to be changed as other courses might depend on the modified behaviour; if you feel such a change is needed, please mention the rationale in the Pull Request comments.

2. The test coverage of the system must be maintained; the expected coverage rate for any given file should be 90%+. We require tests be provided for any new contributions as without these it is extremely challenging to ensure that future development for other courses will not break your new contribution.

3. Finally, any contributions must lint before they can be accepted. This can be run using `yarn run lint` in `classy/`. The global rules in `/tslint.json` should not be changed.

CircleCI testing [docs/cirleCI.md](can be setup) on a fork to ensure that coverage, test, and linting requirements are met. Constant notification of whether tests pass on each pushed change to your repository will help you discover and resolve conflicts between `ubccpsc` and the business logic of your fork quickly.

## Merging magic

## Main repos

* `ubccpsc/classy/master` (hereby `root`) is the stable source for the repo
* `<user>/classy/master` (hereby `fork`) is where classes are going to want to work (there will be many of these `fork` repos)

## Goals

* `fork/master` needs be able to make any changes it needs during the term without impacting `root/master`
* `fork/master` needs to be able to accept critical patches during the term from `root/master`
* `fork/master` needs be able to accept new feature changes at the end of the term, but only a ***subset*** of commits
* `fork/master` needs to be able to contribute changes to `root/master`

### Fork initialization

This only needs to happen once per fork, so if you already have a configured fork with a sync branch, you can ignore this step.

1. Fork `root` into a GitHub account you control (hereby called the `fork`).
2. Create a branch called `sync` on your `fork` (`git branch sync`) and create `fork/sync` on the server (`git push origin sync`).
3. Add the upstream branch `git remote add upstream https://github.com/ubccpsc/classy.git` ([LINK](https://help.github.com/articles/configuring-a-remote-for-a-fork/)).

## Development process

All `fork` changes should be made on `fork/master` or other branches (just ***not*** on `fork/sync`).

### Pulling changes from `root/master` into `fork/master`

This can happen regularly, whenever there is a `root/master` change that fixes a bug or adds a feature that the fork might want.

On `fork`:
1. `git checkout master`
1. `git fetch upstream` (pulls down the changes from `root/master` to your local repo).
1. `git merge upstream/master` (merges the changes into your local repo).
1. `git push` (pushes the changes from your local repo to its remote GitHub repo).

<img src="docs/assets/dev-local.png"/>

### Pushing changes from `fork` to `root/master`

This is ***not*** likely to happen during the term, except for critical patches but it _is_ likely to happen at the end of the term when new features should be upstreamed to `root`.

On `fork`:
1. Pull changes from `root/master` into `fork/sync` (described above but replace `master` with `sync` in the two relevant commands).
1. `git checkout sync` (probably already checked out).
1. `git cherry-pick -x <SHA>` for each `<SHA>` you want to upstream. BE CAREFUL: these commits should not include any course-specific code. Also, to clarify, these commits should be in the history of `fork/master`. Merge conflicts are likely at this step and need to be resolved before moving to the next step.
1. `git push origin sync` (sends cherry picked commits to server).
1. Open the `sync` branch in the GitHub web interface and make a pull request `fork/sync` to `root/master` (sends cherry picked commits to `root/master` that can then be evaluated in a PR before being merged into `root/master`).

<img src="docs/dev-upstream.png"/>

### Customizing your instance of Classy

1. To add to the backend, you should modify `packages/portal/backend/src/custom/CustomCourseController.ts` and `packages/portal/backend/src/custom/CustomRoutes.ts`. These changes should ***NOT*** be pushed back into `classy/master` but should only stay in the fork.
2. To add to the frontend, you should add the `pacakges/portal/frontend/src/app/custom/CustomStudentView.ts`. These changes should ***NOT*** be pushed back into `classy/master` but should only stay in the fork.

### About dev packages

Wherever possible, please try to minimize external package dependencies. Classy has been configured to use [yarn workspaces](https://yarnpkg.com/lang/en/docs/workspaces/#toc-how-to-use-it).
You should add global dependencies to the root `package.json` and package-specific dependencies in the package-level `package.json`.

Specific dev instructions are included in [`packages/portal/backend/README.md`](packages/portal/backend/README.md), [`packages/portal/frontend/README.md`](packages/portal/frontend/README.md), and [`packages/autotest/README.md`](packages/autotest/README.md).

## License

[MIT](LICENSE)
