import {AutoTest} from "../autotest/AutoTest";
import {ICommentEvent, ICommitRecord, IContainerInput, IPushEvent} from "../Types";
import Log from "../util/Log";
import {IGithubService} from "../github/GithubService";
import {IClassPortal} from "../autotest/ClassPortal";
import {IDataStore} from "../autotest/DataStore";

export class EdxAutoTest extends AutoTest {

    private classPortal: IClassPortal = null;
    private github: IGithubService = null;

    constructor(courseId: string, dataStore: IDataStore, portal: IClassPortal, github: IGithubService) {
        super(courseId, dataStore); // this.courseId = courseId;
        this.classPortal = portal;
        this.github = github;
    }

    public async handleTestRequest(commitURL: string, delivId: string): Promise<void> {
        Log.info("EdxAutoTest::handleTestRequest(..) - start; url: " + commitURL + "; delivId: " + delivId);

        const start = Date.now();

        if (typeof commitURL === "undefined" || commitURL === null) {
            // ERROR
            Log.info("EdxAutoTest::handleTestRequest(..) - commitURL missing");
            // TODO: report back to user
            return;
        }

        if (typeof delivId === "undefined" || delivId === null) {
            // ERROR
            Log.info("EdxAutoTest::handleTestRequest(..) - delivId missing");
            // TODO: report back to user
            return;
        }

        const info = await EdxUtil.simulatePushEvent(commitURL);
        const input: IContainerInput = {courseId: this.courseId, delivId, pushInfo: info};
        await this.dataStore.savePush(input);

        this.addToStandardQueue(input);
        this.tick();

        return Promise.resolve();
    }

    protected processExecution(data: ICommitRecord): Promise<void> {
        Log.info("EdxAutoTest::processExecution(..) - start; url: " + data.commitURL);
        return Promise.resolve();
    }
}

export class EdxUtil {

    public static async simulatePushEvent(commitURL: string): Promise<IPushEvent | null> {
        Log.info("EdxUtil::simulatePushEvent(..) - start; url: " + commitURL);
        const evt: IPushEvent = {
            branch:      '', // really refs
            repo:        '', // repo name
            commitSHA:   '', // SHA
            commitURL:   'commitURL', // full url to commit
            org:         '', // orgName
            projectURL:  '', // full url to project
            postbackURL: '', // where to send postback results
            timestamp:   -1 // timestamp of push event
        };
        return Promise.resolve(evt);
    }

    public static convertPayload(request: any): ICommentEvent {
        return null;
    }

}
