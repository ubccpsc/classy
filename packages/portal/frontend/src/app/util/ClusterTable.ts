import {DetailRow} from "../views/AdminDashboardTab"
import {ClusteredResult} from "../../../../../common/types/PortalTypes"
// import Config, {ConfigKey} from "../../../../../common/Config"
const CLUSTER = true; // Failed at putting this in config

export class ClusterTable {
    public static generateTable(annotated: DetailRow[], delivId: string, clusteredResult: ClusteredResult): string {
        const cellMap: {[key: string]: string} = {};
        for (const cell of annotated) {
            cellMap[cell.name] = '<td class="dashResultCell" style="width: 5px; height: 20px; background: ' + cell.colour + '" title="' + cell.name + '"></td>'
        }
        let str = '<span class="clusteredhistogram hidden""><table style="height: 20px;">';
        for (const cluster in clusteredResult) {
            str += '<tr>';
            str += '<td style="width: 2em; text-align: center;">' + cluster + '</td>';
            for (const test of clusteredResult[cluster].allNames) {
                str += cellMap[test];
            }
            str += '</tr>';
        }
        str += '</table></span>';
        return str;
    }
}