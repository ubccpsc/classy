import Log from "../../../../../common/Log";
import {AdminTabs, AdminView} from "../views/AdminView";
import { Factory } from "../Factory";

/**
 * CS 310 Admin view doesn't really differ at all from the stock Classy view.
 */
export class ClassyAdminView extends AdminView {
    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("CustomAdminView::<init>(..)");
        super(remoteUrl, tabs);
    }

    public renderPage(name: string, opts: any) {
        Log.info('CustomAdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
        super.renderPage(name, opts);
    }

    protected async handleAdminDashboard(opts: any): Promise<void> {
        Log.info('CustomAdminView::handleDashboard(..) - start');
        return this.dashTab.init(opts).then((res) => {
            const UIRow = document.querySelector("#AdminDashboardList > div");
            const button = document.createElement("button");
            button.style.marginLeft = "100px";
            button.innerHTML = "DOESN'T WORK";
            const path = Factory.getInstance().getHTMLPrefix() + "/Viz/public/index.html";
            button.addEventListener("click", () => {window.open(path);});
            UIRow.append(button);
            return res;
        });
    }
}
