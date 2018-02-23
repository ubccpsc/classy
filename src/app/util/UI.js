"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var OPEN_DELIV_KEY = 'open';
var CLOSE_DELIV_KEY = 'close';
var MAX_TEAM_DELIV_KEY = 'maxTeamSize';
var MIN_TEAM_DELIV_KEY = 'minTeamSize';
var MONGO_DB_ID_KEY = '_id';
var UI = (function () {
    function UI() {
    }
    UI.pushPage = function (pageId, options) {
        if (typeof options === 'undefined') {
            options = {};
        }
        console.log('pushPage - id: ' + pageId + '; options: ' + JSON.stringify(options));
        var nav = document.querySelector('#myNavigator');
        if (nav !== null) {
            return nav.pushPage(pageId, options);
        }
        else {
            console.log('UI::pushPage(..) - WARN: nav is null');
            return nav.pushPage(pageId, options);
        }
    };
    UI.getCurrentPage = function () {
        var nav = document.querySelector('#myNavigator');
        if (nav !== null) {
            return nav.getCurrentPage();
        }
    };
    UI.popPage = function () {
        var nav = document.querySelector('#myNavigator');
        if (nav !== null) {
            nav.popPage();
        }
        else {
            console.log('UI::popPage(..) - WARN: nav is null');
        }
    };
    UI.notification = function (note) {
        ons.notification.alert(note);
    };
    UI.notificationConfirm = function (note, callback) {
        ons.notification.confirm({ message: note, callback: callback });
    };
    UI.handleError = function (err) {
        if (err instanceof Error) {
            ons.notification.alert(err.message);
        }
        else {
            ons.notification.alert(err);
        }
    };
    UI.showErrorToast = function (text) {
        ons.notification.toast({ message: text, timeout: 2000 });
    };
    UI.createListItem = function (text, subtext, tappable) {
        var prefix = '<ons-list-item style="display: table;">';
        if (typeof tappable !== 'undefined' && tappable === true) {
            prefix = '<ons-list-item style="display: table;" modifier="chevron" tappable>';
        }
        if (typeof subtext === 'undefined') {
            var taskItem = ons.createElement('<ons-list-item>' +
                text +
                '</ons-list-item>');
            return taskItem;
        }
        else {
            var taskItem = ons.createElement(prefix +
                '<span class="list-item__title">' + text + '</span><span class="list-item__subtitle">' + subtext + '</span>' +
                '</ons-list-item>');
            return taskItem;
        }
    };
    UI.createListHeader = function (text) {
        var taskHeader = ons.createElement('<ons-list-header>' +
            text +
            '</ons-list-header>');
        return taskHeader;
    };
    UI.showModal = function (text) {
        if (typeof text === 'undefined') {
            text = null;
        }
        var modal = document.querySelector('ons-modal');
        if (modal !== null) {
            if (text != null) {
                document.getElementById('modalText').innerHTML = text;
            }
            modal.show({ animation: 'fade' });
        }
        else {
            console.log('UI::showModal(..) - Modal is null');
        }
    };
    UI.createTextInputField = function (key, value, type) {
        var inputField = ons.createElement('<input type="text" style="margin: 0 0 0 15px" class="text-input text-input--underbar" value="">' +
            value +
            '</input>');
        return inputField;
    };
    UI.hideModal = function () {
        var modal = document.querySelector('ons-modal');
        if (modal !== null) {
            modal.hide({ animation: 'fade' });
        }
        else {
            console.log('UI::hideModal(..) - Modal is null');
        }
    };
    UI.inputTypes = { TIMEDATE: 'timeDate', NUMBER: 'number', TEXT: 'text', };
    UI.ons = ons;
    return UI;
}());
exports.UI = UI;
//# sourceMappingURL=UI.js.map