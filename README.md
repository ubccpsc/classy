# Classy

[![CircleCI](https://circleci.com/gh/ubccpsc/classy.svg?style=svg)](https://circleci.com/gh/ubccpsc/classy)
[![Coverage Status](https://coveralls.io/repos/github/ubccpsc/classy/badge.svg?branch=master&service=github)](https://coveralls.io/github/ubccpsc/classy?branch=master)

Classy is a classroom management system developed by the Department of Computer Science at UBC. Classy is tightly integrated with GitHub and has the ability to automatically provision student repositories, create teams, and mark assignments. Administrators can configure deliverables, enter grades, and view comprehensive dashboards of all student test executions. Students can use the system to create teams (if required) and view their grades and assignment feedback.

Primary contributors:

* [Reid Holmes](https://www.cs.ubc.ca/~rtholmes/)
* [Nick Bradley](https://nickbradley.github.io/)

## Contributing to Classy

Features that add value to the Classy project can be merged back into the main project if there is adequate code coverage (> 90%) and the feature has been tested in a downstream fork for a semester. Bug fixes can also be issued via PR back to `ubccpsc/classy` as required. Any feature that is practical, improves the ease of administering a course, and is likely to be used by instructors is likely to have value. Features that are only very customized around a course, and unlikely to be used by other instructors, will likely not be accepted as core Classy code.

To contribute code to Classy, setup a pull-request that has your code in a feature branch, ie. `feature/my-new-feature`, ready to merge into the root `ubccpsc/master` branch. The code should, ideally, be re-based to the `ubccpsc/master` branch before it is merged into `ubccpsc/master`. The re-base will eliminate any future downstream/upstream merge issues.

Any non-necessary files, such as custom back-end and front-end files should **NOT** be part of the pull-request. Please add non-necessary files to your `.gitignore` file.

Classy has been configured with CircleCI for validating work so that any pull-request that fails to pass CI will not be merged.

<!-- TOC depthfrom:2 -->

- [Contributing to Classy Project](/docs/developer/contributing.md)

<!-- /TOC -->

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
    - [3.2 Test a Container Checklist](/docs/instructor/autograde.md#test-a-container-checklist)
- [4. Portal Manual](/docs/instructor/portal.md#overview)
    - [4.1 Classlist Enrollment](/docs/instructor/portal.md#classlist-enrollment)
    - [4.2 Deliverable Configuration](/docs/instructors/portal.md#deliverable-configuration)
    - [4.3 Distributing Assignments and Repository Creation](/docs/instructor/portal.md#distributing-assignments-and-repository-creation)
- [5. AutoTest Manual](/docs/instructor/autotest.md#overview)
    - [5.1 User Types](/docs/instructor/autotest.md#user-types)
    - [5.2 Student AutoBot Commands](/docs/instructor/autotest.md#student-autobot-commands)
  
<!-- /TOC -->

### Developers

<!-- TOC depthfrom:2 -->

- [1. Bootstrapping Classy for Development](/docs/developer/bootstrap.md)
  - [1.1 Software Dependencies](/docs/developer/bootstrap.md#software-dependencies)
  - [1.2 Environmental Config](/docs/developer/bootstrap.md#environmental-config)
  - [1.2 Install/Build/Run](/docs/developer/bootstrap.md#install-build-run)
- [2. Contributing to Classy](#contributing-to-classy)
- [3. Setup CircleCI & Coveralls](/docs/developer/continuousintegration.md)

<!-- /TOC -->

### Technical Staff

<!-- TOC depthfrom:2 -->

- [1. Architecture](/docs/tech-staff/architecture.md)
- [2. Operations](/docs/tech-staff/operations.md)
    - [2.1 Hardware Requirements](/docs/tech-staff/hardware.md)
    - [2.2 Fork Customization](/docs/tech-staff/forkcustomization.md)
    - [2.3 Installation](/docs/tech-staff/install.md)
        - [2.3.1 Software Dependencies](/docs/tech-staff/install.md#software-dependencies)
        - [2.3.2 Install Classy](/docs/tech-staff/install.md#install-classy)
        - [2.3.2 System Configuration](/docs/tech-staff/install.md#create-user-group)
        - [2.3.3 Create SSL Certificates](/docs/tech-staff/install.md#create-ssl-certificates)
        - [2.3.4 Configure Firewall Rules](/docs/tech-staff/install.md#create-firewall-rules)
    - [2.3 Github Setup](/docs/tech-staff/githubsetup.md)
    - [2.4 Backup Configuration](/docs/tech-staff/backups.md)
    - [2.5 Build/Start/Stop Classy](/docs/tech-staff/operatingclassy.md)
    - [2.6 Patching](/docs/tech-staff/updates.md)
      - [2.6.1 Operating System](/docs/tech-staff/updates.md#operating-system)
      - [2.6.2 Classy](/docs/tech-staff/updates.md#classy)

<!-- /TOC -->

## License

[MIT](LICENSE)
