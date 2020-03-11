class DataHandler {
    constructor() {
        this.checkpoints = ["c1", "c2", "c3"];
        this.rawClassData = {
            "c1": {},
            "c2": {},
            "c3": {}
        };
        this.classData = {
            "c1": {},
            "c2": {},
            "c3": {}
        };
        this.testData = {};
        this.teamData = {
            "c1": {},
            "c2": {},
            "c3": {}
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
            this.makeAllTests();
            for (const check of this.checkpoints) {
                try {
                    this.addDisharmonyScores(this.rawClassData[check], this.disharmonyCSV);
                } catch (e) {
                    console.log("WARN: Adding disharmony scores failed, ignoring since it's not crucial")
                }
                this.classData[check] = this.fixMissingData(this.rawClassData[check].filter((x) => x.repoId.startsWith("project_")));
                this.testData[check] = this.makeTestData(check);
            }
        } catch(e) {
            Promise.reject(e);
        }
        return Promise.resolve("Loaded initial data with no errors")
    }

    async makeAllRequests() {
        const promises = [];
        for (const check of this.checkpoints) {
            const p = this.fetchFromClassyEndpoint(`/portal/admin/bestResults/${check}`).then((res) => {
                this.rawClassData[check] = res;
            });
            promises.push(p);
        }
        promises.push(this.fetchFromClassyEndpoint("/portal/admin/teams").then((res) => {
            this.teamsRaw = res;
        }));
        promises.push(this.fetchFromClassyEndpoint("/portal/admin/students").then((res) => {
            this.students = res;
        }));
        promises.push(this.fetchSimpleFile("/portal/resource/staff/clusters.json").then((res) => {
            this.clusters = JSON.parse(res);
        }).catch((err) => {
            console.log("WARN: Failed to get clusters from proper endpoint, was it deleted by IT?");
            const subPromises = []
            const p = this.fetchFromClassyEndpoint(`/portal/admin/gradedResults/${check}`).then((res) => {
                this.clusters[check] = this.hijackClusterFromResult(res);
            });
            subPromises.push(p);
            return Promise.all(subPromises);
        }));
        promises.push(this.fetchSimpleFile("/portal/resource/staff/disharmony.csv").then((res) => {
            this.disharmonyCSV = res;
        }).catch((err) => {
            console.log("WARN: Failed to get disharmony CSV, was it deleted by IT?");
            return Promise.resolve("Ignoring");
        }));
        return Promise.all(promises);
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

    async getBestFromTeam(checkpoint, team) {
        let best = this.getClassData(checkpoint).filter(x => x.repoId === team)[0];
        if (!best) {
            const data = await this.getTeamData(checkpoint, team);
            if (!!data && data.length !== 0) {
                best = data[0];
                for (const entry of data) {
                    if (entry.scoreOverall > best.scoreOverall) {
                        best = entry;
                    }
                }
            } else {
                return null;
            }
        }
        return best;
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

    getCheckpoints() {
        return this.checkpoints;
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
        for (const check of this.checkpoints) {
            let all = [];
            for (const cluster of Object.values(this.clusters[check])) {
                all = all.concat(cluster);
            }
            this.allTests[check] = Array.from(new Set(all));
        }
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
        const obj = {};
        for (const check of this.checkpoints) {
            obj[check] = this.reverseIndexCluster(check);
        }
        return obj;
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
