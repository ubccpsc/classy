import Deliverable from "./Deliverable";

import D0 from "./D0";

export default class DeliverableFactory {

    public static getDeliverable(deliv: string): Deliverable {
        switch (deliv) {
            case "d0":
                return new D0();
            default:
                throw new Error(`Invalid deliverable specified.`);
        }
    }
}
