/**
 * Created by rtholmes on 2017-10-04.
 */

import {UI} from "./util/UI";
import Log from "../../../common/Log";
import {Network} from "./util/Network";
import {SDMMSummaryView} from "./SDMMSummaryView";

import {OnsButtonElement, OnsPageElement} from "onsenui";

declare var classportal: any;

export class App {

    // private studentController: StudentController = null;
    // private adminController: AdminController = null;

    // NOTE: having these hardcoded isn't great
    // these should come from Config.getInstance().getProp('foo');
    private readonly backendDEV = 'https://localhost:5000';
    private readonly backendPROD = 'https://sdmm.cs.ubc.ca:5000';
    private readonly frontendDEV = 'https://localhost:3000';
    private readonly frontendPROD = 'https://sdmm.cs.ubc.ca';

    public readonly backendURL: string = this.backendDEV;
    public readonly frontendURL: string = this.frontendDEV;

    private sdmmView: SDMMSummaryView = null;

    private validated = false;

    constructor() {
        Log.trace('App::<init> - start');

        if (window.location.href.indexOf('://localhost') > 0) {
            // DEV
            this.backendURL = this.backendDEV;
            this.frontendURL = this.frontendDEV;
        } else {
            // PROD
            this.backendURL = this.backendPROD;
            this.frontendURL = this.frontendPROD;
        }

        Log.trace('App::<init> config; backend: ' + this.backendURL + '; frontend: ' + this.frontendURL);
        Log.trace('App::<init> - backend: ' + this.backendURL);
    }

    public async init(): Promise<{}> {
        Log.trace('App::init() - start');
        const that = this;

        let validated = await that.validateCredentials();
        this.validated = validated;
        Log.trace('App::init() - validated: ' + validated);

        if (validated === true) {
            Log.trace('App::init() - validated: true; simulating mainPageClick');
            that.handleMainPageClick({org: 'secapstone'}); // NOTE: hardcode
        }

        return new Promise(function (fulfill, reject) {

            document.addEventListener('init', function (event) {
                const page = event.target as OnsPageElement;

                // update login button state
                that.toggleLoginButton();

                const pageName = page.id;

                let org: string = null;

                if (typeof (<any>page).pushedOptions !== 'undefined' && typeof (<any>page).pushedOptions.org !== 'undefined') {
                    org = (<any>page).pushedOptions.org;
                    localStorage.org = org;
                    // that.org = (<any>page).pushedOptions.org;
                    console.log('App::init()::init - org: ' + org + '; pushed option');
                }

                console.log('App::init()::init - page: ' + pageName);

                if (pageName === 'adminTabsPage') {
                    // initializing tabs page for the first time
                    // that.adminController = new AdminController(that, courseId);
                }

                if (pageName === 'studentTabsPage') {
                    // initializing tabs page for the first time
                    // that.studentController = new StudentController(that, courseId);

                    Log.info("studentTabsPage init; attaching sdmm view");

                    Log.trace("App::init() - adding sdmm");
                    // TODO: this should not be hard coded, but should instead get a value from the .env file
                    // e.g., so we can load up a DefaultView (RTH to build), or a SDMMView, or a MDSView

                    // just hardcode the options for now, but it should come from .env (or somewhere)
                    const viewName = "SDMMSummaryView";
                    if (viewName === "SDMMSummaryView") {
                        (<any>window).classportal.view = new SDMMSummaryView(that.backendURL);
                    } else if (viewName === "310") {
                        // (<any>window).classportal.view = new SDMMSummaryView();
                    }

                    Log.info('foobar');

                    let s: SDMMSummaryView = new SDMMSummaryView(that.backendURL);
                    that.sdmmView = s;

                    if (typeof (<any>window).myApp.sdmm === 'undefined') {
                        (<any>window).myApp.sdmm = s; // just for debugging
                    }
                    Log.trace("App::init() - adding sdmm done");
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

                if (pageName === 'main') {
                    if (1 + 1 > 0) {
                        return;
                    }
                    const AUTHORIZED_STATUS: string = 'authorized';

                    Log.trace('App::main()::authCheck - starting main.html with auth check');

                    that.toggleLoginButton();

                    const URL = that.backendURL + '/currentUser';
                    let OPTIONS_HTTP_GET: RequestInit = {credentials: 'include'};
                    fetch(URL, OPTIONS_HTTP_GET).then((data: any) => {
                        if (data.status !== 200) {
                            Log.trace('App::main()::authCheck - WARNING: Response status: ' + data.status);
                            throw new Error('App::main()::authCheck - API ERROR: ' + data.status);
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
                        Log.error('App:main()::authCheck - ERROR: ' + err.message);
                    });
                }

                if (pageName === 'loginPage') {

                    const userrole = String(localStorage.userrole);
                    // const username = String(localStorage.username);
                    if (userrole === 'student') {
                        UI.pushPage('student.html', {org: org});
                    } else if (userrole === 'admin' || userrole === 'superadmin') {
                        UI.pushPage('admin.html', {org: org});
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
                    that.sdmmView.renderPage();
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
        // clear the cookie and refresh
        this.validated = false;
        localStorage.clear();
        document.cookie = "token=empty;expires=" + new Date(0).toUTCString();
        location.href = location.href;
    }

    private getGithubCredentials(token: string): Promise<string | null> {
        Log.trace("App::getGithubCredentials(..) - start");
        return fetch('https://api.github.com/user', {
            headers: {
                'Content-Type':  'application/json',
                // 'User-Agent':    'Portal',
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

    private getServerCredentials(username: string, token: string): Promise<{}> {
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

    public handleMainPageClick(params: {}) {
        Log.info("App::handleMainPageClick(..) - start");

        if (this.validated === true) {
            // push to correct handler
            if (localStorage.kind === 'superadmin') {
                Log.info("App::handleMainPageClick(..) - super admin");
                UI.pushPage('superadmin.html', params);
            } else if (localStorage.kind === 'admin') {
                Log.info("App::handleMainPageClick(..) - admin");
                UI.pushPage('admin.html', params);
            } else {
                Log.info("App::handleMainPageClick(..) - student");
                UI.pushPage('student.html', params);
            }
        } else {
            // push to login page
            Log.info("App::handleMainPageClick(..) - not authorized");
            UI.pushPage('login.html', params);
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
                document.getElementById('indexLogin').style.display = 'block';
            } else {
                Log.trace("App::toggleLoginButton() - hiding logout");
                document.getElementById('indexLogin').style.display = 'none';
            }
        } catch (err) {
            // silently fail
            Log.error("APP:toggleLoginButton() - ERROR: " + err);
        }
    }

    /**
     * TODO: this should _NOT_ be here since it is SDMM-specific
     */
    public sdmmSelectChanged() {
        console.log('sdmmSelectChanged');
        (<any>window).myApp.sdmm.updateState(); // stick to dropdown for debugging
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


