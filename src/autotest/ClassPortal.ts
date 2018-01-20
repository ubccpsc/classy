export interface IClassPortal {

    /**
     * For a given commitUrl, figure out what the default deliverable is at the current time.
     *
     * @param commitUrl
     */
    getDefaultDeliverableId(commitUrl: string): Promise<string | null>;

    /**
     * Is the user staff on the course.
     *
     * @param courseId
     * @param userName
     */
    isStaff(courseId: string, userName: string): Promise<boolean>;

    /**
     * Gets the delay period (in seconds) between AutoTest invocations.
     *
     * Currently assumes the delay is constant across all deliverables.
     *
     * @param courseId
     */
    getTestDelay(courseId: string): Promise<number>;
}

export class DummyClassPortal implements IClassPortal {

    public async isStaff(courseId: string, userName: string): Promise<boolean> {
        return userName.indexOf("a") >= 0; // TODO: implement
    }

    public async getDefaultDeliverableId(commitUrl: string): Promise<string | null> {
        return "d0"; // TODO: implement
    }

    public async getTestDelay(courseId: string): Promise<number> {
        return 60; // TODO: implement
    }
}
