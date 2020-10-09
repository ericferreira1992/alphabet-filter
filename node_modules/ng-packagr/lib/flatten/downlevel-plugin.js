"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.downlevelCodeWithTsc = void 0;
const typescript_1 = require("typescript");
const path = require("path");
const log = require("../utils/log");
/**
 * Base `tsc` `CompilerOptions` shared among various downleveling methods.
 */
const COMPILER_OPTIONS = {
    target: typescript_1.ScriptTarget.ES5,
    module: typescript_1.ModuleKind.ES2015,
    allowJs: true,
    sourceMap: true,
    importHelpers: true,
    downlevelIteration: true,
    moduleResolution: typescript_1.ModuleResolutionKind.Classic,
};
/**
 * Downlevels a .js file from `ES2015` to `ES5`. Internally, uses `tsc`.
 *
 * Required for some external as they contains `ES2015` syntax such as `const` and `let`
 */
function downlevelCodeWithTsc(code, filePath) {
    log.debug(`tsc ${filePath}`);
    const compilerOptions = Object.assign(Object.assign({}, COMPILER_OPTIONS), { mapRoot: path.dirname(filePath) });
    const { outputText, sourceMapText } = typescript_1.transpileModule(code, {
        compilerOptions,
    });
    return {
        code: outputText,
        map: JSON.parse(sourceMapText),
    };
}
exports.downlevelCodeWithTsc = downlevelCodeWithTsc;
//# sourceMappingURL=downlevel-plugin.js.map