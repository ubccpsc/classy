import Log from "../../../../../../common/Log";
import {AdminTabs} from "../AdminView";
import {ManualMarkingAdminView} from "../customViews/ManualMarkingAdminView";

declare var ons: any;

/**
 * 340 only uses the default Classy admin features, but this class is for experimenting with
 * extensibility so we can better understand how to do it for other courses.
 */
export class CS340AdminView extends ManualMarkingAdminView {
    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("CS340AdminView::<init>(..)");
        super(remoteUrl, tabs, "CS340AdminView");
    }
}
