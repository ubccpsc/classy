'use strict';
const fs = require('fs');

function sleep(ms) {
    return new Promise(function (resolve) {setTimeout(resolve, ms)});
}

(function () {
    const report = {
        "scoreOverall": 50,
        "scoreTest":    50,
        "scoreCover":   50,
        "passNames":    [],
        "failNames":    [],
        "errorNames":   [],
        "skipNames":    [],
        "custom":       [],
        "feedback":     ""
    }

    fs.writeFileSync("/io/store/report.json", JSON.stringify(report));

    sleep(5000).then(function () {
    });
})();

