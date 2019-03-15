import {OnsButtonElement, OnsFabElement, OnsInputElement, OnsListItemElement, OnsSelectElement, OnsSwitchElement} from "onsenui";
import Log from "../../../../../../common/Log";
import {AssignmentInfo, AssignmentStatus} from "../../../../../../common/types/CS340Types";
import {DeliverableTransport} from "../../../../../../common/types/PortalTypes";
import {Deliverable} from "../../../../../backend/src/Types";
import {Factory} from "../../Factory";
import {UI} from "../../util/UI";
import {AdminDeliverablesTab} from "../AdminDeliverablesTab";
import {AdminMarkingTab} from "../AdminMarkingTab";
import {AdminTabs, AdminView} from "../AdminView";
import {GradingPageView} from "../GradingPage";

declare var ons: any;

/**
 * ManualMarkingAdminView implements and handles custom handling for manual grading
 */
export class ManualMarkingAdminView extends AdminView {
    protected markingTab: AdminMarkingTab;
    protected loggingName: string;

    constructor(remoteUrl: string, tabs: AdminTabs, customLoggingName: string = "ManualMarkingAdminView") {
        super(remoteUrl, tabs);
        Log.info(`${this.loggingName}::<init>(..)`);

        this.loggingName = `Super${customLoggingName}`;
        this.markingTab = new AdminMarkingTab(remoteUrl);
    }

    public renderPage(name: string, opts: any) {
        Log.info(`${this.loggingName}::renderPage( ` + name + `, ... ) - start; options: ` + JSON.stringify(opts));
        super.renderPage(name, opts);

        if (name === `AdminRoot`) {
            Log.info(`${this.loggingName}::renderPage(..) - augmenting tabs`);
            // this.verifyAllScheduledTasks();
            Log.info(`${this.loggingName}::renderPage(..) - augmenting tabs done.`);
        }

        // if (name === `AdminEditDeliverable`) {
        // Log.warn(`${this.loggingName}::renderPage::AdminEditDeliverable - Injecting switches`);
        // this.insertRepositoryScheduleCreationSwitch(`adminEditDeliverablePage-autoGenerate`);
        // this.insertAssignmentBlock();
        // }

        if (name === `adminProvision`) {
            Log.info(`${this.loggingName}::renderPage::AdminProvision - Injecting buttons`);
            this.insertCloseAssignmentButton();
        }

        if (name === `AdminConfig`) {
            Log.info(`${this.loggingName}::renderPage::AdminConfig - Injecting switch`);

            this.generateFinalGradeSwitch().then(() => {
                Log.info(`${this.loggingName}::renderPage::AdminConfig - finished creating switch`);
            }).catch((err) => {
                Log.error(`${this.loggingName}::renderPage::AdminConfig - Error: ${JSON.stringify(err)}`);
            });
        }

        Log.warn(`${this.loggingName}::renderPage(..) with name: ` + name + ` - complete`);
    }

    public handleAdminEditDeliverable(opts: any): void {
        super.handleAdminEditDeliverable(opts);
        const that = this;
        Log.warn(`${this.loggingName}::handleAdminEditDeliverable(${JSON.stringify(opts)}) - Injecting switches`);
        // Log.warn(`${this.loggingName}::renderPage::AdminEditDeliverable - Injecting switches`);
        this.insertRepositoryScheduleCreationSwitch(`adminEditDeliverablePage-autoGenerate`);
        this.insertAssignmentBlock();
        this.populateAssignmentFields((opts as any).delivId).then().catch();

        const fab = document.querySelector(`#adminEditDeliverableSave`) as OnsFabElement;
        fab.addEventListener(`click`, async () => {
            Log.info(`${this.loggingName}::handleAdminEditDeliverable::onSave::click - Verify Schedule - start`);
            const idElement: OnsInputElement = document.getElementById(`adminEditDeliverablePage-name`) as OnsInputElement;
            const delivId: string = idElement.value;
            await new Promise( (resolve) => setTimeout(resolve, 2000) );

            Log.info(`${this.loggingName}::handleAdminEditDeliverable::onSave::click - ${delivId}`);
            await that.verifyScheduledTasks(delivId);
        });
    }

    // public handleadminProvision(opts: any): void {
    //     Log.info(`${this.loggingName}::handleAdminProvision(${JSON.stringify(opts)}) - Injecting`);
    //     const that = this;
    //     this.insertCloseAssignmentButton();
    //
    //     const provisionRepoButton: OnsButtonElement = document.getElementById(`adminManageProvisionButton`) as OnsButtonElement;
    //     provisionRepoButton.onclick = async (evt) => {
    //         Log.info(`${this.loggingName}::manageProvisionButton(..) - button pressed`);
    //         evt.stopPropagation(); // prevents list item expansion
    //         await that.handleProvisionPressed();
    //     };
    //
    //     return;
    // }

    public handleAdminMarking(opts: any): void {
        Log.info(`${this.loggingName}::handleAdminMarking(..) - start; options : ` + JSON.stringify(opts));
        this.markingTab.init(opts).then().catch();
        return null;
    }

    public handleGradingView(opts: any): void {
        Log.info(`${this.loggingName}::handleGradingView(..) - start; options: ${JSON.stringify(opts)}`);

        const gradingView: GradingPageView = new GradingPageView(this.remote);
        gradingView.init(opts).then().catch();

        return null;
    }

    protected insertCloseAssignmentButton() {
        Log.info(`${this.loggingName}::insertCloseAssignmentButton(..) - start`);
        const repositoryReleaseSelectElement: HTMLSelectElement =
            document.getElementById(`repositoryReleaseSelect`) as HTMLSelectElement;
        const listElement: HTMLDivElement = repositoryReleaseSelectElement
            .parentElement.parentElement.parentElement.parentElement as HTMLDivElement;
        const closeAssignmentButton: OnsButtonElement = document.createElement(`ons-button`) as OnsButtonElement;
        closeAssignmentButton.setAttribute(`id`, `adminProvision-closeAssignment`);
        closeAssignmentButton.setAttribute(`modifier`, `medium`);
        closeAssignmentButton.innerText = `Close Repositories`;
        closeAssignmentButton.onclick = async (event) => {
            UI.notificationToast(`Closing repositories...`, 300);
            await this.closeRepositories();
        };

        const closeAssignment = this.buildOnsListItem(`fa-plus-square`,
            `Close Repositories`,
            closeAssignmentButton, `This closes the repositories and prevents users from pushing to the repo`
        );

        listElement.appendChild(closeAssignment);

        return;
    }

    /**
     * Generates a input switch with switchId as the ID for toggle
     * @param {string} switchId
     * @returns {boolean}
     */
    protected insertRepositoryScheduleCreationSwitch(switchId: string): boolean {
        Log.info(`${this.loggingName}::insertRepositoryScheduleCreationSwitch(` + switchId + `) - start`);
        const openSwitch: HTMLElement = document.getElementById(`adminEditDeliverablePage-open`);
        if (openSwitch !== null) {
            const sliderSwitch: OnsSwitchElement = document.createElement(`ons-switch`) as OnsSwitchElement;
            sliderSwitch.setAttribute(`id`, switchId);
            sliderSwitch.setAttribute(`modifier`, `list-item`);
            sliderSwitch.onclick = (evt) => {
                this.generateCustomParameters(null);
            };

            const schedulerSwitch = this.buildOnsListItem(`ion-calendar`,
                `Automatically generate Repositories`,
                sliderSwitch, `This allows Classy to automatically provision and ` +
                `release repositories without user interaction`);

            const openBlock = openSwitch.parentNode.parentNode.parentNode;
            const upperBlock = openBlock.parentNode;
            upperBlock.insertBefore(schedulerSwitch, openBlock);
            return true;
        }
        return false;
    }

    protected insertAssignmentBlock(): boolean {
        const header: HTMLElement = document.getElementById(`adminEditDeliverablePage-header-deliverableDates`);

        const assignmentSwitch: OnsListItemElement = this.generateAssignmentSwitch();
        const assignmentConfigBlock = this.generateHiddenAssignmentConfig();

        header.parentNode.insertBefore(assignmentSwitch, header);
        header.parentNode.insertBefore(assignmentConfigBlock, header);
        return false;
    }

    protected generateAssignmentSwitch(): OnsListItemElement {
        const sliderSwitch = document.createElement(`ons-switch`);
        const that = this;

        sliderSwitch.setAttribute(`id`, `adminEditDeliverablePage-isAssignment`);
        sliderSwitch.setAttribute(`modifier`, `list-item`);

        sliderSwitch.onclick = function(evt) {
            that.updateAssignmentBlock();
            that.generateCustomParameters(null);
        };

        return this.buildOnsListItem(`fa-cogs`, `Deliverable is an Assignment`, sliderSwitch,
            `Indicates if this is a manually graded assignment`);
    }

    protected generateHiddenAssignmentConfig(): HTMLElement {
        const that = this;

        const assignmentConfig: HTMLElement = document.createElement(`ons-list`);
        assignmentConfig.style.display = `none`;
        assignmentConfig.setAttribute(`id`, `adminEditDeliverablePage-assignmentConfigBlock`);

        const assignmentHeader: HTMLElement = document.createElement(`ons-list-header`);
        assignmentHeader.innerHTML = `Assignment Config`;

        const seedRepoPathInput: OnsInputElement = document.createElement(`ons-input`) as OnsInputElement;
        seedRepoPathInput.setAttribute(`id`, `adminEditDeliverablePage-assignment-seedRepoPath`);
        seedRepoPathInput.classList.add(`settingTextInput`);
        const seedRepoPath: OnsListItemElement = this.buildOnsListItem(`fa-gears`,
            `Seed Repo Path (Optional)`,
            seedRepoPathInput,
            `The path that should be cloned for the repository.\n` +
            `The format of this string should be like: \`folder/to/files/*\`.\n` +
            `This is optional, if not specified, the repository will be fully cloned.`
        );

        const mainFilePathInput: OnsInputElement = document.createElement(`ons-input`) as OnsInputElement;
        mainFilePathInput.setAttribute(`id`, `adminEditDeliverablePage-assignment-mainFilePath`);
        mainFilePathInput.classList.add(`settingTextInput`);
        const mainFilePath: OnsListItemElement = this.buildOnsListItem(`fa-gears`,
            `Main File Path (Optional)`,
            mainFilePathInput,
            `Path to the main file that will be parsed to generate the rubric.\n` +
            `Supported file formats: \`.tex\`, \`.md\`, \`.ipynb\`, \`.Rmd\`.\n` +
            `This is optional, if not specified, the rubric will not be automatically generated`
        );

        const courseWeightInput: OnsInputElement = document.createElement(`ons-input`) as OnsInputElement;
        courseWeightInput.setAttribute(`id`, `adminEditDeliverablePage-assignment-courseWeight`);
        courseWeightInput.classList.add(`settingTextInput`);
        const courseWeight: OnsListItemElement = this.buildOnsListItem(`fa-gears`,
            `Course Weight`,
            courseWeightInput,
            `Determines the weight the assignment. Should be a number from 0-1.`
        );

        seedRepoPath.onchange = (evt) => {
            that.generateCustomParameters(null);
        };

        courseWeight.onchange = (evt) => {
            that.generateCustomParameters(null);
        };

        mainFilePath.onchange = (evt) => {
            that.generateCustomParameters(null);
        };

        assignmentConfig.appendChild(assignmentHeader);
        assignmentConfig.appendChild(courseWeight);
        assignmentConfig.appendChild(seedRepoPath);
        assignmentConfig.appendChild(mainFilePath);

        return assignmentConfig;
    }

    protected async populateAssignmentFields(delivId: string) {
        // const customObjectElement: OnsInputElement = document.getElementById(`adminEditDeliverablePage-custom`) as OnsInputElement;
        // const customObject: any = JSON.parse(customObjectElement.value);
        Log.info(`${this.loggingName}::populateAssignmentFields(${delivId}) - start`);

        const deliverableTransports: DeliverableTransport[] = await AdminDeliverablesTab.getDeliverables(this.remote);

        const selectedDeliverable = deliverableTransports.find((delivTransport) => {
            return delivTransport.id === delivId;
        });

        if (selectedDeliverable === undefined) {
            Log.error(`${this.loggingName}::populateAssignmentFields(..) - Error: Invalid deliverable ID specified; ` +
                `unable to find deliverable with ID: ${delivId}`);
            return;
        }

        const customDeliverableObject: any = selectedDeliverable.custom as any;

        if (customDeliverableObject.scheduled === true) {
            const scheduleSwitchElement: OnsSwitchElement =
                document.getElementById(`adminEditDeliverablePage-autoGenerate`) as OnsSwitchElement;
            scheduleSwitchElement.checked = true;
        }

        if (typeof customDeliverableObject.assignment !== `undefined`) {
            const seedRepoPath: string = customDeliverableObject.assignment.seedRepoPath;
            const mainFilePath: string = customDeliverableObject.assignment.mainFilePath;
            const courseWeight: number = customDeliverableObject.assignment.courseWeight;

            const assignmentRepoPathElement: OnsInputElement =
                document.getElementById(`adminEditDeliverablePage-assignment-seedRepoPath`) as OnsInputElement;
            const assignmentFilePathElement: OnsInputElement =
                document.getElementById(`adminEditDeliverablePage-assignment-mainFilePath`) as OnsInputElement;
            const assignmentCourseWeightElement: OnsInputElement =
                document.getElementById(`adminEditDeliverablePage-assignment-courseWeight`) as OnsInputElement;

            assignmentRepoPathElement.value = seedRepoPath;
            assignmentFilePathElement.value = mainFilePath;
            assignmentCourseWeightElement.value = courseWeight.toString();

            const isAssignment = document.getElementById(`adminEditDeliverablePage-isAssignment`) as OnsSwitchElement;
            isAssignment.checked = true;
            this.updateAssignmentBlock();
        }

    }

    protected updateAssignmentBlock() {
        Log.info(`${this.loggingName}::updateAssignmentBlock(..) - start`);
        const isAssignment = document.getElementById(`adminEditDeliverablePage-isAssignment`) as OnsSwitchElement;
        const isAssignmentValue = isAssignment.checked;
        Log.info(`${this.loggingName}::updateAssignmentBlock(..); isAssignment; value: ` + isAssignmentValue);

        const assignmentConfigBlock = document.getElementById(`adminEditDeliverablePage-assignmentConfigBlock`);
        if (isAssignmentValue === true) {
            assignmentConfigBlock.style.display = `inherit`;
        } else {
            assignmentConfigBlock.style.display = `none`;
        }
        return;
    }

    protected generateCustomParameters(delivRecord: Deliverable = null): boolean {
        // retrieve the values in the edit deliverable page
        const seedRepoPath: OnsInputElement = document.getElementById(
            `adminEditDeliverablePage-assignment-seedRepoPath`) as OnsInputElement;
        const mainFilePath: OnsInputElement = document.getElementById(
            `adminEditDeliverablePage-assignment-mainFilePath`) as OnsInputElement;
        const courseWeight: OnsInputElement = document.getElementById(`` +
            `adminEditDeliverablePage-assignment-courseWeight`) as OnsInputElement;
        const autoGenerate: OnsSwitchElement = document.getElementById(
            `adminEditDeliverablePage-autoGenerate`) as OnsSwitchElement;
        const isAssignment: OnsSwitchElement = document.getElementById(
            `adminEditDeliverablePage-isAssignment`) as OnsSwitchElement;

        let customParameters: any;
        let assignmentInfo: AssignmentInfo;
        // check if there should already be some custom information
        if (delivRecord === null || delivRecord.custom === null || delivRecord.custom.assignment === null) {
            assignmentInfo = {
                seedRepoPath: ``,
                mainFilePath: ``,
                courseWeight: 0,
                status: AssignmentStatus.INACTIVE,
            };
            customParameters = {
                scheduled: false,
            };

        } else {
            customParameters = delivRecord.custom;
        }

        customParameters.scheduled = autoGenerate.checked;

        if (isAssignment.checked === true) {
            assignmentInfo.seedRepoPath = seedRepoPath.value;
            assignmentInfo.mainFilePath = mainFilePath.value;
            let courseWeightValue: number;
            if (!Number.isNaN(Number(courseWeight.value))) {
                courseWeightValue = Number(courseWeight.value);
            } else {
                courseWeightValue = 0;
            }
            assignmentInfo.courseWeight = courseWeightValue;
            assignmentInfo.courseWeight = Number(courseWeight.value);
            customParameters.assignment = assignmentInfo;
        }

        // update the field

        const customField: OnsInputElement = document.getElementById(
            `adminEditDeliverablePage-custom`) as OnsInputElement;

        customField.value = JSON.stringify(customParameters);

        return true;
    }

    /**
     * Helper method that allows for quicker OnsListItem generation
     * @param {string} iconName - name for right hand icon
     * @param {string} name - title for the list item
     * @param {HTMLElement} insertedElement - right side element to be inserted
     * @param {string} description - expandable definition
     * @returns {ons.OnsListItemElement} Generated OnsListItem
     */
    protected buildOnsListItem(iconName: string,
                             name: string,
                             insertedElement: HTMLElement,
                             description: string): OnsListItemElement {
        const newListItem: OnsListItemElement = document.createElement(`ons-list-item`) as OnsListItemElement;
        newListItem.setAttribute(`display`, `flex`);
        newListItem.classList.add(`list-item`);
        newListItem.setAttribute(`expandable`, ``);

        const elementBox: HTMLDivElement = document.createElement(`div`) as HTMLDivElement;
        elementBox.classList.add(`top`);

        const explanationBox: HTMLDivElement = document.createElement(`div`) as HTMLDivElement;
        explanationBox.classList.add(`expandable-content`);
        explanationBox.innerHTML = description;

        const iconBox = document.createElement(`div`);
        iconBox.classList.add(`left`);
        iconBox.classList.add(`settingIcon`);
        const iconElement = document.createElement(`ons-icon`);
        iconElement.setAttribute(`icon`, iconName);
        iconBox.appendChild(iconElement);

        const descriptionBox = document.createElement(`div`);
        descriptionBox.classList.add(`center`);
        descriptionBox.classList.add(`settingLabel`);
        const descriptionElement = document.createElement(`span`);
        descriptionElement.setAttribute(`title`, name);
        descriptionElement.innerHTML = name;
        descriptionBox.appendChild(descriptionElement);

        const insertedElementBox = document.createElement(`div`);
        insertedElementBox.classList.add(`right`);
        insertedElementBox.classList.add(`settingRight`);
        insertedElementBox.appendChild(insertedElement);

        elementBox.appendChild(iconBox);
        elementBox.appendChild(descriptionBox);
        elementBox.appendChild(insertedElementBox);

        newListItem.appendChild(elementBox);
        newListItem.appendChild(explanationBox);

        return newListItem;
    }

    protected saveDeliverable(): boolean {
        Log.error(`Error: Unimplemented`);

        return false;
    }

    protected async closeRepositories(): Promise<void> {
        Log.info(`${this.loggingName}::closeRepositories() - start`);

        const deliverableSelectElement: HTMLSelectElement =
            document.getElementById(`provisionRepoDeliverableSelect`) as HTMLSelectElement;
        Log.info(`${this.loggingName}::closeRepositories() - ${deliverableSelectElement.value}`);

        // get class options
        const options: any = AdminView.getOptions();
        options.method = `post`;

        const url = this.remote + `/portal/cs340/closeAssignmentRepositories/` + deliverableSelectElement.value;
        const response = await fetch(url, options);
        const responseJson = await response.json();
        Log.info(`${this.loggingName}::closeRepositories() - response: ${responseJson}`);

        if (responseJson.response === true) {
            UI.notificationToast(`Closed all ${deliverableSelectElement.value} repositories`);
        } else {
            UI.notificationToast(`Unable to close ${deliverableSelectElement.value} repositories; error: ${responseJson.error}`);
        }

        return;
    }

    protected async verifyScheduledTasks(delivId: string): Promise<void> {
        Log.info(`${this.loggingName}::verifyScheduledTasks(${delivId}) - start`);

        // get class options
        const options: any = AdminView.getOptions();
        options.method = `post`;

        const url = this.remote + `/portal/cs340/verifyScheduledTasks/` + delivId;
        const response = await fetch(url, options);
        const responseJson = await response.json();
        Log.info(`${this.loggingName}::closeRepositories() - response: ${responseJson}`);

        return;
    }

    protected async verifyAllScheduledTasks(): Promise<void> {
        Log.info(`${this.loggingName}::verifyAllScheduledTasks() - start`);

        // get class options
        const options: any = AdminView.getOptions();
        options.method = `post`;

        const url = this.remote + `/portal/cs340/verifyAllScheduledTasks/`;
        const response = await fetch(url, options);
        const responseJson = await response.json();
        Log.info(`${this.loggingName}::closeRepositories() - response: ${responseJson}`);

        return;
    }

    public transitionGradingPage(sid: string, aid: string, isTeam: boolean = false) {
        // Move to grading
        UI.pushPage(Factory.getInstance().getHTMLPrefix() + `/GradingView.html`, {
            sid:    sid,
            aid:    aid,
            isTeam: isTeam
        }).then().catch((error) => {
            Log.error(`${this.loggingName}::transitionGradingPage(..) - error: ` + JSON.stringify(error));
        });
    }

    // protected async generateFinalGradeToggleSwitch(): Promise<void> {
    //     const onsSwitch: OnsSwitchElement = document.createElement(`ons-switch`) as OnsSwitchElement;
    //
    //     const ac: AssignmentController = new AssignmentController();
    //
    //     const isReleased = await ac.getFinalGradeStatus();
    //
    //     if (isReleased) {
    //         onsSwitch.setAttribute(`checked`, `true`);
    //     } else {
    //         onsSwitch.removeAttribute(`checked`);
    //     }
    //
    //     onsSwitch.onclick = async () => {
    //         const newStatus = await ac.toggleFinalGradeStatus();
    //         if (newStatus) {
    //             onsSwitch.setAttribute(`checked`, `true`);
    //         } else {
    //             onsSwitch.removeAttribute(`checked`);
    //         }
    //     };
    //
    //     const onsListItem = this.buildOnsListItem(`fa-retweet`,
    //         `Final Grades Released`,
    //         onsSwitch,
    //         `This releases final grades to the students.`
    //     );
    //
    //     // append to the end
    //     // get delete item button
    //     const manageDatabaseButton = document.getElementById(`adminDeletePageButton`);
    //
    //     // get parent items
    //     const listToAdd = manageDatabaseButton.parentNode.parentNode.parentNode;
    //
    //     listToAdd.appendChild(onsListItem);
    //     return;
    // }

    protected async generateFinalGradeSwitch(): Promise<void> {
        const onsSwitch: OnsSwitchElement = document.createElement(`ons-switch`) as OnsSwitchElement;
        onsSwitch.setAttribute(`id`, `generateFinalGradeSwitch`);

        if (document.getElementById(`generateFinalGradeSwitch`) !== null) {
            return;
        }

        const isReleased = await this.getFinalGradeReleaseStatus();

        if (isReleased) {
            onsSwitch.setAttribute(`checked`, `true`);
        } else {
            onsSwitch.removeAttribute(`checked`);
        }

        onsSwitch.onclick = async () => {
            const newStatus = await this.toggleFinalGradesReleased();
            if (newStatus) {
                onsSwitch.setAttribute(`checked`, `true`);
            } else {
                onsSwitch.removeAttribute(`checked`);
            }
        };

        const onsListItem = this.buildOnsListItem(`fa-retweet`,
            `Final Grades Released`,
            onsSwitch,
            `This releases final grades to the students.`
        );

        // append to the end
        // get delete item button
        const manageDatabaseButton = document.getElementById(`adminDeletePageButton`);

        // get parent items
        const listToAdd = manageDatabaseButton.parentNode.parentNode.parentNode;

        listToAdd.appendChild(onsListItem);
        return;
    }

    protected async getFinalGradeReleaseStatus(): Promise<boolean> {
        // get class options
        const options: any = AdminView.getOptions();

        const url = this.remote + `/portal/cs340/isFinalGradeReleased`;
        const response = await fetch(url, options);
        if (response.status === 200) {
            Log.info(`${this.loggingName}::getFinalGradeReleaseStatus(..) - 200 received`);
            const json = await response.json();
            return json.success;
        }
        Log.error(`${this.loggingName}::getFinalGradeReleaseStatus(..) - Error: Response code is: ${response.status}`);
        return false;
    }

    protected async toggleFinalGradesReleased(): Promise<boolean> {
        // get class options
        const options: any = AdminView.getOptions();
        options.method = `post`;

        const url = this.remote + `/portal/cs340/toggleFinalGradeRelease`;
        const response = await fetch(url, options);
        if (response.status === 200) {
            Log.info(`${this.loggingName}::toggleFinalGradesReleased(..) - 200 received`);
            const json = await response.json();
            return json.success;
        }
        Log.error(`${this.loggingName}::toggleFinalGradesReleased(..) - Error: Response code is: ${response.status}`);
        return false;
    }
}
