/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/Users/rtholmes/GoogleDrive/dev/classPortal/sdmm-portal/frontend/html/js";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 2);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */,
/* 1 */,
/* 2 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var UI_1 = __webpack_require__(3);
var Log_1 = __webpack_require__(4);
var Network_1 = __webpack_require__(5);
var App = (function () {
    function App() {
        this.AUTH_STATUS = 'authorized';
        this.UNAUTH_STATUS = 'unauthenticated';
        this.backendDEV = 'https://localhost:3000/';
        this.backendPROD = 'https://sdmm.cs.ubc.ca:5000/';
        this.frontendDEV = 'https://localhost:3000/';
        this.frontendPROD = 'https://portal.cs.ubc.ca/';
        this.backendURL = this.backendDEV;
        this.frontendURL = this.frontendDEV;
        Log_1.default.trace('App::<init> - start');
        if (window.location.href.indexOf('://localhost') > 0) {
            this.backendURL = this.backendDEV;
            this.frontendURL = this.frontendDEV;
        }
        else {
            this.backendURL = this.backendPROD;
            this.frontendURL = this.frontendPROD;
        }
        Log_1.default.trace('App::<init> - backend: ' + this.backendURL);
    }
    App.prototype.init = function () {
        Log_1.default.trace('App::init() - start');
        var that = this;
        document.addEventListener('init', function (event) {
            var page = event.target;
            var pageName = page.id;
            var courseId = null;
            if (typeof page.pushedOptions !== 'undefined' && typeof page.pushedOptions.courseId !== 'undefined') {
                courseId = page.pushedOptions.courseId;
                that.currentCourseId = page.pushedOptions.courseId;
            }
            console.log('App::init()::init - page: ' + pageName);
            if (pageName === 'adminTabsPage') {
            }
            if (pageName === 'studentTabsPage') {
            }
            if (pageName === 'main') {
                if (1 + 1 > 0) {
                    return;
                }
                var AUTHORIZED_STATUS_1 = 'authorized';
                Log_1.default.trace('App::main()::authCheck - starting main.html with auth check');
                that.toggleLoginButton();
                var URL_1 = that.backendURL + 'currentUser';
                var OPTIONS_HTTP_GET = { credentials: 'include' };
                fetch(URL_1, OPTIONS_HTTP_GET).then(function (data) {
                    if (data.status !== 200) {
                        Log_1.default.trace('App::main()::authCheck - WARNING: Response status: ' + data.status);
                        throw new Error('App::main()::authCheck - API ERROR: ' + data.status);
                    }
                    return data.json();
                }).then(function (data) {
                    var user = data.response.user;
                    localStorage.setItem('userrole', user.userrole);
                    localStorage.setItem('username', user.username);
                    localStorage.setItem('authStatus', AUTHORIZED_STATUS_1);
                    localStorage.setItem('fname', user.fname);
                    that.toggleLoginButton();
                }).catch(function (err) {
                    Log_1.default.error('App:main()::authCheck - ERROR: ' + err.message);
                });
            }
            if (pageName === 'loginPage') {
                var userrole = String(localStorage.userrole);
                if (userrole === 'student') {
                    UI_1.UI.pushPage('student.html', { courseId: courseId });
                }
                else if (userrole === 'admin' || userrole === 'superadmin') {
                    UI_1.UI.pushPage('admin.html', { courseId: courseId });
                }
                document.querySelector('#loginButton').onclick = function () {
                    Log_1.default.trace('App::init()::init - login pressed for: ' + courseId);
                    window.location.replace(that.backendURL + 'auth');
                };
            }
        });
        document.addEventListener('show', function (event) {
            var page = event.target;
            var pageName = page.id;
            var options = page.pushedOptions;
            if (typeof options === 'undefined') {
                options = {};
            }
            Log_1.default.trace('App::init()::show - page: ' + pageName);
        });
    };
    App.prototype.getAdminController = function (courseId) {
        Log_1.default.trace('App::getAdminController( ' + courseId + ' )');
    };
    App.prototype.pushPage = function (page, opts) {
        UI_1.UI.pushPage(page, opts);
    };
    App.prototype.validateCredentials = function () {
        return __awaiter(this, void 0, void 0, function () {
            var token, username, credentials;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        token = this.readCookie('token');
                        if (!(token === null)) return [3, 1];
                        Log_1.default.info("App::validateCredentials() - token not set");
                        localStorage.clear();
                        return [2, false];
                    case 1: return [4, this.getGithubCredentials(token)];
                    case 2:
                        username = _a.sent();
                        if (!(username !== null)) return [3, 4];
                        Log_1.default.info("App::validateCredentials() - valid username");
                        return [4, this.getServerCredentials(username, token)];
                    case 3:
                        credentials = _a.sent();
                        Log_1.default.info("App::validateCredentials() - validated with server; kind: " + credentials.kind);
                        localStorage.setItem('user', credentials.user);
                        localStorage.setItem('token', credentials.token);
                        localStorage.setItem('kind', credentials.kind);
                        return [2, true];
                    case 4:
                        Log_1.default.info("App::validateCredentials() - invalid username");
                        localStorage.clear();
                        document.cookie = "token=empty;expires=" + new Date(0).toUTCString();
                        location.href = location.href;
                        _a.label = 5;
                    case 5: return [2];
                }
            });
        });
    };
    App.prototype.getGithubCredentials = function (token) {
        Log_1.default.trace("App::getGithubCredentials - start");
        return fetch('https://api.github.com/user', {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Portal',
                'Authorization': 'token ' + token
            }
        }).then(function (resp) {
            Log_1.default.trace("App::getGithubCredentials - resp then: " + resp);
            return resp.json();
        }).then(function (data) {
            Log_1.default.trace("App::getGithubCredentials - data then: " + data);
            return data.login;
        }).catch(function (err) {
            Log_1.default.error("App::getGithubCredentials - ERROR: " + err);
            return null;
        });
    };
    ;
    App.prototype.getServerCredentials = function (username, token) {
        Log_1.default.trace("App::getServerCredentials - start");
        return fetch('https://localhost:3000/getCredentials', {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Portal',
                'user': username,
                'token': token
            }
        }).then(function (resp) {
            Log_1.default.trace("App::getServerCredentials - resp: " + resp);
            return resp.json();
        }).then(function (data) {
            return data;
        }).catch(function (err) {
            Log_1.default.error("App::getServerCredentials - ERROR: " + err);
            return null;
        });
    };
    ;
    App.prototype.handleMainPageClick = function (courseId) {
        Log_1.default.info("App::handleMainPageClick(..) - start");
        var AUTH_STATUS = 'authorized';
        var UNAUTH_STATUS = 'unauthorized';
        var userrole = typeof localStorage.userrole === 'undefined' ? null : localStorage.userrole;
        var authStatus = typeof localStorage.authStatus === 'undefined' ? 'unauthorized' : AUTH_STATUS;
        this.isLoggedIn();
        if (localStorage.authStatus !== AUTH_STATUS) {
            Log_1.default.info("App::handleMainPageClick(..) - not authorized");
            UI_1.UI.pushPage('login.html', courseId);
        }
        else if (localStorage.authStatus === AUTH_STATUS && userrole === 'superadmin') {
            Log_1.default.info("App::handleMainPageClick(..) - super admin");
            UI_1.UI.pushPage('superadmin.html', courseId);
        }
        else if (localStorage.authStatus === AUTH_STATUS && userrole === 'admin') {
            Log_1.default.info("App::handleMainPageClick(..) - admin");
            UI_1.UI.pushPage('admin.html', courseId);
        }
        else {
            Log_1.default.info("App::handleMainPageClick(..) - student");
            UI_1.UI.pushPage('student.html', courseId);
        }
    };
    App.prototype.isLoggedIn = function () {
        var token = this.readCookie('token');
        var res = String(localStorage.authStatus) === this.AUTH_STATUS;
        Log_1.default.trace("App::isLoggedIn(); value: " + res + "; token: " + token);
        return res;
    };
    App.prototype.readCookie = function (name) {
        var s = decodeURI(document.cookie).split(';');
        for (var i = 0; i < s.length; i++) {
            var row = s[i].split('=', 2);
            if (row.length === 2 && row[0] == name) {
                return row[1];
            }
        }
        return null;
    };
    App.prototype.logout = function () {
        Log_1.default.trace("App::logout() - start");
        var url = this.backendURL + '/logout';
        var OPTIONS_HTTP_GET = { credentials: 'include' };
        var that = this;
        fetch(url, OPTIONS_HTTP_GET).then(function (data) {
            if (data.status !== 200) {
                Log_1.default.trace('App::logout() - authCheck WARNING: Response status: ' + data.status);
                throw new Error('App::logout() - authCheck - API ERROR' + data.status);
            }
            return data.json();
        }).then(function (result) {
            var LOGOUT_SUCCESS = 'Successfully logged out.';
            Log_1.default.trace('App::logout() Logging out... ');
            var logoutResponse = String(result.response);
            if (logoutResponse === LOGOUT_SUCCESS) {
                localStorage.clear();
                console.log('App::logout() Successfully logged out');
                window.location.replace(that.frontendURL);
            }
        }).catch(function (err) {
            Log_1.default.error('App::logout() - ERROR: ' + err.message);
            Log_1.default.error('App::logout() - Clearing localstorage and refreshing');
            localStorage.clear();
            window.location.replace(that.frontendURL);
        });
    };
    App.prototype.toggleLoginButton = function () {
        try {
            if (this.isLoggedIn() === false) {
                document.getElementById('indexLogin').style.display = 'none';
            }
            else {
                document.getElementById('indexLogin').style.display = 'block';
            }
        }
        catch (err) {
        }
    };
    return App;
}());
exports.App = App;
Log_1.default.info('App.ts - preparing App for access');
if (typeof classportal === 'undefined') {
    Log_1.default.info('App.ts - preparing App; defining globals');
    window.classportal = {};
    window.classportal.App = App;
    window.classportal.UI = UI_1.UI;
    window.classportal.Network = Network_1.Network;
}
window.myApp = new classportal.App();
window.myApp.init();
Log_1.default.info('App.ts - App prepared');


/***/ }),
/* 3 */
/***/ (function(module, exports, __webpack_require__) {

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


/***/ }),
/* 4 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["TRACE"] = 0] = "TRACE";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["TEST"] = 4] = "TEST";
    LogLevel[LogLevel["NONE"] = 5] = "NONE";
})(LogLevel || (LogLevel = {}));
var LOG_LEVEL;
switch (("TRACE").toUpperCase()) {
    case "TRACE":
        LOG_LEVEL = LogLevel.TRACE;
        break;
    case "INFO":
        LOG_LEVEL = LogLevel.INFO;
        break;
    case "WARN":
        LOG_LEVEL = LogLevel.WARN;
        break;
    case "ERROR":
        LOG_LEVEL = LogLevel.ERROR;
        break;
    case "TEST":
        LOG_LEVEL = LogLevel.TEST;
        break;
    case "NONE":
        LOG_LEVEL = LogLevel.NONE;
        break;
    default:
        LOG_LEVEL = LogLevel.TRACE;
}
var Log = (function () {
    function Log() {
    }
    Log.trace = function (msg) {
        if (Log.Level <= LogLevel.TRACE) {
            console.log("<T> " + new Date().toLocaleString() + ": " + msg);
        }
    };
    Log.cmd = function (msg) {
        if (Log.Level <= LogLevel.INFO) {
            console.info("```\n" + msg + "\n```");
        }
    };
    Log.info = function (msg) {
        if (Log.Level <= LogLevel.INFO) {
            console.info("<I> " + new Date().toLocaleString() + ": " + msg);
        }
    };
    Log.warn = function (msg) {
        if (Log.Level <= LogLevel.WARN) {
            console.warn("<W> " + new Date().toLocaleString() + ": " + msg);
        }
    };
    Log.error = function (msg) {
        if (Log.Level <= LogLevel.ERROR) {
            console.error("<E> " + new Date().toLocaleString() + ": " + msg);
        }
    };
    Log.test = function (msg) {
        if (Log.Level <= LogLevel.TEST) {
            console.log("<X> " + new Date().toLocaleString() + ": " + msg);
        }
    };
    Log.Level = LOG_LEVEL;
    return Log;
}());
exports.default = Log;


/***/ }),
/* 5 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";

var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var Network = (function () {
    function Network() {
    }
    Network.detectUnauthenticated = function (url) {
        console.log('Network::delectUnauthenticated( ' + url + 'isAuthenticated ) - start');
        var USE_REAL = true;
        if (USE_REAL === true) {
            var OPTIONS_HTTP_GET = { credentials: 'include' };
            var AUTHORIZED_STATUS = 'authorized';
            var authStatus = String(localStorage.getItem('authStatus'));
            fetch(url + 'currentUser', OPTIONS_HTTP_GET).then(function (data) {
                if (data.status !== 200) {
                    throw new Error('Network::detectUnauthenticated( ' + url + ' ) - start');
                }
                else {
                    data.json().then(function (data) {
                        console.log('Network::detectUnauthenticated( \' + url + \' ) - then; data: ' + JSON.stringify(data));
                        console.log('the data', data);
                        if (data.response === false) {
                            localStorage.removeItem('authStatus');
                            location.reload();
                        }
                    });
                    console.log('Network::handleRemote() 200 return');
                }
            }).catch(function (err) {
                console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
                localStorage.removeItem('authStatus');
            });
            console.log('Network::delectUnauthenticated( ' + url + 'isAuthenticated ) - end');
        }
    };
    Network.remotePost = function (url, payload, onError) {
        console.log('Network::handleRemote( ' + url + ' ) - start');
        var OPTIONS_HTTP_POST = { credentials: 'include', method: 'post', cors: 'enabled',
            body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } };
        var AUTHORIZED_STATUS = 'authorized';
        return fetch(url, OPTIONS_HTTP_POST).then(function (data) {
            if (data.status !== 200 && data.status !== 405 && data.status !== 401) {
                console.log('Network::handleRemote() WARNING: Repsonse status: ' + data.status);
                throw new Error('Network::handleRemote() - API ERROR: ' + data.status);
            }
            else if (data.status !== 200 && data.status === 405 || data.status === 401) {
                console.error('Network::getRemotePost() Permission denied for your userrole.');
                alert('You are not authorized to access this endpoint. Please re-login.');
                location.reload();
            }
            else {
                console.log('Network::handleRemote() 200 return');
                return data.json().then(function (json) {
                    console.log('Network::updateRemotePost() 200 return: ' + json);
                    return json;
                });
            }
        }).catch(function (err) {
            console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
        });
    };
    Network.getRemotePost = function (url, payload, view, onError) {
        var USE_REAL = true;
        console.log('Network::handleRemote( ' + url + ' ) - start');
        if (USE_REAL === true) {
            var OPTIONS_HTTP_POST = { credentials: 'include', method: 'post', cors: 'enabled',
                body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } };
            var AUTHORIZED_STATUS = 'authorized';
            fetch(url, OPTIONS_HTTP_POST).then(function (data) {
                if (data.status !== 200 && data.status !== 405 && data.status !== 401) {
                    console.log('Network::handleRemote() WARNING: Repsonse status: ' + data.status);
                    throw new Error('Network::handleRemote() - API ERROR: ' + data.status);
                }
                else if (data.status !== 200 && data.status === 405 || data.status === 401) {
                    console.error('Network::getRemotePost() Permission denied for your userrole.');
                    alert('You are not authorized to access this endpoint. Please re-login.');
                    location.reload();
                }
                else {
                    console.log('Network::handleRemote() 200 return');
                    data.json().then(function (json) {
                        view.render(json);
                    });
                }
            }).catch(function (err) {
                console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
            });
        }
        else {
            Network.getData(url).then(function (data) {
                console.log('Network::handleRemote( \' + url + \' ) - then; data: ' + JSON.stringify(data));
                view.render(data);
            }).catch(function (err) {
                console.log('Network::handleRemote( \' + url + \' ) - catch; ERROR: ' + err);
                onError(err);
            });
        }
    };
    Network.httpPost = function (url, payload) {
        return __awaiter(this, void 0, void 0, function () {
            var OPTIONS_HTTP_POST;
            return __generator(this, function (_a) {
                console.log('Network::httpPost( ' + url + ' ) - start');
                OPTIONS_HTTP_POST = {
                    credentials: 'include',
                    method: 'post',
                    cors: 'enabled',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                };
                return [2, fetch(url, OPTIONS_HTTP_POST).then(function (data) {
                        return data;
                    })
                        .catch(function (err) {
                        console.log('Network::httpPost() ERROR ' + err);
                    })];
            });
        });
    };
    Network.httpPostFile = function (url, formData) {
        return __awaiter(this, void 0, void 0, function () {
            var OPTIONS_HTTP_POST_FILE;
            return __generator(this, function (_a) {
                console.log('Network::httpPostFile( ' + url + ' ) - start');
                OPTIONS_HTTP_POST_FILE = {
                    credentials: 'include',
                    method: 'post',
                    cors: 'enabled',
                    body: formData
                };
                return [2, fetch(url, OPTIONS_HTTP_POST_FILE).then(function (data) {
                        return data;
                    })
                        .catch(function (err) {
                        console.log('Network::httpPostFile() ERROR ' + err);
                    })];
            });
        });
    };
    Network.httpPut = function (url, payload) {
        return __awaiter(this, void 0, void 0, function () {
            var OPTIONS_HTTP_PUT;
            return __generator(this, function (_a) {
                console.log('Network::httpPut( ' + url + ' ) - start');
                OPTIONS_HTTP_PUT = {
                    credentials: 'include',
                    method: 'put',
                    cors: 'enabled',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                };
                return [2, fetch(url, OPTIONS_HTTP_PUT).then(function (data) {
                        return data;
                    })
                        .catch(function (err) {
                        console.log('Network::httpPut() ERROR ' + err);
                    })];
            });
        });
    };
    Network.httpGet = function (url) {
        return __awaiter(this, void 0, void 0, function () {
            var OPTIONS_HTTP_GET;
            return __generator(this, function (_a) {
                console.log('Network::httpGet( ' + url + ' ) - start');
                OPTIONS_HTTP_GET = { credentials: 'include' };
                return [2, fetch(url, OPTIONS_HTTP_GET).then(function (data) {
                        if (data.status === 200) {
                            return data.json().then(function (jsonData) {
                                return jsonData;
                            });
                        }
                        else {
                            throw 'Could not fetch data from ' + url;
                        }
                    })
                        .catch(function (err) {
                        console.log('Network::httpGet() ERROR ' + err);
                    })];
            });
        });
    };
    Network.handleRemote = function (url, view, onError) {
        var USE_REAL = true;
        console.log('Network::handleRemote( ' + url + ' ) - start');
        if (USE_REAL === true) {
            var OPTIONS_HTTP_GET = { credentials: 'include' };
            var AUTHORIZED_STATUS = 'authorized';
            fetch(url, OPTIONS_HTTP_GET).then(function (data) {
                if (data.status !== 200 && data.status !== 405 && data.status !== 401) {
                    console.log('Network::handleRemote() WARNING: Repsonse status: ' + data.status);
                    throw new Error('Network::handleRemote() - API ERROR: ' + data.status);
                }
                else if (data.status !== 200 && data.status === 405 || data.status === 401) {
                    console.error('Network::getRemotePost() Permission denied for your userrole.');
                    alert('You are not authorized to access this endpoint. Please re-login.');
                    location.reload();
                }
                else {
                    console.log('Network::handleRemote() 200 return');
                    data.json().then(function (json) {
                        view.render(json);
                    });
                }
            }).catch(function (err) {
                console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
            });
        }
        else {
            Network.getData(url).then(function (data) {
                console.log('Network::handleRemote( \' + url + \' ) - then; data: ' + JSON.stringify(data));
                view.render(data);
            }).catch(function (err) {
                console.log('Network::handleRemote( \' + url + \' ) - catch; ERROR: ' + err);
                onError(err);
            });
        }
    };
    Network.handleRemoteText = function (url, view, onError) {
        var USE_REAL = true;
        console.log('Network::handleRemoteText( ' + url + ' ) - start');
        var OPTIONS_HTTP_GET = { credentials: 'include' };
        var AUTHORIZED_STATUS = 'authorized';
        fetch(url, OPTIONS_HTTP_GET).then(function (data) {
            if (data.status !== 200) {
                console.log('Network::handleRemote() WARNING: Repsonse status: ' + data.status);
                throw new Error('Network::handleRemote() - API ERROR: ' + data.status);
            }
            else {
                console.log('Network::handleRemote() 200 return');
                data.text().then(function (text) {
                    view.render(text);
                });
            }
        }).catch(function (err) {
            console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
            onError('Error retrieving: ' + url + '; message: ' + err.message);
        });
    };
    Network.getData = function (url) {
        console.log('Network::getData( ' + url + ' ) - start');
        return new Promise(function (fulfill, reject) {
            if (url.indexOf('/student/210/rtholmes') > 0) {
                setTimeout(function () {
                    fulfill({
                        name: 'Reid Holmes',
                        course: 'CPSC 210',
                        lab: 'L210C',
                        cwl: 'rtholmes',
                        deliverables: [
                            { id: 'd1', due: 'Sept 10, 2010' },
                            { id: 'd2', due: 'Oct 10, 2010' },
                            { id: 'd3', due: 'Nov 10, 2010' },
                            { id: 'd4', due: 'Dec  10, 2010' },
                        ],
                        teams: [
                            { id: 'd1', msg: 'Individual deliverable.' },
                            { id: 'd2', msg: 'Individual deliverable.' },
                            { id: 'd3-d5', members: ['foo, bar, baz'] },
                            { id: 'd5', msg: 'Not yet available.' },
                        ],
                        grades: [
                            { id: 'd1', final: 92, test: 90, cover: 88 },
                            { id: 'd2', final: 80, test: 75, cover: 90 },
                            { id: 'd3', msg: 'N/A' },
                            { id: 'd4', msg: 'N/A' },
                            { id: 'd5', msg: 'N/A' }
                        ]
                    });
                }, 1000);
            }
            else if (url.indexOf('/student/310/rtholmes') > 0) {
                fulfill({
                    name: 'James Wilson',
                    course: 'CPSC 310',
                    lab: 'L310C',
                    cwl: 'jWilson',
                    deliverables: [
                        { id: 'd0', due: 'Sept 10, 2010' },
                        { id: 'd1', due: 'Sept 10, 2010' },
                        { id: 'd2', due: 'Oct 10, 2010' },
                        { id: 'd3', due: 'Nov 10, 2010' }
                    ],
                    teams: [
                        { id: 'd0', msg: 'Individual deliverable.' },
                        { id: 'd1-d3', members: ['foo', 'bar'] }
                    ],
                    grades: [
                        { id: 'd0', final: 55, test: 60, cover: 30 },
                        { id: 'd1', final: 92, test: 90, cover: 88 },
                        { id: 'd2', final: 80, test: 75, cover: 90 },
                        { id: 'd3', msg: 'N/A' }
                    ]
                });
            }
            else if (url.indexOf('/admin/310/teams') > 0) {
                fulfill({
                    course: "CPSC 310 Admin",
                    deliverables: [
                        {
                            id: "d1",
                            teams: [
                                { id: 'team1d1', members: ['foo', 'bar', 'baz'] },
                                { id: 'team2d1', members: ['qaz', 'nza', 'fisher'] },
                                { id: 'team3d1', members: ['foo', 'bar', 'baz'] },
                                { id: 'team4d1', members: ['foo', 'bar', 'baz'] },
                                { id: 'team5d1', members: ['foo', 'bar', 'baz'] },
                                { id: 'team6d1', members: ['foo', 'bar', 'baz'] },
                                { id: 'team7d1', members: ['foo', 'bar', 'baz'] }
                            ],
                            unassigned: ['unassign1', 'unassign2', 'unassign3']
                        },
                        {
                            id: "d2",
                            teams: [
                                { id: 'team1d2', members: ['foo', 'bar', 'baz'] },
                                { id: 'team2d2', members: ['qaz', 'nza', 'fisher'] },
                                { id: 'team3d2', members: ['foo', 'bar', 'baz'] },
                                { id: 'team4d2', members: ['foo', 'bar', 'baz'] },
                                { id: 'team5d2', members: ['foo', 'bar', 'baz'] },
                                { id: 'team6d2', members: ['foo', 'bar', 'baz'] },
                                { id: 'team7d2', members: ['foo', 'bar', 'baz'] }
                            ],
                            unassigned: ['unassign1']
                        }
                    ]
                });
            }
            else if (url.indexOf('/admin/310/deliverables') > 0) {
                fulfill({
                    course: "CPSC 310 Admin",
                    deliverables: [
                        {
                            id: "d1",
                            open: "Sept 10, 2010 @ 1200",
                            close: "Sept 17, 2010 @ 1900",
                            scheme: "Tests * .7, + Cover * .3"
                        },
                        {
                            id: "d2",
                            open: "Sept 20, 2010 @ 1200",
                            close: "Sept 27, 2010 @ 1900",
                            scheme: "Tests * .7, + Cover * .3"
                        },
                        {
                            id: "d3",
                            open: "Oct 10, 2010 @ 1200",
                            close: "Oct 17, 2010 @ 1900",
                            scheme: "Tests * .7, + Cover * .3"
                        },
                    ]
                });
            }
            else if (url.indexOf('/admin/310/dashboard') > 0) {
                fulfill({
                    course: "CPSC 310 Admin",
                    rows: [
                        {
                            id: "d1",
                            team: "team 1",
                            final: 99,
                            cover: 100,
                            test: 98,
                            passing: ['foo', 'bar', 'baz'],
                            failing: ['fail', 'fail2']
                        },
                        {
                            id: "d1",
                            team: "team 2",
                            final: 66,
                            cover: 90,
                            test: 40,
                            passing: ['foo'],
                            failing: ['fail', 'bar', 'baz']
                        },
                    ]
                });
            }
            else if (url.indexOf('/admin/310/grades') > 0) {
                fulfill({
                    course: "CPSC 310 Admin",
                    students: [
                        {
                            id: "student1",
                            deliverables: [
                                { id: 'd1', final: 65, test: 60, cover: 30 },
                                { id: 'd2', final: 85, test: 60, cover: 30 },
                                { id: 'd3', final: 25, test: 60, cover: 30 },
                                { id: 'd4' },
                                { id: 'd5' }
                            ],
                        },
                        {
                            id: "student2",
                            deliverables: [
                                { id: 'd1', final: 15, test: 60, cover: 30 },
                                { id: 'd2', final: 25, test: 60, cover: 30 },
                                { id: 'd3', final: 35, test: 60, cover: 30 },
                                { id: 'd4' },
                                { id: 'd5' }
                            ],
                        },
                        {
                            id: "student3",
                            deliverables: [
                                { id: 'd1', final: 95, test: 60, cover: 30 },
                                { id: 'd2', final: 95, test: 60, cover: 30 },
                                { id: 'd3', final: 85, test: 60, cover: 30 },
                                { id: 'd4' },
                                { id: 'd5' }
                            ],
                        }
                    ]
                });
            }
            else {
                reject(new Error('Unknown URL: ' + url));
            }
        });
    };
    return Network;
}());
exports.Network = Network;


/***/ })
/******/ ]);
//# sourceMappingURL=portal.js.map