import {OnsButtonElement} from "onsenui";

import Log from "@common/Log";

import {UI} from "../util/UI";
import {AdminPage} from "./AdminPage";
import {AdminView} from "./AdminView";
import {Payload} from "@common/types/PortalTypes";
import Util from "@common/Util";

export class AdminDeleteGraderPage extends AdminPage {

    private images: Array<{ sha: string, tag: string, created: Date }> = [];

    constructor(remote: string) {
        super(remote);
    }

    public async init(opts: any): Promise<void> {
        const that = this;
        Log.info("AdminDeleteGraderPage::init(..) - start");

        UI.showModal("Retrieving Grader Images.");

        const url = this.remote + "/portal/at/docker/images?filters=" + JSON.stringify({reference: ["grader"]});
        const options = AdminView.getOptions();

        const response = await fetch(url, options);
        const body = await response.json();

        Log.info("AdminDeleteGraderPage::init(..) - image list retrieved; body: " + JSON.stringify(body));

        for (const image of body) {
            const tag = image?.RepoTags[0];
            const id = image.Id;
            const created = new Date(image.Created * 1000);
            this.images.push({sha: id, tag: tag, created: created});
        }

        this.images.sort(function (a, b) {
            return b.created.getTime() - a.created.getTime();
        });

        const imgOptions = [];
        for (const deliv of this.images) {
            // strip sha256: prefix and shorten to 12 chars
            let sha = deliv.sha.substring(7);
            sha = sha.substring(0, 12);

            imgOptions.push("_" + sha + "_ (" + deliv.tag + ") " + deliv.created.toLocaleString());
        }
        UI.setDropdownOptions("graderImagesSelect", imgOptions, null);

        (document.querySelector("#adminRemoveGraderImagesButton") as OnsButtonElement).onclick = function (evt) {
            Log.info("AdminDeleteGraderPage::adminRemoveGraderImagesButton(..) - button pressed");
            evt.stopPropagation(); // prevents list item expansion
            that.handleRemoveImagePressed().then(function () {
                // worked
                Log.info("AdminDeleteGraderPage::adminRemoveGraderImagesButton(..) - done");
            }).catch(function (err) {
                // did not
                Log.info("AdminDeleteGraderPage::adminRemoveGraderImagesButton(..) - ERROR: " + err);
            });
        };

        UI.hideModal();
    }

    private async handleRemoveImagePressed() {
        Log.info("AdminDeleteGraderPage::handleRemoveImagePressed(..) - start");
        try {
            const selector = document.querySelector("#graderImagesSelect") as HTMLSelectElement;
            const selectedOptions = selector.selectedOptions;
            /* tslint:disable-next-line */ // cannot for-of selectedOptions
            for (let i = 0; i < selectedOptions.length; i++) {
                const value = selectedOptions[i].value;
                Log.trace("AdminDeleteGraderPage::handleRemoveImagePressed(..) - selected: " + value);
                const sha = value.substring(1, value.indexOf("_ ("));
                Log.trace("AdminDeleteGraderPage::handleRemoveImagePressed(..) - sha: " + sha);
                await this.removeImage(sha);
            }
        } catch (err) {
            Log.error("AdminDeleteGraderPage::handleRemoveImagePressed(..) - ERROR: " + err);
        }
    }

    private async removeImage(sha: any): Promise<boolean> {
        Log.info("AdminDeleteGraderPage::removeImage( " + sha + " ) - start");

        const url = this.remote + "/portal/at/docker/image/" + sha;
        const options: any = AdminView.getOptions();
        options.method = "delete";

        Log.trace("AdminDeleteGraderPage::removeImage(..) - DELETE from: " + url);
        const start = Date.now();
        const response = await fetch(url, options);
        const json: Payload = await response.json();

        if (typeof json.success !== "undefined") {
            Log.info("AdminDeleteGraderPage::removeImage(..) - success; took: " + Util.took(start));
            return json.success;
        } else {
            Log.error("AdminDeleteGraderPage::removeImage(..) - ERROR: " + json.failure);
        }
    }

    private clearLists() {
        const toProvisionSelect = document.getElementById("graderImagesSelect") as HTMLSelectElement;

        toProvisionSelect.disabled = false;
        toProvisionSelect.innerHTML = "";
    }

    public renderPage(pageName: string, opts: {}): void {
        Log.info("AdminProvisionPage::renderPage( " + pageName + ", ... ) - start");
    }

}
