import {OnsButtonElement, OnsSelectElement} from "onsenui";

import Log from "@common/Log";

import {UI} from "../util/UI";
import {AdminPage} from "./AdminPage";
import {AdminView} from "./AdminView";
import {Payload} from "@common/types/PortalTypes";
import Util from "@common/Util";
import {AdminDeliverablesTab} from "@frontend/views/AdminDeliverablesTab";

export class AdminDeleteGraderPage extends AdminPage {

    private images: Array<{ sha: string, tag: string, created: Date }> = [];

    constructor(remote: string) {
        super(remote);
    }

    /**
     * Gets the list of grader images that are _not_ in use by any deliverable.
     */
    public async getGraderImages(remote: string): Promise<Array<{ sha: string, tag: string, created: Date }>> {
        Log.info("AdminDeleteGraderPage::getGraderImages(..) - start");

        const url = this.remote + "/portal/at/docker/images?filters=" + JSON.stringify({reference: ["grader"]});
        const options = AdminView.getOptions();

        const response = await fetch(url, options);
        const body = await response.json();

        Log.info("AdminDeleteGraderPage::init(..) - image list retrieved; body: " + JSON.stringify(body));

        let images = [];
        for (const image of body) {
            const tag = image?.RepoTags[0];
            const id = image.Id;
            const created = new Date(image.Created * 1000);
            images.push({sha: id, tag: tag, created: created});
        }

        images.sort(function (a, b) {
            return b.created.getTime() - a.created.getTime();
        });

        // remove images used by deliverables
        const deliverables = await AdminDeliverablesTab.getDeliverables(remote);

        Log.info("AdminDeleteGraderPage::init(..) - # images before filtering: " + images.length);
        images = images.filter(function (image) {
            for (const deliv of deliverables) {
                // Log.trace("AdminDeleteGraderPage::init(..) - comparing: " + deliv?.autoTest?.dockerImage + "; to: " + image.sha);
                if (typeof deliv?.autoTest?.dockerImage === "string" && typeof image.sha === "string" &&
                    image.sha.indexOf(deliv?.autoTest?.dockerImage) >= 0) {
                    Log.info("AdminDeleteGraderPage::init(..) - matched and removed for delivId: " + deliv.id +
                        "; sha: " + deliv?.autoTest?.dockerImage + "; and: " + image.sha);
                    return false;
                }
            }
            return true;
        });
        Log.info("AdminDeleteGraderPage::init(..) - # images after filtering: " + images.length);

        return images;
    }

    public async init(opts: any): Promise<void> {
        const that = this;
        Log.info("AdminDeleteGraderPage::init(..) - start");

        UI.showModal("Retrieving Grader Images.");

        this.images = await this.getGraderImages(this.remote);

        const imgOptions = [];
        for (const deliv of this.images
            ) {
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

        (document.querySelector("#graderImagesSelect") as OnsSelectElement).onclick = function (evt) {
            // stop clicking on elements in the list from expanding the help text
            Log.info("AdminDeleteGraderPage::adminRemoveGraderImagesButton(..) - select changed");
            evt.stopPropagation(); // prevents list item expansion
        };

        UI.hideModal();
    }

    private async handleRemoveImagePressed() {
        Log.info("AdminDeleteGraderPage::handleRemoveImagePressed(..) - start");
        try {
            const selector = document.querySelector("#graderImagesSelect") as HTMLSelectElement;
            const selectedOptions = selector.selectedOptions;
            let removalCount = 0;
            /* tslint:disable-next-line */ // cannot for-of selectedOptions
            for (let i = 0; i < selectedOptions.length; i++) {
                const value = selectedOptions[i].value;
                Log.info("AdminDeleteGraderPage::handleRemoveImagePressed(..) - selected: " + value);
                const sha = value.substring(1, value.indexOf("_ ("));
                Log.info("AdminDeleteGraderPage::handleRemoveImagePressed(..) - removing image sha: " + sha);
                const success = await this.removeImage(sha);
                Log.info("AdminDeleteGraderPage::handleRemoveImagePressed(..) - image sha removal success; sha: " + sha +
                    "; success: " + success);
                if (success) {
                    removalCount++;
                }
            }

            Log.info("AdminDeleteGraderPage::handleRemoveImagePressed(..) - done; images removed.");
            UI.showSuccessToast(removalCount + " grader images successfully removed.");
        } catch (err) {
            Log.error("AdminDeleteGraderPage::handleRemoveImagePressed(..) - ERROR: " + err);
            UI.showErrorToast("Grader image removal error: " + err);
        }
        this.clearLists();
        void this.init({});
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
