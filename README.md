# Classy

[![CircleCI](https://circleci.com/gh/ubccpsc/classy.svg?style=svg)](https://circleci.com/gh/ubccpsc/classy)
[![Coverage Status](https://coveralls.io/repos/github/ubccpsc/classy/badge.svg?branch=master&service=github)](https://coveralls.io/github/ubccpsc/classy?branch=master)

Classy is a classroom management system developed by the Department of Computer Science at UBC. Classy is tightly integrated with GitHub and has the ability to automatically provision student repositories, create teams, and mark assignments. Administrators can configure deliverables, enter grades, and view comprehensive dashboards of all student test executions. Students can use the system to create teams (if required) and view their grades and assignment feedback.

Primary contributors:

* [Reid Holmes](https://www.cs.ubc.ca/~rtholmes/)
* [Nick Bradley](https://nickbradley.github.io/)
* [Andrew Stec](https://github.com/andrewstec/)
* [Braxton Hall](https://http://braxtonhall.ca/)
  
## Contributing to Classy

Features that add value to Classy should be merged back into the Classy project. Any feature that is practical, improves the administration of a course, and is useful to instructors is likely to add value and be accepted as core code. Features, on the other hand, that are only useful to a single course will likely not be accepted as core code. A feature needs to have adequate code coverage (> 90%) and have been tested for a semester in a downstream fork to be eligible as core code. Bug fixes always have value and can be merged via PR back to `ubccpsc/classy` as required.

To contribute code to Classy, create a PR that has your code in a feature branch (ie. `feature/my-new-feature`) ready to merge into the root `ubccpsc/master` branch. To ensure that the code is ready to merge, rebase your feature branch on the `ubccpsc/master` branch. Rebasing will help eliminate any later downstream and upstream merge conflicts. Classy has been configured with CircleCI for validating work. Any PRs must pass the CircleCI testsuites.

Any unnecessary files, such as custom back-end and front-end files should **NOT** be part of the PR. Add unnecessary files to your [Global Git Ignore Configuration](https://help.github.com/en/github/using-git/ignoring-files#create-a-global-gitignore).

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
    - [2.2 Default Classy Views](/docs/instructor/gettingstarted.md#default-classy-views)
    - [2.3 Bootstrapping Default Views & Logic](/docs/instructor/gettingstarted.md#bootstrapping-default-views-&-logic)
- [3. AutoGrade Setup](/docs/instructor/autograde.md#overview)
    - [3.1 Build a Container Checklist](/docs/instructor/autograde.md#build-a-container-checklist)
    - [3.2 QA Container Checklist](/docs/instructor/autograde.md#qa-container-checklist)
- [4. Portal Manual](/docs/instructor/portal.md#overview)
    - [4.1 Classlist Enrollment](/docs/instructor/portal.md#classlist-enrollment)
    - [4.2 Deliverable Configuration](/docs/instructor/portal.md#deliverable-configuration)
    - [4.3 Distributing Assignments and Repository Creation](/docs/instructor/portal.md#distributing-assignments-and-repository-creation)
- [5. AutoTest Manual](/docs/instructor/autotest.md#overview)
    - [5.1 User Types](/docs/instructor/autotest.md#user-types)
    - [5.2 Student AutoBot Commands](/docs/instructor/autotest.md#student-autobot-commands)
    - [5.3 Instructor AutoBot Commands](/docs/instructor/autotest.md#instructor-autobot-commands)
    - [5.4 Avoiding Queue Pile-ups](/docs/instructor/autotest.md#avoiding-queue-pile--ups)

<!-- /TOC -->

### Developers

<!-- TOC depthfrom:2 -->

- [1. Bootstrapping Classy for Development](/docs/developer/bootstrap.md)
  - [1.1 Software Dependencies](/docs/developer/bootstrap.md#software-dependencies)
  - [1.2 Environmental Config](/docs/developer/bootstrap.md#environmental-config)
  - [1.3 Install/Build/Run](/docs/developer/bootstrap.md#install-build-run)
- [2. Course Development/Customization](/docs/developer/customization.md)
  - [2.1 Application Customization](/docs/developer/customization.md#application-customization)
  - [2.2 Docker Containers/Supporting Services](/docs/developer/customization.md#docker-containers--supporting-services)
  - [2.3 Nginx & Routing](/docs/developer/customization.md#nginx--services-routing)
- [3. Contributing to Classy](#contributing-to-classy)
- [4. Setup CircleCI & Coveralls](/docs/developer/continuousintegration.md)

<!-- /TOC -->

### Technical Staff

<!-- TOC depthfrom:2 -->

- [1. Architecture](/docs/tech-staff/architecture.md#overview)
    - [1.1 Network Layer](/docs/tech-staff/architecture.md#network-layer)
    - [1.2 Application Layer](/docs/tech-staff/architecture.md#application-layer)
- [2. Hardware Requirements](/docs/tech-staff/hardware.md)
- [3. Installation](/docs/tech-staff/install.md)
    - [3.1 Software Dependencies](/docs/tech-staff/install.md#software-dependencies)
    - [3.2 Install Classy](/docs/tech-staff/install.md#install-classy)
    - [3.3 System Configuration](/docs/tech-staff/install.md#create-user-group)
    - [3.4 Create SSL Certificates](/docs/tech-staff/install.md#create-ssl-certificates)
    - [3.5 Configure Firewall Rules](/docs/tech-staff/install.md#create-firewall-rules)
- [4. Github Setup](/docs/tech-staff/githubsetup.md)
- [5. Backup Configuration](/docs/tech-staff/backups.md)
- [6. Build/Start/Stop Classy](/docs/tech-staff/operatingclassy.md)
- [7. Patching](/docs/tech-staff/updates.md)
    - [7.1 Operating System](/docs/tech-staff/updates.md#operating-system)
    - [7.2 Classy](/docs/tech-staff/updates.md#classy)
- [8. Term Transitions](/docs/tech-staff/termtransitions.md#overview)

<!-- /TOC -->

## License

[MIT](LICENSE)
