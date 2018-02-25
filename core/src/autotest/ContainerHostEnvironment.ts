import {exec} from "child_process";
import * as fs from "fs-extra";
import * as net from "net";
import {Config} from "../Config";
import {ISocketServer} from "../server/SocketServer";
import {IFirewallChain} from "../util/FirewallChain";

export interface IContainerHostEnvironment {
    socketPort: number;
    tempDir: string;
    persistDir: string;
    firewall: IFirewallChain;
    getAutoTestIP(): Promise<string>;
    getAutoTestUID(): Promise<number>;
    getClientSocket(clientAddress: string): Promise<net.Socket>;
    acquireMACAddress(): string;
    releaseMACAddress(address: string): void;
    removeTempDir(): Promise<void>;
}

export class ContainerHostEnvironment implements IContainerHostEnvironment {
    private static hostIP: string;
    private static hostUID: number;

    private readonly socketServer: ISocketServer;
    private readonly _socketPort: number;
    private readonly _tempDir: string;
    private readonly _persistDir: string;
    private readonly _firewall: IFirewallChain;

    private readonly acquiredAddresses: Set<string>;

    constructor(socketServer: ISocketServer, firewallChain: IFirewallChain, tempDir: string, persistDir: string) {
        this.socketServer = socketServer;
        this._firewall = firewallChain;
        this._tempDir = tempDir;
        this._persistDir = persistDir;
        this._socketPort = socketServer.port;

        this.acquiredAddresses = new Set();
    }

    public get firewall(): IFirewallChain {
        return this._firewall;
    }

    public get tempDir(): string {
        return this._tempDir;
    }

    public get persistDir(): string {
        return this._persistDir;
    }

    public get socketPort(): number {
        return this._socketPort;
    }

    public async getAutoTestIP(): Promise<string> {
        if (typeof ContainerHostEnvironment.hostIP === "undefined") {
            ContainerHostEnvironment.hostIP = Config.getInstance().getProp("hostIP");
        }

        return ContainerHostEnvironment.hostIP;
    }

    public async getAutoTestUID(): Promise<number> {
        if (typeof ContainerHostEnvironment.hostUID === "undefined") {
            ContainerHostEnvironment.hostUID = await new Promise<number>((resolve, reject) => {
                exec("id --user", (error, stdout) => {
                    if (error) {
                        reject(error);
                    }
                    resolve(parseInt(stdout, 10));
                });
            });
        }

        return ContainerHostEnvironment.hostUID;
    }

    public async getClientSocket(clientAddress: string): Promise<net.Socket> {
        return this.socketServer.getSocket(clientAddress);
    }

    // public async ensureTempDir(): Promise<string> {
    //     await fs.ensureDir(this._tempDir);
    //     return this._tempDir;
    // }

    // public async ensurePersistDir(): Promise<string> {
    //     await fs.ensureDir(this._persistDir);
    //     return this._persistDir;
    // }

    public acquireMACAddress(): string {
        let candidateAddress: string;
        do {
            candidateAddress = "02:XX:XX:XX:XX:XX".replace(/X/g, () => {
                return "0123456789ABCDEF".charAt(Math.floor(Math.random() * 16));
              });
        } while (this.acquiredAddresses.has(candidateAddress));

        return candidateAddress;
    }

    public releaseMACAddress(address: string): void {
        this.acquiredAddresses.delete(address);
    }

    public async removeTempDir(): Promise<void> {
        return fs.remove(this._tempDir);
    }
}
