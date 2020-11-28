/**
 * This is the Default Student View for Classy.
 *
 */

import Log from "../../../../../common/Log";
import {AbstractStudentView} from "../views/AbstractStudentView";
import {AdminTabs} from "@frontend/views/AdminView";

export class CustomStudentView extends AbstractStudentView {

    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("CustomStudentView::<init>(..)");
        super();
    }

    public renderPage(name: string, opts: any) {
        Log.info('CustomStudentView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
    }

}
