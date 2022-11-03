import * as fs from "fs-extra";

import Config, {ConfigKey} from "@common/Config";
import Log from "@common/Log";
import {ContainerInput} from "@common/types/ContainerTypes";
import Util from "@common/Util";

export class Queue {

    private readonly name: string = "";
    private readonly persistDir: string;

    constructor(name: string) {
        Log.trace("Queue::<init>( " + name + " )");
        this.name = name;

        // almost certainly exists (contains all queue output), but quick to check
        fs.mkdirpSync(Config.getInstance().getProp(ConfigKey.persistDir) + "/queues");

        this.persistDir = Config.getInstance().getProp(ConfigKey.persistDir) + "/queues/" + this.name + ".json";
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
            // count down instead of up so we do not miss anything after a removal
            const queued = this.data[i];
            if (queued.target.commitURL === info.target.commitURL && queued.target.delivId === info.target.delivId) {
                this.data.splice(i, 1);
                return info;
            }
        }
        return null;
    }

    /**
     * Returns the index of a given container where equality is
     * determined by identical <commitSHA, delivId>.
     *
     * @param {ContainerInput} info
     * @returns {number} index of the provided SHA, or -1 if not present
     */
    public indexOf(info: ContainerInput): number {
        for (let i = 0; i < this.data.length; i++) {
            const queued = this.data[i];
            if (queued.target.commitSHA === info.target.commitSHA &&
                queued.target.delivId === info.target.delivId) {
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
                    // admin requests should not count towards repo totals
                } else {
                    count++;
                }
            }
        }

        if (count > 1 || input.target?.adminRequest === true) {
            Log.info("Queue::numberJobsForPerson( " + input.target?.personId + " ) - queue: " + this.name +
                "; isAdmin: " + input.target?.adminRequest + "; count: " + count);
        } else {
            // skip reporting the usual case
            Log.trace("Queue::numberJobsForPerson( " + input.target?.personId + " ) - queue: " + this.name +
                "; isAdmin: " + input.target?.adminRequest + "; count: " + count);
        }

        return count;
    }

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
            const store = fs.readJSONSync(this.persistDir, {throws: false});
            if (store?.slots?.length === undefined) {
                // read failed; skip hydrating
                Log.info("Queue::load() - rehydrating: " + this.name + " skipped");
                return;
            }
            // Log.info("Queue::load() - rehydrating: " + this.name + " from: " + this.persistDir);
            Log.info("Queue::load() - rehydrating: " +
                this.name + "; # slots: " + store.slots.length + "; # data: " + store.data.length);

            // put executions that were running but not done on the front of the queue
            for (const slot of store.slots) {
                Log.info("Queue::load() - queue: " + this.name +
                    "; add executing to HEAD; repo: " + slot.target.repoId + "; SHA: " + Util.shaHuman(slot.target.commitSHA));
                this.pushFirst(slot); // add to the head of the queued list (if we are restarting this will always be true)
            }

            // push all remaining executions to the end of the queue
            for (const data of store.data) {
                Log.info("Queue::load() - queue: " + this.name +
                    "; add queued to TAIL: " + Util.shaHuman(data.target.commitSHA));
                this.push(data); // add to the head of the queued list (if we are restarting this will always be true)
            }
            // Log.info("Queue::load() - rehydrating: " + this.name + " - done");
        } catch (err) {
            // if anything happens just do not add to the queue
            Log.error("Queue::load() - ERROR rehydrating queue: " + err.message);
        }
    }
}
