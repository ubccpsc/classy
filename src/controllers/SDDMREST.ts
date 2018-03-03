import Log from "../util/Log";
import * as rp from "request-promise-native";
import {PersonController} from "./PersonController";
import {Config} from "../Config";
import ClientOAuth2 = require("client-oauth2");
import {SDDMController} from "./SDDMController";
import {GitHubController} from "./GitHubController";

export class SDDMREST {

    public static getCurrentStatus(req: any, res: any, next: any) {
        Log.trace('SDDMREST - /getCurrentStatus - start GET');
        const user = req.headers.user;
        const token = req.headers.token;

        // TODO: verify token

        const org = Config.getInstance().getProp('org');

        let sc: SDDMController = new SDDMController(new GitHubController());
        let status = sc.getStatus(org, user).then(function (status) {
            Log.trace('BES - /getCurrentStatus; user: ' + user + '; status: ' + status);
            res.send({user: user, status: status});
        }).catch(function (err) {
            res.send(400, {error: err});
        });
    }


    public static performAction(req: any, res: any, next: any) {
        Log.trace('SDDMREST - /performAction - start GET');
        const user = req.headers.user;
        const token = req.headers.token;

        // TODO: verify token

        const org = Config.getInstance().getProp('org');

        let sc: SDDMController = new SDDMController(new GitHubController());
        let status = sc.getStatus(org, user).then(function (status) {
            Log.trace('BES - /getCurrentStatus; user: ' + user + '; status: ' + status);
            res.send({user: user, status: status});
        }).catch(function (err) {
            res.send(400, {error: err});
        });
    }



}