import Log from "@common/Log";

import {AdminTabs, AdminView} from "../AdminView";

declare var ons: any;

/**
 * This is a test implementation of the Classy admin features.
 */
export class ClassyAdminView extends AdminView {
    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("ClassyAdminView::<init>(..)");
        super(remoteUrl, tabs);
    }

    public renderPage(name: string, opts: any) {
        Log.info("ClassyAdminView::renderPage( " + name + ", ... ) - start; options: " + JSON.stringify(opts));
        super.renderPage(name, opts);

        if (name === "AdminRoot") {
            Log.info("ClassyAdminView::renderPage(..) - augmenting tabs");

            // this does not seem to work; it creates the tab on the menu, but it isn"t clickable
            // const tab = document.createElement("ons-tab");
            // tab.setAttribute("page", "dashboard.html");
            // tab.setAttribute("label", "Foo");
            // tab.setAttribute("active", "true");
            // tab.setAttribute("icon", "ion-ios-gear");
            // tab.setAttribute("class", "tabbar__item tabbar--top__item");
            // tab.setAttribute("modifier", "top");
            // const tabbar = document.getElementById("adminTabbar");
            // tabbar.children[1].appendChild(tab);

            Log.info("ClassyAdminView::renderPage(..) - augmenting tabs done.");
        }
    }
}
