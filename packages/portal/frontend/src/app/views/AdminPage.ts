import Log from "@common/Log";

import {Factory} from "../Factory";
import {IView} from "./IView";

import {UI} from "../util/UI";

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
        Log.info("AdminPage::renderPage( " + pageName + ", ... ) - default implementation");
    }

    /**
     * Pushes the page. If the page starts with ./ HTML prefix is not added.
     *
     * @param {string} pageName
     * @param {{}} opts
     * @returns {Promise<void>}
     */
    public pushPage(pageName: string, opts: {}): Promise<void> {
        Log.info("AdminPage::pushPage( " + pageName + ", ... ) - start");
        if (typeof opts !== "object") {
            opts = {};
        }
        if (pageName.startsWith("./")) {
            pageName = pageName.substring(2);
            return UI.pushPage(pageName, opts);
        } else {
            const prefix = Factory.getInstance().getHTMLPrefix();
            return UI.pushPage(prefix + "/" + pageName, opts);
        }

    }
}
