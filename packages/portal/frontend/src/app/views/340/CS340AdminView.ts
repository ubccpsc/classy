import {OnsInputElement, OnsListItemElement, OnsSwitchElement} from "onsenui";
import Log from "../../../../../../common/Log";
import {AdminTabs, AdminView} from "../AdminView";

declare var ons: any;

/**
 * 340 only uses the default Classy admin features, but this class is for experimenting with
 * extensibility so we can better understand how to do it for other courses.
 */
export class CS340AdminView extends AdminView {
    constructor(remoteUrl: string, tabs: AdminTabs) {
        Log.info("CS340AdminView::<init>(..)");
        super(remoteUrl, tabs);
    }

    public renderPage(name: string, opts: any) {
        Log.info('CS340AdminView::renderPage( ' + name + ', ... ) - start; options: ' + JSON.stringify(opts));
        super.renderPage(name, opts);

        if (name === 'AdminRoot') {
            Log.info('CS340AdminView::renderPage(..) - augmenting tabs');

            // this does not seem to work; it creates the tab on the menu, but it isn't clickable
            // const tab = document.createElement('ons-tab');
            // tab.setAttribute('page', 'dashboard.html');
            // tab.setAttribute('label', 'Foo');
            // tab.setAttribute('active', 'true');
            // tab.setAttribute('icon', 'ion-ios-gear');
            // tab.setAttribute('class', 'tabbar__item tabbar--top__item');
            // tab.setAttribute('modifier', 'top');
            // const tabbar = document.getElementById('adminTabbar');
            // tabbar.children[1].appendChild(tab);

            Log.info('CS340AdminView::renderPage(..) - augmenting tabs done.');
        }

        if (name === 'AdminEditDeliverable') {
            Log.warn("CS340AdminView::renderPage::AdminEditDeliverable - Injecting switches");
            this.insertRepositoryScheduleCreationSwitch("adminEditDeliverablePage-autoGenerate");
            this.insertAssignmentBlock();
        }

        Log.warn("CS340AdminView::renderPage(..) with name: " + name + " - complete");
    }

    /**
     * Generates a input switch with switchId as the ID for toggle
     * @param {string} switchId
     * @returns {boolean}
     */
    private insertRepositoryScheduleCreationSwitch(switchId: string): boolean {
        Log.info("CS340AdminView::insertRepositoryScheduleCreationSwitch(" + switchId + ") - start");
        const openSwitch: HTMLElement = document.getElementById("adminEditDeliverablePage-open");
        if (openSwitch !== null) {
            const sliderSwitch = document.createElement("ons-switch");
            sliderSwitch.setAttribute("id", switchId);
            sliderSwitch.setAttribute("modifier", "list-item");
            sliderSwitch.setAttribute("onclick", "");

            const schedulerSwitch = this.buildOnsListItem("ion-calendar",
                "Automatically generate Repositories",
                sliderSwitch, "This allows Classy to automatically provision and " +
                "release repositories without user interaction");

            const openBlock = openSwitch.parentNode.parentNode.parentNode;
            const upperBlock = openBlock.parentNode;
            upperBlock.insertBefore(schedulerSwitch, openBlock);
            return true;
        }
        return false;
    }

    private insertAssignmentBlock(): boolean {
        const header: HTMLElement = document.getElementById("adminEditDeliverablePage-header-deliverableDates");

        const assignmentSwitch: OnsListItemElement = this.generateAssignmentSwitch("adminEditDeliverablePage-isAssignment");
        const assignmentConfigBlock = this.generateHiddenAssignmentConfig();

        header.parentNode.insertBefore(assignmentSwitch, header);
        header.parentNode.insertBefore(assignmentConfigBlock, header);
        return false;
    }

    private generateAssignmentSwitch(switchId: string): OnsListItemElement {
        const sliderSwitch = document.createElement("ons-switch");
        const that = this;

        sliderSwitch.setAttribute("id", switchId);
        sliderSwitch.setAttribute("modifier", "list-item");

        sliderSwitch.onclick = function(evt) {
            that.updateAssignmentBlock();
        };

        return this.buildOnsListItem("fa-cogs", "Deliverable is an Assignment", sliderSwitch,
            "Indicates if this is a manually graded assignment");
    }

    private generateHiddenAssignmentConfig(): HTMLElement {
        const assignmentConfig: HTMLElement = document.createElement("ons-list");
        assignmentConfig.style.display = "none";
        assignmentConfig.setAttribute("id", "adminEditDeliverablePage-assignmentConfigBlock");

        const assignmentHeader: HTMLElement = document.createElement("ons-list-header");
        assignmentHeader.innerHTML = "Assignment Config";

        const seedRepoPathInput: OnsInputElement = document.createElement("ons-input") as OnsInputElement;
        seedRepoPathInput.setAttribute("id", "adminEditDeliverablePage-assignment-seedRepoPath");
        seedRepoPathInput.classList.add("settingTextInput");
        const seedRepoPath: OnsListItemElement = this.buildOnsListItem("fa-gears",
            "Seed Repo Path (Optional)",
            seedRepoPathInput,
            "The path that should be cloned for the repository.\n" +
            "The format of this string should be like: \"folder/to/files/*\".\n" +
            "This is optional, if not specified, the repository will be fully cloned."
            );

        const mainFilePathInput: OnsInputElement = document.createElement("ons-input") as OnsInputElement;
        mainFilePathInput.setAttribute("id", "adminEditDeliverablePage-assignment-mainFilePath");
        mainFilePathInput.classList.add("settingTextInput");
        const mainFilePath: OnsListItemElement = this.buildOnsListItem("fa-gears",
            "Main File Path (Optional)",
            mainFilePathInput,
            "Path to the main file that will be parsed to generate the rubric.\n" +
            "Supported file formats: \".tex\", \".md\", \".ipynb\", \".Rmd\".\n" +
            "This is optional, if not specified, the rubric will not be automatically generated"
        );

        const courseWeightInput: OnsInputElement = document.createElement("ons-input") as OnsInputElement;
        courseWeightInput.setAttribute("id", "adminEditDeliverablePage-assignment-courseWeight");
        courseWeightInput.classList.add("settingTextInput");
        const courseWeight: OnsListItemElement = this.buildOnsListItem("fa-gears",
            "Course Weight",
            courseWeightInput,
            "Determines the weight the assignment. Should be a number from 0-1."
        );

        assignmentConfig.appendChild(assignmentHeader);
        assignmentConfig.appendChild(seedRepoPath);
        assignmentConfig.appendChild(mainFilePath);
        assignmentConfig.appendChild(courseWeight);

        return assignmentConfig;
    }

    private updateAssignmentBlock() {
        Log.info("CS340AdminView::updateAssignmentBlock(..) - start");
        const isAssignment = document.getElementById("adminEditDeliverablePage-isAssignment") as OnsSwitchElement;
        const isAssignmentValue = isAssignment.checked;
        Log.info("CS340AdminView::updateAssignmentBlock(..); isAssignment; value: " + isAssignmentValue);

        const assignmentConfigBlock = document.getElementById("adminEditDeliverablePage-assignmentConfigBlock");
        if (isAssignmentValue === true) {
            assignmentConfigBlock.style.display = 'inherit';
        } else {
            assignmentConfigBlock.style.display = 'none';
        }
        return;
    }

    private verifyCustomParameters(): boolean {
        return false;
    }


    /**
     * Helper method that allows for quicker OnsListItem generation
     * @param {string} iconName - name for right hand icon
     * @param {string} name - title for the list item
     * @param {HTMLElement} insertedElement - right side element to be inserted
     * @param {string} description - expandable definition
     * @returns {ons.OnsListItemElement} Generated OnsListItem
     */
    private buildOnsListItem(iconName: string,
                             name: string,
                             insertedElement: HTMLElement,
                             description: string): OnsListItemElement {
        const newListItem: OnsListItemElement = document.createElement("ons-list-item") as OnsListItemElement;
        newListItem.setAttribute("display", "flex");
        newListItem.classList.add("list-item");
        newListItem.setAttribute("expandable", "");

        const elementBox: HTMLDivElement = document.createElement("div") as HTMLDivElement;
        elementBox.classList.add("top");

        const explanationBox: HTMLDivElement = document.createElement("div") as HTMLDivElement;
        explanationBox.classList.add("expandable-content");
        explanationBox.innerHTML = description;

        const iconBox = document.createElement("div");
        iconBox.classList.add("left");
        iconBox.classList.add("settingIcon");
        const iconElement = document.createElement("ons-icon");
        iconElement.setAttribute("icon", iconName);
        iconBox.appendChild(iconElement);

        const descriptionBox = document.createElement("div");
        descriptionBox.classList.add("center");
        descriptionBox.classList.add("settingLabel");
        const descriptionElement = document.createElement("span");
        descriptionElement.setAttribute("title", name);
        descriptionElement.innerHTML = name;
        descriptionBox.appendChild(descriptionElement);

        const insertedElementBox = document.createElement("div");
        insertedElementBox.classList.add("right");
        insertedElementBox.classList.add("settingRight");
        insertedElementBox.appendChild(insertedElement);

        elementBox.appendChild(iconBox);
        elementBox.appendChild(descriptionBox);
        elementBox.appendChild(insertedElementBox);

        newListItem.appendChild(elementBox);
        newListItem.appendChild(explanationBox);

        return newListItem;
    }

    private saveDeliverable(): boolean {
        Log.error("Error: Unimplemented");

        return false;
    }
}
