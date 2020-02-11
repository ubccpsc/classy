class BarChartUtils {

    constructor(colorConfig) {
        this.colors = colorConfig;
    }

    get MAGIC_SCALING_NUMBER() {return 85;}

    getTopFailedTests(num, data) {
        const failed = Object.entries(data.failCount).sort((a,b) => (b[1] - a[1]));
        const results = [];
        num = num <= failed.length ? num : failed.length;
    
        for (let i = 0 ; i < num; i++) {
            const name = failed[i][0];
            const fail = typeof failed[i][1] === 'undefined'? 0 : failed[i][1];
            const pass = typeof data.passCount[name] === 'undefined'? 0 : data.passCount[name];
            const skip = typeof data.skipCount[name] === 'undefined'? 0 : data.skipCount[name];
            const total = fail + pass + skip;
             results.push($.extend({
               testName: name,
               failed: this.scale(fail, total),
               passed: this.scale(pass, total),
               skipped: this.scale(skip, total),
               total: total
             }, this.colors));
        }
        return results;
    }
    
    getClusterStatusData(data, clusters) {
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
                tmp.failed += this.getClusterAddition('failCount', test, data);
                tmp.passed += this.getClusterAddition('passCount', test, data);
                tmp.skipped += this.getClusterAddition('skipCount', test, data);
            }
            tmp.total = tmp.failed + tmp.passed + tmp.skipped;
            tmp.failed = this.scale(tmp.failed, tmp.total); 
            tmp.passed = this.scale(tmp.passed, tmp.total);  
            tmp.skipped= this.scale(tmp.skipped, tmp.total); 
            results.push($.extend(tmp, this.colors));
        }
        return results.sort((a,b) => {return a.failed < b.failed});
    }
    
    scale(num, total) {
        if (total === 0 || typeof num === 'undefined') {
            return 0;
        } else {
            return this.MAGIC_SCALING_NUMBER * num / total;
        }
    }
    
    getClusterAddition(key, testName, testResults) {
        if (typeof testResults[key][testName] === 'undefined') {
            return 0;
        } else {
            return testResults[key][testName];
        }
    }
    
    // Make handlebars input for all commits for the team test history vis
    testHistory(teamHistory, allTests) {
        const comFail = {status: "commit failed", color:this.colors["nonColor"]};
        const fail = {status: "failed", color: this.colors["failColor"]};
        const pass = {status: "passed", color: this.colors["passColor"]};
        const skip = {status: "skipped", color: this.colors["skipColor"]};
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
    
    getClusterData(clusters, teamData) {
        const toReturn = [];
        for (const [cName, cTests] of Object.entries(clusters)) {
            const failSkip = teamData.testFail.concat(teamData.testSkip);
            const pass = teamData.testPass;
            const total = cTests.length;
            const passNum = cTests.filter(x => pass.includes(x)).length;
            const failNum = cTests.filter(x => failSkip.includes(x)).length;
            const passPctScaled = this.scale(passNum, total);
            const failPctScaled = this.scale(failNum, total);
            toReturn.push(
                {"clusterName": cName,
                "passed": passPctScaled,
                "failed": failPctScaled,
                "total": total,
                "passColor": this.colors["passColor"],
                "failColor": this.colors["failColor"]}
            );
        }
        return toReturn;
    }

    updateColors(newColors) {
        this.colors = newColors;
    }
}