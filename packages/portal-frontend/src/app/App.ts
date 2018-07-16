/**
 * Created by rtholmes on 2017-10-04.
 */

import {UI} from "./util/UI";
import Log from "../../../common/Log";
import {Network} from "./util/Network";

import {OnsButtonElement, OnsPageElement} from "onsenui";
import {Factory} from "./Factory";
import {IView} from "./views/IView";
import {AuthTransportPayload, ConfigTransport, ConfigTransportPayload} from "../../../common/types/PortalTypes";

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
        await this.retrieveConfig();


        let validated = await that.validateCredentials();
        this.validated = validated;
        // Log.trace('App::init() - validated: ' + validated);

        if (validated === true) {
            Log.trace('App::init() - validated: true; simulating mainPageClick');
            that.handleMainPageClick();
        } else {
            Log.trace('App::init() - validated: false');
        }

        return new Promise(function (fulfill, reject) {

            document.addEventListener('init', function (event) {
                const page = event.target as OnsPageElement;

                // update login button state
                that.toggleLoginButton();

                const pageName = page.id;
                let name: string = null;

                name = Factory.getInstance().getName();
                Log.trace('App::init()::init - name : ' + name + '; page: ' + pageName + '; opts: ' + JSON.stringify(event));

                // Log.trace('App::init()::init - page: ' + pageName);
                if (pageName === 'index') {
                    Log.trace('App::init()::init - index detected; pushing real target');
                    UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/landing.html');
                    return;
                }

                if (that.view === null) {
                    let v: IView = null;
                    if (pageName === 'AdminRoot') {
                        // initializing tabs page for the first time
                        Log.info("App::init() - AdminRoot init; attaching view");
                        v = Factory.getInstance().getAdminView(that.backendURL);
                        Log.trace("App::init() - AdminRoot init; view attached");
                    } else if (pageName === 'StudentRoot') {
                        // initializing tabs page for the first time
                        Log.info("App::init() - StudentRoot init; attaching view");
                        v = Factory.getInstance().getView(that.backendURL);
                        Log.trace("App::init() - StudentRoot init; view attached");
                    } else {
                        Log.trace("App::init() - unknown page name: " + pageName);
                    }

                    (<any>window).classportal.view = v;
                    that.view = v;
                }

                if (pageName === 'loginPage') {
                    Log.trace("App::init() - loginPage init; attaching login button");
                    /*
                    Log.warn("App::init() - loginPage init; NEEDED??");
                    const userrole = String(localStorage.userrole);
                    if (userrole === 'student') {
                        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/student.html', {org: org});
                    } else if (userrole === 'admin') {
                        UI.pushPage(Factory.getInstance().getHTMLPrefix() + '/admin.html', {org: org, isAdmin: true});
                    }
                    */

                    (document.querySelector('#loginButton') as OnsButtonElement).onclick = function () {
                        // localStorage.setItem('org', org);
                        const url = that.backendURL + '/auth/?name=' + name;
                        Log.trace('App::init()::init - login pressed for: ' + name + '; url: ' + url);
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
                Log.trace('App::init()::show - page: ' + pageName + '; validated: ' + validated + '; event: ' + JSON.stringify(event));

                // update login button state
                that.toggleLoginButton();

                if (that.view !== null) {
                    Log.trace('App::init()::show - calling view.renderPage for: ' + pageName);
                    that.view.renderPage(pageName, options);
                } else {
                    Log.trace('App::init()::show - view is null; cannot call view.renderPage for: ' + pageName);
                }
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

                const credentials = await this.getServerCredentials(username, token);
                if (credentials === null || typeof credentials.failure !== 'undefined') {
                    Log.info("App::validateCredentials() - server validation failed");
                    this.clearCredentials();
                } else {
                    Log.info("App::validateCredentials() - validated with server; isAdmin: " + credentials.success.isAdmin + "; isStaff: " + credentials.success.isStaff);
                    localStorage.setItem('user', credentials.success.personId);
                    localStorage.setItem('token', credentials.success.token);
                    localStorage.setItem('isAdmin', credentials.success.isAdmin + '');
                    localStorage.setItem('isStaff', credentials.success.isStaff + '');
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
            Log.trace("App::getGithubCredentials(..) - resp status: " + resp.status);
            return resp.json();
        }).then(function (data: any) {
            Log.trace("App::getGithubCredentials(..) - data then: " + data.login);
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
    private getServerCredentials(username: string, token: string): Promise<AuthTransportPayload> {
        const url = this.backendURL + '/getCredentials';
        Log.trace('App::getServerCredentials( ' + username + '...) - start; url: ' + url);
        const that = this;

        // const org = localStorage.org;
        const name = Factory.getInstance().getName();
        const options = {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent':   'Portal',
                'user':         username,
                'token':        token,
                'name':         name
                // 'org':          org
            }
        };
        return fetch(url, options).then(function (resp: any) {
            Log.trace("App::getServerCredentials(..) - resp status: " + resp.status);
            if (resp.status === 204) {
                Log.trace("App::getServerCredentials(..) - fetching");
                return fetch(url, options);
            } else {
                Log.trace("App::getServerCredentials(..) - passing through");
                Log.trace("App::getServerCredentials(..) - code returned: " + resp.status);

                if (resp.status === 400) {
                    that.clearCredentials();
                }
                return resp;
            }
        }).then(function (resp: any) {
            Log.trace("App::getServerCredentials(..) - data status: " + resp.status);
            return resp.json();
        }).then(function (data: AuthTransportPayload) {
            Log.trace("App::getServerCredentials(..) - data json: " + JSON.stringify(data));
            return data;
        }).catch(function (err: any) {
            Log.error("App::getServerCredentials(..) - ERROR: " + err);
            return null;
        });
    };

    private async retrieveConfig(): Promise<ConfigTransport> {
        const url = this.backendURL + '/config';
        Log.trace("App::retrieveConfig() - start; url: " + url);

        const options = {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent':   'Portal',
            }
        };

        let response = await fetch(url, options);
        if (response.status === 200) {
            Log.trace('App::retrieveConfig() - status: ' + response.status);
            const json: ConfigTransportPayload = await response.json();

            if (typeof json.success !== 'undefined') {
                Log.trace('App::retrieveConfig() - success; payload: ' + JSON.stringify(json) + '; setting org: ' + json.success.org);
                Factory.getInstance(json.success.name); // name instead of org
                return json.success;
            } else {
                Log.error('App::retrieveConfig() - failed: ' + JSON.stringify(json) + ')');
                return {org: 'ERROR', name: 'ERROR'};
            }
        } else {
            Log.error('App::retrieveConfig() - ERROR');
            return {org: 'ERROR', name: 'ERROR'};
        }
    }

    public handleMainPageClick(params?: any) {
        if (typeof params === 'undefined') {
            params = {};
        }
        Log.info("App::handleMainPageClick( " + JSON.stringify(params) + " ) - start");

        if (this.validated === true) {
            // push to correct handler
            params.isAdmin = localStorage.isAdmin === 'true'; // localStorage returns strings
            params.isStaff = localStorage.isStaff === 'true'; // localStorage returns strings
            if (params.isAdmin || params.isStaff) {
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
                // Log.trace("App::toggleLoginButton() - showing logout");
                const el = document.getElementById('indexLogin');
                if (el !== null) {
                    el.style.display = 'block';
                } else {
                    // Log.trace("App::toggleLoginButton() - button not visible");
                }
            } else {
                // Log.trace("App::toggleLoginButton() - hiding logout");
                const el = document.getElementById('indexLogin');
                if (el !== null) {
                    el.style.display = 'none';
                } else {
                    // Log.trace("App::toggleLoginButton() - button not visible");
                }
            }
        } catch (err) {
            // silently fail
            Log.error("App:toggleLoginButton() - ERROR: " + err);
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


