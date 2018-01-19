import {IContainerInput} from "../Types";

export class Queue {

    private data: IContainerInput[] = [];

    public push(info: IContainerInput) {
        this.data.push(info);
    }

    public pop(): IContainerInput | null {
        if (this.data.length > 0) {
            return this.data.shift();
        }
        return null;
    }

    public remove(commitUrl: string): IContainerInput | null {
        for (let i = 0; i < this.data.length; i++) {
            const info = this.data[i];
            if (info.pushInfo.commitURL === commitUrl) {
                this.data.splice(i, 1);
                return info;
            }
        }
        return null;
    }

    public indexOf(commitUrl: string): number {
        for (let i = 0; i < this.data.length; i++) {
            const info = this.data[i];
            if (info.pushInfo.commitURL === commitUrl) {
                return i;
            }
        }
        return -1;
    }

    public length(): number {
        return this.data.length;
    }
}
