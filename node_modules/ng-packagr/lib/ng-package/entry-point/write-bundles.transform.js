"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeBundlesTransform = void 0;
const transform_1 = require("../../graph/transform");
const nodes_1 = require("../nodes");
const log = require("../../utils/log");
const array_1 = require("../../utils/array");
const downlevel_plugin_1 = require("../../flatten/downlevel-plugin");
const rollup_1 = require("../../flatten/rollup");
const uglify_1 = require("../../flatten/uglify");
exports.writeBundlesTransform = transform_1.transformFromPromise((graph) => __awaiter(void 0, void 0, void 0, function* () {
    const entryPoint = graph.find(nodes_1.isEntryPointInProgress());
    const { destinationFiles, entryPoint: ngEntryPoint, tsConfig } = entryPoint.data;
    const cache = entryPoint.cache;
    // Add UMD module IDs for dependencies
    const dependencyUmdIds = entryPoint
        .filter(nodes_1.isEntryPoint)
        .map(ep => ep.data.entryPoint)
        .reduce((prev, ep) => {
        prev[ep.moduleId] = ep.umdId;
        return prev;
    }, {});
    const { fesm2015, esm2015, umd, umdMinified } = destinationFiles;
    const opts = {
        sourceRoot: tsConfig.options.sourceRoot,
        amd: { id: ngEntryPoint.amdId },
        umdModuleIds: Object.assign(Object.assign({}, ngEntryPoint.umdModuleIds), dependencyUmdIds),
        entry: esm2015,
        dependencyList: getDependencyListForGraph(graph),
    };
    log.info('Bundling to FESM2015');
    cache.rollupFESMCache = yield rollup_1.rollupBundleFile(Object.assign(Object.assign({}, opts), { moduleName: ngEntryPoint.moduleId, format: 'es', dest: fesm2015, cache: cache.rollupFESMCache }));
    log.info('Bundling to UMD');
    cache.rollupUMDCache = yield rollup_1.rollupBundleFile(Object.assign(Object.assign({}, opts), { moduleName: ngEntryPoint.umdId, entry: esm2015, format: 'umd', dest: umd, cache: cache.rollupUMDCache, transform: downlevel_plugin_1.downlevelCodeWithTsc }));
    log.info('Minifying UMD bundle');
    yield uglify_1.minifyJsFile(umd, umdMinified);
}));
/** Get all list of dependencies for the entire 'BuildGraph' */
function getDependencyListForGraph(graph) {
    // We need to do this because if A dependency on bundled B
    // And A has a secondary entry point A/1 we want only to bundle B if it's used.
    // Also if A/1 depends on A we don't want to bundle A thus we mark this a dependency.
    const dependencyList = {
        dependencies: [],
        bundledDependencies: [],
    };
    for (const entry of graph.filter(nodes_1.isEntryPoint)) {
        const { bundledDependencies = [], dependencies = {}, peerDependencies = {} } = entry.data.entryPoint.packageJson;
        dependencyList.bundledDependencies = array_1.unique(dependencyList.bundledDependencies.concat(bundledDependencies));
        dependencyList.dependencies = array_1.unique(dependencyList.dependencies.concat(Object.keys(dependencies), Object.keys(peerDependencies), entry.data.entryPoint.moduleId));
    }
    if (dependencyList.bundledDependencies.length) {
        log.warn(`Inlining of 'bundledDependencies' has been deprecated in version 5 and will be removed in future versions.` +
            '\n' +
            `List the dependency in the 'peerDependencies' section instead.`);
    }
    return dependencyList;
}
//# sourceMappingURL=write-bundles.transform.js.map