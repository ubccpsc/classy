import Log from "../../../../../common/Log";
import {Factory} from "../Factory";
import {UI} from "../util/UI";
import {IView} from "./IView";

export abstract class AdminPage implements IView {

    protected readonly remote: string | null = null;

    constructor(remote: string) {
        this.remote = remote;
    }

    /**
     * Initializes the view (e.g., wires up the buttons, fetches data, etc).
     *
     * @param opts
     * @returns {Promise<void>}
     */
    public abstract async init(opts: any): Promise<void>;

    public renderPage(pageName: string, opts: {}): void {
        Log.info("AdminPate::renderPage( " + pageName + ", ... ) - default implementation");
    }

    public pushPage(pageName: string, opts: {}): void {
        Log.info("AdminPage::pushPage( " + pageName + ", ... ) - start");
        if (typeof opts !== 'object') {
            opts = {};
        }
        const prefix = Factory.getInstance().getHTMLPrefix();
        UI.pushPage(prefix + '/' + pageName, opts);
    }
}
