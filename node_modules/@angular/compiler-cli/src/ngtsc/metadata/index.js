/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler-cli/src/ngtsc/metadata", ["require", "exports", "tslib", "@angular/compiler-cli/src/ngtsc/metadata/src/api", "@angular/compiler-cli/src/ngtsc/metadata/src/dts", "@angular/compiler-cli/src/ngtsc/metadata/src/inheritance", "@angular/compiler-cli/src/ngtsc/metadata/src/registry", "@angular/compiler-cli/src/ngtsc/metadata/src/util", "@angular/compiler-cli/src/ngtsc/metadata/src/property_mapping"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ClassPropertyMapping = exports.CompoundMetadataReader = exports.extractDirectiveTypeCheckMeta = exports.InjectableClassRegistry = exports.LocalMetadataRegistry = exports.CompoundMetadataRegistry = exports.flattenInheritedDirectiveMetadata = exports.DtsMetadataReader = void 0;
    var tslib_1 = require("tslib");
    tslib_1.__exportStar(require("@angular/compiler-cli/src/ngtsc/metadata/src/api"), exports);
    var dts_1 = require("@angular/compiler-cli/src/ngtsc/metadata/src/dts");
    Object.defineProperty(exports, "DtsMetadataReader", { enumerable: true, get: function () { return dts_1.DtsMetadataReader; } });
    var inheritance_1 = require("@angular/compiler-cli/src/ngtsc/metadata/src/inheritance");
    Object.defineProperty(exports, "flattenInheritedDirectiveMetadata", { enumerable: true, get: function () { return inheritance_1.flattenInheritedDirectiveMetadata; } });
    var registry_1 = require("@angular/compiler-cli/src/ngtsc/metadata/src/registry");
    Object.defineProperty(exports, "CompoundMetadataRegistry", { enumerable: true, get: function () { return registry_1.CompoundMetadataRegistry; } });
    Object.defineProperty(exports, "LocalMetadataRegistry", { enumerable: true, get: function () { return registry_1.LocalMetadataRegistry; } });
    Object.defineProperty(exports, "InjectableClassRegistry", { enumerable: true, get: function () { return registry_1.InjectableClassRegistry; } });
    var util_1 = require("@angular/compiler-cli/src/ngtsc/metadata/src/util");
    Object.defineProperty(exports, "extractDirectiveTypeCheckMeta", { enumerable: true, get: function () { return util_1.extractDirectiveTypeCheckMeta; } });
    Object.defineProperty(exports, "CompoundMetadataReader", { enumerable: true, get: function () { return util_1.CompoundMetadataReader; } });
    var property_mapping_1 = require("@angular/compiler-cli/src/ngtsc/metadata/src/property_mapping");
    Object.defineProperty(exports, "ClassPropertyMapping", { enumerable: true, get: function () { return property_mapping_1.ClassPropertyMapping; } });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL21ldGFkYXRhL2luZGV4LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCwyRkFBMEI7SUFDMUIsd0VBQTRDO0lBQXBDLHdHQUFBLGlCQUFpQixPQUFBO0lBQ3pCLHdGQUFvRTtJQUE1RCxnSUFBQSxpQ0FBaUMsT0FBQTtJQUN6QyxrRkFBd0c7SUFBaEcsb0hBQUEsd0JBQXdCLE9BQUE7SUFBRSxpSEFBQSxxQkFBcUIsT0FBQTtJQUFFLG1IQUFBLHVCQUF1QixPQUFBO0lBQ2hGLDBFQUFpRjtJQUF6RSxxSEFBQSw2QkFBNkIsT0FBQTtJQUFFLDhHQUFBLHNCQUFzQixPQUFBO0lBQzdELGtHQUFtSDtJQUF0Rix3SEFBQSxvQkFBb0IsT0FBQSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5leHBvcnQgKiBmcm9tICcuL3NyYy9hcGknO1xuZXhwb3J0IHtEdHNNZXRhZGF0YVJlYWRlcn0gZnJvbSAnLi9zcmMvZHRzJztcbmV4cG9ydCB7ZmxhdHRlbkluaGVyaXRlZERpcmVjdGl2ZU1ldGFkYXRhfSBmcm9tICcuL3NyYy9pbmhlcml0YW5jZSc7XG5leHBvcnQge0NvbXBvdW5kTWV0YWRhdGFSZWdpc3RyeSwgTG9jYWxNZXRhZGF0YVJlZ2lzdHJ5LCBJbmplY3RhYmxlQ2xhc3NSZWdpc3RyeX0gZnJvbSAnLi9zcmMvcmVnaXN0cnknO1xuZXhwb3J0IHtleHRyYWN0RGlyZWN0aXZlVHlwZUNoZWNrTWV0YSwgQ29tcG91bmRNZXRhZGF0YVJlYWRlcn0gZnJvbSAnLi9zcmMvdXRpbCc7XG5leHBvcnQge0JpbmRpbmdQcm9wZXJ0eU5hbWUsIENsYXNzUHJvcGVydHlNYXBwaW5nLCBDbGFzc1Byb3BlcnR5TmFtZSwgSW5wdXRPck91dHB1dH0gZnJvbSAnLi9zcmMvcHJvcGVydHlfbWFwcGluZyc7XG4iXX0=