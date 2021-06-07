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

## Default Classy Plugin

Classy comes with default MVC, course controller, and route logic that is available for any instructor to use. The default plugin is generic Classy logic that meet the requirements of most courses. The default plugin can be copied to a new folder and completely customized by your course. For more information, visit the [Customization](/docs/developer/customization.md) section of the table of contents.

### Admin Students Panel

*Displays basic student information.*

<img src="../assets/admin-view-students.png/">

### Admin Results Panel

*Displays basic the result recordd with the highest scores per single or team repository.*

<img src="../assets/admin-view-results.png/">

### Admin Dashboard Panel

*Displays the spread of grade, test coverage, and test score percentages per deliverable.*

<img src="../assets/admin-view-dashboard.png/">

### Admin Grades Panel

*Displays student grades per deliverable with a summary of grade averages.*

<img src="../assets/admin-view-grades.png/">

## Bootstrapping Default Views & Logic

Classy requires that you implement a front-end and back-end. These files can be produced automatically by the `/helper-scripts/default-file-setup.sh` if you are happy with default views and behaviour.

Your `.env` file must have a `NAME` property before running the script. See [Configuring an .env file](/docs/tech-staff/envconfig.md) for more information.

## Front-end Setup

The front-end uses Onsen UI, which is a lightweight JavaScript framework in a MVC pattern. UI components and instructions for writing MVC logic can be found in the [OnsenUI: Getting Started Guide](https://onsen.io/v2/guide/#getting-started).

## Back-end Setup

The back-end uses Restify, a RESTful API server, to provide data to the front-end. Customized boilerplate files are loaded by Restify at start-up. These files are found in the `plugins/default/portal/backend` folder.
