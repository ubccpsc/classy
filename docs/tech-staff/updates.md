# Patching

<!-- TOC depthfrom:2 -->
- [Patching](#patching)
  - [Operating System](#operating-system)
  - [Classy](#classy)
<!-- /TOC -->

## Operating System

Hardware is hosted on VM infrastructure that must be maintained with the latest security releases and updates. Patching the OS is based off of standard OS update procedures.  

If it is necessary to stop and start Classy, then follow the [2.3 Build/Start/Stop Classy](/docs/tech-staff/startstop.md) build, start, and stop steps in the README.md.

## Classy

Patching Classy, or its software dependencies, requires [Stopping](/docs/tech-staff/startstop.md#stopping-classy) and [Starting](/docs/tech-staff/startstop.md#starting-classy) Classy.

Classy is hosted on Github to manage version control. The Classy repository is cloned on a VM during installation. Git is installed on the VM operating system and the `.git` folder is left in the installation directory found in [Installation: Install Classy](/docs/tech-staff/install.md#install-files).

Classy installations will use the `master` branch of a downstream repository that is assigned to the course, unless otherwise directed by the course instructor. Any upstream project changes from `https://github.com/ubccpsc/classy` will be merged by an instructor or developer. Hence, any updated code that is approved for a course will already be merged and ready to pull into the `master` branch of the downstream Classy project for a course.

From *within the installation directory*, to pull in changes:

- type `git status`.
  - If any changes are *staged* or *not staged* for a commit, then abort the update and check with the instructor for further instructions on how to proceed with the update.
  - It is *normal* to see a list of untracked files in a `custom` folder, which hosts customized front-end and back-end instructor logic. You are safe to proceed with the next step.
- Type `git branch` to ensure that you are on the `master` branch of the project.
  - If you are not on the `master` branch, then abort the update and check with the instructor for further instructions on how to proceed with the update.
- If no changes are *staged* or *not staged* for a commit in the `git status` command, then type `git pull`. The `pull` command will bring in the latest changes from the branch.
- Re-build the project by typing `docker-compose build`. This will compile the code and Dockerize the applications.
- If the build successfully completes, then type `docker-compose up -d` to run the application in detached mode.
- Go to the http path of the application (ie. https://classy-dev.students.cs.ubc.ca) to ensure that the application is running as intended.

In the case that software dependencies must be updated, then follow the [2.3 Starting/Stopping Classy](/docs/tech-staff/startstop.md) build, start, and stop steps in the `README.md` after updating the software.
