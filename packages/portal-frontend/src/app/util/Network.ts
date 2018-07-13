import Log from "../../../../common/Log";

/**
 * Created by rtholmes on 2017-10-04.
 */

// import 'whatwg-fetch';

export class Network {

    public static detectUnauthenticated(url: string) {
        console.log('Network::delectUnauthenticated( ' + url + 'isAuthenticated ) - start');
        const USE_REAL = true;
        if (USE_REAL === true) {
            const OPTIONS_HTTP_GET: object = {credentials: 'include'};
            const AUTHORIZED_STATUS: string = 'authorized';
            let authStatus = String(localStorage.getItem('authStatus'));

            fetch(url + 'currentUser', OPTIONS_HTTP_GET).then((data: any) => {
                if (data.status !== 200) {
                    throw new Error('Network::detectUnauthenticated( ' + url + ' ) - start');
                } else {
                    data.json().then(function (data: any) {
                        console.log('Network::detectUnauthenticated( \' + url + \' ) - then; data: ' + JSON.stringify(data));
                        console.log('the data', data);
                        if (data.response === false) {
                            localStorage.removeItem('authStatus');
                            location.reload();
                        }
                    });
                    console.log('Network::handleRemote() 200 return');
                }
            }).catch((err: Error) => {
                console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
                localStorage.removeItem('authStatus');
                // onError(err.message);
            });
            console.log('Network::delectUnauthenticated( ' + url + 'isAuthenticated ) - end')
        }
    }

    public static remotePost(url: string, payload: object, onError: any): Promise<object> {
        console.log('Network::handleRemote( ' + url + ' ) - start');

        const OPTIONS_HTTP_POST: object = {
            // credentials: 'include',
            method:      'post',
            // cors:        'enabled',
            body:        JSON.stringify(payload), headers: {'Content-Type': 'application/json'}
        };
        const AUTHORIZED_STATUS: string = 'authorized';

        return fetch(url, OPTIONS_HTTP_POST).then((data: any) => {
            if (data.status !== 200 && data.status !== 405 && data.status !== 401) {
                console.log('Network::handleRemote() WARNING: Repsonse status: ' + data.status);
                throw new Error('Network::handleRemote() - API ERROR: ' + data.status);
            } else if (data.status !== 200 && data.status === 405 || data.status === 401) {
                console.error('Network::getRemotePost() Permission denied for your userrole.');
                alert('You are not authorized to access this endpoint. Please re-login.');
                location.reload();
            } else {
                console.log('Network::handleRemote() 200 return');
                return data.json().then(function (json: any) {
                    console.log('Network::updateRemotePost() 200 return: ' + json);
                    return json;
                });
            }
        }).catch((err: Error) => {
            console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
            // onError(err.message);
        });
    }

    public static getRemotePost(url: string, payload: object, view: any, onError: any) {
        const USE_REAL = true;
        console.log('Network::handleRemote( ' + url + ' ) - start');

        if (USE_REAL === true) {
            const OPTIONS_HTTP_POST: object = {
                credentials: 'include', method: 'post', cors: 'enabled',
                body:        JSON.stringify(payload), headers: {'Content-Type': 'application/json'}
            };
            const AUTHORIZED_STATUS: string = 'authorized';

            fetch(url, OPTIONS_HTTP_POST).then((data: any) => {
                if (data.status !== 200 && data.status !== 405 && data.status !== 401) {
                    console.log('Network::handleRemote() WARNING: Repsonse status: ' + data.status);
                    throw new Error('Network::handleRemote() - API ERROR: ' + data.status);
                } else if (data.status !== 200 && data.status === 405 || data.status === 401) {
                    console.error('Network::getRemotePost() Permission denied for your userrole.');
                    alert('You are not authorized to access this endpoint. Please re-login.');
                    location.reload();
                } else {
                    console.log('Network::handleRemote() 200 return');
                    data.json().then(function (json: any) {
                        view.render(json); // calls render instead of the function
                    });
                }
            }).catch((err: Error) => {
                console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
                // onError(err.message);
            });

        } else {
            // if you want to use fake data
            // probably won't work once we start hooking up real data since the formats will be different
            Network.getData(url).then(function (data: any) {
                console.log('Network::handleRemote( \' + url + \' ) - then; data: ' + JSON.stringify(data));
                view.render(data);
            }).catch(function (err: Error) {
                console.log('Network::handleRemote( \' + url + \' ) - catch; ERROR: ' + err);
                onError(err);
            });
        }
    }

    public static async httpPost(url: string, payload: object): Promise<object> {
        console.log('Network::httpPost( ' + url + ' ) - start');
        const OPTIONS_HTTP_POST: object = {
            credentials: 'include',
            method:      'post',
            cors:        'enabled',
            headers:     {'Content-Type': 'application/json'},
            body:        JSON.stringify(payload)
        };
        return fetch(url, OPTIONS_HTTP_POST).then((data: any) => {
            return data
        }).catch((err) => {
            console.log('Network::httpPost() ERROR ' + err);
        });
    }

    public static async httpPostFile(url: string, opts: any, formData: FormData): Promise<Response> {
        Log.trace('Network::httpPostFile( ' + url + ' ) - start');

        let postOptions: {} = {
            method: 'post',
            cors:   'enabled',
            body:   formData
        };

        try {
            postOptions = Object.assign(postOptions, opts); // add in user & token
            const data = await fetch(url, postOptions);
            Log.trace('Network::httpPostFile( ' + url + ' ) - success');
            return data;
        } catch (err) {
            Log.trace('Network::httpPostFile( ' + url + ' ) - ERROR ' + err);
            throw err;
        }
    }

    public static async httpPut(url: string, payload: object): Promise<object> {
        console.log('Network::httpPut( ' + url + ' ) - start');
        const OPTIONS_HTTP_PUT: object = {
            credentials: 'include',
            method:      'put',
            cors:        'enabled',
            headers:     {'Content-Type': 'application/json'},
            body:        JSON.stringify(payload)
        };
        return fetch(url, OPTIONS_HTTP_PUT).then((data: any) => {
            return data;
        }).catch((err) => {
            console.log('Network::httpPut() ERROR ' + err);
        });
    }

    public static async httpGet(url: string): Promise<object> {
        console.log('Network::httpGet( ' + url + ' ) - start');
        const OPTIONS_HTTP_GET: object = {credentials: 'include'};
        return fetch(url, OPTIONS_HTTP_GET).then((data: any) => {
            if (data.status === 200) {
                return data.json().then((jsonData: object) => {
                    return jsonData;
                });
            } else {
                throw 'Could not fetch data from ' + url;
            }
        }).catch((err) => {
            console.log('Network::httpGet() ERROR ' + err);
        });
    }

    public static handleRemote(url: string, view: any, onError: any) {
        const USE_REAL = true;
        console.log('Network::handleRemote( ' + url + ' ) - start');

        if (USE_REAL === true) {
            const OPTIONS_HTTP_GET: object = {credentials: 'include'};
            const AUTHORIZED_STATUS: string = 'authorized';

            fetch(url, OPTIONS_HTTP_GET).then((data: any) => {
                if (data.status !== 200 && data.status !== 405 && data.status !== 401) {
                    console.log('Network::handleRemote() WARNING: Repsonse status: ' + data.status);
                    throw new Error('Network::handleRemote() - API ERROR: ' + data.status);
                } else if (data.status !== 200 && data.status === 405 || data.status === 401) {
                    console.error('Network::getRemotePost() Permission denied for your userrole.');
                    alert('You are not authorized to access this endpoint. Please re-login.');
                    location.reload();
                } else {
                    console.log('Network::handleRemote() 200 return');
                    data.json().then(function (json: any) {
                        view.render(json); // calls render instead of the function
                    });
                }
            }).catch((err: Error) => {
                console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
                // onError(err.message);
            });

        } else {
            // if you want to use fake data
            // probably won't work once we start hooking up real data since the formats will be different
            Network.getData(url).then(function (data: any) {
                console.log('Network::handleRemote( \' + url + \' ) - then; data: ' + JSON.stringify(data));
                view.render(data);
            }).catch(function (err: Error) {
                console.log('Network::handleRemote( \' + url + \' ) - catch; ERROR: ' + err);
                onError(err);
            });
        }
    }


    public static handleRemoteText(url: string, view: any, onError: any) {
        const USE_REAL = true;
        console.log('Network::handleRemoteText( ' + url + ' ) - start');

        const OPTIONS_HTTP_GET: object = {credentials: 'include'};
        const AUTHORIZED_STATUS: string = 'authorized';

        fetch(url, OPTIONS_HTTP_GET).then((data: any) => {
            if (data.status !== 200) {
                console.log('Network::handleRemote() WARNING: Repsonse status: ' + data.status);
                throw new Error('Network::handleRemote() - API ERROR: ' + data.status);
            } else {
                console.log('Network::handleRemote() 200 return');
                data.text().then(function (text: any) {
                    view.render(text); // calls render instead of the function
                });
            }
        }).catch((err: Error) => {
            console.error('Network::handleRemote( ' + url + ' ) - ERROR ' + err, err);
            onError('Error retrieving: ' + url + '; message: ' + err.message);
        });
    }

    public static getData(url: string): Promise<any> {
        console.log('Network::getData( ' + url + ' ) - start');

        return new Promise(function (fulfill: any, reject: any) {
            if (url.indexOf('/student/210/rtholmes') > 0) {
                setTimeout(function () {
                    fulfill(
                        {
                            name:         'Reid Holmes',
                            course:       'CPSC 210',
                            lab:          'L210C',
                            cwl:          'rtholmes',
                            deliverables: [
                                {id: 'd1', due: 'Sept 10, 2010'},
                                {id: 'd2', due: 'Oct 10, 2010'},
                                {id: 'd3', due: 'Nov 10, 2010'},
                                {id: 'd4', due: 'Dec  10, 2010'},
                            ],
                            teams:        [
                                {id: 'd1', msg: 'Individual deliverable.'},
                                {id: 'd2', msg: 'Individual deliverable.'},
                                {id: 'd3-d5', members: ['foo, bar, baz']},
                                {id: 'd5', msg: 'Not yet available.'},
                            ],
                            grades:       [
                                {id: 'd1', final: 92, test: 90, cover: 88},
                                {id: 'd2', final: 80, test: 75, cover: 90},
                                {id: 'd3', msg: 'N/A'},
                                {id: 'd4', msg: 'N/A'},
                                {id: 'd5', msg: 'N/A'}
                            ]
                        }
                    );
                }, 1000); // fake delay
            } else if (url.indexOf('/student/310/rtholmes') > 0) {
                fulfill(
                    {
                        name:         'James Wilson',
                        course:       'CPSC 310',
                        lab:          'L310C',
                        cwl:          'jWilson',
                        deliverables: [
                            {id: 'd0', due: 'Sept 10, 2010'},
                            {id: 'd1', due: 'Sept 10, 2010'},
                            {id: 'd2', due: 'Oct 10, 2010'},
                            {id: 'd3', due: 'Nov 10, 2010'}
                        ],
                        teams:        [
                            {id: 'd0', msg: 'Individual deliverable.'},
                            {id: 'd1-d3', members: ['foo', 'bar']}
                        ],
                        grades:       [
                            {id: 'd0', final: 55, test: 60, cover: 30},
                            {id: 'd1', final: 92, test: 90, cover: 88},
                            {id: 'd2', final: 80, test: 75, cover: 90},
                            {id: 'd3', msg: 'N/A'}
                        ]
                    }
                );
            } else if (url.indexOf('/admin/310/teams') > 0) {

                fulfill(
                    {
                        course:       "CPSC 310 Admin",
                        deliverables: [
                            {
                                id:         "d1",
                                teams:      [
                                    {id: 'team1d1', members: ['foo', 'bar', 'baz']},
                                    {id: 'team2d1', members: ['qaz', 'nza', 'fisher']},
                                    {id: 'team3d1', members: ['foo', 'bar', 'baz']},
                                    {id: 'team4d1', members: ['foo', 'bar', 'baz']},
                                    {id: 'team5d1', members: ['foo', 'bar', 'baz']},
                                    {id: 'team6d1', members: ['foo', 'bar', 'baz']},
                                    {id: 'team7d1', members: ['foo', 'bar', 'baz']}
                                ],
                                unassigned: ['unassign1', 'unassign2', 'unassign3']
                            },
                            {
                                id:         "d2",
                                teams:      [
                                    {id: 'team1d2', members: ['foo', 'bar', 'baz']},
                                    {id: 'team2d2', members: ['qaz', 'nza', 'fisher']},
                                    {id: 'team3d2', members: ['foo', 'bar', 'baz']},
                                    {id: 'team4d2', members: ['foo', 'bar', 'baz']},
                                    {id: 'team5d2', members: ['foo', 'bar', 'baz']},
                                    {id: 'team6d2', members: ['foo', 'bar', 'baz']},
                                    {id: 'team7d2', members: ['foo', 'bar', 'baz']}
                                ],
                                unassigned: ['unassign1']
                            }
                        ]
                    }
                );

            } else if (url.indexOf('/admin/310/deliverables') > 0) {

                fulfill(
                    {
                        course:       "CPSC 310 Admin",
                        deliverables: [
                            {
                                id:     "d1",
                                open:   "Sept 10, 2010 @ 1200",
                                close:  "Sept 17, 2010 @ 1900",
                                scheme: "Tests * .7, + Cover * .3"
                            },
                            {
                                id:     "d2",
                                open:   "Sept 20, 2010 @ 1200",
                                close:  "Sept 27, 2010 @ 1900",
                                scheme: "Tests * .7, + Cover * .3"
                            },
                            {
                                id:     "d3",
                                open:   "Oct 10, 2010 @ 1200",
                                close:  "Oct 17, 2010 @ 1900",
                                scheme: "Tests * .7, + Cover * .3"
                            },
                        ]
                    }
                );

            } else if (url.indexOf('/admin/310/dashboard') > 0) {

                fulfill(
                    {
                        course: "CPSC 310 Admin",
                        rows:   [
                            {
                                id:      "d1",
                                team:    "team 1",
                                final:   99,
                                cover:   100,
                                test:    98,
                                passing: ['foo', 'bar', 'baz'],
                                failing: ['fail', 'fail2']
                            },
                            {
                                id:      "d1",
                                team:    "team 2",
                                final:   66,
                                cover:   90,
                                test:    40,
                                passing: ['foo'],
                                failing: ['fail', 'bar', 'baz']
                            },
                        ]
                    }
                );
            } else if (url.indexOf('/admin/310/grades') > 0) {

                fulfill(
                    {
                        course:   "CPSC 310 Admin",
                        students: [
                            {
                                id:           "student1",
                                deliverables: [
                                    {id: 'd1', final: 65, test: 60, cover: 30},
                                    {id: 'd2', final: 85, test: 60, cover: 30},
                                    {id: 'd3', final: 25, test: 60, cover: 30},
                                    {id: 'd4'},
                                    {id: 'd5'}
                                ],
                            },
                            {
                                id:           "student2",
                                deliverables: [
                                    {id: 'd1', final: 15, test: 60, cover: 30},
                                    {id: 'd2', final: 25, test: 60, cover: 30},
                                    {id: 'd3', final: 35, test: 60, cover: 30},
                                    {id: 'd4'},
                                    {id: 'd5'}
                                ],
                            },
                            {
                                id:           "student3",
                                deliverables: [
                                    {id: 'd1', final: 95, test: 60, cover: 30},
                                    {id: 'd2', final: 95, test: 60, cover: 30},
                                    {id: 'd3', final: 85, test: 60, cover: 30},
                                    {id: 'd4'},
                                    {id: 'd5'}
                                ],
                            }
                        ]
                    }
                );
            } else {
                reject(new Error('Unknown URL: ' + url));
            }

        });

    }

}