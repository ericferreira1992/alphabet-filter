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
        define("@angular/compiler-cli/src/ngtsc/typecheck/src/host", ["require", "exports", "tslib", "@angular/compiler-cli/src/ngtsc/shims"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeCheckProgramHost = exports.DelegatingCompilerHost = void 0;
    var tslib_1 = require("tslib");
    var shims_1 = require("@angular/compiler-cli/src/ngtsc/shims");
    /**
     * Delegates all methods of `ts.CompilerHost` to a delegate, with the exception of
     * `getSourceFile`, `fileExists` and `writeFile` which are implemented in `TypeCheckProgramHost`.
     *
     * If a new method is added to `ts.CompilerHost` which is not delegated, a type error will be
     * generated for this class.
     */
    var DelegatingCompilerHost = /** @class */ (function () {
        function DelegatingCompilerHost(delegate) {
            this.delegate = delegate;
            // Excluded are 'getSourceFile', 'fileExists' and 'writeFile', which are actually implemented by
            // `TypeCheckProgramHost` below.
            this.createHash = this.delegateMethod('createHash');
            this.directoryExists = this.delegateMethod('directoryExists');
            this.getCancellationToken = this.delegateMethod('getCancellationToken');
            this.getCanonicalFileName = this.delegateMethod('getCanonicalFileName');
            this.getCurrentDirectory = this.delegateMethod('getCurrentDirectory');
            this.getDefaultLibFileName = this.delegateMethod('getDefaultLibFileName');
            this.getDefaultLibLocation = this.delegateMethod('getDefaultLibLocation');
            this.getDirectories = this.delegateMethod('getDirectories');
            this.getEnvironmentVariable = this.delegateMethod('getEnvironmentVariable');
            this.getNewLine = this.delegateMethod('getNewLine');
            this.getParsedCommandLine = this.delegateMethod('getParsedCommandLine');
            this.getSourceFileByPath = this.delegateMethod('getSourceFileByPath');
            this.readDirectory = this.delegateMethod('readDirectory');
            this.readFile = this.delegateMethod('readFile');
            this.realpath = this.delegateMethod('realpath');
            this.resolveModuleNames = this.delegateMethod('resolveModuleNames');
            this.resolveTypeReferenceDirectives = this.delegateMethod('resolveTypeReferenceDirectives');
            this.trace = this.delegateMethod('trace');
            this.useCaseSensitiveFileNames = this.delegateMethod('useCaseSensitiveFileNames');
        }
        DelegatingCompilerHost.prototype.delegateMethod = function (name) {
            return this.delegate[name] !== undefined ? this.delegate[name].bind(this.delegate) :
                undefined;
        };
        return DelegatingCompilerHost;
    }());
    exports.DelegatingCompilerHost = DelegatingCompilerHost;
    /**
     * A `ts.CompilerHost` which augments source files with type checking code from a
     * `TypeCheckContext`.
     */
    var TypeCheckProgramHost = /** @class */ (function (_super) {
        tslib_1.__extends(TypeCheckProgramHost, _super);
        function TypeCheckProgramHost(sfMap, originalProgram, delegate, shimExtensionPrefixes) {
            var _this = _super.call(this, delegate) || this;
            _this.originalProgram = originalProgram;
            _this.shimExtensionPrefixes = shimExtensionPrefixes;
            /**
             * The `ShimReferenceTagger` responsible for tagging `ts.SourceFile`s loaded via this host.
             *
             * The `TypeCheckProgramHost` is used in the creation of a new `ts.Program`. Even though this new
             * program is based on a prior one, TypeScript will still start from the root files and enumerate
             * all source files to include in the new program.  This means that just like during the original
             * program's creation, these source files must be tagged with references to per-file shims in
             * order for those shims to be loaded, and then cleaned up afterwards. Thus the
             * `TypeCheckProgramHost` has its own `ShimReferenceTagger` to perform this function.
             */
            _this.shimTagger = new shims_1.ShimReferenceTagger(_this.shimExtensionPrefixes);
            _this.sfMap = sfMap;
            return _this;
        }
        TypeCheckProgramHost.prototype.getSourceFile = function (fileName, languageVersion, onError, shouldCreateNewSourceFile) {
            // Try to use the same `ts.SourceFile` as the original program, if possible. This guarantees
            // that program reuse will be as efficient as possible.
            var delegateSf = this.originalProgram.getSourceFile(fileName);
            if (delegateSf === undefined) {
                // Something went wrong and a source file is being requested that's not in the original
                // program. Just in case, try to retrieve it from the delegate.
                delegateSf = this.delegate.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
            }
            if (delegateSf === undefined) {
                return undefined;
            }
            // Look for replacements.
            var sf;
            if (this.sfMap.has(fileName)) {
                sf = this.sfMap.get(fileName);
                shims_1.copyFileShimData(delegateSf, sf);
            }
            else {
                sf = delegateSf;
            }
            // TypeScript doesn't allow returning redirect source files. To avoid unforseen errors we
            // return the original source file instead of the redirect target.
            var redirectInfo = sf.redirectInfo;
            if (redirectInfo !== undefined) {
                sf = redirectInfo.unredirected;
            }
            this.shimTagger.tag(sf);
            return sf;
        };
        TypeCheckProgramHost.prototype.postProgramCreationCleanup = function () {
            this.shimTagger.finalize();
        };
        TypeCheckProgramHost.prototype.writeFile = function () {
            throw new Error("TypeCheckProgramHost should never write files");
        };
        TypeCheckProgramHost.prototype.fileExists = function (fileName) {
            return this.sfMap.has(fileName) || this.delegate.fileExists(fileName);
        };
        return TypeCheckProgramHost;
    }(DelegatingCompilerHost));
    exports.TypeCheckProgramHost = TypeCheckProgramHost;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaG9zdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy9ob3N0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFJSCwrREFBa0U7SUFXbEU7Ozs7OztPQU1HO0lBQ0g7UUFFRSxnQ0FBc0IsUUFBeUI7WUFBekIsYUFBUSxHQUFSLFFBQVEsQ0FBaUI7WUFPL0MsZ0dBQWdHO1lBQ2hHLGdDQUFnQztZQUNoQyxlQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUMvQyxvQkFBZSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsaUJBQWlCLENBQUMsQ0FBQztZQUN6RCx5QkFBb0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLHNCQUFzQixDQUFDLENBQUM7WUFDbkUseUJBQW9CLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1lBQ25FLHdCQUFtQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUNqRSwwQkFBcUIsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLHVCQUF1QixDQUFDLENBQUM7WUFDckUsMEJBQXFCLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1lBQ3JFLG1CQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBQ3ZELDJCQUFzQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsd0JBQXdCLENBQUMsQ0FBQztZQUN2RSxlQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUMvQyx5QkFBb0IsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLHNCQUFzQixDQUFDLENBQUM7WUFDbkUsd0JB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QztRQUNaLENBQUM7UUFFRCx5REFBMEIsR0FBMUI7WUFDRSxJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO1FBQzdCLENBQUM7UUFFRCx3Q0FBUyxHQUFUO1lBQ0UsTUFBTSxJQUFJLEtBQUssQ0FBQywrQ0FBK0MsQ0FBQyxDQUFDO1FBQ25FLENBQUM7UUFFRCx5Q0FBVSxHQUFWLFVBQVcsUUFBZ0I7WUFDekIsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsQ0FBQztRQUN4RSxDQUFDO1FBQ0gsMkJBQUM7SUFBRCxDQUFDLEFBeEVELENBQTBDLHNCQUFzQixHQXdFL0Q7SUF4RVksb0RBQW9CIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge2NvcHlGaWxlU2hpbURhdGEsIFNoaW1SZWZlcmVuY2VUYWdnZXJ9IGZyb20gJy4uLy4uL3NoaW1zJztcblxuLyoqXG4gKiBSZXByZXNlbnRzIHRoZSBgdHMuQ29tcGlsZXJIb3N0YCBpbnRlcmZhY2UsIHdpdGggYSB0cmFuc2Zvcm1hdGlvbiBhcHBsaWVkIHRoYXQgdHVybnMgYWxsXG4gKiBtZXRob2RzIChldmVuIG9wdGlvbmFsIG9uZXMpIGludG8gcmVxdWlyZWQgZmllbGRzICh3aGljaCBtYXkgYmUgYHVuZGVmaW5lZGAsIGlmIHRoZSBtZXRob2Qgd2FzXG4gKiBvcHRpb25hbCkuXG4gKi9cbmV4cG9ydCB0eXBlIFJlcXVpcmVkQ29tcGlsZXJIb3N0RGVsZWdhdGlvbnMgPSB7XG4gIFtNIGluIGtleW9mIFJlcXVpcmVkPHRzLkNvbXBpbGVySG9zdD5dOiB0cy5Db21waWxlckhvc3RbTV07XG59O1xuXG4vKipcbiAqIERlbGVnYXRlcyBhbGwgbWV0aG9kcyBvZiBgdHMuQ29tcGlsZXJIb3N0YCB0byBhIGRlbGVnYXRlLCB3aXRoIHRoZSBleGNlcHRpb24gb2ZcbiAqIGBnZXRTb3VyY2VGaWxlYCwgYGZpbGVFeGlzdHNgIGFuZCBgd3JpdGVGaWxlYCB3aGljaCBhcmUgaW1wbGVtZW50ZWQgaW4gYFR5cGVDaGVja1Byb2dyYW1Ib3N0YC5cbiAqXG4gKiBJZiBhIG5ldyBtZXRob2QgaXMgYWRkZWQgdG8gYHRzLkNvbXBpbGVySG9zdGAgd2hpY2ggaXMgbm90IGRlbGVnYXRlZCwgYSB0eXBlIGVycm9yIHdpbGwgYmVcbiAqIGdlbmVyYXRlZCBmb3IgdGhpcyBjbGFzcy5cbiAqL1xuZXhwb3J0IGNsYXNzIERlbGVnYXRpbmdDb21waWxlckhvc3QgaW1wbGVtZW50c1xuICAgIE9taXQ8UmVxdWlyZWRDb21waWxlckhvc3REZWxlZ2F0aW9ucywgJ2dldFNvdXJjZUZpbGUnfCdmaWxlRXhpc3RzJ3wnd3JpdGVGaWxlJz4ge1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgZGVsZWdhdGU6IHRzLkNvbXBpbGVySG9zdCkge31cblxuICBwcml2YXRlIGRlbGVnYXRlTWV0aG9kPE0gZXh0ZW5kcyBrZXlvZiB0cy5Db21waWxlckhvc3Q+KG5hbWU6IE0pOiB0cy5Db21waWxlckhvc3RbTV0ge1xuICAgIHJldHVybiB0aGlzLmRlbGVnYXRlW25hbWVdICE9PSB1bmRlZmluZWQgPyAodGhpcy5kZWxlZ2F0ZVtuYW1lXSBhcyBhbnkpLmJpbmQodGhpcy5kZWxlZ2F0ZSkgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB1bmRlZmluZWQ7XG4gIH1cblxuICAvLyBFeGNsdWRlZCBhcmUgJ2dldFNvdXJjZUZpbGUnLCAnZmlsZUV4aXN0cycgYW5kICd3cml0ZUZpbGUnLCB3aGljaCBhcmUgYWN0dWFsbHkgaW1wbGVtZW50ZWQgYnlcbiAgLy8gYFR5cGVDaGVja1Byb2dyYW1Ib3N0YCBiZWxvdy5cbiAgY3JlYXRlSGFzaCA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ2NyZWF0ZUhhc2gnKTtcbiAgZGlyZWN0b3J5RXhpc3RzID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgnZGlyZWN0b3J5RXhpc3RzJyk7XG4gIGdldENhbmNlbGxhdGlvblRva2VuID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgnZ2V0Q2FuY2VsbGF0aW9uVG9rZW4nKTtcbiAgZ2V0Q2Fub25pY2FsRmlsZU5hbWUgPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdnZXRDYW5vbmljYWxGaWxlTmFtZScpO1xuICBnZXRDdXJyZW50RGlyZWN0b3J5ID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgnZ2V0Q3VycmVudERpcmVjdG9yeScpO1xuICBnZXREZWZhdWx0TGliRmlsZU5hbWUgPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdnZXREZWZhdWx0TGliRmlsZU5hbWUnKTtcbiAgZ2V0RGVmYXVsdExpYkxvY2F0aW9uID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgnZ2V0RGVmYXVsdExpYkxvY2F0aW9uJyk7XG4gIGdldERpcmVjdG9yaWVzID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgnZ2V0RGlyZWN0b3JpZXMnKTtcbiAgZ2V0RW52aXJvbm1lbnRWYXJpYWJsZSA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ2dldEVudmlyb25tZW50VmFyaWFibGUnKTtcbiAgZ2V0TmV3TGluZSA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ2dldE5ld0xpbmUnKTtcbiAgZ2V0UGFyc2VkQ29tbWFuZExpbmUgPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCdnZXRQYXJzZWRDb21tYW5kTGluZScpO1xuICBnZXRTb3VyY2VGaWxlQnlQYXRoID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgnZ2V0U291cmNlRmlsZUJ5UGF0aCcpO1xuICByZWFkRGlyZWN0b3J5ID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgncmVhZERpcmVjdG9yeScpO1xuICByZWFkRmlsZSA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ3JlYWRGaWxlJyk7XG4gIHJlYWxwYXRoID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgncmVhbHBhdGgnKTtcbiAgcmVzb2x2ZU1vZHVsZU5hbWVzID0gdGhpcy5kZWxlZ2F0ZU1ldGhvZCgncmVzb2x2ZU1vZHVsZU5hbWVzJyk7XG4gIHJlc29sdmVUeXBlUmVmZXJlbmNlRGlyZWN0aXZlcyA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ3Jlc29sdmVUeXBlUmVmZXJlbmNlRGlyZWN0aXZlcycpO1xuICB0cmFjZSA9IHRoaXMuZGVsZWdhdGVNZXRob2QoJ3RyYWNlJyk7XG4gIHVzZUNhc2VTZW5zaXRpdmVGaWxlTmFtZXMgPSB0aGlzLmRlbGVnYXRlTWV0aG9kKCd1c2VDYXNlU2Vuc2l0aXZlRmlsZU5hbWVzJyk7XG59XG5cbi8qKlxuICogQSBgdHMuQ29tcGlsZXJIb3N0YCB3aGljaCBhdWdtZW50cyBzb3VyY2UgZmlsZXMgd2l0aCB0eXBlIGNoZWNraW5nIGNvZGUgZnJvbSBhXG4gKiBgVHlwZUNoZWNrQ29udGV4dGAuXG4gKi9cbmV4cG9ydCBjbGFzcyBUeXBlQ2hlY2tQcm9ncmFtSG9zdCBleHRlbmRzIERlbGVnYXRpbmdDb21waWxlckhvc3Qge1xuICAvKipcbiAgICogTWFwIG9mIHNvdXJjZSBmaWxlIG5hbWVzIHRvIGB0cy5Tb3VyY2VGaWxlYCBpbnN0YW5jZXMuXG4gICAqL1xuICBwcml2YXRlIHNmTWFwOiBNYXA8c3RyaW5nLCB0cy5Tb3VyY2VGaWxlPjtcblxuICAvKipcbiAgICogVGhlIGBTaGltUmVmZXJlbmNlVGFnZ2VyYCByZXNwb25zaWJsZSBmb3IgdGFnZ2luZyBgdHMuU291cmNlRmlsZWBzIGxvYWRlZCB2aWEgdGhpcyBob3N0LlxuICAgKlxuICAgKiBUaGUgYFR5cGVDaGVja1Byb2dyYW1Ib3N0YCBpcyB1c2VkIGluIHRoZSBjcmVhdGlvbiBvZiBhIG5ldyBgdHMuUHJvZ3JhbWAuIEV2ZW4gdGhvdWdoIHRoaXMgbmV3XG4gICAqIHByb2dyYW0gaXMgYmFzZWQgb24gYSBwcmlvciBvbmUsIFR5cGVTY3JpcHQgd2lsbCBzdGlsbCBzdGFydCBmcm9tIHRoZSByb290IGZpbGVzIGFuZCBlbnVtZXJhdGVcbiAgICogYWxsIHNvdXJjZSBmaWxlcyB0byBpbmNsdWRlIGluIHRoZSBuZXcgcHJvZ3JhbS4gIFRoaXMgbWVhbnMgdGhhdCBqdXN0IGxpa2UgZHVyaW5nIHRoZSBvcmlnaW5hbFxuICAgKiBwcm9ncmFtJ3MgY3JlYXRpb24sIHRoZXNlIHNvdXJjZSBmaWxlcyBtdXN0IGJlIHRhZ2dlZCB3aXRoIHJlZmVyZW5jZXMgdG8gcGVyLWZpbGUgc2hpbXMgaW5cbiAgICogb3JkZXIgZm9yIHRob3NlIHNoaW1zIHRvIGJlIGxvYWRlZCwgYW5kIHRoZW4gY2xlYW5lZCB1cCBhZnRlcndhcmRzLiBUaHVzIHRoZVxuICAgKiBgVHlwZUNoZWNrUHJvZ3JhbUhvc3RgIGhhcyBpdHMgb3duIGBTaGltUmVmZXJlbmNlVGFnZ2VyYCB0byBwZXJmb3JtIHRoaXMgZnVuY3Rpb24uXG4gICAqL1xuICBwcml2YXRlIHNoaW1UYWdnZXIgPSBuZXcgU2hpbVJlZmVyZW5jZVRhZ2dlcih0aGlzLnNoaW1FeHRlbnNpb25QcmVmaXhlcyk7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBzZk1hcDogTWFwPHN0cmluZywgdHMuU291cmNlRmlsZT4sIHByaXZhdGUgb3JpZ2luYWxQcm9ncmFtOiB0cy5Qcm9ncmFtLFxuICAgICAgZGVsZWdhdGU6IHRzLkNvbXBpbGVySG9zdCwgcHJpdmF0ZSBzaGltRXh0ZW5zaW9uUHJlZml4ZXM6IHN0cmluZ1tdKSB7XG4gICAgc3VwZXIoZGVsZWdhdGUpO1xuICAgIHRoaXMuc2ZNYXAgPSBzZk1hcDtcbiAgfVxuXG4gIGdldFNvdXJjZUZpbGUoXG4gICAgICBmaWxlTmFtZTogc3RyaW5nLCBsYW5ndWFnZVZlcnNpb246IHRzLlNjcmlwdFRhcmdldCxcbiAgICAgIG9uRXJyb3I/OiAoKG1lc3NhZ2U6IHN0cmluZykgPT4gdm9pZCl8dW5kZWZpbmVkLFxuICAgICAgc2hvdWxkQ3JlYXRlTmV3U291cmNlRmlsZT86IGJvb2xlYW58dW5kZWZpbmVkKTogdHMuU291cmNlRmlsZXx1bmRlZmluZWQge1xuICAgIC8vIFRyeSB0byB1c2UgdGhlIHNhbWUgYHRzLlNvdXJjZUZpbGVgIGFzIHRoZSBvcmlnaW5hbCBwcm9ncmFtLCBpZiBwb3NzaWJsZS4gVGhpcyBndWFyYW50ZWVzXG4gICAgLy8gdGhhdCBwcm9ncmFtIHJldXNlIHdpbGwgYmUgYXMgZWZmaWNpZW50IGFzIHBvc3NpYmxlLlxuICAgIGxldCBkZWxlZ2F0ZVNmOiB0cy5Tb3VyY2VGaWxlfHVuZGVmaW5lZCA9IHRoaXMub3JpZ2luYWxQcm9ncmFtLmdldFNvdXJjZUZpbGUoZmlsZU5hbWUpO1xuICAgIGlmIChkZWxlZ2F0ZVNmID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIFNvbWV0aGluZyB3ZW50IHdyb25nIGFuZCBhIHNvdXJjZSBmaWxlIGlzIGJlaW5nIHJlcXVlc3RlZCB0aGF0J3Mgbm90IGluIHRoZSBvcmlnaW5hbFxuICAgICAgLy8gcHJvZ3JhbS4gSnVzdCBpbiBjYXNlLCB0cnkgdG8gcmV0cmlldmUgaXQgZnJvbSB0aGUgZGVsZWdhdGUuXG4gICAgICBkZWxlZ2F0ZVNmID0gdGhpcy5kZWxlZ2F0ZS5nZXRTb3VyY2VGaWxlKFxuICAgICAgICAgIGZpbGVOYW1lLCBsYW5ndWFnZVZlcnNpb24sIG9uRXJyb3IsIHNob3VsZENyZWF0ZU5ld1NvdXJjZUZpbGUpITtcbiAgICB9XG4gICAgaWYgKGRlbGVnYXRlU2YgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICAvLyBMb29rIGZvciByZXBsYWNlbWVudHMuXG4gICAgbGV0IHNmOiB0cy5Tb3VyY2VGaWxlO1xuICAgIGlmICh0aGlzLnNmTWFwLmhhcyhmaWxlTmFtZSkpIHtcbiAgICAgIHNmID0gdGhpcy5zZk1hcC5nZXQoZmlsZU5hbWUpITtcbiAgICAgIGNvcHlGaWxlU2hpbURhdGEoZGVsZWdhdGVTZiwgc2YpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzZiA9IGRlbGVnYXRlU2Y7XG4gICAgfVxuICAgIC8vIFR5cGVTY3JpcHQgZG9lc24ndCBhbGxvdyByZXR1cm5pbmcgcmVkaXJlY3Qgc291cmNlIGZpbGVzLiBUbyBhdm9pZCB1bmZvcnNlZW4gZXJyb3JzIHdlXG4gICAgLy8gcmV0dXJuIHRoZSBvcmlnaW5hbCBzb3VyY2UgZmlsZSBpbnN0ZWFkIG9mIHRoZSByZWRpcmVjdCB0YXJnZXQuXG4gICAgY29uc3QgcmVkaXJlY3RJbmZvID0gKHNmIGFzIGFueSkucmVkaXJlY3RJbmZvO1xuICAgIGlmIChyZWRpcmVjdEluZm8gIT09IHVuZGVmaW5lZCkge1xuICAgICAgc2YgPSByZWRpcmVjdEluZm8udW5yZWRpcmVjdGVkO1xuICAgIH1cblxuICAgIHRoaXMuc2hpbVRhZ2dlci50YWcoc2YpO1xuICAgIHJldHVybiBzZjtcbiAgfVxuXG4gIHBvc3RQcm9ncmFtQ3JlYXRpb25DbGVhbnVwKCk6IHZvaWQge1xuICAgIHRoaXMuc2hpbVRhZ2dlci5maW5hbGl6ZSgpO1xuICB9XG5cbiAgd3JpdGVGaWxlKCk6IG5ldmVyIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFR5cGVDaGVja1Byb2dyYW1Ib3N0IHNob3VsZCBuZXZlciB3cml0ZSBmaWxlc2ApO1xuICB9XG5cbiAgZmlsZUV4aXN0cyhmaWxlTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuc2ZNYXAuaGFzKGZpbGVOYW1lKSB8fCB0aGlzLmRlbGVnYXRlLmZpbGVFeGlzdHMoZmlsZU5hbWUpO1xuICB9XG59XG4iXX0=