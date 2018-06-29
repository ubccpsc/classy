import {IContainerInput} from "../Types";

export class Queue {

    private data: IContainerInput[] = [];

    /**
     * returns the length of the array after the push.
     *
     * @param {IContainerInput} info
     * @returns {number}
     */
    public push(info: IContainerInput): number {
        return this.data.push(info);
    }

    public pop(): IContainerInput | null {
        if (this.data.length > 0) {
            return this.data.shift();
        }
        return null;
    }

    public remove(commitURL: string): IContainerInput | null {
        for (let i = 0; i < this.data.length; i++) {
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
}
