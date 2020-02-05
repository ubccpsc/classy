class BarChartUtils {

    constructor() {}

    static get MAGIC_SCALING_NUMBER() {return 85;}

    static getTopFailedTests(num, data) {
        const failed = Object.entries(data.failCount).sort((a,b) => (b[1] - a[1]));
        const results = [];
        num = num <= failed.length ? num : failed.length;
    
        for (let i = 0 ; i < num; i++) {
            const name = failed[i][0];
            const fail = typeof failed[i][1] === 'undefined'? 0 : failed[i][1];
            const pass = typeof data.passCount[name] === 'undefined'? 0 : data.passCount[name];
            const skip = typeof data.skipCount[name] === 'undefined'? 0 : data.skipCount[name];
            const total = fail + pass + skip;
             results.push({
               testName: name,
               failed: BarChartUtils.scale(fail, total),
               passed: BarChartUtils.scale(pass, total),
               skipped: BarChartUtils.scale(skip, total),
               total: total
             });
        }
        return results;
    }
    
    static getClusterStatusData(data, clusters) {
        const results = [];
        for (const cluster in clusters) {
            const tmp = {
                clusterName: cluster,
                failed: 0,
                passed: 0,
                skipped: 0,
                total: 0
            };
            for (const test of clusters[cluster]) {
                tmp.failed += BarChartUtils.getClusterAddition('failCount', test, data);
                tmp.passed += BarChartUtils.getClusterAddition('passCount', test, data);
                tmp.skipped += BarChartUtils.getClusterAddition('skipCount', test, data);
            }
            tmp.total = tmp.failed + tmp.passed + tmp.skipped;
            tmp.failed = BarChartUtils.scale(tmp.failed, tmp.total); 
            tmp.passed = BarChartUtils.scale(tmp.passed, tmp.total);  
            tmp.skipped= BarChartUtils.scale(tmp.skipped, tmp.total); 
            results.push(tmp);
        }
        return results.sort((a,b) => {return a.failed < b.failed});
    }
    
    static scale(num, total) {
        if (total === 0 || typeof num === 'undefined') {
            return 0;
        } else {
            return BarChartUtils.MAGIC_SCALING_NUMBER * num / total;
        }
    }
    
    static getClusterAddition(key, testName, testResults) {
        if (typeof testResults[key][testName] === 'undefined') {
            return 0;
        } else {
            return testResults[key][testName];
        }
    }
    
    // Make handlebars input for all commits for the team test history vis
    static testHistory(teamHistory, allTests) {
        const comFail = {status: "commit failed", color:"#dddddd"};
        const fail = {status: "failed", color:"#fc8d62"};
        const pass = {status: "passed", color:"#66c2a5"};
        const skip = {status: "skipped", color:"#8da0cb"};
        const testObjs = [];
        for (const test of allTests) {
            const testObj = {"testName": test, "entries": []}
            for (let i = 0; i < teamHistory.length; i++) {
                const commit = teamHistory[i];
                const mark = {"href": commit.commitURL, "index": i}
                if (commit.state !== "SUCCESS") {
                    $.extend(mark, comFail);
                } else if (commit.testPass.includes(test)) {
                    $.extend(mark, pass);
                } else if (commit.testFail.includes(test)) {
                    $.extend(mark, fail);
                } else if (commit.testSkip.includes(test)) {
                    $.extend(mark, skip);
                } else if (commit.testError.includes(test)) {
                    console.log("Unexpected testError"); // Not targetting D3
                } else {
                    $.extend(mark, fail); // Somehow nothing ran but bot returning SUCCESS, treat as fail
                }
                testObj.entries.push(mark);
            }
            testObjs.push(testObj);
        }
        return testObjs;   
    }
    
    static getClusterData(clusters, teamData) {
        const toReturn = [];
        for (const [cName, cTests] of Object.entries(clusters)) {
            const failSkip = teamData.testFail.concat(teamData.testSkip);
            const pass = teamData.testPass;
            const total = cTests.length;
            const passNum = cTests.filter(x => pass.includes(x)).length;
            const failNum = cTests.filter(x => failSkip.includes(x)).length;
            const passPctScaled = BarChartUtils.scale(passNum, total);
            const failPctScaled = BarChartUtils.scale(failNum, total);
            if (passPctScaled + failPctScaled !== 0) {
                toReturn.push({"clusterName": cName,  "passed": passPctScaled, "failed": failPctScaled, "total": total});
            } else { // Build failed, no tests ran, treat as failed
                toReturn.push({"clusterName": cName,  "passed": passPctScaled, "failed": BarChartUtils.scale(1,1), "total": total});
            }
            
        }
        return toReturn;
    }
}