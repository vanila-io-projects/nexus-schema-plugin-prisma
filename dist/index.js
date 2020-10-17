"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !exports.hasOwnProperty(p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
const colors_1 = require("./colors");
function ensureDepIsInstalled(depName) {
    try {
        require(depName);
    }
    catch (err) {
        if (err.code === 'MODULE_NOT_FOUND') {
            console.error(`${colors_1.colors.red('ERROR:')} ${colors_1.colors.green(depName)} must be installed as a dependency. Please run \`${colors_1.colors.green(`npm install ${depName}`)}\`.`);
            process.exit(1);
        }
        else {
            throw err;
        }
    }
}
ensureDepIsInstalled('@nexus/schema');
ensureDepIsInstalled('graphql');
ensureDepIsInstalled('@prisma/client');
__exportStar(require("./plugin"), exports);
//# sourceMappingURL=index.js.map