# Fork Customization

Each CPSC course that uses Classy requires a fork of the `root` https://github.com/ubccpsc/classy repository. The fork is used to change code that is custom to a course. Even if you do not plan to change the default Classy code, it is required that you create a fork of the repository because your fork will act as a stable code source that technical staff can run your Classy instance on while code changes are pushed to the root repository.

Process Overview: Fork Code from Root Classy Repository --> Optional: Modify Forked Classy Code --> Technical Staff Hosts Code on Server

## Front-End Customization

The front-end uses Onsen UI, which is a lightweight UI framework that uses vanilla Javascript and HTML templates in a MVC pattern. If a fork would like to modify the default views in Classy, it is necessary to create these custom files from their default counterparts:

**IF you create Custom HTML Views, you must ALSO create custom view models**

### Step 1: CREATE CUSTOM HTML VIEWS

- Copy the contents of `Classy/packages/portal/frontend/html/default` to `Classy/packages/portal/frontend/html/*name*`. The name variable MUST be the `name` variable found in `Classy/.env`)
- The previous step copies the REQUIRED HTML templates: `landing.html`, `login.html`, and `student.html`. Any custom HTML templates may be added here.

UI components and instructions for writing Custom View Model logic can be found here: https://onsen.io/v2/guide/#getting-started.

### Step 2: *CREATE CUSTOM VIEW MODELS*

In `Classy/packages/portal/frontend/src/app/custom`:

- Copy `./DefaultAdminView.ts` to `./CustomAdminView.ts`
- Copy `./DefaultStudentView.ts` to `./CustomStudentView.ts`

Any custom logic may be implemented in the 'Custom' view model files if the files continue to extend the  `AdminView` and `AbstractStudentView` classes. Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.

## Back-End Customization

The back-end uses Restify, a RESTful API server, to provide data to the front-end. Customized back-end controllers and routes MUST be implemented:

In `Classy/packages/portal/backend/src/custom`:

* Copy `DefaultCourseController.ts` to create `CustomCourseController.ts`. `CustomCourseController` extends `CourseController`, which is used for the most common course-specific overrides that require code
* Copy `DefaultCourseRoutes.ts` to create `CustomCourseRoutes.ts`. `CustomCourseRoutes.ts` implements `IREST`, which allows you to define any custom REST routes required by the backend.

Any number of subclasses can also be contained in this folder. These changes should ***NOT*** be pushed back to `classy/master`.

## Test Fork Customization 

Continuous Integration (CI) tests can be run to ensure that your front-end and back-end implementations work. If all tests pass, then Classy will run in Production. To implement CI tests, follow the `Classy/docs/continuous-integration-setup.md` instructions.