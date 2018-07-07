//

//

// This file can probably be removed. Just in purgatory for a few commits to be sure.

//

//


// import Log from "../../../common/Log";
//
// import {AuthController} from "../controllers/AuthController";
// import {DatabaseController} from "../controllers/DatabaseController";
// import {PersonController} from "../controllers/PersonController";
//
// /**
//  * Just a large body of static methods for translating between restify and the remainder of the system.
//  */
// export class RouteHandler {
//
//     private static dc = DatabaseController.getInstance();
//     private static pc = new PersonController();
//     private static ac = new AuthController();
//
//     /**
//      * Work around some CORS-related issues for OAuth. This looks manky, but don't change it.
//      *
//      * Really.
//      *
//      * Code taken from restify #284
//      *
//      * @param req
//      * @param res
//      */
//     public static handlePreflight(req: any, res: any) {
//         Log.trace("RouteHandler::handlePreflight(..) - " + req.method.toLowerCase() + "; uri: " + req.url);
//
//         const allowHeaders = ['Accept', 'Accept-Version', 'Content-Type', 'Api-Version', 'user-agent', 'user', 'token', 'org', 'name'];
//         if (res.methods.indexOf('OPTIONS') === -1) {
//             res.methods.push('OPTIONS');
//         }
//
//         if (res.methods.indexOf('GET') === -1) {
//             res.methods.push('GET');
//         }
//
//         res.header('Access-Control-Allow-Credentials', true);
//         res.header('Access-Control-Allow-Headers', allowHeaders.join(', '));
//         res.header('Access-Control-Allow-Methods', res.methods.join(', '));
//         res.header('Access-Control-Allow-Origin', req.headers.origin);
//
//         Log.trace("RouteHandler::handlePreflight(..) - sending 204; headers: " + JSON.stringify(res.getHeaders()));
//         return res.send(204);
//     }
//
// }
