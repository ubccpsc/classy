# Fork Customization

Each CPSC course that uses Classy requires a fork of the `root` [https://github.com/ubccpsc/classy] repository. The fork is used to change code that is custom to a course. Even if you do not plan to change the default Classy code, it is required that you create a fork of the repository because your fork will act as a stable code source that technical staff can run your Classy instance on.

Process Overview: Fork Code from Root Classy Repository --> Optional: Modify Forked Classy Code --> Technical Staff Hosts Code on Server

## Classy Customization

Classy requires that a set of custom files are implemented for each course offering. These files allow you to customize your course by modifying the views on the front-end and the controller logic on the back-end. As most courses require very standard logic, custom files can automatically be generated from default boilerplates. To generate your custom files:

- Double-check that your `.env` file `NAME` property contains your course name. The file may be found in the root `./Classy/.env`.
- Then, run the Bash script `./helper-scripts/default-file-setup.sh` from the root `./Classy` directory.

By running the Bash script above, files will be generated that allow you to either (a.) run the application with its defaults or (b.) modify the code to achieve unique business logic requirements.

## Modifying the Front-end

The front-end uses Onsen UI, which is a lightweight framework that uses vanilla Javascript and HTML templates in a MVC pattern. UI components and instructions for writing Custom View Model logic can be found here: https://onsen.io/v2/guide/#getting-started.

If you are famiiar with the MVC pattern and would like to modify the view, familiarize yourself with the set of custom files that are generated:

### HTML

- packages/portal/frontend/html/{*name*}/custom.html
- packages/portal/frontend/html/{*name*}/landing.html
- packages/portal/frontend/html/{*name*}/login.html
- packages/portal/frontend/html/{*name*}/student.html

### View Models

- packages/portal/frontend/src/app/custom/CustomStudentView.ts
- packages/portal/frontend/src/app/custom/CustomAdminView.ts

You may modify any of these files generated above. Any custom logic may also be implemented in the 'Custom' view model files if the files continue to extend the  `AdminView` and `AbstractStudentView` classes. Any number of subclasses can also be contained in this folder.  These changes should ***NOT*** be pushed back to `classy/master`.

## Modifying the Back-end

The back-end uses Restify, a RESTful API server, to provide data to the front-end. Customized boilerplate files are loaded by Restify at start-up. These boilerplate files may also be modified:

### Customizable Back-end Files

- Classy/packages/portal/backend/src/custom/CustomCourseRoutes.ts
- Classy/packages/portal/backend/src/custom/CustomCourseController.ts

`CustomCourseController.ts` extends `CourseController` because it is used in the most common course-specific overrides that require code. 

`CustomCourseRoutes.ts` implements `IREST`, which allows you to define any custom REST routes required by the backend. Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.

## Restoring Default Application State

The default files used to create the custom boilerplate files can be found in the `default-file-setup.sh` script. To revert to the default state, remove all of the custom files from front-end and back-end applications, and then re-run `default-file-setup.sh` from the `./Classy` directory.

## Test Fork Customization 

Continuous Integration (CI) tests can be run to ensure that your front-end and back-end implementations work. If all tests pass, then Classy will run in Production. To implement CI tests, follow the [`/docs/continuous-integration-setup.md`](/docs/continuous-integration-setup.md) instructions.
