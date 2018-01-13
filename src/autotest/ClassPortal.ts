import Log from "../Log";

export interface IClassPortal {

    /**
     * For a given commitUrl, figure out what the default deliverable is at the current time.
     *
     * @param commitUrl
     */
    getDefaultDeliverableId(commitUrl: string): string; // Promise<string|null>

    /**
     * Is the user staff on the course.
     *
     * @param courseId
     * @param userName
     */
    isStaff(courseId: string, userName: string): boolean; // Promise<boolean>

    /**
     * Gets the delay period (in seconds) between AutoTest invocations.
     *
     * Currently assumes the delay is constant across all deliverables.
     *
     * @param courseId
     */
    getTestDelay(courseId: string): number; // Promise<number>
}

export class DummyClassPortal implements IClassPortal {
    public isStaff(courseId: string, userName: string): boolean {
        return userName.indexOf("a") >= 0;

    }

    public getDefaultDeliverableId(commitUrl: string): string {
        return "d0"; // TEST
    }

    public getTestDelay(courseId: string): number {
        return 60; // TEST
    }
}
