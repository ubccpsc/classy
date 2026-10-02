import Log from "@common/Log";

import {AdminTabs, AdminView} from "@frontend/views/AdminView";
import {CustomDashboardTab, CustomResultsTab} from "./CustomAdminTabs";

/**
 * Stock Default Admin view, with the Results and Dashboard tabs swapped for course-specific ones.
 */
export class DefaultAdminView extends AdminView {
    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("CustomAdminView::<init>(..)");
        super(remoteUrl, tabs);

        // AdminView builds the stock tabs in its constructor and only touches them at render time
        // (resultsTab.init / dashTab.init in renderPage), so a subclass can replace them here. The
        // fields are protected for exactly this. See CustomAdminTabs for what these change and why.
        this.resultsTab = new CustomResultsTab(remoteUrl);
        this.dashTab = new CustomDashboardTab(remoteUrl);
    }

    public renderPage(name: string, opts: any) {
        Log.info('CustomAdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
        super.renderPage(name, opts);
    }
}
