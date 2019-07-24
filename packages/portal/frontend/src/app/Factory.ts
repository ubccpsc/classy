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

    private readonly TESTNAME = 'classytest';

    /**
     * Use getInstance instead.
     */
    private constructor() {
    }

    public static getInstance(name?: string): Factory {
        if (Factory.instance === null) {
            Factory.instance = new Factory();
        }
        if (Factory.instance.name === null && typeof name !== 'undefined') { // only set this once (first guard)
            Log.info("Factory::getInstance(..) - setting name: " + name);
            Factory.instance.name = name;
        }
        return Factory.instance;
    }

    public async getView(backendUrl: string): Promise<IView> {
        try {
            if (this.studentView === null) {
                Log.info("Factory::getView() - instantiating new student view for: " + this.name);

                // NOTE: using require instead of import because file might not be present in forks
                // import complains about this, but require does not
                let plug: any;
                if (name === this.TESTNAME) {
                    plug = await require('./views/classy/ClassyStudentView'); // default for testing
                } else {
                    plug = await require('./custom/CustomStudentView'); // course-specific file; must be present in all forks
                }

                Log.trace("Factory::getView() - view loaded");

                const constructorName = Object.keys(plug)[0];
                // Log.info("Factory::getView()  - with constructor: " + constructorName);

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
        const fs = require('fs');
        const tabs = {
            deliverables: true,
            students:     true,
            teams:        true,
            results:      true,
            grades:       true,
            dashboard:    true,
            config:       true
        };

        try {
            if (this.adminView === null) {
                Log.info("Factory::getAdminView() - instantating new admin view for: " + this.name);

                // NOTE: using require instead of import because file might not be present in forks
                // import complains about this, but require does not.
                let plug: any;
                if (name === this.TESTNAME) {
                    plug = await require('./views/classy/ClassyAdminView'); // default for testing
                } else if (fs.exists('./' +  this.name)) { // IF SOME DIRECTORY EXISTS AND EQUALS NAME OF
                    Log.info('enter code here');
                    // If a course wants to specialize the AdminView it should be in the file below.
                    // This is not required. But if it is added, it should never be pushed back to 'classy/master'
                    plug = await require('./custom/CustomAdminView');
                } else {
                    // If default view should be loaded when there is no custom implementation
                    plug = await require('./custom/CustomAdminView');
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
     * The recommended approach is to just put your html files in the
     * 'html/<courseName>' directory.
     *
     * Examples of what these files can look like can be found in the test
     * implementations found in 'html/classy/'.
     *
     * While you can have many files in this directory, several are required:
     *   - landing.html - This is the main course-specific landing page
     *   - login.html - This is the login page
     *   - student.html - This is the main student landing page
     *
     * @returns {string}
     */
    public getHTMLPrefix() {
        // FORK: You probably do not need to change this unless you want your course
        // name to be different than the directory your html files are stored in.
        Log.trace("Factory::getHTMLPrefix() - getting prefix for: " + this.name);
        if (this.name === 'classytest') {
            return 'classy';
        } else {
            return this.name;
        }
    }
}
