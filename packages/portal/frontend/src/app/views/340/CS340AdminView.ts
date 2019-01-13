import Log from "../../../../../../common/Log";
import {AdminTabs, AdminView} from "../AdminView";

declare var ons: any;

/**
 * 340 only uses the default Classy admin features, but this class is for experimenting with
 * extensibility so we can better understand how to do it for other courses.
 */
export class CS340AdminView extends AdminView {
    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("CS340AdminView::<init>(..)");
        super(remoteUrl, tabs);
    }

    public renderPage(name: string, opts: any) {
        Log.info('CS340AdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
        super.renderPage(name, opts);

        if (name === 'AdminRoot') {
            Log.info('CS340AdminView::renderPage(..) - augmenting tabs');

            // this does not seem to work; it creates the tab on the menu, but it isn't clickable
            // const tab = document.createElement('ons-tab');
            // tab.setAttribute('page', 'dashboard.html');
            // tab.setAttribute('label', 'Foo');
            // tab.setAttribute('active', 'true');
            // tab.setAttribute('icon', 'ion-ios-gear');
            // tab.setAttribute('class', 'tabbar__item tabbar--top__item');
            // tab.setAttribute('modifier', 'top');
            // const tabbar = document.getElementById('adminTabbar');
            // tabbar.children[1].appendChild(tab);

            Log.info('CS340AdminView::renderPage(..) - augmenting tabs done.');
        }
    }
}
