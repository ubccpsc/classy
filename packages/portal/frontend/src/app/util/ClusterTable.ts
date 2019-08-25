import {DetailRow} from "../views/AdminDashboardTab"
import Config, {ConfigKey} from "../../../../../common/Config"

export class ClusterTable {

    private static clusters: {[key:string]:{[key2:string]: string[]}} = {
        "sample": {
            "ADD": ["A", "B", "C"],
            "REM": ["B", "C", "D"],
            "LIS": ["D", "E"],
            "LT": ["F", "G", "H", "I"],
            "GT": ["G", "H", "I", "J"],
            "EQ": ["H", "I"],
            "IS": ["H", "I", "J"],
            "WC": ["I", "J"],
            "AND": ["G", "I"],
            "OR": ["H", "J"],
            "NOT": ["J"],
            "VAL": ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"],
        }
    }

    public static shouldCluster(delivId: string) {
        return Config.getInstance().getProp(ConfigKey.cluster) && Object.keys(ClusterTable.clusters).includes(delivId);
    }

    public static generateTable(annotated: DetailRow[], delivId: string): string {
        const cellMap: {[key: string]: string} = {};
        for (const cell of annotated) {
            cellMap[cell.name] = '<td class="dashResultCell" style="width: 5px; height: 20px; background: ' + cell.colour + '" title="' + cell.name + '"></td>'
        }
        const clstrs: {[key:string]: string[]} = ClusterTable.clusters["sample"];
        let str = '<span><table style="height: 20px;">';
        for (const cluster of Object.keys(clstrs)) {
            str += '<tr>';
            str += '<td style="width: 2em; text-align: center;">' + cluster + '</td>';
            for (const test of clstrs[cluster]) {
                str += cellMap[test];
            }
            str += '</tr>';
        }
        str += '</table></span>';
        return str;
    }
}