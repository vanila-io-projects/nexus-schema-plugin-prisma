"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.keys = exports.isEmptyObject = exports.getImportPathRelativeToOutput = exports.trimIfInNodeModules = exports.assertPrismaClientInContext = exports.dmmfFieldToNexusFieldConfig = exports.flatMap = exports.lowerFirst = exports.upperFirst = exports.indexBy = exports.hardWriteFileSync = exports.hardWriteFile = exports.dump = void 0;
const fs = __importStar(require("fs-jetpack"));
const path = __importStar(require("path"));
const util_1 = require("util");
function dump(x) {
    console.log(util_1.inspect(x, { depth: 20 }));
}
exports.dump = dump;
/**
 * Write file contents but first delete the file off disk if present. This is a
 * useful function when the effect of file delete is needed to trigger some file
 * watch/refresh mechanism, such as is the case with VSCode TS declaration files
 * inside `@types/` packages.
 *
 * For more details that motivated this utility refer to the originating issue
 * https://github.com/graphql-nexus/nexus-plugin-prisma/issues/453.
 */
exports.hardWriteFile = (filePath, data) => fs
    .removeAsync(filePath)
    .catch((error) => {
    return error.code === 'ENOENT' ? Promise.resolve() : Promise.reject(error);
})
    .then(() => fs.writeAsync(filePath, data));
/**
 * Write file contents but first delete the file off disk if present. This is a
 * useful function when the effect of file delete is needed to trigger some file
 * watch/refresh mechanism, such as is the case with VSCode TS declaration files
 * inside `@types/` packages.
 *
 * For more details that motivated this utility refer to the originating issue
 * https://github.com/graphql-nexus/nexus-plugin-prisma/issues/453.
 */
exports.hardWriteFileSync = (filePath, data) => {
    try {
        fs.remove(filePath);
    }
    catch (error) {
        if (error.code !== 'ENOENT')
            throw error;
    }
    fs.write(filePath, data);
};
// TODO `any` should be `unknown` but there is a bug (?)
// preventing that from working, see:
// https://github.com/microsoft/TypeScript/issues/33521
// https://stackoverflow.com/questions/58030413/calculate-union-type-of-key-names-in-object-whose-values-are-indexable
/**
 * TODO
 */
exports.indexBy = (xs, indexer) => {
    const seed = {};
    if (typeof indexer === 'function') {
        return xs.reduce((index, x) => {
            const address = indexer(x);
            index[address] = x;
            return index;
        }, seed);
    }
    else {
        return xs.reduce((index, x) => {
            const address = x[indexer];
            index[address] = x;
            return index;
        }, seed);
    }
};
exports.upperFirst = (s) => {
    return s.replace(/^\w/, (c) => c.toUpperCase());
};
function lowerFirst(s) {
    if (s.length === 0)
        return s;
    return s[0].toLowerCase() + s.slice(1);
}
exports.lowerFirst = lowerFirst;
function flatMap(array, callbackfn) {
    return Array.prototype.concat(...array.map(callbackfn));
}
exports.flatMap = flatMap;
function dmmfFieldToNexusFieldConfig(param) {
    return {
        type: param.type,
        list: param.isList ? [true] : undefined,
        nullable: !param.isRequired,
    };
}
exports.dmmfFieldToNexusFieldConfig = dmmfFieldToNexusFieldConfig;
function assertPrismaClientInContext(prismaClient) {
    if (!prismaClient) {
        throw new Error('Could not find Prisma Client JS in context (ctx.prisma)');
    }
}
exports.assertPrismaClientInContext = assertPrismaClientInContext;
function trimIfInNodeModules(path) {
    if (path.includes('node_modules')) {
        return path.substring(path.lastIndexOf('node_modules') + 'node_modules'.length + 1);
    }
    return path;
}
exports.trimIfInNodeModules = trimIfInNodeModules;
function getImportPathRelativeToOutput(from, to) {
    if (to.includes('node_modules')) {
        return trimIfInNodeModules(to);
    }
    let relativePath = path.relative(from, to);
    if (!relativePath.startsWith('.')) {
        relativePath = './' + relativePath;
    }
    // remove .ts or .js file extension
    relativePath = relativePath.replace(/\.(ts|js)$/, '');
    // remove /index
    relativePath = relativePath.replace(/\/index$/, '');
    // replace \ with /
    relativePath = relativePath.replace(/\\/g, '/');
    return relativePath;
}
exports.getImportPathRelativeToOutput = getImportPathRelativeToOutput;
exports.isEmptyObject = (o) => util_1.isDeepStrictEqual(o, {});
function keys(a) {
    return Object.keys(a);
}
exports.keys = keys;
//# sourceMappingURL=utils.js.map