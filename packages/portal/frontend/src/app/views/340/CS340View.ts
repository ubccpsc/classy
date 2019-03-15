import Log from "../../../../../../common/Log";
import {ManualMarkingView} from "../customViews/ManualMarkingView";

export class CS340View extends ManualMarkingView {

    constructor(remoteUrl: string) {
        Log.info("CS340View::<init>");
        super(remoteUrl, "CS340View");
    }

}
