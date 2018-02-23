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
//# sourceMappingURL=Network.js.map