import {SDMMSummaryView} from "./sdmm/SDMMSummaryView";
import Log from "../../../../common/Log";

export class ViewFactory {

    private static instance: ViewFactory = null;
    private org: string = null;

    /**
     * Use getInstance instead.
     */
    private constructor() {
    }

    public static getInstance(org?: string): ViewFactory {
        if (ViewFactory.instance === null) {
            ViewFactory.instance = new ViewFactory();
        }
        if (ViewFactory.instance.org === null && typeof org !== 'undefined') { // only set this once (first guard)
            Log.info("ViewFactory::getInstance(..) - setting org: " + org);
            ViewFactory.instance.org = org;
        }
        return ViewFactory.instance;
    }

    public getView(backendUrl: string) {
        if (this.org === 'sdmm') {
            return new SDMMSummaryView(backendUrl);
        } else if (this.org === 'cs340') {
            // something else
        } else {
            Log.error("ViewFactory::getView() - ERROR; unknown org: " + this.org);
        }
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
            Log.error("ViewFactory::getOrg() - org requested before being set!");
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
        if (this.org === 'sdmm') {
            return 'sdmm';
        } else if (this.org === 'cs340') {
            return 'cs340';
        } else {
            Log.error("ViewFactory::getHTMLPrefix() - ERROR; unknown org: " + this.org);
        }
    }
}