"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Util {
    static timeout(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    static took(start) {
        return Date.now() - start + " ms";
    }
}
exports.default = Util;
//# sourceMappingURL=Util.js.map