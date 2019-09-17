import * as fs from "fs-extra";
import Config, {ConfigKey} from "../../../common/Config";

import Log from "../../../common/Log";
import {ContainerInput} from "../../../common/types/ContainerTypes";

export class Queue {

    private readonly numSlots: number = 1;
    private readonly name: string = '';

    private slots: ContainerInput[] = [];
    private readonly persistDir: string;

    constructor(name: string, numSlots: number) {
        Log.info("[PTEST] Queue::<init>( " + name + ", " + numSlots + " )");
        this.name = name;
        this.numSlots = numSlots;

        // almost certainly exists (contains all queue output), but quick to check
        fs.mkdirpSync(Config.getInstance().getProp(ConfigKey.persistDir) + '/queues');

        this.persistDir = Config.getInstance().getProp(ConfigKey.persistDir) + '/queues/' + this.name + '.json';
    }

    private data: ContainerInput[] = [];

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
    public push(info: ContainerInput): number {
        return this.data.push(info); // end of queue
    }

    /**
     * Forces an item on the front of the queue.
     *
     * @param {IContainerInput} info
     * @returns {number}
     */
    public pushFirst(info: ContainerInput): number {
        return this.data.unshift(info); // start of queue
    }

    /**
     * Returns the first element from the queue.
     *
     * @returns {IContainerInput | null}
     */
    public pop(): ContainerInput | null {
        if (this.data.length > 0) {
            return this.data.shift();
        }
        return null;
    }

    public peek(): ContainerInput | null {
        if (this.data.length > 0) {
            return Object.assign({}, this.data[0]);
        }
        return null;
    }

    /**
     * Removes an item from the queue;
     *
     * @param {string} commitURL
     * @returns {IContainerInput | null}
     */
    public remove(commitURL: string): ContainerInput | null {
        // for (let i = 0; i < this.data.length; i++) {
        for (let i = this.data.length - 1; i >= 0; i--) {
            // count down instead of up so we don't miss anything after a removal
            const info = this.data[i];
            if (info.target.commitURL === commitURL) {
                this.data.splice(i, 1);
                return info;
            }
        }
        return null;
    }

    /**
     * Removes an item from the queue given key values to match in info.target;
     *
     * @returns {ContainerInput | null}
     * @param keys
     */
    public removeGivenKeys(keys: Array<{key: string, value: any}>): ContainerInput | null {
        for (let i = this.data.length - 1; i >= 0; i--) {
            const info: ContainerInput = this.data[i];
            if (keys.every((kv) => (info.target as any)[kv.key] === kv.value)) {
                this.data.splice(i, 1);
                return info;
            }
        }
        return null;
    }

    public sort(key: string) {
        this.data.sort((a: ContainerInput, b: ContainerInput) => {
            if ((a.target as any)[key] < (b.target as any)[key]) {
                return -1;
            } else if ((a.target as any)[key] > (b.target as any)[key]) {
                return 1;
            } else {
                return 0;
            }
        });
    }

    public indexOf(commitURL: string): number {
        for (let i = 0; i < this.data.length; i++) {
            const info = this.data[i];
            if (info.target.commitURL === commitURL) {
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
            if (execution.target.commitURL === commitURL && execution.delivId === delivId) {
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
                if (execution.target.commitURL === commitURL && execution.delivId === delivId) {
                    // remove this one
                    const lenBefore = this.slots.length;
                    this.slots.splice(i, 1);
                    const lenAfter = this.slots.length;
                    Log.trace('Queue::clearExecution( .., ' + delivId + ' ) - ' + this.getName() +
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
        Log.trace("Queue::hasCapacity() - " + this.getName() + "; capacity: " + hasCapacity);
        return hasCapacity;
    }

    public scheduleNext(): ContainerInput | null {
        if (this.data.length < 1) {
            throw new Error("Queue::scheduleNext() - " + this.getName() + " called without anything on the stack.");
        }
        const input = this.pop();
        this.slots.push(input);

        Log.info("Queue::scheduleNext() - " + this.getName() + " done; delivId: " +
            input.delivId + "; commitURL: " + input.target.commitURL);
        return input;
    }

    public numRunning(): number {
        return this.slots.length;
    }

    public async persist(): Promise<boolean> {
        try {
            Log.trace("[PTEST] Queue::persist() - saving: " + this.name + " to: " + this.persistDir +
                " # slots: " + this.slots.length + "; # data: " + this.data.length);

            // push current elements back onto the front of the stack
            const store = {slots: this.slots, data: this.data};
            await fs.writeJSON(this.persistDir, store);

            return true;
        } catch (err) {
            Log.error("[PTEST] Queue::persist() - ERROR: " + err.message);
            return false;
        }
    }

    public load() {
        try {
            // this happens so infrequently, we will do it synchronously
            const store = fs.readJSONSync(this.persistDir);
            Log.info("[PTEST] Queue::load() - rehydrating: " + this.name + " from: " + this.persistDir);
            Log.info("[PTEST] Queue::load() - rehydrating: " +
                this.name + "; # slots: " + store.slots.length + "; # data: " + store.data.length);

            // put executions that were running but not done on the front of the queue
            for (const slot of store.slots) {
                Log.info("[PTEST] Queue::load() - queue: " + this.name +
                    "; add executing to HEAD: " + slot.target.commitURL);
                this.pushFirst(slot); // add to the head of the queued list (if we are restarting this will always be true anyways)
            }

            // push all other planned executions to the end of the queue
            for (const data of store.data) {
                Log.info("[PTEST] Queue::load() - queue: " + this.name +
                    "; add queued to TAIL: " + data.target.commitURL);
                this.push(data); // add to the head of the queued list (if we are restarting this will always be true anyways)
            }
            Log.info("[PTEST] Queue::load() - rehydrating: " + this.name + " - done");
        } catch (err) {
            // if anything happens just don't add to the queue
            Log.error("[PTEST] Queue::load() - ERROR rehydrating queue: " + err.message);
        }
    }
}
