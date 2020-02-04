class DataHandler {
    constructor() {
        this.classData = null;
        this.testData = null;
        this.teamData = null;
        this.clusters = {}; // TODO WITH ENDPOINT
        this.inverseClusters = this.reverseIndexClusters();
    }
    
    async init() {
        try {
            await this.fetchFromClassyEndpoint("/portal/admin/students");
        } catch(e) {
            console.log(e);
        }
        return Promise.reject("TODO FIX");
    }

    async fetchFromClassyEndpoint(URI) {
        const url = "https://localhost:3000" + URI;
        const options = {
            headers: {
                'Content-Type': 'application/json',
                'user':         localStorage.user,
                'token':        localStorage.token
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

    getClassData(delivId) {
        return this.classData[delivId];
    }

    getTestData(delivId) {
        return this.testData[delivId];
    }

    getTeamData(team) {
        return this.teamData[team];
    }

    getTeamList() {
        return ["foo"]; // TODO ENDPOINT
    }
    getClusters(delivId) {
        return this.clusters[delivId];
    }

    getInverseClusters(delivId) {
        return this.inverseClusters[delivId];
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
}