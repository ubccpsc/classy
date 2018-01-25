export interface IClassPortal {

    /**
     * For a given commitUrl, figure out what the default deliverable is at the current time.
     *
     * NOTE: commitUrl could be something simpler too, maybe just courseId is easiest:
     *
     * GET /admin/getDefaultDeliverable/{:courseId}
     *
     * @param commitUrl
     */
    getDefaultDeliverableId(commitUrl: string): Promise<string | null>;

    /**
     * Returns whether the username is staff on the course.
     *
     * GET /admin/isStaff/{:courseId}/{:userId} (or some variant)
     *
     * @param courseId
     * @param userName
     */
    isStaff(courseId: string, userName: string): Promise<boolean>;

    /**
     * Gets the delay period (in seconds) that AutoTest should enforce on students between feedback requests.
     *
     * GET /admin/getTestDelay/{:courseId} (or some variant)
     *
     * Currently assumes the delay is constant across all deliverables.
     *
     * @param courseId
     */
    getTestDelay(courseId: string): Promise<number | null>;
}

export class DummyClassPortal implements IClassPortal {

    public async isStaff(courseId: string, userName: string): Promise<boolean> {
        if (typeof courseId === "undefined" || courseId === null || typeof userName === "undefined" || userName === null) {
            return false;
        }
        if (courseId === "310") {
            return userName === "staff" || userName === "cs310";
        }
        return false;
    }

    public async getDefaultDeliverableId(commitUrl: string): Promise<string | null> {
        if (typeof commitUrl !== "undefined" && commitUrl !== null) {
            if (commitUrl.indexOf("310") >= 0) {
                return "d1";
            }
        }
        return null;
    }

    /**
     * Gets the delay beween test executions in milliseconds
     *
     * @param {string} courseId
     * @returns {Promise<number>}
     */
    public async getTestDelay(courseId: string): Promise<number | null> {
        if (typeof courseId !== "undefined" && courseId !== null) {
            if (courseId === "310") {
                return 12 * 60 * 60 * 1000; // 12h right now
            }
        }
        return null;
    }
}
