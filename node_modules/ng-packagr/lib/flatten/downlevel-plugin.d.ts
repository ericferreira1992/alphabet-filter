import { TransformResult } from 'rollup';
/**
 * Downlevels a .js file from `ES2015` to `ES5`. Internally, uses `tsc`.
 *
 * Required for some external as they contains `ES2015` syntax such as `const` and `let`
 */
export declare function downlevelCodeWithTsc(code: string, filePath: string): TransformResult;
