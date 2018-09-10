import Log from "../../../common/Log";
import {IContainerInput} from "../../../common/types/AutoTestTypes";

export class Queue {

    private readonly numSlots: number = 1;
    private readonly name: string = '';

    private slots: IContainerInput[] = [];

    constructor(name: string, numSlots: number) {
        this.name = name;
        this.numSlots = numSlots;
    }

    private data: IContainerInput[] = [];

    public getName(): string {
        return this.name;
    }

    /**
     * Pushes on the end of the queue.
     *
     * returns the length of the array after the push.
     *
     * @param {IContainerInput} info
     * @returns {number}
     */
    public push(info: IContainerInput): number {
        return this.data.push(info); // end of queue
    }

    /**
     * Forces an item on the front of the queue.
     *
     * @param {IContainerInput} info
     * @returns {number}
     */
    public pushFirst(info: IContainerInput): number {
        return this.data.unshift(info); // start of queue
    }

    /**
     * Returns the first element from the queue.
     *
     * @returns {IContainerInput | null}
     */
    public pop(): IContainerInput | null {
        if (this.data.length > 0) {
            return this.data.shift();
        }
        return null;
    }

    /**
     * Removes an item from the queue;
     *
     * @param {string} commitURL
     * @returns {IContainerInput | null}
     */
    public remove(commitURL: string): IContainerInput | null {
        // for (let i = 0; i < this.data.length; i++) {
        for (let i = this.data.length - 1; i >= 0; i--) {
            // count down instead of up so we don't miss anything after a removal
            const info = this.data[i];
            if (info.pushInfo.commitURL === commitURL) {
                this.data.splice(i, 1);
                return info;
            }
        }
        return null;
    }

    public indexOf(commitURL: string): number {
        for (let i = 0; i < this.data.length; i++) {
            const info = this.data[i];
            if (info.pushInfo.commitURL === commitURL) {
                return i;
            }
        }
        return -1;
    }

    public length(): number {
        return this.data.length;
    }

    public isCommitExecuting(commitURL: string, delivId: string) {
        for (const execution of this.slots) {
            if (execution.pushInfo.commitURL === commitURL && execution.delivId === delivId) {
                return true;
            }
        }
        return false;
    }

    public clearExecution(commitURL: string, delivId: string): boolean {
        let removed = false;
        for (let i = this.slots.length - 1; i >= 0; i--) {
            const execution = this.slots[i];
            if (execution !== null) {
                if (execution.pushInfo.commitURL === commitURL && execution.delivId === delivId) {
                    // remove this one
                    const lenBefore = this.slots.length;
                    this.slots.splice(i, 1);
                    const lenAfter = this.slots.length;
                    Log.info('Queue::clearExecution( .., ' + delivId + ' ) - ' + this.getName() +
                        ' cleared; # before: ' + lenBefore + '; # after: ' + lenAfter + '; commitURL: ' + commitURL);
                    removed = true;
                }
            }
        }
        return removed;
    }

    /**
     * Returns true if there is capacity to execute an additional job.
     *
     * @returns {boolean}
     */
    public hasCapacity(): boolean {
        const hasCapacity = this.slots.length < this.numSlots;
        Log.info("Queue::hasCapacity() - " + this.getName() + "; capacity: " + hasCapacity);
        return hasCapacity;
    }

    public scheduleNext(): IContainerInput | null {
        if (this.data.length < 1) {
            throw new Error("Queue::scheduleNext() - " + this.getName() + " called without anything on the stack.");
        }
        const input = this.pop();
        this.slots.push(input);

        Log.info("Queue::scheduleNext() - " + this.getName() + " done; delivId: " +
            input.delivId + "; commitURL: " + input.pushInfo.commitURL);
        return input;
    }

}
