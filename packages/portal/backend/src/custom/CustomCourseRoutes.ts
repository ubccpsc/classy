import * as rp from "request-promise-native";
import * as restify from "restify";

import Log from "../../../../common/Log";

import Util from "../../../../common/Util";
import {GitHubActions} from "../controllers/GitHubActions";
import {GitHubController} from "../controllers/GitHubController";
import {RepositoryController} from "../controllers/RepositoryController";
import AdminRoutes from "../server/common/AdminRoutes";
import IREST from "../server/IREST";
import {Repository} from "../Types";

/**
 * This class should add any custom routes a course might need.
 *
 * Nothing should be added to this class.
 */
export default class CustomCourseRoutes implements IREST {
    private static ghc = new GitHubController(GitHubActions.getInstance());
    private static rc = new RepositoryController();

    public registerRoutes(server: restify.Server) {
        Log.trace('CustomCourseRoutes::registerRoutes()');
        server.get('/portal/admin/listPatches', AdminRoutes.isAdmin, CustomCourseRoutes.listPatches);
        server.post('/portal/admin/patchRepo', AdminRoutes.isAdmin, CustomCourseRoutes.patchRepo);
        server.post('/portal/admin/patchRepoList', AdminRoutes.isAdmin, CustomCourseRoutes.patchRepoList);
        server.post('/portal/admin/patchAllRepos', AdminRoutes.isAdmin, CustomCourseRoutes.patchAllRepos);
        server.post('/portal/admin/updatePatches', AdminRoutes.isAdmin, CustomCourseRoutes.updatePatches);
    }

    private static updatePatches(req: any, res: any, next: any) {
        Log.trace('CustomCourseRoutes::updatePatches(..) - start');
        const start = Date.now();
        // TODO get the url from the config key
        const url = "http://localhost:8080" + "/update";
        const opts: rp.RequestPromiseOptions = {
            rejectUnauthorized: false,
            strictSSL: false,
            method: 'post'
        };

        rp(url, opts).then((result) => {
            Log.info('CustomCourseRoutes::updatePatches(..) - done; took: ' + Util.took(start));
            res.send({success: "patches updated"});
            return next();
        }).catch((err) => {
            return CustomCourseRoutes.handleError(400, 'Unable to update patches. Error: ' + err.message, res, next);
        });
    }

    private static listPatches(req: any, res: any, next: any) {
        Log.trace('CustomCourseRoutes::listPatches(..) - start');
        const start = Date.now();
        // TODO get the url from the config key
        const url = "http://localhost:8080" + "/patches";
        const opts: rp.RequestPromiseOptions = {
            rejectUnauthorized: false,
            strictSSL: false,
            method: 'get'
        };

        rp(url, opts).then((result) => {
            try  {
                const patches = JSON.parse(result).message;
                Log.info('CustomCourseRoutes::listPatches(..) - done; ' + patches.length + ' patch' +
                    (patches.length === 1 ? '' : 'es') + ' found; took: ' + Util.took(start));
                res.send({success: patches});
                return next();
            } catch (err) {
                return CustomCourseRoutes.handleError(400, 'Patches not returned in expected format. Error: '
                    + err.message, res, next);
            }
        }).catch((err) => {
            return CustomCourseRoutes.handleError(400, 'Unable to get patches. Error: ' + err.message, res, next);
        });
    }

    private static patchRepoList(req: any, res: any, next: any) {
        Log.trace('CustomCourseRoutes::patchRepoList(..) - start');
        const start = Date.now();
        const patch: string = req.params.patch;
        const reposToPatch = req.body;
        const promises: Array<Promise<Repository>> = [];
        try {
            for (const repoId of reposToPatch) {
                promises.push(CustomCourseRoutes.rc.getRepository(repoId));
            }
            Promise.all(promises)
                .then((repos: Repository[]) => {
                    // TODO remove when changes are pull from upstream
                    // @ts-ignore
                    return repos.map((repo: Repository) => CustomCourseRoutes.ghc.createPullRequest(repo, patch));
                })
                .then((results) => {
                    const failures = reposToPatch.filter((name: string, index: number) => results[index] === false);
                    if (failures.length > 0) {
                        Log.error("CustomCourseRoutes::patchRepoList(..) - " +
                            `${failures.length} repo${failures.length === 1 ? ' was' : 's were'} not patched successfully.`);
                    }
                    Log.info('CustomCourseRoutes::patchRepoList(..) - done; took: ' + Util.took(start));
                    res.send({failures});
                    return next();
                })
                .catch((err) => {
                    return AdminRoutes.handleError(400, 'Unable to patch repo list. ERROR: ' + err.message, res, next);
                });
        } catch (err) {
            return AdminRoutes.handleError(400, 'ErrUnable to patch repo list. ERROR: ' + err.message, res, next);
        }
    }

    private static patchRepo(req: any, res: any, next: any) {
        Log.trace('CustomCourseRoutes::patchRepo(..) - start');
        const start = Date.now();
        const patch: string = req.params.patch;
        const repoId: string = req.params.repo;
        CustomCourseRoutes.rc.getRepository(repoId)
            .then((repo: Repository) => {
                // TODO remove when changes are pull from upstream
                // @ts-ignore
                return stomCourseRoutes.ghc.createPullRequest(repo, patch);
            })
            .then((result: boolean) => {
                if (result) {
                    Log.info('CustomCourseRoutes::patchRepo(..) - done; took: ' + Util.took(start));
                    res.send({success: repoId});
                    return next();
                } else {
                    return AdminRoutes.handleError(400, 'Unable to patch repo.', res, next);
                }
            })
            .catch((err) => {
                return AdminRoutes.handleError(400, 'Unable to patch repo. ERROR: ' + err.message, res, next);
            });
    }

    private static patchAllRepos(req: any, res: any, next: any) {
        Log.trace('CustomCourseRoutes::patchAllRepos(..) - start');
        const start = Date.now();
        let repoNames: string[];
        const patch: string = req.params.patch;

        CustomCourseRoutes.rc.getAllRepos().then(function(repos: Repository[]) {
            repoNames = repos.map((repo: Repository) => repo.id);
            // TODO remove when changes are pull from upstream
            const promises: Array<Promise<boolean>> = repos
            // @ts-ignore
                .map((repo: Repository) => CustomCourseRoutes.ghc.createPullRequest(repo, patch));
            return Promise.all(promises);
        }).then((results) => {
            const failures = repoNames.filter((name: string, index: number) => results[index] === false);
            if (failures.length > 0) {
                Log.error("CustomCourseRoutes::patchAllRepos(..) - " +
                    `${failures.length} repo${failures.length === 1 ? ' was' : 's were'} not patched successfully.`);
            }
            Log.info('CustomCourseRoutes::patchAllRepos(..) - done; took: ' + Util.took(start));
            res.send({failures});
            return next();
        }).catch(function(err) {
            return AdminRoutes.handleError(400, 'Unable to patch all repos. ERROR: ' + err.message, res, next);
        });
    }

    public static handleError(code: number, msg: string, res: any, next: any) {
        Log.error('CustomCourseRoutes::handleError(..) - ERROR: ' + msg);
        res.send(code, {failure: {message: msg, shouldLogout: false}});
        return next(false);
    }
}
