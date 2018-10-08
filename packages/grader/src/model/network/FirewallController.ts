import {CommandResult, IFirewallRule} from "../../Types";
import { Command } from "../../util/Command";

export interface IFirewallController {
    appendRule(rule: IFirewallRule): Promise<CommandResult>;
    createChain(name: string): Promise<CommandResult>;
    deleteRule(rule: IFirewallRule): Promise<CommandResult>;
    flushChain(name: string): Promise<CommandResult>;
    insertRule(rule: IFirewallRule): Promise<CommandResult>;
    removeChain(name: string): Promise<CommandResult>;
}

export class FirewallController extends Command implements IFirewallController {

    constructor() {
        super("iptables");
    }

    public async appendRule(rule: IFirewallRule): Promise<CommandResult> {
        return this.manageRule("A", rule);
    }

    public async createChain(name: string): Promise<CommandResult> {
        const args: string[] = ["-N", name];
        return this.executeCommand(args, { uid: 0 });
    }

    public async deleteRule(rule: IFirewallRule): Promise<CommandResult> {
        return this.manageRule("D", rule);
    }

    public async flushChain(name: string): Promise<CommandResult> {
        const args: string[] = ["-F", name];
        return this.executeCommand(args, { uid: 0 });
    }

    public async insertRule(rule: IFirewallRule): Promise<CommandResult> {
        return this.manageRule("I", rule);
    }

    public async removeChain(name: string): Promise<CommandResult> {
        const args: string[] = ["-X", name];
        return this.executeCommand(args, { uid: 0 });
    }

    protected manageRule(op: "A"|"D"|"I", rule: IFirewallRule): Promise<CommandResult> {
        const args: string[] = [`-${op}`, rule.chain, "-j", rule.jump];

        for (const [opt, val] of Object.entries(rule)) {
            let invalidArg: boolean = false;
            switch (opt) {
                case "destination":
                    args.push("-d");
                    break;
                case "source":
                    args.push("-s");
                    break;
                case "protocol":
                    args.push("-p");
                    break;
                case "sport":
                    args.push("--sport");
                    break;
                case "dport":
                    args.push("--dport");
                    break;
                case "module":
                    args.push("-m");
                    break;
                case "state":
                    args.push("--result");
                    break;
                default:
                    invalidArg = true;
            }
            if (!invalidArg) {
                args.push(val);
            }
        }

        return this.executeCommand(args, { uid: 0 });
    }
}
