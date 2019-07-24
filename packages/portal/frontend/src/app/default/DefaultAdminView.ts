import Log from "../../../../../common/Log";
import {AdminTabs, AdminView} from "../views/AdminView";

/**
 * Stock Defaut Admin view (ie. used by CS210)
 */
export class DefaultAdminView extends AdminView {
    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("CustomAdminView::<init>(..)");
        super(remoteUrl, tabs);
    }

    public renderPage(name: string, opts: any) {
        Log.info('CustomAdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
        super.renderPage(name, opts);
    }
}
