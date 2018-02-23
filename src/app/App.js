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
var UI_1 = require("./util/UI");
var Log_1 = require("./util/Log");
var Network_1 = require("./util/Network");
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
//# sourceMappingURL=App.js.map