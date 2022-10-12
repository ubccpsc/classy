import * as fs from "fs-extra";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {ContainerInput} from "@common/types/ContainerTypes";

export class Queue {

    private readonly name: string = '';

    // private slots: ContainerInput[] = [];
    private readonly persistDir: string;

    constructor(name: string) {
        Log.info("Queue::<init>( " + name + " )");
        this.name = name;
        // this.numSlots = numSlots;

        // almost certainly exists (contains all queue output), but quick to check
        fs.mkdirpSync(Config.getInstance().getProp(ConfigKey.persistDir) + '/queues');

        this.persistDir = Config.getInstance().getProp(ConfigKey.persistDir) + '/queues/' + this.name + '.json';
    }

    private data: ContainerInput[] = [];

    public getName(): string {
        return this.name;
    }

    /**
     * Pushes on the end of the queue, if it is not already present.
     *
     * Returns the length of the array after the push.
     *
     * @param {ContainerInput} input
     * @returns {number}
     */
    public push(input: ContainerInput): number {

        if (input?.target?.adminRequest === true) {
            // put admin requests on the front of the queue
            Log.info("Queue:push(..) - admin request; pushing to head of queue");
            this.pushFirst(input);
        } else {
            if (this.indexOf(input) < 0) {
                this.data.push(input); // end of queue
            } else {
                Log.info("Queue:push(..) - job already on queue: " + input.target.commitURL);
            }
        }

        return this.data.length;
    }

    /**
     * Forces an item on the front of the queue.
     *
     * @param {ContainerInput} info
     * @returns {number}
     */
    public pushFirst(info: ContainerInput): number {
        return this.data.unshift(info); // start of queue
    }

    /**
     * Removes the first element from the queue and returns it.
     *
     * @returns {ContainerInput | null}
     */
    public pop(): ContainerInput | null {
        if (this.data.length > 0) {
            return this.data.shift();
        }
        return null;
    }

    /**
     * Copies the first element from the queue but does not remove it.
     */
    public peek(): ContainerInput | null {
        if (this.data.length > 0) {
            return Object.assign({}, this.data[0]);
        }
        return null;
    }

    /**
     * Removes an item from the queue.
     *
     * @param {ContainerInput} info
     * @returns {ContainerInput | null} returns null if no job was removed
     */
    public remove(info: ContainerInput): ContainerInput | null {
        for (let i = this.data.length - 1; i >= 0; i--) {
            // count down instead of up so we don't miss anything after a removal
            const queued = this.data[i];
            if (queued.target.commitURL === info.target.commitURL && queued.target.delivId === info.target.delivId) {
                this.data.splice(i, 1);
                return info;
            }
        }
        return null;
    }

    /**
     * Returns the index of a given container.
     *
     * @param {ContainerInput} info
     * @returns {number} index of the provided SHA, or -1 if not present
     */
    public indexOf(info: ContainerInput): number {
        for (let i = 0; i < this.data.length; i++) {
            const queued = this.data[i];
            if (queued.target.commitURL === info.target.commitURL && queued.target.delivId === info.target.delivId) {
                return i;
            }
        }
        return -1;
    }

    /**
     * The number of elements waiting on the queue.
     */
    public length(): number {
        return this.data.length;
    }

    /**
     * Whether any jobs are waiting to execute.
     */
    public hasWaitingJobs(): boolean {
        return this.data.length > 0;
    }

    /**
     * Returns the number of queued jobs for a person.
     *
     * Does _NOT_ include executing jobs, as these could be placed
     * there by the scheduler, not by the requester (e.g., a standard
     * job could be placed on the express queue because there is a free
     * slot, this placement should not stop the requester from having
     * a future request be put on the express queue while the non-requested
     * one is evaluated).
     *
     * @param input
     */
    public numberJobsForPerson(input: ContainerInput): number {
        let count = 0;
        for (const job of this.data) {
            if (job.target?.personId === input.target?.personId) {
                if (input.target?.adminRequest === true) {
                    // admin requests shouldn't count towards repo totals
                } else {
                    count++;
                }
            }
        }
        // for (const job of this.slots) {
        //     if (job.target?.personId === input.target?.personId) {
        //         count++;
        //     }
        // }
        return count;
    }

    // /**
    //  * Returns whether a given SHA:deliv tuple is executing on the current queue.
    //  *
    //  * @param {ContainerInput} input
    //  * @returns {boolean} whether the commit/delivId tuple is executing on the current queue.
    //  */
    // public isCommitExecuting(input: ContainerInput): boolean {
    //     for (const execution of this.slots) {
    //         if (execution.target.commitURL === input.target.commitURL &&
    //             execution.delivId === input.target.delivId) {
    //             return true;
    //         }
    //     }
    //     return false;
    // }

    // /**
    //  * Returns whether a given SHA:deliv tuple is executing on the current queue;
    //  * if true, the job is also removed from its execution slot so another job
    //  * can be started.
    //  *
    //  * @param commitURL
    //  * @param delivId
    //  */
    // public clearExecution(commitURL: string, delivId: string): boolean {
    //     let removed = false;
    //     for (let i = this.slots.length - 1; i >= 0; i--) {
    //         const execution = this.slots[i];
    //         if (execution !== null) {
    //             if (execution.target.commitURL === commitURL && execution.delivId === delivId) {
    //                 // remove this one
    //                 const lenBefore = this.slots.length;
    //                 this.slots.splice(i, 1);
    //                 const lenAfter = this.slots.length;
    //                 Log.trace('Queue::clearExecution( .., ' + delivId + ' ) - ' + this.getName() +
    //                     ' cleared; # before: ' + lenBefore + '; # after: ' + lenAfter + '; commitURL: ' + commitURL);
    //                 removed = true;
    //             }
    //         }
    //     }
    //     return removed;
    // }

    // /**
    //  * Move the next job from the waiting queue to the execution queue.
    //  *
    //  * NOTE: this just updates the execution slots, it doesn't actually start the job processing!
    //  *
    //  * @returns {ContainerInput | null} returns the container that should start executing, or null if nothing is available
    //  */
    // public scheduleNext(): ContainerInput | null {
    //     if (this.data.length < 1) {
    //         throw new Error("Queue::scheduleNext() - " + this.getName() + " called without anything on the stack.");
    //     }
    //     const input = this.pop();
    //     this.slots.push(input);
    //
    //     Log.info("Queue::scheduleNext() - " + this.getName() + " done; delivId: " +
    //         input.delivId + "; repo: " + input.target.repoId);
    //     return input;
    // }

    // /**
    //  * @returns {number} the number of jobs currently scheduled to execute
    //  */
    // public numRunning(): number {
    //     return this.slots.length;
    // }

    public async persist(): Promise<boolean> {
        try {
            // Log.trace("Queue::persist() - saving: " + this.name + " to: " + this.persistDir +
            //     " # slots: " + this.slots.length + "; # data: " + this.data.length);

            // push current elements back onto the front of the stack
            const store = {data: this.data};
            await fs.writeJSON(this.persistDir, store);

            return true;
        } catch (err) {
            Log.error("Queue::persist() - ERROR: " + err.message);
            return false;
        }
    }

    public load() {
        try {
            // this happens so infrequently, we will do it synchronously
            const store = fs.readJSONSync(this.persistDir);
            // Log.info("Queue::load() - rehydrating: " + this.name + " from: " + this.persistDir);
            Log.info("Queue::load() - rehydrating: " +
                this.name + "; # slots: " + store.slots.length + "; # data: " + store.data.length);

            // put executions that were running but not done on the front of the queue
            for (const slot of store.slots) {
                Log.info("Queue::load() - queue: " + this.name +
                    "; add executing to HEAD; repo: " + slot.target.repoId + "; SHA: " + slot.target.commitSHA);
                this.pushFirst(slot); // add to the head of the queued list (if we are restarting this will always be true anyways)
            }

            // push all other planned executions to the end of the queue
            for (const data of store.data) {
                Log.info("Queue::load() - queue: " + this.name +
                    "; add queued to TAIL: " + data.target.commitURL);
                this.push(data); // add to the head of the queued list (if we are restarting this will always be true anyways)
            }
            // Log.info("Queue::load() - rehydrating: " + this.name + " - done");
        } catch (err) {
            // if anything happens just don't add to the queue
            Log.error("Queue::load() - ERROR rehydrating queue: " + err.message);
        }
    }
}
