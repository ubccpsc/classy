# Getting Started

## Overview

Classy requires resources to setup, maintain, and customize before it can be effectively and reliably used to mark assignments at scale.

Syllabus and course instructions will need to be updated to work with *Github* workflows and *Git* version control system logic. It is necessary that, before the start of the course, you are willing to set aside some time to use Classy and learn how it works.

## Requesting Classy for Your Course

You can formally request to use Classy by contacting *CPSC Technical Staff* up until 2 weeks before the start of a course. Classy includes software, hardware, and CPSC technical staff resources that are required to run the software while upholding UBC privacy and data integrity requirements.

Instructor Requirements:

- Tech Staff are notified that you want to use Classy at least three weeks in advance of course start date.
- Minimal experience or strong familiarity with Docker.
- Knowledge of programming language ecosystem and tools needed to automate grading in a container environment.
- Update course documentation and format to reflect new Classy procedures.

Instructor Reccomendations:

- Retain a TA to build-out Docker AutoGrade container.
- Currently familiar with Github ecosystem.
- Shadow an instructor currently using Classy.

## Quick Front-end and Back-end Bootstrapping

If no custom front-end and back-end files have been implemented, then the `default-file-setup.sh` script can automatically produce default implementations for you. Firstly, ensure that your `.env` file `NAME` property contains your course name. See [Configuring an .env file](/docs/tech-staff/configuring-env.MD) for more help.

- Then, from the root `./Classy` directory, run the Bash script `./helper-scripts/default-file-setup.sh`.

## Front-end Setup

Classy requires that front-end views are implemented to reflect your course logic. Custom views may be built, or alternatively, default views exist that can be copied into their appropriate areas. The front-end uses Onsen UI, which is a lightweight framework that uses vanilla Javascript and HTML templates in a MVC pattern. UI components and instructions for writing Custom View Model logic can be found here: https://onsen.io/v2/guide/#getting-started.

Any custom logic may also be implemented in the 'Custom' view model files if the files continue to extend the  `AdminView` and `AbstractStudentView` classes. Any number of subclasses can also be contained in this folder.  These changes should ***NOT*** be pushed back to `classy/master`.

### Files that must be implemented

#### HTML

- packages/portal/frontend/html/{*name*}/custom.html
- packages/portal/frontend/html/{*name*}/landing.html
- packages/portal/frontend/html/{*name*}/login.html
- packages/portal/frontend/html/{*name*}/student.html

#### View Models

- packages/portal/frontend/src/app/custom/CustomStudentView.ts
- packages/portal/frontend/src/app/custom/CustomAdminView.ts
- 
By running the Bash script above, files will be generated that allow you to either (a.) run the application with its defaults or (b.) modify the code to achieve unique business logic requirements.

## Back-end Setup

The back-end uses Restify, a RESTful API server, to provide data to the front-end. Customized boilerplate files are loaded by Restify at start-up. These boilerplate files may also be modified:

### Customizable Back-end Files

- Classy/packages/portal/backend/src/custom/CustomCourseRoutes.ts
- Classy/packages/portal/backend/src/custom/CustomCourseController.ts

`CustomCourseController.ts` extends `CourseController` because it is used in the most common course-specific overrides that require code. 

`CustomCourseRoutes.ts` implements `IREST`, which allows you to define any custom REST routes required by the backend. Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.
