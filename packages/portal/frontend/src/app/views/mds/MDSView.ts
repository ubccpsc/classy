import Log from "../../../../../../common/Log";
import {ManualMarkingView} from "../customViews/ManualMarkingView";

export class MDSView extends ManualMarkingView {

    constructor(remoteUrl: string) {
        super(remoteUrl, "MDSView");
        Log.info("MDSView::<init>");
    }

}
