/**
 * This is the main implementation underlying the classy admin frontend.
 *
 * Other courses should _not_ modify this but instead build their own
 * admin views (if they need it) and put it in `course/AdminView.ts`.
 *
 * As much as possible, this class will forward requests to the tabs
 * for them to handle their own behaviour.
 *
 */

import Log from "@common/Log";
import {CourseTransport, CourseTransportPayload} from "@common/types/PortalTypes";

import {Factory} from "../Factory";
import {UI} from "../util/UI";

import {AdminConfigTab} from "./AdminConfigTab";
import {AdminDashboardTab} from "./AdminDashboardTab";
import {AdminDeliverablesTab} from "./AdminDeliverablesTab";
import {AdminGradesTab} from "./AdminGradesTab";
import {AdminResultsTab} from "./AdminResultsTab";
import {AdminStudentsTab} from "./AdminStudentsTab";
import {AdminTeamsTab} from "./AdminTeamsTab";
import {IView} from "./IView";

export interface AdminTabs {
    deliverables: boolean;
    students: boolean;
    teams: boolean;
    results: boolean;
    grades: boolean;
    dashboard: boolean;
    config: boolean;
}

export class AdminView implements IView {

    protected readonly remote: string | null = null;
    private readonly tabs: AdminTabs | null = null;

    protected isStaff = false;
    protected isAdmin = false;

    protected deliverablesTab: AdminDeliverablesTab;
    protected studentsTab: AdminStudentsTab;
    protected teamsTab: AdminTeamsTab;
    protected gradesTab: AdminGradesTab;
    protected resultsTab: AdminResultsTab;
    protected dashTab: AdminDashboardTab;
    protected configTab: AdminConfigTab;

    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("AdminView::<init>");

        this.remote = remoteUrl;
        this.tabs = tabs;

        this.deliverablesTab = new AdminDeliverablesTab(remoteUrl, this.isAdmin);
        this.studentsTab = new AdminStudentsTab(remoteUrl);
        this.teamsTab = new AdminTeamsTab(remoteUrl);
        this.gradesTab = new AdminGradesTab(remoteUrl);
        this.resultsTab = new AdminResultsTab(remoteUrl);
        this.dashTab = new AdminDashboardTab(remoteUrl);
        this.configTab = new AdminConfigTab(remoteUrl, this.isAdmin);
    }

    public renderPage(name: string, opts: any) {
        Log.info("AdminView::renderPage( " + name + ", ... ) - start; options: " + JSON.stringify(opts));

        if (this.tabs !== null) {
            this.setTabVisibility("AdminDeliverableTab", this.tabs.deliverables);
            this.setTabVisibility("AdminStudentTab", this.tabs.students);
            this.setTabVisibility("AdminTeamTab", this.tabs.teams);
            this.setTabVisibility("AdminResultTab", this.tabs.results);
            this.setTabVisibility("AdminGradeTab", this.tabs.grades);
            this.setTabVisibility("AdminDashboardTab", this.tabs.dashboard);
            this.setTabVisibility("AdminConfigTab", this.tabs.config);
        }

        if (typeof opts.isAdmin !== "undefined") {
            this.isAdmin = opts.isAdmin;
        }
        if (typeof opts.isStaff !== "undefined") {
            this.isStaff = opts.isStaff;
        }

        // update admin property for the tabs that need it
        this.deliverablesTab.setAdmin(this.isAdmin);
        this.configTab.setAdmin(this.isAdmin);

        if (this.isAdmin === false) {
            // hide the config tab if we are not an admin
            Log.info("AdminView::renderPage(..) - !admin; hiding config tab");
            this.setTabVisibility("AdminConfigTab", false);
        }

        // NOTE: This is a kind of reflection to find the function to call without hard-coding it
        // this calls `handle<PageName>`, so to make it work your IView subtype must have a method
        // with that name (which you set in your ons-page id attribute in your html file)
        const functionName = "handle" + name;
        if (typeof (this as any)[functionName] === "function") {
            Log.info("AdminView::renderPage(..) - calling: " + functionName);
            // NOTE: does not await; not sure if this is a problem
            (this as any)[functionName](opts);
        } else {
            Log.warn("AdminView::renderPage(..) - unknown page: " + name + " (function: " + functionName + " not defined on view).");
        }
    }

    private setTabVisibility(name: string, visible: boolean) {
        const e = document.getElementById(name);
        if (e !== null) {
            if (visible === false) {
                e.style.display = "none";
            }
        } else {
            Log.warn("AdminView::setTabVisibility( " + name + ", " + visible + " ) - tab not found");
        }
    }

    public static showError(failure: any) { // FailurePayload
        Log.error("AdminView::showError(..) - start");
        try {
            UI.hideModal(); // if one is visible, get rid of it
            // check to see if response is json
            const f = JSON.parse(failure);
            if (f !== null) {
                failure = f; // change to object if it is one
            }
        } catch (err) {
            // intentionally blank
        }
        if (typeof failure === "string") {
            Log.error("AdminView::showError(..) - failure: " + failure);
            UI.showAlert(failure);
        } else if (typeof failure.failure !== "undefined") {
            Log.error("AdminView::showError(..) - failure message: " + failure.failure.message);
            UI.showAlert(failure.failure.message);
        } else {
            Log.error("AdminView::showError(..) - Unknown message: " + failure);
            UI.showAlert("Action unsuccessful.");
        }
    }

    public static getOptions() {
        return {
            headers: {
                "Content-Type": "application/json",
                "user": localStorage.user,
                "token": localStorage.token
            }
        };
    }

    // called by reflection in renderPage
    protected async handleAdminRoot(opts: {}): Promise<void> {
        Log.info("AdminView::handleAdminRoot(..) - start");
        // Can init frame here if needed
        return;
    }

    // called by reflection in renderPage
    protected async handleAdminDeliverables(opts: {}): Promise<void> {
        Log.info("AdminView::handleAdminDeliverables(..) - start");
        return this.deliverablesTab.init(opts);
    }

    // called by reflection in renderPage
    protected async handleAdminConfig(opts: {}): Promise<void> {
        Log.info("AdminView::handleAdminConfig(..) - start");
        return this.configTab.init(opts);
    }

    // called by reflection in renderPage
    protected async handleAdminStudents(opts: any): Promise<void> {
        Log.info("AdminView::handleStudents(..) - start");
        return this.studentsTab.init(opts);
    }

    // called by reflection in renderPage
    protected async handleAdminTeams(opts: any): Promise<void> {
        Log.info("AdminView::handleTeams(..) - start");
        return this.teamsTab.init(opts);
    }

    // called by reflection in renderPage
    protected async handleAdminGrades(opts: any): Promise<void> {
        Log.info("AdminView::handleGrades(..) - start");
        return this.gradesTab.init(opts);
    }

    // called by reflection in renderPage
    protected async handleAdminResults(opts: any): Promise<void> {
        Log.info("AdminView::handleResults(..) - start");
        return this.resultsTab.init(opts);
    }

    // called by reflection in renderPage
    protected async handleAdminDashboard(opts: any): Promise<void> {
        Log.info("AdminView::handleDashboard(..) - start");
        return this.dashTab.init(opts);
    }

    protected handleAdminEditDeliverable(opts: any) {
        // this will call render
        this.deliverablesTab.initEditDeliverablePage(opts).then(function () {
            // blank
        }).catch(function (err) {
            // blank
        });
    }

    public pushPage(pageName: string, opts: {}) {
        Log.info("AdminView::pushPage( " + pageName + ", ... ) - start");
        if (typeof opts !== "object") {
            opts = {};
        }
        const prefix = Factory.getInstance().getHTMLPrefix();
        UI.pushPage(prefix + "/" + pageName, opts).then(function () {
            // success
        }).catch(function (err) {
            Log.error("UI::pushPage(..) - ERROR: " + err.message);
        });
    }

    public static async getCourse(remote: string): Promise<CourseTransport> {
        try {
            // UI.showModal("Retrieving config.");

            // get class options
            const options = AdminView.getOptions();
            const url = remote + "/portal/admin/course";
            const response = await fetch(url, options);
            // UI.hideModal();

            // const courseOptions: CourseTransport = null;
            const start = Date.now();
            if (response.status === 200 || response.status === 400) {
                Log.trace("AdminView::getCourse(..) - 200 received for course options");
                const json: CourseTransportPayload = await response.json();
                // Log.trace("AdminView::handleStudents(..)  - payload: " + JSON.stringify(json));
                if (typeof json.success !== "undefined") {
                    Log.trace("AdminView::getCourse(..)  - worked; took: " + UI.took(start));
                    return json.success;
                } else {
                    Log.trace("AdminView::getCourse(..)  - ERROR: " + json.failure.message);
                    AdminView.showError(json.failure); // FailurePayload
                }
            } else {
                Log.trace("AdminView::getCourse(..)  - !200 received: " + response.status);
                const text = await response.text();
                AdminView.showError(text);
            }
        } catch (err) {
            AdminView.showError("Getting config failed: " + err.message);
        }
        return null;
    }
}
