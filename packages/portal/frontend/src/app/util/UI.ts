/**
 * Created by rtholmes on 2017-10-04.
 */
import Log from "../../../../../common/Log";
import {StudentTransport} from "../../../../../common/types/PortalTypes";

// const OPEN_DELIV_KEY = 'open';
// const CLOSE_DELIV_KEY = 'close';
// const MAX_TEAM_DELIV_KEY = 'maxTeamSize';
// const MIN_TEAM_DELIV_KEY = 'minTeamSize';
// const MONGO_DB_ID_KEY = '_id';

// import * as ons from 'onsenui'; // for dev
declare var ons: any; // for release (or webpack bundling gets huge)

export class UI {
    public static inputTypes = {TIMEDATE: 'timeDate', NUMBER: 'number', TEXT: 'text'};
    public static ons = ons;

    /**
     * Onsen convenience functions
     */
    public static pushPage(pageId: string, options?: any): Promise<void> {
        if (typeof options === 'undefined') {
            options = {};
        }
        Log.trace('UI::pushPage( ' + pageId + ', ' + JSON.stringify(options) + ' )');

        const nav = document.querySelector('#myNavigator') as any; // as ons.OnsNavigatorElement;
        if (nav !== null) {
            return nav.pushPage(pageId, options);
        } else {
            Log.error('UI::pushPage(..) - WARN: nav is null');
            return nav.pushPage(pageId, options);
        }
    }

    public static getCurrentPage(): any {
        const nav = document.querySelector('#myNavigator') as any;
        if (nav !== null) {
            //
            return nav.topPage;
            // This doesn't seem to work anymore, there is no getCurrentPage function on the nav object
            // return nav.getCurrentPage();
        }
    }

    public static popPage(options?: any) {
        const nav = document.querySelector('#myNavigator') as any; // as ons.OnsNavigatorElement;
        if (nav !== null) {
            nav.popPage(options);
        } else {
            Log.error('UI::popPage(..) - WARN: nav is null');
        }
    }

    public static notification(note: string) {
        ons.notification.alert(note);
    }

    public static notificationConfirm(note: string, callback: any) {
        ons.notification.confirm({message: note, callback});
    }

    // TODO: look at this in future: https://codepen.io/frankdiox/pen/rwaGVr
    public static notificationToast(note: string, time: number = 5000) {
        ons.notification.toast({message: note, timeout: time});
    }

    public static handleError(err: Error) {
        if (err instanceof Error) {
            ons.notification.alert(err.message);
        } else {
            ons.notification.alert(err);
        }
    }

    public static showErrorToast(text: string) {
        ons.notification.toast({message: text, buttonLabel: 'Ok', modifier: 'danger'});
    }

    public static showSuccessToast(text: string, opts?: any) {
        // TODO: change colour: https://onsen.io/v2/api/js/ons.notification.html#method-toast
        if (typeof opts === "undefined") {
            opts = {};
        }

        opts.message = text;

        if (typeof opts.timeout === "undefined") {
            opts.timeout = 2000;
        }

        if (typeof opts.force === "undefined") {
            opts.force = false;
        }

        if (typeof opts.buttonLabel === 'undefined') {
            // do nothing; no button by default
        }

        ons.notification.toast(opts);
    }

    public static createListItem(text: string, subtext?: string, tappable?: boolean): HTMLElement {

        let prefix = '<ons-list-item style="display: table;">';
        if (typeof tappable !== 'undefined' && tappable === true) {
            // right now only if subtext
            prefix = '<ons-list-item style="display: table;" modifier="chevron" tappable>';
        }

        if (typeof subtext === 'undefined') {
            // simple list item
            const taskItem = ons.createElement('<ons-list-item>' + text + '</ons-list-item>') as HTMLElement;
            return taskItem;
        } else {
            // compound list item
            const taskItem = ons.createElement(
                prefix +
                '<span class="list-item__title">' + text + '</span>' +
                '<span class="list-item__subtitle">' + subtext + '</span>' +
                '</ons-list-item>') as HTMLElement;
            return taskItem;
        }
    }

    public static createListHeader(text: string): HTMLElement {
        const taskHeader = ons.createElement(
            '<ons-list-header>' + text + '</ons-list-header>') as HTMLElement;
        return taskHeader;
    }

    public static showModal(text?: string) {
        // https://onsen.io/v2/api/js/ons-modal.html
        if (typeof text === 'undefined') {
            text = null;
        }

        const modals = document.querySelectorAll('ons-modal') as any;
        for (const m of modals) {
            Log.trace("UI::showModal( " + text + " ) - start; modal: " + m);
            if (m !== null) {
                if (text != null) {
                    const content = document.querySelectorAll('#modalText') as any;
                    const textFields = document.querySelectorAll('#modalText') as any;
                    for (const t of textFields) {
                        // document.getElementById('modalText').innerHTML = text;
                        t.innerHTML = text;
                    }
                }
                if (m.visible === false) {
                    // don't show a modal if it is already visible (causes flicker from the animation)
                    m.show({animation: 'fade'});
                }
            } else {
                Log.error('UI::showModal(..) - Modal is null');
            }
        }
    }

    public static showError(failure: any) { // FailurePayload
        Log.error("UI::showError(..) - failure: " + JSON.stringify(failure));
        if (typeof failure === 'string') {
            return UI.showAlert(failure);
        } else if (typeof failure.failure !== 'undefined') {
            return UI.showAlert(failure.failure.message);
        } else {
            Log.error("Unknown message: " + JSON.stringify(failure));
            return UI.showAlert("Action unsuccessful.");
        }
    }

    public static getTextFieldValue(fieldName: string): string {
        const field = document.querySelector('#' + fieldName) as HTMLTextAreaElement;
        if (field !== null) {
            return field.value;
        } else {
            Log.error('UI::getTextFieldValue( ' + fieldName + ' ) - element does not exist');
        }
    }

    public static getToggleValue(fieldName: string): boolean {
        const field = document.querySelector('#' + fieldName) as HTMLInputElement;
        if (field !== null) {
            return field.checked;
        } else {
            Log.error('UI::getToggleValue( ' + fieldName + ' ) - element does not exist');
        }
    }

    public static getDropdownValue(elementName: string): string {
        const field = document.querySelector('#' + elementName) as HTMLSelectElement;
        if (field !== null) {
            return field.options[field.selectedIndex].value;
        } else {
            Log.error('UI::getDropdownValue( ' + elementName + ' ) - element does not exist');
        }
    }

    public static setDropdownSelected(elementName: string, value: string | number, editable: boolean) {
        const field = document.querySelector('#' + elementName) as HTMLSelectElement;
        if (field !== null) {
            for (let i = 0; i < field.length; i++) {
                const opt = field.options[i];
                // tslint:disable-next-line
                if (opt.value == value) { // use == so string and number values match
                    field.selectedIndex = i;
                }
            }

            if (editable === false) {
                field.setAttribute('readonly', '');
            }
        } else {
            Log.error('UI::setDropdownSelected( ' + elementName + ', ... ) - element does not exist');
        }
    }

    public static setDropdownOptions(elementName: string, options: string[], selectedVal?: string | number | null) {
        const selector = document.querySelector('#' + elementName) as HTMLSelectElement;
        if (selector !== null) {
            selector.innerHTML = '';
            for (const opt of options) {
                let selected = false;
                if (typeof selectedVal !== 'undefined' && selectedVal === opt) {
                    selected = true;
                }
                const o: HTMLOptionElement = new Option(opt, opt, false, selected);
                selector.add(o);
            }
        } else {
            Log.error("UI::setDropdownOptions( " + elementName + ", ... ) - element does not exist");
        }
    }

    public static createTextInputField(key: string, value: string, type: string) {
        const inputField = ons.createElement(
            '<input type="text" style="margin: 0 0 0 15px" class="text-input text-input--underbar" value="">' +
            value +
            '</input>') as HTMLElement;

        return inputField;
    }

// <ons-page id="studentTeamsPage">
//     <ons-list id="student-team-list">
//         <section style="margin-top: 50px;" class="studentTeamPage-header">
//             <h2 style="text-align: center;">You are currently not on any teams</h2>
//         </section>

//         <section class="studentTeamPage-add-team-cta" style="padding: 30px;">
//             <div class="studentTeamPage-add-team-cta__container" style="width: 100%; margin: auto; text-align: center;">
//                 <ons-button class="studentTeamPage-add-team-cta__button" modifier="medium">Add a Team</ons-button>
//             </div>
//           </section>

//         <ons-list-header>Tappable / Ripple</ons-list-header>
//         <ons-list-item tappable>Tap me</ons-list-item>

//         <ons-list-header>Chevron</ons-list-header>
//         <ons-list-item modifier="chevron" tappable>Chevron</ons-list-item>

//         <ons-list-header>Thumbnails and titles</ons-list-header>
//         <ons-list-item>
//           <div class="left">
//             <img class="list-item__thumbnail" src="http://placekitten.com/g/40/40">
//           </div>
//           <div class="center">
//             <span class="list-item__title">Cutest kitty</span><span class="list-item__subtitle">On the Internet</span>
//           </div>
//     </ons-list>
// </ons-page>

    public static hideModal() {
        const modals = document.querySelectorAll('ons-modal') as any;
        for (const m of modals) {
            if (m !== null) {
                m.hide({animation: 'fade'});
            } else {
                Log.error('UI::hideModal(..) - Modal is null');
            }
        }
        // const modal = document.querySelector('ons-modal') as OnsModalElement;

    }

    public static showAlert(message: string) {
        return ons.notification.alert(message);
    }

    public static templateConfirm(template: string, options: {header?: string, listContent?: Array<{text: string, subtext?: string}>}) {
        return ons.createElement(template, {append: true}).then(function(classlistDialog: any) {
            const onsList = classlistDialog.querySelector('ons-list') as HTMLElement;
            (classlistDialog.querySelector('ons-list-header') as HTMLElement).innerHTML = options.header;
            classlistDialog.querySelector('ons-button').onclick = function() { classlistDialog.hide(); };
            if (options && options.listContent) {
                options.listContent.forEach(function(listItem) {
                    onsList.appendChild(UI.createListItem(listItem.text, listItem.subtext || ''));
                });
            }
            classlistDialog.show();
        })
        .catch(function(err: Error) {
            Log.error('UI::prompt(..) - ERROR: ' + err.message);
        });
    }

    public static async templateDisplayText(template: string, text: string = ''): Promise<HTMLDivElement> {
        return ons.createElement(template, {append: true}).then(function(textDialog: any) {
            const textContentDiv = textDialog.querySelector('#adminDockerBuildDialog-logs-text') as HTMLDivElement;
            textContentDiv.innerText = text;
            textDialog.show();

            const saveButton = textDialog.querySelector('#adminDockerBuildDialog-footer-save');
            const closeButton = textDialog.querySelector('#adminDockerBuildDialog-footer-close');
            closeButton.onclick = function() { textDialog.hide(); };
            saveButton.onclick = function() {
                const dateTimeLocal = new Date((new Date().getTime() - new Date().getTimezoneOffset() * 60000)).toISOString();
                saveButton['download'] = 'Build Log ' + dateTimeLocal + '.txt';
                saveButton.href = 'data:application/octet-stream,' + encodeURIComponent(textContentDiv.innerText);
             };
            saveButton['download'] = 'Classy Build Log';

            // Updates data when right-clicked to choose custom save filename
            saveButton.oncontextmenu = function() {
                saveButton.href = 'data:application/octet-stream,' + encodeURIComponent(textContentDiv.innerText);
            };

            return textContentDiv;
        });
    }

    public static confirm(message: string, options: {template: string, header?: string}) {
        return ons.notification.confirm(message);
    }

    // SDMM: move
    public static showD1TeamDialog() {
        const dialog: any = document.getElementById('d1teamDialog');

        if (dialog) {
            dialog.show();
        } else {
            ons.createElement('d1team.html', {append: true}).then(function(diag: any) {
                diag.show();
            });
        }
    }

    // SDMM: move
    public static hideD1TeamDialog() {
        const elem: any = document.getElementById('d1teamDialog');
        elem.hide();
    }

    public static took(start: number): string {
        return (Date.now() - start) + ' ms';
    }

    public static showSection(id: string) {
        const el =
            document.getElementById(id);
        if (el === null) {
            Log.error("UI::showSection( " + id + " ) - unknown id");
        } else {
            el.style.display = 'inherit'; // show the section
        }
    }

    public static hideSection(id: string) {
        const el =
            document.getElementById(id);
        if (el === null) {
            Log.error("UI::hideSection( " + id + " ) - unknown id");
        } else {
            el.style.display = 'none'; // show the section
        }
    }

    public static injectCustomPage(path: string) {
        Log.info('UI::injectCustomPage( ' + path + ' ) - start');

        // Create a new import node
        const importNode = document.createElement('link');
        importNode.href = path;
        importNode.rel = 'import';
        // Set the callback used when import is loaded. The line below is
        // adapted from importHref function in Polymer
        importNode.onload = function(importedNode: any, event: any) {
            // Put the document DOM tree in the import attribute as usual
            Log.info('UI::injectCustomPage( ' + path + ' ) - loading complete');
            (importNode as any).import = event.target.import;
        }.bind(this, importNode);

        // Triggers import loading
        document.head.appendChild(importNode);
    }

    /**
     * Clones a custom element from a template injected with injectCustomPage above
     * and prepares it to be added to the DOM wherever it is required.
     *
     * @param {string} id
     * @returns {Node | null}
     */
    public static cloneCustomElement(id: string): Node | null {
        Log.info("UI::cloneCustomElement( " + id + " ) - start");

        // iterates through all linked imports and returns the first element with the right id
        const customs = (document.querySelectorAll('link[rel="import"]'));
        for (const custom of Array.from(customs) as HTMLLinkElement[]) {
            if (custom !== null) {
                const templates = (custom as any).import.querySelectorAll('template');
                for (const template of Array.from(templates) as HTMLTemplateElement[]) {
                    if (template !== null && template.id === id) {
                        const clone = document.importNode(template.content, true);
                        return clone;
                    }
                }
            }
        }
        return null;
    }

    public static clearChildren(id: string) {
        const el = document.getElementById(id);
        if (el === null) {
            Log.error("UI::clearChildren( " + id + " ) - unknown id");
        } else {
            el.innerHTML = '';
        }
    }

    public static clearTextField(fieldName: string) {
        const field = document.querySelector('#' + fieldName) as HTMLTextAreaElement;
        if (field !== null) {
            field.value = '';
        } else {
            Log.error('UI::clearTextField( ' + fieldName + ' ) - element does not exist');
        }
    }
}
