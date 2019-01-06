import Log from "../../../../common/Log";

import {AdminView} from "./views/AdminView";
import {CS310AdminView} from "./views/cs310/CS310AdminView";
import {CS310View} from "./views/cs310/CS310View";
import {IView} from "./views/IView";

/**
 * Entry point for configuring per-course aspects of the frontend.
 *
 * While course options will be hardcoded in here (e.g., with strings
 * corresponding to their org name), the file should only need to be
 * modified when new courses are added; not during active development.
 *
 * The current org will be pulled from the backend when App starts and
 * set here; this means that the org should only be specified in the
 * .env file on the backend.
 *
 */
export class Factory {

    private static instance: Factory = null;
    private name: string = null;

    private studentView: IView | null = null;
    private adminView: IView | null = null;

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

    public getView(backendUrl: string): IView {
        // FORK: You _will_ need to add a new block here for your course to point to your student view.
        // NOTE: this will be improved in the future.
        if (this.studentView === null) {
            Log.trace("Factory::getView() - instantating new view for: " + this.name);
            if (this.name === 'classytest') {
                this.studentView = new CS310View(backendUrl); // default to 310 for unit testing
            } else if (this.name === 'classy') {
                this.studentView = new CS310View(backendUrl); // default to 310 for deploy testing
            } else if (this.name === 'cs310') {
                this.studentView = new CS310View(backendUrl);
            } else {
                Log.error("Factory::getView() - ERROR; unknown name: " + this.name);
            }
        }
        return this.studentView;
    }

    public getAdminView(backendUrl: string): IView {
        // FORK: You probably do not need to modify this unless you have created
        // a custom admin view.
        if (this.adminView === null) {
            Log.trace("Factory::getAdminView() - instantating new view for: " + this.name);
            const tabs = {
                deliverables: true,
                students:     true,
                teams:        true,
                results:      true,
                grades:       true,
                dashboard:    true,
                config:       true
            };

            if (this.name === 'classytest') {
                // tabs.deliverables = false;
                // tabs.students = false;
                // tabs.teams = false;
                // tabs.grades = false;
                // tabs.results = false;
                // tabs.dashboard = false;
                // tabs.config = false;
                this.adminView = new AdminView(backendUrl, tabs); // default admin
            } else if (this.name === 'cs310') {
                this.adminView = new CS310AdminView(backendUrl, tabs);
            } else {
                Log.info("Factory::getAdminView() - returning default admin view for: " + this.name);
                this.adminView = new AdminView(backendUrl, tabs); // default admin
            }
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
     * This allows courses to have different HTML prefixes than their course
     * identifiers (useful if multiple orgs should be served by the same prefix).
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
        // name to be different than the directory your htmnl files are stored in.
        Log.trace("Factory::getHTMLPrefix() - getting prefix for: " + this.name);
        if (this.name === 'classytest') {
            return 'cs310'; // might need to change this per-course for testing
        } else {
            return this.name;
        }
    }
}
