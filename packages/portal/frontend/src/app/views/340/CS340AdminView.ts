import {OnsButtonElement, OnsFabElement, OnsInputElement, OnsListItemElement, OnsSwitchElement} from "onsenui";
import Log from "../../../../../../common/Log";
import {
    AssignmentGrade,
    AssignmentGradingRubric,
    AssignmentInfo,
    AssignmentStatus,
    QuestionGrade,
    SubQuestionGrade,
    SubQuestionGradingRubric
} from "../../../../../../common/types/CS340Types";
import {
    RepositoryPayload,
    RepositoryTransport,
    StudentTransport,
    StudentTransportPayload,
    TeamTransport,
    TeamTransportPayload
} from "../../../../../../common/types/PortalTypes";
import {Deliverable, Grade} from "../../../../../backend/src/Types";
import {Factory} from "../../Factory";
import {SortableTable, TableCell, TableHeader} from "../../util/SortableTable";
import {UI} from "../../util/UI";
import {AdminView} from "../AdminView";

const ERROR_POTENTIAL_INCORRECT_INPUT: string = "input triggered warning";
const ERROR_INVALID_INPUT: string = "invalid input";
const ERROR_NON_NUMERICAL_GRADE: string = "non-numerical grade entered";
const ERROR_NULL_RUBRIC: string = "null rubric-data";
const ERROR_MALFORMED_PAGE: string = "malformed page with info elements";
const WARN_EMPTY_FIELD: string = "empty field";

export class CS340AdminView extends AdminView {

    private grading_selectedDeliverable = "";

    public renderPage(name: string, opts: {}) {
        Log.info('CS340AdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
        super.renderPage(name, opts);

        // custom view init here
        let optsObject : any = opts;

        // Testing framework (check if there is a testing value)
        if(typeof optsObject.test !== "undefined") {
            // Testing Page
            if(optsObject.test === "GradingView") {
                this.populateGradingPage("a1", "jopika").then(() => {
                    Log.info("CS340View::renderPage() - finished populating");
                    return;
                });
            }
            return;
        }

        // Normal structure
        if(name === 'GradingView') {
            if(typeof optsObject.aid !== "undefined" && typeof optsObject.sid !== "undefined" &&
                typeof optsObject.isTeam !== "undefined") {
                // Check if the correct parameters exist
                this.populateGradingPage(optsObject.aid, optsObject.sid, optsObject.isTeam).then(()=> {
                    Log.info("CS340AdminView::renderPage() - finished populating page");
                    return;
                });
                return;
            }
        }

        if(optsObject !== null && typeof optsObject.page !== 'undefined' && optsObject.page === "cs340/admin.html") {
            Log.info("CS340AdminView::renderPage(..) - initial load; checking scheduler");
            this.verifyScheduledJobs(null).then(function (result) {
                if(result > 0) {
                    UI.notificationToast("Verified scheduled tasks; updated " + result + " tasks for related deliverable(s)");
                }
            });
        }

        if(name === 'AdminEditDeliverable') {
            Log.info("CS340AdminView::renderPage(..) - Deliverable editing page triggered");
            if(typeof optsObject.delivId !== "undefined") {
                if(optsObject.delivId === null) {
                    Log.info("CS340AdminView::renderPage(..) - null delivId");
                }
            }
            return;
        }

        // if(opsObject.page !== null) {
        //     console.log("got a non-null page value");
        //     if(opsObject.page === "cs340/GradingView.html") {
        //         if(typeof opsObject.delivId === 'undefined' || typeof  opsObject.sid === 'undefined') {
        //
        //         }
        //         // do stuff
        //         console.log("got into grading");
        //         this.populateGradingPage("a1", "jopika").then((result) => {
        //             Log.info("CS340View::renderPage() - finished populating");
        //         });
        //     }
        // }
    }

    private async verifyScheduledJobs(deliv: Deliverable): Promise<number> {
        Log.info("CS340AdminView::verifyScheduledJobs( " + deliv + " ) - start");

        let url: string;

        if (deliv === null) {
            url = this.remote + '/portal/cs340/verifyScheduledJobs';
        } else {
            url = this.remote + '/portal/cs340/verifyScheduledJobs/' + deliv.id;
        }

        let options: any = AdminView.getOptions();
        options.method = 'post';
        let response = await fetch(url, options);

        if(response.status !== 200) {
            Log.error("CS340AdminView::verifyScheduledJobs - error: got status code: " + response.status);
            return -1;
        } else {
            let jsonResponse = await response.json();
            return (jsonResponse.response as number);
        }
    }


    protected async handleAdminEditDeliverable(opts: any) {
        //options: {"animationOptions":{},"delivId":"a3","page":"editDeliverable.html"}
        Log.info("CS340AdminView::renderEditDeliverablePage(..) - start");
        await super.handleAdminEditDeliverable(opts);
        let that = this;
        // if the deliverable is an assignment, do something(?)

        const fab = document.querySelector('#adminEditDeliverableSave') as OnsFabElement;
        if (super.isAdmin === false) {
            fab.style.display = 'none';
        } else {
            Log.info("CS340AdminView::renderEditDeliverablePage(..) - Adding onclick function");
            fab.addEventListener("click", function(evt) {
                const delivIdElement = document.querySelector('#adminEditDeliverablePage-name') as OnsInputElement;
                if(delivIdElement === null) return;

                Log.info('CS340AdminView::renderEditDeliverablePage(..)::adminEditDeliverableSave::customOnClick');
                // that.checkReleasedGrades().then(function (result) {
                //     Log.info("CS340AdminView::renderEditDeliverablePage(..)::checkReleasedGrades(..) - then: - start");
                //     Log.info("CS340AdminView::renderEditDeliverablePage(..)::checkReleasedGrades(..) - released: " + result);
                // });
                Log.info("CS340AdminView::renderEditDeliverablePage::adminEditDeliverableSave::customOnClick - " + delivIdElement.value);
                // check if it's release
                const releasedSwitch = document.querySelector('#adminEditDeliverablePage-gradesReleased') as OnsSwitchElement;
                if(releasedSwitch.checked) {
                    Log.info("CS340AdminView::renderEditDeliverablePage::adminEditDeliverableSave::customOnClick - releasing grades");
                    that.releaseGrades(delivIdElement.value);
                }
            });
            // fab.onclick = function(evt) {
            //     Log.info('CS340AdminView::renderEditDeliverablePage(..)::adminEditDeliverableSave::customOnClick');
            //     // that.newSave();
            // };
        }

        Log.info("CS340AdminView::renderEditDeliverablePage(..) - Fetching");
        let deliverables: Deliverable[] = await this.getDeliverables();
        for(const deliverableRecord of deliverables) {
            if(deliverableRecord.id === opts.delivId) {
                Log.info("CS340AdminView::renderEditDeliverablePage(..) - Checking AssignmentStatus");
                if(typeof deliverableRecord.custom !== 'undefined' && typeof deliverableRecord.custom.status !== 'undefined') {
                    let assignInfo: AssignmentInfo = (deliverableRecord.custom as AssignmentInfo);
                    let assignStatus: AssignmentStatus = assignInfo.status;
                    let createdSwitch = (document.querySelector('#adminEditDeliverablePage-createdSwitch') as OnsSwitchElement);
                    let readSwitch = (document.querySelector('#adminEditDeliverablePage-readSwitch') as OnsSwitchElement);
                    let pushSwitch = (document.querySelector('#adminEditDeliverablePage-pushSwitch') as OnsSwitchElement);
                    switch (assignStatus) {
                        case AssignmentStatus.INACTIVE: {
                            createdSwitch.removeAttribute("checked");
                            readSwitch.removeAttribute("checked");
                            pushSwitch.removeAttribute("checked");
                            break;
                        }
                        case AssignmentStatus.CREATED: {
                            createdSwitch.setAttribute("checked", 'true');
                            readSwitch.removeAttribute("checked");
                            pushSwitch.removeAttribute("checked");
                            break;
                        }
                        case AssignmentStatus.RELEASED: {
                            createdSwitch.setAttribute("checked", 'true');
                            readSwitch.setAttribute("checked", 'true');
                            pushSwitch.setAttribute("checked", 'true');
                            break;
                        }
                        case AssignmentStatus.CLOSED: {
                            createdSwitch.setAttribute("checked", 'true');
                            readSwitch.setAttribute("checked", 'true');
                            pushSwitch.removeAttribute("checked");
                            break;
                        }
                        default: {
                            createdSwitch.removeAttribute("checked");
                            readSwitch.removeAttribute("checked");
                            pushSwitch.removeAttribute("checked");
                            break;
                        }
                    }
                    let assignStatusHeader = (document.querySelector('#adminEditDeliverablePage-assignmentStatusHeader') as HTMLElement);
                    let assignStatusBody = (document.querySelector('#adminEditDeliverablePage-assignmentStatus') as HTMLElement);

                    // assignStatusHeader.style.display = "initial";
                    assignStatusHeader.removeAttribute("style");
                    assignStatusBody.setAttribute("style", "display: initial");
                } else {
                    Log.info("CS340AdminView::renderEditDeliverablePage(..) - Not an assignment, hiding elements");
                    let assignStatusHeader = (document.querySelector('#adminEditDeliverablePage-assignmentStatusHeader') as HTMLElement);
                    let assignStatusBody = (document.querySelector('#adminEditDeliverablePage-assignmentStatus') as HTMLElement);

                    assignStatusHeader.setAttribute("style" , "display: none");
                    assignStatusBody.setAttribute("style" , "display: none");
                }
            }
        }

        Log.info("CS340AdminView(..) - starting Assignment Interface rendering");

        let delivId: string = opts.delivId;
        if(delivId === null) {
            let isAssnSwitch = (document.querySelector("#adminEditDeliverablePage-isAssignmentSwitch") as OnsSwitchElement);
            isAssnSwitch.removeAttribute("disabled");
            let generateButton = (document.querySelector("#adminEditDeliverablePage-generateButton") as OnsButtonElement);
            generateButton.addEventListener("click", async () => {
                that.generateAssignmentInfo(null);
            });
            isAssnSwitch.addEventListener("click", function ()  {
                // get the current status on the slider
                let isAssnSwitch = (document.querySelector("#adminEditDeliverablePage-isAssignmentSwitch") as OnsSwitchElement);
                let switchStatus = isAssnSwitch.checked;
                if(switchStatus) {
                    UI.showSection("adminEditDeliverablePage-assignmentConfig");
                    // UI.showSection("adminEditDeliverablePage-generateButtonSection");
                } else {
                    UI.hideSection("adminEditDeliverablePage-assignmentConfig");
                    // UI.hideSection("adminEditDeliverablePage-generateButtonSection");
                }
            });
        } else {
            // non-null deliverable
            for(const deliverableRecord of deliverables) {
                if(deliverableRecord.id === delivId) {
                    if(deliverableRecord.custom !== null &&
                    typeof (deliverableRecord.custom as AssignmentInfo).seedRepoURL !== "undefined") {
                        let seedRepoURLElement = (document.querySelector("#adminEditDeliverablePage-seedRepoURL") as OnsInputElement);
                        let seedRepoPathElement = (document.querySelector("#adminEditDeliverablePage-seedRepoPath") as OnsInputElement);
                        let mainFilePathElement = (document.querySelector("#adminEditDeliverablePage-mainFilePath") as OnsInputElement);
                        let courseWeightElement = (document.querySelector("#adminEditDeliverablePage-courseWeight") as OnsInputElement);
                        seedRepoURLElement.value    = (deliverableRecord.custom as AssignmentInfo).seedRepoURL;
                        seedRepoPathElement.value   = (deliverableRecord.custom as AssignmentInfo).seedRepoPath;
                        mainFilePathElement.value   = (deliverableRecord.custom as AssignmentInfo).mainFilePath;
                        courseWeightElement.value   = (deliverableRecord.custom as AssignmentInfo).courseWeight.toString();
                        let assignConfigElement = (document.querySelector("#adminEditDeliverablePage-assignmentConfig") as HTMLDivElement);
                        assignConfigElement.removeAttribute("style");
                        let isAssnSwitch = (document.querySelector("#adminEditDeliverablePage-isAssignmentSwitch") as OnsSwitchElement);
                        isAssnSwitch.setAttribute("checked", 'true');
                        // let generateButtonElement = (document.querySelector("#adminEditDeliverablePage-generateButtonSection") as OnsListItemElement);
                        // generateButtonElement.removeAttribute("style");
                        let generateButton = (document.querySelector("#adminEditDeliverablePage-generateButton") as OnsButtonElement);
                        generateButton.addEventListener("click", async () => {
                            that.generateAssignmentInfo(deliverableRecord);
                        });
                    }
                }
            }
        }
    }

    private generateAssignmentInfo(delivRecord: Deliverable) {
        let seedRepoURLElement = (document.querySelector("#adminEditDeliverablePage-seedRepoURL") as OnsInputElement);
        let seedRepoPathElement = (document.querySelector("#adminEditDeliverablePage-seedRepoPath") as OnsInputElement);
        let mainFilePathElement = (document.querySelector("#adminEditDeliverablePage-mainFilePath") as OnsInputElement);
        let courseWeightElement = (document.querySelector("#adminEditDeliverablePage-courseWeight") as OnsInputElement);

        // adjust the object: pull it from the deliverable object
        let assignInfo: AssignmentInfo;
        if(delivRecord === null) {
            assignInfo = {
                seedRepoURL: "",
                seedRepoPath: "",
                mainFilePath: "",
                courseWeight: 0,
                status: AssignmentStatus.INACTIVE,
                rubric: {
                    name: "",
                    comment: "",
                    questions: []
                },
                repositories: []
            }
        } else {
            assignInfo = delivRecord.custom;
        }
        assignInfo.seedRepoURL = seedRepoURLElement.value;
        assignInfo.seedRepoPath = seedRepoPathElement.value;
        assignInfo.mainFilePath = mainFilePathElement.value;
        assignInfo.courseWeight = Number(courseWeightElement.value);

        let assignCustomElement = (document.querySelector("#adminEditDeliverablePage-custom") as OnsInputElement);
        assignCustomElement.value = JSON.stringify(assignInfo);
    }

    protected async newSave() {
        // await super.deliverablesTab.save();
        // super.deliverablesTab.save();
        let number = await this.verifyScheduledJobs(null);
        Log.info("CS340AdminView::newSave() - tasks generated: " + number);
    }

    protected async handleAdminConfig(opts: any) {
        let that = this;
        await super.handleAdminConfig(opts);
        const selectDelivDropdown: HTMLSelectElement = document.querySelector('#adminActionDeliverableSelect') as HTMLSelectElement;
        await this.populateDeliverableDropdown(selectDelivDropdown);

        (document.querySelector('#adminActionDeliverableSelect') as HTMLSelectElement).onchange = function (evt) {
            Log.warn("Changed the Deliverable Selection to " + (evt.target as HTMLSelectElement).value + " !");

            that.selectDeliverablePressed();
        };


        let releaseFinalButton: any = (document.querySelector('#adminReleaseFinalGrades') as OnsButtonElement);
        releaseFinalButton.addEventListener("click", async function() {
            Log.info("Pressed Final Grades release");

            // get all deliverables
            let deliverables: Deliverable[] = await that.getDeliverables();

            let totalSum = 0;
            for(const deliv of deliverables) {
                if(deliv.custom === null || typeof (deliv.custom as AssignmentInfo).courseWeight === "undefined") {
                    totalSum +=  (deliv.custom as AssignmentInfo).courseWeight;
                }
            }

            if(totalSum !== 1) {
                UI.notificationConfirm("WARNING: Weights for Assignments only" +
                    " add up to " + totalSum + ", not 1.", async function (index: number) {
                    switch(index) {
                        case 1:
                            Log.info("CS340AdminView::handleAdminConfig::releaseFinalButton::confirm - true");
                            that.publishAllFinalGrades();
                            break;
                        default:
                            Log.info("CS340AdminView::handleAdminConfig::releaseFinalButton::confirm - cancelled");
                    }
                });
            } else {
                that.publishAllFinalGrades();
            }


        });

        // reset the information inside of the status boxes
        let delivInfoElement = (document.querySelector("#adminActionDeliverableID") as HTMLParagraphElement);
        let delivStatusElement = (document.querySelector("#adminActionStatusText") as HTMLParagraphElement);
        delivInfoElement.innerHTML = "";
        delivStatusElement.innerHTML = "";

        // lock out all buttons
        const createRepoButton  = document.querySelector('#adminCreateRepositories') as OnsButtonElement;
        const releaseRepoButton = document.querySelector('#adminReleaseRepositories') as OnsButtonElement;
        const closeRepoButton = document.querySelector('#adminCloseRepositories') as OnsButtonElement;
        const deleteRepoButton  = document.querySelector('#adminDeleteRepositories') as OnsButtonElement; // DEBUG
        createRepoButton.disabled = true;
        releaseRepoButton.disabled = true;
        closeRepoButton.disabled = true;
        deleteRepoButton.disabled = true; // DEBUG


        (document.querySelector('#adminCreateRepositories') as OnsButtonElement).onclick = function (evt) {
            Log.info('CS340AdminView::handleAdminConfig(..) - create repo pressed');

            that.createRepoPressed();
        };

        (document.querySelector('#adminReleaseRepositories') as OnsButtonElement).onclick = function (evt) {
            Log.info('CS340AdminView::handleAdminConfig(..) - release repo pressed');

            that.releaseRepoPressed();
        };

        (document.querySelector("#adminCloseRepositories") as OnsButtonElement).onclick = function (evt) {
            Log.info('CS340AdminView::handleAdminConfig(..) - close repo pressed');

            that.closeRepoPressed();
        };

        (document.querySelector('#adminDeleteRepositories') as OnsButtonElement).onclick = function (evt) {
            Log.info('CS340AdminView::handleAdminConfig(..) - delete repo pressed');

            UI.notificationConfirm("WARNING: Data will be deleted, and is non-recoverable." +
                " Are you sure you wish to proceed?", async function(idx: number) {
                switch(idx) {
                    case 1:
                        Log.info("CS340AdminView::handleAdminConfig(..) - proceeded prompt");
                        await that.deleteRepoPressed();
                        break;
                    default:
                        Log.info("CS340AdminView::handleAdminConfig(..) - cancelled prompt");
                        break;
                }
            });
        };


    }

    private async selectDeliverablePressed(): Promise<void> {
        Log.info('CS340AdminView::selectDeliverablePressed(..) - start');
        // Log.info('CS340AdminView::selectDeliverable(..) - ');
        const delivId: string | null = await this.checkStatusAndUpdate(true);

        // (un)lock other buttons
        // const checkStatusButton = document.querySelector('#adminCheckStatus') as OnsButtonElement;
        const createRepoButton  = document.querySelector('#adminCreateRepositories') as OnsButtonElement;
        const releaseRepoButton = document.querySelector('#adminReleaseRepositories') as OnsButtonElement;
        const closeRepoButton = document.querySelector('#adminCloseRepositories') as OnsButtonElement;
        const deleteRepoButton  = document.querySelector('#adminDeleteRepositories') as OnsButtonElement; // DEBUG

        if(delivId === null) {
            Log.info('CS340AdminView::selectDeliverable(..) - did not select deliv, locking buttons');
            // checkStatusButton.disabled = true;
            createRepoButton.disabled = true;
            releaseRepoButton.disabled = true;
            closeRepoButton.disabled = true;
            deleteRepoButton.disabled = true; // DEBUG
        } else {
            // checkStatusButton.disabled = false;
            createRepoButton.disabled = false;
            releaseRepoButton.disabled = false;
            closeRepoButton.disabled = false;
            deleteRepoButton.disabled = false; // DEBUG
        }

        Log.info('CS340AdminView::selectDeliverablePressed(..) - finished');

        return;
    }

    private async checkStatusAndUpdate(update: boolean = false): Promise<string | null> {
        Log.info('CS340AdminView::checkStatusAndUpdate(..) - start');

        const delivDropdown = document.querySelector('#adminActionDeliverableSelect') as HTMLSelectElement;
        const value = delivDropdown.value;

        const statusBox = document.querySelector('#adminActionStatusText') as HTMLParagraphElement;
        statusBox.innerHTML = "";

        const delivIDBox = document.querySelector('#adminActionDeliverableID') as HTMLParagraphElement;
        delivIDBox.innerHTML = "";

        if(value === null || value == "null") return null;
        if(value === "--N/A--") return null;

        Log.trace("CS340AdminView::checkStatusAndUpdate(..) - value: " + value);
        let url: string;

        if(update) {
            UI.showModal("Recalcuating status, this may take a while");
            url = this.remote + '/portal/cs340/updateAssignmentStatus/' + value;
        } else {
            url = this.remote + '/portal/cs340/getAssignmentStatus/' + value;
        }

        let options: any = AdminView.getOptions();

        options.method = 'get';
        let response = await fetch(url, options);

        if(update) UI.hideModal();

        if(response.status === 200) {
            let responseJson = await response.json();
            // get the textbox
            switch (responseJson.response.assignmentStatus) {
                case AssignmentStatus.INACTIVE: {
                    statusBox.innerHTML = ": NOT CREATED - " + " Repositories: " +
                        responseJson.response.studentRepos + "/" + responseJson.response.totalStudents;
                    break;
                }
                case AssignmentStatus.CREATED: {
                    statusBox.innerHTML = ": CREATED - " + " Repositories: " +
                        responseJson.response.studentRepos + "/" + responseJson.response.totalStudents;
                    break;
                }
                case AssignmentStatus.RELEASED: {
                    statusBox.innerHTML = ": RELEASED - " + " Repositories: " +
                        responseJson.response.studentRepos + "/" + responseJson.response.totalStudents;
                    break;
                }
                case AssignmentStatus.CLOSED: {
                    statusBox.innerHTML = ": CLOSED - " + " Repositories: " +
                        responseJson.response.studentRepos + "/" + responseJson.response.totalStudents;
                    break;
                }
                default: {
                    Log.trace('CS340AdminView::checkStatusAndUpdate(..) - error; ' +
                        'deliverable not set up properly');

                    UI.notification("Broken Status; value: " + responseJson.response.assignmentStatus);
                    return null;
                }
            }
        } else {
            UI.notification("Deliverable not set up properly!");
            return null;
        }

        delivIDBox.innerHTML = value;
        return value;
    }

    private async createRepoPressed(): Promise<void> {
        Log.info('CS340AdminView::createRepoPressed(..) - start');
        // Log.info('CS340AdminView::createRepoPressed(..) - start');

        const delivIDBox = document.querySelector('#adminActionDeliverableID') as HTMLParagraphElement;
        const delivID = delivIDBox.innerHTML;

        Log.info('CS340AdminView::createRepoPressed(..) - ' + delivID + " selected, beginning repo creation");

        UI.showModal("Creating repositories, please wait... This action may take a while....");

        const url = this.remote + '/portal/cs340/initializeAllRepositories/' + delivID;
        let options: any = AdminView.getOptions();

        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();

        const jsonResponse = await response.json();
        if(response.status === 200) {
            if(jsonResponse.response == true) {
                UI.notification("Success; All repositories created!");
            } else {
                UI.notification("Error: Some repositories were not created, please try again");
            }
        } else {
            Log.error("Issue with creating repositories; status: " + response.status);

            UI.notification("Error: " + jsonResponse.error);
        }

        this.checkStatusAndUpdate();
        Log.info('CS340AdminView::createRepoPressed(..) - finish');

        return;
    }

    private async closeRepoPressed(): Promise<void> {
        Log.info('CS340AdminView::closeRepoPressed(..) - start');
        const delivIDBox = document.querySelector('#adminActionDeliverableID') as HTMLParagraphElement;
        const delivID = delivIDBox.innerHTML;

        Log.info('CS340AdminView::closeRepoPressed(..) - ' + delivID + " selected, beginning repo publishing");
        UI.showModal("Closing repositories, please wait...");
        const url = this.remote + '/portal/cs340/closeAllRepositories/' + delivID;
        let options: any = AdminView.getOptions();

        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();

        const jsonResponse = await response.json();
        if(response.status === 200) {
            if(jsonResponse.response == true) {
                UI.notification("Success; All repositories closed!");
            } else {
                UI.notification("Error: Some repositories were not closed, please try again");
            }
        } else {
            Log.error("Issue with closing repositories; status: " + response.status);

            UI.notification("Error: " + jsonResponse.error);
        }

        this.checkStatusAndUpdate();
        Log.info('CS340AdminView::closeRepoPressed(..) - finish');
    }

    private async releaseRepoPressed(): Promise<void> {
        Log.info('CS340AdminView::releaseRepoPressed(..) - start');
        // Log.info('CS340AdminView::releaseRepoPressed(..) - start');

        const delivIDBox = document.querySelector('#adminActionDeliverableID') as HTMLParagraphElement;
        const delivID = delivIDBox.innerHTML;

        Log.info('CS340AdminView::releaseRepoPressed(..) - ' + delivID + " selected, beginning repo publishing");

        UI.showModal("Releasing repositories, please wait...");

        const url = this.remote + '/portal/cs340/publishAllRepositories/' + delivID;
        let options: any = AdminView.getOptions();

        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();


        const jsonResponse = await response.json();
        if(response.status === 200) {
            if(jsonResponse.response == true) {
                UI.notification("Success; All repositories released!");
            } else {
                UI.notification("Error: Some repositories were not released, please try again");
            }
        } else {
            Log.error("Issue with releasing repositories; status: " + response.status);

            UI.notification("Error: " + jsonResponse.error);
        }

        this.checkStatusAndUpdate();
        Log.info('CS340AdminView::releaseRepoPressed(..) - finish');

        return;
    }

    private async publishAllFinalGrades(): Promise<boolean> {
        Log.info("CS340AdminView::publishAllFinalGrades(..) - start");

        UI.notificationToast("Publishing all final grades.");

        const publishUrl = this.remote + "/portal/cs340/publishAllFinalGrades";
        const publishOptions: any = AdminView.getOptions();
        publishOptions.method = 'post';

        let publishResponse = await fetch(publishUrl, publishOptions);

        const publishJson = await publishResponse.json();
        if(publishResponse.status === 200) {
            if(publishJson.response) {
                UI.notificationToast("Finished publishing final grades");
            } else {
                UI.notificationToast("An error occurred when publishing final grades.");
            }
        } else {
            UI.notification("Error: " + publishJson.error);
        }

        // UI.notificationToast("Completed publishing all final grades.");

        return publishJson.status;
    }

    private async deleteRepoPressed(): Promise<void> {
        Log.warn('CS340AdminView::deleteRepoPressed(..) - start');
        // Log.warn('CS340AdminView::deleteRepoPressed(..) - start');
        const delivIDBox = document.querySelector('#adminActionDeliverableID') as HTMLParagraphElement;
        const delivID = delivIDBox.innerHTML;

        Log.warn('CS340AdminView::deleteRepoPressed(..) - ' + delivID + " selected, beginning repo deleting");

        UI.showModal("Deleting repositories, please wait...");

        const url = this.remote + '/portal/cs340/deleteAllRepositories/' + delivID;
        let options: any = AdminView.getOptions();

        options.method = 'post';
        let response = await fetch(url, options);
        UI.hideModal();


        const jsonResponse = await response.json();
        if(response.status === 200) {
            if(jsonResponse.response == true) {
                UI.notification("Success; All repositories deleted!");
            } else {
                UI.notification("Error: Some repositories were not deleted, please try again");
            }
        } else {
            Log.error("Issue with deleting repositories; status: " + response.status);

            UI.notification("Error: " + jsonResponse.error);
        }

        this.checkStatusAndUpdate();
        Log.warn('CS340AdminView::deleteRepoPressed(..) - finish');

        return;
    }

    private async populateDeliverableDropdown(dropDown: HTMLSelectElement, selectedValue?: string): Promise<void> {
        const deliverables = await this.getDeliverables();
        // const delivDropdown = document.querySelector('#adminDefaultDeliverableSelect') as HTMLSelectElement;
        let delivOptions = ['--N/A--'];
        for (const deliv of deliverables) {
            delivOptions.push(deliv.id);
        }
        delivOptions = delivOptions.sort();

        dropDown.innerHTML = '';
        for (const delivId of delivOptions) {
            let selected = false;
            if(selectedValue) {
                if(selectedValue === delivId) {
                    selected = true;
                }
            }

            let value = delivId;
            if (delivId.startsWith('--')) {
                // handle the null case
                value = null;
            }

            const o: HTMLOptionElement = new Option(delivId, value, false, selected);
            dropDown.add(o);
        }
        return;
    }

    private async getDeliverables(): Promise<Deliverable[]> {
        const delivOptions = AdminView.getOptions();
        const delivUrl: string = this.remote + '/portal/cs340/getAllDeliverables';
        const delivResponse = await fetch(delivUrl, delivOptions);

        if(delivResponse.status !== 200) {
            Log.trace("CS340AdminView::renderStudentGrades(..) - !200 " +
                "response received; code:" + delivResponse.status);
            return;
        }
        const delivJson = await delivResponse.json();
        const delivArray: Deliverable[] = delivJson.response;

        return delivArray;
    }

    public async handleAdminGrades(opts: any) {
        Log.info("CS340AdminView::handleAdminGrades( " + JSON.stringify(opts) + " ) - start");
        // await super.handleAdminGrades(opts);
        let that = this;

        const delivSelector = document.querySelector('#adminGradesDeliverableSelect') as HTMLSelectElement;
        await this.populateDeliverableDropdown(delivSelector, this.grading_selectedDeliverable);

        Log.info("CS340AdminView::handleAdminGrades(..) - handling hook");
        delivSelector.onchange = async function(evt) {
            Log.info("CS340AdminView::handleAdminGrades(..)::delivSelector:onChange - event: " + evt);
            await that.renderStudentGradesDeliverable((evt.target as HTMLSelectElement).value);
            that.grading_selectedDeliverable = (evt.target as HTMLSelectElement).value;
        };

        Log.info("CS340AdminView::handleAdminGrades(..) - finished handling hook");

        // let emptyResultsElement = document.querySelector('#gradesListTableNone') as HTMLDivElement;
        // let tabledResultsElement = document.querySelector("#gradesListTable") as HTMLDivElement;
        // emptyResultsElement.removeAttribute("style");
        // tabledResultsElement.setAttribute("style", "display:none");
        if(this.grading_selectedDeliverable === "" || this.grading_selectedDeliverable == "--N/A--") {
            UI.hideSection("gradesListTable");
            UI.showSection("gradesListTableNone");
        } else {
            await this.renderStudentGradesDeliverable(this.grading_selectedDeliverable);
        }
    }

    public async handleAdminCustomGrades(opts: any) {
        Log.info("CS340AdminView::handleCustomGrades( " + JSON.stringify(opts) + " ) - start");
        // if(opts.delivid === null || opts.sid === null) {
        //     Log.error("CS340AdminView::handleCustomGrades()")
        // }
        const start = Date.now();
        UI.showModal("Retrieving student list");

        // Retrieve the studentGradeTable
        document.getElementById('studentGradeTable').innerHTML = ""; // Clear target

        const studentOptions = AdminView.getOptions();
        const studentUrl = this.remote + '/portal/admin/students';
        const studentResponse = await fetch(studentUrl, studentOptions);
        UI.hideModal();
        if(studentResponse.status === 200) {
            Log.info('CS340AdminView::handCustomGrades(..) - Received student list');
            const studentJson: StudentTransportPayload = await studentResponse.json();
            if(typeof studentJson.success !== 'undefined' && Array.isArray(studentJson.success)) {
                Log.info("CS340AdminView::handCustomGrades(..) - took: " + UI.took(start));
                const gradesOptions: any= AdminView.getOptions();
                gradesOptions.method = 'get';
                const gradesUrl: string = this.remote + '/portal/cs340/getAllGrades';
                const gradesResponse = await fetch(gradesUrl, gradesOptions);

                if(gradesResponse.status === 200) {
                    Log.info("CS340AdminView::handCustomGrades(..) - got grades");
                    const gradesJson = await gradesResponse.json();
                    const gradeData: Grade[] = gradesJson.response;
                    // TODO [Jonathan]: Remove the hardcoding(?)
                    this.renderStudentGrades(studentJson.success, gradeData, "-All-");
                } else {
                    Log.trace("CS340AdminView::handCustomGrades(..) - !200 received " +
                        "when retrieving grade: " + gradesResponse.status);
                }
            } else {
                Log.info("CS340AdminView::handCustomGrades(..) - ERROR: " + studentJson.failure.message);
                AdminView.showError(studentJson.failure);
            }
        } else {
            Log.trace("CS340AdminView::handCustomGrades(..) - !200 received when retrieving students: " +
                studentResponse.status);
            const text = await studentResponse.text();
            AdminView.showError(text);
        }
    }

    private calculateMaxGrade(deliverableRecord: Deliverable): number {
        Log.info("CS340AdminView::calculateMaxGrade( " + deliverableRecord.id + " ) - start");
        let maxGrade:number = 0;
        let assignInfo: AssignmentInfo | null = deliverableRecord.custom;
        if(assignInfo === null || typeof assignInfo.rubric === 'undefined') {
            Log.error("CS340AdminView::calculateMaxGrade(..) - Error: Deliverable is not an assignment");
            return -1;
        }
        let assignRubric: AssignmentGradingRubric = assignInfo.rubric;
        if(assignRubric === null || typeof assignRubric.questions === 'undefined') {
            Log.error("CS340AdminView::calculateMaxGrade(..) - Error: Deliverable is not an assignment");
            return -1;
        }

        for(const questionRubric of assignRubric.questions) {
            for(const subQuestionRubric of questionRubric.subQuestions) {
                // TODO: Take into account weight
                maxGrade += subQuestionRubric.outOf;
            }
        }

        return maxGrade;
    }

    private checkIfCompletelyGraded(gradeRecord: Grade): boolean {
        if(gradeRecord === null) {
            return false;
        }

        let assignRecord: AssignmentGrade = gradeRecord.custom;

        if (assignRecord !== null) {
            if(typeof assignRecord.questions !== 'undefined') {
                for(const question of assignRecord.questions) {
                    for(const subQuestion of question.subQuestion) {
                        if(!subQuestion.graded) {
                            return false;
                        }
                    }
                }
                return true;
            }
        }

        return false;
    }

    public async renderStudentGradesDeliverable(delivId: string, hiddenNames: boolean = false) {
        Log.info("CS340AdminView::renderStudentGradeDeliverable( " + delivId + " ) - start");

        let emptyResultsElement = document.querySelector('#gradesListTableNone') as HTMLDivElement;
        let tabledResultsElement = document.querySelector("#gradesListTable") as HTMLDivElement;
        if(delivId === null || delivId === "null") {
            Log.info("CS340AdminView::renderStudentGradeDeliverable(..) - null value, hiding the table");
            emptyResultsElement.removeAttribute("style");
            tabledResultsElement.setAttribute("style", "display:none");
        } else {
            tabledResultsElement.removeAttribute("style");
            emptyResultsElement.setAttribute("style", "display:none");
        }

        UI.showModal("Rendering page");

        const teamsOptions = AdminView.getOptions();
        const teamsURL = this.remote + '/portal/admin/teams';
        const teamsResponse = await fetch(teamsURL,teamsOptions);

        const studentOptions = AdminView.getOptions();
        const studentUrl = this.remote + '/portal/admin/students';
        const studentResponse = await fetch(studentUrl, studentOptions);

        const gradesOptions = AdminView.getOptions();
        const gradesUrl: string = this.remote + '/portal/cs340/getAllGrades';
        const gradesResponse = await fetch(gradesUrl, gradesOptions);

        let requestStatus: boolean = true;

        if(teamsResponse.status !== 200) {
            Log.error("CS340AdminView::renderStudentGradeDeliverable(..) - !200 received when fetching " +
                "teams; code: " + teamsResponse.status);
            requestStatus = false;
        } else {
            Log.info("CS340AdminView::renderStudentGradeDeliverable(..) - received all teams");
        }


        if(studentResponse.status !== 200) {
            Log.error("CS340AdminView::renderStudentGradeDeliverable(..) - !200 received when fetching " +
                "students; code: " + studentResponse.status);
            requestStatus = false;
        } else {
            Log.info("CS340AdminView::renderStudentGradeDeliverable(..) - received all students");
        }


        if(gradesResponse.status !== 200) {
            Log.error("CS340AdminView::renderStudentGradeDeliverable(..) - !200 received when fetching " +
                "students; code: " + gradesResponse.status);
            requestStatus = false;
        } else {
            Log.info("CS340AdminView::renderStudentGradeDeliverable(..) - received all grades");
        }


        if(!requestStatus) {
            Log.error("CS340AdminView::renderStudentGradeDeliverable(..) - failed to get all information, unable to continue");
            return;
        }

        const teamsJson: TeamTransportPayload = await teamsResponse.json();
        const studentJson: StudentTransportPayload = await studentResponse.json();
        const gradesJson = await gradesResponse.json(); // TODO: Verify if this should not use the grade struct
        let teamsTransport: TeamTransport[] = teamsJson.success;
        let studentsTransport: StudentTransport[] = studentJson.success;
        let grades: Grade[] = gradesJson.response;

        let filteredTeams: TeamTransport[] = [];
        let maxSize = 1;
        for(const teamTransport of teamsTransport) {
            if(teamTransport.delivId === delivId) {
                filteredTeams.push(teamTransport);
                if(maxSize < teamTransport.people.length) {
                    maxSize = teamTransport.people.length;
                }
            }
        }

        // create a grade mapping
        let gradeMapping: {[studentId: string]: Grade} = {};
        for(const grade of grades) {
            // if(typeof gradeMapping[grade.personId] === 'undefined') gradeMapping[grade.personId] = {};
            // if the grade is an assignmentGrade; place it in the mapping
            if(grade.custom !== null && typeof (grade.custom as AssignmentGrade).assignmentID !== "undefined") {
                if((grade.custom as AssignmentGrade).assignmentID === delivId) {
                    gradeMapping[grade.personId] = grade;
                }
            }
        }

        // create a studentMapping
        let studentMapping: {[studentId: string]: StudentTransport} = {};
        for(const studentTransport of studentsTransport) {
            if(typeof studentMapping[studentTransport.id] === "undefined") {
                studentMapping[studentTransport.id] = studentTransport;
            }
        }

        const delivArray: Deliverable[] = await this.getDeliverables();

        let maxGrade: number = -1;
        for (const deliverableRecord of delivArray) {
            if(deliverableRecord.id === delivId) maxGrade = this.calculateMaxGrade(deliverableRecord);
        }

        let tableHeaders: TableHeader[] = [];
        if(!hiddenNames) {
            let firstHeader = true; // only the first header is sorted by default
            for(let i = 0; i < maxSize; i++) {
                let newHeader: TableHeader = {
                    id:             'uid' + i,
                    text:           'id' + i,
                    sortable:       true,
                    defaultSort:    firstHeader,
                    sortDown:       false,
                    style:          'padding-left: 1em; padding-right: 1em;'
                };
                firstHeader = false; // don't want any other headers to be 'default sorted'!
                tableHeaders.push(newHeader);
            }
        } else {
            // names are hidden
            // TODO: Implement hidden names (render one column for each team, with a number)
        }

        tableHeaders.push({
            id:             "repo",
            text:           "Repository",
            sortable:       true,
            defaultSort:    false,
            sortDown:       false,
            style:          'padding-left: 1em; padding-right: 1em;'
        });

        tableHeaders.push({
            id:             "grade",
            text:           "Grade",
            sortable:       true,
            defaultSort:    false,
            sortDown:       false,
            style:          'padding-left: 1em; padding-right: 1em;'
        });

        const st = new SortableTable(tableHeaders, "#gradesListTable");

        // for every team, create a new row
        for(const teamTransport of filteredTeams) {
            let newRow: TableCell[] = [];
            for(const personId of teamTransport.people) {
                newRow.push({value: personId, html: personId});
            }

            // handle uneven team sizes
            for(let i = teamTransport.people.length; i < maxSize; i++) {
                newRow.push({value: "", html: ""}); // blank, just so table sizes are consistent
            }

            // ASSUMPTION: If students are on a team for a deliverable, they should all have the same grade
            let foundGrade = false;
            let studentId: string = teamTransport.people[0];
            let newEntry: TableCell;

            // TODO: Add the repo link (submission link)
            const repoOptions = AdminView.getOptions();
            const repoUrl = this.remote + "/portal/cs340/getRepository/" + teamTransport.id;
            const repoResponse = await fetch(repoUrl, repoOptions);

            if(repoResponse.status !== 200) {
                Log.error("CS340AdminView::renderStudentGradeDeliverable(..) - Error: unable to find a repo for the team")
                continue;
            }

            let repoJson = await repoResponse.json();
            let repoTransport: RepositoryTransport = repoJson.response;

            let repoEntry: TableCell = {
                value: repoTransport.URL,
                html: "<a href='" + repoTransport.URL + "'> Link </a>"
            };

            newRow.push(repoEntry);

            let completelyGraded: boolean;
            if(typeof gradeMapping[studentId] === 'undefined') {
                completelyGraded = false;
            } else {
                completelyGraded = this.checkIfCompletelyGraded(gradeMapping[studentId]);
            }

            if(typeof gradeMapping[studentId] !== 'undefined' && completelyGraded) {
                // we have a grade for this team
                newEntry = {
                    value: gradeMapping[studentId].score,
                    html: "<a onclick='window.myApp.view.transitionGradingPage(\""+
                        studentMapping[studentId].id + "\", \"" + delivId + "\", true)' href='#'>" +
                        gradeMapping[studentId].score.toString() + "/" +
                        maxGrade + "</a>"
                };
            } else {
                // we do not have a grade for this team
                newEntry = {
                    value: "---",
                    html: "<a onclick='window.myApp.view.transitionGradingPage(\"" +
                    studentMapping[studentId].id + "\", \"" + delivId + "\", true)' href='#'> ---" + "</a>",
                };
            }

            newRow.push(newEntry);
            // TODO: Finish this up by rendering the rest of the page

            st.addRow(newRow);
        }

        st.generate();

        UI.hideModal();
    }

    private async renderStudentGrades(students: StudentTransport[], grades: Grade[], selectedAssign: string) {
        Log.info("CS340AdminView::renderStudentGrades( " + students.toString() +
            ", " + grades.toString() + ", " + selectedAssign + ", " + " ) - start");

        // const delivOptions = AdminView.getOptions();
        // const delivUrl: string = this.remote + '/portal/getAllDeliverables';
        // const delivResponse = await fetch(delivUrl, delivOptions);
        //
        // if(delivResponse.status !== 200) {
        //     Log.trace("CS340AdminView::renderStudentGrades(..) - !200 " +
        //         "response received; code:" + delivResponse.status);
        //     return;
        // }
        // const delivJson = await delivResponse.json();
        // const delivArray: Deliverable[] = delivJson.response;
        const delivArray: Deliverable[] = await this.getDeliverables();

        let tableHeaders: TableHeader[] = [
            {
                id:          'id',
                text:        'Github Id',
                sortable:    true, // Whether the column is sortable (sometimes sorting does not make sense).
                defaultSort: true, // Whether the column is the default sort for the table. should only be true for one column.
                sortDown:    false, // Whether the column should initially sort descending or ascending.
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'fName',
                text:        'First Name',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            },
            {
                id:          'lName',
                text:        'Last Name',
                sortable:    true,
                defaultSort: false,
                sortDown:    true,
                style:       'padding-left: 1em; padding-right: 1em;'
            }
        ];
        let filteredDelivArray: Deliverable[] = [];
        let maxGradeMap: {[delivId:string]:number} = {};

        for (const deliv of delivArray) {
            if(selectedAssign === "-All-" || selectedAssign === deliv.id) {
                Log.info("CS340AdminView::renderStudentGrades(..) - Adding deliverable: " + deliv.id);
                let newHeader = {
                    id:             deliv.id,
                    text:           deliv.id,
                    sortable:       false,
                    defaultSort:    false,
                    sortDown:       true,
                    style:          'padding-left: 1em; padding-right: 1em;',
                };
                filteredDelivArray.push(deliv);
                tableHeaders.push(newHeader);

                // process max grade
                maxGradeMap[deliv.id] = this.calculateMaxGrade(deliv);
            }
        }

        const st = new SortableTable(tableHeaders, "#studentGradeTable");
        // For each grade, let
        let gradeMapping: {[studentId:string]:{[delivId:string]:Grade}} = {};
        for(const grade of grades) {
            if (typeof gradeMapping[grade.personId] === 'undefined') {
                // If there is no mapping from person to map(delivId,grade)
                // set up the mapping
                gradeMapping[grade.personId] = {};
            }
            // If the grade is a valid AssignmentGrade, place it in the mapping
            if(grade.custom !== null && typeof grade.custom.assignmentID !== "undefined") {
                gradeMapping[grade.personId][grade.custom.assignmentID] = grade;
            }
        }

        for(const student of students) {
            // TODO [Jonathan]: Add SID and hideable student names
            let newRow: TableCell[] = [
                {value: student.id, html: '<a href="' + student.userUrl + '">' + student.id + '</a>'},
                {value: student.firstName, html: student.firstName},
                {value: student.lastName, html: student.lastName},
            ];
            for(const delivCol of filteredDelivArray) {
                let foundGrade = false;
                if(typeof gradeMapping[student.id] === "undefined") gradeMapping[student.id] = {};
                if(typeof gradeMapping[student.id][delivCol.id] !== "undefined") foundGrade = true;

                // let completelyGraded:boolean = this.checkIfCompletelyGraded(gradeMapping[student.id][delivCol.id]);

                let completelyGraded: boolean;
                if(typeof gradeMapping[student.id] === 'undefined' ||
                    typeof gradeMapping[student.id][delivCol.id] === 'undefined' ) {
                    completelyGraded = false;
                } else {
                    completelyGraded = this.checkIfCompletelyGraded(gradeMapping[student.id][delivCol.id]);
                }

                if(foundGrade && completelyGraded) {
                    let newEntry = {
                        value: gradeMapping[student.githubId][delivCol.id].score,
                        html: "<a onclick='window.myApp.view.transitionGradingPage(\""+
                        student.githubId + "\", \"" + delivCol.id + "\")' href='#'>" +
                        gradeMapping[student.githubId][delivCol.id].score.toString() +
                        "/" + maxGradeMap[delivCol.id] + "</a>"
                    };
                    newRow.push(newEntry);
                } else {
                    let newEntry = {
                        value: "---",

                        html: "<a onclick='window.myApp.view.transitionGradingPage(\""+
                        student.githubId + "\", \"" + delivCol.id + "\")' href='#'> ---" + "</a>",

                    };
                    newRow.push(newEntry);
                }
            }
            st.addRow(newRow);
        }
        st.generate();
        // TODO [Jonathan]: Add rest of code, regarding student table generation (hideable options)
    }


    /**
     * Checks all deliverables and releases their grades, if needed
     * @returns {Promise<number>} - Number of deliverables where grades were released
     */
    public async checkReleasedGrades(): Promise<number>{
        Log.info("CS340AdminView::checkReleasedGrades() - start");
        // check all deliverables if they need to have any grades released
        let deliverables: Deliverable[] = await this.getDeliverables();
        let promiseArray: Promise<boolean>[] = [];
        for(const deliv of deliverables) {
            if(deliv.gradesReleased) {
                promiseArray.push(this.releaseGrades(deliv.id));
            }
        }
        let count: number = 0;
        // Promise.all(promiseArray).then(function(values) {
        //     for(const value of values) {
        //         if(value) count++;
        //     }
        //     Log.info("CS340AdminView::releaseGrades() - released grades for " + count + " deliverables");
        // });
        let result = await Promise.all(promiseArray);
        for(const value of result) {
            if(value) count++;
        }

        return count;
    }

    public async releaseGrades(delivId: string): Promise<boolean> {
        Log.info("CS340AdminView::releaseGrades( " + delivId + " ) - start");

        const releaseOptions: any = AdminView.getOptions();
        releaseOptions.method = "post";
        const releaseUrl = this.remote + "/portal/cs340/releaseGrades/" + delivId;
        const releaseResponse = await fetch(releaseUrl, releaseOptions);
        const releaseJson = await releaseResponse.json();

        if(releaseResponse.status !== 200) {
            Log.error("CS340AdminView::releaseGrades(..) - error: " + releaseJson.error);
            return false;
        }

        return releaseJson.response;
    }

    /**
     * Grabs the page and adds the grading view as specified in the deliverable
     * @param {string} delivId
     * @param {string} sid
     * @returns {Promise<void>}
     */
    public async populateGradingPage(delivId: string, sid : string, isTeam: boolean=false) {
        Log.info("CS340View::populateGradingPage() - start");

        UI.showModal("Populating grading view, please wait...");
        let rubric : AssignmentGradingRubric = await this.getGradingRubric(delivId);
        if (rubric === null) {
            // Log.error(rubric);
            Log.error("CS340View::populateGradingPage() - Unable to populate page due to missing rubric");
            return;
        }
        Log.info("CS340View::populateGradingPage() - Rubric: " + rubric);

        let previousSubmission = await this.getStudentGrade(sid, delivId);

        let assignmentInfoElement   = document.getElementById('assignmentInfoSection');
        let gradingSectionElement   = document.getElementById('gradingSection');

        let assignmentInfoList      = document.createElement("div");
        let assignmentIDBox         = document.getElementById("aidBox");
        let studentIDBox            = document.getElementById("sidBox");

        if(isTeam) {
            let teamIndicator: HTMLParagraphElement = document.createElement("p");
            teamIndicator.innerHTML = "Editing team grade of: " + sid;
            teamIndicator.id = "teamIndicator";
            assignmentInfoList.appendChild(teamIndicator);
        }

        let assignmentInfoAssignmentID = document.createElement("p");
        assignmentInfoAssignmentID.innerHTML = delivId;
        assignmentInfoAssignmentID.setAttribute("class", "aInfoID");

        let assignmentInfoStudentID = document.createElement("p");
        assignmentInfoStudentID.innerHTML = sid;
        assignmentInfoStudentID.setAttribute("class", "aInfoSID");
        assignmentIDBox.appendChild(assignmentInfoAssignmentID);
        studentIDBox.appendChild(assignmentInfoStudentID);

        if (gradingSectionElement === null || assignmentInfoElement === null) {
            Log.error("CS340View::populateGradingPage() - Unable to populate page due to missing elements");
            return;
        }

        assignmentInfoElement.appendChild(assignmentInfoList);


        // Create a "DID NOT COMPLETE" button
        let dncButton = document.createElement("ons-button");
        dncButton.setAttribute("onclick", "window.myApp.view.submitGrade(false)");
        dncButton.setAttribute("style", "margin-left: 1em; background: red");
        dncButton.innerHTML = "No Submission";
        gradingSectionElement!.appendChild(dncButton);


        for (let i = 0; i < rubric.questions.length; i++) {
            // Get the i-th question
            let question = rubric.questions[i];

            let questionHeaderElement = document.createElement("h3");
            let questionHeader = document.createElement("span");
            let questionHeaderComponent1 = document.createElement("span");
            let questionHeaderComponent2 = document.createElement("span");

            // TODO: Check this
            questionHeaderComponent1.innerHTML = question.name;
            questionHeaderComponent1.setAttribute("class", "questionName");
            questionHeaderComponent2.setAttribute("class", "redText");
            questionHeaderComponent2.innerHTML = " *";

            questionHeader.appendChild(questionHeaderComponent1);
            questionHeader.appendChild(questionHeaderComponent2);
            questionHeaderElement.appendChild(questionHeader);
            gradingSectionElement.appendChild(questionHeaderElement);

            let questionBox = document.createElement("div");
            questionBox.setAttribute("class", "questionBox");

            for(let j = 0; j < question.subQuestions.length; j++) {
                let subQuestion : SubQuestionGradingRubric = question.subQuestions[j];

                let questionSubBoxElement = document.createElement("div");
                questionSubBoxElement.setAttribute("class", "subQuestionBody");

                // Create the grade input element
                let subInfoBoxElement = document.createElement("div");
                subInfoBoxElement.setAttribute("class", "subQuestionInfoBox");

                // Contains the feedback box for the particular subquestion
                let subTextBoxElement = document.createElement("div");
                subTextBoxElement.setAttribute("class", "subQuestionTextBox");

                let subErrorBoxElement = document.createElement("div");
                subErrorBoxElement.setAttribute("class", "subQuestionErrorBox");


                // Create the grade input element
                let gradeInputElement = document.createElement("ons-input");
                gradeInputElement.setAttribute("type", "number");
                if(previousSubmission === null || !previousSubmission.questions[i].subQuestion[j].graded) {
                    gradeInputElement.setAttribute("placeHolder", subQuestion.name);
                } else {
                    gradeInputElement.setAttribute("placeHolder",
                        previousSubmission.questions[i].subQuestion[j].grade.toString());
                    (gradeInputElement as OnsInputElement).value = previousSubmission.questions[i].subQuestion[j].grade.toString();
                }
                gradeInputElement.setAttribute("data-type", subQuestion.name);
                gradeInputElement.setAttribute("modifier", "underbar");
                gradeInputElement.setAttribute("class", "subQuestionGradeInput");
                gradeInputElement.setAttribute("onchange",
                    "window.myApp.view.checkIfWarning(this)");
                gradeInputElement.setAttribute("data-outOf", "" + subQuestion.outOf);
                gradeInputElement.innerHTML = subQuestion.name + " [out of " + subQuestion.outOf + "]";

                // Add grade input to infoBox
                subInfoBoxElement.appendChild(gradeInputElement);

                // Create error box that is initially invisible
                let errorBox = document.createElement("p");
                errorBox.setAttribute("class", "errorBox");

                // Add the error box to the info box section
                subInfoBoxElement.appendChild(errorBox);

                // Create input form for feedback form
                let textBoxElement = document.createElement("textArea");
                let textBoxLabelElement = document.createElement("p");
                textBoxLabelElement.innerHTML = "Comments & Feedback";
                textBoxLabelElement.setAttribute("class", "textboxLabel");
                textBoxElement.setAttribute("class", "textarea");
                textBoxElement.setAttribute("style", "width: 100%;height: 75%; min-width: 100px;min-height: 50px");
                if(previousSubmission !== null && previousSubmission.questions[i].subQuestion[j].graded) {
                    textBoxElement.innerHTML = previousSubmission.questions[i].subQuestion[j].feedback;
                }

                subTextBoxElement.appendChild(textBoxLabelElement);
                subTextBoxElement.appendChild(textBoxElement);

                // Add two subboxes to the subQuestion box
                questionSubBoxElement.appendChild(subInfoBoxElement);
                questionSubBoxElement.appendChild(subTextBoxElement);

                // Add the subQuestion to the question box
                questionBox.appendChild(questionSubBoxElement);
            }

            // Add the questionBox to the gradingSection
            gradingSectionElement!.appendChild(questionBox);
        }

        // Create a Save Grade button
        let submitButton = document.createElement("ons-button");
        submitButton.setAttribute("onclick", "window.myApp.view.submitGrade()");
        submitButton.innerHTML = "Save Grade";


        gradingSectionElement!.appendChild(submitButton);
    }

    public async submitGrade(completed: boolean = true): Promise<AssignmentGrade|null> {
        let errorStatus = false;
        let warnStatus = false;
        let warnComment: string = "";
        let errorComment: string = "";
        let questionArray : QuestionGrade[] = [];
        let questionBoxes = document.getElementsByClassName("questionBox");

        for (let i = 0; i < questionBoxes.length; i++) {
            // A single question box, representative of many subquestions
            let questionBox = questionBoxes[i];
            // Get each subquestion from the questionBox
            let subQuestions = questionBox.getElementsByClassName("subQuestionBody");
            // initalize an array to place all the information inside
            let subQuestionArray : SubQuestionGrade[] = [];

            // for each subQuestion
            for (let j = 0; j < subQuestions.length; j++) {
                // Get a single subQuestion
                let subQuestion = subQuestions[j];

                // Grab the elements associated with the subQuesiton
                let gradeInputElements = subQuestion.getElementsByClassName("subQuestionGradeInput");
                let errorElements = subQuestion.getElementsByClassName("errorBox");
                let responseBoxElements = subQuestion.getElementsByClassName("textarea");

                // Check if there is exactly one element in each
                // otherwise something is wrong with the webpage
                if(gradeInputElements.length !== 1 ||
                    responseBoxElements.length !== 1 ||
                    errorElements.length !== 1) {
                    // Display an error
                    Log.error("CS340View::submitGrade - Error: Page is malformed");
                    return null;
                }

                // Grab the elements
                let gradeInputElement = gradeInputElements[0] as HTMLInputElement;
                let responseBoxElement = responseBoxElements[0] as HTMLTextAreaElement;
                let errorElement = errorElements[0] as HTMLElement;

                // Get the type from the embedded HTML data
                let rubricType = gradeInputElement.getAttribute("data-type");

                // Retrieve the value inputted into the form field
                let gradeValue = parseFloat(gradeInputElement.value);
                let graded = true;

                // If the value is not found, set it to a default empty string
                if (rubricType === null) {
                    rubricType = "";
                    if(!errorStatus) errorComment = ERROR_NULL_RUBRIC;
                    errorStatus = true;
                    continue;
                }

                if (gradeInputElement.value === "") {
                    gradeValue = 0;
                    if(!warnStatus) warnComment = WARN_EMPTY_FIELD;
                    warnStatus = true;
                    graded = false;
                    errorElement.innerHTML = "Warning: Input field is empty";
                }

                // If the grade value retrieved is not a number, default the value to 0
                if (gradeInputElement.value !== "" && isNaN(gradeValue)) {
                    gradeValue = 0;
                    if(!errorStatus) errorComment = ERROR_NON_NUMERICAL_GRADE;
                    errorStatus = true;
                    errorElement.innerHTML = "Error: Must specify a valid number";
                    continue;
                } else {
                    // If the gradeValue is an actual number
                    // check if there are any warnings about the input value
                    if (this.checkIfWarning(gradeInputElement)) {
                        if(!errorStatus) errorComment = ERROR_POTENTIAL_INCORRECT_INPUT;
                        errorStatus = true;
                    }
                }

                // create a new subgrade, but if assignment was NOT _completed_, give 0
                let newSubGrade : SubQuestionGrade = {
                    sectionName: rubricType,
                    grade: completed? gradeValue: 0,
                    graded: completed? graded: true,
                    feedback: responseBoxElement.value
                };

                subQuestionArray.push(newSubGrade);
            }

            let questionNames = document.getElementsByClassName("questionName");

            let newQuestion : QuestionGrade = {
                questionName: questionNames[i].innerHTML,
                commentName: "",
                subQuestion: subQuestionArray
            };

            questionArray.push(newQuestion);
        }

        let aInfoSIDElements = document.getElementsByClassName("aInfoSID");
        let aInfoIDElements = document.getElementsByClassName("aInfoID");

        if (aInfoSIDElements.length !== 1 || aInfoIDElements.length !== 1) {
            if(!errorStatus) errorComment = ERROR_MALFORMED_PAGE;
            errorStatus = true;
        }

        if(errorStatus) {
            if(errorComment !== ERROR_POTENTIAL_INCORRECT_INPUT || !confirm("Warning: " +
                "Potential incorrect value entered into page! " +
                "Do you still wish to save?")) {
                Log.error("CS340View::submitGrade() - Unable to submit data; error: " + errorComment);
                return null;
            }
        }

        let sid = aInfoSIDElements[0].innerHTML;
        let aid = aInfoIDElements[0].innerHTML;

        // check some condition
        let teamIndicator: HTMLParagraphElement | null = (document.getElementById("teamIndicator") as HTMLParagraphElement);
        let targetStudentIds: string[] = [];
        if(teamIndicator !== null) {
            // this is kind of tricky, pull the team information out and get all the student IDs
            let teamOptions: any = AdminView.getOptions();
            let teamURL = this.remote + '/portal/cs340/getStudentTeamByDeliv/' + sid + "/" + aid;
            let teamResponse = await fetch(teamURL, teamOptions);
            if(teamResponse.status !== 200) {
                let errJson = await teamResponse.json();
                Log.error("CS340AdminView::submitGrade(..) - Error: " + errJson.error);
                UI.notification("Unable to save grade to team; unable to find correct team");
                return null;
            } else {
                let teamJson = await teamResponse.json();
                let team: TeamTransport = teamJson.response;
                for(const personId of team.people) {
                    targetStudentIds.push(personId);
                }
            }
        } else {
            targetStudentIds.push(sid);
        }

        // let quit = false;
        // if(warnStatus) {
        //     if(warnComment === WARN_EMPTY_FIELD && !confirm("Warning: Some fields are blank. Do you wish to continue" +
        //         " and submit the grade as is?")) {
        //         Log.warn("CS340View::submitGrade() - Missing fields; user cancelled save");
        //         quit = true;
        //         // return null;
        //     }
        // }

        // if(quit) return ({
        //     assignmentID: aid,
        //     studentID: targetStudentIds[0],
        //     released: false,
        //     questions: questionArray
        // } as AssignmentGrade);

        // UI.showModal("Submitting grade, please wait...");
        //
        // let newAssignmentGrade : AssignmentGrade;
        // for(const personId of targetStudentIds) {
        //     // create a new grade
        //     newAssignmentGrade = {
        //         assignmentID: aid,
        //         studentID: personId,
        //         released: false,
        //         questions: questionArray
        //     };
        //
        //     const url = this.remote + '/portal/cs340/setAssignmentGrade';
        //     Log.info("CS340View::submitGrade() - uri: " + url);
        //
        //     // Call the function
        //     let options: any = AdminView.getOptions();
        //
        //     options.method = 'put';
        //     options.headers.Accept = 'application/json';
        //     options.json = true;
        //     options.body = JSON.stringify(newAssignmentGrade);
        //
        //     Log.info("CS340View::submitGrade() - request body: " + options.body);
        //
        //     let response = await fetch(url, options);
        //
        //     Log.info("CS340View::submitGrade() - response from api " + response);
        //     if(response.status !== 200) {
        //         const errResponse = await response.json();
        //         Log.info("CS340AdminView::submitGrade() - error submitting grades, code: " +
        //             response.status + " error: " + response.statusText);
        //         // alert(errResponse.error);
        //         UI.showAlert(errResponse.error);
        //         UI.hideModal();
        //         return null;
        //     }
        // }
        //
        // UI.hideModal();

        let savingSuccess = await this.submitGradeRecord(aid, targetStudentIds, questionArray);
        if(savingSuccess) {
            UI.popPage();
            return null;
        } else {
            return null;
        }
    }

    public async submitGradeRecord(aid: string, personIds: string[], questionArray: QuestionGrade[]): Promise<boolean> {
        Log.info("CS340AdminView::submitGradeRecord(..) - start");
        let allPromises: Promise<any>[] = [];
        UI.showModal("Submitting grade(s), please wait...");

        for(const personId of personIds) {
            // create a new grade
            let newAssignmentGrade: AssignmentGrade = {
                assignmentID: aid,
                studentID: personId,
                released: false,
                questions: questionArray
            };

            const url = this.remote + '/portal/cs340/setAssignmentGrade';
            Log.info("CS340View::submitGrade() - uri: " + url);

            // Call the function
            let options: any = AdminView.getOptions();

            options.method = 'put';
            options.headers.Accept = 'application/json';
            options.json = true;
            options.body = JSON.stringify(newAssignmentGrade);

            Log.info("CS340View::submitGrade() - request body: " + options.body);

            allPromises.push(fetch(url, options));
        }

        let resultArray = await Promise.all(allPromises);

        for(const response of resultArray) {
            Log.info("CS340View::submitGrade() - response from api " + response);
            if(response.status !== 200) {
                const errResponse = await response.json();
                Log.info("CS340AdminView::submitGrade() - error submitting grades, code: " +
                    response.status + " error: " + response.statusText);
                // alert(errResponse.error);
                UI.showAlert(errResponse.error);
                UI.hideModal();
                return false;
            }
        }
        UI.hideModal();
        Log.info("CS340AdminView::submitGradeRecord(..) - end");

        return true;
    }

    public async getStudentGrade(sid: string, aid: string): Promise<AssignmentGrade | null> {
        Log.info("CS340View::getStudentGrade(" + sid + ", " + aid + ") - start");
        let options: any = AdminView.getOptions();
        options.method = 'get';
        let uri = this.remote + '/portal/cs340/getAssignmentGrade/' + sid + '/' + aid;
        let response = await fetch(uri, options);

        let reply;
        if(response.status !== 200) {
            Log.info("CS340View::getStudentGrade(..) - unable to find grade record");
            reply =  null;
        } else {
            Log.info("CS340View::getStudentGrade(..) - found grade record");
            let responseJson = await response.json();
            reply = responseJson.response;
        }
        Log.info("CS340View::getStudentGrade(..) - finish");
        return reply;
    }

    public async getGradingRubric(assignmentId: string): Promise<AssignmentGradingRubric | null> {
        Log.info("CS340View::getGradingRubric(" + assignmentId + ") - start");
        const url = this.remote + '/portal/cs340/getAssignmentRubric/' + assignmentId;
        Log.info("CS340View::getGradingRubric(...) - uri: " + url);

        UI.showModal("Getting grading rubric, please wait...");
        // Call the function
        let options: any = AdminView.getOptions();

        options.method = 'get';
        let response = await fetch(url, options);
        UI.hideModal();

        // If the response was valid:
        if (response.status === 200) {
            let jsonResponse = await response.json();
            // TODO [Jonathan]: Do something with the response
            return jsonResponse.response;
        } else {
            Log.trace('CS340View::getGradingRubric(...) - !200; Code: ' + response.status);
            return null;
        }
    }

    public async initializeRepositories(assignmentId: string): Promise<boolean> {
        Log.info("CS340View::initializeRepositories(" + assignmentId + ") - start");
        // Log.info("CS340View::initializeRepositories(..) - ");

        const url = this.remote + '/portal/cs340/initializeAllRepositories/' + assignmentId;
        Log.info("CS340View::initializeRepositories(..) - uri: " + url);

        let options: any = AdminView.getOptions();
        options.method = 'post';

        UI.showModal("Initializing repositories, this will take a while...");
        let response = await fetch(url, options);
        UI.hideModal();

        let jsonResponse = await response.json();
        if (response.status === 200) {
            Log.info("CS340View::initializeRepositories(..) - completed: " + jsonResponse.response);
            return jsonResponse.response;
        } else {
            Log.info("CS340View::initializeRepositories(..) - !200; Code: " + jsonResponse.error);
            UI.notification(jsonResponse.error);
        }
        return false;
    }

    // protected getOptions() {
    //     const options = {
    //         headers: {
    //             user:  localStorage.user,
    //             token: localStorage.token,
    //             org:   localStorage.org
    //         }
    //     };
    //     return options;
    // }

    private checkIfWarning(gradeInputElement: OnsInputElement) : boolean {
        // TODO: Complete this
        // data-outOf
        let gradeValue: number = parseFloat(gradeInputElement.value);
        let gradeOutOf: number = parseFloat(gradeInputElement.getAttribute("data-outOf"));
        let parentElement: HTMLElement = gradeInputElement.parentElement;
        let errorBox = parentElement.getElementsByClassName("errorBox");
        if(gradeValue < 0 || gradeValue > gradeOutOf) {
            errorBox[0].innerHTML = "Warning: Grade out of bounds";
            return true;
        } else {
            errorBox[0].innerHTML = "";
            return false;
        }
    }

    public testfunction() {
        console.log("A spooky message!");
        // UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/GradingView.html', {
        //     hello:"world"
        //     ,page: Factory.getInstance().getHTMLPrefix() + '/GradingView.html'
        // }).then(()=> {
        //     this.renderPage({page: Factory.getInstance().getHTMLPrefix() + '/GradingView.html'});
        //     console.log("all done!");
        // });
        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/GradingView.html', {
            test: "GradingView"
        });
    }

    public transitionGradingPage(sid:string, aid:string, isTeam:boolean=false) {
        // Move to grading
        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/GradingView.html', {
            sid:sid,
            aid:aid,
            isTeam:isTeam
        });
    }
}
