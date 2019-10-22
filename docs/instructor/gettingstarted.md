# Getting Started

## Overview

At a high-level, an instructor will have to fulfill some requirements before they are ready to run a course that uses Classy:

Requirements:

- [ ] Requested [Classy for your Course](#requesting-classy-for-your-course)
- [ ] Performed [Back-end Setup](#back-end-setup) and [Front-end Setup](#front-end-setup)
        or: [Quick Front-end and Back-end Bootstrapping](#quick-front-end-and-back-end-bootstrapping)
- [ ] Tech Staff are notified that you want to use Classy at least three weeks in advance of course start date.
- [ ] Instructor has shadowed a course instructor who is currently offering Classy.
- [ ] Given Technical Staff a Github token to access private [AutoGrade Dockerfile repository](/docs/instructor/autograde.md#autograde-dockerfile-repository).

Reccomendations:

- [ ] Retain a TA to build-out Docker AutoGrade container.
- [ ] Add container logging that allows for quick debugging of container logic.

Syllabus and course instructions will need to be updated to work with *Github* workflows and *Git* version control. It is necessary that, before the start of the course, you are willing to set aside some time to experiment with Classy so that the documentation is sound.

## Requesting Classy for Your Course

You can formally request Classy for a course by contacting *CPSC Technical Staff*. Classy takes approximately two weeks to setup. Classy includes software, hardware, and CPSC technical staff resources that are necessary to run the software while meeting necessary legal standards, such as privacy and data laws.

Additional steps are: learning how to operate the course, training TAs, buiding out working container logic, and substituting current course instructions with updated Classy instructions. Please start a discussion with CPSC Technical Staff as soon as you develop an interest in using Classy.

## Quick Front-end and Back-end Bootstrapping

If no custom front-end and back-end files have been implemented, then the `default-file-setup.sh` script can automatically produce default implementations for you. Firstly, ensure that your `.env` file `NAME` property contains your course name. See [Configuring an .env file](/docs/tech-staff/configuring-env.MD) for more help.

- Then, from the root `./Classy` directory, run the Bash script `./helper-scripts/default-file-setup.sh`.

## Front-end Setup

Classy requires that front-end views are implemented to reflect your course logic. Custom views may be built, or alternatively, default views exist that can be copied into their appropriate areas. The front-end uses Onsen UI, which is a lightweight framework that uses vanilla Javascript and HTML templates in a MVC pattern. UI components and instructions for writing Custom View Model logic can be found here: https://onsen.io/v2/guide/#getting-started.

Any custom logic may also be implemented in the 'Custom' view model files if the files continue to extend the  `AdminView` and `AbstractStudentView` classes. Any number of subclasses can also be contained in this folder.  These changes should ***NOT*** be pushed back to `classy/master`.

### MUST IMPLEMENT

#### HTML

- packages/portal/frontend/html/{*name*}/custom.html
- packages/portal/frontend/html/{*name*}/landing.html
- packages/portal/frontend/html/{*name*}/login.html
- packages/portal/frontend/html/{*name*}/student.html

#### View Models

- packages/portal/frontend/src/app/custom/CustomStudentView.ts
- packages/portal/frontend/src/app/custom/CustomAdminView.ts
  
By running the Bash script above, files will be generated that allow you to either (a.) run the application with its defaults or (b.) modify the code to achieve unique business logic requirements.

## Back-end Setup

The back-end uses Restify, a RESTful API server, to provide data to the front-end. Customized boilerplate files are loaded by Restify at start-up. These boilerplate files may also be modified:

### Customizable Back-end Files

- Classy/packages/portal/backend/src/custom/CustomCourseRoutes.ts
- Classy/packages/portal/backend/src/custom/CustomCourseController.ts

`CustomCourseController.ts` extends `CourseController` because it is used in the most common course-specific overrides that require code. 

`CustomCourseRoutes.ts` implements `IREST`, which allows you to define any custom REST routes required by the backend. Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.
