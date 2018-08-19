/**
 * Created by rtholmes on 2017-10-04.
 */
import Log from "../../../../../common/Log";

export class AuthHelper {

    private backendURL: string;
    private OPTIONS_HTTP_GET: object = {credentials: 'include'};

    constructor(backendURL: string) {
        Log.trace('AuthHelper::<init> - start');
        this.backendURL = backendURL;
    }

    /**
     * @param {string} userrole  that the current user should match
     */
    public checkUserrole(userrole: string) {
        Log.trace('AuthHelper::checkUserRole() - start');
        this.getCurrentUser().then((data: any) => {
            if (data.response.user.userrole === userrole) {
                Log.trace('AuthHelper::checkUserrole() Valid userrole confirmed: ' + userrole + '.');
            } else {
                this.updateAuthStatus();
            }
        }).catch((err: any) => {
            Log.error('AuthHelper::checkUserrole() - end');
        });
    }

    public updateAuthStatus() {
        this.isLoggedIn().then((data: any) => { // IsAuthenticatedResponse
            // console.log(data.response);
            Log.trace('AuthHelper::updateAuthStatus( ) - start');
            const authStatus = localStorage.getItem('authStatus');
            const UNAUTHENTICATED_STATUS = 'unauthenticated';
            if (data.response === false && authStatus !== UNAUTHENTICATED_STATUS) {
                Log.trace('AuthHelper::updateAuthStatus( unauthenticated )');
                localStorage.setItem('authStatus', UNAUTHENTICATED_STATUS);
                location.reload();
            }
            Log.trace('AuthHelper::updateAuthStatus( ) - end');
        }).catch((err: Error) => {
            this.removeAuthStatus();
            Log.error('AuthHelper::updateAuthStatus( ERROR ) - Logged out - Unauthenticated');
        });
    }

    private getCurrentUser(): Promise<object> {
        const that = this;
        const url = that.backendURL + '/portal/currentUser'; // TODO: what is this route???
        Log.trace('AuthHelper::getCurrentUser( ' + url + ' ) - start');

        return fetch(url, that.OPTIONS_HTTP_GET).then((data: any) => {
            if (data.status !== 200) {
                throw new Error('AuthHelper::getCurrentUser( ' + url + ' )');
            } else {
                return data.json();
            }
        }).catch((err: Error) => {
            Log.error('AuthHelper::getCurrentUser( ' + url + ') - ERROR ' + err);
        });
    }

    private removeAuthStatus() {
        localStorage.removeItem('authStatus');
    }

    private isLoggedIn(): Promise<object> {
        const that = this;
        const url = that.backendURL + '/portal/isAuthenticated'; // TODO: what is this route???
        Log.trace('AuthHelper::isLoggedIn( ' + url + ' ) - start');
        const AUTHORIZED_STATUS: string = 'authorized';
        const authStatus = String(localStorage.getItem('authStatus'));

        return fetch(url, that.OPTIONS_HTTP_GET).then((data: any) => {
            if (data.status !== 200) {
                throw new Error('AuthHelper::isLoggedIn( ' + that.backendURL + ' )');
            } else {
                return data.json();
            }
        }).catch((err: Error) => {
            Log.error('AuthHelper::handleRemote( ' + that.backendURL + ' ) - ERROR ' + err);
        });
    }
}
