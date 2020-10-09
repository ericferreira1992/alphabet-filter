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
        define("@angular/compiler-cli/src/ngtsc/typecheck/src/checker", ["require", "exports", "tslib", "@angular/compiler", "@angular/compiler-cli/src/ngtsc/file_system", "@angular/compiler-cli/src/ngtsc/shims", "@angular/compiler-cli/src/ngtsc/util/src/typescript", "@angular/compiler-cli/src/ngtsc/typecheck/api", "@angular/compiler-cli/src/ngtsc/typecheck/src/context", "@angular/compiler-cli/src/ngtsc/typecheck/src/diagnostics", "@angular/compiler-cli/src/ngtsc/typecheck/src/source"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TemplateTypeCheckerImpl = void 0;
    var tslib_1 = require("tslib");
    var compiler_1 = require("@angular/compiler");
    var file_system_1 = require("@angular/compiler-cli/src/ngtsc/file_system");
    var shims_1 = require("@angular/compiler-cli/src/ngtsc/shims");
    var typescript_1 = require("@angular/compiler-cli/src/ngtsc/util/src/typescript");
    var api_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/api");
    var context_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/src/context");
    var diagnostics_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/src/diagnostics");
    var source_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/src/source");
    /**
     * Primary template type-checking engine, which performs type-checking using a
     * `TypeCheckingProgramStrategy` for type-checking program maintenance, and the
     * `ProgramTypeCheckAdapter` for generation of template type-checking code.
     */
    var TemplateTypeCheckerImpl = /** @class */ (function () {
        function TemplateTypeCheckerImpl(originalProgram, typeCheckingStrategy, typeCheckAdapter, config, refEmitter, reflector, compilerHost, priorBuild) {
            this.originalProgram = originalProgram;
            this.typeCheckingStrategy = typeCheckingStrategy;
            this.typeCheckAdapter = typeCheckAdapter;
            this.config = config;
            this.refEmitter = refEmitter;
            this.reflector = reflector;
            this.compilerHost = compilerHost;
            this.priorBuild = priorBuild;
            this.state = new Map();
            this.isComplete = false;
        }
        TemplateTypeCheckerImpl.prototype.resetOverrides = function () {
            var e_1, _a;
            try {
                for (var _b = tslib_1.__values(this.state.values()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var fileRecord = _c.value;
                    if (fileRecord.templateOverrides !== null) {
                        fileRecord.templateOverrides = null;
                        fileRecord.shimData.clear();
                        fileRecord.isComplete = false;
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
        TemplateTypeCheckerImpl.prototype.getTemplate = function (component) {
            this.ensureShimForComponent(component);
            var sf = component.getSourceFile();
            var sfPath = file_system_1.absoluteFromSourceFile(sf);
            var shimPath = this.typeCheckingStrategy.shimPathForComponent(component);
            var fileRecord = this.getFileData(sfPath);
            if (!fileRecord.shimData.has(shimPath)) {
                return [];
            }
            var templateId = fileRecord.sourceManager.getTemplateId(component);
            var shimRecord = fileRecord.shimData.get(shimPath);
            if (!shimRecord.templates.has(templateId)) {
                return null;
            }
            return shimRecord.templates.get(templateId).template;
        };
        TemplateTypeCheckerImpl.prototype.overrideComponentTemplate = function (component, template) {
            var _a = compiler_1.parseTemplate(template, 'override.html', {
                preserveWhitespaces: true,
                leadingTriviaChars: [],
            }), nodes = _a.nodes, errors = _a.errors;
            if (errors !== undefined) {
                return { nodes: nodes, errors: errors };
            }
            var filePath = file_system_1.absoluteFromSourceFile(component.getSourceFile());
            var fileRecord = this.getFileData(filePath);
            var id = fileRecord.sourceManager.getTemplateId(component);
            if (fileRecord.templateOverrides === null) {
                fileRecord.templateOverrides = new Map();
            }
            fileRecord.templateOverrides.set(id, nodes);
            // Clear data for the shim in question, so it'll be regenerated on the next request.
            var shimFile = this.typeCheckingStrategy.shimPathForComponent(component);
            fileRecord.shimData.delete(shimFile);
            fileRecord.isComplete = false;
            this.isComplete = false;
            return { nodes: nodes };
        };
        /**
         * Retrieve type-checking diagnostics from the given `ts.SourceFile` using the most recent
         * type-checking program.
         */
        TemplateTypeCheckerImpl.prototype.getDiagnosticsForFile = function (sf, optimizeFor) {
            var e_2, _a;
            switch (optimizeFor) {
                case api_1.OptimizeFor.WholeProgram:
                    this.ensureAllShimsForAllFiles();
                    break;
                case api_1.OptimizeFor.SingleFile:
                    this.ensureAllShimsForOneFile(sf);
                    break;
            }
            var sfPath = file_system_1.absoluteFromSourceFile(sf);
            var fileRecord = this.state.get(sfPath);
            var typeCheckProgram = this.typeCheckingStrategy.getProgram();
            var diagnostics = [];
            if (fileRecord.hasInlines) {
                var inlineSf = file_system_1.getSourceFileOrError(typeCheckProgram, sfPath);
                diagnostics.push.apply(diagnostics, tslib_1.__spread(typeCheckProgram.getSemanticDiagnostics(inlineSf).map(function (diag) { return convertDiagnostic(diag, fileRecord.sourceManager); })));
            }
            try {
                for (var _b = tslib_1.__values(fileRecord.shimData), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var _d = tslib_1.__read(_c.value, 2), shimPath = _d[0], shimRecord = _d[1];
                    var shimSf = file_system_1.getSourceFileOrError(typeCheckProgram, shimPath);
                    diagnostics.push.apply(diagnostics, tslib_1.__spread(typeCheckProgram.getSemanticDiagnostics(shimSf).map(function (diag) { return convertDiagnostic(diag, fileRecord.sourceManager); })));
                    diagnostics.push.apply(diagnostics, tslib_1.__spread(shimRecord.genesisDiagnostics));
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_2) throw e_2.error; }
            }
            return diagnostics.filter(function (diag) { return diag !== null; });
        };
        TemplateTypeCheckerImpl.prototype.getDiagnosticsForComponent = function (component) {
            this.ensureShimForComponent(component);
            var sf = component.getSourceFile();
            var sfPath = file_system_1.absoluteFromSourceFile(sf);
            var shimPath = this.typeCheckingStrategy.shimPathForComponent(component);
            var fileRecord = this.getFileData(sfPath);
            if (!fileRecord.shimData.has(shimPath)) {
                return [];
            }
            var templateId = fileRecord.sourceManager.getTemplateId(component);
            var shimRecord = fileRecord.shimData.get(shimPath);
            var typeCheckProgram = this.typeCheckingStrategy.getProgram();
            var diagnostics = [];
            if (shimRecord.hasInlines) {
                var inlineSf = file_system_1.getSourceFileOrError(typeCheckProgram, sfPath);
                diagnostics.push.apply(diagnostics, tslib_1.__spread(typeCheckProgram.getSemanticDiagnostics(inlineSf).map(function (diag) { return convertDiagnostic(diag, fileRecord.sourceManager); })));
            }
            var shimSf = file_system_1.getSourceFileOrError(typeCheckProgram, shimPath);
            diagnostics.push.apply(diagnostics, tslib_1.__spread(typeCheckProgram.getSemanticDiagnostics(shimSf).map(function (diag) { return convertDiagnostic(diag, fileRecord.sourceManager); })));
            diagnostics.push.apply(diagnostics, tslib_1.__spread(shimRecord.genesisDiagnostics));
            return diagnostics.filter(function (diag) {
                return diag !== null && diag.templateId === templateId;
            });
        };
        TemplateTypeCheckerImpl.prototype.getTypeCheckBlock = function (component) {
            this.ensureAllShimsForOneFile(component.getSourceFile());
            var program = this.typeCheckingStrategy.getProgram();
            var filePath = file_system_1.absoluteFromSourceFile(component.getSourceFile());
            var shimPath = this.typeCheckingStrategy.shimPathForComponent(component);
            if (!this.state.has(filePath)) {
                throw new Error("Error: no data for source file: " + filePath);
            }
            var fileRecord = this.state.get(filePath);
            var id = fileRecord.sourceManager.getTemplateId(component);
            var shimSf = typescript_1.getSourceFileOrNull(program, shimPath);
            if (shimSf === null || !fileRecord.shimData.has(shimPath)) {
                throw new Error("Error: no shim file in program: " + shimPath);
            }
            var node = diagnostics_1.findTypeCheckBlock(shimSf, id);
            if (node === null) {
                // Try for an inline block.
                var inlineSf = file_system_1.getSourceFileOrError(program, filePath);
                node = diagnostics_1.findTypeCheckBlock(inlineSf, id);
            }
            return node;
        };
        TemplateTypeCheckerImpl.prototype.maybeAdoptPriorResultsForFile = function (sf) {
            var sfPath = file_system_1.absoluteFromSourceFile(sf);
            if (this.state.has(sfPath)) {
                var existingResults = this.state.get(sfPath);
                if (existingResults.templateOverrides !== null) {
                    // Cannot adopt prior results if template overrides have been requested.
                    return;
                }
                if (existingResults.isComplete) {
                    // All data for this file has already been generated, so no need to adopt anything.
                    return;
                }
            }
            var previousResults = this.priorBuild.priorTypeCheckingResultsFor(sf);
            if (previousResults === null || !previousResults.isComplete ||
                previousResults.templateOverrides !== null) {
                return;
            }
            this.state.set(sfPath, previousResults);
        };
        TemplateTypeCheckerImpl.prototype.ensureAllShimsForAllFiles = function () {
            var e_3, _a;
            if (this.isComplete) {
                return;
            }
            var host = new WholeProgramTypeCheckingHost(this);
            var ctx = this.newContext(host);
            try {
                for (var _b = tslib_1.__values(this.originalProgram.getSourceFiles()), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var sf = _c.value;
                    if (sf.isDeclarationFile || shims_1.isShim(sf)) {
                        continue;
                    }
                    this.maybeAdoptPriorResultsForFile(sf);
                    var sfPath = file_system_1.absoluteFromSourceFile(sf);
                    var fileData = this.getFileData(sfPath);
                    if (fileData.isComplete) {
                        continue;
                    }
                    this.typeCheckAdapter.typeCheck(sf, ctx);
                    fileData.isComplete = true;
                }
            }
            catch (e_3_1) { e_3 = { error: e_3_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_3) throw e_3.error; }
            }
            this.updateFromContext(ctx);
            this.isComplete = true;
        };
        TemplateTypeCheckerImpl.prototype.ensureAllShimsForOneFile = function (sf) {
            this.maybeAdoptPriorResultsForFile(sf);
            var sfPath = file_system_1.absoluteFromSourceFile(sf);
            var fileData = this.getFileData(sfPath);
            if (fileData.isComplete) {
                // All data for this file is present and accounted for already.
                return;
            }
            var host = new SingleFileTypeCheckingHost(sfPath, fileData, this.typeCheckingStrategy, this);
            var ctx = this.newContext(host);
            this.typeCheckAdapter.typeCheck(sf, ctx);
            fileData.isComplete = true;
            this.updateFromContext(ctx);
        };
        TemplateTypeCheckerImpl.prototype.ensureShimForComponent = function (component) {
            var sf = component.getSourceFile();
            var sfPath = file_system_1.absoluteFromSourceFile(sf);
            this.maybeAdoptPriorResultsForFile(sf);
            var fileData = this.getFileData(sfPath);
            var shimPath = this.typeCheckingStrategy.shimPathForComponent(component);
            if (fileData.shimData.has(shimPath)) {
                // All data for this component is available.
                return;
            }
            var host = new SingleShimTypeCheckingHost(sfPath, fileData, this.typeCheckingStrategy, this, shimPath);
            var ctx = this.newContext(host);
            this.typeCheckAdapter.typeCheck(sf, ctx);
            this.updateFromContext(ctx);
        };
        TemplateTypeCheckerImpl.prototype.newContext = function (host) {
            var inlining = this.typeCheckingStrategy.supportsInlineOperations ? context_1.InliningMode.InlineOps :
                context_1.InliningMode.Error;
            return new context_1.TypeCheckContextImpl(this.config, this.compilerHost, this.typeCheckingStrategy, this.refEmitter, this.reflector, host, inlining);
        };
        /**
         * Remove any shim data that depends on inline operations applied to the type-checking program.
         *
         * This can be useful if new inlines need to be applied, and it's not possible to guarantee that
         * they won't overwrite or corrupt existing inlines that are used by such shims.
         */
        TemplateTypeCheckerImpl.prototype.clearAllShimDataUsingInlines = function () {
            var e_4, _a, e_5, _b;
            try {
                for (var _c = tslib_1.__values(this.state.values()), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var fileData = _d.value;
                    if (!fileData.hasInlines) {
                        continue;
                    }
                    try {
                        for (var _e = (e_5 = void 0, tslib_1.__values(fileData.shimData.entries())), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var _g = tslib_1.__read(_f.value, 2), shimFile = _g[0], shimData = _g[1];
                            if (shimData.hasInlines) {
                                fileData.shimData.delete(shimFile);
                            }
                        }
                    }
                    catch (e_5_1) { e_5 = { error: e_5_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_5) throw e_5.error; }
                    }
                    fileData.hasInlines = false;
                    fileData.isComplete = false;
                    this.isComplete = false;
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_4) throw e_4.error; }
            }
        };
        TemplateTypeCheckerImpl.prototype.updateFromContext = function (ctx) {
            var updates = ctx.finalize();
            this.typeCheckingStrategy.updateFiles(updates, api_1.UpdateMode.Incremental);
            this.priorBuild.recordSuccessfulTypeCheck(this.state);
        };
        TemplateTypeCheckerImpl.prototype.getFileData = function (path) {
            if (!this.state.has(path)) {
                this.state.set(path, {
                    hasInlines: false,
                    templateOverrides: null,
                    sourceManager: new source_1.TemplateSourceManager(),
                    isComplete: false,
                    shimData: new Map(),
                });
            }
            return this.state.get(path);
        };
        return TemplateTypeCheckerImpl;
    }());
    exports.TemplateTypeCheckerImpl = TemplateTypeCheckerImpl;
    function convertDiagnostic(diag, sourceResolver) {
        if (!diagnostics_1.shouldReportDiagnostic(diag)) {
            return null;
        }
        return diagnostics_1.translateDiagnostic(diag, sourceResolver);
    }
    /**
     * Drives a `TypeCheckContext` to generate type-checking code for every component in the program.
     */
    var WholeProgramTypeCheckingHost = /** @class */ (function () {
        function WholeProgramTypeCheckingHost(impl) {
            this.impl = impl;
        }
        WholeProgramTypeCheckingHost.prototype.getSourceManager = function (sfPath) {
            return this.impl.getFileData(sfPath).sourceManager;
        };
        WholeProgramTypeCheckingHost.prototype.shouldCheckComponent = function (node) {
            var fileData = this.impl.getFileData(file_system_1.absoluteFromSourceFile(node.getSourceFile()));
            var shimPath = this.impl.typeCheckingStrategy.shimPathForComponent(node);
            // The component needs to be checked unless the shim which would contain it already exists.
            return !fileData.shimData.has(shimPath);
        };
        WholeProgramTypeCheckingHost.prototype.getTemplateOverride = function (sfPath, node) {
            var fileData = this.impl.getFileData(sfPath);
            if (fileData.templateOverrides === null) {
                return null;
            }
            var templateId = fileData.sourceManager.getTemplateId(node);
            if (fileData.templateOverrides.has(templateId)) {
                return fileData.templateOverrides.get(templateId);
            }
            return null;
        };
        WholeProgramTypeCheckingHost.prototype.recordShimData = function (sfPath, data) {
            var fileData = this.impl.getFileData(sfPath);
            fileData.shimData.set(data.path, data);
            if (data.hasInlines) {
                fileData.hasInlines = true;
            }
        };
        WholeProgramTypeCheckingHost.prototype.recordComplete = function (sfPath) {
            this.impl.getFileData(sfPath).isComplete = true;
        };
        return WholeProgramTypeCheckingHost;
    }());
    /**
     * Drives a `TypeCheckContext` to generate type-checking code efficiently for a single input file.
     */
    var SingleFileTypeCheckingHost = /** @class */ (function () {
        function SingleFileTypeCheckingHost(sfPath, fileData, strategy, impl) {
            this.sfPath = sfPath;
            this.fileData = fileData;
            this.strategy = strategy;
            this.impl = impl;
            this.seenInlines = false;
        }
        SingleFileTypeCheckingHost.prototype.assertPath = function (sfPath) {
            if (this.sfPath !== sfPath) {
                throw new Error("AssertionError: querying TypeCheckingHost outside of assigned file");
            }
        };
        SingleFileTypeCheckingHost.prototype.getSourceManager = function (sfPath) {
            this.assertPath(sfPath);
            return this.fileData.sourceManager;
        };
        SingleFileTypeCheckingHost.prototype.shouldCheckComponent = function (node) {
            if (this.sfPath !== file_system_1.absoluteFromSourceFile(node.getSourceFile())) {
                return false;
            }
            var shimPath = this.strategy.shimPathForComponent(node);
            // Only need to generate a TCB for the class if no shim exists for it currently.
            return !this.fileData.shimData.has(shimPath);
        };
        SingleFileTypeCheckingHost.prototype.getTemplateOverride = function (sfPath, node) {
            this.assertPath(sfPath);
            if (this.fileData.templateOverrides === null) {
                return null;
            }
            var templateId = this.fileData.sourceManager.getTemplateId(node);
            if (this.fileData.templateOverrides.has(templateId)) {
                return this.fileData.templateOverrides.get(templateId);
            }
            return null;
        };
        SingleFileTypeCheckingHost.prototype.recordShimData = function (sfPath, data) {
            this.assertPath(sfPath);
            // Previous type-checking state may have required the use of inlines (assuming they were
            // supported). If the current operation also requires inlines, this presents a problem:
            // generating new inlines may invalidate any old inlines that old state depends on.
            //
            // Rather than resolve this issue by tracking specific dependencies on inlines, if the new state
            // relies on inlines, any old state that relied on them is simply cleared. This happens when the
            // first new state that uses inlines is encountered.
            if (data.hasInlines && !this.seenInlines) {
                this.impl.clearAllShimDataUsingInlines();
                this.seenInlines = true;
            }
            this.fileData.shimData.set(data.path, data);
            if (data.hasInlines) {
                this.fileData.hasInlines = true;
            }
        };
        SingleFileTypeCheckingHost.prototype.recordComplete = function (sfPath) {
            this.assertPath(sfPath);
            this.fileData.isComplete = true;
        };
        return SingleFileTypeCheckingHost;
    }());
    /**
     * Drives a `TypeCheckContext` to generate type-checking code efficiently for only those components
     * which map to a single shim of a single input file.
     */
    var SingleShimTypeCheckingHost = /** @class */ (function (_super) {
        tslib_1.__extends(SingleShimTypeCheckingHost, _super);
        function SingleShimTypeCheckingHost(sfPath, fileData, strategy, impl, shimPath) {
            var _this = _super.call(this, sfPath, fileData, strategy, impl) || this;
            _this.shimPath = shimPath;
            return _this;
        }
        SingleShimTypeCheckingHost.prototype.shouldCheckNode = function (node) {
            if (this.sfPath !== file_system_1.absoluteFromSourceFile(node.getSourceFile())) {
                return false;
            }
            // Only generate a TCB for the component if it maps to the requested shim file.
            var shimPath = this.strategy.shimPathForComponent(node);
            if (shimPath !== this.shimPath) {
                return false;
            }
            // Only need to generate a TCB for the class if no shim exists for it currently.
            return !this.fileData.shimData.has(shimPath);
        };
        return SingleShimTypeCheckingHost;
    }(SingleFileTypeCheckingHost));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hlY2tlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy9jaGVja2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw4Q0FBeUU7SUFHekUsMkVBQStGO0lBSS9GLCtEQUFtQztJQUNuQyxrRkFBOEQ7SUFDOUQscUVBQTBKO0lBRzFKLGlGQUFxRztJQUNyRyx5RkFBc0g7SUFDdEgsK0VBQStDO0lBRS9DOzs7O09BSUc7SUFDSDtRQUlFLGlDQUNZLGVBQTJCLEVBQzFCLG9CQUFpRCxFQUNsRCxnQkFBeUMsRUFBVSxNQUEwQixFQUM3RSxVQUE0QixFQUFVLFNBQXlCLEVBQy9ELFlBQTJELEVBQzNELFVBQTJEO1lBTDNELG9CQUFlLEdBQWYsZUFBZSxDQUFZO1lBQzFCLHlCQUFvQixHQUFwQixvQkFBb0IsQ0FBNkI7WUFDbEQscUJBQWdCLEdBQWhCLGdCQUFnQixDQUF5QjtZQUFVLFdBQU0sR0FBTixNQUFNLENBQW9CO1lBQzdFLGVBQVUsR0FBVixVQUFVLENBQWtCO1lBQVUsY0FBUyxHQUFULFNBQVMsQ0FBZ0I7WUFDL0QsaUJBQVksR0FBWixZQUFZLENBQStDO1lBQzNELGVBQVUsR0FBVixVQUFVLENBQWlEO1lBVC9ELFVBQUssR0FBRyxJQUFJLEdBQUcsRUFBd0MsQ0FBQztZQUN4RCxlQUFVLEdBQUcsS0FBSyxDQUFDO1FBUStDLENBQUM7UUFFM0UsZ0RBQWMsR0FBZDs7O2dCQUNFLEtBQXlCLElBQUEsS0FBQSxpQkFBQSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRSxDQUFBLGdCQUFBLDRCQUFFO29CQUF6QyxJQUFNLFVBQVUsV0FBQTtvQkFDbkIsSUFBSSxVQUFVLENBQUMsaUJBQWlCLEtBQUssSUFBSSxFQUFFO3dCQUN6QyxVQUFVLENBQUMsaUJB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QUUsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUN4QztZQUYwQyxjQUFRLEdBQVIsUUFBUSxDQUFnQjs7UUFFbkUsQ0FBQztRQUVELG9EQUFlLEdBQWYsVUFBZ0IsSUFBeUI7WUFDdkMsSUFBSSxJQUFJLENBQUMsTUFBTSxLQUFLLG9DQUFzQixDQUFDLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxFQUFFO2dCQUNoRSxPQUFPLEtBQUssQ0FBQzthQUNkO1lBRUQsK0VBQStFO1lBQy9FLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDMUQsSUFBSSxRQUFRLEtBQUssSUFBSSxDQUFDLFFBQVEsRUFBRTtnQkFDOUIsT0FBTyxLQUFLLENBQUM7YUFDZDtZQUVELGdGQUFnRjtZQUNoRixPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQy9DLENBQUM7UUFDSCxpQ0FBQztJQUFELENBQUMsQUFyQkQsQ0FBeUMsMEJBQTBCLEdBcUJsRSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge1BhcnNlRXJyb3IsIHBhcnNlVGVtcGxhdGUsIFRtcGxBc3ROb2RlfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHthYnNvbHV0ZUZyb21Tb3VyY2VGaWxlLCBBYnNvbHV0ZUZzUGF0aCwgZ2V0U291cmNlRmlsZU9yRXJyb3J9IGZyb20gJy4uLy4uL2ZpbGVfc3lzdGVtJztcbmltcG9ydCB7UmVmZXJlbmNlRW1pdHRlcn0gZnJvbSAnLi4vLi4vaW1wb3J0cyc7XG5pbXBvcnQge0luY3JlbWVudGFsQnVpbGR9IGZyb20gJy4uLy4uL2luY3JlbWVudGFsL2FwaSc7XG5pbXBvcnQge1JlZmxlY3Rpb25Ib3N0fSBmcm9tICcuLi8uLi9yZWZsZWN0aW9uJztcbmltcG9ydCB7aXNTaGltfSBmcm9tICcuLi8uLi9zaGltcyc7XG5pbXBvcnQge2dldFNvdXJjZUZpbGVPck51bGx9IGZyb20gJy4uLy4uL3V0aWwvc3JjL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtPcHRpbWl6ZUZvciwgUHJvZ3JhbVR5cGVDaGVja0FkYXB0ZXIsIFRlbXBsYXRlSWQsIFRlbXBsYXRlVHlwZUNoZWNrZXIsIFR5cGVDaGVja2luZ0NvbmZpZywgVHlwZUNoZWNraW5nUHJvZ3JhbVN0cmF0ZWd5LCBVcGRhdGVNb2RlfSBmcm9tICcuLi9hcGknO1xuaW1wb3J0IHtUZW1wbGF0ZURpYWdub3N0aWN9IGZyb20gJy4uL2RpYWdub3N0aWNzJztcblxuaW1wb3J0IHtJbmxpbmluZ01vZGUsIFNoaW1UeXBlQ2hlY2tpbmdEYXRhLCBUeXBlQ2hlY2tDb250ZXh0SW1wbCwgVHlwZUNoZWNraW5nSG9zdH0gZnJvbSAnLi9jb250ZXh0JztcbmltcG9ydCB7ZmluZFR5cGVDaGVja0Jsb2NrLCBzaG91bGRSZXBvcnREaWFnbm9zdGljLCBUZW1wbGF0ZVNvdXJjZVJlc29sdmVyLCB0cmFuc2xhdGVEaWFnbm9zdGljfSBmcm9tICcuL2RpYWdub3N0aWNzJztcbmltcG9ydCB7VGVtcGxhdGVTb3VyY2VNYW5hZ2VyfSBmcm9tICcuL3NvdXJjZSc7XG5cbi8qKlxuICogUHJpbWFyeSB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIGVuZ2luZSwgd2hpY2ggcGVyZm9ybXMgdHlwZS1jaGVja2luZyB1c2luZyBhXG4gKiBgVHlwZUNoZWNraW5nUHJvZ3JhbVN0cmF0ZWd5YCBmb3IgdHlwZS1jaGVja2luZyBwcm9ncmFtIG1haW50ZW5hbmNlLCBhbmQgdGhlXG4gKiBgUHJvZ3JhbVR5cGVDaGVja0FkYXB0ZXJgIGZvciBnZW5lcmF0aW9uIG9mIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgY29kZS5cbiAqL1xuZXhwb3J0IGNsYXNzIFRlbXBsYXRlVHlwZUNoZWNrZXJJbXBsIGltcGxlbWVudHMgVGVtcGxhdGVUeXBlQ2hlY2tlciB7XG4gIHByaXZhdGUgc3RhdGUgPSBuZXcgTWFwPEFic29sdXRlRnNQYXRoLCBGaWxlVHlwZUNoZWNraW5nRGF0YT4oKTtcbiAgcHJpdmF0ZSBpc0NvbXBsZXRlID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIG9yaWdpbmFsUHJvZ3JhbTogdHMuUHJvZ3JhbSxcbiAgICAgIHJlYWRvbmx5IHR5cGVDaGVja2luZ1N0cmF0ZWd5OiBUeXBlQ2hlY2tpbmdQcm9ncmFtU3RyYXRlZ3ksXG4gICAgICBwcml2YXRlIHR5cGVDaGVja0FkYXB0ZXI6IFByb2dyYW1UeXBlQ2hlY2tBZGFwdGVyLCBwcml2YXRlIGNvbmZpZzogVHlwZUNoZWNraW5nQ29uZmlnLFxuICAgICAgcHJpdmF0ZSByZWZFbWl0dGVyOiBSZWZlcmVuY2VFbWl0dGVyLCBwcml2YXRlIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsXG4gICAgICBwcml2YXRlIGNvbXBpbGVySG9zdDogUGljazx0cy5Db21waWxlckhvc3QsICdnZXRDYW5vbmljYWxGaWxlTmFtZSc+LFxuICAgICAgcHJpdmF0ZSBwcmlvckJ1aWxkOiBJbmNyZW1lbnRhbEJ1aWxkPHVua25vd24sIEZpbGVUeXBlQ2hlY2tpbmdEYXRhPikge31cblxuICByZXNldE92ZXJyaWRlcygpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGZpbGVSZWNvcmQgb2YgdGhpcy5zdGF0ZS52YWx1ZXMoKSkge1xuICAgICAgaWYgKGZpbGVSZWNvcmQudGVtcGxhdGVPdmVycmlkZXMgIT09IG51bGwpIHtcbiAgICAgICAgZmlsZVJlY29yZC50ZW1wbGF0ZU92ZXJyaWRlcyA9IG51bGw7XG4gICAgICAgIGZpbGVSZWNvcmQuc2hpbURhdGEuY2xlYXIoKTtcbiAgICAgICAgZmlsZVJlY29yZC5pc0NvbXBsZXRlID0gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZ2V0VGVtcGxhdGUoY29tcG9uZW50OiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogVG1wbEFzdE5vZGVbXXxudWxsIHtcbiAgICB0aGlzLmVuc3VyZVNoaW1Gb3JDb21wb25lbnQoY29tcG9uZW50KTtcblxuICAgIGNvbnN0IHNmID0gY29tcG9uZW50LmdldFNvdXJjZUZpbGUoKTtcbiAgICBjb25zdCBzZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcbiAgICBjb25zdCBzaGltUGF0aCA9IHRoaXMudHlwZUNoZWNraW5nU3RyYXRlZ3kuc2hpbVBhdGhGb3JDb21wb25lbnQoY29tcG9uZW50KTtcblxuICAgIGNvbnN0IGZpbGVSZWNvcmQgPSB0aGlzLmdldEZpbGVEYXRhKHNmUGF0aCk7XG5cbiAgICBpZiAoIWZpbGVSZWNvcmQuc2hpbURhdGEuaGFzKHNoaW1QYXRoKSkge1xuICAgICAgcmV0dXJuIFtdO1xuICAgIH1cblxuICAgIGNvbnN0IHRlbXBsYXRlSWQgPSBmaWxlUmVjb3JkLnNvdXJjZU1hbmFnZXIuZ2V0VGVtcGxhdGVJZChjb21wb25lbnQpO1xuICAgIGNvbnN0IHNoaW1SZWNvcmQgPSBmaWxlUmVjb3JkLnNoaW1EYXRhLmdldChzaGltUGF0aCkhO1xuXG4gICAgaWYgKCFzaGltUmVjb3JkLnRlbXBsYXRlcy5oYXModGVtcGxhdGVJZCkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBzaGltUmVjb3JkLnRlbXBsYXRlcy5nZXQodGVtcGxhdGVJZCkhLnRlbXBsYXRlO1xuICB9XG5cbiAgb3ZlcnJpZGVDb21wb25lbnRUZW1wbGF0ZShjb21wb25lbnQ6IHRzLkNsYXNzRGVjbGFyYXRpb24sIHRlbXBsYXRlOiBzdHJpbmcpOlxuICAgICAge25vZGVzOiBUbXBsQXN0Tm9kZVtdLCBlcnJvcnM/OiBQYXJzZUVycm9yW119IHtcbiAgICBjb25zdCB7bm9kZXMsIGVycm9yc30gPSBwYXJzZVRlbXBsYXRlKHRlbXBsYXRlLCAnb3ZlcnJpZGUuaHRtbCcsIHtcbiAgICAgIHByZXNlcnZlV2hpdGVzcGFjZXM6IHRydWUsXG4gICAgICBsZWFkaW5nVHJpdmlhQ2hhcnM6IFtdLFxuICAgIH0pO1xuXG4gICAgaWYgKGVycm9ycyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4ge25vZGVzLCBlcnJvcnN9O1xuICAgIH1cblxuICAgIGNvbnN0IGZpbGVQYXRoID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShjb21wb25lbnQuZ2V0U291cmNlRmlsZSgpKTtcblxuICAgIGNvbnN0IGZpbGVSZWNvcmQgPSB0aGlzLmdldEZpbGVEYXRhKGZpbGVQYXRoKTtcbiAgICBjb25zdCBpZCA9IGZpbGVSZWNvcmQuc291cmNlTWFuYWdlci5nZXRUZW1wbGF0ZUlkKGNvbXBvbmVudCk7XG5cbiAgICBpZiAoZmlsZVJlY29yZC50ZW1wbGF0ZU92ZXJyaWRlcyA9PT0gbnVsbCkge1xuICAgICAgZmlsZVJlY29yZC50ZW1wbGF0ZU92ZXJyaWRlcyA9IG5ldyBNYXAoKTtcbiAgICB9XG5cbiAgICBmaWxlUmVjb3JkLnRlbXBsYXRlT3ZlcnJpZGVzLnNldChpZCwgbm9kZXMpO1xuXG4gICAgLy8gQ2xlYXIgZGF0YSBmb3IgdGhlIHNoaW0gaW4gcXVlc3Rpb24sIHNvIGl0J2xsIGJlIHJlZ2VuZXJhdGVkIG9uIHRoZSBuZXh0IHJlcXVlc3QuXG4gICAgY29uc3Qgc2hpbUZpbGUgPSB0aGlzLnR5cGVDaGVja2luZ1N0cmF0ZWd5LnNoaW1QYXRoRm9yQ29tcG9uZW50KGNvbXBvbmVudCk7XG4gICAgZmlsZVJlY29yZC5zaGltRGF0YS5kZWxldGUoc2hpbUZpbGUpO1xuICAgIGZpbGVSZWNvcmQuaXNDb21wbGV0ZSA9IGZhbHNlO1xuICAgIHRoaXMuaXNDb21wbGV0ZSA9IGZhbHNlO1xuXG4gICAgcmV0dXJuIHtub2Rlc307XG4gIH1cblxuICAvKipcbiAgICogUmV0cmlldmUgdHlwZS1jaGVja2luZyBkaWFnbm9zdGljcyBmcm9tIHRoZSBnaXZlbiBgdHMuU291cmNlRmlsZWAgdXNpbmcgdGhlIG1vc3QgcmVjZW50XG4gICAqIHR5cGUtY2hlY2tpbmcgcHJvZ3JhbS5cbiAgICovXG4gIGdldERpYWdub3N0aWNzRm9yRmlsZShzZjogdHMuU291cmNlRmlsZSwgb3B0aW1pemVGb3I6IE9wdGltaXplRm9yKTogdHMuRGlhZ25vc3RpY1tdIHtcbiAgICBzd2l0Y2ggKG9wdGltaXplRm9yKSB7XG4gICAgICBjYXNlIE9wdGltaXplRm9yLldob2xlUHJvZ3JhbTpcbiAgICAgICAgdGhpcy5lbnN1cmVBbGxTaGltc0ZvckFsbEZpbGVzKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBPcHRpbWl6ZUZvci5TaW5nbGVGaWxlOlxuICAgICAgICB0aGlzLmVuc3VyZUFsbFNoaW1zRm9yT25lRmlsZShzZik7XG4gICAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuICAgIGNvbnN0IGZpbGVSZWNvcmQgPSB0aGlzLnN0YXRlLmdldChzZlBhdGgpITtcblxuICAgIGNvbnN0IHR5cGVDaGVja1Byb2dyYW0gPSB0aGlzLnR5cGVDaGVja2luZ1N0cmF0ZWd5LmdldFByb2dyYW0oKTtcblxuICAgIGNvbnN0IGRpYWdub3N0aWNzOiAodHMuRGlhZ25vc3RpY3xudWxsKVtdID0gW107XG4gICAgaWYgKGZpbGVSZWNvcmQuaGFzSW5saW5lcykge1xuICAgICAgY29uc3QgaW5saW5lU2YgPSBnZXRTb3VyY2VGaWxlT3JFcnJvcih0eXBlQ2hlY2tQcm9ncmFtLCBzZlBhdGgpO1xuICAgICAgZGlhZ25vc3RpY3MucHVzaCguLi50eXBlQ2hlY2tQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3MoaW5saW5lU2YpLm1hcChcbiAgICAgICAgICBkaWFnID0+IGNvbnZlcnREaWFnbm9zdGljKGRpYWcsIGZpbGVSZWNvcmQuc291cmNlTWFuYWdlcikpKTtcbiAgICB9XG5cbiAgICBmb3IgKGNvbnN0IFtzaGltUGF0aCwgc2hpbVJlY29yZF0gb2YgZmlsZVJlY29yZC5zaGltRGF0YSkge1xuICAgICAgY29uc3Qgc2hpbVNmID0gZ2V0U291cmNlRmlsZU9yRXJyb3IodHlwZUNoZWNrUHJvZ3JhbSwgc2hpbVBhdGgpO1xuICAgICAgZGlhZ25vc3RpY3MucHVzaCguLi50eXBlQ2hlY2tQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2hpbVNmKS5tYXAoXG4gICAgICAgICAgZGlhZyA9PiBjb252ZXJ0RGlhZ25vc3RpYyhkaWFnLCBmaWxlUmVjb3JkLnNvdXJjZU1hbmFnZXIpKSk7XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnNoaW1SZWNvcmQuZ2VuZXNpc0RpYWdub3N0aWNzKTtcbiAgICB9XG5cbiAgICByZXR1cm4gZGlhZ25vc3RpY3MuZmlsdGVyKChkaWFnOiB0cy5EaWFnbm9zdGljfG51bGwpOiBkaWFnIGlzIHRzLkRpYWdub3N0aWMgPT4gZGlhZyAhPT0gbnVsbCk7XG4gIH1cblxuICBnZXREaWFnbm9zdGljc0ZvckNvbXBvbmVudChjb21wb25lbnQ6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiB0cy5EaWFnbm9zdGljW10ge1xuICAgIHRoaXMuZW5zdXJlU2hpbUZvckNvbXBvbmVudChjb21wb25lbnQpO1xuXG4gICAgY29uc3Qgc2YgPSBjb21wb25lbnQuZ2V0U291cmNlRmlsZSgpO1xuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuICAgIGNvbnN0IHNoaW1QYXRoID0gdGhpcy50eXBlQ2hlY2tpbmdTdHJhdGVneS5zaGltUGF0aEZvckNvbXBvbmVudChjb21wb25lbnQpO1xuXG4gICAgY29uc3QgZmlsZVJlY29yZCA9IHRoaXMuZ2V0RmlsZURhdGEoc2ZQYXRoKTtcblxuICAgIGlmICghZmlsZVJlY29yZC5zaGltRGF0YS5oYXMoc2hpbVBhdGgpKSB7XG4gICAgICByZXR1cm4gW107XG4gICAgfVxuXG4gICAgY29uc3QgdGVtcGxhdGVJZCA9IGZpbGVSZWNvcmQuc291cmNlTWFuYWdlci5nZXRUZW1wbGF0ZUlkKGNvbXBvbmVudCk7XG4gICAgY29uc3Qgc2hpbVJlY29yZCA9IGZpbGVSZWNvcmQuc2hpbURhdGEuZ2V0KHNoaW1QYXRoKSE7XG5cbiAgICBjb25zdCB0eXBlQ2hlY2tQcm9ncmFtID0gdGhpcy50eXBlQ2hlY2tpbmdTdHJhdGVneS5nZXRQcm9ncmFtKCk7XG5cbiAgICBjb25zdCBkaWFnbm9zdGljczogKFRlbXBsYXRlRGlhZ25vc3RpY3xudWxsKVtdID0gW107XG4gICAgaWYgKHNoaW1SZWNvcmQuaGFzSW5saW5lcykge1xuICAgICAgY29uc3QgaW5saW5lU2YgPSBnZXRTb3VyY2VGaWxlT3JFcnJvcih0eXBlQ2hlY2tQcm9ncmFtLCBzZlBhdGgpO1xuICAgICAgZGlhZ25vc3RpY3MucHVzaCguLi50eXBlQ2hlY2tQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3MoaW5saW5lU2YpLm1hcChcbiAgICAgICAgICBkaWFnID0+IGNvbnZlcnREaWFnbm9zdGljKGRpYWcsIGZpbGVSZWNvcmQuc291cmNlTWFuYWdlcikpKTtcbiAgICB9XG5cbiAgICBjb25zdCBzaGltU2YgPSBnZXRTb3VyY2VGaWxlT3JFcnJvcih0eXBlQ2hlY2tQcm9ncmFtLCBzaGltUGF0aCk7XG4gICAgZGlhZ25vc3RpY3MucHVzaCguLi50eXBlQ2hlY2tQcm9ncmFtLmdldFNlbWFudGljRGlhZ25vc3RpY3Moc2hpbVNmKS5tYXAoXG4gICAgICAgIGRpYWcgPT4gY29udmVydERpYWdub3N0aWMoZGlhZywgZmlsZVJlY29yZC5zb3VyY2VNYW5hZ2VyKSkpO1xuICAgIGRpYWdub3N0aWNzLnB1c2goLi4uc2hpbVJlY29yZC5nZW5lc2lzRGlhZ25vc3RpY3MpO1xuXG4gICAgcmV0dXJuIGRpYWdub3N0aWNzLmZpbHRlcihcbiAgICAgICAgKGRpYWc6IFRlbXBsYXRlRGlhZ25vc3RpY3xudWxsKTogZGlhZyBpcyBUZW1wbGF0ZURpYWdub3N0aWMgPT5cbiAgICAgICAgICAgIGRpYWcgIT09IG51bGwgJiYgZGlhZy50ZW1wbGF0ZUlkID09PSB0ZW1wbGF0ZUlkKTtcbiAgfVxuXG4gIGdldFR5cGVDaGVja0Jsb2NrKGNvbXBvbmVudDogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IHRzLk5vZGV8bnVsbCB7XG4gICAgdGhpcy5lbnN1cmVBbGxTaGltc0Zvck9uZUZpbGUoY29tcG9uZW50LmdldFNvdXJjZUZpbGUoKSk7XG5cbiAgICBjb25zdCBwcm9ncmFtID0gdGhpcy50eXBlQ2hlY2tpbmdTdHJhdGVneS5nZXRQcm9ncmFtKCk7XG4gICAgY29uc3QgZmlsZVBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKGNvbXBvbmVudC5nZXRTb3VyY2VGaWxlKCkpO1xuICAgIGNvbnN0IHNoaW1QYXRoID0gdGhpcy50eXBlQ2hlY2tpbmdTdHJhdGVneS5zaGltUGF0aEZvckNvbXBvbmVudChjb21wb25lbnQpO1xuXG4gICAgaWYgKCF0aGlzLnN0YXRlLmhhcyhmaWxlUGF0aCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3I6IG5vIGRhdGEgZm9yIHNvdXJjZSBmaWxlOiAke2ZpbGVQYXRofWApO1xuICAgIH1cbiAgICBjb25zdCBmaWxlUmVjb3JkID0gdGhpcy5zdGF0ZS5nZXQoZmlsZVBhdGgpITtcbiAgICBjb25zdCBpZCA9IGZpbGVSZWNvcmQuc291cmNlTWFuYWdlci5nZXRUZW1wbGF0ZUlkKGNvbXBvbmVudCk7XG5cbiAgICBjb25zdCBzaGltU2YgPSBnZXRTb3VyY2VGaWxlT3JOdWxsKHByb2dyYW0sIHNoaW1QYXRoKTtcbiAgICBpZiAoc2hpbVNmID09PSBudWxsIHx8ICFmaWxlUmVjb3JkLnNoaW1EYXRhLmhhcyhzaGltUGF0aCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3I6IG5vIHNoaW0gZmlsZSBpbiBwcm9ncmFtOiAke3NoaW1QYXRofWApO1xuICAgIH1cblxuICAgIGxldCBub2RlOiB0cy5Ob2RlfG51bGwgPSBmaW5kVHlwZUNoZWNrQmxvY2soc2hpbVNmLCBpZCk7XG4gICAgaWYgKG5vZGUgPT09IG51bGwpIHtcbiAgICAgIC8vIFRyeSBmb3IgYW4gaW5saW5lIGJsb2NrLlxuICAgICAgY29uc3QgaW5saW5lU2YgPSBnZXRTb3VyY2VGaWxlT3JFcnJvcihwcm9ncmFtLCBmaWxlUGF0aCk7XG4gICAgICBub2RlID0gZmluZFR5cGVDaGVja0Jsb2NrKGlubGluZVNmLCBpZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICBwcml2YXRlIG1heWJlQWRvcHRQcmlvclJlc3VsdHNGb3JGaWxlKHNmOiB0cy5Tb3VyY2VGaWxlKTogdm9pZCB7XG4gICAgY29uc3Qgc2ZQYXRoID0gYWJzb2x1dGVGcm9tU291cmNlRmlsZShzZik7XG4gICAgaWYgKHRoaXMuc3RhdGUuaGFzKHNmUGF0aCkpIHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nUmVzdWx0cyA9IHRoaXMuc3RhdGUuZ2V0KHNmUGF0aCkhO1xuICAgICAgaWYgKGV4aXN0aW5nUmVzdWx0cy50ZW1wbGF0ZU92ZXJyaWRlcyAhPT0gbnVsbCkge1xuICAgICAgICAvLyBDYW5ub3QgYWRvcHQgcHJpb3IgcmVzdWx0cyBpZiB0ZW1wbGF0ZSBvdmVycmlkZXMgaGF2ZSBiZWVuIHJlcXVlc3RlZC5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAoZXhpc3RpbmdSZXN1bHRzLmlzQ29tcGxldGUpIHtcbiAgICAgICAgLy8gQWxsIGRhdGEgZm9yIHRoaXMgZmlsZSBoYXMgYWxyZWFkeSBiZWVuIGdlbmVyYXRlZCwgc28gbm8gbmVlZCB0byBhZG9wdCBhbnl0aGluZy5cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHByZXZpb3VzUmVzdWx0cyA9IHRoaXMucHJpb3JCdWlsZC5wcmlvclR5cGVDaGVja2luZ1Jlc3VsdHNGb3Ioc2YpO1xuICAgIGlmIChwcmV2aW91c1Jlc3VsdHMgPT09IG51bGwgfHwgIXByZXZpb3VzUmVzdWx0cy5pc0NvbXBsZXRlIHx8XG4gICAgICAgIHByZXZpb3VzUmVzdWx0cy50ZW1wbGF0ZU92ZXJyaWRlcyAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuc3RhdGUuc2V0KHNmUGF0aCwgcHJldmlvdXNSZXN1bHRzKTtcbiAgfVxuXG4gIHByaXZhdGUgZW5zdXJlQWxsU2hpbXNGb3JBbGxGaWxlcygpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5pc0NvbXBsZXRlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgaG9zdCA9IG5ldyBXaG9sZVByb2dyYW1UeXBlQ2hlY2tpbmdIb3N0KHRoaXMpO1xuICAgIGNvbnN0IGN0eCA9IHRoaXMubmV3Q29udGV4dChob3N0KTtcblxuICAgIGZvciAoY29uc3Qgc2Ygb2YgdGhpcy5vcmlnaW5hbFByb2dyYW0uZ2V0U291cmNlRmlsZXMoKSkge1xuICAgICAgaWYgKHNmLmlzRGVjbGFyYXRpb25GaWxlIHx8IGlzU2hpbShzZikpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHRoaXMubWF5YmVBZG9wdFByaW9yUmVzdWx0c0ZvckZpbGUoc2YpO1xuXG4gICAgICBjb25zdCBzZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcbiAgICAgIGNvbnN0IGZpbGVEYXRhID0gdGhpcy5nZXRGaWxlRGF0YShzZlBhdGgpO1xuICAgICAgaWYgKGZpbGVEYXRhLmlzQ29tcGxldGUpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIHRoaXMudHlwZUNoZWNrQWRhcHRlci50eXBlQ2hlY2soc2YsIGN0eCk7XG5cbiAgICAgIGZpbGVEYXRhLmlzQ29tcGxldGUgPSB0cnVlO1xuICAgIH1cblxuICAgIHRoaXMudXBkYXRlRnJvbUNvbnRleHQoY3R4KTtcbiAgICB0aGlzLmlzQ29tcGxldGUgPSB0cnVlO1xuICB9XG5cbiAgcHJpdmF0ZSBlbnN1cmVBbGxTaGltc0Zvck9uZUZpbGUoc2Y6IHRzLlNvdXJjZUZpbGUpOiB2b2lkIHtcbiAgICB0aGlzLm1heWJlQWRvcHRQcmlvclJlc3VsdHNGb3JGaWxlKHNmKTtcblxuICAgIGNvbnN0IHNmUGF0aCA9IGFic29sdXRlRnJvbVNvdXJjZUZpbGUoc2YpO1xuXG4gICAgY29uc3QgZmlsZURhdGEgPSB0aGlzLmdldEZpbGVEYXRhKHNmUGF0aCk7XG4gICAgaWYgKGZpbGVEYXRhLmlzQ29tcGxldGUpIHtcbiAgICAgIC8vIEFsbCBkYXRhIGZvciB0aGlzIGZpbGUgaXMgcHJlc2VudCBhbmQgYWNjb3VudGVkIGZvciBhbHJlYWR5LlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGhvc3QgPSBuZXcgU2luZ2xlRmlsZVR5cGVDaGVja2luZ0hvc3Qoc2ZQYXRoLCBmaWxlRGF0YSwgdGhpcy50eXBlQ2hlY2tpbmdTdHJhdGVneSwgdGhpcyk7XG4gICAgY29uc3QgY3R4ID0gdGhpcy5uZXdDb250ZXh0KGhvc3QpO1xuXG4gICAgdGhpcy50eXBlQ2hlY2tBZGFwdGVyLnR5cGVDaGVjayhzZiwgY3R4KTtcblxuICAgIGZpbGVEYXRhLmlzQ29tcGxldGUgPSB0cnVlO1xuXG4gICAgdGhpcy51cGRhdGVGcm9tQ29udGV4dChjdHgpO1xuICB9XG5cbiAgcHJpdmF0ZSBlbnN1cmVTaGltRm9yQ29tcG9uZW50KGNvbXBvbmVudDogdHMuQ2xhc3NEZWNsYXJhdGlvbik6IHZvaWQge1xuICAgIGNvbnN0IHNmID0gY29tcG9uZW50LmdldFNvdXJjZUZpbGUoKTtcbiAgICBjb25zdCBzZlBhdGggPSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKHNmKTtcblxuICAgIHRoaXMubWF5YmVBZG9wdFByaW9yUmVzdWx0c0ZvckZpbGUoc2YpO1xuXG4gICAgY29uc3QgZmlsZURhdGEgPSB0aGlzLmdldEZpbGVEYXRhKHNmUGF0aCk7XG4gICAgY29uc3Qgc2hpbVBhdGggPSB0aGlzLnR5cGVDaGVja2luZ1N0cmF0ZWd5LnNoaW1QYXRoRm9yQ29tcG9uZW50KGNvbXBvbmVudCk7XG5cbiAgICBpZiAoZmlsZURhdGEuc2hpbURhdGEuaGFzKHNoaW1QYXRoKSkge1xuICAgICAgLy8gQWxsIGRhdGEgZm9yIHRoaXMgY29tcG9uZW50IGlzIGF2YWlsYWJsZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBob3N0ID1cbiAgICAgICAgbmV3IFNpbmdsZVNoaW1UeXBlQ2hlY2tpbmdIb3N0KHNmUGF0aCwgZmlsZURhdGEsIHRoaXMudHlwZUNoZWNraW5nU3RyYXRlZ3ksIHRoaXMsIHNoaW1QYXRoKTtcbiAgICBjb25zdCBjdHggPSB0aGlzLm5ld0NvbnRleHQoaG9zdCk7XG5cbiAgICB0aGlzLnR5cGVDaGVja0FkYXB0ZXIudHlwZUNoZWNrKHNmLCBjdHgpO1xuICAgIHRoaXMudXBkYXRlRnJvbUNvbnRleHQoY3R4KTtcbiAgfVxuXG4gIHByaXZhdGUgbmV3Q29udGV4dChob3N0OiBUeXBlQ2hlY2tpbmdIb3N0KTogVHlwZUNoZWNrQ29udGV4dEltcGwge1xuICAgIGNvbnN0IGlubGluaW5nID0gdGhpcy50eXBlQ2hlY2tpbmdTdHJhdGVneS5zdXBwb3J0c0lubGluZU9wZXJhdGlvbnMgPyBJbmxpbmluZ01vZGUuSW5saW5lT3BzIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgSW5saW5pbmdNb2RlLkVycm9yO1xuICAgIHJldHVybiBuZXcgVHlwZUNoZWNrQ29udGV4dEltcGwoXG4gICAgICAgIHRoaXMuY29uZmlnLCB0aGlzLmNvbXBpbGVySG9zdCwgdGhpcy50eXBlQ2hlY2tpbmdTdHJhdGVneSwgdGhpcy5yZWZFbWl0dGVyLCB0aGlzLnJlZmxlY3RvcixcbiAgICAgICAgaG9zdCwgaW5saW5pbmcpO1xuICB9XG5cbiAgLyoqXG4gICAqIFJlbW92ZSBhbnkgc2hpbSBkYXRhIHRoYXQgZGVwZW5kcyBvbiBpbmxpbmUgb3BlcmF0aW9ucyBhcHBsaWVkIHRvIHRoZSB0eXBlLWNoZWNraW5nIHByb2dyYW0uXG4gICAqXG4gICAqIFRoaXMgY2FuIGJlIHVzZWZ1bCBpZiBuZXcgaW5saW5lcyBuZWVkIHRvIGJlIGFwcGxpZWQsIGFuZCBpdCdzIG5vdCBwb3NzaWJsZSB0byBndWFyYW50ZWUgdGhhdFxuICAgKiB0aGV5IHdvbid0IG92ZXJ3cml0ZSBvciBjb3JydXB0IGV4aXN0aW5nIGlubGluZXMgdGhhdCBhcmUgdXNlZCBieSBzdWNoIHNoaW1zLlxuICAgKi9cbiAgY2xlYXJBbGxTaGltRGF0YVVzaW5nSW5saW5lcygpOiB2b2lkIHtcbiAgICBmb3IgKGNvbnN0IGZpbGVEYXRhIG9mIHRoaXMuc3RhdGUudmFsdWVzKCkpIHtcbiAgICAgIGlmICghZmlsZURhdGEuaGFzSW5saW5lcykge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgZm9yIChjb25zdCBbc2hpbUZpbGUsIHNoaW1EYXRhXSBvZiBmaWxlRGF0YS5zaGltRGF0YS5lbnRyaWVzKCkpIHtcbiAgICAgICAgaWYgKHNoaW1EYXRhLmhhc0lubGluZXMpIHtcbiAgICAgICAgICBmaWxlRGF0YS5zaGltRGF0YS5kZWxldGUoc2hpbUZpbGUpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGZpbGVEYXRhLmhhc0lubGluZXMgPSBmYWxzZTtcbiAgICAgIGZpbGVEYXRhLmlzQ29tcGxldGUgPSBmYWxzZTtcbiAgICAgIHRoaXMuaXNDb21wbGV0ZSA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlRnJvbUNvbnRleHQoY3R4OiBUeXBlQ2hlY2tDb250ZXh0SW1wbCk6IHZvaWQge1xuICAgIGNvbnN0IHVwZGF0ZXMgPSBjdHguZmluYWxpemUoKTtcbiAgICB0aGlzLnR5cGVDaGVja2luZ1N0cmF0ZWd5LnVwZGF0ZUZpbGVzKHVwZGF0ZXMsIFVwZGF0ZU1vZGUuSW5jcmVtZW50YWwpO1xuICAgIHRoaXMucHJpb3JCdWlsZC5yZWNvcmRTdWNjZXNzZnVsVHlwZUNoZWNrKHRoaXMuc3RhdGUpO1xuICB9XG5cbiAgZ2V0RmlsZURhdGEocGF0aDogQWJzb2x1dGVGc1BhdGgpOiBGaWxlVHlwZUNoZWNraW5nRGF0YSB7XG4gICAgaWYgKCF0aGlzLnN0YXRlLmhhcyhwYXRoKSkge1xuICAgICAgdGhpcy5zdGF0ZS5zZXQocGF0aCwge1xuICAgICAgICBoYXNJbmxpbmVzOiBmYWxzZSxcbiAgICAgICAgdGVtcGxhdGVPdmVycmlkZXM6IG51bGwsXG4gICAgICAgIHNvdXJjZU1hbmFnZXI6IG5ldyBUZW1wbGF0ZVNvdXJjZU1hbmFnZXIoKSxcbiAgICAgICAgaXNDb21wbGV0ZTogZmFsc2UsXG4gICAgICAgIHNoaW1EYXRhOiBuZXcgTWFwKCksXG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc3RhdGUuZ2V0KHBhdGgpITtcbiAgfVxufVxuXG5mdW5jdGlvbiBjb252ZXJ0RGlhZ25vc3RpYyhcbiAgICBkaWFnOiB0cy5EaWFnbm9zdGljLCBzb3VyY2VSZXNvbHZlcjogVGVtcGxhdGVTb3VyY2VSZXNvbHZlcik6IFRlbXBsYXRlRGlhZ25vc3RpY3xudWxsIHtcbiAgaWYgKCFzaG91bGRSZXBvcnREaWFnbm9zdGljKGRpYWcpKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbiAgcmV0dXJuIHRyYW5zbGF0ZURpYWdub3N0aWMoZGlhZywgc291cmNlUmVzb2x2ZXIpO1xufVxuXG4vKipcbiAqIERhdGEgZm9yIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgcmVsYXRlZCB0byBhIHNwZWNpZmljIGlucHV0IGZpbGUgaW4gdGhlIHVzZXIncyBwcm9ncmFtICh3aGljaFxuICogY29udGFpbnMgY29tcG9uZW50cyB0byBiZSBjaGVja2VkKS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBGaWxlVHlwZUNoZWNraW5nRGF0YSB7XG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSB0eXBlLWNoZWNraW5nIHNoaW0gcmVxdWlyZWQgYW55IGlubGluZSBjaGFuZ2VzIHRvIHRoZSBvcmlnaW5hbCBmaWxlLCB3aGljaCBhZmZlY3RzXG4gICAqIHdoZXRoZXIgdGhlIHNoaW0gY2FuIGJlIHJldXNlZC5cbiAgICovXG4gIGhhc0lubGluZXM6IGJvb2xlYW47XG5cbiAgLyoqXG4gICAqIFNvdXJjZSBtYXBwaW5nIGluZm9ybWF0aW9uIGZvciBtYXBwaW5nIGRpYWdub3N0aWNzIGZyb20gaW5saW5lZCB0eXBlIGNoZWNrIGJsb2NrcyBiYWNrIHRvIHRoZVxuICAgKiBvcmlnaW5hbCB0ZW1wbGF0ZS5cbiAgICovXG4gIHNvdXJjZU1hbmFnZXI6IFRlbXBsYXRlU291cmNlTWFuYWdlcjtcblxuICAvKipcbiAgICogTWFwIG9mIHRlbXBsYXRlIG92ZXJyaWRlcyBhcHBsaWVkIHRvIGFueSBjb21wb25lbnRzIGluIHRoaXMgaW5wdXQgZmlsZS5cbiAgICovXG4gIHRlbXBsYXRlT3ZlcnJpZGVzOiBNYXA8VGVtcGxhdGVJZCwgVG1wbEFzdE5vZGVbXT58bnVsbDtcblxuICAvKipcbiAgICogRGF0YSBmb3IgZWFjaCBzaGltIGdlbmVyYXRlZCBmcm9tIHRoaXMgaW5wdXQgZmlsZS5cbiAgICpcbiAgICogQSBzaW5nbGUgaW5wdXQgZmlsZSB3aWxsIGdlbmVyYXRlIG9uZSBvciBtb3JlIHNoaW0gZmlsZXMgdGhhdCBhY3R1YWxseSBjb250YWluIHRlbXBsYXRlXG4gICAqIHR5cGUtY2hlY2tpbmcgY29kZS5cbiAgICovXG4gIHNoaW1EYXRhOiBNYXA8QWJzb2x1dGVGc1BhdGgsIFNoaW1UeXBlQ2hlY2tpbmdEYXRhPjtcblxuICAvKipcbiAgICogV2hldGhlciB0aGUgdGVtcGxhdGUgdHlwZS1jaGVja2VyIGlzIGNlcnRhaW4gdGhhdCBhbGwgY29tcG9uZW50cyBmcm9tIHRoaXMgaW5wdXQgZmlsZSBoYXZlIGhhZFxuICAgKiB0eXBlLWNoZWNraW5nIGNvZGUgZ2VuZXJhdGVkIGludG8gc2hpbXMuXG4gICAqL1xuICBpc0NvbXBsZXRlOiBib29sZWFuO1xufVxuXG4vKipcbiAqIERyaXZlcyBhIGBUeXBlQ2hlY2tDb250ZXh0YCB0byBnZW5lcmF0ZSB0eXBlLWNoZWNraW5nIGNvZGUgZm9yIGV2ZXJ5IGNvbXBvbmVudCBpbiB0aGUgcHJvZ3JhbS5cbiAqL1xuY2xhc3MgV2hvbGVQcm9ncmFtVHlwZUNoZWNraW5nSG9zdCBpbXBsZW1lbnRzIFR5cGVDaGVja2luZ0hvc3Qge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIGltcGw6IFRlbXBsYXRlVHlwZUNoZWNrZXJJbXBsKSB7fVxuXG4gIGdldFNvdXJjZU1hbmFnZXIoc2ZQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IFRlbXBsYXRlU291cmNlTWFuYWdlciB7XG4gICAgcmV0dXJuIHRoaXMuaW1wbC5nZXRGaWxlRGF0YShzZlBhdGgpLnNvdXJjZU1hbmFnZXI7XG4gIH1cblxuICBzaG91bGRDaGVja0NvbXBvbmVudChub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogYm9vbGVhbiB7XG4gICAgY29uc3QgZmlsZURhdGEgPSB0aGlzLmltcGwuZ2V0RmlsZURhdGEoYWJzb2x1dGVGcm9tU291cmNlRmlsZShub2RlLmdldFNvdXJjZUZpbGUoKSkpO1xuICAgIGNvbnN0IHNoaW1QYXRoID0gdGhpcy5pbXBsLnR5cGVDaGVja2luZ1N0cmF0ZWd5LnNoaW1QYXRoRm9yQ29tcG9uZW50KG5vZGUpO1xuICAgIC8vIFRoZSBjb21wb25lbnQgbmVlZHMgdG8gYmUgY2hlY2tlZCB1bmxlc3MgdGhlIHNoaW0gd2hpY2ggd291bGQgY29udGFpbiBpdCBhbHJlYWR5IGV4aXN0cy5cbiAgICByZXR1cm4gIWZpbGVEYXRhLnNoaW1EYXRhLmhhcyhzaGltUGF0aCk7XG4gIH1cblxuICBnZXRUZW1wbGF0ZU92ZXJyaWRlKHNmUGF0aDogQWJzb2x1dGVGc1BhdGgsIG5vZGU6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBUbXBsQXN0Tm9kZVtdfG51bGwge1xuICAgIGNvbnN0IGZpbGVEYXRhID0gdGhpcy5pbXBsLmdldEZpbGVEYXRhKHNmUGF0aCk7XG4gICAgaWYgKGZpbGVEYXRhLnRlbXBsYXRlT3ZlcnJpZGVzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wbGF0ZUlkID0gZmlsZURhdGEuc291cmNlTWFuYWdlci5nZXRUZW1wbGF0ZUlkKG5vZGUpO1xuICAgIGlmIChmaWxlRGF0YS50ZW1wbGF0ZU92ZXJyaWRlcy5oYXModGVtcGxhdGVJZCkpIHtcbiAgICAgIHJldHVybiBmaWxlRGF0YS50ZW1wbGF0ZU92ZXJyaWRlcy5nZXQodGVtcGxhdGVJZCkhO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmVjb3JkU2hpbURhdGEoc2ZQYXRoOiBBYnNvbHV0ZUZzUGF0aCwgZGF0YTogU2hpbVR5cGVDaGVja2luZ0RhdGEpOiB2b2lkIHtcbiAgICBjb25zdCBmaWxlRGF0YSA9IHRoaXMuaW1wbC5nZXRGaWxlRGF0YShzZlBhdGgpO1xuICAgIGZpbGVEYXRhLnNoaW1EYXRhLnNldChkYXRhLnBhdGgsIGRhdGEpO1xuICAgIGlmIChkYXRhLmhhc0lubGluZXMpIHtcbiAgICAgIGZpbGVEYXRhLmhhc0lubGluZXMgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIHJlY29yZENvbXBsZXRlKHNmUGF0aDogQWJzb2x1dGVGc1BhdGgpOiB2b2lkIHtcbiAgICB0aGlzLmltcGwuZ2V0RmlsZURhdGEoc2ZQYXRoKS5pc0NvbXBsZXRlID0gdHJ1ZTtcbiAgfVxufVxuXG4vKipcbiAqIERyaXZlcyBhIGBUeXBlQ2hlY2tDb250ZXh0YCB0byBnZW5lcmF0ZSB0eXBlLWNoZWNraW5nIGNvZGUgZWZmaWNpZW50bHkgZm9yIGEgc2luZ2xlIGlucHV0IGZpbGUuXG4gKi9cbmNsYXNzIFNpbmdsZUZpbGVUeXBlQ2hlY2tpbmdIb3N0IGltcGxlbWVudHMgVHlwZUNoZWNraW5nSG9zdCB7XG4gIHByaXZhdGUgc2VlbklubGluZXMgPSBmYWxzZTtcblxuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByb3RlY3RlZCBzZlBhdGg6IEFic29sdXRlRnNQYXRoLCBwcm90ZWN0ZWQgZmlsZURhdGE6IEZpbGVUeXBlQ2hlY2tpbmdEYXRhLFxuICAgICAgcHJvdGVjdGVkIHN0cmF0ZWd5OiBUeXBlQ2hlY2tpbmdQcm9ncmFtU3RyYXRlZ3ksIHByb3RlY3RlZCBpbXBsOiBUZW1wbGF0ZVR5cGVDaGVja2VySW1wbCkge31cblxuICBwcml2YXRlIGFzc2VydFBhdGgoc2ZQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IHZvaWQge1xuICAgIGlmICh0aGlzLnNmUGF0aCAhPT0gc2ZQYXRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEFzc2VydGlvbkVycm9yOiBxdWVyeWluZyBUeXBlQ2hlY2tpbmdIb3N0IG91dHNpZGUgb2YgYXNzaWduZWQgZmlsZWApO1xuICAgIH1cbiAgfVxuXG4gIGdldFNvdXJjZU1hbmFnZXIoc2ZQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IFRlbXBsYXRlU291cmNlTWFuYWdlciB7XG4gICAgdGhpcy5hc3NlcnRQYXRoKHNmUGF0aCk7XG4gICAgcmV0dXJuIHRoaXMuZmlsZURhdGEuc291cmNlTWFuYWdlcjtcbiAgfVxuXG4gIHNob3VsZENoZWNrQ29tcG9uZW50KG5vZGU6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBib29sZWFuIHtcbiAgICBpZiAodGhpcy5zZlBhdGggIT09IGFic29sdXRlRnJvbVNvdXJjZUZpbGUobm9kZS5nZXRTb3VyY2VGaWxlKCkpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICAgIGNvbnN0IHNoaW1QYXRoID0gdGhpcy5zdHJhdGVneS5zaGltUGF0aEZvckNvbXBvbmVudChub2RlKTtcblxuICAgIC8vIE9ubHkgbmVlZCB0byBnZW5lcmF0ZSBhIFRDQiBmb3IgdGhlIGNsYXNzIGlmIG5vIHNoaW0gZXhpc3RzIGZvciBpdCBjdXJyZW50bHkuXG4gICAgcmV0dXJuICF0aGlzLmZpbGVEYXRhLnNoaW1EYXRhLmhhcyhzaGltUGF0aCk7XG4gIH1cblxuICBnZXRUZW1wbGF0ZU92ZXJyaWRlKHNmUGF0aDogQWJzb2x1dGVGc1BhdGgsIG5vZGU6IHRzLkNsYXNzRGVjbGFyYXRpb24pOiBUbXBsQXN0Tm9kZVtdfG51bGwge1xuICAgIHRoaXMuYXNzZXJ0UGF0aChzZlBhdGgpO1xuICAgIGlmICh0aGlzLmZpbGVEYXRhLnRlbXBsYXRlT3ZlcnJpZGVzID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wbGF0ZUlkID0gdGhpcy5maWxlRGF0YS5zb3VyY2VNYW5hZ2VyLmdldFRlbXBsYXRlSWQobm9kZSk7XG4gICAgaWYgKHRoaXMuZmlsZURhdGEudGVtcGxhdGVPdmVycmlkZXMuaGFzKHRlbXBsYXRlSWQpKSB7XG4gICAgICByZXR1cm4gdGhpcy5maWxlRGF0YS50ZW1wbGF0ZU92ZXJyaWRlcy5nZXQodGVtcGxhdGVJZCkhO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmVjb3JkU2hpbURhdGEoc2ZQYXRoOiBBYnNvbHV0ZUZzUGF0aCwgZGF0YTogU2hpbVR5cGVDaGVja2luZ0RhdGEpOiB2b2lkIHtcbiAgICB0aGlzLmFzc2VydFBhdGgoc2ZQYXRoKTtcblxuICAgIC8vIFByZXZpb3VzIHR5cGUtY2hlY2tpbmcgc3RhdGUgbWF5IGhhdmUgcmVxdWlyZWQgdGhlIHVzZSBvZiBpbmxpbmVzIChhc3N1bWluZyB0aGV5IHdlcmVcbiAgICAvLyBzdXBwb3J0ZWQpLiBJZiB0aGUgY3VycmVudCBvcGVyYXRpb24gYWxzbyByZXF1aXJlcyBpbmxpbmVzLCB0aGlzIHByZXNlbnRzIGEgcHJvYmxlbTpcbiAgICAvLyBnZW5lcmF0aW5nIG5ldyBpbmxpbmVzIG1heSBpbnZhbGlkYXRlIGFueSBvbGQgaW5saW5lcyB0aGF0IG9sZCBzdGF0ZSBkZXBlbmRzIG9uLlxuICAgIC8vXG4gICAgLy8gUmF0aGVyIHRoYW4gcmVzb2x2ZSB0aGlzIGlzc3VlIGJ5IHRyYWNraW5nIHNwZWNpZmljIGRlcGVuZGVuY2llcyBvbiBpbmxpbmVzLCBpZiB0aGUgbmV3IHN0YXRlXG4gICAgLy8gcmVsaWVzIG9uIGlubGluZXMsIGFueSBvbGQgc3RhdGUgdGhhdCByZWxpZWQgb24gdGhlbSBpcyBzaW1wbHkgY2xlYXJlZC4gVGhpcyBoYXBwZW5zIHdoZW4gdGhlXG4gICAgLy8gZmlyc3QgbmV3IHN0YXRlIHRoYXQgdXNlcyBpbmxpbmVzIGlzIGVuY291bnRlcmVkLlxuICAgIGlmIChkYXRhLmhhc0lubGluZXMgJiYgIXRoaXMuc2VlbklubGluZXMpIHtcbiAgICAgIHRoaXMuaW1wbC5jbGVhckFsbFNoaW1EYXRhVXNpbmdJbmxpbmVzKCk7XG4gICAgICB0aGlzLnNlZW5JbmxpbmVzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLmZpbGVEYXRhLnNoaW1EYXRhLnNldChkYXRhLnBhdGgsIGRhdGEpO1xuICAgIGlmIChkYXRhLmhhc0lubGluZXMpIHtcbiAgICAgIHRoaXMuZmlsZURhdGEuaGFzSW5saW5lcyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgcmVjb3JkQ29tcGxldGUoc2ZQYXRoOiBBYnNvbHV0ZUZzUGF0aCk6IHZvaWQge1xuICAgIHRoaXMuYXNzZXJ0UGF0aChzZlBhdGgpO1xuICAgIHRoaXMuZmlsZURhdGEuaXNDb21wbGV0ZSA9IHRydWU7XG4gIH1cbn1cblxuLyoqXG4gKiBEcml2ZXMgYSBgVHlwZUNoZWNrQ29udGV4dGAgdG8gZ2VuZXJhdGUgdHlwZS1jaGVja2luZyBjb2RlIGVmZmljaWVudGx5IGZvciBvbmx5IHRob3NlIGNvbXBvbmVudHNcbiAqIHdoaWNoIG1hcCB0byBhIHNpbmdsZSBzaGltIG9mIGEgc2luZ2xlIGlucHV0IGZpbGUuXG4gKi9cbmNsYXNzIFNpbmdsZVNoaW1UeXBlQ2hlY2tpbmdIb3N0IGV4dGVuZHMgU2luZ2xlRmlsZVR5cGVDaGVja2luZ0hvc3Qge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHNmUGF0aDogQWJzb2x1dGVGc1BhdGgsIGZpbGVEYXRhOiBGaWxlVHlwZUNoZWNraW5nRGF0YSwgc3RyYXRlZ3k6IFR5cGVDaGVja2luZ1Byb2dyYW1TdHJhdGVneSxcbiAgICAgIGltcGw6IFRlbXBsYXRlVHlwZUNoZWNrZXJJbXBsLCBwcml2YXRlIHNoaW1QYXRoOiBBYnNvbHV0ZUZzUGF0aCkge1xuICAgIHN1cGVyKHNmUGF0aCwgZmlsZURhdGEsIHN0cmF0ZWd5LCBpbXBsKTtcbiAgfVxuXG4gIHNob3VsZENoZWNrTm9kZShub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogYm9vbGVhbiB7XG4gICAgaWYgKHRoaXMuc2ZQYXRoICE9PSBhYnNvbHV0ZUZyb21Tb3VyY2VGaWxlKG5vZGUuZ2V0U291cmNlRmlsZSgpKSkge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIE9ubHkgZ2VuZXJhdGUgYSBUQ0IgZm9yIHRoZSBjb21wb25lbnQgaWYgaXQgbWFwcyB0byB0aGUgcmVxdWVzdGVkIHNoaW0gZmlsZS5cbiAgICBjb25zdCBzaGltUGF0aCA9IHRoaXMuc3RyYXRlZ3kuc2hpbVBhdGhGb3JDb21wb25lbnQobm9kZSk7XG4gICAgaWYgKHNoaW1QYXRoICE9PSB0aGlzLnNoaW1QYXRoKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gT25seSBuZWVkIHRvIGdlbmVyYXRlIGEgVENCIGZvciB0aGUgY2xhc3MgaWYgbm8gc2hpbSBleGlzdHMgZm9yIGl0IGN1cnJlbnRseS5cbiAgICByZXR1cm4gIXRoaXMuZmlsZURhdGEuc2hpbURhdGEuaGFzKHNoaW1QYXRoKTtcbiAgfVxufVxuIl19