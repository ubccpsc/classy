import {OnsButtonElement} from "onsenui";
import Log from "../../../../../common/Log";
import {CourseTransport, Payload, ProvisionTransport, TeamFormationTransport} from "../../../../../common/types/PortalTypes";
import {Network} from "../util/Network";
import {UI} from "../util/UI";
import {AdminDeletePage} from "./AdminDeletePage";
import {AdminDeliverablesTab} from "./AdminDeliverablesTab";
import {AdminPage} from "./AdminPage";
import {AdminView} from "./AdminView";

export class AdminConfigTab extends AdminPage {

    // private readonly remote: string; // url to backend
    private isAdmin: boolean;

    private deliverablesPage: AdminDeliverablesTab = null;
    private course: CourseTransport = null;

    constructor(remote: string, isAdmin: boolean) {
        super(remote);
        // this.remote = remote;
        this.isAdmin = isAdmin;
        this.deliverablesPage = new AdminDeliverablesTab(remote, isAdmin);
    }

    public setAdmin(isAdmin: boolean) {
        Log.info('AdminConfigTab::isAdmin( ' + isAdmin + ' )');
        this.isAdmin = isAdmin;
    }

    // called by reflection in renderPage
    public async init(opts: any): Promise<void> {
        Log.info('AdminConfigTab::init(..) - start');
        const that = this;
        // Can init frame here if needed

        await this.deliverablesPage.init(opts);

        const images = await this.getImageList();
        that.bindImagesToTable(images, document.querySelector("#docker-image-list"));

        (document.querySelector('#btnNewImage') as OnsButtonElement).onclick = function(evt) {
            const nav = document.querySelector('#dockerConfigManager');
            nav.pushPage('createDockerImage.html');
            nav.addEventListener("postpop", function(event) {
                const sha = document.querySelector('#dockerConfigManager').topPage.data.sha;
                getImageList(sha);

            });
        };

        (document.querySelector('#adminSubmitClasslist') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - upload classlist pressed');
            evt.stopPropagation(); // prevents list item expansion

            const fileInput = document.querySelector('#adminClasslistFile') as HTMLInputElement;
            const isValid: boolean = that.validateFileSpecified(fileInput);
            if (isValid === true) {
                that.uploadClasslist(fileInput.files).then(function() {
                    // done
                }).catch(function(err) {
                    Log.error('AdminConfigTab::handleAdminConfig(..) - upload classlist pressed ERROR: ' + err.message);
                });
            }
        };

        (document.querySelector('#adminSubmitGradeCSV') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - upload grades pressed');
            evt.stopPropagation(); // prevents list item expansion

            const fileInput = document.querySelector('#adminGradeCSV') as HTMLInputElement;
            const isValid: boolean = that.validateFileSpecified(fileInput);
            if (isValid === true) {

                const delivDropdown = document.querySelector('#adminGradeDeliverableSelect') as HTMLSelectElement;
                const delivId = delivDropdown.value;
                that.uploadGrades(fileInput.files, delivId).then(function() {
                    // done
                }).catch(function(err) {
                    Log.error('AdminConfigTab::handleAdminConfig(..) - upload grades pressed ERROR: ' + err.message);
                });
            }
        };

        (document.querySelector('#adminSubmitDefaultDeliverable') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - default deliverable pressed');
            evt.preventDefault();

            that.defaultDeliverablePressed().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminConfigTab::handleAdminConfig(..) - default deliverable pressed; ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminProvisionButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - provision deliverable pressed');
            evt.preventDefault();

            that.provisionDeliverablePressed().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminConfigTab::handleAdminConfig(..) - provision deliverable pressed; ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminReleaseButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - release deliverable pressed');
            evt.preventDefault();

            that.releaseDeliverablePressed().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminConfigTab::handleAdminConfig(..) - release deliverable pressed; ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminReadWriteButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - read/write deliverable pressed');
            evt.preventDefault();

            that.repoEnableWritePressed().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminConfigTab::handleAdminConfig(..) - read/write deliverable pressed; ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminReadOnlyButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - read only deliverable pressed');
            evt.preventDefault();

            that.repoDisableWritePressed().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminConfigTab::handleAdminConfig(..) - read only deliverable pressed; ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminCreateTeamButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - create team pressed');
            evt.preventDefault();

            that.createTeamPressed().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminConfigTab::handleAdminConfig(..) - create team pressed; ERROR: ' + err.message);
            });
        };

        (document.querySelector('#adminDeletePageButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - delete page pressed');
            evt.preventDefault();

            that.pushPage('adminDelete.html', {}).then(function() {
                const deletePage = new AdminDeletePage(that.remote);
                deletePage.init({}).then(function() {
                    // success
                }).catch(function(err) {
                    // error
                });
            }).catch(function(err) {
                Log.error("AdminConfigTab - adminDelete ERROR: " + err.message);
            });
        };

        (document.querySelector('#adminPerformWithdrawButton') as OnsButtonElement).onclick = function(evt) {
            Log.info('AdminConfigTab::handleAdminConfig(..) - perform withdraw pressed');
            evt.preventDefault();

            that.performWithdraw().then(function() {
                // worked
            }).catch(function(err) {
                Log.info('AdminConfigTab::handleAdminConfig(..) - perform withdraw pressed; ERROR: ' + err.message);
            });
        };

        (document.querySelector("#build-image-form") as OnsButtonElement).onclick = function(evt) {
            const modal = document.querySelector('ons-modal');
            const contextInput = document.querySelector("#docker-image-context-input");
            const tagInput = document.querySelector("#docker-image-tag-input");
            const submit = document.querySelector("#build-image-button");
            const outputArea = document.querySelector("#docker-image-build-output");

            const context = contextInput.value;
            const tag = tagInput.value;

            contextInput.disabled = true;
            tagInput.disabled = true;
            submit.disabled = true;

            modal.show();

            that.buildImage(context, tag, outputArea).then(function(sha) {
                document.querySelector("#create-docker-image-back").options = {data: {sha}};
                modal.hide();
            }).catch(function(err) {
                // ons.notification.alert(err);
                contextInput.disabled = false;
                tagInput.disabled = false;
                submit.disabled = false;
                modal.hide();
            });
            return false;
        };

        UI.showModal("Retriving config / deliverable details.");

        this.course = await AdminView.getCourse(this.remote);

        const deliverables = await AdminDeliverablesTab.getDeliverables(this.remote);
        const gradesDeliverableDropdown = document.querySelector('#adminGradeDeliverableSelect') as HTMLSelectElement;
        const defaultDeliverableDropdown = document.querySelector('#adminDefaultDeliverableSelect') as HTMLSelectElement;
        const provisionDropdown = document.querySelector('#adminProvisionDeliverableSelect') as HTMLSelectElement;
        const releaseDropdown = document.querySelector('#adminReleaseDeliverableSelect') as HTMLSelectElement;
        const teamDropdown = document.querySelector('#adminTeamDeliverableSelect') as HTMLSelectElement;

        const repoReadDropdown = document.querySelector('#adminReadOnlyDeliverableSelect') as HTMLSelectElement;
        const repoReadWriteDropdown = document.querySelector('#adminReadWriteDeliverableSelect') as HTMLSelectElement;

        const defaultDeliverableOptions = ['--Not Set--'];
        const provisionOptions = ['--Select--'];
        const releaseOptions = ['--Select--'];
        const gradesOptions = ['--Select--'];
        const allDeliverables = ['--Select--'];

        const repoReadOptions = ['--Select--'];
        const repoWriteOptions = ['--Select--'];

        for (const deliv of deliverables) {
            if (deliv.shouldAutoTest === true) {
                // default deliverables only matter for autotest
                defaultDeliverableOptions.push(deliv.id);
            }
            if (deliv.shouldProvision === true) {
                // can only provision or release deliverables that are provisionable
                provisionOptions.push(deliv.id);
                releaseOptions.push(deliv.id);
                gradesOptions.push(deliv.id);
                repoReadOptions.push(deliv.id);
                repoWriteOptions.push(deliv.id);
            }
            allDeliverables.push(deliv.id);
        }

        this.populateDelivSelect(defaultDeliverableOptions, defaultDeliverableDropdown);
        this.populateDelivSelect(provisionOptions, teamDropdown); // can only create teams on provisionable deliverables
        this.populateDelivSelect(provisionOptions, provisionDropdown);
        this.populateDelivSelect(releaseOptions, releaseDropdown);
        this.populateDelivSelect(allDeliverables, gradesDeliverableDropdown);
        this.populateDelivSelect(repoReadOptions, repoReadDropdown);
        this.populateDelivSelect(repoWriteOptions, repoReadWriteDropdown);

        // set default deliverable, if it exists
        for (const o of (defaultDeliverableDropdown as any).children) {
            if (o.value === this.course.defaultDeliverableId) {
                o.selected = true;
            }
        }

        UI.hideModal();
    }

    private populateDelivSelect(delivOptions: string[], dropdown: HTMLSelectElement) {
        delivOptions = delivOptions.sort();

        dropdown.innerHTML = '';
        for (const delivId of delivOptions) {
            let value = delivId;
            if (delivId.startsWith('--')) {
                // handle the null case
                value = null;
            }
            const o: HTMLOptionElement = new Option(delivId, value, false, false);
            dropdown.add(o);
        }
    }

    private validateFileSpecified(fileInput: HTMLInputElement) {
        if (fileInput.value.length > 0) {
            Log.trace('AdminConfigTab::validateFileSpecified() - validation passed');
            return true;
        } else {
            UI.notification('You must select a CSV before you click "Upload".');
            return false;
        }
    }

    public async uploadClasslist(fileList: FileList) {
        Log.info('AdminConfigTab::uploadClasslist(..) - start');
        const url = this.remote + '/portal/admin/classlist';

        UI.showModal('Uploading classlist.');

        try {
            const formData = new FormData();
            formData.append('classlist', fileList[0]); // The CSV is fileList[0]

            const opts = {
                headers: {
                    // 'Content-Type': 'application/json', // violates CORS; leave commented out
                    user:  localStorage.user,
                    token: localStorage.token
                }
            };
            const response: Response = await Network.httpPostFile(url, opts, formData);
            if (response.status >= 200 && response.status < 300) {
                const data: Payload = await response.json();
                UI.hideModal();
                Log.info('AdminConfigTab::uploadClasslist(..) - RESPONSE: ' + JSON.stringify(data));
                UI.notification(data.success.message);
            } else {
                const reason = await response.json();
                UI.hideModal();
                if (typeof reason.failure && typeof reason.failure.message) {
                    UI.notification('There was an issue uploading your class list. ' +
                        'Please ensure the CSV file includes all required columns. <br/>Details: ' + reason.failure.message);
                } else {
                    UI.notification('There was an issue uploading your class list. ' +
                        'Please ensure the CSV file includes all required columns.');
                }
            }
        } catch (err) {
            UI.hideModal();
            Log.error('AdminConfigTab::uploadClasslist(..) - ERROR: ' + err.message);
            AdminView.showError(err);
        }

        Log.trace('AdminConfigTab::uploadClasslist(..) - end');
    }

    public async uploadGrades(fileList: FileList, delivId: string) {
        Log.info('AdminConfigTab::uploadGrades(..) - start');
        const url = this.remote + '/portal/admin/grades/' + delivId;

        UI.showModal('Uploading grades.');

        try {
            const formData = new FormData();
            formData.append('gradelist', fileList[0]); // The CSV is fileList[0]

            const opts = {
                headers: {
                    // 'Content-Type': 'application/json', // violates CORS; leave commented out
                    user:  localStorage.user,
                    token: localStorage.token
                }
            };
            const response: Response = await Network.httpPostFile(url, opts, formData);
            if (response.status >= 200 && response.status < 300) {
                const data: Payload = await response.json();
                UI.hideModal();
                Log.info('AdminConfigTab::uploadGrades(..) - RESPONSE: ' + JSON.stringify(data));
                UI.notification(data.success.message);
            } else {
                const reason = await response.json();
                UI.hideModal();
                if (typeof reason.failure && typeof reason.failure.message) {
                    UI.notification('There was an issue uploading your grade CSV. ' +
                        'Please ensure the CSV file includes all required columns. <br/>Details: ' + reason.failure.message);
                } else {
                    UI.notification('There was an issue uploading your grade CSV. ' +
                        'Please ensure the CSV file includes all required columns.');
                }
            }
        } catch (err) {
            UI.hideModal();
            Log.error('AdminConfigTab::uploadGrades(..) - ERROR: ' + err.message);
            AdminView.showError(err);
        }

        Log.trace('AdminConfigTab::uploadGrades(..) - end');
    }

    private async createTeamPressed(): Promise<void> {
        Log.trace('AdminConfigTab::createTeamPressed(..) - start');
        const delivDropdown = document.querySelector('#adminTeamDeliverableSelect') as HTMLSelectElement;
        const delivId = delivDropdown.value;

        const names = UI.getTextFieldValue('adminTeamText');
        let nameList = names.split(',');
        nameList = nameList.map(Function.prototype.call, String.prototype.trim); // trim whitespace before/after names

        const url = this.remote + '/portal/admin/team';
        const options: any = AdminView.getOptions();
        options.method = 'post';

        const team: TeamFormationTransport = {
            delivId:   delivId,
            githubIds: nameList
        };

        Log.trace('AdminConfigTab::createTeamPressed(..) - body: ' + JSON.stringify(team));

        options.body = JSON.stringify(team);

        const response = await fetch(url, options);
        const body = await response.json();

        if (typeof body.success !== 'undefined') {
            UI.showErrorToast("Team created successfully: " + body.success[0].id);
        } else {
            UI.showAlert(body.failure.message);
        }
    }

    private async performWithdraw(): Promise<void> {
        Log.trace('AdminConfigTab::performWithdraw(..) - start');

        const url = this.remote + '/portal/admin/withdraw';
        const options: any = AdminView.getOptions();
        options.method = 'post';

        Log.trace('AdminConfigTab::performWithdraw(..)');

        options.body = JSON.stringify({}); // no params

        const response = await fetch(url, options);
        const body = await response.json();

        if (typeof body.success !== 'undefined') {
            UI.notificationToast("Withrdaw marking successful: " + body.success, 5000);
        } else {
            UI.showAlert(body.failure.message);
        }
    }

    private async defaultDeliverablePressed(): Promise<void> {
        Log.trace('AdminConfigTab::defaultDeliverablePressed(..) - start');
        const delivDropdown = document.querySelector('#adminDefaultDeliverableSelect') as HTMLSelectElement;
        const value = delivDropdown.value;

        this.course.defaultDeliverableId = value; // update with new value

        Log.trace('AdminConfigTab::defaultDeliverablePressed(..) - value: ' + value);

        const url = this.remote + '/portal/admin/course';
        const options: any = AdminView.getOptions();
        options.method = 'post';
        options.body = JSON.stringify(this.course);

        const response = await fetch(url, options);
        const body = await response.json();

        if (typeof body.success !== 'undefined') {
            UI.showErrorToast("Default deliverable saved successfully.");
        } else {
            UI.showAlert(body.failure.message);
        }
    }

    private async provisionDeliverablePressed(): Promise<void> {
        Log.trace('AdminConfigTab::provisionDeliverablePressed(..) - start');
        const start = Date.now();
        const delivDropdown = document.querySelector('#adminProvisionDeliverableSelect') as HTMLSelectElement;
        const value = delivDropdown.value;
        Log.trace('AdminConfigTab::provisionDeliverablePressed(..) - value: ' + value);

        if (value !== null && value !== 'null') {
            const url = this.remote + '/portal/admin/provision';
            const options: any = AdminView.getOptions();
            options.method = 'post';

            const provision: ProvisionTransport = {delivId: value, formSingle: false};
            options.body = JSON.stringify(provision); // TODO: handle formSingle correctly

            UI.showAlert("This is going to be a long-running operation;" +
                " you can monitor progress by watching your GitHub org for newly created repos " +
                "(and teams, although they will not be added to the repos until you release). " +
                "Please make sure this operation completes before you provision again or release these repos.");

            Log.trace('AdminConfigTab::provisionDeliverablePressed(..) - POSTing to: ' + url);
            const response = await fetch(url, options);

            if (response.status === 200 || response.status === 400) {
                const body = await response.json();
                if (typeof body.success !== 'undefined') {
                    Log.info("Repositories provisioned: " + JSON.stringify(body.success));
                    UI.showAlert("Repositories provisioned: " + body.success.length);
                } else {
                    if (typeof body.failure !== 'undefined') {
                        UI.showAlert(body.failure.message);
                    } else {
                        UI.showAlert(body);
                    }
                }
            } else {
                UI.showAlert("Unexpected problem encountered: " + response.statusText);
            }
        }
        Log.trace('AdminConfigTab::provisionDeliverablePressed(..) - done; took: ' + UI.took(start));
    }

    private async repoEnableWritePressed(): Promise<void> {
        Log.trace('AdminConfigTab::repoEnableWritePressed(..) - start');
    }

    private async repoDisableWritePressed(): Promise<void> {
        Log.trace('AdminConfigTab::repoDisableWritePressed(..) - start');
    }

    private async releaseDeliverablePressed(): Promise<void> {
        Log.trace('AdminConfigTab::releaseDeliverablePressed(..) - start');
        const start = Date.now();
        const delivDropdown = document.querySelector('#adminReleaseDeliverableSelect') as HTMLSelectElement;
        const value = delivDropdown.value;
        Log.trace('AdminConfigTab::releaseDeliverablePressed(..) - value: ' + value);

        if (value !== null && value !== 'null') {
            const url = this.remote + '/portal/admin/release';
            const options: any = AdminView.getOptions();
            options.method = 'post';

            UI.showAlert("This is going to be a long-running operation;" +
                " you can monitor progress by watching the teams in your GitHub org" +
                " as teams are added to repos. " +
                "Please make sure this operation completes before you release again or provision new repos.");

            const provision: ProvisionTransport = {delivId: value, formSingle: false};
            options.body = JSON.stringify(provision); // TODO: handle formSingle correctly

            Log.trace('AdminConfigTab::releaseDeliverablePressed(..) - POSTing to: ' + url);
            const response = await fetch(url, options);

            if (response.status === 200 || response.status === 400) {
                const body = await response.json();
                if (typeof body.success !== 'undefined') {
                    UI.showAlert("Repositories released: " + body.success.length);
                    Log.info("Repositories released: " + JSON.stringify(body.success));
                } else {
                    if (typeof body.failure !== 'undefined') {
                        UI.showAlert(body.failure.message);
                    } else {
                        UI.showAlert(body);
                    }
                }
            } else {
                Log.error("Unexpected problem: " + response.statusText);
                UI.showAlert("Unexpected problem: " + response.statusText);
            }
        }
        Log.trace('AdminConfigTab::releaseDeliverablePressed(..) - done; took: ' + UI.took(start));
    }

    private async buildImage(context: string, tag: string, output: Element): Promise<string> {
        return new Promise<string>(function(resolve, reject) {
            let lines: string[] = [];
            let lastIndex = 0;
            const httpRequest = new XMLHttpRequest();
            httpRequest.onprogress = function() {
                const currIndex = httpRequest.responseText.length;
                if (lastIndex === currIndex) {
                    return;
                }
                const chunk = httpRequest.responseText.substring(lastIndex, currIndex);
                lastIndex = currIndex;

                const chunkLines = chunk.split("\n").filter((s) => s !== "").map((s) => JSON.parse(s).stream.trim());
                output.innerText += chunkLines.join("\n");
                lines = lines.concat(chunkLines);
            };
            httpRequest.onreadystatechange = function() {
                if (httpRequest.readyState === XMLHttpRequest.DONE) {
                    if (httpRequest.status === 200) {
                        const sha = lines[lines.length - 2].replace("Successfully built ", "");
                        // const tag = lines[lines.length - 1].replace("Successfully tagged ", "");
                        resolve(sha);
                    } else {
                        reject('There was a problem with the request: ' + httpRequest.status);
                    }
                }
            };
            httpRequest.open('POST', '/image');
            httpRequest.send(JSON.stringify({remote: context, tag: tag}));
        });
    }

    private async getImageList(): Promise<any[]> {
        return new Promise(function(resolve, reject) {
            const httpRequest = new XMLHttpRequest();
            httpRequest.onreadystatechange = function() {
                if (httpRequest.readyState === XMLHttpRequest.DONE) {
                    if (httpRequest.status === 200) {
                        let images: any[];
                        try {
                            images = JSON.parse(httpRequest.responseText);
                            resolve(images);
                        } catch (err) {
                            reject(err);
                        }
                    } else {
                        reject('There was a problem with the request: ' + httpRequest.status);
                    }
                }
            };
            httpRequest.open('GET', '/portal/admin/images');
            httpRequest.send();
        });
    }

    private bindImagesToTable(images: any[], table: Element, selected?: string): void {
        const frag = document.createDocumentFragment();
        let idxId = 1;
        for (const image of images) {
            const id = image.Id.substring(7, 19); // Strip off "sha256:" and show first 12 characters
            const tag = image.RepoTags[image.RepoTags.length - 1]; // Only use the last assigned tag
            const created = new Date(image.Created * 1000); // Convert the Unix timestamp in seconds to milliseconds
            const e = document.createRange().createContextualFragment(`
                <ons-list-item tappable>
                    <label class="left">
                        <ons-radio name="color" input-id="radio-${idxId}" ${selected === id ? "checked" : ""}></ons-radio>
                    </label>
                    <label for="radio-${idxId}" class="center">
                        <ons-row>
                            <ons-col>${id}</ons-col>
                            <ons-col>${tag}</ons-col>
                            <ons-col>${created}</ons-col>
                        </ons-row>
                    </label>
                </ons-list-item>
                `);
            frag.appendChild(e);
            idxId++;
        }
        table.insertBefore(frag, table.lastChild);
    }
}
