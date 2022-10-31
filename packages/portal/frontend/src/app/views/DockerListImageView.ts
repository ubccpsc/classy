import {OnsListItemElement, OnsRadioElement} from "onsenui";

import Log from "@common/Log";

import {UI} from "../util/UI";

export interface DockerImage {
    id: string;
    tag: string;
    created: Date;
}

export class DockerListImageView {
    public readonly list: any;

    constructor(list: any) {
        this.list = list;
    }

    public async bind(dataSource: any, state: any) {
        try {
            const data = await this.getDockerImages(dataSource.url, dataSource.options);
            const dockerImages: DockerImage[] = data.map((d) => {
                return {
                    id: d.Id.substring(7, 19), // Strip off "sha256:" and show first 12 characters
                    tag: d.RepoTags[0], // Only use the first tag (they are sorted alphabetically)
                    created: new Date(d.Created * 1000) // Convert the Unix timestamp in seconds to milliseconds
                };
            });
            const pendingAdditionsFragment = document.createDocumentFragment();
            const listItems = this.list.querySelectorAll("ons-list-item:not(:first-child)");

            for (const image of dockerImages) {
                let exists = false;
                for (const item of listItems) {
                    const id = item.querySelector("label[for] > ons-row > ons-col").innerText;
                    if (image.id.startsWith(id)) {
                        exists = true;
                        if (image.tag === state.checkedItemTag) {
                            this.setCheckedItem(item);
                        }
                        break;
                    }
                }
                if (!exists) {
                    const item = DockerListImageView.generateListItem(image, image.tag === state.checkedItemTag);
                    pendingAdditionsFragment.appendChild(item);
                }
            }

            for (const item of listItems) {
                let exists = false;
                for (const image of dockerImages) {
                    const id = item.querySelector("label[for] > ons-row > ons-col").innerText;
                    if (image.id.startsWith(id)) {
                        exists = true;
                        break;
                    }
                }
                if (!exists) {
                    this.removeListItem(item);
                }
            }

            this.addListItems(pendingAdditionsFragment);
        } catch (err) {
            Log.error("DockerListImageView::bind() - ERROR Binding data to list. " + err);
        }
    }

    public addListItems(items: DocumentFragment) {
        this.list.appendChild(items);
    }

    public removeListItem(item: OnsListItemElement) {
        this.list.removeChild(item);
    }

    public setCheckedItem(item: OnsListItemElement) {
        const radio: OnsRadioElement = item.querySelector("ons-radio");
        radio.checked = true;
    }

    public static generateListItem(image: DockerImage, checked: boolean): DocumentFragment {

        return document.createRange().createContextualFragment(`
                <ons-list-item tappable>
                    <label class="left">
                        <ons-radio name="docker-image" input-id="radio-${image.id}" ${checked ? "checked" : ""}></ons-radio>
                    </label>
                    <label for="radio-${image.id}" class="center">
                        <ons-row>
                            <ons-col>${image.id}</ons-col>
                            <ons-col>${image.tag}</ons-col>
                            <ons-col>${image.created}</ons-col>
                        </ons-row>
                    </label>
                </ons-list-item>
                `);
    }

    private async getDockerImages(url: string, options: any): Promise<any[]> {
        Log.info("DockerListImageView::getDockerImages( .. ) - start");
        const start = Date.now();
        const response = await fetch(url, options);

        if (response.status === 200) {
            Log.trace("DockerListImageView::getDockerImages(..) - 200 received");
            const json = await response.json();
            if (Array.isArray(json)) {
                Log.trace("DockerListImageView::getDockerImages(..)  - worked; took: " + UI.took(start));
                return json;
            } else {
                Log.trace("DockerListImageView::getDockerImages(..)  - ERROR Expected array; got " + json);
                throw new Error("Invalid response body format");
            }
        } else {
            Log.trace("DockerListImageView::getDockerImages(..)  - !200 received: " + response.status);
            throw await response.text();
        }
    }
}
