import { IFirewallRule } from "../Types";
import { IFirewallController } from "./FirewallController";

// wrapper for FirewallController that maintains the container's chain state
export interface IContainerFirewall {
    unblock(host: string, port?: number): Promise<void>;
    delete(): Promise<void>;
}

export class ContainerFirewall implements IContainerFirewall {
    private readonly chain: string;
    private readonly addr: string;
    private readonly fwCtrl: IFirewallController;
    private hasChain: boolean;
    private appliedRules: IFirewallRule[];

    constructor(id: string, addr: string, firewallController: IFirewallController) {
        this.chain = id;
        this.addr = addr;
        this.fwCtrl = firewallController;
        this.hasChain = false;
        this.appliedRules = [];
    }

    public async unblock(host: string, port?: number): Promise<void> {
        const rule: IFirewallRule = { chain: this.chain, jump: "ACCEPT", destination: host };
        if (port > 0) {
            rule["protocol"] = "tcp";
            rule["dport"] = port;
        }
        if (!this.hasChain) {
            await this.initChain();
        }
        await this.fwCtrl.appendRule(rule);
        this.appliedRules.push(rule);
    }

    public async delete(): Promise<void> {
        await this.fwCtrl.flushChain(this.chain);
        await this.fwCtrl.removeChain(this.chain);
    }

    protected async initChain(): Promise<void> {
        const forwardToChain: IFirewallRule = { chain: "FORWARD", source: this.addr, jump: this.chain };
        // TODO do I need tcp versions as well? Can these be simplified?
        const dnsRules: IFirewallRule[] = [
            {chain: this.chain, jump: "ACCEPT", protocol: "udp", dport: 53, module: "state", state: "NEW,ESTABLISHED"},
            {chain: this.chain, jump: "ACCEPT", protocol: "udp", sport: 53, module: "state", state: "ESTABLISHED"},
        ];
        await this.fwCtrl.createChain(this.chain);
        await this.fwCtrl.insertRule(forwardToChain);
        for (const rule of dnsRules) {
            await this.fwCtrl.insertRule(rule);
        }
    }
}
