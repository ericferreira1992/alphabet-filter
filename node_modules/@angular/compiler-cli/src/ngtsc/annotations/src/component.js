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
        define("@angular/compiler-cli/src/ngtsc/annotations/src/component", ["require", "exports", "tslib", "@angular/compiler", "typescript", "@angular/compiler-cli/src/ngtsc/diagnostics", "@angular/compiler-cli/src/ngtsc/file_system", "@angular/compiler-cli/src/ngtsc/imports", "@angular/compiler-cli/src/ngtsc/metadata", "@angular/compiler-cli/src/ngtsc/partial_evaluator", "@angular/compiler-cli/src/ngtsc/reflection", "@angular/compiler-cli/src/ngtsc/transform", "@angular/compiler-cli/src/ngtsc/typecheck/diagnostics", "@angular/compiler-cli/src/ngtsc/util/src/ts_source_map_bug_29300", "@angular/compiler-cli/src/ngtsc/annotations/src/diagnostics", "@angular/compiler-cli/src/ngtsc/annotations/src/directive", "@angular/compiler-cli/src/ngtsc/annotations/src/factory", "@angular/compiler-cli/src/ngtsc/annotations/src/metadata", "@angular/compiler-cli/src/ngtsc/annotations/src/typecheck_scopes", "@angular/compiler-cli/src/ngtsc/annotations/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ComponentDecoratorHandler = void 0;
    var tslib_1 = require("tslib");
    var compiler_1 = require("@angular/compiler");
    var ts = require("typescript");
    var diagnostics_1 = require("@angular/compiler-cli/src/ngtsc/diagnostics");
    var file_system_1 = require("@angular/compiler-cli/src/ngtsc/file_system");
    var imports_1 = require("@angular/compiler-cli/src/ngtsc/imports");
    var metadata_1 = require("@angular/compiler-cli/src/ngtsc/metadata");
    var partial_evaluator_1 = require("@angular/compiler-cli/src/ngtsc/partial_evaluator");
    var reflection_1 = require("@angular/compiler-cli/src/ngtsc/reflection");
    var transform_1 = require("@angular/compiler-cli/src/ngtsc/transform");
    var diagnostics_2 = require("@angular/compiler-cli/src/ngtsc/typecheck/diagnostics");
    var ts_source_map_bug_29300_1 = require("@angular/compiler-cli/src/ngtsc/util/src/ts_source_map_bug_29300");
    var diagnostics_3 = require("@angular/compiler-cli/src/ngtsc/annotations/src/diagnostics");
    var directive_1 = require("@angular/compiler-cli/src/ngtsc/annotations/src/directive");
    var factory_1 = require("@angular/compiler-cli/src/ngtsc/annotations/src/factory");
    var metadata_2 = require("@angular/compiler-cli/src/ngtsc/annotations/src/metadata");
    var typecheck_scopes_1 = require("@angular/compiler-cli/src/ngtsc/annotations/src/typecheck_scopes");
    var util_1 = require("@angular/compiler-cli/src/ngtsc/annotations/src/util");
    var EMPTY_MAP = new Map();
    var EMPTY_ARRAY = [];
    /**
     * `DecoratorHandler` which handles the `@Component` annotation.
     */
    var ComponentDecoratorHandler = /** @class */ (function () {
        function ComponentDecoratorHandler(reflector, evaluator, metaRegistry, metaReader, scopeReader, scopeRegistry, isCore, resourceLoader, rootDirs, defaultPreserveWhitespaces, i18nUseExternalIds, enableI18nLegacyMessageIdFormat, i18nNormalizeLineEndingsInICUs, moduleResolver, cycleAnalyzer, refEmitter, defaultImportRecorder, depTracker, injectableRegistry, annotateForClosureCompiler) {
            this.reflector = reflector;
            this.evaluator = evaluator;
            this.metaRegistry = metaRegistry;
            this.metaReader = metaReader;
            this.scopeReader = scopeReader;
            this.scopeRegistry = scopeRegistry;
            this.isCore = isCore;
            this.resourceLoader = resourceLoader;
            this.rootDirs = rootDirs;
            this.defaultPreserveWhitespaces = defaultPreserveWhitespaces;
            this.i18nUseExternalIds = i18nUseExternalIds;
            this.enableI18nLegacyMessageIdFormat = enableI18nLegacyMessageIdFormat;
            this.i18nNormalizeLineEndingsInICUs = i18nNormalizeLineEndingsInICUs;
            this.moduleResolver = moduleResolver;
            this.cycleAnalyzer = cycleAnalyzer;
            this.refEmitter = refEmitter;
            this.defaultImportRecorder = defaultImportRecorder;
            this.depTracker = depTracker;
            this.injectableRegistry = injectableRegistry;
            this.annotateForClosureCompiler = annotateForClosureCompiler;
            this.literalCache = new Map();
            this.elementSchemaRegistry = new compiler_1.DomElementSchemaRegistry();
            this.typeCheckScopes = new typecheck_scopes_1.TypeCheckScopes(this.scopeReader, this.metaReader);
            /**
             * During the asynchronous preanalyze phase, it's necessary to parse the template to extract
             * any potential <link> tags which might need to be loaded. This cache ensures that work is not
             * thrown away, and the parsed template is reused during the analyze phase.
             */
            this.preanalyzeTemplateCache = new Map();
            this.precedence = transform_1.HandlerPrecedence.PRIMARY;
            this.name = ComponentDecoratorHandler.name;
        }
        ComponentDecoratorHandler.prototype.detect = function (node, decorators) {
            if (!decorators) {
                return undefined;
            }
            var decorator = util_1.findAngularDecorator(decorators, 'Component', this.isCore);
            if (decorator !== undefined) {
                return {
                    trigger: decorator.node,
                    decorator: decorator,
                    metadata: decorator,
                };
            }
            else {
                return undefined;
            }
        };
        ComponentDecoratorHandler.prototype.preanalyze = function (node, decorator) {
            // In preanalyze, resource URLs associated with the component are asynchronously preloaded via
            // the resourceLoader. This is the only time async operations are allowed for a component.
            // These resources are:
            //
            // - the templateUrl, if there is one
            // - any styleUrls if present
            // - any stylesheets referenced from <link> tags in the template itself
            //
            // As a result of the last one, the template must be parsed as part of preanalysis to extract
            // <link> tags, which may involve waiting for the templateUrl to be resolved first.
            var _this = this;
            // If preloading isn't possible, then skip this step.
            if (!this.resourceLoader.canPreload) {
                return undefined;
            }
            var meta = this._resolveLiteral(decorator);
            var component = reflection_1.reflectObjectLiteral(meta);
            var containingFile = node.getSourceFile().fileName;
            // Convert a styleUrl string into a Promise to preload it.
            var resolveStyleUrl = function (styleUrl) {
                var resourceUrl = _this.resourceLoader.resolve(styleUrl, containingFile);
                var promise = _this.resourceLoader.preload(resourceUrl);
                return promise || Promise.resolve();
            };
            // A Promise that waits for the template and all <link>ed styles within it to be preloaded.
            var templateAndTemplateStyleResources = this._preloadAndParseTemplate(node, decorator, component, containingFile).then(function (template) {
                if (template === null) {
                    return undefined;
                }
                else {
                    return Promise.all(template.styleUrls.map(resolveStyleUrl)).then(function () { return undefined; });
                }
            });
            // Extract all the styleUrls in the decorator.
            var styleUrls = this._extractStyleUrls(component, []);
            if (styleUrls === null) {
                // A fast path exists if there are no styleUrls, to just wait for
                // templateAndTemplateStyleResources.
                return templateAndTemplateStyleResources;
            }
            else {
                // Wait for both the template and all styleUrl resources to resolve.
                return Promise.all(tslib_1.__spread([templateAndTemplateStyleResources], styleUrls.map(resolveStyleUrl)))
                    .then(function () { return undefined; });
            }
        };
        ComponentDecoratorHandler.prototype.analyze = function (node, decorator, flags) {
            var e_1, _a;
            if (flags === void 0) { flags = transform_1.HandlerFlags.NONE; }
            var containingFile = node.getSourceFile().fileName;
            this.literalCache.delete(decorator);
            // @Component inherits @Directive, so begin by extracting the @Directive metadata and building
            // on it.
            var directiveResult = directive_1.extractDirectiveMetadata(node, decorator, this.reflector, this.evaluator, this.defaultImportRecorder, this.isCore, flags, this.annotateForClosureCompiler, this.elementSchemaRegistry.getDefaultComponentElementName());
            if (directiveResult === undefined) {
                // `extractDirectiveMetadata` returns undefined when the @Directive has `jit: true`. In this
                // case, compilation of the decorator is skipped. Returning an empty object signifies
                // that no analysis was produced.
                return {};
            }
            // Next, read the `@Component`-specific fields.
            var component = directiveResult.decorator, metadata = directiveResult.metadata, inputs = directiveResult.inputs, outputs = directiveResult.outputs;
            // Go through the root directories for this project, and select the one with the smallest
            // relative path representation.
            var relativeContextFilePath = this.rootDirs.reduce(function (previous, rootDir) {
                var candidate = file_system_1.relative(file_system_1.absoluteFrom(rootDir), file_system_1.absoluteFrom(containingFile));
                if (previous === undefined || candidate.length < previous.length) {
                    return candidate;
                }
                else {
                    return previous;
                }
            }, undefined);
            // Note that we could technically combine the `viewProvidersRequiringFactory` and
            // `providersRequiringFactory` into a single set, but we keep the separate so that
            // we can distinguish where an error is coming from when logging the diagnostics in `resolve`.
            var viewProvidersRequiringFactory = null;
            var providersRequiringFactory = null;
            var wrappedViewProviders = null;
            if (component.has('viewProviders')) {
                var viewProviders = component.get('viewProviders');
                viewProvidersRequiringFactory =
                    util_1.resolveProvidersRequiringFactory(viewProviders, this.reflector, this.evaluator);
                wrappedViewProviders = new compiler_1.WrappedNodeExpr(this.annotateForClosureCompiler ? util_1.wrapFunctionExpressionsInParens(viewProviders) :
                    viewProviders);
            }
            if (component.has('providers')) {
                providersRequiringFactory = util_1.resolveProvidersRequiringFactory(component.get('providers'), this.reflector, this.evaluator);
            }
            // Parse the template.
            // If a preanalyze phase was executed, the template may already exist in parsed form, so check
            // the preanalyzeTemplateCache.
            // Extract a closure of the template parsing code so that it can be reparsed with different
            // options if needed, like in the indexing pipeline.
            var template;
            if (this.preanalyzeTemplateCache.has(node)) {
                // The template was parsed in preanalyze. Use it and delete it to save memory.
                var preanalyzed = this.preanalyzeTemplateCache.get(node);
                this.preanalyzeTemplateCache.delete(node);
                template = preanalyzed;
            }
            else {
                // The template was not already parsed. Either there's a templateUrl, or an inline template.
                if (component.has('templateUrl')) {
                    var templateUrlExpr = component.get('templateUrl');
                    var templateUrl = this.evaluator.evaluate(templateUrlExpr);
                    if (typeof templateUrl !== 'string') {
                        throw diagnostics_3.createValueHasWrongTypeError(templateUrlExpr, templateUrl, 'templateUrl must be a string');
                    }
                    var resourceUrl = this.resourceLoader.resolve(templateUrl, containingFile);
                    template = this._extractExternalTemplate(node, component, templateUrlExpr, resourceUrl);
                }
                else {
                    // Expect an inline template to be present.
                    template = this._extractInlineTemplate(node, decorator, component, containingFile);
                }
            }
            var diagnostics = undefined;
            if (template.errors !== undefined) {
                // If there are any template parsing errors, convert them to `ts.Diagnostic`s for display.
                var id_1 = diagnostics_2.getTemplateId(node);
                diagnostics = template.errors.map(function (error) {
                    var span = error.span;
                    if (span.start.offset === span.end.offset) {
                        // Template errors can contain zero-length spans, if the error occurs at a single point.
                        // However, TypeScript does not handle displaying a zero-length diagnostic very well, so
                        // increase the ending offset by 1 for such errors, to ensure the position is shown in the
                        // diagnostic.
                        span.end.offset++;
                    }
                    return diagnostics_2.makeTemplateDiagnostic(id_1, template.sourceMapping, span, ts.DiagnosticCategory.Error, diagnostics_1.ngErrorCode(diagnostics_1.ErrorCode.TEMPLATE_PARSE_ERROR), error.msg);
                });
            }
            // Figure out the set of styles. The ordering here is important: external resources (styleUrls)
            // precede inline styles, and styles defined in the template override styles defined in the
            // component.
            var styles = null;
            var styleUrls = this._extractStyleUrls(component, template.styleUrls);
            if (styleUrls !== null) {
                if (styles === null) {
                    styles = [];
                }
                try {
                    for (var styleUrls_1 = tslib_1.__values(styleUrls), styleUrls_1_1 = styleUrls_1.next(); !styleUrls_1_1.done; styleUrls_1_1 = styleUrls_1.next()) {
                        var styleUrl = styleUrls_1_1.value;
                        var resourceUrl = this.resourceLoader.resolve(styleUrl, containingFile);
                        var resourceStr = this.resourceLoader.load(resourceUrl);
                        styles.push(resourceStr);
                        if (this.depTracker !== null) {
                            this.depTracker.addResourceDependency(node.getSourceFile(), file_system_1.absoluteFrom(resourceUrl));
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (styleUrls_1_1 && !styleUrls_1_1.done && (_a = styleUrls_1.return)) _a.call(styleUrls_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            if (component.has('styles')) {
                var litStyles = directive_1.parseFieldArrayValue(component, 'styles', this.evaluator);
                if (litStyles !== null) {
                    if (styles === null) {
                        styles = litStyles;
                    }
                    else {
                        styles.push.apply(styles, tslib_1.__spread(litStyles));
                    }
                }
            }
            if (template.styles.length > 0) {
                if (styles === null) {
                    styles = template.styles;
                }
                else {
                    styles.push.apply(styles, tslib_1.__spread(template.styles));
                }
            }
            var encapsulation = this._resolveEnumValue(component, 'encapsulation', 'ViewEncapsulation') || 0;
            var changeDetection = this._resolveEnumValue(component, 'changeDetection', 'ChangeDetectionStrategy');
            var animations = null;
            if (component.has('animations')) {
                animations = new compiler_1.WrappedNodeExpr(component.get('animations'));
            }
            var output = {
                analysis: {
                    baseClass: util_1.readBaseClass(node, this.reflector, this.evaluator),
                    inputs: inputs,
                    outputs: outputs,
                    meta: tslib_1.__assign(tslib_1.__assign({}, metadata), { template: {
                            nodes: template.emitNodes,
                            ngContentSelectors: template.ngContentSelectors,
                        }, encapsulation: encapsulation, interpolation: template.interpolation, styles: styles || [], 
                        // These will be replaced during the compilation step, after all `NgModule`s have been
                        // analyzed and the full compilation scope for the component can be realized.
                        animations: animations, viewProviders: wrappedViewProviders, i18nUseExternalIds: this.i18nUseExternalIds, relativeContextFilePath: relativeContextFilePath }),
                    typeCheckMeta: metadata_1.extractDirectiveTypeCheckMeta(node, inputs, this.reflector),
                    metadataStmt: metadata_2.generateSetClassMetadataCall(node, this.reflector, this.defaultImportRecorder, this.isCore, this.annotateForClosureCompiler),
                    template: template,
                    providersRequiringFactory: providersRequiringFactory,
                    viewProvidersRequiringFactory: viewProvidersRequiringFactory,
                },
                diagnostics: diagnostics,
            };
            if (changeDetection !== null) {
                output.analysis.meta.changeDetection = changeDetection;
            }
            return output;
        };
        ComponentDecoratorHandler.prototype.register = function (node, analysis) {
            // Register this component's information with the `MetadataRegistry`. This ensures that
            // the information about the component is available during the compile() phase.
            var ref = new imports_1.Reference(node);
            this.metaRegistry.registerDirectiveMetadata(tslib_1.__assign({ ref: ref, name: node.name.text, selector: analysis.meta.selector, exportAs: analysis.meta.exportAs, inputs: analysis.inputs, outputs: analysis.outputs, queries: analysis.meta.queries.map(function (query) { return query.propertyName; }), isComponent: true, baseClass: analysis.baseClass }, analysis.typeCheckMeta));
            this.injectableRegistry.registerInjectable(node);
        };
        ComponentDecoratorHandler.prototype.index = function (context, node, analysis) {
            var e_2, _a;
            var scope = this.scopeReader.getScopeForComponent(node);
            var selector = analysis.meta.selector;
            var matcher = new compiler_1.SelectorMatcher();
            if (scope === 'error') {
                // Don't bother indexing components which had erroneous scopes.
                return null;
            }
            if (scope !== null) {
                try {
                    for (var _b = tslib_1.__values(scope.compilation.directives), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var directive = _c.value;
                        if (directive.selector !== null) {
                            matcher.addSelectables(compiler_1.CssSelector.parse(directive.selector), directive);
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
            var binder = new compiler_1.R3TargetBinder(matcher);
            var boundTemplate = binder.bind({ template: analysis.template.diagNodes });
            context.addComponent({
                declaration: node,
                selector: selector,
                boundTemplate: boundTemplate,
                templateMeta: {
                    isInline: analysis.template.isInline,
                    file: analysis.template.file,
                },
            });
        };
        ComponentDecoratorHandler.prototype.typeCheck = function (ctx, node, meta) {
            if (!ts.isClassDeclaration(node)) {
                return;
            }
            var scope = this.typeCheckScopes.getTypeCheckScope(node);
            if (scope === 'error') {
                // Don't type-check components that had errors in their scopes.
                return;
            }
            var binder = new compiler_1.R3TargetBinder(scope.matcher);
            ctx.addTemplate(new imports_1.Reference(node), binder, meta.template.diagNodes, scope.pipes, scope.schemas, meta.template.sourceMapping, meta.template.file);
        };
        ComponentDecoratorHandler.prototype.resolve = function (node, analysis) {
            var e_3, _a, e_4, _b, e_5, _c, e_6, _d, e_7, _e;
            var _this = this;
            var context = node.getSourceFile();
            // Check whether this component was registered with an NgModule. If so, it should be compiled
            // under that module's compilation scope.
            var scope = this.scopeReader.getScopeForComponent(node);
            var metadata = analysis.meta;
            var data = {
                directives: EMPTY_ARRAY,
                pipes: EMPTY_MAP,
                wrapDirectivesAndPipesInClosure: false,
            };
            if (scope !== null && scope !== 'error') {
                var matcher = new compiler_1.SelectorMatcher();
                try {
                    for (var _f = tslib_1.__values(scope.compilation.directives), _g = _f.next(); !_g.done; _g = _f.next()) {
                        var dir = _g.value;
                        if (dir.selector !== null) {
                            matcher.addSelectables(compiler_1.CssSelector.parse(dir.selector), dir);
                        }
                    }
                }
                catch (e_3_1) { e_3 = { error: e_3_1 }; }
                finally {
                    try {
                        if (_g && !_g.done && (_a = _f.return)) _a.call(_f);
                    }
                    finally { if (e_3) throw e_3.error; }
                }
                var pipes = new Map();
                try {
                    for (var _h = tslib_1.__values(scope.compilation.pipes), _j = _h.next(); !_j.done; _j = _h.next()) {
                        var pipe = _j.value;
                        pipes.set(pipe.name, pipe.ref);
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_j && !_j.done && (_b = _h.return)) _b.call(_h);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
                // Next, the component template AST is bound using the R3TargetBinder. This produces a
                // BoundTarget, which is similar to a ts.TypeChecker.
                var binder = new compiler_1.R3TargetBinder(matcher);
                var bound = binder.bind({ template: metadata.template.nodes });
                // The BoundTarget knows which directives and pipes matched the template.
                var usedDirectives = bound.getUsedDirectives().map(function (directive) {
                    return {
                        selector: directive.selector,
                        expression: _this.refEmitter.emit(directive.ref, context),
                    };
                });
                var usedPipes = [];
                try {
                    for (var _k = tslib_1.__values(bound.getUsedPipes()), _l = _k.next(); !_l.done; _l = _k.next()) {
                        var pipeName = _l.value;
                        if (!pipes.has(pipeName)) {
                            continue;
                        }
                        var pipe = pipes.get(pipeName);
                        usedPipes.push({
                            pipeName: pipeName,
                            expression: this.refEmitter.emit(pipe, context),
                        });
                    }
                }
                catch (e_5_1) { e_5 = { error: e_5_1 }; }
                finally {
                    try {
                        if (_l && !_l.done && (_c = _k.return)) _c.call(_k);
                    }
                    finally { if (e_5) throw e_5.error; }
                }
                // Scan through the directives/pipes actually used in the template and check whether any
                // import which needs to be generated would create a cycle.
                var cycleDetected = usedDirectives.some(function (dir) { return _this._isCyclicImport(dir.expression, context); }) ||
                    usedPipes.some(function (pipe) { return _this._isCyclicImport(pipe.expression, context); });
                if (!cycleDetected) {
                    try {
                        // No cycle was detected. Record the imports that need to be created in the cycle detector
                        // so that future cyclic import checks consider their production.
                        for (var usedDirectives_1 = tslib_1.__values(usedDirectives), usedDirectives_1_1 = usedDirectives_1.next(); !usedDirectives_1_1.done; usedDirectives_1_1 = usedDirectives_1.next()) {
                            var expression = usedDirectives_1_1.value.expression;
                            this._recordSyntheticImport(expression, context);
                        }
                    }
                    catch (e_6_1) { e_6 = { error: e_6_1 }; }
                    finally {
                        try {
                            if (usedDirectives_1_1 && !usedDirectives_1_1.done && (_d = usedDirectives_1.return)) _d.call(usedDirectives_1);
                        }
                        finally { if (e_6) throw e_6.error; }
                    }
                    try {
                        for (var usedPipes_1 = tslib_1.__values(usedPipes), usedPipes_1_1 = usedPipes_1.next(); !usedPipes_1_1.done; usedPipes_1_1 = usedPipes_1.next()) {
                            var expression = usedPipes_1_1.value.expression;
                            this._recordSyntheticImport(expression, context);
                        }
                    }
                    catch (e_7_1) { e_7 = { error: e_7_1 }; }
                    finally {
                        try {
                            if (usedPipes_1_1 && !usedPipes_1_1.done && (_e = usedPipes_1.return)) _e.call(usedPipes_1);
                        }
                        finally { if (e_7) throw e_7.error; }
                    }
                    // Check whether the directive/pipe arrays in ɵcmp need to be wrapped in closures.
                    // This is required if any directive/pipe reference is to a declaration in the same file but
                    // declared after this component.
                    var wrapDirectivesAndPipesInClosure = usedDirectives.some(function (dir) { return util_1.isExpressionForwardReference(dir.expression, node.name, context); }) ||
                        usedPipes.some(function (pipe) { return util_1.isExpressionForwardReference(pipe.expression, node.name, context); });
                    data.directives = usedDirectives;
                    data.pipes = new Map(usedPipes.map(function (pipe) { return [pipe.pipeName, pipe.expression]; }));
                    data.wrapDirectivesAndPipesInClosure = wrapDirectivesAndPipesInClosure;
                }
                else {
                    // Declaring the directiveDefs/pipeDefs arrays directly would require imports that would
                    // create a cycle. Instead, mark this component as requiring remote scoping, so that the
                    // NgModule file will take care of setting the directives for the component.
                    this.scopeRegistry.setComponentAsRequiringRemoteScoping(node);
                }
            }
            var diagnostics = [];
            if (analysis.providersRequiringFactory !== null &&
                analysis.meta.providers instanceof compiler_1.WrappedNodeExpr) {
                var providerDiagnostics = diagnostics_3.getProviderDiagnostics(analysis.providersRequiringFactory, analysis.meta.providers.node, this.injectableRegistry);
                diagnostics.push.apply(diagnostics, tslib_1.__spread(providerDiagnostics));
            }
            if (analysis.viewProvidersRequiringFactory !== null &&
                analysis.meta.viewProviders instanceof compiler_1.WrappedNodeExpr) {
                var viewProviderDiagnostics = diagnostics_3.getProviderDiagnostics(analysis.viewProvidersRequiringFactory, analysis.meta.viewProviders.node, this.injectableRegistry);
                diagnostics.push.apply(diagnostics, tslib_1.__spread(viewProviderDiagnostics));
            }
            var directiveDiagnostics = diagnostics_3.getDirectiveDiagnostics(node, this.metaReader, this.evaluator, this.reflector, this.scopeRegistry, 'Component');
            if (directiveDiagnostics !== null) {
                diagnostics.push.apply(diagnostics, tslib_1.__spread(directiveDiagnostics));
            }
            if (diagnostics.length > 0) {
                return { diagnostics: diagnostics };
            }
            return { data: data };
        };
        ComponentDecoratorHandler.prototype.compile = function (node, analysis, resolution, pool) {
            var meta = tslib_1.__assign(tslib_1.__assign({}, analysis.meta), resolution);
            var res = compiler_1.compileComponentFromMetadata(meta, pool, compiler_1.makeBindingParser());
            var factoryRes = factory_1.compileNgFactoryDefField(tslib_1.__assign(tslib_1.__assign({}, meta), { injectFn: compiler_1.Identifiers.directiveInject, target: compiler_1.R3FactoryTarget.Component }));
            if (analysis.metadataStmt !== null) {
                factoryRes.statements.push(analysis.metadataStmt);
            }
            return [
                factoryRes, {
                    name: 'ɵcmp',
                    initializer: res.expression,
                    statements: [],
                    type: res.type,
                }
            ];
        };
        ComponentDecoratorHandler.prototype._resolveLiteral = function (decorator) {
            if (this.literalCache.has(decorator)) {
                return this.literalCache.get(decorator);
            }
            if (decorator.args === null || decorator.args.length !== 1) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARITY_WRONG, reflection_1.Decorator.nodeForError(decorator), "Incorrect number of arguments to @Component decorator");
            }
            var meta = util_1.unwrapExpression(decorator.args[0]);
            if (!ts.isObjectLiteralExpression(meta)) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARG_NOT_LITERAL, meta, "Decorator argument must be literal.");
            }
            this.literalCache.set(decorator, meta);
            return meta;
        };
        ComponentDecoratorHandler.prototype._resolveEnumValue = function (component, field, enumSymbolName) {
            var resolved = null;
            if (component.has(field)) {
                var expr = component.get(field);
                var value = this.evaluator.evaluate(expr);
                if (value instanceof partial_evaluator_1.EnumValue && util_1.isAngularCoreReference(value.enumRef, enumSymbolName)) {
                    resolved = value.resolved;
                }
                else {
                    throw diagnostics_3.createValueHasWrongTypeError(expr, value, field + " must be a member of " + enumSymbolName + " enum from @angular/core");
                }
            }
            return resolved;
        };
        ComponentDecoratorHandler.prototype._extractStyleUrls = function (component, extraUrls) {
            if (!component.has('styleUrls')) {
                return extraUrls.length > 0 ? extraUrls : null;
            }
            var styleUrlsExpr = component.get('styleUrls');
            var styleUrls = this.evaluator.evaluate(styleUrlsExpr);
            if (!Array.isArray(styleUrls) || !styleUrls.every(function (url) { return typeof url === 'string'; })) {
                throw diagnostics_3.createValueHasWrongTypeError(styleUrlsExpr, styleUrls, 'styleUrls must be an array of strings');
            }
            styleUrls.push.apply(styleUrls, tslib_1.__spread(extraUrls));
            return styleUrls;
        };
        ComponentDecoratorHandler.prototype._preloadAndParseTemplate = function (node, decorator, component, containingFile) {
            var _this = this;
            if (component.has('templateUrl')) {
                // Extract the templateUrl and preload it.
                var templateUrlExpr_1 = component.get('templateUrl');
                var templateUrl = this.evaluator.evaluate(templateUrlExpr_1);
                if (typeof templateUrl !== 'string') {
                    throw diagnostics_3.createValueHasWrongTypeError(templateUrlExpr_1, templateUrl, 'templateUrl must be a string');
                }
                var resourceUrl_1 = this.resourceLoader.resolve(templateUrl, containingFile);
                var templatePromise = this.resourceLoader.preload(resourceUrl_1);
                // If the preload worked, then actually load and parse the template, and wait for any style
                // URLs to resolve.
                if (templatePromise !== undefined) {
                    return templatePromise.then(function () {
                        var template = _this._extractExternalTemplate(node, component, templateUrlExpr_1, resourceUrl_1);
                        _this.preanalyzeTemplateCache.set(node, template);
                        return template;
                    });
                }
                else {
                    return Promise.resolve(null);
                }
            }
            else {
                var template = this._extractInlineTemplate(node, decorator, component, containingFile);
                this.preanalyzeTemplateCache.set(node, template);
                return Promise.resolve(template);
            }
        };
        ComponentDecoratorHandler.prototype._extractExternalTemplate = function (node, component, templateUrlExpr, resourceUrl) {
            var templateStr = this.resourceLoader.load(resourceUrl);
            if (this.depTracker !== null) {
                this.depTracker.addResourceDependency(node.getSourceFile(), file_system_1.absoluteFrom(resourceUrl));
            }
            var template = this._parseTemplate(component, templateStr, sourceMapUrl(resourceUrl), /* templateRange */ undefined, 
            /* escapedString */ false);
            return tslib_1.__assign(tslib_1.__assign({}, template), { sourceMapping: {
                    type: 'external',
                    componentClass: node,
                    node: templateUrlExpr,
                    template: templateStr,
                    templateUrl: resourceUrl,
                } });
        };
        ComponentDecoratorHandler.prototype._extractInlineTemplate = function (node, decorator, component, containingFile) {
            if (!component.has('template')) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.COMPONENT_MISSING_TEMPLATE, reflection_1.Decorator.nodeForError(decorator), 'component is missing a template');
            }
            var templateExpr = component.get('template');
            var templateStr;
            var templateUrl = '';
            var templateRange = undefined;
            var sourceMapping;
            var escapedString = false;
            // We only support SourceMaps for inline templates that are simple string literals.
            if (ts.isStringLiteral(templateExpr) || ts.isNoSubstitutionTemplateLiteral(templateExpr)) {
                // the start and end of the `templateExpr` node includes the quotation marks, which we
                // must
                // strip
                templateRange = getTemplateRange(templateExpr);
                templateStr = templateExpr.getSourceFile().text;
                templateUrl = containingFile;
                escapedString = true;
                sourceMapping = {
                    type: 'direct',
                    node: templateExpr,
                };
            }
            else {
                var resolvedTemplate = this.evaluator.evaluate(templateExpr);
                if (typeof resolvedTemplate !== 'string') {
                    throw diagnostics_3.createValueHasWrongTypeError(templateExpr, resolvedTemplate, 'template must be a string');
                }
                templateStr = resolvedTemplate;
                sourceMapping = {
                    type: 'indirect',
                    node: templateExpr,
                    componentClass: node,
                    template: templateStr,
                };
            }
            var template = this._parseTemplate(component, templateStr, templateUrl, templateRange, escapedString);
            return tslib_1.__assign(tslib_1.__assign({}, template), { sourceMapping: sourceMapping });
        };
        ComponentDecoratorHandler.prototype._parseTemplate = function (component, templateStr, templateUrl, templateRange, escapedString) {
            var preserveWhitespaces = this.defaultPreserveWhitespaces;
            if (component.has('preserveWhitespaces')) {
                var expr = component.get('preserveWhitespaces');
                var value = this.evaluator.evaluate(expr);
                if (typeof value !== 'boolean') {
                    throw diagnostics_3.createValueHasWrongTypeError(expr, value, 'preserveWhitespaces must be a boolean');
                }
                preserveWhitespaces = value;
            }
            var interpolation = compiler_1.DEFAULT_INTERPOLATION_CONFIG;
            if (component.has('interpolation')) {
                var expr = component.get('interpolation');
                var value = this.evaluator.evaluate(expr);
                if (!Array.isArray(value) || value.length !== 2 ||
                    !value.every(function (element) { return typeof element === 'string'; })) {
                    throw diagnostics_3.createValueHasWrongTypeError(expr, value, 'interpolation must be an array with 2 elements of string type');
                }
                interpolation = compiler_1.InterpolationConfig.fromArray(value);
            }
            var _a = compiler_1.parseTemplate(templateStr, templateUrl, {
                preserveWhitespaces: preserveWhitespaces,
                interpolationConfig: interpolation,
                range: templateRange,
                escapedString: escapedString,
                enableI18nLegacyMessageIdFormat: this.enableI18nLegacyMessageIdFormat,
                i18nNormalizeLineEndingsInICUs: this.i18nNormalizeLineEndingsInICUs,
            }), errors = _a.errors, emitNodes = _a.nodes, styleUrls = _a.styleUrls, styles = _a.styles, ngContentSelectors = _a.ngContentSelectors;
            // Unfortunately, the primary parse of the template above may not contain accurate source map
            // information. If used directly, it would result in incorrect code locations in template
            // errors, etc. There are two main problems:
            //
            // 1. `preserveWhitespaces: false` annihilates the correctness of template source mapping, as
            //    the whitespace transformation changes the contents of HTML text nodes before they're
            //    parsed into Angular expressions.
            // 2. By default, the template parser strips leading trivia characters (like spaces, tabs, and
            //    newlines). This also destroys source mapping information.
            //
            // In order to guarantee the correctness of diagnostics, templates are parsed a second time with
            // the above options set to preserve source mappings.
            var diagNodes = compiler_1.parseTemplate(templateStr, templateUrl, {
                preserveWhitespaces: true,
                interpolationConfig: interpolation,
                range: templateRange,
                escapedString: escapedString,
                enableI18nLegacyMessageIdFormat: this.enableI18nLegacyMessageIdFormat,
                i18nNormalizeLineEndingsInICUs: this.i18nNormalizeLineEndingsInICUs,
                leadingTriviaChars: [],
            }).nodes;
            return {
                interpolation: interpolation,
                emitNodes: emitNodes,
                diagNodes: diagNodes,
                styleUrls: styleUrls,
                styles: styles,
                ngContentSelectors: ngContentSelectors,
                errors: errors,
                template: templateStr,
                templateUrl: templateUrl,
                isInline: component.has('template'),
                file: new compiler_1.ParseSourceFile(templateStr, templateUrl),
            };
        };
        ComponentDecoratorHandler.prototype._expressionToImportedFile = function (expr, origin) {
            if (!(expr instanceof compiler_1.ExternalExpr)) {
                return null;
            }
            // Figure out what file is being imported.
            return this.moduleResolver.resolveModule(expr.value.moduleName, origin.fileName);
        };
        ComponentDecoratorHandler.prototype._isCyclicImport = function (expr, origin) {
            var imported = this._expressionToImportedFile(expr, origin);
            if (imported === null) {
                return false;
            }
            // Check whether the import is legal.
            return this.cycleAnalyzer.wouldCreateCycle(origin, imported);
        };
        ComponentDecoratorHandler.prototype._recordSyntheticImport = function (expr, origin) {
            var imported = this._expressionToImportedFile(expr, origin);
            if (imported === null) {
                return;
            }
            this.cycleAnalyzer.recordSyntheticImport(origin, imported);
        };
        return ComponentDecoratorHandler;
    }());
    exports.ComponentDecoratorHandler = ComponentDecoratorHandler;
    function getTemplateRange(templateExpr) {
        var startPos = templateExpr.getStart() + 1;
        var _a = ts.getLineAndCharacterOfPosition(templateExpr.getSourceFile(), startPos), line = _a.line, character = _a.character;
        return {
            startPos: startPos,
            startLine: line,
            startCol: character,
            endPos: templateExpr.getEnd() - 1,
        };
    }
    function sourceMapUrl(resourceUrl) {
        if (!ts_source_map_bug_29300_1.tsSourceMapBug29300Fixed()) {
            // By removing the template URL we are telling the translator not to try to
            // map the external source file to the generated code, since the version
            // of TS that is running does not support it.
            return '';
        }
        else {
            return resourceUrl;
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9hbm5vdGF0aW9ucy9zcmMvY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw4Q0FBK2E7SUFDL2EsK0JBQWlDO0lBR2pDLDJFQUErRTtJQUMvRSwyRUFBeUQ7SUFDekQsbUVBQWlHO0lBR2pHLHFFQUFxTDtJQUNyTCx1RkFBb0U7SUFDcEUseUVBQW1HO0lBRW5HLHVFQUE4STtJQUU5SSxxRkFBa0Y7SUFDbEYsNEdBQWdGO0lBSWhGLDJGQUE0RztJQUM1Ryx1RkFBMkU7SUFDM0UsbUZBQW1EO0lBQ25ELHFGQUF3RDtJQUN4RCxxR0FBbUQ7SUFDbkQsNkVBQXFPO0lBRXJPLElBQU0sU0FBUyxHQUFHLElBQUksR0FBRyxFQUFzQixDQUFDO0lBQ2hELElBQU0sV0FBVyxHQUFVLEVBQUUsQ0FBQztJQXdDOUI7O09BRUc7SUFDSDtRQUVFLG1DQUNZLFNBQXlCLEVBQVUsU0FBMkIsRUFDOUQsWUFBOEIsRUFBVSxVQUEwQixFQUNsRSxXQUFpQyxFQUFVLGFBQXVDLEVBQ2xGLE1BQWUsRUFBVSxjQUE4QixFQUN2RCxRQUErQixFQUFVLDBCQUFtQyxFQUM1RSxrQkFBMkIsRUFBVSwrQkFBd0MsRUFDN0UsOEJBQWlELEVBQ2pELGNBQThCLEVBQVUsYUFBNEIsRUFDcEUsVUFBNEIsRUFBVSxxQkFBNEMsRUFDbEYsVUFBa0MsRUFDbEMsa0JBQTJDLEVBQzNDLDBCQUFtQztZQVhuQyxjQUFTLEdBQVQsU0FBUyxDQUFnQjtZQUFVLGNBQVMsR0FBVCxTQUFTLENBQWtCO1lBQzlELGlCQUFZLEdBQVosWUFBWSxDQUFrQjtZQUFVLGVBQVUsR0FBVixVQUFVLENBQWdCO1lBQ2xFLGdCQUFXLEdBQVgsV0FBVyxDQUFzQjtZQUFVLGtCQUFhLEdBQWIsYUFBYSxDQUEwQjtZQUNsRixXQUFNLEdBQU4sTUFBTSxDQUFTO1lBQVUsbUJBQWMsR0FBZCxjQUFjLENBQWdCO1lBQ3ZELGFBQVEsR0FBUixRQUFRLENBQXVCO1lBQVUsK0JBQTBCLEdBQTFCLDBCQUEwQixDQUFTO1lBQzVFLHVCQUFrQixHQUFsQixrQkFBa0IsQ0FBUztZQUFVLG9DQUErQixHQUEvQiwrQkFBK0IsQ0FBUztZQUM3RSxtQ0FBOEIsR0FBOUIsOEJBQThCLENBQW1CO1lBQ2pELG1CQUFjLEdBQWQsY0FBYyxDQUFnQjtZQUFVLGtCQUFhLEdBQWIsYUFBYSxDQUFlO1lBQ3BFLGVBQVUsR0FBVixVQUFVLENBQWtCO1lBQVUsMEJBQXFCLEdBQXJCLHFCQUFxQixDQUF1QjtZQUNsRixlQUFVLEdBQVYsVUFBVSxDQUF3QjtZQUNsQyx1QkFBa0IsR0FBbEIsa0JBQWtCLENBQXlCO1lBQzNDLCtCQUEwQixHQUExQiwwQkFBMEIsQ0FBUztZQUV2QyxpQkFBWSxHQUFHLElBQUksR0FBRyxFQUF5QyxDQUFDO1lBQ2hFLDBCQUFxQixHQUFHLElBQUksbUNBQXdCLEVBQUUsQ0FBQztZQUN2RCxvQkFBZSxHQUFHLElBQUksa0NBQWUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUVqRjs7OztlQUlHO1lBQ0ssNEJBQXVCLEdBQUcsSUFBSSxHQUFHLEVBQTRDLENBQUM7WUFFN0UsZUFBVSxHQUFHLDZCQUFpQixDQUFDLE9BQU8sQ0FBQztZQUN2QyxTQUFJLEdBQUcseUJBQXlCLENBQUMsSUFBSSxDQUFDO1FBZEcsQ0FBQztRQWdCbkQsMENBQU0sR0FBTixVQUFPLElBQXNCLEVBQUUsVUFBNEI7WUFDekQsSUFBSSxDQUFDLFVBQVUsRUFBRTtnQkFDZixPQUFPLFNBQVMsQ0FBQzthQUNsQjtZQUNELElBQU0sU0FBUyxHQUFHLDJCQUFvQixDQUFDLFVBQVUsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzdFLElBQUksU0FBUyxLQUFLLFNBQVMsRUFBRTtnQkFDM0IsT0FBTztvQkFDTCxPQUFPLEVBQUUsU0FBUyxDQUFDLElBQUk7b0JBQ3ZCLFNBQVMsV0FBQTtvQkFDVCxRQUFRLEVBQUUsU0FBUztpQkFDcEIsQ0FBQzthQUNIO2lCQUFNO2dCQUNMLE9BQU8sU0FBUyxDQUFDO2FBQ2xCO1FBQ0gsQ0FBQztRQUVELDhDQUFVLEdBQVYsVUFBVyxJQUFzQixFQUFFLFNBQThCO1lBQy9ELDhGQUE4RjtZQUM5RiwwRkFBMEY7WUFDMUYsdUJBQXVCO1lBQ3ZCLEVBQUU7WUFDRixxQ0FBcUM7WUFDckMsNkJBQTZCO1lBQzdCLHVFQUF1RTtZQUN2RSxFQUFFO1lBQ0YsNkZBQTZGO1lBQzdGLG1GQUFtRjtZQVZyRixpQkFrREM7WUF0Q0MscURBQXFEO1lBQ3JELElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLFVBQVUsRUFBRTtnQkFDbkMsT0FBTyxTQUFTLENBQUM7YUFDbEI7WUFFRCxJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQzdDLElBQU0sU0FBUyxHQUFHLGlDQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzdDLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxRQUFRLENBQUM7WUFFckQsMERBQTBEO1lBQzFELElBQU0sZUFBZSxHQUFHLFVBQUMsUUFBZ0I7Z0JBQ3ZDLElBQU0sV0FBVyxHQUFHLEtBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQztnQkFDMUUsSUFBTSxPQUFPLEdBQUcsS0FBSSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLENBQUM7Z0JBQ3pELE9BQU8sT0FBTyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN0QyxDQUFDLENBQUM7WUFFRiwyRkFBMkY7WUFDM0YsSUFBTSxpQ0FBaUMsR0FDbkMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLElBQUksRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLGNBQWMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFBLFFBQVE7Z0JBQ3JGLElBQUksUUFBUSxLQUFLLElBQUksRUFBRTtvQkFDckIsT0FBTyxTQUFTLENBQUM7aUJBQ2xCO3FCQUFNO29CQUNMLE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFNLE9BQUEsU0FBUyxFQUFULENBQVMsQ0FBQyxDQUFDO2lCQUNuRjtZQUNILENBQUMsQ0FBQyxDQUFDO1lBRVAsOENBQThDO1lBQzlDLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsRUFBRSxDQUFDLENBQUM7WUFFeEQsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFO2dCQUN0QixpRUFBaUU7Z0JBQ2pFLHFDQUFxQztnQkFDckMsT0FBTyxpQ0FBaUMsQ0FBQzthQUMxQztpQkFBTTtnQkFDTCxvRUFBb0U7Z0JBQ3BFLE9BQU8sT0FBTyxDQUFDLEdBQUcsbUJBQUUsaUNBQWlDLEdBQUssU0FBUyxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsRUFBRTtxQkFDckYsSUFBSSxDQUFDLGNBQU0sT0FBQSxTQUFTLEVBQVQsQ0FBUyxDQUFDLENBQUM7YUFDNUI7UUFDSCxDQUFDO1FBRUQsMkNBQU8sR0FBUCxVQUNJLElBQXNCLEVBQUUsU0FBOEIsRUFDdEQsS0FBdUM7O1lBQXZDLHNCQUFBLEVBQUEsUUFBc0Isd0JBQVksQ0FBQyxJQUFJO1lBQ3pDLElBQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxRQUFRLENBQUM7WUFDckQsSUFBSSxDQUFDLFlBQVksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFcEMsOEZBQThGO1lBQzlGLFNBQVM7WUFDVCxJQUFNLGVBQWUsR0FBRyxvQ0FBd0IsQ0FDNUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxNQUFNLEVBQ3hGLEtBQUssRUFBRSxJQUFJLENBQUMsMEJBQTBCLEVBQ3RDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyw4QkFBOEIsRUFBRSxDQUFDLENBQUM7WUFDakUsSUFBSSxlQUFlLEtBQUssU0FBUyxFQUFFO2dCQUNqQyw0RkFBNEY7Z0JBQzVGLHFGQUFxRjtnQkFDckYsaUNBQWlDO2dCQUNqQyxPQUFPLEVBQUUsQ0FBQzthQUNYO1lBRUQsK0NBQStDO1lBQ3hDLElBQVcsU0FBUyxHQUErQixlQUFlLFVBQTlDLEVBQUUsUUFBUSxHQUFxQixlQUFlLFNBQXBDLEVBQUUsTUFBTSxHQUFhLGVBQWUsT0FBNUIsRUFBRSxPQUFPLEdBQUksZUFBZSxRQUFuQixDQUFvQjtZQUUxRSx5RkFBeUY7WUFDekYsZ0NBQWdDO1lBQ2hDLElBQU0sdUJBQXVCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQW1CLFVBQUMsUUFBUSxFQUFFLE9BQU87Z0JBQ3ZGLElBQU0sU0FBUyxHQUFHLHNCQUFRLENBQUMsMEJBQVksQ0FBQyxPQUFPLENBQUMsRUFBRSwwQkFBWSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hGLElBQUksUUFBUSxLQUFLLFNBQVMsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLEVBQUU7b0JBQ2hFLE9BQU8sU0FBUyxDQUFDO2lCQUNsQjtxQkFBTTtvQkFDTCxPQUFPLFFBQVEsQ0FBQztpQkFDakI7WUFDSCxDQUFDLEVBQUUsU0FBUyxDQUFFLENBQUM7WUFHZixpRkFBaUY7WUFDakYsa0ZBQWtGO1lBQ2xGLDhGQUE4RjtZQUM5RixJQUFJLDZCQUE2QixHQUEwQyxJQUFJLENBQUM7WUFDaEYsSUFBSSx5QkFBeUIsR0FBMEMsSUFBSSxDQUFDO1lBQzVFLElBQUksb0JBQW9CLEdBQW9CLElBQUksQ0FBQztZQUVqRCxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLEVBQUU7Z0JBQ2xDLElBQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFFLENBQUM7Z0JBQ3RELDZCQUE2QjtvQkFDekIsdUNBQWdDLENBQUMsYUFBYSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNwRixvQkFBb0IsR0FBRyxJQUFJLDBCQUFlLENBQ3RDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDLENBQUMsc0NBQStCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztvQkFDaEQsYUFBYSxDQUFDLENBQUM7YUFDdEQ7WUFFRCxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzlCLHlCQUF5QixHQUFHLHVDQUFnQyxDQUN4RCxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBRSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQ2xFO1lBRUQsc0JBQXNCO1lBQ3RCLDhGQUE4RjtZQUM5RiwrQkFBK0I7WUFDL0IsMkZBQTJGO1lBQzNGLG9EQUFvRDtZQUNwRCxJQUFJLFFBQWtDLENBQUM7WUFDdkMsSUFBSSxJQUFJLENBQUMsdUJBQXVCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUMxQyw4RUFBOEU7Z0JBQzlFLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFFLENBQUM7Z0JBQzVELElBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBRTFDLFFBQVEsR0FBRyxXQUFXLENBQUM7YUFDeEI7aUJBQU07Z0JBQ0wsNEZBQTRGO2dCQUM1RixJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLEVBQUU7b0JBQ2hDLElBQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFFLENBQUM7b0JBQ3RELElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxDQUFDO29CQUM3RCxJQUFJLE9BQU8sV0FBVyxLQUFLLFFBQVEsRUFBRTt3QkFDbkMsTUFBTSwwQ0FBNEIsQ0FDOUIsZUFBZSxFQUFFLFdBQVcsRUFBRSw4QkFBOEIsQ0FBQyxDQUFDO3FCQUNuRTtvQkFDRCxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7b0JBQzdFLFFBQVEsR0FBRyxJQUFJLENBQUMsd0JBQXdCLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxlQUFlLEVBQUUsV0FBVyxDQUFDLENBQUM7aUJBQ3pGO3FCQUFNO29CQUNMLDJDQUEyQztvQkFDM0MsUUFBUSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxjQUFjLENBQUMsQ0FBQztpQkFDcEY7YUFDRjtZQUVELElBQUksV0FBVyxHQUE4QixTQUFTLENBQUM7WUFFdkQsSUFBSSxRQUFRLENBQUMsTUFBTSxLQUFLLFNBQVMsRUFBRTtnQkFDakMsMEZBQTBGO2dCQUMxRixJQUFNLElBQUUsR0FBRywyQkFBYSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUMvQixXQUFXLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLO29CQUNyQyxJQUFNLElBQUksR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDO29CQUV4QixJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFO3dCQUN6Qyx3RkFBd0Y7d0JBQ3hGLHdGQUF3Rjt3QkFDeEYsMEZBQTBGO3dCQUMxRixjQUFjO3dCQUNkLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxFQUFFLENBQUM7cUJBQ25CO29CQUVELE9BQU8sb0NBQXNCLENBQ3pCLElBQUUsRUFBRSxRQUFRLENBQUMsYUFBYSxFQUFFLElBQUksRUFBRSxFQUFFLENBQUMsa0JBQWtCLENBQUMsS0FBSyxFQUM3RCx5QkFBVyxDQUFDLHVCQUFTLENBQUMsb0JBQW9CLENBQUMsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzlELENBQUMsQ0FBQyxDQUFDO2FBQ0o7WUFFRCwrRkFBK0Y7WUFDL0YsMkZBQTJGO1lBQzNGLGFBQWE7WUFDYixJQUFJLE1BQU0sR0FBa0IsSUFBSSxDQUFDO1lBRWpDLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ3hFLElBQUksU0FBUyxLQUFLLElBQUksRUFBRTtnQkFDdEIsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUFFO29CQUNuQixNQUFNLEdBQUcsRUFBRSxDQUFDO2lCQUNiOztvQkFDRCxLQUF1QixJQUFBLGNBQUEsaUJBQUEsU0FBUyxDQUFBLG9DQUFBLDJEQUFFO3dCQUE3QixJQUFNLFFBQVEsc0JBQUE7d0JBQ2pCLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQzt3QkFDMUUsSUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7d0JBQzFELE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7d0JBQ3pCLElBQUksSUFBSSxDQUFDLFVBQVUsS0FBSyxJQUFJLEVBQUU7NEJBQzVCLElBQUksQ0FBQyxVQUFVLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFLDBCQUFZLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQzt5QkFDeEY7cUJBQ0Y7Ozs7Ozs7OzthQUNGO1lBQ0QsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUMzQixJQUFNLFNBQVMsR0FBRyxnQ0FBb0IsQ0FBQyxTQUFTLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDNUUsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFO29CQUN0QixJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7d0JBQ25CLE1BQU0sR0FBRyxTQUFTLENBQUM7cUJBQ3BCO3lCQUFNO3dCQUNMLE1BQU0sQ0FBQyxJQUFJLE9BQVgsTUFBTSxtQkFBUyxTQUFTLEdBQUU7cUJBQzNCO2lCQUNGO2FBQ0Y7WUFDRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDOUIsSUFBSSxNQUFNLEtBQUssSUFBSSxFQUFFO29CQUNuQixNQUFNLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQztpQkFDMUI7cUJBQU07b0JBQ0wsTUFBTSxDQUFDLElBQUksT0FBWCxNQUFNLG1CQUFTLFFBQVEsQ0FBQyxNQUFNLEdBQUU7aUJBQ2pDO2FBQ0Y7WUFFRCxJQUFNLGFBQWEsR0FDZixJQUFJLENBQUMsaUJBQWlCLENBQUMsU0FBUyxFQUFFLGVBQWUsRUFBRSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVqRixJQUFNLGVBQWUsR0FDakIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSx5QkFBeUIsQ0FBQyxDQUFDO1lBRXBGLElBQUksVUFBVSxHQUFvQixJQUFJLENBQUM7WUFDdkMsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxFQUFFO2dCQUMvQixVQUFVLEdBQUcsSUFBSSwwQkFBZSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFFLENBQUMsQ0FBQzthQUNoRTtZQUVELElBQU0sTUFBTSxHQUEwQztnQkFDcEQsUUFBUSxFQUFFO29CQUNSLFNBQVMsRUFBRSxvQkFBYSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7b0JBQzlELE1BQU0sUUFBQTtvQkFDTixPQUFPLFNBQUE7b0JBQ1AsSUFBSSx3Q0FDQyxRQUFRLEtBQ1gsUUFBUSxFQUFFOzRCQUNSLEtBQUssRUFBRSxRQUFRLENBQUMsU0FBUzs0QkFDekIsa0JBQWtCLEVBQUUsUUFBUSxDQUFDLGtCQUFrQjt5QkFDaEQsRUFDRCxhQUFhLGVBQUEsRUFDYixhQUFhLEVBQUUsUUFBUSxDQUFDLGFBQWEsRUFDckMsTUFBTSxFQUFFLE1BQU0sSUFBSSxFQUFFO3dCQUVwQixzRkFBc0Y7d0JBQ3RGLDZFQUE2RTt3QkFDN0UsVUFBVSxZQUFBLEVBQ1YsYUFBYSxFQUFFLG9CQUFvQixFQUNuQyxrQkFBa0IsRUFBRSxJQUFJLENBQUMsa0JBQWtCLEVBQzNDLHVCQUF1Qix5QkFBQSxHQUN4QjtvQkFDRCxhQUFhLEVBQUUsd0NBQTZCLENBQUMsSUFBSSxFQUFFLE1BQU0sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO29CQUMxRSxZQUFZLEVBQUUsdUNBQTRCLENBQ3RDLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUM3RCxJQUFJLENBQUMsMEJBQTBCLENBQUM7b0JBQ3BDLFFBQVEsVUFBQTtvQkFDUix5QkFBeUIsMkJBQUE7b0JBQ3pCLDZCQUE2QiwrQkFBQTtpQkFDOUI7Z0JBQ0QsV0FBVyxhQUFBO2FBQ1osQ0FBQztZQUNGLElBQUksZUFBZSxLQUFLLElBQUksRUFBRTtnQkFDNUIsTUFBTSxDQUFDLFFBQVMsQ0FBQyxJQUFJLENBQUMsZUFBZSxHQUFHLGVBQWUsQ0FBQzthQUN6RDtZQUNELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUM7UUFFRCw0Q0FBUSxHQUFSLFVBQVMsSUFBc0IsRUFBRSxRQUErQjtZQUM5RCx1RkFBdUY7WUFDdkYsK0VBQStFO1lBQy9FLElBQU0sR0FBRyxHQUFHLElBQUksbUJBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNoQyxJQUFJLENBQUMsWUFBWSxDQUFDLHlCQUF5QixvQkFDekMsR0FBRyxLQUFBLEVBQ0gsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUNwQixRQUFRLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQ2hDLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFDaEMsTUFBTSxFQUFFLFFBQVEsQ0FBQyxNQUFNLEVBQ3ZCLE9BQU8sRUFBRSxRQUFRLENBQUMsT0FBTyxFQUN6QixPQUFPLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLFlBQVksRUFBbEIsQ0FBa0IsQ0FBQyxFQUMvRCxXQUFXLEVBQUUsSUFBSSxFQUNqQixTQUFTLEVBQUUsUUFBUSxDQUFDLFNBQVMsSUFDMUIsUUFBUSxDQUFDLGFBQWEsRUFDekIsQ0FBQztZQUVILElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuRCxDQUFDO1FBRUQseUNBQUssR0FBTCxVQUNJLE9BQXdCLEVBQUUsSUFBc0IsRUFBRSxRQUF5Qzs7WUFDN0YsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxRCxJQUFNLFFBQVEsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztZQUN4QyxJQUFNLE9BQU8sR0FBRyxJQUFJLDBCQUFlLEVBQWlCLENBQUM7WUFDckQsSUFBSSxLQUFLLEtBQUssT0FBTyxFQUFFO2dCQUNyQiwrREFBK0Q7Z0JBQy9ELE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7O29CQUNsQixLQUF3QixJQUFBLEtBQUEsaUJBQUEsS0FBSyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUEsZ0JBQUEsNEJBQUU7d0JBQWpELElBQU0sU0FBUyxXQUFBO3dCQUNsQixJQUFJLFNBQVMsQ0FBQyxRQUFRLEtBQUssSUFBSSxFQUFFOzRCQUMvQixPQUFPLENBQUMsY0FBYyxDQUFDLHNCQUFXLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQzt5QkFDMUU7cUJBQ0Y7Ozs7Ozs7OzthQUNGO1lBQ0QsSUFBTSxNQUFNLEdBQUcsSUFBSSx5QkFBYyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQzNDLElBQU0sYUFBYSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUMsQ0FBQyxDQUFDO1lBRTNFLE9BQU8sQ0FBQyxZQUFZLENBQUM7Z0JBQ25CLFdBQVcsRUFBRSxJQUFJO2dCQUNqQixRQUFRLFVBQUE7Z0JBQ1IsYUFBYSxlQUFBO2dCQUNiLFlBQVksRUFBRTtvQkFDWixRQUFRLEVBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxRQUFRO29CQUNwQyxJQUFJLEVBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxJQUFJO2lCQUM3QjthQUNGLENBQUMsQ0FBQztRQUNMLENBQUM7UUFFRCw2Q0FBUyxHQUFULFVBQVUsR0FBcUIsRUFBRSxJQUFzQixFQUFFLElBQXFDO1lBRTVGLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ2hDLE9BQU87YUFDUjtZQUVELElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDM0QsSUFBSSxLQUFLLEtBQUssT0FBTyxFQUFFO2dCQUNyQiwrREFBK0Q7Z0JBQy9ELE9BQU87YUFDUjtZQUVELElBQU0sTUFBTSxHQUFHLElBQUkseUJBQWMsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDakQsR0FBRyxDQUFDLFdBQVcsQ0FDWCxJQUFJLG1CQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU8sRUFDaEYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBRUQsMkNBQU8sR0FBUCxVQUFRLElBQXNCLEVBQUUsUUFBeUM7O1lBQXpFLGlCQThJQztZQTVJQyxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUM7WUFDckMsNkZBQTZGO1lBQzdGLHlDQUF5QztZQUN6QyxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzFELElBQUksUUFBUSxHQUFHLFFBQVEsQ0FBQyxJQUFxQyxDQUFDO1lBRTlELElBQU0sSUFBSSxHQUE0QjtnQkFDcEMsVUFBVSxFQUFFLFdBQVc7Z0JBQ3ZCLEtBQUssRUFBRSxTQUFTO2dCQUNoQiwrQkFBK0IsRUFBRSxLQUFLO2FBQ3ZDLENBQUM7WUFFRixJQUFJLEtBQUssS0FBSyxJQUFJLElBQUksS0FBSyxLQUFLLE9BQU8sRUFBRTtnQkEwQnZDLElBQU0sT0FBTyxHQUFHLElBQUksMEJBQWUsRUFBb0IsQ0FBQzs7b0JBRXhELEtBQWtCLElBQUEsS0FBQSxpQkFBQSxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQVUsQ0FBQSxnQkFBQSw0QkFBRTt3QkFBM0MsSUFBTSxHQUFHLFdBQUE7d0JBQ1osSUFBSSxHQUFHLENBQUMsUUFBUSxLQUFLLElBQUksRUFBRTs0QkFDekIsT0FBTyxDQUFDLGNBQWMsQ0FBQyxzQkFBVyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsR0FBdUIsQ0FBQyxDQUFDO3lCQUNsRjtxQkFDRjs7Ozs7Ozs7O2dCQUNELElBQU0sS0FBSyxHQUFHLElBQUksR0FBRyxFQUF1QyxDQUFDOztvQkFDN0QsS0FBbUIsSUFBQSxLQUFBLGlCQUFBLEtBQUssQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFBLGdCQUFBLDRCQUFFO3dCQUF2QyxJQUFNLElBQUksV0FBQTt3QkFDYixLQUFLLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO3FCQUNoQzs7Ozs7Ozs7O2dCQUVELHNGQUFzRjtnQkFDdEYscURBQXFEO2dCQUNyRCxJQUFNLE1BQU0sR0FBRyxJQUFJLHlCQUFjLENBQUMsT0FBTyxDQUFDLENBQUM7Z0JBQzNDLElBQU0sS0FBSyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBQyxRQUFRLEVBQUUsUUFBUSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUMsQ0FBQyxDQUFDO2dCQUUvRCx5RUFBeUU7Z0JBQ3pFLElBQU0sY0FBYyxHQUFHLEtBQUssQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLEdBQUcsQ0FBQyxVQUFBLFNBQVM7b0JBQzVELE9BQU87d0JBQ0wsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRO3dCQUM1QixVQUFVLEVBQUUsS0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxPQUFPLENBQUM7cUJBQ3pELENBQUM7Z0JBQ0osQ0FBQyxDQUFDLENBQUM7Z0JBRUgsSUFBTSxTQUFTLEdBQWlELEVBQUUsQ0FBQzs7b0JBQ25FLEtBQXVCLElBQUEsS0FBQSxpQkFBQSxLQUFLLENBQUMsWUFBWSxFQUFFLENBQUEsZ0JBQUEsNEJBQUU7d0JBQXhDLElBQU0sUUFBUSxXQUFBO3dCQUNqQixJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTs0QkFDeEIsU0FBUzt5QkFDVjt3QkFDRCxJQUFNLElBQUksR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBRSxDQUFDO3dCQUNsQyxTQUFTLENBQUMsSUFBSSxDQUFDOzRCQUNiLFFBQVEsVUFBQTs0QkFDUixVQUFVLEVBQUUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQzt5QkFDaEQsQ0FBQyxDQUFDO3FCQUNKOzs7Ozs7Ozs7Z0JBRUQsd0ZBQXdGO2dCQUN4RiwyREFBMkQ7Z0JBQzNELElBQU0sYUFBYSxHQUNmLGNBQWMsQ0FBQyxJQUFJLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxLQUFJLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQTdDLENBQTZDLENBQUM7b0JBQ3pFLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxLQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQTlDLENBQThDLENBQUMsQ0FBQztnQkFFM0UsSUFBSSxDQUFDLGFBQWEsRUFBRTs7d0JBQ2xCLDBGQUEwRjt3QkFDMUYsaUVBQWlFO3dCQUNqRSxLQUEyQixJQUFBLG1CQUFBLGlCQUFBLGNBQWMsQ0FBQSw4Q0FBQSwwRUFBRTs0QkFBL0IsSUFBQSxVQUFVLHNDQUFBOzRCQUNwQixJQUFJLENBQUMsc0JBQXNCLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxDQUFDO3lCQUNsRDs7Ozs7Ozs7Ozt3QkFDRCxLQUEyQixJQUFBLGNBQUEsaUJBQUEsU0FBUyxDQUFBLG9DQUFBLDJEQUFFOzRCQUExQixJQUFBLFVBQVUsaUNBQUE7NEJBQ3BCLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLENBQUM7eUJBQ2xEOzs7Ozs7Ozs7b0JBRUQsa0ZBQWtGO29CQUNsRiw0RkFBNEY7b0JBQzVGLGlDQUFpQztvQkFDakMsSUFBTSwrQkFBK0IsR0FDakMsY0FBYyxDQUFDLElBQUksQ0FDZixVQUFBLEdBQUcsSUFBSSxPQUFBLG1DQUE0QixDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBaEUsQ0FBZ0UsQ0FBQzt3QkFDNUUsU0FBUyxDQUFDLElBQUksQ0FDVixVQUFBLElBQUksSUFBSSxPQUFBLG1DQUE0QixDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsRUFBakUsQ0FBaUUsQ0FBQyxDQUFDO29CQUVuRixJQUFJLENBQUMsVUFBVSxHQUFHLGNBQWMsQ0FBQztvQkFDakMsSUFBSSxDQUFDLEtBQUssR0FBRyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBaEMsQ0FBZ0MsQ0FBQyxDQUFDLENBQUM7b0JBQzlFLElBQUksQ0FBQywrQkFBK0IsR0FBRywrQkFBK0IsQ0FBQztpQkFDeEU7cUJBQU07b0JBQ0wsd0ZBQXdGO29CQUN4Rix3RkFBd0Y7b0JBQ3hGLDRFQUE0RTtvQkFDNUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxvQ0FBb0MsQ0FBQyxJQUFJLENBQUMsQ0FBQztpQkFDL0Q7YUFDRjtZQUVELElBQU0sV0FBVyxHQUFvQixFQUFFLENBQUM7WUFFeEMsSUFBSSxRQUFRLENBQUMseUJBQXlCLEtBQUssSUFBSTtnQkFDM0MsUUFBUSxDQUFDLElBQUksQ0FBQyxTQUFTLFlBQVksMEJBQWUsRUFBRTtnQkFDdEQsSUFBTSxtQkFBbUIsR0FBRyxvQ0FBc0IsQ0FDOUMsUUFBUSxDQUFDLHlCQUF5QixFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBVSxDQUFDLElBQUksRUFDakUsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7Z0JBQzdCLFdBQVcsQ0FBQyxJQUFJLE9BQWhCLFdBQVcsbUJBQVMsbUJBQW1CLEdBQUU7YUFDMUM7WUFFRCxJQUFJLFFBQVEsQ0FBQyw2QkFBNkIsS0FBSyxJQUFJO2dCQUMvQyxRQUFRLENBQUMsSUFBSSxDQUFDLGFBQWEsWUFBWSwwQkFBZSxFQUFFO2dCQUMxRCxJQUFNLHVCQUF1QixHQUFHLG9DQUFzQixDQUNsRCxRQUFRLENBQUMsNkJBQTZCLEVBQUUsUUFBUSxDQUFDLElBQUksQ0FBQyxhQUFjLENBQUMsSUFBSSxFQUN6RSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztnQkFDN0IsV0FBVyxDQUFDLElBQUksT0FBaEIsV0FBVyxtQkFBUyx1QkFBdUIsR0FBRTthQUM5QztZQUVELElBQU0sb0JBQW9CLEdBQUcscUNBQXVCLENBQ2hELElBQUksRUFBRSxJQUFJLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQzVGLElBQUksb0JBQW9CLEtBQUssSUFBSSxFQUFFO2dCQUNqQyxXQUFXLENBQUMsSUFBSSxPQUFoQixXQUFXLG1CQUFTLG9CQUFvQixHQUFFO2FBQzNDO1lBRUQsSUFBSSxXQUFXLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDMUIsT0FBTyxFQUFDLFdBQVcsYUFBQSxFQUFDLENBQUM7YUFDdEI7WUFFRCxPQUFPLEVBQUMsSUFBSSxNQUFBLEVBQUMsQ0FBQztRQUNoQixDQUFDO1FBRUQsMkNBQU8sR0FBUCxVQUNJLElBQXNCLEVBQUUsUUFBeUMsRUFDakUsVUFBNkMsRUFBRSxJQUFrQjtZQUNuRSxJQUFNLElBQUkseUNBQTRCLFFBQVEsQ0FBQyxJQUFJLEdBQUssVUFBVSxDQUFDLENBQUM7WUFDcEUsSUFBTSxHQUFHLEdBQUcsdUNBQTRCLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSw0QkFBaUIsRUFBRSxDQUFDLENBQUM7WUFDMUUsSUFBTSxVQUFVLEdBQUcsa0NBQXdCLHVDQUNuQyxJQUFJLEtBQUUsUUFBUSxFQUFFLHNCQUFXLENBQUMsZUFBZSxFQUFFLE1BQU0sRUFBRSwwQkFBZSxDQUFDLFNBQVMsSUFBRSxDQUFDO1lBQ3pGLElBQUksUUFBUSxDQUFDLFlBQVksS0FBSyxJQUFJLEVBQUU7Z0JBQ2xDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQzthQUNuRDtZQUNELE9BQU87Z0JBQ0wsVUFBVSxFQUFFO29CQUNWLElBQUksRUFBRSxNQUFNO29CQUNaLFdBQVcsRUFBRSxHQUFHLENBQUMsVUFBVTtvQkFDM0IsVUFBVSxFQUFFLEVBQUU7b0JBQ2QsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO2lCQUNmO2FBQ0YsQ0FBQztRQUNKLENBQUM7UUFFTyxtREFBZSxHQUF2QixVQUF3QixTQUFvQjtZQUMxQyxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUNwQyxPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBRSxDQUFDO2FBQzFDO1lBQ0QsSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Z0JBQzFELE1BQU0sSUFBSSxrQ0FBb0IsQ0FDMUIsdUJBQVMsQ0FBQyxxQkFBcUIsRUFBRSxzQkFBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFDbEUsdURBQXVELENBQUMsQ0FBQzthQUM5RDtZQUNELElBQU0sSUFBSSxHQUFHLHVCQUFnQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUVqRCxJQUFJLENBQUMsRUFBRSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN2QyxNQUFNLElBQUksa0NBQW9CLENBQzFCLHVCQUFTLENBQUMseUJBQXlCLEVBQUUsSUFBSSxFQUFFLHFDQUFxQyxDQUFDLENBQUM7YUFDdkY7WUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdkMsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBRU8scURBQWlCLEdBQXpCLFVBQ0ksU0FBcUMsRUFBRSxLQUFhLEVBQUUsY0FBc0I7WUFDOUUsSUFBSSxRQUFRLEdBQWdCLElBQUksQ0FBQztZQUNqQyxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ3hCLElBQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFFLENBQUM7Z0JBQ25DLElBQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBUSxDQUFDO2dCQUNuRCxJQUFJLEtBQUssWUFBWSw2QkFBUyxJQUFJLDZCQUFzQixDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLEVBQUU7b0JBQ3ZGLFFBQVEsR0FBRyxLQUFLLENBQUMsUUFBa0IsQ0FBQztpQkFDckM7cUJBQU07b0JBQ0wsTUFBTSwwQ0FBNEIsQ0FDOUIsSUFBSSxFQUFFLEtBQUssRUFBSyxLQUFLLDZCQUF3QixjQUFjLDZCQUEwQixDQUFDLENBQUM7aUJBQzVGO2FBQ0Y7WUFDRCxPQUFPLFFBQVEsQ0FBQztRQUNsQixDQUFDO1FBRU8scURBQWlCLEdBQXpCLFVBQTBCLFNBQXFDLEVBQUUsU0FBbUI7WUFFbEYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQy9CLE9BQU8sU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO2FBQ2hEO1lBRUQsSUFBTSxhQUFhLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUUsQ0FBQztZQUNsRCxJQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUN6RCxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxPQUFPLEdBQUcsS0FBSyxRQUFRLEVBQXZCLENBQXVCLENBQUMsRUFBRTtnQkFDakYsTUFBTSwwQ0FBNEIsQ0FDOUIsYUFBYSxFQUFFLFNBQVMsRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO2FBQ3hFO1lBQ0QsU0FBUyxDQUFDLElBQUksT0FBZCxTQUFTLG1CQUFTLFNBQVMsR0FBRTtZQUM3QixPQUFPLFNBQXFCLENBQUM7UUFDL0IsQ0FBQztRQUVPLDREQUF3QixHQUFoQyxVQUNJLElBQXNCLEVBQUUsU0FBb0IsRUFBRSxTQUFxQyxFQUNuRixjQUFzQjtZQUYxQixpQkErQkM7WUE1QkMsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFO2dCQUNoQywwQ0FBMEM7Z0JBQzFDLElBQU0saUJBQWUsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBRSxDQUFDO2dCQUN0RCxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxpQkFBZSxDQUFDLENBQUM7Z0JBQzdELElBQUksT0FBTyxXQUFXLEtBQUssUUFBUSxFQUFFO29CQUNuQyxNQUFNLDBDQUE0QixDQUM5QixpQkFBZSxFQUFFLFdBQVcsRUFBRSw4QkFBOEIsQ0FBQyxDQUFDO2lCQUNuRTtnQkFDRCxJQUFNLGFBQVcsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7Z0JBQzdFLElBQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLGFBQVcsQ0FBQyxDQUFDO2dCQUVqRSwyRkFBMkY7Z0JBQzNGLG1CQUFtQjtnQkFDbkIsSUFBSSxlQUFlLEtBQUssU0FBUyxFQUFFO29CQUNqQyxPQUFPLGVBQWUsQ0FBQyxJQUFJLENBQUM7d0JBQzFCLElBQU0sUUFBUSxHQUNWLEtBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLGlCQUFlLEVBQUUsYUFBVyxDQUFDLENBQUM7d0JBQ2pGLEtBQUksQ0FBQyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO3dCQUNqRCxPQUFPLFFBQVEsQ0FBQztvQkFDbEIsQ0FBQyxDQUFDLENBQUM7aUJBQ0o7cUJBQU07b0JBQ0wsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUM5QjthQUNGO2lCQUFNO2dCQUNMLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFJLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxjQUFjLENBQUMsQ0FBQztnQkFDekYsSUFBSSxDQUFDLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQ2pELE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNsQztRQUNILENBQUM7UUFFTyw0REFBd0IsR0FBaEMsVUFDSSxJQUFzQixFQUFFLFNBQXFDLEVBQUUsZUFBOEIsRUFDN0YsV0FBbUI7WUFDckIsSUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDMUQsSUFBSSxJQUFJLENBQUMsVUFBVSxLQUFLLElBQUksRUFBRTtnQkFDNUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUUsMEJBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO2FBQ3hGO1lBRUQsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FDaEMsU0FBUyxFQUFFLFdBQVcsRUFBRSxZQUFZLENBQUMsV0FBVyxDQUFDLEVBQUUsbUJBQW1CLENBQUMsU0FBUztZQUNoRixtQkFBbUIsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUUvQiw2Q0FDSyxRQUFRLEtBQ1gsYUFBYSxFQUFFO29CQUNiLElBQUksRUFBRSxVQUFVO29CQUNoQixjQUFjLEVBQUUsSUFBSTtvQkFDcEIsSUFBSSxFQUFFLGVBQWU7b0JBQ3JCLFFBQVEsRUFBRSxXQUFXO29CQUNyQixXQUFXLEVBQUUsV0FBVztpQkFDekIsSUFDRDtRQUNKLENBQUM7UUFFTywwREFBc0IsR0FBOUIsVUFDSSxJQUFzQixFQUFFLFNBQW9CLEVBQUUsU0FBcUMsRUFDbkYsY0FBc0I7WUFDeEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEVBQUU7Z0JBQzlCLE1BQU0sSUFBSSxrQ0FBb0IsQ0FDMUIsdUJBQVMsQ0FBQywwQkFBMEIsRUFBRSxzQkFBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFDdkUsaUNBQWlDLENBQUMsQ0FBQzthQUN4QztZQUNELElBQU0sWUFBWSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFFLENBQUM7WUFFaEQsSUFBSSxXQUFtQixDQUFDO1lBQ3hCLElBQUksV0FBVyxHQUFXLEVBQUUsQ0FBQztZQUM3QixJQUFJLGFBQWEsR0FBeUIsU0FBUyxDQUFDO1lBQ3BELElBQUksYUFBb0MsQ0FBQztZQUN6QyxJQUFJLGFBQWEsR0FBRyxLQUFLLENBQUM7WUFDMUIsbUZBQW1GO1lBQ25GLElBQUksRUFBRSxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLENBQUMsK0JBQStCLENBQUMsWUFBWSxDQUFDLEVBQUU7Z0JBQ3hGLHNGQUFzRjtnQkFDdEYsT0FBTztnQkFDUCxRQUFRO2dCQUNSLGFBQWEsR0FBRyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztnQkFDL0MsV0FBVyxHQUFHLFlBQVksQ0FBQyxhQUFhLEVBQUUsQ0FBQyxJQUFJLENBQUM7Z0JBQ2hELFdBQVcsR0FBRyxjQUFjLENBQUM7Z0JBQzdCLGFBQWEsR0FBRyxJQUFJLENBQUM7Z0JBQ3JCLGFBQWEsR0FBRztvQkFDZCxJQUFJLEVBQUUsUUFBUTtvQkFDZCxJQUFJLEVBQUUsWUFBcUU7aUJBQzVFLENBQUM7YUFDSDtpQkFBTTtnQkFDTCxJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUMvRCxJQUFJLE9BQU8sZ0JBQWdCLEtBQUssUUFBUSxFQUFFO29CQUN4QyxNQUFNLDBDQUE0QixDQUM5QixZQUFZLEVBQUUsZ0JBQWdCLEVBQUUsMkJBQTJCLENBQUMsQ0FBQztpQkFDbEU7Z0JBQ0QsV0FBVyxHQUFHLGdCQUFnQixDQUFDO2dCQUMvQixhQUFhLEdBQUc7b0JBQ2QsSUFBSSxFQUFFLFVBQVU7b0JBQ2hCLElBQUksRUFBRSxZQUFZO29CQUNsQixjQUFjLEVBQUUsSUFBSTtvQkFDcEIsUUFBUSxFQUFFLFdBQVc7aUJBQ3RCLENBQUM7YUFDSDtZQUVELElBQU0sUUFBUSxHQUNWLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBRTNGLDZDQUFXLFFBQVEsS0FBRSxhQUFhLGVBQUEsSUFBRTtRQUN0QyxDQUFDO1FBRU8sa0RBQWMsR0FBdEIsVUFDSSxTQUFxQyxFQUFFLFdBQW1CLEVBQUUsV0FBbUIsRUFDL0UsYUFBbUMsRUFBRSxhQUFzQjtZQUM3RCxJQUFJLG1CQUFtQixHQUFZLElBQUksQ0FBQywwQkFBMEIsQ0FBQztZQUNuRSxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUMsRUFBRTtnQkFDeEMsSUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBRSxDQUFDO2dCQUNuRCxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDNUMsSUFBSSxPQUFPLEtBQUssS0FBSyxTQUFTLEVBQUU7b0JBQzlCLE1BQU0sMENBQTRCLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSx1Q0FBdUMsQ0FBQyxDQUFDO2lCQUMxRjtnQkFDRCxtQkFBbUIsR0FBRyxLQUFLLENBQUM7YUFDN0I7WUFFRCxJQUFJLGFBQWEsR0FBd0IsdUNBQTRCLENBQUM7WUFDdEUsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBQyxFQUFFO2dCQUNsQyxJQUFNLElBQUksR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLGVBQWUsQ0FBRSxDQUFDO2dCQUM3QyxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDNUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDO29CQUMzQyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBQSxPQUFPLElBQUksT0FBQSxPQUFPLE9BQU8sS0FBSyxRQUFRLEVBQTNCLENBQTJCLENBQUMsRUFBRTtvQkFDeEQsTUFBTSwwQ0FBNEIsQ0FDOUIsSUFBSSxFQUFFLEtBQUssRUFBRSwrREFBK0QsQ0FBQyxDQUFDO2lCQUNuRjtnQkFDRCxhQUFhLEdBQUcsOEJBQW1CLENBQUMsU0FBUyxDQUFDLEtBQXlCLENBQUMsQ0FBQzthQUMxRTtZQUVLLElBQUEsS0FDRix3QkFBYSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUU7Z0JBQ3RDLG1CQUFtQixxQkFBQTtnQkFDbkIsbUJBQW1CLEVBQUUsYUFBYTtnQkFDbEMsS0FBSyxFQUFFLGFBQWE7Z0JBQ3BCLGFBQWEsZUFBQTtnQkFDYiwrQkFBK0IsRUFBRSxJQUFJLENBQUMsK0JBQStCO2dCQUNyRSw4QkFBOEIsRUFBRSxJQUFJLENBQUMsOEJBQThCO2FBQ3BFLENBQUMsRUFSQyxNQUFNLFlBQUEsRUFBUyxTQUFTLFdBQUEsRUFBRSxTQUFTLGVBQUEsRUFBRSxNQUFNLFlBQUEsRUFBRSxrQkFBa0Isd0JBUWhFLENBQUM7WUFFUCw2RkFBNkY7WUFDN0YseUZBQXlGO1lBQ3pGLDRDQUE0QztZQUM1QyxFQUFFO1lBQ0YsNkZBQTZGO1lBQzdGLDBGQUEwRjtZQUMxRixzQ0FBc0M7WUFDdEMsOEZBQThGO1lBQzlGLCtEQUErRDtZQUMvRCxFQUFFO1lBQ0YsZ0dBQWdHO1lBQ2hHLHFEQUFxRDtZQUU5QyxJQUFPLFNBQVMsR0FBSSx3QkFBYSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUU7Z0JBQ2pFLG1CQUFtQixFQUFFLElBQUk7Z0JBQ3pCLG1CQUFtQixFQUFFLGFBQWE7Z0JBQ2xDLEtBQUssRUFBRSxhQUFhO2dCQUNwQixhQUFhLGVBQUE7Z0JBQ2IsK0JBQStCLEVBQUUsSUFBSSxDQUFDLCtCQUErQjtnQkFDckUsOEJBQThCLEVBQUUsSUFBSSxDQUFDLDhCQUE4QjtnQkFDbkUsa0JBQWtCLEVBQUUsRUFBRTthQUN2QixDQUFDLE1BUnFCLENBUXBCO1lBRUgsT0FBTztnQkFDTCxhQUFhLGVBQUE7Z0JBQ2IsU0FBUyxXQUFBO2dCQUNULFNBQVMsV0FBQTtnQkFDVCxTQUFTLFdBQUE7Z0JBQ1QsTUFBTSxRQUFBO2dCQUNOLGtCQUFrQixvQkFBQTtnQkFDbEIsTUFBTSxRQUFBO2dCQUNOLFFBQVEsRUFBRSxXQUFXO2dCQUNyQixXQUFXLGFBQUE7Z0JBQ1gsUUFBUSxFQUFFLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDO2dCQUNuQyxJQUFJLEVBQUUsSUFBSSwwQkFBZSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUM7YUFDcEQsQ0FBQztRQUNKLENBQUM7UUFFTyw2REFBeUIsR0FBakMsVUFBa0MsSUFBZ0IsRUFBRSxNQUFxQjtZQUN2RSxJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksdUJBQVksQ0FBQyxFQUFFO2dCQUNuQyxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsMENBQTBDO1lBQzFDLE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFXLEVBQUUsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ3BGLENBQUM7UUFFTyxtREFBZSxHQUF2QixVQUF3QixJQUFnQixFQUFFLE1BQXFCO1lBQzdELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDOUQsSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFO2dCQUNyQixPQUFPLEtBQUssQ0FBQzthQUNkO1lBRUQscUNBQXFDO1lBQ3JDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDL0QsQ0FBQztRQUVPLDBEQUFzQixHQUE5QixVQUErQixJQUFnQixFQUFFLE1BQXFCO1lBQ3BFLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDOUQsSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFO2dCQUNyQixPQUFPO2FBQ1I7WUFFRCxJQUFJLENBQUMsYUFBYSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM3RCxDQUFDO1FBQ0gsZ0NBQUM7SUFBRCxDQUFDLEFBN3dCRCxJQTZ3QkM7SUE3d0JZLDhEQUF5QjtJQSt3QnRDLFNBQVMsZ0JBQWdCLENBQUMsWUFBMkI7UUFDbkQsSUFBTSxRQUFRLEdBQUcsWUFBWSxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUN2QyxJQUFBLEtBQ0YsRUFBRSxDQUFDLDZCQUE2QixDQUFDLFlBQVksQ0FBQyxhQUFhLEVBQUUsRUFBRSxRQUFRLENBQUMsRUFEckUsSUFBSSxVQUFBLEVBQUUsU0FBUyxlQUNzRCxDQUFDO1FBQzdFLE9BQU87WUFDTCxRQUFRLFVBQUE7WUFDUixTQUFTLEVBQUUsSUFBSTtZQUNmLFFBQVEsRUFBRSxTQUFTO1lBQ25CLE1BQU0sRUFBRSxZQUFZLENBQUMsTUFBTSxFQUFFLEdBQUcsQ0FBQztTQUNsQyxDQUFDO0lBQ0osQ0FBQztJQUVELFNBQVMsWUFBWSxDQUFDLFdBQW1CO1FBQ3ZDLElBQUksQ0FBQyxrREFBd0IsRUFBRSxFQUFFO1lBQy9CLDJFQUEyRTtZQUMzRSx3RUFBd0U7WUFDeEUsNkNBQTZDO1lBQzdDLE9BQU8sRUFBRSxDQUFDO1NBQ1g7YUFBTTtZQUNMLE9BQU8sV0FBVyxDQUFDO1NBQ3BCO0lBQ0gsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2NvbXBpbGVDb21wb25lbnRGcm9tTWV0YWRhdGEsIENvbnN0YW50UG9vbCwgQ3NzU2VsZWN0b3IsIERFRkFVTFRfSU5URVJQT0xBVElPTl9DT05GSUcsIERvbUVsZW1lbnRTY2hlbWFSZWdpc3RyeSwgRXhwcmVzc2lvbiwgRXh0ZXJuYWxFeHByLCBJZGVudGlmaWVycywgSW50ZXJwb2xhdGlvbkNvbmZpZywgTGV4ZXJSYW5nZSwgbWFrZUJpbmRpbmdQYXJzZXIsIFBhcnNlRXJyb3IsIFBhcnNlU291cmNlRmlsZSwgcGFyc2VUZW1wbGF0ZSwgUGFyc2VUZW1wbGF0ZU9wdGlvbnMsIFIzQ29tcG9uZW50TWV0YWRhdGEsIFIzRmFjdG9yeVRhcmdldCwgUjNUYXJnZXRCaW5kZXIsIFNjaGVtYU1ldGFkYXRhLCBTZWxlY3Rvck1hdGNoZXIsIFN0YXRlbWVudCwgVG1wbEFzdE5vZGUsIFdyYXBwZWROb2RlRXhwcn0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7Q3ljbGVBbmFseXplcn0gZnJvbSAnLi4vLi4vY3ljbGVzJztcbmltcG9ydCB7RXJyb3JDb2RlLCBGYXRhbERpYWdub3N0aWNFcnJvciwgbmdFcnJvckNvZGV9IGZyb20gJy4uLy4uL2RpYWdub3N0aWNzJztcbmltcG9ydCB7YWJzb2x1dGVGcm9tLCByZWxhdGl2ZX0gZnJvbSAnLi4vLi4vZmlsZV9zeXN0ZW0nO1xuaW1wb3J0IHtEZWZhdWx0SW1wb3J0UmVjb3JkZXIsIE1vZHVsZVJlc29sdmVyLCBSZWZlcmVuY2UsIFJlZmVyZW5jZUVtaXR0ZXJ9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtEZXBlbmRlbmN5VHJhY2tlcn0gZnJvbSAnLi4vLi4vaW5jcmVtZW50YWwvYXBpJztcbmltcG9ydCB7SW5kZXhpbmdDb250ZXh0fSBmcm9tICcuLi8uLi9pbmRleGVyJztcbmltcG9ydCB7Q2xhc3NQcm9wZXJ0eU1hcHBpbmcsIERpcmVjdGl2ZU1ldGEsIERpcmVjdGl2ZVR5cGVDaGVja01ldGEsIGV4dHJhY3REaXJlY3RpdmVUeXBlQ2hlY2tNZXRhLCBJbmplY3RhYmxlQ2xhc3NSZWdpc3RyeSwgTWV0YWRhdGFSZWFkZXIsIE1ldGFkYXRhUmVnaXN0cnl9IGZyb20gJy4uLy4uL21ldGFkYXRhJztcbmltcG9ydCB7RW51bVZhbHVlLCBQYXJ0aWFsRXZhbHVhdG9yfSBmcm9tICcuLi8uLi9wYXJ0aWFsX2V2YWx1YXRvcic7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb24sIERlY29yYXRvciwgUmVmbGVjdGlvbkhvc3QsIHJlZmxlY3RPYmplY3RMaXRlcmFsfSBmcm9tICcuLi8uLi9yZWZsZWN0aW9uJztcbmltcG9ydCB7Q29tcG9uZW50U2NvcGVSZWFkZXIsIExvY2FsTW9kdWxlU2NvcGVSZWdpc3RyeX0gZnJvbSAnLi4vLi4vc2NvcGUnO1xuaW1wb3J0IHtBbmFseXNpc091dHB1dCwgQ29tcGlsZVJlc3VsdCwgRGVjb3JhdG9ySGFuZGxlciwgRGV0ZWN0UmVzdWx0LCBIYW5kbGVyRmxhZ3MsIEhhbmRsZXJQcmVjZWRlbmNlLCBSZXNvbHZlUmVzdWx0fSBmcm9tICcuLi8uLi90cmFuc2Zvcm0nO1xuaW1wb3J0IHtUZW1wbGF0ZVNvdXJjZU1hcHBpbmcsIFR5cGVDaGVja0NvbnRleHR9IGZyb20gJy4uLy4uL3R5cGVjaGVjay9hcGknO1xuaW1wb3J0IHtnZXRUZW1wbGF0ZUlkLCBtYWtlVGVtcGxhdGVEaWFnbm9zdGljfSBmcm9tICcuLi8uLi90eXBlY2hlY2svZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHt0c1NvdXJjZU1hcEJ1ZzI5MzAwRml4ZWR9IGZyb20gJy4uLy4uL3V0aWwvc3JjL3RzX3NvdXJjZV9tYXBfYnVnXzI5MzAwJztcbmltcG9ydCB7U3Vic2V0T2ZLZXlzfSBmcm9tICcuLi8uLi91dGlsL3NyYy90eXBlc2NyaXB0JztcblxuaW1wb3J0IHtSZXNvdXJjZUxvYWRlcn0gZnJvbSAnLi9hcGknO1xuaW1wb3J0IHtjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yLCBnZXREaXJlY3RpdmVEaWFnbm9zdGljcywgZ2V0UHJvdmlkZXJEaWFnbm9zdGljc30gZnJvbSAnLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge2V4dHJhY3REaXJlY3RpdmVNZXRhZGF0YSwgcGFyc2VGaWVsZEFycmF5VmFsdWV9IGZyb20gJy4vZGlyZWN0aXZlJztcbmltcG9ydCB7Y29tcGlsZU5nRmFjdG9yeURlZkZpZWxkfSBmcm9tICcuL2ZhY3RvcnknO1xuaW1wb3J0IHtnZW5lcmF0ZVNldENsYXNzTWV0YWRhdGFDYWxsfSBmcm9tICcuL21ldGFkYXRhJztcbmltcG9ydCB7VHlwZUNoZWNrU2NvcGVzfSBmcm9tICcuL3R5cGVjaGVja19zY29wZXMnO1xuaW1wb3J0IHtmaW5kQW5ndWxhckRlY29yYXRvciwgaXNBbmd1bGFyQ29yZVJlZmVyZW5jZSwgaXNFeHByZXNzaW9uRm9yd2FyZFJlZmVyZW5jZSwgbWFrZUR1cGxpY2F0ZURlY2xhcmF0aW9uRXJyb3IsIHJlYWRCYXNlQ2xhc3MsIHJlc29sdmVQcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5LCB1bndyYXBFeHByZXNzaW9uLCB3cmFwRnVuY3Rpb25FeHByZXNzaW9uc0luUGFyZW5zfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBFTVBUWV9NQVAgPSBuZXcgTWFwPHN0cmluZywgRXhwcmVzc2lvbj4oKTtcbmNvbnN0IEVNUFRZX0FSUkFZOiBhbnlbXSA9IFtdO1xuXG4vKipcbiAqIFRoZXNlIGZpZWxkcyBvZiBgUjNDb21wb25lbnRNZXRhZGF0YWAgYXJlIHVwZGF0ZWQgaW4gdGhlIGByZXNvbHZlYCBwaGFzZS5cbiAqXG4gKiBUaGUgYGtleW9mIFIzQ29tcG9uZW50TWV0YWRhdGEgJmAgY29uZGl0aW9uIGVuc3VyZXMgdGhhdCBvbmx5IGZpZWxkcyBvZiBgUjNDb21wb25lbnRNZXRhZGF0YWAgY2FuXG4gKiBiZSBpbmNsdWRlZCBoZXJlLlxuICovXG5leHBvcnQgdHlwZSBDb21wb25lbnRNZXRhZGF0YVJlc29sdmVkRmllbGRzID1cbiAgICBTdWJzZXRPZktleXM8UjNDb21wb25lbnRNZXRhZGF0YSwgJ2RpcmVjdGl2ZXMnfCdwaXBlcyd8J3dyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmUnPjtcblxuZXhwb3J0IGludGVyZmFjZSBDb21wb25lbnRBbmFseXNpc0RhdGEge1xuICAvKipcbiAgICogYG1ldGFgIGluY2x1ZGVzIHRob3NlIGZpZWxkcyBvZiBgUjNDb21wb25lbnRNZXRhZGF0YWAgd2hpY2ggYXJlIGNhbGN1bGF0ZWQgYXQgYGFuYWx5emVgIHRpbWVcbiAgICogKG5vdCBkdXJpbmcgcmVzb2x2ZSkuXG4gICAqL1xuICBtZXRhOiBPbWl0PFIzQ29tcG9uZW50TWV0YWRhdGEsIENvbXBvbmVudE1ldGFkYXRhUmVzb2x2ZWRGaWVsZHM+O1xuICBiYXNlQ2xhc3M6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPnwnZHluYW1pYyd8bnVsbDtcbiAgdHlwZUNoZWNrTWV0YTogRGlyZWN0aXZlVHlwZUNoZWNrTWV0YTtcbiAgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlV2l0aFNvdXJjZTtcbiAgbWV0YWRhdGFTdG10OiBTdGF0ZW1lbnR8bnVsbDtcblxuICBpbnB1dHM6IENsYXNzUHJvcGVydHlNYXBwaW5nO1xuICBvdXRwdXRzOiBDbGFzc1Byb3BlcnR5TWFwcGluZztcblxuICAvKipcbiAgICogUHJvdmlkZXJzIGV4dHJhY3RlZCBmcm9tIHRoZSBgcHJvdmlkZXJzYCBmaWVsZCBvZiB0aGUgY29tcG9uZW50IGFubm90YXRpb24gd2hpY2ggd2lsbCByZXF1aXJlXG4gICAqIGFuIEFuZ3VsYXIgZmFjdG9yeSBkZWZpbml0aW9uIGF0IHJ1bnRpbWUuXG4gICAqL1xuICBwcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5OiBTZXQ8UmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+PnxudWxsO1xuXG4gIC8qKlxuICAgKiBQcm92aWRlcnMgZXh0cmFjdGVkIGZyb20gdGhlIGB2aWV3UHJvdmlkZXJzYCBmaWVsZCBvZiB0aGUgY29tcG9uZW50IGFubm90YXRpb24gd2hpY2ggd2lsbFxuICAgKiByZXF1aXJlIGFuIEFuZ3VsYXIgZmFjdG9yeSBkZWZpbml0aW9uIGF0IHJ1bnRpbWUuXG4gICAqL1xuICB2aWV3UHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeTogU2V0PFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPj58bnVsbDtcbn1cblxuZXhwb3J0IHR5cGUgQ29tcG9uZW50UmVzb2x1dGlvbkRhdGEgPSBQaWNrPFIzQ29tcG9uZW50TWV0YWRhdGEsIENvbXBvbmVudE1ldGFkYXRhUmVzb2x2ZWRGaWVsZHM+O1xuXG4vKipcbiAqIGBEZWNvcmF0b3JIYW5kbGVyYCB3aGljaCBoYW5kbGVzIHRoZSBgQENvbXBvbmVudGAgYW5ub3RhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIENvbXBvbmVudERlY29yYXRvckhhbmRsZXIgaW1wbGVtZW50c1xuICAgIERlY29yYXRvckhhbmRsZXI8RGVjb3JhdG9yLCBDb21wb25lbnRBbmFseXNpc0RhdGEsIENvbXBvbmVudFJlc29sdXRpb25EYXRhPiB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSByZWZsZWN0b3I6IFJlZmxlY3Rpb25Ib3N0LCBwcml2YXRlIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcixcbiAgICAgIHByaXZhdGUgbWV0YVJlZ2lzdHJ5OiBNZXRhZGF0YVJlZ2lzdHJ5LCBwcml2YXRlIG1ldGFSZWFkZXI6IE1ldGFkYXRhUmVhZGVyLFxuICAgICAgcHJpdmF0ZSBzY29wZVJlYWRlcjogQ29tcG9uZW50U2NvcGVSZWFkZXIsIHByaXZhdGUgc2NvcGVSZWdpc3RyeTogTG9jYWxNb2R1bGVTY29wZVJlZ2lzdHJ5LFxuICAgICAgcHJpdmF0ZSBpc0NvcmU6IGJvb2xlYW4sIHByaXZhdGUgcmVzb3VyY2VMb2FkZXI6IFJlc291cmNlTG9hZGVyLFxuICAgICAgcHJpdmF0ZSByb290RGlyczogUmVhZG9ubHlBcnJheTxzdHJpbmc+LCBwcml2YXRlIGRlZmF1bHRQcmVzZXJ2ZVdoaXRlc3BhY2VzOiBib29sZWFuLFxuICAgICAgcHJpdmF0ZSBpMThuVXNlRXh0ZXJuYWxJZHM6IGJvb2xlYW4sIHByaXZhdGUgZW5hYmxlSTE4bkxlZ2FjeU1lc3NhZ2VJZEZvcm1hdDogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzOiBib29sZWFufHVuZGVmaW5lZCxcbiAgICAgIHByaXZhdGUgbW9kdWxlUmVzb2x2ZXI6IE1vZHVsZVJlc29sdmVyLCBwcml2YXRlIGN5Y2xlQW5hbHl6ZXI6IEN5Y2xlQW5hbHl6ZXIsXG4gICAgICBwcml2YXRlIHJlZkVtaXR0ZXI6IFJlZmVyZW5jZUVtaXR0ZXIsIHByaXZhdGUgZGVmYXVsdEltcG9ydFJlY29yZGVyOiBEZWZhdWx0SW1wb3J0UmVjb3JkZXIsXG4gICAgICBwcml2YXRlIGRlcFRyYWNrZXI6IERlcGVuZGVuY3lUcmFja2VyfG51bGwsXG4gICAgICBwcml2YXRlIGluamVjdGFibGVSZWdpc3RyeTogSW5qZWN0YWJsZUNsYXNzUmVnaXN0cnksXG4gICAgICBwcml2YXRlIGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyOiBib29sZWFuKSB7fVxuXG4gIHByaXZhdGUgbGl0ZXJhbENhY2hlID0gbmV3IE1hcDxEZWNvcmF0b3IsIHRzLk9iamVjdExpdGVyYWxFeHByZXNzaW9uPigpO1xuICBwcml2YXRlIGVsZW1lbnRTY2hlbWFSZWdpc3RyeSA9IG5ldyBEb21FbGVtZW50U2NoZW1hUmVnaXN0cnkoKTtcbiAgcHJpdmF0ZSB0eXBlQ2hlY2tTY29wZXMgPSBuZXcgVHlwZUNoZWNrU2NvcGVzKHRoaXMuc2NvcGVSZWFkZXIsIHRoaXMubWV0YVJlYWRlcik7XG5cbiAgLyoqXG4gICAqIER1cmluZyB0aGUgYXN5bmNocm9ub3VzIHByZWFuYWx5emUgcGhhc2UsIGl0J3MgbmVjZXNzYXJ5IHRvIHBhcnNlIHRoZSB0ZW1wbGF0ZSB0byBleHRyYWN0XG4gICAqIGFueSBwb3RlbnRpYWwgPGxpbms+IHRhZ3Mgd2hpY2ggbWlnaHQgbmVlZCB0byBiZSBsb2FkZWQuIFRoaXMgY2FjaGUgZW5zdXJlcyB0aGF0IHdvcmsgaXMgbm90XG4gICAqIHRocm93biBhd2F5LCBhbmQgdGhlIHBhcnNlZCB0ZW1wbGF0ZSBpcyByZXVzZWQgZHVyaW5nIHRoZSBhbmFseXplIHBoYXNlLlxuICAgKi9cbiAgcHJpdmF0ZSBwcmVhbmFseXplVGVtcGxhdGVDYWNoZSA9IG5ldyBNYXA8dHMuRGVjbGFyYXRpb24sIFBhcnNlZFRlbXBsYXRlV2l0aFNvdXJjZT4oKTtcblxuICByZWFkb25seSBwcmVjZWRlbmNlID0gSGFuZGxlclByZWNlZGVuY2UuUFJJTUFSWTtcbiAgcmVhZG9ubHkgbmFtZSA9IENvbXBvbmVudERlY29yYXRvckhhbmRsZXIubmFtZTtcblxuICBkZXRlY3Qobm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgZGVjb3JhdG9yczogRGVjb3JhdG9yW118bnVsbCk6IERldGVjdFJlc3VsdDxEZWNvcmF0b3I+fHVuZGVmaW5lZCB7XG4gICAgaWYgKCFkZWNvcmF0b3JzKSB7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICBjb25zdCBkZWNvcmF0b3IgPSBmaW5kQW5ndWxhckRlY29yYXRvcihkZWNvcmF0b3JzLCAnQ29tcG9uZW50JywgdGhpcy5pc0NvcmUpO1xuICAgIGlmIChkZWNvcmF0b3IgIT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgdHJpZ2dlcjogZGVjb3JhdG9yLm5vZGUsXG4gICAgICAgIGRlY29yYXRvcixcbiAgICAgICAgbWV0YWRhdGE6IGRlY29yYXRvcixcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgcHJlYW5hbHl6ZShub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBkZWNvcmF0b3I6IFJlYWRvbmx5PERlY29yYXRvcj4pOiBQcm9taXNlPHZvaWQ+fHVuZGVmaW5lZCB7XG4gICAgLy8gSW4gcHJlYW5hbHl6ZSwgcmVzb3VyY2UgVVJMcyBhc3NvY2lhdGVkIHdpdGggdGhlIGNvbXBvbmVudCBhcmUgYXN5bmNocm9ub3VzbHkgcHJlbG9hZGVkIHZpYVxuICAgIC8vIHRoZSByZXNvdXJjZUxvYWRlci4gVGhpcyBpcyB0aGUgb25seSB0aW1lIGFzeW5jIG9wZXJhdGlvbnMgYXJlIGFsbG93ZWQgZm9yIGEgY29tcG9uZW50LlxuICAgIC8vIFRoZXNlIHJlc291cmNlcyBhcmU6XG4gICAgLy9cbiAgICAvLyAtIHRoZSB0ZW1wbGF0ZVVybCwgaWYgdGhlcmUgaXMgb25lXG4gICAgLy8gLSBhbnkgc3R5bGVVcmxzIGlmIHByZXNlbnRcbiAgICAvLyAtIGFueSBzdHlsZXNoZWV0cyByZWZlcmVuY2VkIGZyb20gPGxpbms+IHRhZ3MgaW4gdGhlIHRlbXBsYXRlIGl0c2VsZlxuICAgIC8vXG4gICAgLy8gQXMgYSByZXN1bHQgb2YgdGhlIGxhc3Qgb25lLCB0aGUgdGVtcGxhdGUgbXVzdCBiZSBwYXJzZWQgYXMgcGFydCBvZiBwcmVhbmFseXNpcyB0byBleHRyYWN0XG4gICAgLy8gPGxpbms+IHRhZ3MsIHdoaWNoIG1heSBpbnZvbHZlIHdhaXRpbmcgZm9yIHRoZSB0ZW1wbGF0ZVVybCB0byBiZSByZXNvbHZlZCBmaXJzdC5cblxuICAgIC8vIElmIHByZWxvYWRpbmcgaXNuJ3QgcG9zc2libGUsIHRoZW4gc2tpcCB0aGlzIHN0ZXAuXG4gICAgaWYgKCF0aGlzLnJlc291cmNlTG9hZGVyLmNhblByZWxvYWQpIHtcbiAgICAgIHJldHVybiB1bmRlZmluZWQ7XG4gICAgfVxuXG4gICAgY29uc3QgbWV0YSA9IHRoaXMuX3Jlc29sdmVMaXRlcmFsKGRlY29yYXRvcik7XG4gICAgY29uc3QgY29tcG9uZW50ID0gcmVmbGVjdE9iamVjdExpdGVyYWwobWV0YSk7XG4gICAgY29uc3QgY29udGFpbmluZ0ZpbGUgPSBub2RlLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZTtcblxuICAgIC8vIENvbnZlcnQgYSBzdHlsZVVybCBzdHJpbmcgaW50byBhIFByb21pc2UgdG8gcHJlbG9hZCBpdC5cbiAgICBjb25zdCByZXNvbHZlU3R5bGVVcmwgPSAoc3R5bGVVcmw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgY29uc3QgcmVzb3VyY2VVcmwgPSB0aGlzLnJlc291cmNlTG9hZGVyLnJlc29sdmUoc3R5bGVVcmwsIGNvbnRhaW5pbmdGaWxlKTtcbiAgICAgIGNvbnN0IHByb21pc2UgPSB0aGlzLnJlc291cmNlTG9hZGVyLnByZWxvYWQocmVzb3VyY2VVcmwpO1xuICAgICAgcmV0dXJuIHByb21pc2UgfHwgUHJvbWlzZS5yZXNvbHZlKCk7XG4gICAgfTtcblxuICAgIC8vIEEgUHJvbWlzZSB0aGF0IHdhaXRzIGZvciB0aGUgdGVtcGxhdGUgYW5kIGFsbCA8bGluaz5lZCBzdHlsZXMgd2l0aGluIGl0IHRvIGJlIHByZWxvYWRlZC5cbiAgICBjb25zdCB0ZW1wbGF0ZUFuZFRlbXBsYXRlU3R5bGVSZXNvdXJjZXMgPVxuICAgICAgICB0aGlzLl9wcmVsb2FkQW5kUGFyc2VUZW1wbGF0ZShub2RlLCBkZWNvcmF0b3IsIGNvbXBvbmVudCwgY29udGFpbmluZ0ZpbGUpLnRoZW4odGVtcGxhdGUgPT4ge1xuICAgICAgICAgIGlmICh0ZW1wbGF0ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIFByb21pc2UuYWxsKHRlbXBsYXRlLnN0eWxlVXJscy5tYXAocmVzb2x2ZVN0eWxlVXJsKSkudGhlbigoKSA9PiB1bmRlZmluZWQpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAvLyBFeHRyYWN0IGFsbCB0aGUgc3R5bGVVcmxzIGluIHRoZSBkZWNvcmF0b3IuXG4gICAgY29uc3Qgc3R5bGVVcmxzID0gdGhpcy5fZXh0cmFjdFN0eWxlVXJscyhjb21wb25lbnQsIFtdKTtcblxuICAgIGlmIChzdHlsZVVybHMgPT09IG51bGwpIHtcbiAgICAgIC8vIEEgZmFzdCBwYXRoIGV4aXN0cyBpZiB0aGVyZSBhcmUgbm8gc3R5bGVVcmxzLCB0byBqdXN0IHdhaXQgZm9yXG4gICAgICAvLyB0ZW1wbGF0ZUFuZFRlbXBsYXRlU3R5bGVSZXNvdXJjZXMuXG4gICAgICByZXR1cm4gdGVtcGxhdGVBbmRUZW1wbGF0ZVN0eWxlUmVzb3VyY2VzO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBXYWl0IGZvciBib3RoIHRoZSB0ZW1wbGF0ZSBhbmQgYWxsIHN0eWxlVXJsIHJlc291cmNlcyB0byByZXNvbHZlLlxuICAgICAgcmV0dXJuIFByb21pc2UuYWxsKFt0ZW1wbGF0ZUFuZFRlbXBsYXRlU3R5bGVSZXNvdXJjZXMsIC4uLnN0eWxlVXJscy5tYXAocmVzb2x2ZVN0eWxlVXJsKV0pXG4gICAgICAgICAgLnRoZW4oKCkgPT4gdW5kZWZpbmVkKTtcbiAgICB9XG4gIH1cblxuICBhbmFseXplKFxuICAgICAgbm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgZGVjb3JhdG9yOiBSZWFkb25seTxEZWNvcmF0b3I+LFxuICAgICAgZmxhZ3M6IEhhbmRsZXJGbGFncyA9IEhhbmRsZXJGbGFncy5OT05FKTogQW5hbHlzaXNPdXRwdXQ8Q29tcG9uZW50QW5hbHlzaXNEYXRhPiB7XG4gICAgY29uc3QgY29udGFpbmluZ0ZpbGUgPSBub2RlLmdldFNvdXJjZUZpbGUoKS5maWxlTmFtZTtcbiAgICB0aGlzLmxpdGVyYWxDYWNoZS5kZWxldGUoZGVjb3JhdG9yKTtcblxuICAgIC8vIEBDb21wb25lbnQgaW5oZXJpdHMgQERpcmVjdGl2ZSwgc28gYmVnaW4gYnkgZXh0cmFjdGluZyB0aGUgQERpcmVjdGl2ZSBtZXRhZGF0YSBhbmQgYnVpbGRpbmdcbiAgICAvLyBvbiBpdC5cbiAgICBjb25zdCBkaXJlY3RpdmVSZXN1bHQgPSBleHRyYWN0RGlyZWN0aXZlTWV0YWRhdGEoXG4gICAgICAgIG5vZGUsIGRlY29yYXRvciwgdGhpcy5yZWZsZWN0b3IsIHRoaXMuZXZhbHVhdG9yLCB0aGlzLmRlZmF1bHRJbXBvcnRSZWNvcmRlciwgdGhpcy5pc0NvcmUsXG4gICAgICAgIGZsYWdzLCB0aGlzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyLFxuICAgICAgICB0aGlzLmVsZW1lbnRTY2hlbWFSZWdpc3RyeS5nZXREZWZhdWx0Q29tcG9uZW50RWxlbWVudE5hbWUoKSk7XG4gICAgaWYgKGRpcmVjdGl2ZVJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBgZXh0cmFjdERpcmVjdGl2ZU1ldGFkYXRhYCByZXR1cm5zIHVuZGVmaW5lZCB3aGVuIHRoZSBARGlyZWN0aXZlIGhhcyBgaml0OiB0cnVlYC4gSW4gdGhpc1xuICAgICAgLy8gY2FzZSwgY29tcGlsYXRpb24gb2YgdGhlIGRlY29yYXRvciBpcyBza2lwcGVkLiBSZXR1cm5pbmcgYW4gZW1wdHkgb2JqZWN0IHNpZ25pZmllc1xuICAgICAgLy8gdGhhdCBubyBhbmFseXNpcyB3YXMgcHJvZHVjZWQuXG4gICAgICByZXR1cm4ge307XG4gICAgfVxuXG4gICAgLy8gTmV4dCwgcmVhZCB0aGUgYEBDb21wb25lbnRgLXNwZWNpZmljIGZpZWxkcy5cbiAgICBjb25zdCB7ZGVjb3JhdG9yOiBjb21wb25lbnQsIG1ldGFkYXRhLCBpbnB1dHMsIG91dHB1dHN9ID0gZGlyZWN0aXZlUmVzdWx0O1xuXG4gICAgLy8gR28gdGhyb3VnaCB0aGUgcm9vdCBkaXJlY3RvcmllcyBmb3IgdGhpcyBwcm9qZWN0LCBhbmQgc2VsZWN0IHRoZSBvbmUgd2l0aCB0aGUgc21hbGxlc3RcbiAgICAvLyByZWxhdGl2ZSBwYXRoIHJlcHJlc2VudGF0aW9uLlxuICAgIGNvbnN0IHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoID0gdGhpcy5yb290RGlycy5yZWR1Y2U8c3RyaW5nfHVuZGVmaW5lZD4oKHByZXZpb3VzLCByb290RGlyKSA9PiB7XG4gICAgICBjb25zdCBjYW5kaWRhdGUgPSByZWxhdGl2ZShhYnNvbHV0ZUZyb20ocm9vdERpciksIGFic29sdXRlRnJvbShjb250YWluaW5nRmlsZSkpO1xuICAgICAgaWYgKHByZXZpb3VzID09PSB1bmRlZmluZWQgfHwgY2FuZGlkYXRlLmxlbmd0aCA8IHByZXZpb3VzLmxlbmd0aCkge1xuICAgICAgICByZXR1cm4gY2FuZGlkYXRlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHByZXZpb3VzO1xuICAgICAgfVxuICAgIH0sIHVuZGVmaW5lZCkhO1xuXG5cbiAgICAvLyBOb3RlIHRoYXQgd2UgY291bGQgdGVjaG5pY2FsbHkgY29tYmluZSB0aGUgYHZpZXdQcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5YCBhbmRcbiAgICAvLyBgcHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeWAgaW50byBhIHNpbmdsZSBzZXQsIGJ1dCB3ZSBrZWVwIHRoZSBzZXBhcmF0ZSBzbyB0aGF0XG4gICAgLy8gd2UgY2FuIGRpc3Rpbmd1aXNoIHdoZXJlIGFuIGVycm9yIGlzIGNvbWluZyBmcm9tIHdoZW4gbG9nZ2luZyB0aGUgZGlhZ25vc3RpY3MgaW4gYHJlc29sdmVgLlxuICAgIGxldCB2aWV3UHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeTogU2V0PFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPj58bnVsbCA9IG51bGw7XG4gICAgbGV0IHByb3ZpZGVyc1JlcXVpcmluZ0ZhY3Rvcnk6IFNldDxSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4+fG51bGwgPSBudWxsO1xuICAgIGxldCB3cmFwcGVkVmlld1Byb3ZpZGVyczogRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcblxuICAgIGlmIChjb21wb25lbnQuaGFzKCd2aWV3UHJvdmlkZXJzJykpIHtcbiAgICAgIGNvbnN0IHZpZXdQcm92aWRlcnMgPSBjb21wb25lbnQuZ2V0KCd2aWV3UHJvdmlkZXJzJykhO1xuICAgICAgdmlld1Byb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnkgPVxuICAgICAgICAgIHJlc29sdmVQcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5KHZpZXdQcm92aWRlcnMsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmV2YWx1YXRvcik7XG4gICAgICB3cmFwcGVkVmlld1Byb3ZpZGVycyA9IG5ldyBXcmFwcGVkTm9kZUV4cHIoXG4gICAgICAgICAgdGhpcy5hbm5vdGF0ZUZvckNsb3N1cmVDb21waWxlciA/IHdyYXBGdW5jdGlvbkV4cHJlc3Npb25zSW5QYXJlbnModmlld1Byb3ZpZGVycykgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2aWV3UHJvdmlkZXJzKTtcbiAgICB9XG5cbiAgICBpZiAoY29tcG9uZW50LmhhcygncHJvdmlkZXJzJykpIHtcbiAgICAgIHByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnkgPSByZXNvbHZlUHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeShcbiAgICAgICAgICBjb21wb25lbnQuZ2V0KCdwcm92aWRlcnMnKSEsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmV2YWx1YXRvcik7XG4gICAgfVxuXG4gICAgLy8gUGFyc2UgdGhlIHRlbXBsYXRlLlxuICAgIC8vIElmIGEgcHJlYW5hbHl6ZSBwaGFzZSB3YXMgZXhlY3V0ZWQsIHRoZSB0ZW1wbGF0ZSBtYXkgYWxyZWFkeSBleGlzdCBpbiBwYXJzZWQgZm9ybSwgc28gY2hlY2tcbiAgICAvLyB0aGUgcHJlYW5hbHl6ZVRlbXBsYXRlQ2FjaGUuXG4gICAgLy8gRXh0cmFjdCBhIGNsb3N1cmUgb2YgdGhlIHRlbXBsYXRlIHBhcnNpbmcgY29kZSBzbyB0aGF0IGl0IGNhbiBiZSByZXBhcnNlZCB3aXRoIGRpZmZlcmVudFxuICAgIC8vIG9wdGlvbnMgaWYgbmVlZGVkLCBsaWtlIGluIHRoZSBpbmRleGluZyBwaXBlbGluZS5cbiAgICBsZXQgdGVtcGxhdGU6IFBhcnNlZFRlbXBsYXRlV2l0aFNvdXJjZTtcbiAgICBpZiAodGhpcy5wcmVhbmFseXplVGVtcGxhdGVDYWNoZS5oYXMobm9kZSkpIHtcbiAgICAgIC8vIFRoZSB0ZW1wbGF0ZSB3YXMgcGFyc2VkIGluIHByZWFuYWx5emUuIFVzZSBpdCBhbmQgZGVsZXRlIGl0IHRvIHNhdmUgbWVtb3J5LlxuICAgICAgY29uc3QgcHJlYW5hbHl6ZWQgPSB0aGlzLnByZWFuYWx5emVUZW1wbGF0ZUNhY2hlLmdldChub2RlKSE7XG4gICAgICB0aGlzLnByZWFuYWx5emVUZW1wbGF0ZUNhY2hlLmRlbGV0ZShub2RlKTtcblxuICAgICAgdGVtcGxhdGUgPSBwcmVhbmFseXplZDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gVGhlIHRlbXBsYXRlIHdhcyBub3QgYWxyZWFkeSBwYXJzZWQuIEVpdGhlciB0aGVyZSdzIGEgdGVtcGxhdGVVcmwsIG9yIGFuIGlubGluZSB0ZW1wbGF0ZS5cbiAgICAgIGlmIChjb21wb25lbnQuaGFzKCd0ZW1wbGF0ZVVybCcpKSB7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlVXJsRXhwciA9IGNvbXBvbmVudC5nZXQoJ3RlbXBsYXRlVXJsJykhO1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZVVybCA9IHRoaXMuZXZhbHVhdG9yLmV2YWx1YXRlKHRlbXBsYXRlVXJsRXhwcik7XG4gICAgICAgIGlmICh0eXBlb2YgdGVtcGxhdGVVcmwgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgICAgICAgdGVtcGxhdGVVcmxFeHByLCB0ZW1wbGF0ZVVybCwgJ3RlbXBsYXRlVXJsIG11c3QgYmUgYSBzdHJpbmcnKTtcbiAgICAgICAgfVxuICAgICAgICBjb25zdCByZXNvdXJjZVVybCA9IHRoaXMucmVzb3VyY2VMb2FkZXIucmVzb2x2ZSh0ZW1wbGF0ZVVybCwgY29udGFpbmluZ0ZpbGUpO1xuICAgICAgICB0ZW1wbGF0ZSA9IHRoaXMuX2V4dHJhY3RFeHRlcm5hbFRlbXBsYXRlKG5vZGUsIGNvbXBvbmVudCwgdGVtcGxhdGVVcmxFeHByLCByZXNvdXJjZVVybCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBFeHBlY3QgYW4gaW5saW5lIHRlbXBsYXRlIHRvIGJlIHByZXNlbnQuXG4gICAgICAgIHRlbXBsYXRlID0gdGhpcy5fZXh0cmFjdElubGluZVRlbXBsYXRlKG5vZGUsIGRlY29yYXRvciwgY29tcG9uZW50LCBjb250YWluaW5nRmlsZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgbGV0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW118dW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG4gICAgaWYgKHRlbXBsYXRlLmVycm9ycyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgYW55IHRlbXBsYXRlIHBhcnNpbmcgZXJyb3JzLCBjb252ZXJ0IHRoZW0gdG8gYHRzLkRpYWdub3N0aWNgcyBmb3IgZGlzcGxheS5cbiAgICAgIGNvbnN0IGlkID0gZ2V0VGVtcGxhdGVJZChub2RlKTtcbiAgICAgIGRpYWdub3N0aWNzID0gdGVtcGxhdGUuZXJyb3JzLm1hcChlcnJvciA9PiB7XG4gICAgICAgIGNvbnN0IHNwYW4gPSBlcnJvci5zcGFuO1xuXG4gICAgICAgIGlmIChzcGFuLnN0YXJ0Lm9mZnNldCA9PT0gc3Bhbi5lbmQub2Zmc2V0KSB7XG4gICAgICAgICAgLy8gVGVtcGxhdGUgZXJyb3JzIGNhbiBjb250YWluIHplcm8tbGVuZ3RoIHNwYW5zLCBpZiB0aGUgZXJyb3Igb2NjdXJzIGF0IGEgc2luZ2xlIHBvaW50LlxuICAgICAgICAgIC8vIEhvd2V2ZXIsIFR5cGVTY3JpcHQgZG9lcyBub3QgaGFuZGxlIGRpc3BsYXlpbmcgYSB6ZXJvLWxlbmd0aCBkaWFnbm9zdGljIHZlcnkgd2VsbCwgc29cbiAgICAgICAgICAvLyBpbmNyZWFzZSB0aGUgZW5kaW5nIG9mZnNldCBieSAxIGZvciBzdWNoIGVycm9ycywgdG8gZW5zdXJlIHRoZSBwb3NpdGlvbiBpcyBzaG93biBpbiB0aGVcbiAgICAgICAgICAvLyBkaWFnbm9zdGljLlxuICAgICAgICAgIHNwYW4uZW5kLm9mZnNldCsrO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIG1ha2VUZW1wbGF0ZURpYWdub3N0aWMoXG4gICAgICAgICAgICBpZCwgdGVtcGxhdGUuc291cmNlTWFwcGluZywgc3BhbiwgdHMuRGlhZ25vc3RpY0NhdGVnb3J5LkVycm9yLFxuICAgICAgICAgICAgbmdFcnJvckNvZGUoRXJyb3JDb2RlLlRFTVBMQVRFX1BBUlNFX0VSUk9SKSwgZXJyb3IubXNnKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIEZpZ3VyZSBvdXQgdGhlIHNldCBvZiBzdHlsZXMuIFRoZSBvcmRlcmluZyBoZXJlIGlzIGltcG9ydGFudDogZXh0ZXJuYWwgcmVzb3VyY2VzIChzdHlsZVVybHMpXG4gICAgLy8gcHJlY2VkZSBpbmxpbmUgc3R5bGVzLCBhbmQgc3R5bGVzIGRlZmluZWQgaW4gdGhlIHRlbXBsYXRlIG92ZXJyaWRlIHN0eWxlcyBkZWZpbmVkIGluIHRoZVxuICAgIC8vIGNvbXBvbmVudC5cbiAgICBsZXQgc3R5bGVzOiBzdHJpbmdbXXxudWxsID0gbnVsbDtcblxuICAgIGNvbnN0IHN0eWxlVXJscyA9IHRoaXMuX2V4dHJhY3RTdHlsZVVybHMoY29tcG9uZW50LCB0ZW1wbGF0ZS5zdHlsZVVybHMpO1xuICAgIGlmIChzdHlsZVVybHMgIT09IG51bGwpIHtcbiAgICAgIGlmIChzdHlsZXMgPT09IG51bGwpIHtcbiAgICAgICAgc3R5bGVzID0gW107XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IHN0eWxlVXJsIG9mIHN0eWxlVXJscykge1xuICAgICAgICBjb25zdCByZXNvdXJjZVVybCA9IHRoaXMucmVzb3VyY2VMb2FkZXIucmVzb2x2ZShzdHlsZVVybCwgY29udGFpbmluZ0ZpbGUpO1xuICAgICAgICBjb25zdCByZXNvdXJjZVN0ciA9IHRoaXMucmVzb3VyY2VMb2FkZXIubG9hZChyZXNvdXJjZVVybCk7XG4gICAgICAgIHN0eWxlcy5wdXNoKHJlc291cmNlU3RyKTtcbiAgICAgICAgaWYgKHRoaXMuZGVwVHJhY2tlciAhPT0gbnVsbCkge1xuICAgICAgICAgIHRoaXMuZGVwVHJhY2tlci5hZGRSZXNvdXJjZURlcGVuZGVuY3kobm9kZS5nZXRTb3VyY2VGaWxlKCksIGFic29sdXRlRnJvbShyZXNvdXJjZVVybCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjb21wb25lbnQuaGFzKCdzdHlsZXMnKSkge1xuICAgICAgY29uc3QgbGl0U3R5bGVzID0gcGFyc2VGaWVsZEFycmF5VmFsdWUoY29tcG9uZW50LCAnc3R5bGVzJywgdGhpcy5ldmFsdWF0b3IpO1xuICAgICAgaWYgKGxpdFN0eWxlcyAhPT0gbnVsbCkge1xuICAgICAgICBpZiAoc3R5bGVzID09PSBudWxsKSB7XG4gICAgICAgICAgc3R5bGVzID0gbGl0U3R5bGVzO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0eWxlcy5wdXNoKC4uLmxpdFN0eWxlcyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRlbXBsYXRlLnN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICBpZiAoc3R5bGVzID09PSBudWxsKSB7XG4gICAgICAgIHN0eWxlcyA9IHRlbXBsYXRlLnN0eWxlcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0eWxlcy5wdXNoKC4uLnRlbXBsYXRlLnN0eWxlcyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3QgZW5jYXBzdWxhdGlvbjogbnVtYmVyID1cbiAgICAgICAgdGhpcy5fcmVzb2x2ZUVudW1WYWx1ZShjb21wb25lbnQsICdlbmNhcHN1bGF0aW9uJywgJ1ZpZXdFbmNhcHN1bGF0aW9uJykgfHwgMDtcblxuICAgIGNvbnN0IGNoYW5nZURldGVjdGlvbjogbnVtYmVyfG51bGwgPVxuICAgICAgICB0aGlzLl9yZXNvbHZlRW51bVZhbHVlKGNvbXBvbmVudCwgJ2NoYW5nZURldGVjdGlvbicsICdDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneScpO1xuXG4gICAgbGV0IGFuaW1hdGlvbnM6IEV4cHJlc3Npb258bnVsbCA9IG51bGw7XG4gICAgaWYgKGNvbXBvbmVudC5oYXMoJ2FuaW1hdGlvbnMnKSkge1xuICAgICAgYW5pbWF0aW9ucyA9IG5ldyBXcmFwcGVkTm9kZUV4cHIoY29tcG9uZW50LmdldCgnYW5pbWF0aW9ucycpISk7XG4gICAgfVxuXG4gICAgY29uc3Qgb3V0cHV0OiBBbmFseXNpc091dHB1dDxDb21wb25lbnRBbmFseXNpc0RhdGE+ID0ge1xuICAgICAgYW5hbHlzaXM6IHtcbiAgICAgICAgYmFzZUNsYXNzOiByZWFkQmFzZUNsYXNzKG5vZGUsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmV2YWx1YXRvciksXG4gICAgICAgIGlucHV0cyxcbiAgICAgICAgb3V0cHV0cyxcbiAgICAgICAgbWV0YToge1xuICAgICAgICAgIC4uLm1ldGFkYXRhLFxuICAgICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgICBub2RlczogdGVtcGxhdGUuZW1pdE5vZGVzLFxuICAgICAgICAgICAgbmdDb250ZW50U2VsZWN0b3JzOiB0ZW1wbGF0ZS5uZ0NvbnRlbnRTZWxlY3RvcnMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBlbmNhcHN1bGF0aW9uLFxuICAgICAgICAgIGludGVycG9sYXRpb246IHRlbXBsYXRlLmludGVycG9sYXRpb24sXG4gICAgICAgICAgc3R5bGVzOiBzdHlsZXMgfHwgW10sXG5cbiAgICAgICAgICAvLyBUaGVzZSB3aWxsIGJlIHJlcGxhY2VkIGR1cmluZyB0aGUgY29tcGlsYXRpb24gc3RlcCwgYWZ0ZXIgYWxsIGBOZ01vZHVsZWBzIGhhdmUgYmVlblxuICAgICAgICAgIC8vIGFuYWx5emVkIGFuZCB0aGUgZnVsbCBjb21waWxhdGlvbiBzY29wZSBmb3IgdGhlIGNvbXBvbmVudCBjYW4gYmUgcmVhbGl6ZWQuXG4gICAgICAgICAgYW5pbWF0aW9ucyxcbiAgICAgICAgICB2aWV3UHJvdmlkZXJzOiB3cmFwcGVkVmlld1Byb3ZpZGVycyxcbiAgICAgICAgICBpMThuVXNlRXh0ZXJuYWxJZHM6IHRoaXMuaTE4blVzZUV4dGVybmFsSWRzLFxuICAgICAgICAgIHJlbGF0aXZlQ29udGV4dEZpbGVQYXRoLFxuICAgICAgICB9LFxuICAgICAgICB0eXBlQ2hlY2tNZXRhOiBleHRyYWN0RGlyZWN0aXZlVHlwZUNoZWNrTWV0YShub2RlLCBpbnB1dHMsIHRoaXMucmVmbGVjdG9yKSxcbiAgICAgICAgbWV0YWRhdGFTdG10OiBnZW5lcmF0ZVNldENsYXNzTWV0YWRhdGFDYWxsKFxuICAgICAgICAgICAgbm9kZSwgdGhpcy5yZWZsZWN0b3IsIHRoaXMuZGVmYXVsdEltcG9ydFJlY29yZGVyLCB0aGlzLmlzQ29yZSxcbiAgICAgICAgICAgIHRoaXMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIpLFxuICAgICAgICB0ZW1wbGF0ZSxcbiAgICAgICAgcHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeSxcbiAgICAgICAgdmlld1Byb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnksXG4gICAgICB9LFxuICAgICAgZGlhZ25vc3RpY3MsXG4gICAgfTtcbiAgICBpZiAoY2hhbmdlRGV0ZWN0aW9uICE9PSBudWxsKSB7XG4gICAgICBvdXRwdXQuYW5hbHlzaXMhLm1ldGEuY2hhbmdlRGV0ZWN0aW9uID0gY2hhbmdlRGV0ZWN0aW9uO1xuICAgIH1cbiAgICByZXR1cm4gb3V0cHV0O1xuICB9XG5cbiAgcmVnaXN0ZXIobm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgYW5hbHlzaXM6IENvbXBvbmVudEFuYWx5c2lzRGF0YSk6IHZvaWQge1xuICAgIC8vIFJlZ2lzdGVyIHRoaXMgY29tcG9uZW50J3MgaW5mb3JtYXRpb24gd2l0aCB0aGUgYE1ldGFkYXRhUmVnaXN0cnlgLiBUaGlzIGVuc3VyZXMgdGhhdFxuICAgIC8vIHRoZSBpbmZvcm1hdGlvbiBhYm91dCB0aGUgY29tcG9uZW50IGlzIGF2YWlsYWJsZSBkdXJpbmcgdGhlIGNvbXBpbGUoKSBwaGFzZS5cbiAgICBjb25zdCByZWYgPSBuZXcgUmVmZXJlbmNlKG5vZGUpO1xuICAgIHRoaXMubWV0YVJlZ2lzdHJ5LnJlZ2lzdGVyRGlyZWN0aXZlTWV0YWRhdGEoe1xuICAgICAgcmVmLFxuICAgICAgbmFtZTogbm9kZS5uYW1lLnRleHQsXG4gICAgICBzZWxlY3RvcjogYW5hbHlzaXMubWV0YS5zZWxlY3RvcixcbiAgICAgIGV4cG9ydEFzOiBhbmFseXNpcy5tZXRhLmV4cG9ydEFzLFxuICAgICAgaW5wdXRzOiBhbmFseXNpcy5pbnB1dHMsXG4gICAgICBvdXRwdXRzOiBhbmFseXNpcy5vdXRwdXRzLFxuICAgICAgcXVlcmllczogYW5hbHlzaXMubWV0YS5xdWVyaWVzLm1hcChxdWVyeSA9PiBxdWVyeS5wcm9wZXJ0eU5hbWUpLFxuICAgICAgaXNDb21wb25lbnQ6IHRydWUsXG4gICAgICBiYXNlQ2xhc3M6IGFuYWx5c2lzLmJhc2VDbGFzcyxcbiAgICAgIC4uLmFuYWx5c2lzLnR5cGVDaGVja01ldGEsXG4gICAgfSk7XG5cbiAgICB0aGlzLmluamVjdGFibGVSZWdpc3RyeS5yZWdpc3RlckluamVjdGFibGUobm9kZSk7XG4gIH1cblxuICBpbmRleChcbiAgICAgIGNvbnRleHQ6IEluZGV4aW5nQ29udGV4dCwgbm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgYW5hbHlzaXM6IFJlYWRvbmx5PENvbXBvbmVudEFuYWx5c2lzRGF0YT4pIHtcbiAgICBjb25zdCBzY29wZSA9IHRoaXMuc2NvcGVSZWFkZXIuZ2V0U2NvcGVGb3JDb21wb25lbnQobm9kZSk7XG4gICAgY29uc3Qgc2VsZWN0b3IgPSBhbmFseXNpcy5tZXRhLnNlbGVjdG9yO1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZU1ldGE+KCk7XG4gICAgaWYgKHNjb3BlID09PSAnZXJyb3InKSB7XG4gICAgICAvLyBEb24ndCBib3RoZXIgaW5kZXhpbmcgY29tcG9uZW50cyB3aGljaCBoYWQgZXJyb25lb3VzIHNjb3Blcy5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGlmIChzY29wZSAhPT0gbnVsbCkge1xuICAgICAgZm9yIChjb25zdCBkaXJlY3RpdmUgb2Ygc2NvcGUuY29tcGlsYXRpb24uZGlyZWN0aXZlcykge1xuICAgICAgICBpZiAoZGlyZWN0aXZlLnNlbGVjdG9yICE9PSBudWxsKSB7XG4gICAgICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShkaXJlY3RpdmUuc2VsZWN0b3IpLCBkaXJlY3RpdmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIGNvbnN0IGJpbmRlciA9IG5ldyBSM1RhcmdldEJpbmRlcihtYXRjaGVyKTtcbiAgICBjb25zdCBib3VuZFRlbXBsYXRlID0gYmluZGVyLmJpbmQoe3RlbXBsYXRlOiBhbmFseXNpcy50ZW1wbGF0ZS5kaWFnTm9kZXN9KTtcblxuICAgIGNvbnRleHQuYWRkQ29tcG9uZW50KHtcbiAgICAgIGRlY2xhcmF0aW9uOiBub2RlLFxuICAgICAgc2VsZWN0b3IsXG4gICAgICBib3VuZFRlbXBsYXRlLFxuICAgICAgdGVtcGxhdGVNZXRhOiB7XG4gICAgICAgIGlzSW5saW5lOiBhbmFseXNpcy50ZW1wbGF0ZS5pc0lubGluZSxcbiAgICAgICAgZmlsZTogYW5hbHlzaXMudGVtcGxhdGUuZmlsZSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICB0eXBlQ2hlY2soY3R4OiBUeXBlQ2hlY2tDb250ZXh0LCBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBtZXRhOiBSZWFkb25seTxDb21wb25lbnRBbmFseXNpc0RhdGE+KTpcbiAgICAgIHZvaWQge1xuICAgIGlmICghdHMuaXNDbGFzc0RlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3Qgc2NvcGUgPSB0aGlzLnR5cGVDaGVja1Njb3Blcy5nZXRUeXBlQ2hlY2tTY29wZShub2RlKTtcbiAgICBpZiAoc2NvcGUgPT09ICdlcnJvcicpIHtcbiAgICAgIC8vIERvbid0IHR5cGUtY2hlY2sgY29tcG9uZW50cyB0aGF0IGhhZCBlcnJvcnMgaW4gdGhlaXIgc2NvcGVzLlxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGJpbmRlciA9IG5ldyBSM1RhcmdldEJpbmRlcihzY29wZS5tYXRjaGVyKTtcbiAgICBjdHguYWRkVGVtcGxhdGUoXG4gICAgICAgIG5ldyBSZWZlcmVuY2Uobm9kZSksIGJpbmRlciwgbWV0YS50ZW1wbGF0ZS5kaWFnTm9kZXMsIHNjb3BlLnBpcGVzLCBzY29wZS5zY2hlbWFzLFxuICAgICAgICBtZXRhLnRlbXBsYXRlLnNvdXJjZU1hcHBpbmcsIG1ldGEudGVtcGxhdGUuZmlsZSk7XG4gIH1cblxuICByZXNvbHZlKG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGFuYWx5c2lzOiBSZWFkb25seTxDb21wb25lbnRBbmFseXNpc0RhdGE+KTpcbiAgICAgIFJlc29sdmVSZXN1bHQ8Q29tcG9uZW50UmVzb2x1dGlvbkRhdGE+IHtcbiAgICBjb25zdCBjb250ZXh0ID0gbm9kZS5nZXRTb3VyY2VGaWxlKCk7XG4gICAgLy8gQ2hlY2sgd2hldGhlciB0aGlzIGNvbXBvbmVudCB3YXMgcmVnaXN0ZXJlZCB3aXRoIGFuIE5nTW9kdWxlLiBJZiBzbywgaXQgc2hvdWxkIGJlIGNvbXBpbGVkXG4gICAgLy8gdW5kZXIgdGhhdCBtb2R1bGUncyBjb21waWxhdGlvbiBzY29wZS5cbiAgICBjb25zdCBzY29wZSA9IHRoaXMuc2NvcGVSZWFkZXIuZ2V0U2NvcGVGb3JDb21wb25lbnQobm9kZSk7XG4gICAgbGV0IG1ldGFkYXRhID0gYW5hbHlzaXMubWV0YSBhcyBSZWFkb25seTxSM0NvbXBvbmVudE1ldGFkYXRhPjtcblxuICAgIGNvbnN0IGRhdGE6IENvbXBvbmVudFJlc29sdXRpb25EYXRhID0ge1xuICAgICAgZGlyZWN0aXZlczogRU1QVFlfQVJSQVksXG4gICAgICBwaXBlczogRU1QVFlfTUFQLFxuICAgICAgd3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZTogZmFsc2UsXG4gICAgfTtcblxuICAgIGlmIChzY29wZSAhPT0gbnVsbCAmJiBzY29wZSAhPT0gJ2Vycm9yJykge1xuICAgICAgLy8gUmVwbGFjZSB0aGUgZW1wdHkgY29tcG9uZW50cyBhbmQgZGlyZWN0aXZlcyBmcm9tIHRoZSBhbmFseXplKCkgc3RlcCB3aXRoIGEgZnVsbHkgZXhwYW5kZWRcbiAgICAgIC8vIHNjb3BlLiBUaGlzIGlzIHBvc3NpYmxlIG5vdyBiZWNhdXNlIGR1cmluZyByZXNvbHZlKCkgdGhlIHdob2xlIGNvbXBpbGF0aW9uIHVuaXQgaGFzIGJlZW5cbiAgICAgIC8vIGZ1bGx5IGFuYWx5emVkLlxuICAgICAgLy9cbiAgICAgIC8vIEZpcnN0IGl0IG5lZWRzIHRvIGJlIGRldGVybWluZWQgaWYgYWN0dWFsbHkgaW1wb3J0aW5nIHRoZSBkaXJlY3RpdmVzL3BpcGVzIHVzZWQgaW4gdGhlXG4gICAgICAvLyB0ZW1wbGF0ZSB3b3VsZCBjcmVhdGUgYSBjeWNsZS4gQ3VycmVudGx5IG5ndHNjIHJlZnVzZXMgdG8gZ2VuZXJhdGUgY3ljbGVzLCBzbyBhbiBvcHRpb25cbiAgICAgIC8vIGtub3duIGFzIFwicmVtb3RlIHNjb3BpbmdcIiBpcyB1c2VkIGlmIGEgY3ljbGUgd291bGQgYmUgY3JlYXRlZC4gSW4gcmVtb3RlIHNjb3BpbmcsIHRoZVxuICAgICAgLy8gbW9kdWxlIGZpbGUgc2V0cyB0aGUgZGlyZWN0aXZlcy9waXBlcyBvbiB0aGUgybVjbXAgb2YgdGhlIGNvbXBvbmVudCwgd2l0aG91dFxuICAgICAgLy8gcmVxdWlyaW5nIG5ldyBpbXBvcnRzIChidXQgYWxzbyBpbiBhIHdheSB0aGF0IGJyZWFrcyB0cmVlIHNoYWtpbmcpLlxuICAgICAgLy9cbiAgICAgIC8vIERldGVybWluaW5nIHRoaXMgaXMgY2hhbGxlbmdpbmcsIGJlY2F1c2UgdGhlIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIgaXMgcmVzcG9uc2libGUgZm9yXG4gICAgICAvLyBtYXRjaGluZyBkaXJlY3RpdmVzIGFuZCBwaXBlcyBpbiB0aGUgdGVtcGxhdGU7IGhvd2V2ZXIsIHRoYXQgZG9lc24ndCBydW4gdW50aWwgdGhlIGFjdHVhbFxuICAgICAgLy8gY29tcGlsZSgpIHN0ZXAuIEl0J3Mgbm90IHBvc3NpYmxlIHRvIHJ1biB0ZW1wbGF0ZSBjb21waWxhdGlvbiBzb29uZXIgYXMgaXQgcmVxdWlyZXMgdGhlXG4gICAgICAvLyBDb25zdGFudFBvb2wgZm9yIHRoZSBvdmVyYWxsIGZpbGUgYmVpbmcgY29tcGlsZWQgKHdoaWNoIGlzbid0IGF2YWlsYWJsZSB1bnRpbCB0aGUgdHJhbnNmb3JtXG4gICAgICAvLyBzdGVwKS5cbiAgICAgIC8vXG4gICAgICAvLyBJbnN0ZWFkLCBkaXJlY3RpdmVzL3BpcGVzIGFyZSBtYXRjaGVkIGluZGVwZW5kZW50bHkgaGVyZSwgdXNpbmcgdGhlIFIzVGFyZ2V0QmluZGVyLiBUaGlzIGlzXG4gICAgICAvLyBhbiBhbHRlcm5hdGl2ZSBpbXBsZW1lbnRhdGlvbiBvZiB0ZW1wbGF0ZSBtYXRjaGluZyB3aGljaCBpcyB1c2VkIGZvciB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nXG4gICAgICAvLyBhbmQgd2lsbCBldmVudHVhbGx5IHJlcGxhY2UgbWF0Y2hpbmcgaW4gdGhlIFRlbXBsYXRlRGVmaW5pdGlvbkJ1aWxkZXIuXG5cblxuICAgICAgLy8gU2V0IHVwIHRoZSBSM1RhcmdldEJpbmRlciwgYXMgd2VsbCBhcyBhICdkaXJlY3RpdmVzJyBhcnJheSBhbmQgYSAncGlwZXMnIG1hcCB0aGF0IGFyZSBsYXRlclxuICAgICAgLy8gZmVkIHRvIHRoZSBUZW1wbGF0ZURlZmluaXRpb25CdWlsZGVyLiBGaXJzdCwgYSBTZWxlY3Rvck1hdGNoZXIgaXMgY29uc3RydWN0ZWQgdG8gbWF0Y2hcbiAgICAgIC8vIGRpcmVjdGl2ZXMgdGhhdCBhcmUgaW4gc2NvcGUuXG4gICAgICB0eXBlIE1hdGNoZWREaXJlY3RpdmUgPSBEaXJlY3RpdmVNZXRhJntzZWxlY3Rvcjogc3RyaW5nfTtcbiAgICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyPE1hdGNoZWREaXJlY3RpdmU+KCk7XG5cbiAgICAgIGZvciAoY29uc3QgZGlyIG9mIHNjb3BlLmNvbXBpbGF0aW9uLmRpcmVjdGl2ZXMpIHtcbiAgICAgICAgaWYgKGRpci5zZWxlY3RvciAhPT0gbnVsbCkge1xuICAgICAgICAgIG1hdGNoZXIuYWRkU2VsZWN0YWJsZXMoQ3NzU2VsZWN0b3IucGFyc2UoZGlyLnNlbGVjdG9yKSwgZGlyIGFzIE1hdGNoZWREaXJlY3RpdmUpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBjb25zdCBwaXBlcyA9IG5ldyBNYXA8c3RyaW5nLCBSZWZlcmVuY2U8Q2xhc3NEZWNsYXJhdGlvbj4+KCk7XG4gICAgICBmb3IgKGNvbnN0IHBpcGUgb2Ygc2NvcGUuY29tcGlsYXRpb24ucGlwZXMpIHtcbiAgICAgICAgcGlwZXMuc2V0KHBpcGUubmFtZSwgcGlwZS5yZWYpO1xuICAgICAgfVxuXG4gICAgICAvLyBOZXh0LCB0aGUgY29tcG9uZW50IHRlbXBsYXRlIEFTVCBpcyBib3VuZCB1c2luZyB0aGUgUjNUYXJnZXRCaW5kZXIuIFRoaXMgcHJvZHVjZXMgYVxuICAgICAgLy8gQm91bmRUYXJnZXQsIHdoaWNoIGlzIHNpbWlsYXIgdG8gYSB0cy5UeXBlQ2hlY2tlci5cbiAgICAgIGNvbnN0IGJpbmRlciA9IG5ldyBSM1RhcmdldEJpbmRlcihtYXRjaGVyKTtcbiAgICAgIGNvbnN0IGJvdW5kID0gYmluZGVyLmJpbmQoe3RlbXBsYXRlOiBtZXRhZGF0YS50ZW1wbGF0ZS5ub2Rlc30pO1xuXG4gICAgICAvLyBUaGUgQm91bmRUYXJnZXQga25vd3Mgd2hpY2ggZGlyZWN0aXZlcyBhbmQgcGlwZXMgbWF0Y2hlZCB0aGUgdGVtcGxhdGUuXG4gICAgICBjb25zdCB1c2VkRGlyZWN0aXZlcyA9IGJvdW5kLmdldFVzZWREaXJlY3RpdmVzKCkubWFwKGRpcmVjdGl2ZSA9PiB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc2VsZWN0b3I6IGRpcmVjdGl2ZS5zZWxlY3RvcixcbiAgICAgICAgICBleHByZXNzaW9uOiB0aGlzLnJlZkVtaXR0ZXIuZW1pdChkaXJlY3RpdmUucmVmLCBjb250ZXh0KSxcbiAgICAgICAgfTtcbiAgICAgIH0pO1xuXG4gICAgICBjb25zdCB1c2VkUGlwZXM6IHtwaXBlTmFtZTogc3RyaW5nLCBleHByZXNzaW9uOiBFeHByZXNzaW9ufVtdID0gW107XG4gICAgICBmb3IgKGNvbnN0IHBpcGVOYW1lIG9mIGJvdW5kLmdldFVzZWRQaXBlcygpKSB7XG4gICAgICAgIGlmICghcGlwZXMuaGFzKHBpcGVOYW1lKSkge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHBpcGUgPSBwaXBlcy5nZXQocGlwZU5hbWUpITtcbiAgICAgICAgdXNlZFBpcGVzLnB1c2goe1xuICAgICAgICAgIHBpcGVOYW1lLFxuICAgICAgICAgIGV4cHJlc3Npb246IHRoaXMucmVmRW1pdHRlci5lbWl0KHBpcGUsIGNvbnRleHQpLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgLy8gU2NhbiB0aHJvdWdoIHRoZSBkaXJlY3RpdmVzL3BpcGVzIGFjdHVhbGx5IHVzZWQgaW4gdGhlIHRlbXBsYXRlIGFuZCBjaGVjayB3aGV0aGVyIGFueVxuICAgICAgLy8gaW1wb3J0IHdoaWNoIG5lZWRzIHRvIGJlIGdlbmVyYXRlZCB3b3VsZCBjcmVhdGUgYSBjeWNsZS5cbiAgICAgIGNvbnN0IGN5Y2xlRGV0ZWN0ZWQgPVxuICAgICAgICAgIHVzZWREaXJlY3RpdmVzLnNvbWUoZGlyID0+IHRoaXMuX2lzQ3ljbGljSW1wb3J0KGRpci5leHByZXNzaW9uLCBjb250ZXh0KSkgfHxcbiAgICAgICAgICB1c2VkUGlwZXMuc29tZShwaXBlID0+IHRoaXMuX2lzQ3ljbGljSW1wb3J0KHBpcGUuZXhwcmVzc2lvbiwgY29udGV4dCkpO1xuXG4gICAgICBpZiAoIWN5Y2xlRGV0ZWN0ZWQpIHtcbiAgICAgICAgLy8gTm8gY3ljbGUgd2FzIGRldGVjdGVkLiBSZWNvcmQgdGhlIGltcG9ydHMgdGhhdCBuZWVkIHRvIGJlIGNyZWF0ZWQgaW4gdGhlIGN5Y2xlIGRldGVjdG9yXG4gICAgICAgIC8vIHNvIHRoYXQgZnV0dXJlIGN5Y2xpYyBpbXBvcnQgY2hlY2tzIGNvbnNpZGVyIHRoZWlyIHByb2R1Y3Rpb24uXG4gICAgICAgIGZvciAoY29uc3Qge2V4cHJlc3Npb259IG9mIHVzZWREaXJlY3RpdmVzKSB7XG4gICAgICAgICAgdGhpcy5fcmVjb3JkU3ludGhldGljSW1wb3J0KGV4cHJlc3Npb24sIGNvbnRleHQpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3Qge2V4cHJlc3Npb259IG9mIHVzZWRQaXBlcykge1xuICAgICAgICAgIHRoaXMuX3JlY29yZFN5bnRoZXRpY0ltcG9ydChleHByZXNzaW9uLCBjb250ZXh0KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIENoZWNrIHdoZXRoZXIgdGhlIGRpcmVjdGl2ZS9waXBlIGFycmF5cyBpbiDJtWNtcCBuZWVkIHRvIGJlIHdyYXBwZWQgaW4gY2xvc3VyZXMuXG4gICAgICAgIC8vIFRoaXMgaXMgcmVxdWlyZWQgaWYgYW55IGRpcmVjdGl2ZS9waXBlIHJlZmVyZW5jZSBpcyB0byBhIGRlY2xhcmF0aW9uIGluIHRoZSBzYW1lIGZpbGUgYnV0XG4gICAgICAgIC8vIGRlY2xhcmVkIGFmdGVyIHRoaXMgY29tcG9uZW50LlxuICAgICAgICBjb25zdCB3cmFwRGlyZWN0aXZlc0FuZFBpcGVzSW5DbG9zdXJlID1cbiAgICAgICAgICAgIHVzZWREaXJlY3RpdmVzLnNvbWUoXG4gICAgICAgICAgICAgICAgZGlyID0+IGlzRXhwcmVzc2lvbkZvcndhcmRSZWZlcmVuY2UoZGlyLmV4cHJlc3Npb24sIG5vZGUubmFtZSwgY29udGV4dCkpIHx8XG4gICAgICAgICAgICB1c2VkUGlwZXMuc29tZShcbiAgICAgICAgICAgICAgICBwaXBlID0+IGlzRXhwcmVzc2lvbkZvcndhcmRSZWZlcmVuY2UocGlwZS5leHByZXNzaW9uLCBub2RlLm5hbWUsIGNvbnRleHQpKTtcblxuICAgICAgICBkYXRhLmRpcmVjdGl2ZXMgPSB1c2VkRGlyZWN0aXZlcztcbiAgICAgICAgZGF0YS5waXBlcyA9IG5ldyBNYXAodXNlZFBpcGVzLm1hcChwaXBlID0+IFtwaXBlLnBpcGVOYW1lLCBwaXBlLmV4cHJlc3Npb25dKSk7XG4gICAgICAgIGRhdGEud3JhcERpcmVjdGl2ZXNBbmRQaXBlc0luQ2xvc3VyZSA9IHdyYXBEaXJlY3RpdmVzQW5kUGlwZXNJbkNsb3N1cmU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBEZWNsYXJpbmcgdGhlIGRpcmVjdGl2ZURlZnMvcGlwZURlZnMgYXJyYXlzIGRpcmVjdGx5IHdvdWxkIHJlcXVpcmUgaW1wb3J0cyB0aGF0IHdvdWxkXG4gICAgICAgIC8vIGNyZWF0ZSBhIGN5Y2xlLiBJbnN0ZWFkLCBtYXJrIHRoaXMgY29tcG9uZW50IGFzIHJlcXVpcmluZyByZW1vdGUgc2NvcGluZywgc28gdGhhdCB0aGVcbiAgICAgICAgLy8gTmdNb2R1bGUgZmlsZSB3aWxsIHRha2UgY2FyZSBvZiBzZXR0aW5nIHRoZSBkaXJlY3RpdmVzIGZvciB0aGUgY29tcG9uZW50LlxuICAgICAgICB0aGlzLnNjb3BlUmVnaXN0cnkuc2V0Q29tcG9uZW50QXNSZXF1aXJpbmdSZW1vdGVTY29waW5nKG5vZGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcblxuICAgIGlmIChhbmFseXNpcy5wcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5ICE9PSBudWxsICYmXG4gICAgICAgIGFuYWx5c2lzLm1ldGEucHJvdmlkZXJzIGluc3RhbmNlb2YgV3JhcHBlZE5vZGVFeHByKSB7XG4gICAgICBjb25zdCBwcm92aWRlckRpYWdub3N0aWNzID0gZ2V0UHJvdmlkZXJEaWFnbm9zdGljcyhcbiAgICAgICAgICBhbmFseXNpcy5wcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5LCBhbmFseXNpcy5tZXRhLnByb3ZpZGVycyEubm9kZSxcbiAgICAgICAgICB0aGlzLmluamVjdGFibGVSZWdpc3RyeSk7XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnByb3ZpZGVyRGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIGlmIChhbmFseXNpcy52aWV3UHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeSAhPT0gbnVsbCAmJlxuICAgICAgICBhbmFseXNpcy5tZXRhLnZpZXdQcm92aWRlcnMgaW5zdGFuY2VvZiBXcmFwcGVkTm9kZUV4cHIpIHtcbiAgICAgIGNvbnN0IHZpZXdQcm92aWRlckRpYWdub3N0aWNzID0gZ2V0UHJvdmlkZXJEaWFnbm9zdGljcyhcbiAgICAgICAgICBhbmFseXNpcy52aWV3UHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeSwgYW5hbHlzaXMubWV0YS52aWV3UHJvdmlkZXJzIS5ub2RlLFxuICAgICAgICAgIHRoaXMuaW5qZWN0YWJsZVJlZ2lzdHJ5KTtcbiAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4udmlld1Byb3ZpZGVyRGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIGNvbnN0IGRpcmVjdGl2ZURpYWdub3N0aWNzID0gZ2V0RGlyZWN0aXZlRGlhZ25vc3RpY3MoXG4gICAgICAgIG5vZGUsIHRoaXMubWV0YVJlYWRlciwgdGhpcy5ldmFsdWF0b3IsIHRoaXMucmVmbGVjdG9yLCB0aGlzLnNjb3BlUmVnaXN0cnksICdDb21wb25lbnQnKTtcbiAgICBpZiAoZGlyZWN0aXZlRGlhZ25vc3RpY3MgIT09IG51bGwpIHtcbiAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4uZGlyZWN0aXZlRGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIGlmIChkaWFnbm9zdGljcy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4ge2RpYWdub3N0aWNzfTtcbiAgICB9XG5cbiAgICByZXR1cm4ge2RhdGF9O1xuICB9XG5cbiAgY29tcGlsZShcbiAgICAgIG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGFuYWx5c2lzOiBSZWFkb25seTxDb21wb25lbnRBbmFseXNpc0RhdGE+LFxuICAgICAgcmVzb2x1dGlvbjogUmVhZG9ubHk8Q29tcG9uZW50UmVzb2x1dGlvbkRhdGE+LCBwb29sOiBDb25zdGFudFBvb2wpOiBDb21waWxlUmVzdWx0W10ge1xuICAgIGNvbnN0IG1ldGE6IFIzQ29tcG9uZW50TWV0YWRhdGEgPSB7Li4uYW5hbHlzaXMubWV0YSwgLi4ucmVzb2x1dGlvbn07XG4gICAgY29uc3QgcmVzID0gY29tcGlsZUNvbXBvbmVudEZyb21NZXRhZGF0YShtZXRhLCBwb29sLCBtYWtlQmluZGluZ1BhcnNlcigpKTtcbiAgICBjb25zdCBmYWN0b3J5UmVzID0gY29tcGlsZU5nRmFjdG9yeURlZkZpZWxkKFxuICAgICAgICB7Li4ubWV0YSwgaW5qZWN0Rm46IElkZW50aWZpZXJzLmRpcmVjdGl2ZUluamVjdCwgdGFyZ2V0OiBSM0ZhY3RvcnlUYXJnZXQuQ29tcG9uZW50fSk7XG4gICAgaWYgKGFuYWx5c2lzLm1ldGFkYXRhU3RtdCAhPT0gbnVsbCkge1xuICAgICAgZmFjdG9yeVJlcy5zdGF0ZW1lbnRzLnB1c2goYW5hbHlzaXMubWV0YWRhdGFTdG10KTtcbiAgICB9XG4gICAgcmV0dXJuIFtcbiAgICAgIGZhY3RvcnlSZXMsIHtcbiAgICAgICAgbmFtZTogJ8m1Y21wJyxcbiAgICAgICAgaW5pdGlhbGl6ZXI6IHJlcy5leHByZXNzaW9uLFxuICAgICAgICBzdGF0ZW1lbnRzOiBbXSxcbiAgICAgICAgdHlwZTogcmVzLnR5cGUsXG4gICAgICB9XG4gICAgXTtcbiAgfVxuXG4gIHByaXZhdGUgX3Jlc29sdmVMaXRlcmFsKGRlY29yYXRvcjogRGVjb3JhdG9yKTogdHMuT2JqZWN0TGl0ZXJhbEV4cHJlc3Npb24ge1xuICAgIGlmICh0aGlzLmxpdGVyYWxDYWNoZS5oYXMoZGVjb3JhdG9yKSkge1xuICAgICAgcmV0dXJuIHRoaXMubGl0ZXJhbENhY2hlLmdldChkZWNvcmF0b3IpITtcbiAgICB9XG4gICAgaWYgKGRlY29yYXRvci5hcmdzID09PSBudWxsIHx8IGRlY29yYXRvci5hcmdzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQVJJVFlfV1JPTkcsIERlY29yYXRvci5ub2RlRm9yRXJyb3IoZGVjb3JhdG9yKSxcbiAgICAgICAgICBgSW5jb3JyZWN0IG51bWJlciBvZiBhcmd1bWVudHMgdG8gQENvbXBvbmVudCBkZWNvcmF0b3JgKTtcbiAgICB9XG4gICAgY29uc3QgbWV0YSA9IHVud3JhcEV4cHJlc3Npb24oZGVjb3JhdG9yLmFyZ3NbMF0pO1xuXG4gICAgaWYgKCF0cy5pc09iamVjdExpdGVyYWxFeHByZXNzaW9uKG1ldGEpKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgRXJyb3JDb2RlLkRFQ09SQVRPUl9BUkdfTk9UX0xJVEVSQUwsIG1ldGEsIGBEZWNvcmF0b3IgYXJndW1lbnQgbXVzdCBiZSBsaXRlcmFsLmApO1xuICAgIH1cblxuICAgIHRoaXMubGl0ZXJhbENhY2hlLnNldChkZWNvcmF0b3IsIG1ldGEpO1xuICAgIHJldHVybiBtZXRhO1xuICB9XG5cbiAgcHJpdmF0ZSBfcmVzb2x2ZUVudW1WYWx1ZShcbiAgICAgIGNvbXBvbmVudDogTWFwPHN0cmluZywgdHMuRXhwcmVzc2lvbj4sIGZpZWxkOiBzdHJpbmcsIGVudW1TeW1ib2xOYW1lOiBzdHJpbmcpOiBudW1iZXJ8bnVsbCB7XG4gICAgbGV0IHJlc29sdmVkOiBudW1iZXJ8bnVsbCA9IG51bGw7XG4gICAgaWYgKGNvbXBvbmVudC5oYXMoZmllbGQpKSB7XG4gICAgICBjb25zdCBleHByID0gY29tcG9uZW50LmdldChmaWVsZCkhO1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLmV2YWx1YXRvci5ldmFsdWF0ZShleHByKSBhcyBhbnk7XG4gICAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBFbnVtVmFsdWUgJiYgaXNBbmd1bGFyQ29yZVJlZmVyZW5jZSh2YWx1ZS5lbnVtUmVmLCBlbnVtU3ltYm9sTmFtZSkpIHtcbiAgICAgICAgcmVzb2x2ZWQgPSB2YWx1ZS5yZXNvbHZlZCBhcyBudW1iZXI7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgZXhwciwgdmFsdWUsIGAke2ZpZWxkfSBtdXN0IGJlIGEgbWVtYmVyIG9mICR7ZW51bVN5bWJvbE5hbWV9IGVudW0gZnJvbSBAYW5ndWxhci9jb3JlYCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXNvbHZlZDtcbiAgfVxuXG4gIHByaXZhdGUgX2V4dHJhY3RTdHlsZVVybHMoY29tcG9uZW50OiBNYXA8c3RyaW5nLCB0cy5FeHByZXNzaW9uPiwgZXh0cmFVcmxzOiBzdHJpbmdbXSk6XG4gICAgICBzdHJpbmdbXXxudWxsIHtcbiAgICBpZiAoIWNvbXBvbmVudC5oYXMoJ3N0eWxlVXJscycpKSB7XG4gICAgICByZXR1cm4gZXh0cmFVcmxzLmxlbmd0aCA+IDAgPyBleHRyYVVybHMgOiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IHN0eWxlVXJsc0V4cHIgPSBjb21wb25lbnQuZ2V0KCdzdHlsZVVybHMnKSE7XG4gICAgY29uc3Qgc3R5bGVVcmxzID0gdGhpcy5ldmFsdWF0b3IuZXZhbHVhdGUoc3R5bGVVcmxzRXhwcik7XG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHN0eWxlVXJscykgfHwgIXN0eWxlVXJscy5ldmVyeSh1cmwgPT4gdHlwZW9mIHVybCA9PT0gJ3N0cmluZycpKSB7XG4gICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgIHN0eWxlVXJsc0V4cHIsIHN0eWxlVXJscywgJ3N0eWxlVXJscyBtdXN0IGJlIGFuIGFycmF5IG9mIHN0cmluZ3MnKTtcbiAgICB9XG4gICAgc3R5bGVVcmxzLnB1c2goLi4uZXh0cmFVcmxzKTtcbiAgICByZXR1cm4gc3R5bGVVcmxzIGFzIHN0cmluZ1tdO1xuICB9XG5cbiAgcHJpdmF0ZSBfcHJlbG9hZEFuZFBhcnNlVGVtcGxhdGUoXG4gICAgICBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBkZWNvcmF0b3I6IERlY29yYXRvciwgY29tcG9uZW50OiBNYXA8c3RyaW5nLCB0cy5FeHByZXNzaW9uPixcbiAgICAgIGNvbnRhaW5pbmdGaWxlOiBzdHJpbmcpOiBQcm9taXNlPFBhcnNlZFRlbXBsYXRlfG51bGw+IHtcbiAgICBpZiAoY29tcG9uZW50LmhhcygndGVtcGxhdGVVcmwnKSkge1xuICAgICAgLy8gRXh0cmFjdCB0aGUgdGVtcGxhdGVVcmwgYW5kIHByZWxvYWQgaXQuXG4gICAgICBjb25zdCB0ZW1wbGF0ZVVybEV4cHIgPSBjb21wb25lbnQuZ2V0KCd0ZW1wbGF0ZVVybCcpITtcbiAgICAgIGNvbnN0IHRlbXBsYXRlVXJsID0gdGhpcy5ldmFsdWF0b3IuZXZhbHVhdGUodGVtcGxhdGVVcmxFeHByKTtcbiAgICAgIGlmICh0eXBlb2YgdGVtcGxhdGVVcmwgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICB0ZW1wbGF0ZVVybEV4cHIsIHRlbXBsYXRlVXJsLCAndGVtcGxhdGVVcmwgbXVzdCBiZSBhIHN0cmluZycpO1xuICAgICAgfVxuICAgICAgY29uc3QgcmVzb3VyY2VVcmwgPSB0aGlzLnJlc291cmNlTG9hZGVyLnJlc29sdmUodGVtcGxhdGVVcmwsIGNvbnRhaW5pbmdGaWxlKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlUHJvbWlzZSA9IHRoaXMucmVzb3VyY2VMb2FkZXIucHJlbG9hZChyZXNvdXJjZVVybCk7XG5cbiAgICAgIC8vIElmIHRoZSBwcmVsb2FkIHdvcmtlZCwgdGhlbiBhY3R1YWxseSBsb2FkIGFuZCBwYXJzZSB0aGUgdGVtcGxhdGUsIGFuZCB3YWl0IGZvciBhbnkgc3R5bGVcbiAgICAgIC8vIFVSTHMgdG8gcmVzb2x2ZS5cbiAgICAgIGlmICh0ZW1wbGF0ZVByb21pc2UgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gdGVtcGxhdGVQcm9taXNlLnRoZW4oKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHRlbXBsYXRlID1cbiAgICAgICAgICAgICAgdGhpcy5fZXh0cmFjdEV4dGVybmFsVGVtcGxhdGUobm9kZSwgY29tcG9uZW50LCB0ZW1wbGF0ZVVybEV4cHIsIHJlc291cmNlVXJsKTtcbiAgICAgICAgICB0aGlzLnByZWFuYWx5emVUZW1wbGF0ZUNhY2hlLnNldChub2RlLCB0ZW1wbGF0ZSk7XG4gICAgICAgICAgcmV0dXJuIHRlbXBsYXRlO1xuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHRlbXBsYXRlID0gdGhpcy5fZXh0cmFjdElubGluZVRlbXBsYXRlKG5vZGUsIGRlY29yYXRvciwgY29tcG9uZW50LCBjb250YWluaW5nRmlsZSk7XG4gICAgICB0aGlzLnByZWFuYWx5emVUZW1wbGF0ZUNhY2hlLnNldChub2RlLCB0ZW1wbGF0ZSk7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRlbXBsYXRlKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIF9leHRyYWN0RXh0ZXJuYWxUZW1wbGF0ZShcbiAgICAgIG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGNvbXBvbmVudDogTWFwPHN0cmluZywgdHMuRXhwcmVzc2lvbj4sIHRlbXBsYXRlVXJsRXhwcjogdHMuRXhwcmVzc2lvbixcbiAgICAgIHJlc291cmNlVXJsOiBzdHJpbmcpOiBQYXJzZWRUZW1wbGF0ZVdpdGhTb3VyY2Uge1xuICAgIGNvbnN0IHRlbXBsYXRlU3RyID0gdGhpcy5yZXNvdXJjZUxvYWRlci5sb2FkKHJlc291cmNlVXJsKTtcbiAgICBpZiAodGhpcy5kZXBUcmFja2VyICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmRlcFRyYWNrZXIuYWRkUmVzb3VyY2VEZXBlbmRlbmN5KG5vZGUuZ2V0U291cmNlRmlsZSgpLCBhYnNvbHV0ZUZyb20ocmVzb3VyY2VVcmwpKTtcbiAgICB9XG5cbiAgICBjb25zdCB0ZW1wbGF0ZSA9IHRoaXMuX3BhcnNlVGVtcGxhdGUoXG4gICAgICAgIGNvbXBvbmVudCwgdGVtcGxhdGVTdHIsIHNvdXJjZU1hcFVybChyZXNvdXJjZVVybCksIC8qIHRlbXBsYXRlUmFuZ2UgKi8gdW5kZWZpbmVkLFxuICAgICAgICAvKiBlc2NhcGVkU3RyaW5nICovIGZhbHNlKTtcblxuICAgIHJldHVybiB7XG4gICAgICAuLi50ZW1wbGF0ZSxcbiAgICAgIHNvdXJjZU1hcHBpbmc6IHtcbiAgICAgICAgdHlwZTogJ2V4dGVybmFsJyxcbiAgICAgICAgY29tcG9uZW50Q2xhc3M6IG5vZGUsXG4gICAgICAgIG5vZGU6IHRlbXBsYXRlVXJsRXhwcixcbiAgICAgICAgdGVtcGxhdGU6IHRlbXBsYXRlU3RyLFxuICAgICAgICB0ZW1wbGF0ZVVybDogcmVzb3VyY2VVcmwsXG4gICAgICB9LFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9leHRyYWN0SW5saW5lVGVtcGxhdGUoXG4gICAgICBub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBkZWNvcmF0b3I6IERlY29yYXRvciwgY29tcG9uZW50OiBNYXA8c3RyaW5nLCB0cy5FeHByZXNzaW9uPixcbiAgICAgIGNvbnRhaW5pbmdGaWxlOiBzdHJpbmcpOiBQYXJzZWRUZW1wbGF0ZVdpdGhTb3VyY2Uge1xuICAgIGlmICghY29tcG9uZW50LmhhcygndGVtcGxhdGUnKSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5DT01QT05FTlRfTUlTU0lOR19URU1QTEFURSwgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWNvcmF0b3IpLFxuICAgICAgICAgICdjb21wb25lbnQgaXMgbWlzc2luZyBhIHRlbXBsYXRlJyk7XG4gICAgfVxuICAgIGNvbnN0IHRlbXBsYXRlRXhwciA9IGNvbXBvbmVudC5nZXQoJ3RlbXBsYXRlJykhO1xuXG4gICAgbGV0IHRlbXBsYXRlU3RyOiBzdHJpbmc7XG4gICAgbGV0IHRlbXBsYXRlVXJsOiBzdHJpbmcgPSAnJztcbiAgICBsZXQgdGVtcGxhdGVSYW5nZTogTGV4ZXJSYW5nZXx1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG4gICAgbGV0IHNvdXJjZU1hcHBpbmc6IFRlbXBsYXRlU291cmNlTWFwcGluZztcbiAgICBsZXQgZXNjYXBlZFN0cmluZyA9IGZhbHNlO1xuICAgIC8vIFdlIG9ubHkgc3VwcG9ydCBTb3VyY2VNYXBzIGZvciBpbmxpbmUgdGVtcGxhdGVzIHRoYXQgYXJlIHNpbXBsZSBzdHJpbmcgbGl0ZXJhbHMuXG4gICAgaWYgKHRzLmlzU3RyaW5nTGl0ZXJhbCh0ZW1wbGF0ZUV4cHIpIHx8IHRzLmlzTm9TdWJzdGl0dXRpb25UZW1wbGF0ZUxpdGVyYWwodGVtcGxhdGVFeHByKSkge1xuICAgICAgLy8gdGhlIHN0YXJ0IGFuZCBlbmQgb2YgdGhlIGB0ZW1wbGF0ZUV4cHJgIG5vZGUgaW5jbHVkZXMgdGhlIHF1b3RhdGlvbiBtYXJrcywgd2hpY2ggd2VcbiAgICAgIC8vIG11c3RcbiAgICAgIC8vIHN0cmlwXG4gICAgICB0ZW1wbGF0ZVJhbmdlID0gZ2V0VGVtcGxhdGVSYW5nZSh0ZW1wbGF0ZUV4cHIpO1xuICAgICAgdGVtcGxhdGVTdHIgPSB0ZW1wbGF0ZUV4cHIuZ2V0U291cmNlRmlsZSgpLnRleHQ7XG4gICAgICB0ZW1wbGF0ZVVybCA9IGNvbnRhaW5pbmdGaWxlO1xuICAgICAgZXNjYXBlZFN0cmluZyA9IHRydWU7XG4gICAgICBzb3VyY2VNYXBwaW5nID0ge1xuICAgICAgICB0eXBlOiAnZGlyZWN0JyxcbiAgICAgICAgbm9kZTogdGVtcGxhdGVFeHByIGFzICh0cy5TdHJpbmdMaXRlcmFsIHwgdHMuTm9TdWJzdGl0dXRpb25UZW1wbGF0ZUxpdGVyYWwpLFxuICAgICAgfTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgcmVzb2x2ZWRUZW1wbGF0ZSA9IHRoaXMuZXZhbHVhdG9yLmV2YWx1YXRlKHRlbXBsYXRlRXhwcik7XG4gICAgICBpZiAodHlwZW9mIHJlc29sdmVkVGVtcGxhdGUgIT09ICdzdHJpbmcnKSB7XG4gICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICB0ZW1wbGF0ZUV4cHIsIHJlc29sdmVkVGVtcGxhdGUsICd0ZW1wbGF0ZSBtdXN0IGJlIGEgc3RyaW5nJyk7XG4gICAgICB9XG4gICAgICB0ZW1wbGF0ZVN0ciA9IHJlc29sdmVkVGVtcGxhdGU7XG4gICAgICBzb3VyY2VNYXBwaW5nID0ge1xuICAgICAgICB0eXBlOiAnaW5kaXJlY3QnLFxuICAgICAgICBub2RlOiB0ZW1wbGF0ZUV4cHIsXG4gICAgICAgIGNvbXBvbmVudENsYXNzOiBub2RlLFxuICAgICAgICB0ZW1wbGF0ZTogdGVtcGxhdGVTdHIsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGNvbnN0IHRlbXBsYXRlID1cbiAgICAgICAgdGhpcy5fcGFyc2VUZW1wbGF0ZShjb21wb25lbnQsIHRlbXBsYXRlU3RyLCB0ZW1wbGF0ZVVybCwgdGVtcGxhdGVSYW5nZSwgZXNjYXBlZFN0cmluZyk7XG5cbiAgICByZXR1cm4gey4uLnRlbXBsYXRlLCBzb3VyY2VNYXBwaW5nfTtcbiAgfVxuXG4gIHByaXZhdGUgX3BhcnNlVGVtcGxhdGUoXG4gICAgICBjb21wb25lbnQ6IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+LCB0ZW1wbGF0ZVN0cjogc3RyaW5nLCB0ZW1wbGF0ZVVybDogc3RyaW5nLFxuICAgICAgdGVtcGxhdGVSYW5nZTogTGV4ZXJSYW5nZXx1bmRlZmluZWQsIGVzY2FwZWRTdHJpbmc6IGJvb2xlYW4pOiBQYXJzZWRUZW1wbGF0ZSB7XG4gICAgbGV0IHByZXNlcnZlV2hpdGVzcGFjZXM6IGJvb2xlYW4gPSB0aGlzLmRlZmF1bHRQcmVzZXJ2ZVdoaXRlc3BhY2VzO1xuICAgIGlmIChjb21wb25lbnQuaGFzKCdwcmVzZXJ2ZVdoaXRlc3BhY2VzJykpIHtcbiAgICAgIGNvbnN0IGV4cHIgPSBjb21wb25lbnQuZ2V0KCdwcmVzZXJ2ZVdoaXRlc3BhY2VzJykhO1xuICAgICAgY29uc3QgdmFsdWUgPSB0aGlzLmV2YWx1YXRvci5ldmFsdWF0ZShleHByKTtcbiAgICAgIGlmICh0eXBlb2YgdmFsdWUgIT09ICdib29sZWFuJykge1xuICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKGV4cHIsIHZhbHVlLCAncHJlc2VydmVXaGl0ZXNwYWNlcyBtdXN0IGJlIGEgYm9vbGVhbicpO1xuICAgICAgfVxuICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlcyA9IHZhbHVlO1xuICAgIH1cblxuICAgIGxldCBpbnRlcnBvbGF0aW9uOiBJbnRlcnBvbGF0aW9uQ29uZmlnID0gREVGQVVMVF9JTlRFUlBPTEFUSU9OX0NPTkZJRztcbiAgICBpZiAoY29tcG9uZW50LmhhcygnaW50ZXJwb2xhdGlvbicpKSB7XG4gICAgICBjb25zdCBleHByID0gY29tcG9uZW50LmdldCgnaW50ZXJwb2xhdGlvbicpITtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy5ldmFsdWF0b3IuZXZhbHVhdGUoZXhwcik7XG4gICAgICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpIHx8IHZhbHVlLmxlbmd0aCAhPT0gMiB8fFxuICAgICAgICAgICF2YWx1ZS5ldmVyeShlbGVtZW50ID0+IHR5cGVvZiBlbGVtZW50ID09PSAnc3RyaW5nJykpIHtcbiAgICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgICAgIGV4cHIsIHZhbHVlLCAnaW50ZXJwb2xhdGlvbiBtdXN0IGJlIGFuIGFycmF5IHdpdGggMiBlbGVtZW50cyBvZiBzdHJpbmcgdHlwZScpO1xuICAgICAgfVxuICAgICAgaW50ZXJwb2xhdGlvbiA9IEludGVycG9sYXRpb25Db25maWcuZnJvbUFycmF5KHZhbHVlIGFzIFtzdHJpbmcsIHN0cmluZ10pO1xuICAgIH1cblxuICAgIGNvbnN0IHtlcnJvcnMsIG5vZGVzOiBlbWl0Tm9kZXMsIHN0eWxlVXJscywgc3R5bGVzLCBuZ0NvbnRlbnRTZWxlY3RvcnN9ID1cbiAgICAgICAgcGFyc2VUZW1wbGF0ZSh0ZW1wbGF0ZVN0ciwgdGVtcGxhdGVVcmwsIHtcbiAgICAgICAgICBwcmVzZXJ2ZVdoaXRlc3BhY2VzLFxuICAgICAgICAgIGludGVycG9sYXRpb25Db25maWc6IGludGVycG9sYXRpb24sXG4gICAgICAgICAgcmFuZ2U6IHRlbXBsYXRlUmFuZ2UsXG4gICAgICAgICAgZXNjYXBlZFN0cmluZyxcbiAgICAgICAgICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0OiB0aGlzLmVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQsXG4gICAgICAgICAgaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzOiB0aGlzLmkxOG5Ob3JtYWxpemVMaW5lRW5kaW5nc0luSUNVcyxcbiAgICAgICAgfSk7XG5cbiAgICAvLyBVbmZvcnR1bmF0ZWx5LCB0aGUgcHJpbWFyeSBwYXJzZSBvZiB0aGUgdGVtcGxhdGUgYWJvdmUgbWF5IG5vdCBjb250YWluIGFjY3VyYXRlIHNvdXJjZSBtYXBcbiAgICAvLyBpbmZvcm1hdGlvbi4gSWYgdXNlZCBkaXJlY3RseSwgaXQgd291bGQgcmVzdWx0IGluIGluY29ycmVjdCBjb2RlIGxvY2F0aW9ucyBpbiB0ZW1wbGF0ZVxuICAgIC8vIGVycm9ycywgZXRjLiBUaGVyZSBhcmUgdHdvIG1haW4gcHJvYmxlbXM6XG4gICAgLy9cbiAgICAvLyAxLiBgcHJlc2VydmVXaGl0ZXNwYWNlczogZmFsc2VgIGFubmloaWxhdGVzIHRoZSBjb3JyZWN0bmVzcyBvZiB0ZW1wbGF0ZSBzb3VyY2UgbWFwcGluZywgYXNcbiAgICAvLyAgICB0aGUgd2hpdGVzcGFjZSB0cmFuc2Zvcm1hdGlvbiBjaGFuZ2VzIHRoZSBjb250ZW50cyBvZiBIVE1MIHRleHQgbm9kZXMgYmVmb3JlIHRoZXkncmVcbiAgICAvLyAgICBwYXJzZWQgaW50byBBbmd1bGFyIGV4cHJlc3Npb25zLlxuICAgIC8vIDIuIEJ5IGRlZmF1bHQsIHRoZSB0ZW1wbGF0ZSBwYXJzZXIgc3RyaXBzIGxlYWRpbmcgdHJpdmlhIGNoYXJhY3RlcnMgKGxpa2Ugc3BhY2VzLCB0YWJzLCBhbmRcbiAgICAvLyAgICBuZXdsaW5lcykuIFRoaXMgYWxzbyBkZXN0cm95cyBzb3VyY2UgbWFwcGluZyBpbmZvcm1hdGlvbi5cbiAgICAvL1xuICAgIC8vIEluIG9yZGVyIHRvIGd1YXJhbnRlZSB0aGUgY29ycmVjdG5lc3Mgb2YgZGlhZ25vc3RpY3MsIHRlbXBsYXRlcyBhcmUgcGFyc2VkIGEgc2Vjb25kIHRpbWUgd2l0aFxuICAgIC8vIHRoZSBhYm92ZSBvcHRpb25zIHNldCB0byBwcmVzZXJ2ZSBzb3VyY2UgbWFwcGluZ3MuXG5cbiAgICBjb25zdCB7bm9kZXM6IGRpYWdOb2Rlc30gPSBwYXJzZVRlbXBsYXRlKHRlbXBsYXRlU3RyLCB0ZW1wbGF0ZVVybCwge1xuICAgICAgcHJlc2VydmVXaGl0ZXNwYWNlczogdHJ1ZSxcbiAgICAgIGludGVycG9sYXRpb25Db25maWc6IGludGVycG9sYXRpb24sXG4gICAgICByYW5nZTogdGVtcGxhdGVSYW5nZSxcbiAgICAgIGVzY2FwZWRTdHJpbmcsXG4gICAgICBlbmFibGVJMThuTGVnYWN5TWVzc2FnZUlkRm9ybWF0OiB0aGlzLmVuYWJsZUkxOG5MZWdhY3lNZXNzYWdlSWRGb3JtYXQsXG4gICAgICBpMThuTm9ybWFsaXplTGluZUVuZGluZ3NJbklDVXM6IHRoaXMuaTE4bk5vcm1hbGl6ZUxpbmVFbmRpbmdzSW5JQ1VzLFxuICAgICAgbGVhZGluZ1RyaXZpYUNoYXJzOiBbXSxcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBpbnRlcnBvbGF0aW9uLFxuICAgICAgZW1pdE5vZGVzLFxuICAgICAgZGlhZ05vZGVzLFxuICAgICAgc3R5bGVVcmxzLFxuICAgICAgc3R5bGVzLFxuICAgICAgbmdDb250ZW50U2VsZWN0b3JzLFxuICAgICAgZXJyb3JzLFxuICAgICAgdGVtcGxhdGU6IHRlbXBsYXRlU3RyLFxuICAgICAgdGVtcGxhdGVVcmwsXG4gICAgICBpc0lubGluZTogY29tcG9uZW50LmhhcygndGVtcGxhdGUnKSxcbiAgICAgIGZpbGU6IG5ldyBQYXJzZVNvdXJjZUZpbGUodGVtcGxhdGVTdHIsIHRlbXBsYXRlVXJsKSxcbiAgICB9O1xuICB9XG5cbiAgcHJpdmF0ZSBfZXhwcmVzc2lvblRvSW1wb3J0ZWRGaWxlKGV4cHI6IEV4cHJlc3Npb24sIG9yaWdpbjogdHMuU291cmNlRmlsZSk6IHRzLlNvdXJjZUZpbGV8bnVsbCB7XG4gICAgaWYgKCEoZXhwciBpbnN0YW5jZW9mIEV4dGVybmFsRXhwcikpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIEZpZ3VyZSBvdXQgd2hhdCBmaWxlIGlzIGJlaW5nIGltcG9ydGVkLlxuICAgIHJldHVybiB0aGlzLm1vZHVsZVJlc29sdmVyLnJlc29sdmVNb2R1bGUoZXhwci52YWx1ZS5tb2R1bGVOYW1lISwgb3JpZ2luLmZpbGVOYW1lKTtcbiAgfVxuXG4gIHByaXZhdGUgX2lzQ3ljbGljSW1wb3J0KGV4cHI6IEV4cHJlc3Npb24sIG9yaWdpbjogdHMuU291cmNlRmlsZSk6IGJvb2xlYW4ge1xuICAgIGNvbnN0IGltcG9ydGVkID0gdGhpcy5fZXhwcmVzc2lvblRvSW1wb3J0ZWRGaWxlKGV4cHIsIG9yaWdpbik7XG4gICAgaWYgKGltcG9ydGVkID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgd2hldGhlciB0aGUgaW1wb3J0IGlzIGxlZ2FsLlxuICAgIHJldHVybiB0aGlzLmN5Y2xlQW5hbHl6ZXIud291bGRDcmVhdGVDeWNsZShvcmlnaW4sIGltcG9ydGVkKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JlY29yZFN5bnRoZXRpY0ltcG9ydChleHByOiBFeHByZXNzaW9uLCBvcmlnaW46IHRzLlNvdXJjZUZpbGUpOiB2b2lkIHtcbiAgICBjb25zdCBpbXBvcnRlZCA9IHRoaXMuX2V4cHJlc3Npb25Ub0ltcG9ydGVkRmlsZShleHByLCBvcmlnaW4pO1xuICAgIGlmIChpbXBvcnRlZCA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHRoaXMuY3ljbGVBbmFseXplci5yZWNvcmRTeW50aGV0aWNJbXBvcnQob3JpZ2luLCBpbXBvcnRlZCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VGVtcGxhdGVSYW5nZSh0ZW1wbGF0ZUV4cHI6IHRzLkV4cHJlc3Npb24pIHtcbiAgY29uc3Qgc3RhcnRQb3MgPSB0ZW1wbGF0ZUV4cHIuZ2V0U3RhcnQoKSArIDE7XG4gIGNvbnN0IHtsaW5lLCBjaGFyYWN0ZXJ9ID1cbiAgICAgIHRzLmdldExpbmVBbmRDaGFyYWN0ZXJPZlBvc2l0aW9uKHRlbXBsYXRlRXhwci5nZXRTb3VyY2VGaWxlKCksIHN0YXJ0UG9zKTtcbiAgcmV0dXJuIHtcbiAgICBzdGFydFBvcyxcbiAgICBzdGFydExpbmU6IGxpbmUsXG4gICAgc3RhcnRDb2w6IGNoYXJhY3RlcixcbiAgICBlbmRQb3M6IHRlbXBsYXRlRXhwci5nZXRFbmQoKSAtIDEsXG4gIH07XG59XG5cbmZ1bmN0aW9uIHNvdXJjZU1hcFVybChyZXNvdXJjZVVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCF0c1NvdXJjZU1hcEJ1ZzI5MzAwRml4ZWQoKSkge1xuICAgIC8vIEJ5IHJlbW92aW5nIHRoZSB0ZW1wbGF0ZSBVUkwgd2UgYXJlIHRlbGxpbmcgdGhlIHRyYW5zbGF0b3Igbm90IHRvIHRyeSB0b1xuICAgIC8vIG1hcCB0aGUgZXh0ZXJuYWwgc291cmNlIGZpbGUgdG8gdGhlIGdlbmVyYXRlZCBjb2RlLCBzaW5jZSB0aGUgdmVyc2lvblxuICAgIC8vIG9mIFRTIHRoYXQgaXMgcnVubmluZyBkb2VzIG5vdCBzdXBwb3J0IGl0LlxuICAgIHJldHVybiAnJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gcmVzb3VyY2VVcmw7XG4gIH1cbn1cblxuXG4vKipcbiAqIEluZm9ybWF0aW9uIGFib3V0IHRoZSB0ZW1wbGF0ZSB3aGljaCB3YXMgZXh0cmFjdGVkIGR1cmluZyBwYXJzaW5nLlxuICpcbiAqIFRoaXMgY29udGFpbnMgdGhlIGFjdHVhbCBwYXJzZWQgdGVtcGxhdGUgYXMgd2VsbCBhcyBhbnkgbWV0YWRhdGEgY29sbGVjdGVkIGR1cmluZyBpdHMgcGFyc2luZyxcbiAqIHNvbWUgb2Ygd2hpY2ggbWlnaHQgYmUgdXNlZnVsIGZvciByZS1wYXJzaW5nIHRoZSB0ZW1wbGF0ZSB3aXRoIGRpZmZlcmVudCBvcHRpb25zLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFBhcnNlZFRlbXBsYXRlIHtcbiAgLyoqXG4gICAqIFRoZSBgSW50ZXJwb2xhdGlvbkNvbmZpZ2Agc3BlY2lmaWVkIGJ5IHRoZSB1c2VyLlxuICAgKi9cbiAgaW50ZXJwb2xhdGlvbjogSW50ZXJwb2xhdGlvbkNvbmZpZztcblxuICAvKipcbiAgICogQSBmdWxsIHBhdGggdG8gdGhlIGZpbGUgd2hpY2ggY29udGFpbnMgdGhlIHRlbXBsYXRlLlxuICAgKlxuICAgKiBUaGlzIGNhbiBiZSBlaXRoZXIgdGhlIG9yaWdpbmFsIC50cyBmaWxlIGlmIHRoZSB0ZW1wbGF0ZSBpcyBpbmxpbmUsIG9yIHRoZSAuaHRtbCBmaWxlIGlmIGFuXG4gICAqIGV4dGVybmFsIGZpbGUgd2FzIHVzZWQuXG4gICAqL1xuICB0ZW1wbGF0ZVVybDogc3RyaW5nO1xuXG4gIC8qKlxuICAgKiBUaGUgc3RyaW5nIGNvbnRlbnRzIG9mIHRoZSB0ZW1wbGF0ZS5cbiAgICpcbiAgICogVGhpcyBpcyB0aGUgXCJsb2dpY2FsXCIgdGVtcGxhdGUgc3RyaW5nLCBhZnRlciBleHBhbnNpb24gb2YgYW55IGVzY2FwZWQgY2hhcmFjdGVycyAoZm9yIGlubGluZVxuICAgKiB0ZW1wbGF0ZXMpLiBUaGlzIG1heSBkaWZmZXIgZnJvbSB0aGUgYWN0dWFsIHRlbXBsYXRlIGJ5dGVzIGFzIHRoZXkgYXBwZWFyIGluIHRoZSAudHMgZmlsZS5cbiAgICovXG4gIHRlbXBsYXRlOiBzdHJpbmc7XG5cbiAgLyoqXG4gICAqIEFueSBlcnJvcnMgZnJvbSBwYXJzaW5nIHRoZSB0ZW1wbGF0ZSB0aGUgZmlyc3QgdGltZS5cbiAgICovXG4gIGVycm9ycz86IFBhcnNlRXJyb3JbXXx1bmRlZmluZWQ7XG5cbiAgLyoqXG4gICAqIFRoZSB0ZW1wbGF0ZSBBU1QsIHBhcnNlZCBhY2NvcmRpbmcgdG8gdGhlIHVzZXIncyBzcGVjaWZpY2F0aW9ucy5cbiAgICovXG4gIGVtaXROb2RlczogVG1wbEFzdE5vZGVbXTtcblxuICAvKipcbiAgICogVGhlIHRlbXBsYXRlIEFTVCwgcGFyc2VkIGluIGEgbWFubmVyIHdoaWNoIHByZXNlcnZlcyBzb3VyY2UgbWFwIGluZm9ybWF0aW9uIGZvciBkaWFnbm9zdGljcy5cbiAgICpcbiAgICogTm90IHVzZWZ1bCBmb3IgZW1pdC5cbiAgICovXG4gIGRpYWdOb2RlczogVG1wbEFzdE5vZGVbXTtcblxuICAvKipcbiAgICpcbiAgICovXG5cbiAgLyoqXG4gICAqIEFueSBzdHlsZVVybHMgZXh0cmFjdGVkIGZyb20gdGhlIG1ldGFkYXRhLlxuICAgKi9cbiAgc3R5bGVVcmxzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW55IGlubGluZSBzdHlsZXMgZXh0cmFjdGVkIGZyb20gdGhlIG1ldGFkYXRhLlxuICAgKi9cbiAgc3R5bGVzOiBzdHJpbmdbXTtcblxuICAvKipcbiAgICogQW55IG5nLWNvbnRlbnQgc2VsZWN0b3JzIGV4dHJhY3RlZCBmcm9tIHRoZSB0ZW1wbGF0ZS5cbiAgICovXG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG5cbiAgLyoqXG4gICAqIFdoZXRoZXIgdGhlIHRlbXBsYXRlIHdhcyBpbmxpbmUuXG4gICAqL1xuICBpc0lubGluZTogYm9vbGVhbjtcblxuICAvKipcbiAgICogVGhlIGBQYXJzZVNvdXJjZUZpbGVgIGZvciB0aGUgdGVtcGxhdGUuXG4gICAqL1xuICBmaWxlOiBQYXJzZVNvdXJjZUZpbGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyc2VkVGVtcGxhdGVXaXRoU291cmNlIGV4dGVuZHMgUGFyc2VkVGVtcGxhdGUge1xuICBzb3VyY2VNYXBwaW5nOiBUZW1wbGF0ZVNvdXJjZU1hcHBpbmc7XG59XG4iXX0=