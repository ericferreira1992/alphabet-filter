"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
/**
 * Executes a Command and returns its promisified result.
 *
 * @stable
 */
function execute(command, args) {
    const result = args ? command(args) : command();
    if (result instanceof Promise) {
        return result;
    }
    else {
        return Promise.resolve(result);
    }
}
exports.execute = execute;
//# sourceMappingURL=command.js.map