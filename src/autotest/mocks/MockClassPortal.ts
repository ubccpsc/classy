import {IClassPortal} from "../ClassPortal";

export class MockClassPortal implements IClassPortal {

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

    public async getContainerDetails(courseId: string, delivId: string): Promise<{ dockerImage: string, dockerBuild: string, testDelay: number, regressionDelivNames: string[] } | null> {
        if (typeof courseId !== "undefined" && courseId !== null && typeof delivId !== "undefined" && delivId !== null) {
            if (courseId === "310") {
                return {dockerImage: "310container", dockerBuild: "d0build", testDelay: 100, regressionDelivNames: []};
            }
        }
        return null;
    }

    /*
        public async getTestDelay(courseId: string, delivId: string): Promise<number | null> {
            if (typeof courseId !== "undefined" && courseId !== null && typeof delivId !== "undefined" && delivId !== null) {
                if (courseId === "310") {
                    return 12 * 60 * 60 * 1000; // 12h right now
                }
            }
            return null;
        }
        */
}
