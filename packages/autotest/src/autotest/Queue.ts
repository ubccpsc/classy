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
            if (queued.target.commitURL === info.target.commitURL &&
                queued.target.delivId === info.target.delivId &&
                queued.target.ref === info.target.ref) {
                this.data.splice(i, 1);
                return info;
            }
        }
        return null;
    }

    /**
     * Replace the oldest item on the queue for a given person.
     *
     * NOTE: this will not replace any job that mentions the bot.
     * This is because users expect requests to the bot to run.
     *
     * @param {ContainerInput} info
     * @return {ContainerInput | null} the container input that was replaced, or null if no replacement occurred
     */
    public replaceOldestForPerson(info: ContainerInput, forceAdd: boolean): ContainerInput | null {
        let oldestIndex = -1;
        let oldestJob: ContainerInput | null = null;
        let oldestTime = Number.MAX_SAFE_INTEGER;
        for (let i = 0; i < this.data.length; i++) {
            const queued = this.data[i];
            if (queued.target?.personId === info.target?.personId) {
                // the right person
                if (queued.target?.botMentioned === false) {
                    // queued job was not put there by an explicit request
                    if (queued.target?.timestamp < oldestTime) {
                        // queued job is older than the oldest job
                        oldestIndex = i;
                        oldestJob = queued;
                        oldestTime = queued.target.timestamp;
                    }
                }
            }
        }

        if (oldestIndex >= 0) {
            if (info.target.timestamp < oldestJob.target.timestamp) {
                // if a job is older than the oldest job, just add it to the queue
                if (forceAdd === true) {
                    Log.info("Queue::replaceOldestForPerson( " + info.target.personId + " ) - queue: " + this.name +
                        "; job is older than the oldest job, adding to queue");
                    this.push(info);
                    return null;
                }
            } else {
                // replace the oldest job with the current job
                Log.info("Queue::replaceOldestForPerson( " + info.target.personId + " ) - queue: " + this.name +
                    "; replacing sha: " + Util.shaHuman(oldestJob.target.commitSHA) +
                    "; with sha: " + Util.shaHuman(info.target.commitSHA));
                this.data.splice(oldestIndex, 1, info);
                return oldestJob;
            }
        } else {
            // no jobs to replace, just add it to the queue
            if (forceAdd === true) {
                Log.info("Queue::replaceOldestForPerson( " + info.target.personId + " ) - queue: " + this.name +
                    "; no jobs to replace, adding to queue");
                this.push(info);
                return null;
            }
        }
        // if we haven't returned then the job is not on the queue
        return info;
    }

    /**
     * Returns the index of a given container where equality is
     * determined by identical <commitSHA, delivId, ref (branch)>.
     *
     * @param {ContainerInput} info
     * @returns {number} index of the provided SHA, or -1 if not present
     */
    public indexOf(info: ContainerInput): number {
        for (let i = 0; i < this.data.length; i++) {
            const queued = this.data[i];
            if (queued.target.commitURL === info.target.commitURL &&
                queued.target.delivId === info.target.delivId &&
                queued.target.ref === info.target.ref) {
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
     * job, this placement should not stop the requester from having
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
            // loading happens infrequently, do it synchronously
            const store = fs.readJSONSync(this.persistDir, {throws: false});
            if (store?.data?.length === undefined) {
                // read failed; skip hydrating
                Log.info("Queue::load() - rehydrating " + this.name + " skipped");
                return;
            }
            Log.info("Queue::load() - rehydrating: " + this.name + "; # data: " + store.data.length);

            // push all loaded executions on the end of the queue
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
