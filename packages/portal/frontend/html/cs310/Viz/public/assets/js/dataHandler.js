class DataHandler {
    constructor() {
        this.c1DataRaw = {};
        this.c2DataRaw = {};
        this.classData = {
            "c1": {},
            "c2": {}
        };
        this.testData = {};
        this.teamData = {
            "c1": {},
            "c2": {}
        };
        this.teamsRaw = [];
        this.teams = [];
        this.teamInfo = {};
        this.clusters = {};
        this.disharmonyCSV = "";
        this.allTests = {};
        this.inverseClusters = {};
    }
    
    async init() {
        try {
            await this.makeAllRequests();
            this.teams = this.teamsRaw.map((x) => x.id).filter((x) => x.startsWith("project_"));
            this.teamInfo = this.makeTeamMap();
            this.inverseClusters = this.reverseIndexClusters();
            this.addDisharmonyScores(this.c1DataRaw, this.disharmonyCSV);
            this.addDisharmonyScores(this.c2DataRaw, this.disharmonyCSV);
            this.classData["c1"] = this.fixMissingData(this.c1DataRaw.filter((x) => x.repoId.startsWith("project_")));
            this.classData["c2"] = this.fixMissingData(this.c2DataRaw.filter((x) => x.repoId.startsWith("project_")));
            this.makeAllTests();
            this.testData["c1"] = this.makeTestData("c1");
            this.testData["c2"] = this.makeTestData("c2");
        } catch(e) {
            Promise.reject(e);
        }
        return Promise.resolve("Loaded initial data with no errors")
    }

    async makeAllRequests() {
        const p1 = this.fetchFromClassyEndpoint("/portal/admin/bestResults/c1").then((res) => {
            this.c1DataRaw = res;
        });
        const p2 = this.fetchFromClassyEndpoint("/portal/admin/bestResults/c2").then((res) => {
            this.c2DataRaw = res;
        });
        const p3 = this.fetchFromClassyEndpoint("/portal/admin/teams").then((res) => {
            this.teamsRaw = res;
        });
        const p4 = this.fetchFromClassyEndpoint("/portal/admin/students").then((res) => {
            this.students = res
        });
        const p5 = this.fetchSimpleFile("/portal/resource/staff/clusters.json").then((res) => {
            this.clusters = JSON.parse(res);
        }).catch((err) => {
            console.log("WARN: Failed to get clusters from proper endpoint, was it deleted by IT?");
            const p5_1 = this.fetchFromClassyEndpoint("/portal/admin/gradedResults/c1").then((res) => {
                this.students = this.clusters["c1"] = this.hijackClusterFromResult(res);
            });
            const p5_2 = this.fetchFromClassyEndpoint("/portal/admin/gradedResults/c2").then((res) => {
                this.students = this.clusters["c2"] = this.hijackClusterFromResult(res);
            });
            return Promise.all([p5_1, p5_2]);
        });
        return Promise.all([p1, p2, p3, p4, p5]);
    }

    async fetchFromClassyEndpoint(URI) {
        const json = JSON.parse(await this.fetchSimpleFile(URI));
        if (typeof json.success !== 'undefined' && Array.isArray(json.success)) {
            return json.success;
        } else {
            throw json.failure; // Dunno why we do this but elsewhere in classy does it
        }
    }

    async fetchSimpleFile(URI) {
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
            return await response.text();
        } else {
            throw "Not a 200";
        }
    }

    makeTeamMap() {
        const CSIDToInfo = {};
        for (const student of this.students) {
            CSIDToInfo[student.id] = student;
        }
        const teamToMembers = {};
        for (const team of this.teamsRaw) {
            if (!team.id.startsWith("project_")) {
                continue;
            }
            teamToMembers[team.id] = team.people.map(x => CSIDToInfo[x]);
        };
        return teamToMembers;
    }

    addDisharmonyScores(classData, disharmonyCSV) {
        const DHMap = {};
        disharmonyCSV.split("\n").forEach((row) => {
            const r = row.split(","); // ["teamname", score]
            DHMap[r[0]] = r[1];
        });
        for (const team of classData) {
            if (DHMap.hasOwnProperty(team.repoId)) {
                team.disharmony = Number(DHMap[team.repoId]);
            } else {
                team.disharmony = 0;
            }
        }
    }

    fixMissingData(classData) {
        for (const item of classData) {
            item.num = Number(item.repoId.slice(-3));
            item.testPass = this.namesOnly(item.testPass);
            item.testFail = this.namesOnly(item.testFail);
            item.testSkip = this.namesOnly(item.testSkip);
            item.passCount = item.testPass.length;
            item.failCount = item.testFail.length;
            item.failCount = item.testSkip.length;
            item.loc = item.custom.hasOwnProperty("loc") ? item.custom.loc : -1;
            item.numTests = item.custom.hasOwnProperty("studentTestCount") ? item.custom.studentTestCount : -1;
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

    getTeamMemberInfo(teamId) {
        return this.teamInfo[teamId];
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