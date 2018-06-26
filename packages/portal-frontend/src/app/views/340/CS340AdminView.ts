import {AdminView} from "../AdminView";
import Log from "../../../../../common/Log";

export class CS340AdminView extends AdminView {

    public renderPage(name: string, opts: {}) {
        Log.info('CS340AdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
        super.renderPage(name, opts);

        // insert custom tab here somehow?
        // should be possible with document.getElementById(`adminTabbar`)
    }

    public handleAdminCustomGrades(opts: any) {
        Log.info("CS340AdminView::handleCustomGrades( " + JSON.stringify(opts) + " ) - start");
    }

}