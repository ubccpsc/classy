import {Result} from './Types';
import {ClusteredResult, SingleClusterResult} from '../../../common/types/PortalTypes'

interface Cluster {
    [name: string]: string[] 
}

export class ClusterFormatter {
    private static clusters: {[key:string]: Cluster} = {
        "project": { // This applies to sample data from FrontendDatasetGenerator, clusters are nonsense
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

    public static isClusterable(result: Result) {
        return ClusterFormatter.clusters.hasOwnProperty(result.delivId);
    }

    public static getClusteredResult(result: Result): ClusteredResult {
        const cluster = ClusterFormatter.clusters[result.delivId];
        const clusteredResult: ClusteredResult = {};
        for (const clusterName in cluster) {
            clusteredResult[clusterName] = ClusterFormatter.makeSingleClusterRessult(cluster[clusterName], result);
        }
        return clusteredResult;
    }

    private static makeSingleClusterRessult(clusterTests: string[], result: Result): SingleClusterResult {
        return {
            allNames: clusterTests,
            passNames: result.output.report.passNames.filter((x)=>clusterTests.includes(x)),
            failNames: result.output.report.failNames.filter((x)=>clusterTests.includes(x)),
            skipNames: result.output.report.skipNames.filter((x)=>clusterTests.includes(x)),
            errorNames: result.output.report.passNames.filter((x)=>clusterTests.includes(x))
        }
    }
}