"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Log_1 = require("./Log");
var AuthHelper = (function () {
    function AuthHelper(backendURL) {
        this.OPTIONS_HTTP_GET = { credentials: 'include' };
        Log_1.default.trace('AuthHelper::<init> - start');
        this.backendURL = backendURL;
    }
    AuthHelper.prototype.checkUserrole = function (userrole) {
        var _this = this;
        Log_1.default.trace('AuthHelper::checkUserRole() - start');
        this.getCurrentUser().then(function (data) {
            if (data.response.user.userrole === userrole) {
                Log_1.default.trace('AuthHelper::checkUserrole() Valid userrole confirmed: ' + userrole + '.');
            }
            else {
                _this.updateAuthStatus();
            }
        }).catch(function (err) {
            Log_1.default.error('AuthHelper::checkUserrole() - end');
        });
    };
    AuthHelper.prototype.updateAuthStatus = function () {
        var _this = this;
        this.isLoggedIn().then(function (data) {
            Log_1.default.trace('AuthHelper::updateAuthStatus( ) - start');
            var authStatus = localStorage.getItem('authStatus');
            var UNAUTHENTICATED_STATUS = 'unauthenticated';
            if (data.response === false && authStatus !== UNAUTHENTICATED_STATUS) {
                Log_1.default.trace('AuthHelper::updateAuthStatus( unauthenticated )');
                localStorage.setItem('authStatus', UNAUTHENTICATED_STATUS);
                location.reload();
            }
            Log_1.default.trace('AuthHelper::updateAuthStatus( ) - end');
        }).catch(function (err) {
            _this.removeAuthStatus();
            Log_1.default.error('AuthHelper::updateAuthStatus( ERROR ) - Logged out - Unauthenticated');
        });
    };
    AuthHelper.prototype.getCurrentUser = function () {
        var that = this;
        var url = that.backendURL + 'currentUser';
        Log_1.default.trace('AuthHelper::getCurrentUser( ' + url + ' ) - start');
        return fetch(url, that.OPTIONS_HTTP_GET).then(function (data) {
            if (data.status !== 200) {
                throw new Error('AuthHelper::getCurrentUser( ' + url + ' )');
            }
            else {
                return data.json();
            }
        }).catch(function (err) {
            Log_1.default.error('AuthHelper::getCurrentUser( ' + url + ') - ERROR ' + err);
        });
    };
    AuthHelper.prototype.removeAuthStatus = function () {
        localStorage.removeItem('authStatus');
    };
    AuthHelper.prototype.isLoggedIn = function () {
        var that = this;
        var url = that.backendURL + 'isAuthenticated';
        Log_1.default.trace('AuthHelper::isLoggedIn( ' + url + ' ) - start');
        var AUTHORIZED_STATUS = 'authorized';
        var authStatus = String(localStorage.getItem('authStatus'));
        return fetch(url, that.OPTIONS_HTTP_GET).then(function (data) {
            if (data.status !== 200) {
                throw new Error('AuthHelper::isLoggedIn( ' + that.backendURL + ' )');
            }
            else {
                return data.json();
            }
        }).catch(function (err) {
            Log_1.default.error('AuthHelper::handleRemote( ' + that.backendURL + ' ) - ERROR ' + err);
        });
    };
    return AuthHelper;
}());
exports.AuthHelper = AuthHelper;
//# sourceMappingURL=AuthHelper.js.map