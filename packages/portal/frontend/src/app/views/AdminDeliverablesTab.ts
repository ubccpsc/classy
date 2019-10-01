import {OnsBackButtonElement, OnsButtonElement, OnsFabElement, OnsRadioElement, OnsSwitchElement} from "onsenui";
import Log from "../../../../../common/Log";

import {AutoTestConfigTransport, DeliverableTransport, DeliverableTransportPayload} from "../../../../../common/types/PortalTypes";

import {UI} from "../util/UI";
import {AdminPage} from "./AdminPage";
import {AdminView} from "./AdminView";
import {DockerListImageView} from "./DockerListImageView";

// import flatpickr from "flatpickr";
declare var flatpickr: any;

/**
 *
 * This isn't a tab on its own anymore. It has been absorbed within AdminConfigTab
 * but the code here is more clearly organized so we've left it here for the time
 * being until more explicit tab sub-helpers are actually a thing.
 *
 */
export class AdminDeliverablesTab extends AdminPage {

    // private readonly remote: string; // url to backend
    private isAdmin: boolean;
    private openPicker: any; // flatpickr;
    private closePicker: any; // flatpickr;

    constructor(remote: string, isAdmin: boolean) {
        super(remote);
        // this.remote = remote;
        this.isAdmin = isAdmin;
    }

    public setAdmin(isAdmin: boolean) {
        Log.info('AdminDeliverablesTab::isAdmin( ' + isAdmin + ' )');
        this.isAdmin = isAdmin;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminDeliverablesTab::init(..) - start');

        // const fab = document.querySelector('#adminAddDeliverable') as OnsFabElement;
        // if (this.isAdmin === false) {
        //     fab.style.display = 'none';
        // } else {
        //     fab.onclick = function(evt: any) {
        //         Log.info('AdminDeliverablesTab::init(..)::addDeliverable::onClick');
        //         UI.pushPage('editDeliverable.html', {delivId: null});
        //     };
        // }

        UI.showModal('Retrieving deliverables.');
        const delivs = await AdminDeliverablesTab.getDeliverables(this.remote);
        this.render(delivs);
        UI.hideModal();
    }

    private render(deliverables: DeliverableTransport[]) {
        Log.info("AdminDeliverablesTab::render(..) - start");
        const deliverableList = document.querySelector('#adminDeliverablesList') as HTMLElement;

        // FlatPicker.setFlatPickerField(deliverable.open, OPEN_DELIV_KEY);
        // FlatPicker.setFlatPickerField(deliverable.close, CLOSE_DELIV_KEY);

        deliverableList.innerHTML = '';
        deliverableList.appendChild(UI.createListHeader('Deliverables'));

        for (const deliv of deliverables) {
            const main = 'Deliverable: ' + deliv.id;
            const sub = 'Opens: ' + new Date(deliv.openTimestamp).toLocaleString() +
                '; Closes: ' + new Date(deliv.closeTimestamp).toLocaleString();

            let editable = false;
            if (this.isAdmin === true) {
                editable = true;
            }

            const elem = UI.createListItem(main, sub, editable);
            elem.setAttribute('delivId', deliv.id);
            elem.onclick = function(evt: any) {
                const delivId = evt.currentTarget.getAttribute('delivId');
                UI.pushPage('editDeliverable.html', {delivId: delivId}).then(function() {
                    // success
                }).catch(function(err) {
                    Log.error("UI::pushPage(..) - ERROR: " + err.message);
                });
            };
            deliverableList.appendChild(elem);
        }

        if (deliverables.length === 0) {
            deliverableList.appendChild(UI.createListItem('Deliverables not yet specified.'));
        }

        const createDeliverable = document.createElement('ons-button');
        createDeliverable.setAttribute('modifier', 'large');
        createDeliverable.innerText = 'Create New Deliverable';

        createDeliverable.onclick = function() {
            UI.pushPage('editDeliverable.html', {delivId: null}).then(function() {
                // success
            }).catch(function(err) {
                Log.error("UI::pushPage(..) - ERROR: " + err.message);
            });
        };

        const li = document.createElement('ons-list-item');
        li.appendChild(createDeliverable);

        deliverableList.appendChild(li);
    }

    public async initEditDeliverablePage(opts: any): Promise<void> {
        Log.info('AdminView::initEditDeliverablePage( ' + JSON.stringify(opts) + ' ) - start');
        const start = Date.now();
        const delivId = opts.delivId;

        if (delivId === null) {
            // create deliverable, not edit
            this.renderEditDeliverablePage(null);
        } else {
            const deliverables = await AdminDeliverablesTab.getDeliverables(this.remote);
            for (const deliv of deliverables) {
                if (deliv.id === delivId) {
                    this.renderEditDeliverablePage(deliv);
                    return;
                }
            }
        }
    }

    private updateHiddenBlocks() {
        const shouldProvision = document.querySelector('#adminEditDeliverablePage-shouldProvision') as OnsSwitchElement;
        const provisionValue = shouldProvision.checked; // (shouldProvision.checkbox as any).checked;
        Log.info('AdminView::renderEditDeliverablePage(..)::updateHiddenBocks::shouldProvision; value: ' + provisionValue);

        const provisionList = document.querySelector('#shouldProvisionList') as HTMLElement;
        if (provisionValue === true) {
            provisionList.style.display = 'inherit';
        } else {
            provisionList.style.display = 'none';
        }

        const shouldAutoTest = document.querySelector('#adminEditDeliverablePage-shouldAutoTest') as OnsSwitchElement;
        const autoTestValue = shouldAutoTest.checked; // (shouldAutoTest.checkbox as any).checked;
        Log.info('AdminView::renderEditDeliverablePage(..)::updateHiddenBlocks::shouldAutoTest; value: ' + autoTestValue);

        const autoTestList = document.querySelector('#shouldAutoTestList') as HTMLElement;
        if (autoTestValue === true) {
            autoTestList.style.display = 'inherit';
        } else {
            autoTestList.style.display = 'none';
        }
    }

    public renderEditDeliverablePage(deliv: DeliverableTransport) {
        Log.info('AdminView::renderEditDeliverablePage( ' + JSON.stringify(deliv) + ' ) - start');
        const that = this;

        // TODO: handle when deliv is null (aka the deliverable is new)

        const fab = document.querySelector('#adminEditDeliverableSave') as OnsFabElement;
        if (this.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            fab.onclick = function(evt) {
                Log.info('AdminView::renderEditDeliverablePage(..)::adminEditDeliverableSave::onClick');
                that.save().then(function() {
                    // worked
                }).catch(function(err) {
                    Log.info('AdminView::renderEditDeliverablePage(..)::adminEditDeliverableSave::onClick - ERROR: ' + err.message);
                });
            };
        }

        const shouldProvision = document.querySelector('#adminEditDeliverablePage-shouldProvision') as OnsSwitchElement;
        shouldProvision.onchange = function(evt) {
            const value = (evt as any).value;
            Log.info('AdminView::renderEditDeliverablePage(..)::adminEditDeliverableSave::shouldProvision; change: ' + value);
            //
            // const list = document.querySelector('#shouldProvisionList') as HTMLElement;
            // if (value === true) {
            //     list.style.display = 'inherit';
            // } else {
            //     list.style.display = 'none';
            // }
            that.updateHiddenBlocks();
        };

        const shouldAutoTest = document.querySelector('#adminEditDeliverablePage-shouldAutoTest') as OnsSwitchElement;
        shouldAutoTest.onchange = function(evt) {
            const value = (evt as any).value;
            Log.info('AdminView::renderEditDeliverablePage(..)::adminEditDeliverableSave::shouldAutoTest; change: ' + value);
            //
            // const list = document.querySelector('#shouldAutoTestList') as HTMLElement;
            // if (value === true) {
            //     list.style.display = 'inherit';
            // } else {
            //     list.style.display = 'none';
            // }
            that.updateHiddenBlocks();
        };

        const flatpickrOptions = {
            enableTime:  true,
            time_24hr:   true,
            utc:         true,
            dateFormat:  "Y/m/d @ H:i",
            defaultDate: new Date()
        };

        let selectedDockerImage: string;

        if (deliv === null) {
            // new deliverable, set defaults

            flatpickrOptions.defaultDate = new Date();
            this.openPicker = flatpickr("#adminEditDeliverablePage-open", flatpickrOptions);
            flatpickrOptions.defaultDate = new Date();
            this.closePicker = flatpickr("#adminEditDeliverablePage-close", flatpickrOptions);

            UI.setDropdownSelected('adminEditDeliverablePage-minTeamSize', 1, this.isAdmin);
            UI.setDropdownSelected('adminEditDeliverablePage-maxTeamSize', 1, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-inSameLab', true, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-studentsMakeTeams', false, this.isAdmin);

            this.setToggle('adminEditDeliverablePage-gradesReleased', false, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-visible', false, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-lateAutoTest', false, this.isAdmin);

            this.setToggle('adminEditDeliverablePage-shouldAutoTest', true, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atContainerTimeout', '300', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atStudentDelay', (12 * 60 * 60) + '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atCustom', '{}', this.isAdmin);

            this.setToggle('adminEditDeliverablePage-shouldProvision', true, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-importURL', '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-repoPrefix', '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-teamPrefix', '', this.isAdmin);

            this.setTextField('adminEditDeliverablePage-rubric', '{}', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-custom', '{}', this.isAdmin);
        } else {
            // edit existing deliverable

            this.setTextField('adminEditDeliverablePage-name', deliv.id, false);
            this.setTextField('adminEditDeliverablePage-url', deliv.URL, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-repoPrefix', deliv.repoPrefix, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-teamPrefix', deliv.teamPrefix, this.isAdmin);

            flatpickrOptions.defaultDate = new Date(deliv.openTimestamp);
            this.openPicker = flatpickr("#adminEditDeliverablePage-open", flatpickrOptions);
            flatpickrOptions.defaultDate = new Date(deliv.closeTimestamp);
            this.closePicker = flatpickr("#adminEditDeliverablePage-close", flatpickrOptions);
            this.setToggle('adminEditDeliverablePage-lateAutoTest', deliv.lateAutoTest, this.isAdmin);

            this.setToggle('adminEditDeliverablePage-shouldProvision', deliv.shouldProvision, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-importURL', deliv.importURL, this.isAdmin);
            UI.setDropdownSelected('adminEditDeliverablePage-minTeamSize', deliv.minTeamSize, this.isAdmin);
            UI.setDropdownSelected('adminEditDeliverablePage-maxTeamSize', deliv.maxTeamSize, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-inSameLab', deliv.teamsSameLab, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-studentsMakeTeams', deliv.studentsFormTeams, this.isAdmin);

            this.setToggle('adminEditDeliverablePage-gradesReleased', deliv.gradesReleased, this.isAdmin);
            this.setToggle('adminEditDeliverablePage-visible', deliv.visibleToStudents, this.isAdmin);

            this.setToggle('adminEditDeliverablePage-shouldAutoTest', deliv.shouldAutoTest, this.isAdmin);
            // this.setTextField('adminEditDeliverablePage-atDockerName', deliv.autoTest.dockerImage, this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atContainerTimeout', deliv.autoTest.maxExecTime + '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atStudentDelay', deliv.autoTest.studentDelay + '', this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atRegressionIds', deliv.autoTest.regressionDelivIds.toString(), this.isAdmin);
            this.setTextField('adminEditDeliverablePage-atCustom', JSON.stringify(deliv.autoTest.custom), this.isAdmin);

            this.setTextField('adminEditDeliverablePage-rubric', JSON.stringify(deliv.rubric), this.isAdmin);
            this.setTextField('adminEditDeliverablePage-custom', JSON.stringify(deliv.custom), this.isAdmin);

            selectedDockerImage = deliv.autoTest.dockerImage;
        }

        that.updateHiddenBlocks();

        // This would be set when we build a new image on the Create New Image page
        // We want to make sure we set the newly created image as selected
        const newImageSha = UI.getCurrentPage().data.sha;
        if (newImageSha) {
            selectedDockerImage = newImageSha;
        }
        const list = document.querySelector("#docker-image-list");
        const dataSource = {
            url:     this.remote + '/portal/at/docker/images?filters=' + JSON.stringify({reference: ['grader']}),
            options: AdminView.getOptions()
        };
        const state = {
            checkedItemTag: selectedDockerImage
        };
        new DockerListImageView(list).bind(dataSource, state).catch(function(err: Error) {
            UI.showErrorToast("Docker images: " + err);
        });

        (document.querySelector('#btnNewImage') as OnsButtonElement).onclick = function() {
            UI.pushPage('createDockerImage.html').then(function() {
                let imageSha: string;
                (document.querySelector("#create-docker-image-back") as OnsBackButtonElement).onClick = function() {
                    UI.popPage({data: {sha: imageSha}});
                };

                (document.querySelector("#build-image-form") as HTMLFormElement).onsubmit = function() {
                    const contextInput: HTMLInputElement = document.querySelector("#docker-image-context-input");
                    const tagInput: HTMLInputElement = document.querySelector("#docker-image-tag-input");
                    const fileInput: HTMLInputElement = document.querySelector("#docker-image-file-input");
                    const submit: HTMLButtonElement = document.querySelector("#build-image-button");

                    const context = contextInput.value;
                    const tag = 'grader' + (tagInput.value ? ':' + tagInput.value : '');
                    const file = fileInput.value;

                    contextInput.disabled = true;
                    tagInput.disabled = true;
                    fileInput.disabled = true;
                    submit.disabled = true;

                    UI.showModal();

                    that.buildDockerImage(context, tag, file).then(function(sha: string) {
                        imageSha = sha;
                        UI.hideModal();
                    }).catch(async function(err: Error) {
                        await UI.showAlert(err.message);
                        contextInput.disabled = false;
                        tagInput.disabled = false;
                        fileInput.disabled = false;
                        submit.disabled = false;
                        UI.hideModal();
                    });
                    return false;
                };
            }).catch(function(err) {
                Log.error("UI::pushPage(..) - ERROR: " + err.message);
            });
        };
    }

    private setTextField(fieldName: string, textValue: string, editable: boolean) {
        const field = document.querySelector('#' + fieldName) as HTMLTextAreaElement;
        if (field !== null) {
            field.value = textValue;
            if (editable === false) {
                field.setAttribute('readonly', '');
            }
        } else {
            Log.error('AdminDeliverablesTab::setTextField( ' + fieldName + ', ... ) - element does not exist');
        }
    }

    private setToggle(fieldName: string, value: boolean, editable: boolean) {
        const field = document.querySelector('#' + fieldName) as HTMLInputElement;
        if (field !== null) {
            field.checked = value;
            if (editable === false) {
                field.setAttribute('readonly', '');
            }
        } else {
            Log.error('AdminDeliverablesTab::setToggle( ' + fieldName + ', ... ) - element does not exist');
        }
    }

    private async save(): Promise<void> {
        Log.info("AdminDeliverablesTab::save() - start");

        const id = UI.getTextFieldValue('adminEditDeliverablePage-name');
        const URL = UI.getTextFieldValue('adminEditDeliverablePage-url');

        const openTimestamp = this.openPicker.latestSelectedDateObj.getTime();
        const closeTimestamp = this.closePicker.latestSelectedDateObj.getTime();

        const shouldProvision = UI.getToggleValue('adminEditDeliverablePage-shouldProvision');
        const importURL = UI.getTextFieldValue('adminEditDeliverablePage-importURL');
        const minTeamSize = Number(UI.getDropdownValue('adminEditDeliverablePage-minTeamSize'));
        const maxTeamSize = Number(UI.getDropdownValue('adminEditDeliverablePage-maxTeamSize'));
        const teamsSameLab = UI.getToggleValue('adminEditDeliverablePage-inSameLab');
        const studentsFormTeams = UI.getToggleValue('adminEditDeliverablePage-studentsMakeTeams');

        const gradesReleased = UI.getToggleValue('adminEditDeliverablePage-gradesReleased');
        const visibleToStudents = UI.getToggleValue('adminEditDeliverablePage-visible');
        const lateAutoTest = UI.getToggleValue('adminEditDeliverablePage-lateAutoTest');

        const shouldAutoTest = UI.getToggleValue('adminEditDeliverablePage-shouldAutoTest');
        const dockerImage = this.readDockerImage('docker-image');
        const maxExecTime = Number(UI.getTextFieldValue('adminEditDeliverablePage-atContainerTimeout'));
        const studentDelay = Number(UI.getTextFieldValue('adminEditDeliverablePage-atStudentDelay'));

        const repoPrefix = UI.getTextFieldValue('adminEditDeliverablePage-repoPrefix');
        const teamPrefix = UI.getTextFieldValue('adminEditDeliverablePage-teamPrefix');

        const atRegression = UI.getTextFieldValue('adminEditDeliverablePage-atRegressionIds');
        const regressionDelivIds: string[] = [];
        if (atRegression.length > 0) {
            const parts = atRegression.split(',');
            for (const p of parts) {
                regressionDelivIds.push(p);
            }
        }

        let atCustomRaw = UI.getTextFieldValue('adminEditDeliverablePage-atCustom');
        let atCustom: any = {};
        if (atCustomRaw.length > 0) {
            Log.trace("AdminDeliverablesTab::save() - atCustomRaw: " + atCustomRaw);
            // https://stackoverflow.com/a/34763398 (handle unquoted props (e.g., {foo: false}))
            atCustomRaw = atCustomRaw.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
            try {
                atCustom = JSON.parse(atCustomRaw);
            } catch (err) {
                UI.showError("AutoTest Custom field is not valid JSON: " + err.message);
                throw new Error("Cancel back"); // hack: prevents page transition from proceeding
            }

        }

        const customRaw = UI.getTextFieldValue('adminEditDeliverablePage-custom');
        let custom: any = {};
        if (customRaw.length > 0) {
            Log.trace("AdminDeliverablesTab::save() - customRaw: " + customRaw);
            // https://stackoverflow.com/a/34763398 (handle unquoted props (e.g., {foo: false}))
            // customRaw = customRaw.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
            try {
                custom = JSON.parse(customRaw);
            } catch (err) {
                UI.showError("Custom field is not valid JSON: " + err.message);
                throw new Error("Cancel back"); // hack: prevents page transition from proceeding
            }
        }

        const rubricRaw = UI.getTextFieldValue('adminEditDeliverablePage-rubric');
        let rubric: any = {};
        if (rubricRaw.length > 0) {
            Log.trace("AdminDeliverablesTab::save() - customRaw: " + customRaw);
            // https://stackoverflow.com/a/34763398 (handle unquoted props (e.g., {foo: false}))
            // customRaw = customRaw.replace(/(['"])?([a-z0-9A-Z_]+)(['"])?:/g, '"$2": ');
            try {
                rubric = JSON.parse(rubricRaw);
            } catch (err) {
                UI.showError("Rubric field is not valid JSON: " + err.message);
                throw new Error("Cancel back"); // hack: prevents page transition from proceeding
            }
        }

        const at: AutoTestConfigTransport = {
            dockerImage,
            maxExecTime,
            studentDelay,
            regressionDelivIds,
            custom: atCustom,
            openTimestamp,
            closeTimestamp,
            lateAutoTest
        };

        const deliv: DeliverableTransport = {
            id,
            URL,
            visibleToStudents,
            openTimestamp,
            closeTimestamp,
            onOpenAction:  '', // TODO: add this
            onCloseAction: '', // TODO: add this
            lateAutoTest,
            shouldAutoTest,
            importURL,
            minTeamSize,
            maxTeamSize,
            studentsFormTeams,
            teamsSameLab,
            gradesReleased,
            shouldProvision,
            autoTest:      at,
            repoPrefix,
            teamPrefix,
            rubric,
            custom
        };

        Log.trace("AdminDeliverablesTab::save() - result: " + JSON.stringify(deliv));

        const url = this.remote + '/portal/admin/deliverable';
        const options: any = AdminView.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(deliv);

        const response = await fetch(url, options);
        const body = await response.json();

        if (typeof body.success !== 'undefined') {
            // worked
            UI.showSuccessToast("Deliverable saved successfully.");
            UI.popPage();
        } else {
            UI.showAlert(body.failure.message);
        }
    }

    private readDockerImage(fieldName: string): string {
        const checkedRadio: OnsRadioElement = document.querySelector('input[name="' + fieldName + '"]:checked');
        if (!checkedRadio) {
            return null;
        }
        const label = document.querySelector('label[for=' + checkedRadio.id + ']');
        const sha = label.firstElementChild.children[1].innerHTML;
        return sha;
    }

    public static async getDeliverables(remote: string): Promise<DeliverableTransport[]> {
        try {
            Log.info("AdminDeliverablesTab::getDeliverables( .. ) - start");
            const start = Date.now();

            const options = AdminView.getOptions();
            const url = remote + '/portal/admin/deliverables';
            const response = await fetch(url, options);

            if (response.status === 200) {
                Log.trace('AdminDeliverablesTab::getDeliverables(..) - 200 received');
                const json: DeliverableTransportPayload = await response.json();
                // Log.trace('AdminView::getDeliverables(..)  - payload: ' + JSON.stringify(json));
                if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                    Log.trace('AdminDeliverablesTab::getDeliverables(..)  - worked; took: ' + UI.took(start));
                    return (json.success);
                } else {
                    Log.trace('AdminDeliverablesTab::getDeliverables(..)  - ERROR: ' + json.failure.message);
                    AdminView.showError(json.failure); // FailurePayload
                }
            } else {
                Log.trace('AdminDeliverablesTab::getDeliverables(..)  - !200 received: ' + response.status);
                const text = await response.text();
                AdminView.showError(text);
            }
        } catch (err) {
            AdminView.showError("Getting deliverables failed: " + err.message);
        }
        return [];
    }

    private async buildDockerImage(context: string, tag: string, file: string): Promise<string> {
        try {
            Log.info("AdminDeliverablesTab::buildDockerImage( .. ) - start");
            const headers = AdminView.getOptions().headers;
            const remote = this.remote;
            const output = await UI.templateDisplayText('dockerBuildDialog.html', 'Initializing Docker build. Please wait...\n\n');

            return new Promise<string>(function(resolve, reject) {
                const xhr = new XMLHttpRequest();
                let lines: string[] = [];
                let lastIndex = 0;
                xhr.onprogress = function() {
                    try {
                        const currIndex = xhr.responseText.length;
                        if (lastIndex === currIndex) {
                            return;
                        }
                        const chunk = xhr.responseText.substring(lastIndex, currIndex);
                        lastIndex = currIndex;

                        const chunkLines = chunk.split("\n")
                            .filter((s) => s !== "")
                            .map((s) => JSON.parse(s))
                            .filter((s) => s.hasOwnProperty("stream") || s.hasOwnProperty("error"))
                            .map((s) => s.stream || "\n\nError code: " + s.errorDetail.code + "\n\nError Message: " + s.error);
                        output.innerText += chunkLines.join("");
                        lines = lines.concat(chunkLines);
                    } catch (err) {
                        Log.warn("AdminDeliverablesTab::buildDockerImage(..) - ERROR Processing build output log stream. " + err);
                    }
                };
                xhr.onload = function() {
                    if (xhr.status >= 400) {
                        return reject(new Error(xhr.responseText));
                    }

                    if (lines.length > 2 && lines[lines.length - 2].startsWith("Successfully built")) {
                        const sha = lines[lines.length - 2].replace("Successfully built ", "").trim();
                        // const tag = lines[lines.length - 1].replace("Successfully tagged ", "");
                        resolve(sha);
                    } else {
                        reject(new Error("Failed to read image SHA from build log. " +
                            "If the image was built successfully, you can manually select it on the previous screen."));
                    }
                };
                xhr.onerror = function() {
                    reject(new Error(xhr.responseText));
                };

                try {
                    xhr.open('POST', remote + '/portal/at/docker/image');
                    for (const [header, value] of Object.entries(headers)) {
                        xhr.setRequestHeader(header, value);
                    }
                    xhr.send(JSON.stringify({remote: context, tag: tag, file: file}));
                } catch (err) {
                    Log.warn("AdminDeliverablesTab::buildDockerImage(..) - ERROR With request: " + err);
                }
            });
        } catch (err) {
            AdminView.showError("An error occurred making request: " + err.message);
        }
    }
}
