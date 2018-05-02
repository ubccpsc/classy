import * as net from "net";
import Log from "../../../common/Log";

/**
 * A simple socket server.
 */
export interface ISocketServer {
    port: number;
    isListening: boolean;

    /**
     * Returns the underlying socket to the specified client once they connect.
     * @param remoteAddress The IP address of the client connecting to the server.
     */
    getSocket(remoteAddress: string): Promise<net.Socket>;

    /**
     * Specify a callback function to be executed for a specified event on the given socket.
     * @param socket The socket for which to listen to events,
     * @param eventType The event to listen for.
     * @param listener A callback function that is executed when the specified event occurs. For an DATA event, args
     * will be the data that was sent by the client.
     */
    // registerSocketListener(socket: net.Socket, eventType: SocketEvent, listener: (...args: any[]) => void): number;

    /**
     * Start the socket server.
     */
    start(): Promise<void>;

    /**
     * Stop the socket server.
     */
    stop(): Promise<void>;

    /**
     * Removes the callback function from the list of functions that execute for a particular event on a socket.
     * @param id The number returned by registerSocketListener.
     */
    // unregisterSocketListener(id: number): void;
}

export class SocketServer implements ISocketServer {
    public readonly port: number;
    public isListening: boolean;
    private server: net.Server;
    private readonly waitingConnections: { [address: string]: (socket: net.Socket) => void };
    // private readonly openConnections: { [address: string]: net.Socket };

    constructor(port: number) {
        this.port = port;
        this.isListening = false;
        this.waitingConnections = {};
        // this.openConnections = {};
    }

    public async getSocket(address: string): Promise<net.Socket> {
        return new Promise<net.Socket>((resolve) => {
            this.waitingConnections[address] = resolve;
            // if (Object.keys(this.openConnections).includes(address)) {
            //     resolve(this.openConnections[address]);
            // } else {
            //     this.waitingConnections[address] = resolve;
            // }
        });
    }

    public async start(): Promise<void> {
        Log.info(`Server::start() - start`);
        return new Promise<void>((resolve, reject) => {
            this.server = net.createServer((socket) => {
                const startIPv4: number = socket.remoteAddress.lastIndexOf(":") + 1;
                const addr: string = socket.remoteAddress.substring(startIPv4);
                const cb = this.waitingConnections[addr];
                if (typeof cb !== "undefined") {
                    Log.trace(`SocketServer::start() - Client ${addr} has connected.`);
                    delete this.waitingConnections[addr];
                    socket.setEncoding("utf8");
                    cb(socket);
                } else {
                    Log.warn(`SocketServer::start() - Unexpected connection from ${addr}. Closing socket.`);
                    // this.openConnections[addr] = socket;
                    socket.end();
                }
            });

            this.server.on("error", (error) => {
                Log.error(`SocketServer::start() - ${error}`);
                reject(error);
            });

            this.server.on("listening", () => {
                this.isListening = true;
                Log.info(`SocketServer::start() - listening: ${this.server.address().address}:${this.server.address().port}`);
                resolve();
            });

            this.server.on("close", () => {
                Log.info(`SocketServer::start() - closed`);
            });

            this.server.listen(this.port, "172.28.2.0");
        });
    }

    public async stop(): Promise<void> {
        Log.info(`SocketServer::stop() - stop`);
        return new Promise<void>((resolve, reject) => {
            this.server.close(() => {
                this.isListening = false;
                resolve();
            });
        });
    }
}
