class DataHandler {
    constructor() {
        this.classData = {
            "c1": {},
            "c2": {}
        };
        this.testData = {};
        this.teamData = {
            "c1": {},
            "c2": {}
        };
        this.teams = [];
        this.clusters = {};
        this.allTests = {};
        this.inverseClusters = {};
    }
    
    async init() {
        try {
            const c1Data = await this.fetchFromClassyEndpoint("/portal/admin/bestResults/c1");
            const c2Data = await this.fetchFromClassyEndpoint("/portal/admin/bestResults/c2");
            this.teams = await this.fetchFromClassyEndpoint("/portal/admin/teams");
            this.teams = this.teams.map((x) => x.id).filter((x) => x.startsWith("project_"));
            this.clusters["c1"] = this.hijackClusterFromResult(await this.fetchFromClassyEndpoint("/portal/admin/gradedResults/c1"))
            this.clusters["c2"] = this.hijackClusterFromResult(await this.fetchFromClassyEndpoint("/portal/admin/gradedResults/c2"))
            this.inverseClusters = this.reverseIndexClusters(); // TODO move to constructor
            this.classData["c1"] = this.fixMissingData(c1Data);
            this.classData["c2"] = this.fixMissingData(c2Data);
            this.makeAllTests();
            this.testData["c1"] = this.makeTestData("c1");
            this.testData["c2"] = this.makeTestData("c2");
        } catch(e) {
            Promise.reject(e);
        }
        return Promise.resolve("Loaded initial data with no errors")
    }

    async fetchFromClassyEndpoint(URI) {
        const url = "https://cs310.students.cs.ubc.ca" + URI;
        const options = {
            headers: {
                'Content-Type': 'application/json',
                'user':         localStorage.user, // May need to replace if running locally
                'token':        localStorage.token // May need to replace if running locally
            }
        };
        const response = await fetch(url, options);
        if (response.status === 200) {
            const json = await response.json();
            if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
                return json.success;
            } else {
                throw json.failure;
            }
        } else {
            throw response.text();
        }
    }

    fixMissingData(classData) {
        for (const item of classData) {
            item.testPass = this.namesOnly(item.testPass);
            item.testFail = this.namesOnly(item.testFail);
            item.testSkip = this.namesOnly(item.testSkip);
            item.passCount = item.testPass.length;
            item.failCount = item.testFail.length;
            item.failCount = item.testSkip.length;
            item.loc = 0;
            item.numTests = 0;
        }
        return classData;
    }

    getClassData(delivId) {
        return this.classData[delivId];
    }

    getTestData(delivId) {
        return this.testData[delivId];
    }

    getAllTests(delivId) {
        return this.allTests[delivId];
    }

    async getTeamData(checkpoint, team) {
        if (!this.teamData.hasOwnProperty(team)) {
            let data = await this.fetchFromClassyEndpoint(`/portal/admin/dashboard/${checkpoint}/${team}`);
            data = data.sort((a,b) => {return a.timestamp - b.timestamp});
            this.teamData[checkpoint][team] = this.fixMissingData(data);
        }
        return this.teamData[checkpoint][team];
    }

    getTeamList() {
        return this.teams;
    }
    getClusters(delivId) {
        return this.clusters[delivId];
    }

    getInverseClusters(delivId) {
        return this.inverseClusters[delivId];
    }

    makeTestData(delivId) {
        const data = this.classData[delivId];
        const testRes = {"passCount": {}, "failCount": {}, "skipCount": {}};
        for (const test of this.allTests[delivId]) {
            testRes.passCount[test] = 0;
            testRes.failCount[test] = 0;
            testRes.skipCount[test] = 0;
        }
        for (const entry of data) {
            for (const test of entry.testPass) {
                testRes.passCount[test]++;
            }
            for (const test of entry.testFail) {
                testRes.failCount[test]++;
            }
            for (const test of entry.testSkip) {
                testRes.skipCount[test]++;
            }
        }
        return testRes;
    }

    makeAllTests() {
        let c1All = [];
        for (const cluster of Object.values(this.clusters["c1"])) {
            c1All = c1All.concat(cluster);
        }
        this.allTests["c1"] = Array.from(new Set(c1All));
        let c2All = [];
        for (const cluster of Object.values(this.clusters["c2"])) {
            c2All = c2All.concat(cluster);
        }
        this.allTests["c2"] = Array.from(new Set(c2All));
    }

    hijackClusterFromResult(data) {
        if (data.length === 0) {
            return {"none": []};
        } else {
            const clusters = data[0].cluster;
            const toReturn = {};
            for (const [cName, cVals] of Object.entries(clusters)) {
                toReturn[cName] = this.namesOnly(cVals.allNames);
            }
            return toReturn;
        }
    }

    reverseIndexClusters() {
        return {
            "c1": this.reverseIndexCluster("c1"),
            "c2": this.reverseIndexCluster("c2")
        }
    }

    // Makes a map from test name to all clusters it falls under
    reverseIndexCluster(delivId) {
        const final = {}
        for (const [cName, cTests] of Object.entries(this.getClusters(delivId))) {
            for(const test of cTests) {
                if (!final.hasOwnProperty(test)) {
                    final[test] = [];
                }
                final[test].push(cName);
            }
        }
        return final;
    }

    namesOnly(arr) {
        return arr.map((x) => {return x.split(":")[0]});
    }
}