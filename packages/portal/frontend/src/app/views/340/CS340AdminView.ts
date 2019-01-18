import {OnsListItemElement} from "onsenui";
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
            const schedulerSwitch: OnsListItemElement = document.createElement("ons-list-item") as OnsListItemElement;
            schedulerSwitch.setAttribute("display", "flex");
            schedulerSwitch.classList.add("list-item");
            schedulerSwitch.classList.add("list-item--expandable");
            schedulerSwitch.setAttribute("expandable", "");

            const scheduleDiv: HTMLDivElement = document.createElement("div") as HTMLDivElement;
            scheduleDiv.classList.add("top");
            scheduleDiv.classList.add("list-item__top");

            const scheduleExplanationDiv: HTMLDivElement = document.createElement("div") as HTMLDivElement;
            scheduleExplanationDiv.classList.add("expandable-content");
            scheduleExplanationDiv.innerHTML = "This allows Classy to automatically provision and " +
                "release repositories without user interaction";

            const calendarBox = document.createElement("div");
            calendarBox.classList.add("left");
            calendarBox.classList.add("settingIcon");
            const calendarIcon = document.createElement("ons-icon");
            calendarIcon.setAttribute("icon", "ion-calendar");
            calendarBox.appendChild(calendarIcon);

            const descriptionBox = document.createElement("div");
            descriptionBox.classList.add("center");
            descriptionBox.classList.add("settingLabel");
            const descriptionValue = document.createElement("span");
            descriptionValue.setAttribute("title", "Toggles auto-creation");
            descriptionValue.innerHTML = "Automatically generate Repositories";
            descriptionBox.appendChild(descriptionValue);

            const switchBox = document.createElement("div");
            switchBox.classList.add("right");
            switchBox.classList.add("settingRight");
            const sliderSwitch = document.createElement("ons-switch");
            sliderSwitch.setAttribute("id", switchId);
            sliderSwitch.setAttribute("modifier", "list-item");
            sliderSwitch.setAttribute("onclick", "");
            switchBox.appendChild(sliderSwitch);

            scheduleDiv.appendChild(calendarBox);
            scheduleDiv.appendChild(descriptionBox);
            scheduleDiv.appendChild(switchBox);

            schedulerSwitch.appendChild(scheduleDiv);
            schedulerSwitch.appendChild(scheduleExplanationDiv);

            const openBlock = openSwitch.parentNode.parentNode.parentNode;
            const upperBlock = openBlock.parentNode;
            upperBlock.insertBefore(schedulerSwitch, openBlock);
            return true;
        }
        return false;
    }

    private verifyCustomParameters(): boolean {
        return false;
    }

    private saveDeliverable(): boolean {
        Log.error("Error: Unimplemented");

        return false;
    }
}
