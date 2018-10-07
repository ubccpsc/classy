export class ServerSentEvent {
    private readonly id: number;
    private readonly event: string;
    private readonly data: string;

    constructor(id: number, event: string, data: string) {
        this.id = id;
        this.event = event;
        this.data = data;
    }

    public toString(): string {
        return `event: ${this.event}\nid: ${this.id}\ndata:${this.data}`;
    }
}
