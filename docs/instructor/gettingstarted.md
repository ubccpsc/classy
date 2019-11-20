# Getting Started

## Overview

Classy requires some implementation work and learning before it can be used in a course. Here are some first steps to get you started:

- [ ] Shadow a course that uses Classy before you begin to use it
- [ ] Request [Classy for your Course](#requesting-classy-for-your-course) at least three weeks in advance of course start date.
- [ ] Implement [Back-end Setup](#back-end-setup) and [Front-end Setup](#front-end-setup)
        or: [Quick Front-end and Back-end Bootstrapping](#quick-front-end-and-back-end-bootstrapping)
- [ ] Give tech staff a Github token to access [AutoGrade Dockerfile Repository](/docs/instructor/autograde.md#autograde-dockerfile-repository).

Nice-to-have's:

- [ ] Retain a TA to build-out Docker AutoGrade container.
- [ ] Add container logging that allows for quick debugging of container logic.

Github is integrated with Classy and Github requires that you use Git version control. Syllabus and course instructions will need to be updated to work with *Git* version control.

## Requesting Classy for Your Course

You must formally request Classy by notifying *CPSC Technical Staff*. Classy takes approximately two weeks to setup because of software, hardware, and CPSC technical staff resources that are necessary to run the software while upholding privacy and data laws.

Please start a discussion with CPSC Technical Staff as soon as you develop an interest in using Classy.

## Quick Front-end and Back-end Bootstrapping

Classy requires that you implement a front-end and back-end. These files can be produced automatically by the `/helper-scripts/default-file-setup.sh` if you are happy with default views and behaviour.

Your `.env` file must have a `NAME` property before running the script. See [Configuring an .env file](/docs/tech-staff/configuring-env.MD) for more information.

## Front-end Setup

The front-end uses Onsen UI, which is a lightweight JavaScript framework in a MVC pattern. UI components and instructions for writing MVC logic can be found in the [OnsenUI: Getting Started Guide](https://onsen.io/v2/guide/#getting-started). If you are not using the default front-end views, then you must build a custom front-end.

Any custom logic may also be implemented in the `packages/portal/frontend/src/app/custom/` directory.

Your view model files should continue to extend the  `AdminView` and `AbstractStudentView` classes. Any number of subclasses can also be contained in this folder. 

These changes should ***NOT*** be pushed back to `classy/master`.

### Implement HTML

- packages/portal/frontend/html/{*name*}/custom.html
- packages/portal/frontend/html/{*name*}/landing.html
- packages/portal/frontend/html/{*name*}/login.html
- packages/portal/frontend/html/{*name*}/student.html

### Implement View Models

- packages/portal/frontend/src/app/custom/CustomStudentView.ts
- packages/portal/frontend/src/app/custom/CustomAdminView.ts

## Back-end Setup

The back-end uses Restify, a RESTful API server, to provide data to the front-end. Customized boilerplate files are loaded by Restify at start-up. These boilerplate files may also be modified:

### Implement Back-end Files

- Classy/packages/portal/backend/src/custom/CustomCourseRoutes.ts
- Classy/packages/portal/backend/src/custom/CustomCourseController.ts

The `CustomCourseController.ts` file should extend the `CourseController` class.

`CustomCourseRoutes.ts` implements `IREST`, which allows you to define any custom REST routes required by the backend. Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.
