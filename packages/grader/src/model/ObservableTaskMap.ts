import {EventEmitter} from "events";
import {GradeTask} from "./GradeTask";

export class ObservableTaskMap extends EventEmitter implements Map<string, GradeTask> {
    private readonly tasks: Map<string, GradeTask>;

    constructor() {
        super();
        this.tasks = new Map<string, GradeTask>();
    }

    public readonly [Symbol.toStringTag]: "Map";
    public get size(): number {
        return this.tasks.size;
    }

    public [Symbol.iterator](): IterableIterator<[string, GradeTask]> {
        return this.tasks[Symbol.iterator]();
    }

    public clear(): void {
        this.emit("clear");
        return this.tasks.clear();
    }

    public delete(key: string): boolean {
        this.emit("delete", key);
        return this.tasks.delete(key);
    }

    public entries(): IterableIterator<[string, GradeTask]> {
        return this.tasks.entries();
    }

    public forEach(callbackfn: (value: GradeTask, key: string, map: Map<string, GradeTask>) => void, thisArg?: any): void {
        this.tasks.forEach(callbackfn, thisArg);
    }

    public get(key: string): GradeTask | undefined {
        return this.tasks.get(key);
    }

    public has(key: string): boolean {
        return this.tasks.has(key);
    }

    public keys(): IterableIterator<string> {
        return this.tasks.keys();
    }

    public set(key: string, value: GradeTask): any {
        this.emit("add", key);
        return this.tasks.set(key, value);
    }

    public values(): IterableIterator<GradeTask> {
        return this.tasks.values();
    }
}
