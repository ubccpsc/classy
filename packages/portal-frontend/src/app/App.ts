/**
 * Created by rtholmes on 2017-10-04.
 */

import {UI} from "./util/UI";
import Log from "../../../common/Log";
import {Network} from "./util/Network";

import {OnsButtonElement, OnsPageElement} from "onsenui";
import {Factory} from "./Factory";
import {IView} from "./views/IView";

declare var classportal: any;

export class App {

    public readonly backendURL: string = null;
    public readonly frontendURL: string = null;

    private view: IView = null;

    private validated = false;

    constructor() {
        Log.trace('App::<init> - start');

        // configure the frontend and backend URLs
        // uses the browser location and figures it out from there
        // means the backend must run on the same host as the frontend
        // but with port 5000
        // TODO: this will need to be tested better before putting it into production
        let location = window.location.href;
        location = location.substr(0, location.indexOf('/', 10)); // peel off anything after the host/port
        this.frontendURL = location;
        if (location.indexOf('3000') > 0) {
            this.backendURL = location.replace('3000', '5000');
        } else {
            this.backendURL = location + ':5000/';
        }

        Log.trace('App::<init> - frontend: ' + this.frontendURL);
        Log.trace('App::<init> - backend: ' + this.backendURL);
    }

    public async init(): Promise<{}> {
        Log.trace('App::init() - start');
        const that = this;

        // before anything else happens, get the org associated with the backend
        await this.retrieveOrg();

        let validated = await that.validateCredentials();
        this.validated = validated;
        Log.trace('App::init() - validated: ' + validated);

        if (validated === true) {
            Log.trace('App::init() - validated: true; simulating mainPageClick');
            that.handleMainPageClick();
        }

        return new Promise(function (fulfill, reject) {

            document.addEventListener('init', function (event) {
                const page = event.target as OnsPageElement;

                // update login button state
                that.toggleLoginButton();

                const pageName = page.id;

                let org: string = null;

                org = Factory.getInstance().getOrg();
                localStorage.org = org; // TODO: remove; just use the factory to track this
                Log.trace('App::init()::init - org: ' + org + '; pushed option');

                Log.trace('App::init()::init - page: ' + pageName);

                if (pageName === 'index') {
                    Log.trace('App::init()::init - index detected; pushing real target');
                    UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/landing.html');
                    return;
                }

                if (pageName === 'adminTabsPage') {
                    // initializing tabs page for the first time
                    // that.adminController = new AdminController(that, courseId);
                    Log.warn('App::init()::init - page: ' + pageName + ' NOT IMPLEMENTED');
                }

                if (pageName === 'studentTabsPage') {
                    // initializing tabs page for the first time
                    // that.studentController = new StudentController(that, courseId);

                    Log.info("App::init() - studentTabsPage init; attaching view");
                    (<any>window).classportal.view = Factory.getInstance().getView(that.backendURL);

                    const view = Factory.getInstance().getView(that.backendURL);
                    that.view = view;

                    Log.trace("App::init() - studentTabsPage init; view attached");
                }

                /*
                // DO NOT DO THIS HERE; DO IT ON SHOW BELOW!
                // Each page calls its own initialization controller.
                if (that.studentController !== null) {
                    if (typeof that.studentController[pageName] === 'function') {
                        that.studentController[pageName]();//(page);
                    }
                }
                // Each page calls its own initialization controller.
                if (that.adminController !== null) {
                    if (typeof that.adminController[pageName] === 'function') {
                        that.adminController[pageName]();//(page);
                    }
                }
                */
                /*
                                if (pageName === 'main') {
                                    Log.trace('App::init()::authCheck - starting main.html with auth check');
                                    const AUTHORIZED_STATUS: string = 'authorized';

                                    that.toggleLoginButton();

                                    const URL = that.backendURL + '/currentStatus';  // '/currentUser'; // NOTE: this doesn't seem right
                                    let OPTIONS_HTTP_GET: RequestInit = {credentials: 'include', mode: 'no-cors'}; // NOTE: not sure about the mode param
                                    fetch(URL, OPTIONS_HTTP_GET).then((data: any) => {
                                        if (data.status !== 200) {
                                            Log.trace('App::init()::authCheck - WARNING: Response status: ' + data.status);
                                            throw new Error('App::init()::authCheck - API ERROR: ' + data.status);
                                        }
                                        return data.json();
                                    }).then((data: any) => {
                                        let user = data.response.user;
                                        localStorage.setItem('userrole', user.userrole);
                                        localStorage.setItem('username', user.username);
                                        localStorage.setItem('authStatus', AUTHORIZED_STATUS);
                                        localStorage.setItem('fname', user.fname);
                                        that.toggleLoginButton();
                                    }).catch((err: any) => {
                                        Log.error('App::init()::authCheck - ERROR: ' + err.message);
                                    });
                                }
                */
                if (pageName === 'loginPage') {

                    const userrole = String(localStorage.userrole);
                    // const username = String(localStorage.username);
                    if (userrole === 'student') {
                        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/student.html', {org: org});
                    } else if (userrole === 'admin' || userrole === 'superadmin') {
                        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/admin.html', {org: org});
                    }

                    (document.querySelector('#loginButton') as OnsButtonElement).onclick = function () {
                        localStorage.setItem('org', org);
                        const url = that.backendURL + '/auth/?org=' + org;
                        Log.trace('App::init()::init - login pressed for: ' + org + '; url: ' + url);
                        window.location.replace(url);
                    };
                }
            });

            /**
             * Runs once a page is ready to be rendered.
             *
             * Useful for student view since we populate all tabs at once.
             */
            document.addEventListener('show', function (event) {
                const page = event.target as OnsPageElement;
                const pageName = page.id;
                let options = (<any>page).pushedOptions;
                if (typeof options === 'undefined') {
                    options = {};
                }
                Log.trace('App::init()::show - page: ' + pageName);

                // update login button state
                that.toggleLoginButton();

                // let validated = await
                // that.validateCredentials();
                // let validated = true;
                Log.trace('App::init()::show - page: ' + pageName + "; validated: " + validated);

                if (pageName === "studentTabsPage" && validated === true) {
                    Log.trace('studentTabsPage - show!!!');
                    that.view.renderPage(options);
                }
                /*
                if (that.studentController !== null) {
                    if (typeof that.studentController[pageName] === 'function') {
                        that.studentController[pageName](options);
                    }
                }
                if (that.adminController !== null) {
                    if (typeof that.adminController[pageName] === 'function') {
                        that.adminController[pageName](options);
                    }
                }
                */
            });

            // TODO: Feels like this needs some kind of guard?
            // Loads the landing page, but I wouldn't want this to happen more than the first login
            Log.trace('App::init()::init - loading initial index');
            UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/landing.html');

            fulfill({}); // resolve the promise so it's not just hanging there
        });
    }

    public getAdminController(org: string) {
        Log.trace('App::getAdminController( ' + org + ' )');
        // return new AdminController(this, courseId);
    }

    public pushPage(page: string, opts?: any) {
        UI.pushPage(page, opts);
    }

    /**
     * Validate that the current user has valid credentials.
     *
     * If they have a token, check with GitHub to make sure it's still valid.
     *
     * If anything goes wrong, just clear the credentials and force the user
     * to login again.
     *
     * @returns {Promise<boolean>}
     */
    private async validateCredentials(): Promise<boolean> {
        Log.info("App::validateCredentials() - start");
        let token = this.readCookie('token');
        if (token === null) {
            Log.info("App::validateCredentials() - not set on cookie");
            token = localStorage.getItem('token');
        } else if (token === null) {
            Log.info("App::validateCredentials() - token not set on cookie or localstorage; clearing for safety");
            this.clearCredentials();
        } else {
            Log.info("App::validateCredentials() - token available");
            const username = await this.getGithubCredentials(token);
            if (username !== null) {
                // valid username; get role from server
                Log.info("App::validateCredentials() - valid username: " + username);

                const credentials: any = await this.getServerCredentials(username, token);
                if (credentials === null) {
                    Log.info("App::validateCredentials() - server validation failed");
                    this.clearCredentials();
                } else {
                    Log.info("App::validateCredentials() - validated with server; isAdmin: " + credentials.isAdmin);
                    localStorage.setItem('user', credentials.user);
                    localStorage.setItem('token', credentials.token);
                    localStorage.setItem('isAdmin', credentials.isAdmin);
                    return true;
                }
            } else {
                Log.info("App::validateCredentials() - invalid username; clearing for safety");
                this.clearCredentials();
            }
        }
        Log.info("App::validateCredentials() - returning false");
        return false;
    }

    private clearCredentials() {
        Log.info("App::clearCredentials() - start");

        // TODO: erase credentials on server too

        // invalid username; logout
        this.validated = false;
        localStorage.clear(); // erase cached info
        document.cookie = "token=empty;expires=" + new Date(0).toUTCString(); // clear the cookies
        location.href = location.href; // force refresh the page
    }

    /**
     * Given a GitHub token, get the GitHub username.
     *
     * Returns null if the token is not valid.
     *
     * @param {string} token
     * @returns {Promise<string | null>}
     */
    private getGithubCredentials(token: string): Promise<string | null> {
        Log.trace("App::getGithubCredentials(..) - start");
        return fetch('https://api.github.com/user', {
            headers: {
                'Content-Type':  'application/json',
                'Authorization': 'token ' + token
            }
        }).then(function (resp: any) {
            Log.trace("App::getGithubCredentials(..) - resp then: " + resp);
            return resp.json();
        }).then(function (data: any) {
            Log.trace("App::getGithubCredentials(..) - data then: " + data);
            if (typeof data.login !== 'undefined') {
                return data.login;
            }
            return null;
        }).catch(function (err: any) {
            Log.error("App::getGithubCredentials(..) - ERROR: " + err);
            return null;
        });
    };

    /**
     * Gets the user credentials from the server.
     *
     * If anything goes wrong, returns null.
     *
     * @param {string} username
     * @param {string} token
     * @returns {Promise<{}>}
     */
    private getServerCredentials(username: string, token: string): Promise<{}> { // TODO: return should have a type | null
        const url = this.backendURL + '/getCredentials';
        Log.trace("App::getServerCredentials - start; url: " + url);
        const that = this;

        const org = localStorage.org;

        const options = {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent':   'Portal',
                'user':         username,
                'token':        token,
                'org':          org
            }
        };
        return fetch(url, options).then(function (resp: any) {
            Log.trace("App::getServerCredentials - resp: " + resp);
            if (resp.status === 204) {
                Log.trace("App::getServerCredentials - fetching");
                return fetch(url, options);
            } else {
                Log.trace("App::getServerCredentials - passing through");
                Log.trace("App::getServerCredentials - code returned: " + resp.status);

                if (resp.status === 400) {
                    that.clearCredentials();
                }
                return resp;
            }
        }).then(function (data: any) {
            Log.trace("App::getServerCredentials - data raw: " + data);
            return data.json();
        }).then(function (data: any) {
            Log.trace("App::getServerCredentials - data json: " + JSON.stringify(data));
            return data;
        }).catch(function (err: any) {
            Log.error("App::getServerCredentials - ERROR: " + err);
            return null;
        });
    };

    private async retrieveOrg() {
        const url = this.backendURL + '/org';
        Log.trace("App::retrieveOrg() - start; url: " + url);

        const options = {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent':   'Portal',
            }
        };

        let response = await fetch(url, options);
        if (response.status === 200) {
            Log.trace('App::retrieveOrg() - 200 received');
            const json = await response.json();
            Log.trace('App::retrieveOrg() - payload: ' + JSON.stringify(json) + '; setting org: ' + json.org);
            Factory.getInstance(json.org);
            Log.trace("App::retrieveOrg() - done");
        } else {
            Log.error('App::retrieveOrg() - ERROR');
        }
    }

    public handleMainPageClick(params?: {}) {
        Log.info("App::handleMainPageClick(..) - start");

        if (typeof params === 'undefined') {
            params = {};
        }

        if (this.validated === true) {
            // push to correct handler
            if (localStorage.kind === 'admin') {
                Log.info("App::handleMainPageClick(..) - admin");
                UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/admin.html', params);
            } else {
                Log.info("App::handleMainPageClick(..) - student");
                UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/student.html', params);
            }
        } else {
            // push to login page
            Log.info("App::handleMainPageClick(..) - not authorized");
            UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/login.html', params);
        }
    }

    /*
    * @Return Boolean - True if user is authenticated
    */
    public isLoggedIn() {
        return this.validated === true;
    }

    private readCookie(name: string) {
        Log.trace("App::readCookie( " + name + " ) - start; cookie string: " + document.cookie);
        let s: string[] = decodeURI(document.cookie).split(';');
        for (let i = 0; i < s.length; i++) {
            let row = s[i].split('=', 2);
            if (row.length === 2) {
                let key = row[0].trim(); // firefox sometimes has an extraneous space before the key
                if (key === name) {
                    return row[1].trim();
                }
            }
        }
        return null;
    }

    public logout() {
        Log.trace("App::logout() - start");

        this.clearCredentials();
        UI.pushPage("index.html");
    }

    private toggleLoginButton() {
        try {
            if (this.isLoggedIn() === true) {
                Log.trace("App::toggleLoginButton() - showing logout");
                const el = document.getElementById('indexLogin');
                if (el !== null) {
                    el.style.display = 'block';
                } else {
                    Log.trace("App::toggleLoginButton() - button not visible");
                }
            } else {
                Log.trace("App::toggleLoginButton() - hiding logout");
                const el = document.getElementById('indexLogin');
                if (el !== null) {
                    el.style.display = 'none';
                } else {
                    Log.trace("App::toggleLoginButton() - button not visible");
                }
            }
        } catch (err) {
            // silently fail
            Log.error("APP:toggleLoginButton() - ERROR: " + err);
        }
    }
}

Log.info('App.ts - preparing App for access');
if (typeof classportal === 'undefined') {
    Log.info('App.ts - preparing App; defining globals');
    (<any>window).classportal = {};
    (<any>window).classportal.App = App;
    (<any>window).classportal.UI = UI;
    (<any>window).classportal.Network = Network;
}

(<any>window).myApp = new classportal.App();
(<any>window).myApp.init().then(function (ret: any) {
    Log.info("App.ts - init then: " + JSON.stringify(ret));
}).catch(function (err: any) {
    Log.error("App.ts - init ERROR: " + err);
});
Log.info('App.ts - App prepared');


