# Getting Started

## Overview

At a high-level, an instructor will have to fulfill some requirements before they are ready to run Classy in a course:

Requirements:

- [ ] Request [Classy for your Course](#requesting-classy-for-your-course)
- [ ] Implement [Back-end Setup](#back-end-setup) and [Front-end Setup](#front-end-setup)
        or: [Quick Front-end and Back-end Bootstrapping](#quick-front-end-and-back-end-bootstrapping)
- [ ] Tech Staff are notified that you want to use Classy at least three weeks in advance of course start date.
- [ ] Instructor has shadowed a course instructor who is currently offering Classy.
- [ ] Instructor has given technical staff a Github token to access private [AutoGrade Dockerfile repository](/docs/instructor/autograde.md#autograde-dockerfile-repository).

Reccomendations:

- [ ] Retain a TA to build-out Docker AutoGrade container.
- [ ] Add container logging that allows for quick debugging of container logic.

Syllabus and course instructions will need to be updated to work with *Github* workflows and *Git* version control. It is necessary that, before the start of the course, an instructor sets aside some time to experiment with Classy so that the fully scope of the application is understood.

## Requesting Classy for Your Course

You must formally request Classy by contacting *CPSC Technical Staff* to use Classy in a course. Classy takes approximately two weeks to setup. Classy requires software, hardware, and CPSC technical staff resources that are necessary to run the software while meeting necessary legal standards, such as privacy and data laws.

Additional steps to use Classy in a course are learning how to operate the course, training TAs, buiding out working container logic, and substituting current course instructions with updated Classy instructions. Please start a discussion with CPSC Technical Staff as soon as you develop an interest in using Classy.

## Quick Front-end and Back-end Bootstrapping

If no custom front-end and back-end files have been implemented, then the `default-file-setup.sh` script can automatically produce default implementations for you. Firstly, ensure that your `.env` file `NAME` property contains your course name. See [Configuring an .env file](/docs/tech-staff/configuring-env.MD) for more help.

- Then, from the root `./Classy` directory, run the Bash script `./helper-scripts/default-file-setup.sh`.

## Front-end Setup

Classy requires that front-end views are implemented for your course. Custom views may be built, but, alternatively, default views exist that can be copied into custom areas by following the [Quick Front-end and Back-end Bootstrapping instructions](#quick-front-end-and-back-end-bootstrapping). The front-end uses Onsen UI, which is a lightweight JavaScript framework in a MVC pattern. UI components and instructions for writing MVC logic can be found in the [OnsenUI: Getting Started Guide](https://onsen.io/v2/guide/#getting-started).

Any custom logic may also be implemented in the 'Custom' view model files if the files continue to extend the  `AdminView` and `AbstractStudentView` classes. Any number of subclasses can also be contained in this folder.  These changes should ***NOT*** be pushed back to `classy/master`.

### CUSTOM FRONT-END REQUIREMENTS

#### Implement HTML

- packages/portal/frontend/html/{*name*}/custom.html
- packages/portal/frontend/html/{*name*}/landing.html
- packages/portal/frontend/html/{*name*}/login.html
- packages/portal/frontend/html/{*name*}/student.html

#### Implement View Models

- packages/portal/frontend/src/app/custom/CustomStudentView.ts
- packages/portal/frontend/src/app/custom/CustomAdminView.ts

## Back-end Setup

The back-end uses Restify, a RESTful API server, to provide data to the front-end. Customized boilerplate files are loaded by Restify at start-up. These boilerplate files may also be modified:

### CUSTOM BACK-END REQUIREMENTS

#### Implement Back-end Files

- Classy/packages/portal/backend/src/custom/CustomCourseRoutes.ts
- Classy/packages/portal/backend/src/custom/CustomCourseController.ts

`CustomCourseController.ts` extends `CourseController` because it is used in the most common course-specific overrides that require code. 

`CustomCourseRoutes.ts` implements `IREST`, which allows you to define any custom REST routes required by the backend. Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.
