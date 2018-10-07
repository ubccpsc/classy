import {ContainerOutput} from "../../../common/types/ContainerTypes";

export interface ObservablePromise<T> extends Promise<T> {
    isFulfilled: boolean;
    isRejected: boolean;
    isPending: boolean;
}

export function makeObservablePromise<T>(promise: Promise<T>): ObservablePromise<T> {
    // Don't modify any promise that has been already modified.
    if ((promise as ObservablePromise<T>).isFulfilled) {
        return (promise as ObservablePromise<T>);
    }

    // Set initial state
    let isPending = true;
    let isRejected = false;
    let isFulfilled = false;

    // Observe the promise, saving the fulfillment in a closure scope.
    const result: any = promise.then(
        function(v) {
            isFulfilled = true;
            isPending = false;
            return v;
        },
        function(e) {
            isRejected = true;
            isPending = false;
            throw e;
        }
    );

    result.isFulfilled = function() { return isFulfilled; };
    result.isPending = function() { return isPending; };
    result.isRejected = function() { return isRejected; };
    return result;
}

// public getPendingResults(): Array<Promise<ContainerOutput>> {
//     const results: Array<Promise<ContainerOutput>> = [];
// for (const task of Object.values(this.tasks)) {
//     if (task.result.isPending) {
//         results.push(task.result);
//     }
// }
// return results;
// }
