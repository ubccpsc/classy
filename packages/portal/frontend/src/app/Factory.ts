import Log from "../../../../common/Log";
import {AdminView} from "./views/AdminView";
import {IView} from "./views/IView";

/**
 * Entry point for loading the course-specific student view and for a custom
 * admin view (if provided). This file should *NOT* need to be edited by forks.
 *
 */
export class Factory {

    private static instance: Factory = null;
    private name: string = null;

    private studentView: IView | null = null;
    private adminView: IView | null = null;

    private readonly TESTNAME = "classytest";

    /**
     * Use getInstance instead.
     */
    private constructor() {
    }

    public static getInstance(name?: string): Factory {
        if (Factory.instance === null) {
            Factory.instance = new Factory();
        }
        if (Factory.instance.name === null && typeof name !== "undefined") { // only set this once (first guard)
            Log.info("Factory::getInstance(..) - setting name: " + name);
            Factory.instance.name = name;
        }
        return Factory.instance;
    }

    /**
     * Checks for a custom controller. If one exists, there _must_ be custom html as well.
     *
     * @returns {boolean}
     */
    private customControllerExists(): boolean {
        let customController = null;
        try {
            // NOTE: we can't reference Config here because this is run client side
            // which does not have access to the .env file
            // Instead, CustomStudentView is copied in by webpack, if it exists in the configuration
            customController = require("./custom/CustomStudentView");
        } catch (err) {
            Log.info("Factory::customControllerExists() - Custom Controller NOT found for course: " + this.name);
        }
        return customController ? true : false;
    }

    public async getView(backendUrl: string): Promise<IView> {
        // Loads a custom view model if custom HTML code exists, default model for default html, etc.
        const customViewsExist = this.customControllerExists();

        try {
            if (this.studentView === null) {
                Log.info("Factory::getView() - instantiating new student view for: " + this.name);

                // NOTE: we can't reference Config here because this is run client side
                // which does not have access to the .env file
                // Instead, CustomStudentView is copied in by webpack, if it exists in the configuration

                let plug: any;
                if (name !== this.TESTNAME && customViewsExist === true) {
                    Log.info("Factory::getView() - instantiating new student view for: " + this.name + "; using CustomStudentView");
                    plug = await require("./custom/CustomStudentView"); // course-specific file;
                } else {
                    Log.info("Factory::getView() - instantiating new student view for: " + this.name +
                        "; using test DefaultStudentView");
                    plug = await require("./custom/DefaultStudentView"); // default for testing
                }
                Log.trace("Factory::getView() - view loaded");

                const constructorName = Object.keys(plug)[0];

                this.studentView = new plug[constructorName](backendUrl);
                Log.info("Factory::getView() - StudentView instantiated");
            }
        } catch (err) {
            Log.error("Factory::configureStudentView() - ERROR: " + err.message);
            Log.error("Factory::configureStudentView() - This likely means that your fork does not have a file called " +
                "classy/packages/portal/frontend/src/views/course/StudentView.ts which should extend AbstractStudentView");

            this.studentView = null;
        }

        return this.studentView;
    }

    public async getAdminView(backendUrl: string): Promise<IView> {
        const tabs = {
            deliverables: true,
            students: true,
            teams: true,
            results: true,
            grades: true,
            dashboard: true,
            config: true
        };

        const customViewsExist = this.customControllerExists();

        try {
            if (this.adminView === null) {
                Log.info("Factory::getAdminView() - instantating new admin view for: " + this.name);

                // NOTE: using require instead of import because file might not be present in forks
                // import complains about this, but require does not.
                let plug: any;

                if (name !== this.TESTNAME && customViewsExist === true) {
                    Log.info("Factory::getAdminView() - instantating new admin view for: " + this.name + "; using CustomAdminView");
                    plug = await require("./custom/CustomAdminView"); // course-specific file;
                } else {
                    Log.info("Factory::getAdminView() - instantating new admin view for: " + this.name + "; using test DefaultAdminView");
                    plug = await require("./custom/DefaultAdminView"); // default for testing
                }
                Log.trace("Factory::getAdminView() - view loaded");

                // if this fails an error will be raised and the default view will be provided in the catch below
                const constructorName = Object.keys(plug)[0];
                this.adminView = new plug[constructorName](backendUrl, tabs);

                Log.info("Factory::getAdminView() - AdminView instantiated");
            }
        } catch (err) {
            Log.info("Factory::getAdminView() - custom admin view not provided; using default AdminView");
            this.adminView = new AdminView(backendUrl, tabs);
        }

        return this.adminView;
    }

    /**
     *
     * Returns the name associated with the course instance.
     *
     * @returns {string}
     */
    public getName() {
        if (this.name === null) {
            // Just a sanity check; if this happens we have a real problem with the app init flow
            Log.error("Factory::getName() - name requested before being set!");
        }
        return this.name;
    }

    /**
     * Returns the prefix directory for the HTML files specific to the course.
     *
     * The required approach is to just put your html files in the
     * 'html/<courseName>' directory. You will also need to create a
     * CustomCourseController (even just an empty one that extends
     * DefaultCourseController).
     *
     * Examples of what these files can look like can be found in the test
     * implementations found in 'html/custom/' by looking at Default files.
     *
     * While you can have many files in this directory, several are required:
     *   - landing.html - This is the main course-specific landing page
     *   - login.html - This is the login page
     *   - student.html - This is the main student landing page
     *
     * @returns {string}
     */
    public getHTMLPrefix() {
        // FORK: Gets the default html/default/landing.html page unless your course
        // html pages are implemented in html/{name}/landing.html. ie. html/cs210/landing.html

        const customViewsExist = this.customControllerExists();

        Log.trace("Factory::getHTMLPrefix() - getting prefix for: " + this.name);
        if (this.name !== this.TESTNAME && customViewsExist === true) {
            // webpack has to copy files from the plugin into this html/<this.name>
            Log.info("Factory::getHTMLPrefix() - custom prefix for: " + this.name);
            return this.name;
        } else {
            Log.info("Factory::getHTMLPrefix() - using default prefix for: " + this.name);
            return "default";
        }
    }
}
