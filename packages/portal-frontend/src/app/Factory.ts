// import {SDMMSummaryView} from "./views/sdmm/SDMMSummaryView";
import Log from "../../../common/Log";

import {IView} from "./views/IView";
import {AdminView} from "./views/AdminView";

import {CS310View} from "./views/cs310/CS310View";
import {CS340View} from "./views/340/CS340View";
import {CS340AdminView} from "./views/340/CS340AdminView";
import {SDMMSummaryView} from "./views/sdmm/SDMMSummaryView";

/**
 * Entry point for configuring per-course aspects of the frontend.
 *
 * While course options will be hardcoded in here (e.g., with strings
 * corresponding to their org name), the file should only need to be
 * modified when new courses are added; not during active development.
 *
 * The current org will be pulled from the backend when App starts and
 * set here; this means that the org should only be specified in the
 * .env file on the portal-backend.
 *
 */
export class Factory {

    private static instance: Factory = null;
    private org: string = null;

    private studentView: IView | null = null;
    private adminView: IView | null = null;

    /**
     * Use getInstance instead.
     */
    private constructor() {
    }

    public static getInstance(org?: string): Factory {
        if (Factory.instance === null) {
            Factory.instance = new Factory();
        }
        if (Factory.instance.org === null && typeof org !== 'undefined') { // only set this once (first guard)
            Log.info("Factory::getInstance(..) - setting org: " + org);
            Factory.instance.org = org;
        }
        return Factory.instance;
    }

    public getView(backendUrl: string): IView {
        if (this.studentView === null) {
            Log.trace("Factory::getView() - instantating new view");
            if (this.org === 'classytest') {
                this.studentView = new CS310View(backendUrl); // default to 310 for testing
            } else if (this.org === 'sdmm') {
                this.studentView = new SDMMSummaryView(backendUrl);
            } else if (this.org === 'CS310-2017Jan' || this.org === 'CS310-2017Jan_TEST') {
                this.studentView = new CS310View(backendUrl);
            } else if (this.org === 'cs340' || this.org === 'cpsc340') {
                this.studentView = new CS340View(backendUrl);
            } else {
                Log.error("Factory::getView() - ERROR; unknown org: " + this.org);
            }
        }
        return this.studentView;
    }

    public getAdminView(backendUrl: string): IView {
        if (this.adminView === null) {
            Log.trace("Factory::getAdminView() - instantating new view for: " + this.org);
            let tabs = {
                deliverables: true,
                students:     true,
                teams:        true,
                results:      true,
                grades:       true,
                dashboard:    true,
                config:       true
            };

            if (this.org === 'sdmm') {
                this.adminView = new AdminView(backendUrl, tabs);
            } else if (this.org === 'CS310-2017Jan' || this.org === 'CS310-2017Jan_TEST' || this.org === 'classytest') {
                // tabs.deliverables = false;
                // tabs.students = false;
                // tabs.teams = false;
                // tabs.grades = false;
                // tabs.results = false;
                // tabs.dashboard = false;
                // tabs.config = false;
                this.adminView = new AdminView(backendUrl, tabs);
            } else if (this.org === 'cs340' || this.org === 'cpsc340') {
                tabs.teams = false; // no teams
                tabs.results = false; // no results
                tabs.dashboard = false; // no dashboard
                this.adminView = new CS340AdminView(backendUrl, tabs);
            } else {
                Log.error("Factory::getView() - ERROR; unknown org: " + this.org);
            }
        }
        return this.adminView;
    }

    /**
     *
     * Returns the org associated with the course instance.
     *
     * @returns {string}
     */
    public getOrg() {
        if (this.org === null) {
            // Just a sanity check; if this happens we have a real problem with the app init flow
            Log.error("Factory::getOrg() - org requested before being set!");
        }
        return this.org;
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
     *   - admin.html - This is the main admin landing page
     *
     * @returns {string}
     */
    public getHTMLPrefix() {
        if (this.org === 'classytest') {
            return 'cs310'; // might need to change this per-course for testing
        } else if (this.org === 'sdmm') {
            return 'sdmm';
        } else if (this.org === 'CS310-2017Jan' || this.org === 'CS310-2017Jan_TEST') {
            return 'cs310';
        } else if (this.org === 'cs340' || this.org === 'cpsc340') {
            return 'cs340';
        } else {
            Log.error("Factory::getHTMLPrefix() - ERROR; unknown org: " + this.org);
        }
    }
}
