import Log from "../../../../../common/Log";
import { Factory } from "../Factory";
import {AdminTabs, AdminView} from "../views/AdminView";

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
            if (!document.querySelector("#vizButton")) {
                const UIRow = document.querySelector("#AdminDashboardList > div");
                const button = document.createElement("button");
                button.id = "vizButton";
                button.style.marginLeft = "100px";
                button.innerHTML = "Viz (beta)";
                const path = Factory.getInstance().getHTMLPrefix() + "/Viz/public/index.html";
                button.addEventListener("click", () => window.open(path));
                UIRow.append(button);
                return res;
            }
        });
    }
}
