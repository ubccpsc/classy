'use strict';

const maxLineno = 10;
var lineno = 1;

const emitter = function (lineno) {
    console.log("line", lineno);

    if (lineno < maxLineno) {
        lineno += 1;
        setTimeout(function () { emitter(lineno); }, 100);
    }
};

setTimeout(function () { emitter(lineno); }, 100);
