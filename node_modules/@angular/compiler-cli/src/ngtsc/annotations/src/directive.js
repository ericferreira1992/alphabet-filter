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
        define("@angular/compiler-cli/src/ngtsc/annotations/src/directive", ["require", "exports", "tslib", "@angular/compiler", "typescript", "@angular/compiler-cli/src/ngtsc/diagnostics", "@angular/compiler-cli/src/ngtsc/imports", "@angular/compiler-cli/src/ngtsc/metadata", "@angular/compiler-cli/src/ngtsc/metadata/src/util", "@angular/compiler-cli/src/ngtsc/partial_evaluator", "@angular/compiler-cli/src/ngtsc/reflection", "@angular/compiler-cli/src/ngtsc/transform", "@angular/compiler-cli/src/ngtsc/annotations/src/diagnostics", "@angular/compiler-cli/src/ngtsc/annotations/src/factory", "@angular/compiler-cli/src/ngtsc/annotations/src/metadata", "@angular/compiler-cli/src/ngtsc/annotations/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extractHostBindings = exports.queriesFromFields = exports.parseFieldArrayValue = exports.extractQueriesFromDecorator = exports.extractQueryMetadata = exports.extractDirectiveMetadata = exports.DirectiveDecoratorHandler = void 0;
    var tslib_1 = require("tslib");
    var compiler_1 = require("@angular/compiler");
    var ts = require("typescript");
    var diagnostics_1 = require("@angular/compiler-cli/src/ngtsc/diagnostics");
    var imports_1 = require("@angular/compiler-cli/src/ngtsc/imports");
    var metadata_1 = require("@angular/compiler-cli/src/ngtsc/metadata");
    var util_1 = require("@angular/compiler-cli/src/ngtsc/metadata/src/util");
    var partial_evaluator_1 = require("@angular/compiler-cli/src/ngtsc/partial_evaluator");
    var reflection_1 = require("@angular/compiler-cli/src/ngtsc/reflection");
    var transform_1 = require("@angular/compiler-cli/src/ngtsc/transform");
    var diagnostics_2 = require("@angular/compiler-cli/src/ngtsc/annotations/src/diagnostics");
    var factory_1 = require("@angular/compiler-cli/src/ngtsc/annotations/src/factory");
    var metadata_2 = require("@angular/compiler-cli/src/ngtsc/annotations/src/metadata");
    var util_2 = require("@angular/compiler-cli/src/ngtsc/annotations/src/util");
    var EMPTY_OBJECT = {};
    var FIELD_DECORATORS = [
        'Input', 'Output', 'ViewChild', 'ViewChildren', 'ContentChild', 'ContentChildren', 'HostBinding',
        'HostListener'
    ];
    var LIFECYCLE_HOOKS = new Set([
        'ngOnChanges', 'ngOnInit', 'ngOnDestroy', 'ngDoCheck', 'ngAfterViewInit', 'ngAfterViewChecked',
        'ngAfterContentInit', 'ngAfterContentChecked'
    ]);
    var DirectiveDecoratorHandler = /** @class */ (function () {
        function DirectiveDecoratorHandler(reflector, evaluator, metaRegistry, scopeRegistry, metaReader, defaultImportRecorder, injectableRegistry, isCore, annotateForClosureCompiler, compileUndecoratedClassesWithAngularFeatures) {
            this.reflector = reflector;
            this.evaluator = evaluator;
            this.metaRegistry = metaRegistry;
            this.scopeRegistry = scopeRegistry;
            this.metaReader = metaReader;
            this.defaultImportRecorder = defaultImportRecorder;
            this.injectableRegistry = injectableRegistry;
            this.isCore = isCore;
            this.annotateForClosureCompiler = annotateForClosureCompiler;
            this.compileUndecoratedClassesWithAngularFeatures = compileUndecoratedClassesWithAngularFeatures;
            this.precedence = transform_1.HandlerPrecedence.PRIMARY;
            this.name = DirectiveDecoratorHandler.name;
        }
        DirectiveDecoratorHandler.prototype.detect = function (node, decorators) {
            // If a class is undecorated but uses Angular features, we detect it as an
            // abstract directive. This is an unsupported pattern as of v10, but we want
            // to still detect these patterns so that we can report diagnostics, or compile
            // them for backwards compatibility in ngcc.
            if (!decorators) {
                var angularField = this.findClassFieldWithAngularFeatures(node);
                return angularField ? { trigger: angularField.node, decorator: null, metadata: null } :
                    undefined;
            }
            else {
                var decorator = util_2.findAngularDecorator(decorators, 'Directive', this.isCore);
                return decorator ? { trigger: decorator.node, decorator: decorator, metadata: decorator } : undefined;
            }
        };
        DirectiveDecoratorHandler.prototype.analyze = function (node, decorator, flags) {
            if (flags === void 0) { flags = transform_1.HandlerFlags.NONE; }
            // Skip processing of the class declaration if compilation of undecorated classes
            // with Angular features is disabled. Previously in ngtsc, such classes have always
            // been processed, but we want to enforce a consistent decorator mental model.
            // See: https://v9.angular.io/guide/migration-undecorated-classes.
            if (this.compileUndecoratedClassesWithAngularFeatures === false && decorator === null) {
                return { diagnostics: [diagnostics_2.getUndecoratedClassWithAngularFeaturesDiagnostic(node)] };
            }
            var directiveResult = extractDirectiveMetadata(node, decorator, this.reflector, this.evaluator, this.defaultImportRecorder, this.isCore, flags, this.annotateForClosureCompiler);
            if (directiveResult === undefined) {
                return {};
            }
            var analysis = directiveResult.metadata;
            var providersRequiringFactory = null;
            if (directiveResult !== undefined && directiveResult.decorator.has('providers')) {
                providersRequiringFactory = util_2.resolveProvidersRequiringFactory(directiveResult.decorator.get('providers'), this.reflector, this.evaluator);
            }
            return {
                analysis: {
                    inputs: directiveResult.inputs,
                    outputs: directiveResult.outputs,
                    meta: analysis,
                    metadataStmt: metadata_2.generateSetClassMetadataCall(node, this.reflector, this.defaultImportRecorder, this.isCore, this.annotateForClosureCompiler),
                    baseClass: util_2.readBaseClass(node, this.reflector, this.evaluator),
                    typeCheckMeta: util_1.extractDirectiveTypeCheckMeta(node, directiveResult.inputs, this.reflector),
                    providersRequiringFactory: providersRequiringFactory
                }
            };
        };
        DirectiveDecoratorHandler.prototype.register = function (node, analysis) {
            // Register this directive's information with the `MetadataRegistry`. This ensures that
            // the information about the directive is available during the compile() phase.
            var ref = new imports_1.Reference(node);
            this.metaRegistry.registerDirectiveMetadata(tslib_1.__assign({ ref: ref, name: node.name.text, selector: analysis.meta.selector, exportAs: analysis.meta.exportAs, inputs: analysis.inputs, outputs: analysis.outputs, queries: analysis.meta.queries.map(function (query) { return query.propertyName; }), isComponent: false, baseClass: analysis.baseClass }, analysis.typeCheckMeta));
            this.injectableRegistry.registerInjectable(node);
        };
        DirectiveDecoratorHandler.prototype.resolve = function (node, analysis) {
            var diagnostics = [];
            if (analysis.providersRequiringFactory !== null &&
                analysis.meta.providers instanceof compiler_1.WrappedNodeExpr) {
                var providerDiagnostics = diagnostics_2.getProviderDiagnostics(analysis.providersRequiringFactory, analysis.meta.providers.node, this.injectableRegistry);
                diagnostics.push.apply(diagnostics, tslib_1.__spread(providerDiagnostics));
            }
            var directiveDiagnostics = diagnostics_2.getDirectiveDiagnostics(node, this.metaReader, this.evaluator, this.reflector, this.scopeRegistry, 'Directive');
            if (directiveDiagnostics !== null) {
                diagnostics.push.apply(diagnostics, tslib_1.__spread(directiveDiagnostics));
            }
            return { diagnostics: diagnostics.length > 0 ? diagnostics : undefined };
        };
        DirectiveDecoratorHandler.prototype.compile = function (node, analysis, resolution, pool) {
            var meta = analysis.meta;
            var res = compiler_1.compileDirectiveFromMetadata(meta, pool, compiler_1.makeBindingParser());
            var factoryRes = factory_1.compileNgFactoryDefField(tslib_1.__assign(tslib_1.__assign({}, meta), { injectFn: compiler_1.Identifiers.directiveInject, target: compiler_1.R3FactoryTarget.Directive }));
            if (analysis.metadataStmt !== null) {
                factoryRes.statements.push(analysis.metadataStmt);
            }
            return [
                factoryRes, {
                    name: 'ɵdir',
                    initializer: res.expression,
                    statements: [],
                    type: res.type,
                }
            ];
        };
        /**
         * Checks if a given class uses Angular features and returns the TypeScript node
         * that indicated the usage. Classes are considered using Angular features if they
         * contain class members that are either decorated with a known Angular decorator,
         * or if they correspond to a known Angular lifecycle hook.
         */
        DirectiveDecoratorHandler.prototype.findClassFieldWithAngularFeatures = function (node) {
            var _this = this;
            return this.reflector.getMembersOfClass(node).find(function (member) {
                if (!member.isStatic && member.kind === reflection_1.ClassMemberKind.Method &&
                    LIFECYCLE_HOOKS.has(member.name)) {
                    return true;
                }
                if (member.decorators) {
                    return member.decorators.some(function (decorator) { return FIELD_DECORATORS.some(function (decoratorName) { return util_2.isAngularDecorator(decorator, decoratorName, _this.isCore); }); });
                }
                return false;
            });
        };
        return DirectiveDecoratorHandler;
    }());
    exports.DirectiveDecoratorHandler = DirectiveDecoratorHandler;
    /**
     * Helper function to extract metadata from a `Directive` or `Component`. `Directive`s without a
     * selector are allowed to be used for abstract base classes. These abstract directives should not
     * appear in the declarations of an `NgModule` and additional verification is done when processing
     * the module.
     */
    function extractDirectiveMetadata(clazz, decorator, reflector, evaluator, defaultImportRecorder, isCore, flags, annotateForClosureCompiler, defaultSelector) {
        if (defaultSelector === void 0) { defaultSelector = null; }
        var directive;
        if (decorator === null || decorator.args === null || decorator.args.length === 0) {
            directive = new Map();
        }
        else if (decorator.args.length !== 1) {
            throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARITY_WRONG, reflection_1.Decorator.nodeForError(decorator), "Incorrect number of arguments to @" + decorator.name + " decorator");
        }
        else {
            var meta = util_2.unwrapExpression(decorator.args[0]);
            if (!ts.isObjectLiteralExpression(meta)) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARG_NOT_LITERAL, meta, "@" + decorator.name + " argument must be an object literal");
            }
            directive = reflection_1.reflectObjectLiteral(meta);
        }
        if (directive.has('jit')) {
            // The only allowed value is true, so there's no need to expand further.
            return undefined;
        }
        var members = reflector.getMembersOfClass(clazz);
        // Precompute a list of ts.ClassElements that have decorators. This includes things like @Input,
        // @Output, @HostBinding, etc.
        var decoratedElements = members.filter(function (member) { return !member.isStatic && member.decorators !== null; });
        var coreModule = isCore ? undefined : '@angular/core';
        // Construct the map of inputs both from the @Directive/@Component
        // decorator, and the decorated
        // fields.
        var inputsFromMeta = parseFieldToPropertyMapping(directive, 'inputs', evaluator);
        var inputsFromFields = parseDecoratedFields(reflection_1.filterToMembersWithDecorator(decoratedElements, 'Input', coreModule), evaluator, resolveInput);
        // And outputs.
        var outputsFromMeta = parseFieldToPropertyMapping(directive, 'outputs', evaluator);
        var outputsFromFields = parseDecoratedFields(reflection_1.filterToMembersWithDecorator(decoratedElements, 'Output', coreModule), evaluator, resolveOutput);
        // Construct the list of queries.
        var contentChildFromFields = queriesFromFields(reflection_1.filterToMembersWithDecorator(decoratedElements, 'ContentChild', coreModule), reflector, evaluator);
        var contentChildrenFromFields = queriesFromFields(reflection_1.filterToMembersWithDecorator(decoratedElements, 'ContentChildren', coreModule), reflector, evaluator);
        var queries = tslib_1.__spread(contentChildFromFields, contentChildrenFromFields);
        // Construct the list of view queries.
        var viewChildFromFields = queriesFromFields(reflection_1.filterToMembersWithDecorator(decoratedElements, 'ViewChild', coreModule), reflector, evaluator);
        var viewChildrenFromFields = queriesFromFields(reflection_1.filterToMembersWithDecorator(decoratedElements, 'ViewChildren', coreModule), reflector, evaluator);
        var viewQueries = tslib_1.__spread(viewChildFromFields, viewChildrenFromFields);
        if (directive.has('queries')) {
            var queriesFromDecorator = extractQueriesFromDecorator(directive.get('queries'), reflector, evaluator, isCore);
            queries.push.apply(queries, tslib_1.__spread(queriesFromDecorator.content));
            viewQueries.push.apply(viewQueries, tslib_1.__spread(queriesFromDecorator.view));
        }
        // Parse the selector.
        var selector = defaultSelector;
        if (directive.has('selector')) {
            var expr = directive.get('selector');
            var resolved = evaluator.evaluate(expr);
            if (typeof resolved !== 'string') {
                throw diagnostics_2.createValueHasWrongTypeError(expr, resolved, "selector must be a string");
            }
            // use default selector in case selector is an empty string
            selector = resolved === '' ? defaultSelector : resolved;
            if (!selector) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DIRECTIVE_MISSING_SELECTOR, expr, "Directive " + clazz.name.text + " has no selector, please add it!");
            }
        }
        var host = extractHostBindings(decoratedElements, evaluator, coreModule, directive);
        var providers = directive.has('providers') ?
            new compiler_1.WrappedNodeExpr(annotateForClosureCompiler ?
                util_2.wrapFunctionExpressionsInParens(directive.get('providers')) :
                directive.get('providers')) :
            null;
        // Determine if `ngOnChanges` is a lifecycle hook defined on the component.
        var usesOnChanges = members.some(function (member) { return !member.isStatic && member.kind === reflection_1.ClassMemberKind.Method &&
            member.name === 'ngOnChanges'; });
        // Parse exportAs.
        var exportAs = null;
        if (directive.has('exportAs')) {
            var expr = directive.get('exportAs');
            var resolved = evaluator.evaluate(expr);
            if (typeof resolved !== 'string') {
                throw diagnostics_2.createValueHasWrongTypeError(expr, resolved, "exportAs must be a string");
            }
            exportAs = resolved.split(',').map(function (part) { return part.trim(); });
        }
        var rawCtorDeps = util_2.getConstructorDependencies(clazz, reflector, defaultImportRecorder, isCore);
        var ctorDeps;
        // Non-abstract directives (those with a selector) require valid constructor dependencies, whereas
        // abstract directives are allowed to have invalid dependencies, given that a subclass may call
        // the constructor explicitly.
        if (selector !== null) {
            ctorDeps = util_2.validateConstructorDependencies(clazz, rawCtorDeps);
        }
        else {
            ctorDeps = util_2.unwrapConstructorDependencies(rawCtorDeps);
        }
        // Detect if the component inherits from another class
        var usesInheritance = reflector.hasBaseClass(clazz);
        var type = util_2.wrapTypeReference(reflector, clazz);
        var internalType = new compiler_1.WrappedNodeExpr(reflector.getInternalNameOfClass(clazz));
        var inputs = metadata_1.ClassPropertyMapping.fromMappedObject(tslib_1.__assign(tslib_1.__assign({}, inputsFromMeta), inputsFromFields));
        var outputs = metadata_1.ClassPropertyMapping.fromMappedObject(tslib_1.__assign(tslib_1.__assign({}, outputsFromMeta), outputsFromFields));
        var metadata = {
            name: clazz.name.text,
            deps: ctorDeps,
            host: host,
            lifecycle: {
                usesOnChanges: usesOnChanges,
            },
            inputs: inputs.toJointMappedObject(),
            outputs: outputs.toDirectMappedObject(),
            queries: queries,
            viewQueries: viewQueries,
            selector: selector,
            fullInheritance: !!(flags & transform_1.HandlerFlags.FULL_INHERITANCE),
            type: type,
            internalType: internalType,
            typeArgumentCount: reflector.getGenericArityOfClass(clazz) || 0,
            typeSourceSpan: util_2.createSourceSpan(clazz.name),
            usesInheritance: usesInheritance,
            exportAs: exportAs,
            providers: providers
        };
        return {
            decorator: directive,
            metadata: metadata,
            inputs: inputs,
            outputs: outputs,
        };
    }
    exports.extractDirectiveMetadata = extractDirectiveMetadata;
    function extractQueryMetadata(exprNode, name, args, propertyName, reflector, evaluator) {
        if (args.length === 0) {
            throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARITY_WRONG, exprNode, "@" + name + " must have arguments");
        }
        var first = name === 'ViewChild' || name === 'ContentChild';
        var node = util_2.unwrapForwardRef(args[0], reflector);
        var arg = evaluator.evaluate(node);
        /** Whether or not this query should collect only static results (see view/api.ts)  */
        var isStatic = false;
        // Extract the predicate
        var predicate = null;
        if (arg instanceof imports_1.Reference || arg instanceof partial_evaluator_1.DynamicValue) {
            // References and predicates that could not be evaluated statically are emitted as is.
            predicate = new compiler_1.WrappedNodeExpr(node);
        }
        else if (typeof arg === 'string') {
            predicate = [arg];
        }
        else if (isStringArrayOrDie(arg, "@" + name + " predicate", node)) {
            predicate = arg;
        }
        else {
            throw diagnostics_2.createValueHasWrongTypeError(node, arg, "@" + name + " predicate cannot be interpreted");
        }
        // Extract the read and descendants options.
        var read = null;
        // The default value for descendants is true for every decorator except @ContentChildren.
        var descendants = name !== 'ContentChildren';
        if (args.length === 2) {
            var optionsExpr = util_2.unwrapExpression(args[1]);
            if (!ts.isObjectLiteralExpression(optionsExpr)) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARG_NOT_LITERAL, optionsExpr, "@" + name + " options must be an object literal");
            }
            var options = reflection_1.reflectObjectLiteral(optionsExpr);
            if (options.has('read')) {
                read = new compiler_1.WrappedNodeExpr(options.get('read'));
            }
            if (options.has('descendants')) {
                var descendantsExpr = options.get('descendants');
                var descendantsValue = evaluator.evaluate(descendantsExpr);
                if (typeof descendantsValue !== 'boolean') {
                    throw diagnostics_2.createValueHasWrongTypeError(descendantsExpr, descendantsValue, "@" + name + " options.descendants must be a boolean");
                }
                descendants = descendantsValue;
            }
            if (options.has('static')) {
                var staticValue = evaluator.evaluate(options.get('static'));
                if (typeof staticValue !== 'boolean') {
                    throw diagnostics_2.createValueHasWrongTypeError(node, staticValue, "@" + name + " options.static must be a boolean");
                }
                isStatic = staticValue;
            }
        }
        else if (args.length > 2) {
            // Too many arguments.
            throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARITY_WRONG, node, "@" + name + " has too many arguments");
        }
        return {
            propertyName: propertyName,
            predicate: predicate,
            first: first,
            descendants: descendants,
            read: read,
            static: isStatic,
        };
    }
    exports.extractQueryMetadata = extractQueryMetadata;
    function extractQueriesFromDecorator(queryData, reflector, evaluator, isCore) {
        var content = [], view = [];
        if (!ts.isObjectLiteralExpression(queryData)) {
            throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.VALUE_HAS_WRONG_TYPE, queryData, 'Decorator queries metadata must be an object literal');
        }
        reflection_1.reflectObjectLiteral(queryData).forEach(function (queryExpr, propertyName) {
            queryExpr = util_2.unwrapExpression(queryExpr);
            if (!ts.isNewExpression(queryExpr) || !ts.isIdentifier(queryExpr.expression)) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.VALUE_HAS_WRONG_TYPE, queryData, 'Decorator query metadata must be an instance of a query type');
            }
            var type = reflector.getImportOfIdentifier(queryExpr.expression);
            if (type === null || (!isCore && type.from !== '@angular/core') ||
                !QUERY_TYPES.has(type.name)) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.VALUE_HAS_WRONG_TYPE, queryData, 'Decorator query metadata must be an instance of a query type');
            }
            var query = extractQueryMetadata(queryExpr, type.name, queryExpr.arguments || [], propertyName, reflector, evaluator);
            if (type.name.startsWith('Content')) {
                content.push(query);
            }
            else {
                view.push(query);
            }
        });
        return { content: content, view: view };
    }
    exports.extractQueriesFromDecorator = extractQueriesFromDecorator;
    function isStringArrayOrDie(value, name, node) {
        if (!Array.isArray(value)) {
            return false;
        }
        for (var i = 0; i < value.length; i++) {
            if (typeof value[i] !== 'string') {
                throw diagnostics_2.createValueHasWrongTypeError(node, value[i], "Failed to resolve " + name + " at position " + i + " to a string");
            }
        }
        return true;
    }
    function parseFieldArrayValue(directive, field, evaluator) {
        if (!directive.has(field)) {
            return null;
        }
        // Resolve the field of interest from the directive metadata to a string[].
        var expression = directive.get(field);
        var value = evaluator.evaluate(expression);
        if (!isStringArrayOrDie(value, field, expression)) {
            throw diagnostics_2.createValueHasWrongTypeError(expression, value, "Failed to resolve @Directive." + field + " to a string array");
        }
        return value;
    }
    exports.parseFieldArrayValue = parseFieldArrayValue;
    /**
     * Interpret property mapping fields on the decorator (e.g. inputs or outputs) and return the
     * correctly shaped metadata object.
     */
    function parseFieldToPropertyMapping(directive, field, evaluator) {
        var metaValues = parseFieldArrayValue(directive, field, evaluator);
        if (!metaValues) {
            return EMPTY_OBJECT;
        }
        return metaValues.reduce(function (results, value) {
            // Either the value is 'field' or 'field: property'. In the first case, `property` will
            // be undefined, in which case the field name should also be used as the property name.
            var _a = tslib_1.__read(value.split(':', 2).map(function (str) { return str.trim(); }), 2), field = _a[0], property = _a[1];
            results[field] = property || field;
            return results;
        }, {});
    }
    /**
     * Parse property decorators (e.g. `Input` or `Output`) and return the correctly shaped metadata
     * object.
     */
    function parseDecoratedFields(fields, evaluator, mapValueResolver) {
        return fields.reduce(function (results, field) {
            var fieldName = field.member.name;
            field.decorators.forEach(function (decorator) {
                // The decorator either doesn't have an argument (@Input()) in which case the property
                // name is used, or it has one argument (@Output('named')).
                if (decorator.args == null || decorator.args.length === 0) {
                    results[fieldName] = fieldName;
                }
                else if (decorator.args.length === 1) {
                    var property = evaluator.evaluate(decorator.args[0]);
                    if (typeof property !== 'string') {
                        throw diagnostics_2.createValueHasWrongTypeError(reflection_1.Decorator.nodeForError(decorator), property, "@" + decorator.name + " decorator argument must resolve to a string");
                    }
                    results[fieldName] = mapValueResolver(property, fieldName);
                }
                else {
                    // Too many arguments.
                    throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARITY_WRONG, reflection_1.Decorator.nodeForError(decorator), "@" + decorator.name + " can have at most one argument, got " + decorator.args.length + " argument(s)");
                }
            });
            return results;
        }, {});
    }
    function resolveInput(publicName, internalName) {
        return [publicName, internalName];
    }
    function resolveOutput(publicName, internalName) {
        return publicName;
    }
    function queriesFromFields(fields, reflector, evaluator) {
        return fields.map(function (_a) {
            var member = _a.member, decorators = _a.decorators;
            var decorator = decorators[0];
            var node = member.node || reflection_1.Decorator.nodeForError(decorator);
            // Throw in case of `@Input() @ContentChild('foo') foo: any`, which is not supported in Ivy
            if (member.decorators.some(function (v) { return v.name === 'Input'; })) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_COLLISION, node, 'Cannot combine @Input decorators with query decorators');
            }
            if (decorators.length !== 1) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_COLLISION, node, 'Cannot have multiple query decorators on the same class member');
            }
            else if (!isPropertyTypeMember(member)) {
                throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_UNEXPECTED, node, 'Query decorator must go on a property-type member');
            }
            return extractQueryMetadata(node, decorator.name, decorator.args || [], member.name, reflector, evaluator);
        });
    }
    exports.queriesFromFields = queriesFromFields;
    function isPropertyTypeMember(member) {
        return member.kind === reflection_1.ClassMemberKind.Getter || member.kind === reflection_1.ClassMemberKind.Setter ||
            member.kind === reflection_1.ClassMemberKind.Property;
    }
    function evaluateHostExpressionBindings(hostExpr, evaluator) {
        var hostMetaMap = evaluator.evaluate(hostExpr);
        if (!(hostMetaMap instanceof Map)) {
            throw diagnostics_2.createValueHasWrongTypeError(hostExpr, hostMetaMap, "Decorator host metadata must be an object");
        }
        var hostMetadata = {};
        hostMetaMap.forEach(function (value, key) {
            // Resolve Enum references to their declared value.
            if (value instanceof partial_evaluator_1.EnumValue) {
                value = value.resolved;
            }
            if (typeof key !== 'string') {
                throw diagnostics_2.createValueHasWrongTypeError(hostExpr, key, "Decorator host metadata must be a string -> string object, but found unparseable key");
            }
            if (typeof value == 'string') {
                hostMetadata[key] = value;
            }
            else if (value instanceof partial_evaluator_1.DynamicValue) {
                hostMetadata[key] = new compiler_1.WrappedNodeExpr(value.node);
            }
            else {
                throw diagnostics_2.createValueHasWrongTypeError(hostExpr, value, "Decorator host metadata must be a string -> string object, but found unparseable value");
            }
        });
        var bindings = compiler_1.parseHostBindings(hostMetadata);
        var errors = compiler_1.verifyHostBindings(bindings, util_2.createSourceSpan(hostExpr));
        if (errors.length > 0) {
            throw new diagnostics_1.FatalDiagnosticError(
            // TODO: provide more granular diagnostic and output specific host expression that
            // triggered an error instead of the whole host object.
            diagnostics_1.ErrorCode.HOST_BINDING_PARSE_ERROR, hostExpr, errors.map(function (error) { return error.msg; }).join('\n'));
        }
        return bindings;
    }
    function extractHostBindings(members, evaluator, coreModule, metadata) {
        var bindings;
        if (metadata && metadata.has('host')) {
            bindings = evaluateHostExpressionBindings(metadata.get('host'), evaluator);
        }
        else {
            bindings = compiler_1.parseHostBindings({});
        }
        reflection_1.filterToMembersWithDecorator(members, 'HostBinding', coreModule)
            .forEach(function (_a) {
            var member = _a.member, decorators = _a.decorators;
            decorators.forEach(function (decorator) {
                var hostPropertyName = member.name;
                if (decorator.args !== null && decorator.args.length > 0) {
                    if (decorator.args.length !== 1) {
                        throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARITY_WRONG, reflection_1.Decorator.nodeForError(decorator), "@HostBinding can have at most one argument, got " + decorator.args.length + " argument(s)");
                    }
                    var resolved = evaluator.evaluate(decorator.args[0]);
                    if (typeof resolved !== 'string') {
                        throw diagnostics_2.createValueHasWrongTypeError(reflection_1.Decorator.nodeForError(decorator), resolved, "@HostBinding's argument must be a string");
                    }
                    hostPropertyName = resolved;
                }
                bindings.properties[hostPropertyName] = member.name;
            });
        });
        reflection_1.filterToMembersWithDecorator(members, 'HostListener', coreModule)
            .forEach(function (_a) {
            var member = _a.member, decorators = _a.decorators;
            decorators.forEach(function (decorator) {
                var eventName = member.name;
                var args = [];
                if (decorator.args !== null && decorator.args.length > 0) {
                    if (decorator.args.length > 2) {
                        throw new diagnostics_1.FatalDiagnosticError(diagnostics_1.ErrorCode.DECORATOR_ARITY_WRONG, decorator.args[2], "@HostListener can have at most two arguments");
                    }
                    var resolved = evaluator.evaluate(decorator.args[0]);
                    if (typeof resolved !== 'string') {
                        throw diagnostics_2.createValueHasWrongTypeError(decorator.args[0], resolved, "@HostListener's event name argument must be a string");
                    }
                    eventName = resolved;
                    if (decorator.args.length === 2) {
                        var expression = decorator.args[1];
                        var resolvedArgs = evaluator.evaluate(decorator.args[1]);
                        if (!isStringArrayOrDie(resolvedArgs, '@HostListener.args', expression)) {
                            throw diagnostics_2.createValueHasWrongTypeError(decorator.args[1], resolvedArgs, "@HostListener's second argument must be a string array");
                        }
                        args = resolvedArgs;
                    }
                }
                bindings.listeners[eventName] = member.name + "(" + args.join(',') + ")";
            });
        });
        return bindings;
    }
    exports.extractHostBindings = extractHostBindings;
    var QUERY_TYPES = new Set([
        'ContentChild',
        'ContentChildren',
        'ViewChild',
        'ViewChildren',
    ]);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlyZWN0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXItY2xpL3NyYy9uZ3RzYy9hbm5vdGF0aW9ucy9zcmMvZGlyZWN0aXZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw4Q0FBeVM7SUFDelMsK0JBQWlDO0lBRWpDLDJFQUFrRTtJQUNsRSxtRUFBK0Q7SUFDL0QscUVBQXVJO0lBQ3ZJLDBFQUFzRTtJQUN0RSx1RkFBa0Y7SUFDbEYseUVBQStKO0lBRS9KLHVFQUE4STtJQUU5SSwyRkFBOEo7SUFDOUosbUZBQW1EO0lBQ25ELHFGQUF3RDtJQUN4RCw2RUFBdVQ7SUFFdlQsSUFBTSxZQUFZLEdBQTRCLEVBQUUsQ0FBQztJQUNqRCxJQUFNLGdCQUFnQixHQUFHO1FBQ3ZCLE9BQU8sRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsaUJBQWlCLEVBQUUsYUFBYTtRQUNoRyxjQUFjO0tBQ2YsQ0FBQztJQUNGLElBQU0sZUFBZSxHQUFHLElBQUksR0FBRyxDQUFDO1FBQzlCLGFBQWEsRUFBRSxVQUFVLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxpQkFBaUIsRUFBRSxvQkFBb0I7UUFDOUYsb0JBQW9CLEVBQUUsdUJBQXVCO0tBQzlDLENBQUMsQ0FBQztJQVlIO1FBRUUsbUNBQ1ksU0FBeUIsRUFBVSxTQUEyQixFQUM5RCxZQUE4QixFQUFVLGFBQXVDLEVBQy9FLFVBQTBCLEVBQVUscUJBQTRDLEVBQ2hGLGtCQUEyQyxFQUFVLE1BQWUsRUFDcEUsMEJBQW1DLEVBQ25DLDRDQUFxRDtZQUxyRCxjQUFTLEdBQVQsU0FBUyxDQUFnQjtZQUFVLGNBQVMsR0FBVCxTQUFTLENBQWtCO1lBQzlELGlCQUFZLEdBQVosWUFBWSxDQUFrQjtZQUFVLGtCQUFhLEdBQWIsYUFBYSxDQUEwQjtZQUMvRSxlQUFVLEdBQVYsVUFBVSxDQUFnQjtZQUFVLDBCQUFxQixHQUFyQixxQkFBcUIsQ0FBdUI7WUFDaEYsdUJBQWtCLEdBQWxCLGtCQUFrQixDQUF5QjtZQUFVLFdBQU0sR0FBTixNQUFNLENBQVM7WUFDcEUsK0JBQTBCLEdBQTFCLDBCQUEwQixDQUFTO1lBQ25DLGlEQUE0QyxHQUE1Qyw0Q0FBNEMsQ0FBUztZQUV4RCxlQUFVLEdBQUcsNkJBQWlCLENBQUMsT0FBTyxDQUFDO1lBQ3ZDLFNBQUksR0FBRyx5QkFBeUIsQ0FBQyxJQUFJLENBQUM7UUFIcUIsQ0FBQztRQUtyRSwwQ0FBTSxHQUFOLFVBQU8sSUFBc0IsRUFBRSxVQUE0QjtZQUV6RCwwRUFBMEU7WUFDMUUsNEVBQTRFO1lBQzVFLCtFQUErRTtZQUMvRSw0Q0FBNEM7WUFDNUMsSUFBSSxDQUFDLFVBQVUsRUFBRTtnQkFDZixJQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsaUNBQWlDLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2xFLE9BQU8sWUFBWSxDQUFDLENBQUMsQ0FBQyxFQUFDLE9BQU8sRUFBRSxZQUFZLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBQyxDQUFDLENBQUM7b0JBQy9ELFNBQVMsQ0FBQzthQUNqQztpQkFBTTtnQkFDTCxJQUFNLFNBQVMsR0FBRywyQkFBb0IsQ0FBQyxVQUFVLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDN0UsT0FBTyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxJQUFJLEVBQUUsU0FBUyxXQUFBLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBQyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7YUFDMUY7UUFDSCxDQUFDO1FBRUQsMkNBQU8sR0FBUCxVQUFRLElBQXNCLEVBQUUsU0FBbUMsRUFBRSxLQUF5QjtZQUF6QixzQkFBQSxFQUFBLFFBQVEsd0JBQVksQ0FBQyxJQUFJO1lBRTVGLGlGQUFpRjtZQUNqRixtRkFBbUY7WUFDbkYsOEVBQThFO1lBQzlFLGtFQUFrRTtZQUNsRSxJQUFJLElBQUksQ0FBQyw0Q0FBNEMsS0FBSyxLQUFLLElBQUksU0FBUyxLQUFLLElBQUksRUFBRTtnQkFDckYsT0FBTyxFQUFDLFdBQVcsRUFBRSxDQUFDLDhEQUFnRCxDQUFDLElBQUksQ0FBQyxDQUFDLEVBQUMsQ0FBQzthQUNoRjtZQUVELElBQU0sZUFBZSxHQUFHLHdCQUF3QixDQUM1QyxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMscUJBQXFCLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFDeEYsS0FBSyxFQUFFLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO1lBQzVDLElBQUksZUFBZSxLQUFLLFNBQVMsRUFBRTtnQkFDakMsT0FBTyxFQUFFLENBQUM7YUFDWDtZQUNELElBQU0sUUFBUSxHQUFHLGVBQWUsQ0FBQyxRQUFRLENBQUM7WUFFMUMsSUFBSSx5QkFBeUIsR0FBMEMsSUFBSSxDQUFDO1lBQzVFLElBQUksZUFBZSxLQUFLLFNBQVMsSUFBSSxlQUFlLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDL0UseUJBQXlCLEdBQUcsdUNBQWdDLENBQ3hELGVBQWUsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBRSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO2FBQ2xGO1lBRUQsT0FBTztnQkFDTCxRQUFRLEVBQUU7b0JBQ1IsTUFBTSxFQUFFLGVBQWUsQ0FBQyxNQUFNO29CQUM5QixPQUFPLEVBQUUsZUFBZSxDQUFDLE9BQU87b0JBQ2hDLElBQUksRUFBRSxRQUFRO29CQUNkLFlBQVksRUFBRSx1Q0FBNEIsQ0FDdEMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixFQUFFLElBQUksQ0FBQyxNQUFNLEVBQzdELElBQUksQ0FBQywwQkFBMEIsQ0FBQztvQkFDcEMsU0FBUyxFQUFFLG9CQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztvQkFDOUQsYUFBYSxFQUFFLG9DQUE2QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7b0JBQzFGLHlCQUF5QiwyQkFBQTtpQkFDMUI7YUFDRixDQUFDO1FBQ0osQ0FBQztRQUVELDRDQUFRLEdBQVIsVUFBUyxJQUFzQixFQUFFLFFBQXdDO1lBQ3ZFLHVGQUF1RjtZQUN2RiwrRUFBK0U7WUFDL0UsSUFBTSxHQUFHLEdBQUcsSUFBSSxtQkFBUyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2hDLElBQUksQ0FBQyxZQUFZLENBQUMseUJBQXlCLG9CQUN6QyxHQUFHLEtBQUEsRUFDSCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQ3BCLFFBQVEsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFDaEMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUNoQyxNQUFNLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFDdkIsT0FBTyxFQUFFLFFBQVEsQ0FBQyxPQUFPLEVBQ3pCLE9BQU8sRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsWUFBWSxFQUFsQixDQUFrQixDQUFDLEVBQy9ELFdBQVcsRUFBRSxLQUFLLEVBQ2xCLFNBQVMsRUFBRSxRQUFRLENBQUMsU0FBUyxJQUMxQixRQUFRLENBQUMsYUFBYSxFQUN6QixDQUFDO1lBRUgsSUFBSSxDQUFDLGtCQUFrQixDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFFRCwyQ0FBTyxHQUFQLFVBQVEsSUFBc0IsRUFBRSxRQUE4QjtZQUM1RCxJQUFNLFdBQVcsR0FBb0IsRUFBRSxDQUFDO1lBRXhDLElBQUksUUFBUSxDQUFDLHlCQUF5QixLQUFLLElBQUk7Z0JBQzNDLFFBQVEsQ0FBQyxJQUFJLENBQUMsU0FBUyxZQUFZLDBCQUFlLEVBQUU7Z0JBQ3RELElBQU0sbUJBQW1CLEdBQUcsb0NBQXNCLENBQzlDLFFBQVEsQ0FBQyx5QkFBeUIsRUFBRSxRQUFRLENBQUMsSUFBSSxDQUFDLFNBQVUsQ0FBQyxJQUFJLEVBQ2pFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO2dCQUM3QixXQUFXLENBQUMsSUFBSSxPQUFoQixXQUFXLG1CQUFTLG1CQUFtQixHQUFFO2FBQzFDO1lBRUQsSUFBTSxvQkFBb0IsR0FBRyxxQ0FBdUIsQ0FDaEQsSUFBSSxFQUFFLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUM7WUFDNUYsSUFBSSxvQkFBb0IsS0FBSyxJQUFJLEVBQUU7Z0JBQ2pDLFdBQVcsQ0FBQyxJQUFJLE9BQWhCLFdBQVcsbUJBQVMsb0JBQW9CLEdBQUU7YUFDM0M7WUFFRCxPQUFPLEVBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLFNBQVMsRUFBQyxDQUFDO1FBQ3pFLENBQUM7UUFFRCwyQ0FBTyxHQUFQLFVBQ0ksSUFBc0IsRUFBRSxRQUF3QyxFQUNoRSxVQUE2QixFQUFFLElBQWtCO1lBQ25ELElBQU0sSUFBSSxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7WUFDM0IsSUFBTSxHQUFHLEdBQUcsdUNBQTRCLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSw0QkFBaUIsRUFBRSxDQUFDLENBQUM7WUFDMUUsSUFBTSxVQUFVLEdBQUcsa0NBQXdCLHVDQUNuQyxJQUFJLEtBQUUsUUFBUSxFQUFFLHNCQUFXLENBQUMsZUFBZSxFQUFFLE1BQU0sRUFBRSwwQkFBZSxDQUFDLFNBQVMsSUFBRSxDQUFDO1lBQ3pGLElBQUksUUFBUSxDQUFDLFlBQVksS0FBSyxJQUFJLEVBQUU7Z0JBQ2xDLFVBQVUsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQzthQUNuRDtZQUNELE9BQU87Z0JBQ0wsVUFBVSxFQUFFO29CQUNWLElBQUksRUFBRSxNQUFNO29CQUNaLFdBQVcsRUFBRSxHQUFHLENBQUMsVUFBVTtvQkFDM0IsVUFBVSxFQUFFLEVBQUU7b0JBQ2QsSUFBSSxFQUFFLEdBQUcsQ0FBQyxJQUFJO2lCQUNmO2FBQ0YsQ0FBQztRQUNKLENBQUM7UUFFRDs7Ozs7V0FLRztRQUNLLHFFQUFpQyxHQUF6QyxVQUEwQyxJQUFzQjtZQUFoRSxpQkFhQztZQVpDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBQSxNQUFNO2dCQUN2RCxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLDRCQUFlLENBQUMsTUFBTTtvQkFDMUQsZUFBZSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQ3BDLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2dCQUNELElBQUksTUFBTSxDQUFDLFVBQVUsRUFBRTtvQkFDckIsT0FBTyxNQUFNLENBQUMsVUFBVSxDQUFDLElBQUksQ0FDekIsVUFBQSxTQUFTLElBQUksT0FBQSxnQkFBZ0IsQ0FBQyxJQUFJLENBQzlCLFVBQUEsYUFBYSxJQUFJLE9BQUEseUJBQWtCLENBQUMsU0FBUyxFQUFFLGFBQWEsRUFBRSxLQUFJLENBQUMsTUFBTSxDQUFDLEVBQXpELENBQXlELENBQUMsRUFEbEUsQ0FDa0UsQ0FBQyxDQUFDO2lCQUN0RjtnQkFDRCxPQUFPLEtBQUssQ0FBQztZQUNmLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUNILGdDQUFDO0lBQUQsQ0FBQyxBQXBKRCxJQW9KQztJQXBKWSw4REFBeUI7SUFzSnRDOzs7OztPQUtHO0lBQ0gsU0FBZ0Isd0JBQXdCLENBQ3BDLEtBQXVCLEVBQUUsU0FBbUMsRUFBRSxTQUF5QixFQUN2RixTQUEyQixFQUFFLHFCQUE0QyxFQUFFLE1BQWUsRUFDMUYsS0FBbUIsRUFBRSwwQkFBbUMsRUFDeEQsZUFBbUM7UUFBbkMsZ0NBQUEsRUFBQSxzQkFBbUM7UUFNckMsSUFBSSxTQUFxQyxDQUFDO1FBQzFDLElBQUksU0FBUyxLQUFLLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxLQUFLLElBQUksSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDaEYsU0FBUyxHQUFHLElBQUksR0FBRyxFQUF5QixDQUFDO1NBQzlDO2FBQU0sSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDdEMsTUFBTSxJQUFJLGtDQUFvQixDQUMxQix1QkFBUyxDQUFDLHFCQUFxQixFQUFFLHNCQUFTLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxFQUNsRSx1Q0FBcUMsU0FBUyxDQUFDLElBQUksZUFBWSxDQUFDLENBQUM7U0FDdEU7YUFBTTtZQUNMLElBQU0sSUFBSSxHQUFHLHVCQUFnQixDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNqRCxJQUFJLENBQUMsRUFBRSxDQUFDLHlCQUF5QixDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUN2QyxNQUFNLElBQUksa0NBQW9CLENBQzFCLHVCQUFTLENBQUMseUJBQXlCLEVBQUUsSUFBSSxFQUN6QyxNQUFJLFNBQVMsQ0FBQyxJQUFJLHdDQUFxQyxDQUFDLENBQUM7YUFDOUQ7WUFDRCxTQUFTLEdBQUcsaUNBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDeEM7UUFFRCxJQUFJLFNBQVMsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDeEIsd0VBQXdFO1lBQ3hFLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBRUQsSUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRW5ELGdHQUFnRztRQUNoRyw4QkFBOEI7UUFDOUIsSUFBTSxpQkFBaUIsR0FDbkIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFBLE1BQU0sSUFBSSxPQUFBLENBQUMsTUFBTSxDQUFDLFFBQVEsSUFBSSxNQUFNLENBQUMsVUFBVSxLQUFLLElBQUksRUFBOUMsQ0FBOEMsQ0FBQyxDQUFDO1FBRTdFLElBQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxlQUFlLENBQUM7UUFFeEQsa0VBQWtFO1FBQ2xFLCtCQUErQjtRQUMvQixVQUFVO1FBQ1YsSUFBTSxjQUFjLEdBQUcsMkJBQTJCLENBQUMsU0FBUyxFQUFFLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNuRixJQUFNLGdCQUFnQixHQUFHLG9CQUFvQixDQUN6Qyx5Q0FBNEIsQ0FBQyxpQkFBaUIsRUFBRSxPQUFPLEVBQUUsVUFBVSxDQUFDLEVBQUUsU0FBUyxFQUMvRSxZQUFZLENBQUMsQ0FBQztRQUVsQixlQUFlO1FBQ2YsSUFBTSxlQUFlLEdBQUcsMkJBQTJCLENBQUMsU0FBUyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNyRixJQUFNLGlCQUFpQixHQUNuQixvQkFBb0IsQ0FDaEIseUNBQTRCLENBQUMsaUJBQWlCLEVBQUUsUUFBUSxFQUFFLFVBQVUsQ0FBQyxFQUFFLFNBQVMsRUFDaEYsYUFBYSxDQUE4QixDQUFDO1FBQ3BELGlDQUFpQztRQUNqQyxJQUFNLHNCQUFzQixHQUFHLGlCQUFpQixDQUM1Qyx5Q0FBNEIsQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLEVBQUUsVUFBVSxDQUFDLEVBQUUsU0FBUyxFQUN0RixTQUFTLENBQUMsQ0FBQztRQUNmLElBQU0seUJBQXlCLEdBQUcsaUJBQWlCLENBQy9DLHlDQUE0QixDQUFDLGlCQUFpQixFQUFFLGlCQUFpQixFQUFFLFVBQVUsQ0FBQyxFQUFFLFNBQVMsRUFDekYsU0FBUyxDQUFDLENBQUM7UUFFZixJQUFNLE9BQU8sb0JBQU8sc0JBQXNCLEVBQUsseUJBQXlCLENBQUMsQ0FBQztRQUUxRSxzQ0FBc0M7UUFDdEMsSUFBTSxtQkFBbUIsR0FBRyxpQkFBaUIsQ0FDekMseUNBQTRCLENBQUMsaUJBQWlCLEVBQUUsV0FBVyxFQUFFLFVBQVUsQ0FBQyxFQUFFLFNBQVMsRUFDbkYsU0FBUyxDQUFDLENBQUM7UUFDZixJQUFNLHNCQUFzQixHQUFHLGlCQUFpQixDQUM1Qyx5Q0FBNEIsQ0FBQyxpQkFBaUIsRUFBRSxjQUFjLEVBQUUsVUFBVSxDQUFDLEVBQUUsU0FBUyxFQUN0RixTQUFTLENBQUMsQ0FBQztRQUNmLElBQU0sV0FBVyxvQkFBTyxtQkFBbUIsRUFBSyxzQkFBc0IsQ0FBQyxDQUFDO1FBRXhFLElBQUksU0FBUyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRTtZQUM1QixJQUFNLG9CQUFvQixHQUN0QiwyQkFBMkIsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBRSxFQUFFLFNBQVMsRUFBRSxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDekYsT0FBTyxDQUFDLElBQUksT0FBWixPQUFPLG1CQUFTLG9CQUFvQixDQUFDLE9BQU8sR0FBRTtZQUM5QyxXQUFXLENBQUMsSUFBSSxPQUFoQixXQUFXLG1CQUFTLG9CQUFvQixDQUFDLElBQUksR0FBRTtTQUNoRDtRQUVELHNCQUFzQjtRQUN0QixJQUFJLFFBQVEsR0FBRyxlQUFlLENBQUM7UUFDL0IsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQzdCLElBQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFFLENBQUM7WUFDeEMsSUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxQyxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRTtnQkFDaEMsTUFBTSwwQ0FBNEIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLDJCQUEyQixDQUFDLENBQUM7YUFDakY7WUFDRCwyREFBMkQ7WUFDM0QsUUFBUSxHQUFHLFFBQVEsS0FBSyxFQUFFLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO1lBQ3hELElBQUksQ0FBQyxRQUFRLEVBQUU7Z0JBQ2IsTUFBTSxJQUFJLGtDQUFvQixDQUMxQix1QkFBUyxDQUFDLDBCQUEwQixFQUFFLElBQUksRUFDMUMsZUFBYSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUkscUNBQWtDLENBQUMsQ0FBQzthQUNyRTtTQUNGO1FBRUQsSUFBTSxJQUFJLEdBQUcsbUJBQW1CLENBQUMsaUJBQWlCLEVBQUUsU0FBUyxFQUFFLFVBQVUsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUV0RixJQUFNLFNBQVMsR0FBb0IsU0FBUyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQzNELElBQUksMEJBQWUsQ0FDZiwwQkFBMEIsQ0FBQyxDQUFDO2dCQUN4QixzQ0FBK0IsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBRSxDQUFDLENBQUMsQ0FBQztnQkFDOUQsU0FBUyxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdEMsSUFBSSxDQUFDO1FBRVQsMkVBQTJFO1FBQzNFLElBQU0sYUFBYSxHQUFHLE9BQU8sQ0FBQyxJQUFJLENBQzlCLFVBQUEsTUFBTSxJQUFJLE9BQUEsQ0FBQyxNQUFNLENBQUMsUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLEtBQUssNEJBQWUsQ0FBQyxNQUFNO1lBQ2hFLE1BQU0sQ0FBQyxJQUFJLEtBQUssYUFBYSxFQUR2QixDQUN1QixDQUFDLENBQUM7UUFFdkMsa0JBQWtCO1FBQ2xCLElBQUksUUFBUSxHQUFrQixJQUFJLENBQUM7UUFDbkMsSUFBSSxTQUFTLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQzdCLElBQU0sSUFBSSxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFFLENBQUM7WUFDeEMsSUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxQyxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRTtnQkFDaEMsTUFBTSwwQ0FBNEIsQ0FBQyxJQUFJLEVBQUUsUUFBUSxFQUFFLDJCQUEyQixDQUFDLENBQUM7YUFDakY7WUFDRCxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxJQUFJLElBQUksT0FBQSxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQVgsQ0FBVyxDQUFDLENBQUM7U0FDekQ7UUFFRCxJQUFNLFdBQVcsR0FBRyxpQ0FBMEIsQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLHFCQUFxQixFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ2hHLElBQUksUUFBK0MsQ0FBQztRQUVwRCxrR0FBa0c7UUFDbEcsK0ZBQStGO1FBQy9GLDhCQUE4QjtRQUM5QixJQUFJLFFBQVEsS0FBSyxJQUFJLEVBQUU7WUFDckIsUUFBUSxHQUFHLHNDQUErQixDQUFDLEtBQUssRUFBRSxXQUFXLENBQUMsQ0FBQztTQUNoRTthQUFNO1lBQ0wsUUFBUSxHQUFHLG9DQUE2QixDQUFDLFdBQVcsQ0FBQyxDQUFDO1NBQ3ZEO1FBRUQsc0RBQXNEO1FBQ3RELElBQU0sZUFBZSxHQUFHLFNBQVMsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdEQsSUFBTSxJQUFJLEdBQUcsd0JBQWlCLENBQUMsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQ2pELElBQU0sWUFBWSxHQUFHLElBQUksMEJBQWUsQ0FBQyxTQUFTLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztRQUVsRixJQUFNLE1BQU0sR0FBRywrQkFBb0IsQ0FBQyxnQkFBZ0IsdUNBQUssY0FBYyxHQUFLLGdCQUFnQixFQUFFLENBQUM7UUFDL0YsSUFBTSxPQUFPLEdBQUcsK0JBQW9CLENBQUMsZ0JBQWdCLHVDQUFLLGVBQWUsR0FBSyxpQkFBaUIsRUFBRSxDQUFDO1FBRWxHLElBQU0sUUFBUSxHQUF3QjtZQUNwQyxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJO1lBQ3JCLElBQUksRUFBRSxRQUFRO1lBQ2QsSUFBSSxNQUFBO1lBQ0osU0FBUyxFQUFFO2dCQUNULGFBQWEsZUFBQTthQUNkO1lBQ0QsTUFBTSxFQUFFLE1BQU0sQ0FBQyxtQkFBbUIsRUFBRTtZQUNwQyxPQUFPLEVBQUUsT0FBTyxDQUFDLG9CQUFvQixFQUFFO1lBQ3ZDLE9BQU8sU0FBQTtZQUNQLFdBQVcsYUFBQTtZQUNYLFFBQVEsVUFBQTtZQUNSLGVBQWUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsd0JBQVksQ0FBQyxnQkFBZ0IsQ0FBQztZQUMxRCxJQUFJLE1BQUE7WUFDSixZQUFZLGNBQUE7WUFDWixpQkFBaUIsRUFBRSxTQUFTLENBQUMsc0JBQXNCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUMvRCxjQUFjLEVBQUUsdUJBQWdCLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUM1QyxlQUFlLGlCQUFBO1lBQ2YsUUFBUSxVQUFBO1lBQ1IsU0FBUyxXQUFBO1NBQ1YsQ0FBQztRQUNGLE9BQU87WUFDTCxTQUFTLEVBQUUsU0FBUztZQUNwQixRQUFRLFVBQUE7WUFDUixNQUFNLFFBQUE7WUFDTixPQUFPLFNBQUE7U0FDUixDQUFDO0lBQ0osQ0FBQztJQTFLRCw0REEwS0M7SUFFRCxTQUFnQixvQkFBb0IsQ0FDaEMsUUFBaUIsRUFBRSxJQUFZLEVBQUUsSUFBa0MsRUFBRSxZQUFvQixFQUN6RixTQUF5QixFQUFFLFNBQTJCO1FBQ3hELElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDckIsTUFBTSxJQUFJLGtDQUFvQixDQUMxQix1QkFBUyxDQUFDLHFCQUFxQixFQUFFLFFBQVEsRUFBRSxNQUFJLElBQUkseUJBQXNCLENBQUMsQ0FBQztTQUNoRjtRQUNELElBQU0sS0FBSyxHQUFHLElBQUksS0FBSyxXQUFXLElBQUksSUFBSSxLQUFLLGNBQWMsQ0FBQztRQUM5RCxJQUFNLElBQUksR0FBRyx1QkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDbEQsSUFBTSxHQUFHLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUVyQyxzRkFBc0Y7UUFDdEYsSUFBSSxRQUFRLEdBQVksS0FBSyxDQUFDO1FBRTlCLHdCQUF3QjtRQUN4QixJQUFJLFNBQVMsR0FBNkIsSUFBSSxDQUFDO1FBQy9DLElBQUksR0FBRyxZQUFZLG1CQUFTLElBQUksR0FBRyxZQUFZLGdDQUFZLEVBQUU7WUFDM0Qsc0ZBQXNGO1lBQ3RGLFNBQVMsR0FBRyxJQUFJLDBCQUFlLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdkM7YUFBTSxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRTtZQUNsQyxTQUFTLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztTQUNuQjthQUFNLElBQUksa0JBQWtCLENBQUMsR0FBRyxFQUFFLE1BQUksSUFBSSxlQUFZLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDOUQsU0FBUyxHQUFHLEdBQUcsQ0FBQztTQUNqQjthQUFNO1lBQ0wsTUFBTSwwQ0FBNEIsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLE1BQUksSUFBSSxxQ0FBa0MsQ0FBQyxDQUFDO1NBQzNGO1FBRUQsNENBQTRDO1FBQzVDLElBQUksSUFBSSxHQUFvQixJQUFJLENBQUM7UUFDakMseUZBQXlGO1FBQ3pGLElBQUksV0FBVyxHQUFZLElBQUksS0FBSyxpQkFBaUIsQ0FBQztRQUN0RCxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ3JCLElBQU0sV0FBVyxHQUFHLHVCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzlDLElBQUksQ0FBQyxFQUFFLENBQUMseUJBQXlCLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzlDLE1BQU0sSUFBSSxrQ0FBb0IsQ0FDMUIsdUJBQVMsQ0FBQyx5QkFBeUIsRUFBRSxXQUFXLEVBQ2hELE1BQUksSUFBSSx1Q0FBb0MsQ0FBQyxDQUFDO2FBQ25EO1lBQ0QsSUFBTSxPQUFPLEdBQUcsaUNBQW9CLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO2dCQUN2QixJQUFJLEdBQUcsSUFBSSwwQkFBZSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFFLENBQUMsQ0FBQzthQUNsRDtZQUVELElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsRUFBRTtnQkFDOUIsSUFBTSxlQUFlLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUUsQ0FBQztnQkFDcEQsSUFBTSxnQkFBZ0IsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxDQUFDO2dCQUM3RCxJQUFJLE9BQU8sZ0JBQWdCLEtBQUssU0FBUyxFQUFFO29CQUN6QyxNQUFNLDBDQUE0QixDQUM5QixlQUFlLEVBQUUsZ0JBQWdCLEVBQUUsTUFBSSxJQUFJLDJDQUF3QyxDQUFDLENBQUM7aUJBQzFGO2dCQUNELFdBQVcsR0FBRyxnQkFBZ0IsQ0FBQzthQUNoQztZQUVELElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRTtnQkFDekIsSUFBTSxXQUFXLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBRSxDQUFDLENBQUM7Z0JBQy9ELElBQUksT0FBTyxXQUFXLEtBQUssU0FBUyxFQUFFO29CQUNwQyxNQUFNLDBDQUE0QixDQUM5QixJQUFJLEVBQUUsV0FBVyxFQUFFLE1BQUksSUFBSSxzQ0FBbUMsQ0FBQyxDQUFDO2lCQUNyRTtnQkFDRCxRQUFRLEdBQUcsV0FBVyxDQUFDO2FBQ3hCO1NBRUY7YUFBTSxJQUFJLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQzFCLHNCQUFzQjtZQUN0QixNQUFNLElBQUksa0NBQW9CLENBQzFCLHVCQUFTLENBQUMscUJBQXFCLEVBQUUsSUFBSSxFQUFFLE1BQUksSUFBSSw0QkFBeUIsQ0FBQyxDQUFDO1NBQy9FO1FBRUQsT0FBTztZQUNMLFlBQVksY0FBQTtZQUNaLFNBQVMsV0FBQTtZQUNULEtBQUssT0FBQTtZQUNMLFdBQVcsYUFBQTtZQUNYLElBQUksTUFBQTtZQUNKLE1BQU0sRUFBRSxRQUFRO1NBQ2pCLENBQUM7SUFDSixDQUFDO0lBNUVELG9EQTRFQztJQUVELFNBQWdCLDJCQUEyQixDQUN2QyxTQUF3QixFQUFFLFNBQXlCLEVBQUUsU0FBMkIsRUFDaEYsTUFBZTtRQUlqQixJQUFNLE9BQU8sR0FBc0IsRUFBRSxFQUFFLElBQUksR0FBc0IsRUFBRSxDQUFDO1FBQ3BFLElBQUksQ0FBQyxFQUFFLENBQUMseUJBQXlCLENBQUMsU0FBUyxDQUFDLEVBQUU7WUFDNUMsTUFBTSxJQUFJLGtDQUFvQixDQUMxQix1QkFBUyxDQUFDLG9CQUFvQixFQUFFLFNBQVMsRUFDekMsc0RBQXNELENBQUMsQ0FBQztTQUM3RDtRQUNELGlDQUFvQixDQUFDLFNBQVMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLFNBQVMsRUFBRSxZQUFZO1lBQzlELFNBQVMsR0FBRyx1QkFBZ0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN4QyxJQUFJLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxFQUFFO2dCQUM1RSxNQUFNLElBQUksa0NBQW9CLENBQzFCLHVCQUFTLENBQUMsb0JBQW9CLEVBQUUsU0FBUyxFQUN6Qyw4REFBOEQsQ0FBQyxDQUFDO2FBQ3JFO1lBQ0QsSUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNuRSxJQUFJLElBQUksS0FBSyxJQUFJLElBQUksQ0FBQyxDQUFDLE1BQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLGVBQWUsQ0FBQztnQkFDM0QsQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDL0IsTUFBTSxJQUFJLGtDQUFvQixDQUMxQix1QkFBUyxDQUFDLG9CQUFvQixFQUFFLFNBQVMsRUFDekMsOERBQThELENBQUMsQ0FBQzthQUNyRTtZQUVELElBQU0sS0FBSyxHQUFHLG9CQUFvQixDQUM5QixTQUFTLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsU0FBUyxJQUFJLEVBQUUsRUFBRSxZQUFZLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO1lBQ3pGLElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQ25DLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7YUFDckI7aUJBQU07Z0JBQ0wsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQzthQUNsQjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxFQUFDLE9BQU8sU0FBQSxFQUFFLElBQUksTUFBQSxFQUFDLENBQUM7SUFDekIsQ0FBQztJQXBDRCxrRUFvQ0M7SUFFRCxTQUFTLGtCQUFrQixDQUFDLEtBQVUsRUFBRSxJQUFZLEVBQUUsSUFBbUI7UUFDdkUsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDekIsT0FBTyxLQUFLLENBQUM7U0FDZDtRQUVELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3JDLElBQUksT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDLEtBQUssUUFBUSxFQUFFO2dCQUNoQyxNQUFNLDBDQUE0QixDQUM5QixJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLHVCQUFxQixJQUFJLHFCQUFnQixDQUFDLGlCQUFjLENBQUMsQ0FBQzthQUMvRTtTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsU0FBZ0Isb0JBQW9CLENBQ2hDLFNBQXFDLEVBQUUsS0FBYSxFQUFFLFNBQTJCO1FBRW5GLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ3pCLE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFFRCwyRUFBMkU7UUFDM0UsSUFBTSxVQUFVLEdBQUcsU0FBUyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUUsQ0FBQztRQUN6QyxJQUFNLEtBQUssR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsS0FBSyxFQUFFLFVBQVUsQ0FBQyxFQUFFO1lBQ2pELE1BQU0sMENBQTRCLENBQzlCLFVBQVUsRUFBRSxLQUFLLEVBQUUsa0NBQWdDLEtBQUssdUJBQW9CLENBQUMsQ0FBQztTQUNuRjtRQUVELE9BQU8sS0FBSyxDQUFDO0lBQ2YsQ0FBQztJQWhCRCxvREFnQkM7SUFFRDs7O09BR0c7SUFDSCxTQUFTLDJCQUEyQixDQUNoQyxTQUFxQyxFQUFFLEtBQWEsRUFDcEQsU0FBMkI7UUFDN0IsSUFBTSxVQUFVLEdBQUcsb0JBQW9CLENBQUMsU0FBUyxFQUFFLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNyRSxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ2YsT0FBTyxZQUFZLENBQUM7U0FDckI7UUFFRCxPQUFPLFVBQVUsQ0FBQyxNQUFNLENBQUMsVUFBQyxPQUFPLEVBQUUsS0FBSztZQUN0Qyx1RkFBdUY7WUFDdkYsdUZBQXVGO1lBQ2pGLElBQUEsS0FBQSxlQUFvQixLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxHQUFHLENBQUMsSUFBSSxFQUFFLEVBQVYsQ0FBVSxDQUFDLElBQUEsRUFBN0QsS0FBSyxRQUFBLEVBQUUsUUFBUSxRQUE4QyxDQUFDO1lBQ3JFLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxRQUFRLElBQUksS0FBSyxDQUFDO1lBQ25DLE9BQU8sT0FBTyxDQUFDO1FBQ2pCLENBQUMsRUFBRSxFQUErQixDQUFDLENBQUM7SUFDdEMsQ0FBQztJQUVEOzs7T0FHRztJQUNILFNBQVMsb0JBQW9CLENBQ3pCLE1BQXdELEVBQUUsU0FBMkIsRUFDckYsZ0JBQzZCO1FBQy9CLE9BQU8sTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFDLE9BQU8sRUFBRSxLQUFLO1lBQ2xDLElBQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO1lBQ3BDLEtBQUssQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQUEsU0FBUztnQkFDaEMsc0ZBQXNGO2dCQUN0RiwyREFBMkQ7Z0JBQzNELElBQUksU0FBUyxDQUFDLElBQUksSUFBSSxJQUFJLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO29CQUN6RCxPQUFPLENBQUMsU0FBUyxDQUFDLEdBQUcsU0FBUyxDQUFDO2lCQUNoQztxQkFBTSxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtvQkFDdEMsSUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3ZELElBQUksT0FBTyxRQUFRLEtBQUssUUFBUSxFQUFFO3dCQUNoQyxNQUFNLDBDQUE0QixDQUM5QixzQkFBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxRQUFRLEVBQzNDLE1BQUksU0FBUyxDQUFDLElBQUksaURBQThDLENBQUMsQ0FBQztxQkFDdkU7b0JBQ0QsT0FBTyxDQUFDLFNBQVMsQ0FBQyxHQUFHLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxTQUFTLENBQUMsQ0FBQztpQkFDNUQ7cUJBQU07b0JBQ0wsc0JBQXNCO29CQUN0QixNQUFNLElBQUksa0NBQW9CLENBQzFCLHVCQUFTLENBQUMscUJBQXFCLEVBQUUsc0JBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLEVBQ2xFLE1BQUksU0FBUyxDQUFDLElBQUksNENBQ2QsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLGlCQUFjLENBQUMsQ0FBQztpQkFDOUM7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUNILE9BQU8sT0FBTyxDQUFDO1FBQ2pCLENBQUMsRUFBRSxFQUFrRCxDQUFDLENBQUM7SUFDekQsQ0FBQztJQUVELFNBQVMsWUFBWSxDQUFDLFVBQWtCLEVBQUUsWUFBb0I7UUFDNUQsT0FBTyxDQUFDLFVBQVUsRUFBRSxZQUFZLENBQUMsQ0FBQztJQUNwQyxDQUFDO0lBRUQsU0FBUyxhQUFhLENBQUMsVUFBa0IsRUFBRSxZQUFvQjtRQUM3RCxPQUFPLFVBQVUsQ0FBQztJQUNwQixDQUFDO0lBRUQsU0FBZ0IsaUJBQWlCLENBQzdCLE1BQXdELEVBQUUsU0FBeUIsRUFDbkYsU0FBMkI7UUFDN0IsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDLFVBQUMsRUFBb0I7Z0JBQW5CLE1BQU0sWUFBQSxFQUFFLFVBQVUsZ0JBQUE7WUFDcEMsSUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2hDLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLElBQUksc0JBQVMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFOUQsMkZBQTJGO1lBQzNGLElBQUksTUFBTSxDQUFDLFVBQVcsQ0FBQyxJQUFJLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsSUFBSSxLQUFLLE9BQU8sRUFBbEIsQ0FBa0IsQ0FBQyxFQUFFO2dCQUNwRCxNQUFNLElBQUksa0NBQW9CLENBQzFCLHVCQUFTLENBQUMsbUJBQW1CLEVBQUUsSUFBSSxFQUNuQyx3REFBd0QsQ0FBQyxDQUFDO2FBQy9EO1lBQ0QsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDM0IsTUFBTSxJQUFJLGtDQUFvQixDQUMxQix1QkFBUyxDQUFDLG1CQUFtQixFQUFFLElBQUksRUFDbkMsZ0VBQWdFLENBQUMsQ0FBQzthQUN2RTtpQkFBTSxJQUFJLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDLEVBQUU7Z0JBQ3hDLE1BQU0sSUFBSSxrQ0FBb0IsQ0FDMUIsdUJBQVMsQ0FBQyxvQkFBb0IsRUFBRSxJQUFJLEVBQ3BDLG1EQUFtRCxDQUFDLENBQUM7YUFDMUQ7WUFDRCxPQUFPLG9CQUFvQixDQUN2QixJQUFJLEVBQUUsU0FBUyxDQUFDLElBQUksRUFBRSxTQUFTLENBQUMsSUFBSSxJQUFJLEVBQUUsRUFBRSxNQUFNLENBQUMsSUFBSSxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsQ0FBQztRQUNyRixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUF6QkQsOENBeUJDO0lBRUQsU0FBUyxvQkFBb0IsQ0FBQyxNQUFtQjtRQUMvQyxPQUFPLE1BQU0sQ0FBQyxJQUFJLEtBQUssNEJBQWUsQ0FBQyxNQUFNLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyw0QkFBZSxDQUFDLE1BQU07WUFDbkYsTUFBTSxDQUFDLElBQUksS0FBSyw0QkFBZSxDQUFDLFFBQVEsQ0FBQztJQUMvQyxDQUFDO0lBTUQsU0FBUyw4QkFBOEIsQ0FDbkMsUUFBdUIsRUFBRSxTQUEyQjtRQUN0RCxJQUFNLFdBQVcsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2pELElBQUksQ0FBQyxDQUFDLFdBQVcsWUFBWSxHQUFHLENBQUMsRUFBRTtZQUNqQyxNQUFNLDBDQUE0QixDQUM5QixRQUFRLEVBQUUsV0FBVyxFQUFFLDJDQUEyQyxDQUFDLENBQUM7U0FDekU7UUFDRCxJQUFNLFlBQVksR0FBaUMsRUFBRSxDQUFDO1FBQ3RELFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBQyxLQUFLLEVBQUUsR0FBRztZQUM3QixtREFBbUQ7WUFDbkQsSUFBSSxLQUFLLFlBQVksNkJBQVMsRUFBRTtnQkFDOUIsS0FBSyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7YUFDeEI7WUFFRCxJQUFJLE9BQU8sR0FBRyxLQUFLLFFBQVEsRUFBRTtnQkFDM0IsTUFBTSwwQ0FBNEIsQ0FDOUIsUUFBUSxFQUFFLEdBQUcsRUFDYixzRkFBc0YsQ0FBQyxDQUFDO2FBQzdGO1lBRUQsSUFBSSxPQUFPLEtBQUssSUFBSSxRQUFRLEVBQUU7Z0JBQzVCLFlBQVksQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUM7YUFDM0I7aUJBQU0sSUFBSSxLQUFLLFlBQVksZ0NBQVksRUFBRTtnQkFDeEMsWUFBWSxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksMEJBQWUsQ0FBQyxLQUFLLENBQUMsSUFBcUIsQ0FBQyxDQUFDO2FBQ3RFO2lCQUFNO2dCQUNMLE1BQU0sMENBQTRCLENBQzlCLFFBQVEsRUFBRSxLQUFLLEVBQ2Ysd0ZBQXdGLENBQUMsQ0FBQzthQUMvRjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBTSxRQUFRLEdBQUcsNEJBQWlCLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFakQsSUFBTSxNQUFNLEdBQUcsNkJBQWtCLENBQUMsUUFBUSxFQUFFLHVCQUFnQixDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDeEUsSUFBSSxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNyQixNQUFNLElBQUksa0NBQW9CO1lBQzFCLGtGQUFrRjtZQUNsRix1REFBdUQ7WUFDdkQsdUJBQVMsQ0FBQyx3QkFBd0IsRUFBRSxRQUFRLEVBQzVDLE1BQU0sQ0FBQyxHQUFHLENBQUMsVUFBQyxLQUFpQixJQUFLLE9BQUEsS0FBSyxDQUFDLEdBQUcsRUFBVCxDQUFTLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUM5RDtRQUVELE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUFFRCxTQUFnQixtQkFBbUIsQ0FDL0IsT0FBc0IsRUFBRSxTQUEyQixFQUFFLFVBQTRCLEVBQ2pGLFFBQXFDO1FBQ3ZDLElBQUksUUFBNEIsQ0FBQztRQUNqQyxJQUFJLFFBQVEsSUFBSSxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxFQUFFO1lBQ3BDLFFBQVEsR0FBRyw4QkFBOEIsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBRSxFQUFFLFNBQVMsQ0FBQyxDQUFDO1NBQzdFO2FBQU07WUFDTCxRQUFRLEdBQUcsNEJBQWlCLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDbEM7UUFFRCx5Q0FBNEIsQ0FBQyxPQUFPLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQzthQUMzRCxPQUFPLENBQUMsVUFBQyxFQUFvQjtnQkFBbkIsTUFBTSxZQUFBLEVBQUUsVUFBVSxnQkFBQTtZQUMzQixVQUFVLENBQUMsT0FBTyxDQUFDLFVBQUEsU0FBUztnQkFDMUIsSUFBSSxnQkFBZ0IsR0FBVyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUMzQyxJQUFJLFNBQVMsQ0FBQyxJQUFJLEtBQUssSUFBSSxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtvQkFDeEQsSUFBSSxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7d0JBQy9CLE1BQU0sSUFBSSxrQ0FBb0IsQ0FDMUIsdUJBQVMsQ0FBQyxxQkFBcUIsRUFBRSxzQkFBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFDbEUscURBQ0ksU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLGlCQUFjLENBQUMsQ0FBQztxQkFDOUM7b0JBRUQsSUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ3ZELElBQUksT0FBTyxRQUFRLEtBQUssUUFBUSxFQUFFO3dCQUNoQyxNQUFNLDBDQUE0QixDQUM5QixzQkFBUyxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBRSxRQUFRLEVBQzNDLDBDQUEwQyxDQUFDLENBQUM7cUJBQ2pEO29CQUVELGdCQUFnQixHQUFHLFFBQVEsQ0FBQztpQkFDN0I7Z0JBRUQsUUFBUSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUM7WUFDdEQsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUVQLHlDQUE0QixDQUFDLE9BQU8sRUFBRSxjQUFjLEVBQUUsVUFBVSxDQUFDO2FBQzVELE9BQU8sQ0FBQyxVQUFDLEVBQW9CO2dCQUFuQixNQUFNLFlBQUEsRUFBRSxVQUFVLGdCQUFBO1lBQzNCLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQSxTQUFTO2dCQUMxQixJQUFJLFNBQVMsR0FBVyxNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUNwQyxJQUFJLElBQUksR0FBYSxFQUFFLENBQUM7Z0JBQ3hCLElBQUksU0FBUyxDQUFDLElBQUksS0FBSyxJQUFJLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO29CQUN4RCxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTt3QkFDN0IsTUFBTSxJQUFJLGtDQUFvQixDQUMxQix1QkFBUyxDQUFDLHFCQUFxQixFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQ2xELDhDQUE4QyxDQUFDLENBQUM7cUJBQ3JEO29CQUVELElBQU0sUUFBUSxHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO29CQUN2RCxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRTt3QkFDaEMsTUFBTSwwQ0FBNEIsQ0FDOUIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLEVBQzNCLHNEQUFzRCxDQUFDLENBQUM7cUJBQzdEO29CQUVELFNBQVMsR0FBRyxRQUFRLENBQUM7b0JBRXJCLElBQUksU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO3dCQUMvQixJQUFNLFVBQVUsR0FBRyxTQUFTLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDO3dCQUNyQyxJQUFNLFlBQVksR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQzt3QkFDM0QsSUFBSSxDQUFDLGtCQUFrQixDQUFDLFlBQVksRUFBRSxvQkFBb0IsRUFBRSxVQUFVLENBQUMsRUFBRTs0QkFDdkUsTUFBTSwwQ0FBNEIsQ0FDOUIsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxZQUFZLEVBQy9CLHdEQUF3RCxDQUFDLENBQUM7eUJBQy9EO3dCQUNELElBQUksR0FBRyxZQUFZLENBQUM7cUJBQ3JCO2lCQUNGO2dCQUVELFFBQVEsQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQU0sTUFBTSxDQUFDLElBQUksU0FBSSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFHLENBQUM7WUFDdEUsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztRQUNQLE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUF6RUQsa0RBeUVDO0lBRUQsSUFBTSxXQUFXLEdBQUcsSUFBSSxHQUFHLENBQUM7UUFDMUIsY0FBYztRQUNkLGlCQUFpQjtRQUNqQixXQUFXO1FBQ1gsY0FBYztLQUNmLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge2NvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEsIENvbnN0YW50UG9vbCwgRXhwcmVzc2lvbiwgSWRlbnRpZmllcnMsIG1ha2VCaW5kaW5nUGFyc2VyLCBQYXJzZWRIb3N0QmluZGluZ3MsIFBhcnNlRXJyb3IsIHBhcnNlSG9zdEJpbmRpbmdzLCBSM0RlcGVuZGVuY3lNZXRhZGF0YSwgUjNEaXJlY3RpdmVNZXRhZGF0YSwgUjNGYWN0b3J5VGFyZ2V0LCBSM1F1ZXJ5TWV0YWRhdGEsIFN0YXRlbWVudCwgdmVyaWZ5SG9zdEJpbmRpbmdzLCBXcmFwcGVkTm9kZUV4cHJ9IGZyb20gJ0Bhbmd1bGFyL2NvbXBpbGVyJztcbmltcG9ydCAqIGFzIHRzIGZyb20gJ3R5cGVzY3JpcHQnO1xuXG5pbXBvcnQge0Vycm9yQ29kZSwgRmF0YWxEaWFnbm9zdGljRXJyb3J9IGZyb20gJy4uLy4uL2RpYWdub3N0aWNzJztcbmltcG9ydCB7RGVmYXVsdEltcG9ydFJlY29yZGVyLCBSZWZlcmVuY2V9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtDbGFzc1Byb3BlcnR5TWFwcGluZywgRGlyZWN0aXZlVHlwZUNoZWNrTWV0YSwgSW5qZWN0YWJsZUNsYXNzUmVnaXN0cnksIE1ldGFkYXRhUmVhZGVyLCBNZXRhZGF0YVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi9tZXRhZGF0YSc7XG5pbXBvcnQge2V4dHJhY3REaXJlY3RpdmVUeXBlQ2hlY2tNZXRhfSBmcm9tICcuLi8uLi9tZXRhZGF0YS9zcmMvdXRpbCc7XG5pbXBvcnQge0R5bmFtaWNWYWx1ZSwgRW51bVZhbHVlLCBQYXJ0aWFsRXZhbHVhdG9yfSBmcm9tICcuLi8uLi9wYXJ0aWFsX2V2YWx1YXRvcic7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb24sIENsYXNzTWVtYmVyLCBDbGFzc01lbWJlcktpbmQsIERlY29yYXRvciwgZmlsdGVyVG9NZW1iZXJzV2l0aERlY29yYXRvciwgUmVmbGVjdGlvbkhvc3QsIHJlZmxlY3RPYmplY3RMaXRlcmFsfSBmcm9tICcuLi8uLi9yZWZsZWN0aW9uJztcbmltcG9ydCB7TG9jYWxNb2R1bGVTY29wZVJlZ2lzdHJ5fSBmcm9tICcuLi8uLi9zY29wZSc7XG5pbXBvcnQge0FuYWx5c2lzT3V0cHV0LCBDb21waWxlUmVzdWx0LCBEZWNvcmF0b3JIYW5kbGVyLCBEZXRlY3RSZXN1bHQsIEhhbmRsZXJGbGFncywgSGFuZGxlclByZWNlZGVuY2UsIFJlc29sdmVSZXN1bHR9IGZyb20gJy4uLy4uL3RyYW5zZm9ybSc7XG5cbmltcG9ydCB7Y3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvciwgZ2V0RGlyZWN0aXZlRGlhZ25vc3RpY3MsIGdldFByb3ZpZGVyRGlhZ25vc3RpY3MsIGdldFVuZGVjb3JhdGVkQ2xhc3NXaXRoQW5ndWxhckZlYXR1cmVzRGlhZ25vc3RpY30gZnJvbSAnLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge2NvbXBpbGVOZ0ZhY3RvcnlEZWZGaWVsZH0gZnJvbSAnLi9mYWN0b3J5JztcbmltcG9ydCB7Z2VuZXJhdGVTZXRDbGFzc01ldGFkYXRhQ2FsbH0gZnJvbSAnLi9tZXRhZGF0YSc7XG5pbXBvcnQge2NyZWF0ZVNvdXJjZVNwYW4sIGZpbmRBbmd1bGFyRGVjb3JhdG9yLCBnZXRDb25zdHJ1Y3RvckRlcGVuZGVuY2llcywgaXNBbmd1bGFyRGVjb3JhdG9yLCByZWFkQmFzZUNsYXNzLCByZXNvbHZlUHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeSwgdW53cmFwQ29uc3RydWN0b3JEZXBlbmRlbmNpZXMsIHVud3JhcEV4cHJlc3Npb24sIHVud3JhcEZvcndhcmRSZWYsIHZhbGlkYXRlQ29uc3RydWN0b3JEZXBlbmRlbmNpZXMsIHdyYXBGdW5jdGlvbkV4cHJlc3Npb25zSW5QYXJlbnMsIHdyYXBUeXBlUmVmZXJlbmNlfSBmcm9tICcuL3V0aWwnO1xuXG5jb25zdCBFTVBUWV9PQkpFQ1Q6IHtba2V5OiBzdHJpbmddOiBzdHJpbmd9ID0ge307XG5jb25zdCBGSUVMRF9ERUNPUkFUT1JTID0gW1xuICAnSW5wdXQnLCAnT3V0cHV0JywgJ1ZpZXdDaGlsZCcsICdWaWV3Q2hpbGRyZW4nLCAnQ29udGVudENoaWxkJywgJ0NvbnRlbnRDaGlsZHJlbicsICdIb3N0QmluZGluZycsXG4gICdIb3N0TGlzdGVuZXInXG5dO1xuY29uc3QgTElGRUNZQ0xFX0hPT0tTID0gbmV3IFNldChbXG4gICduZ09uQ2hhbmdlcycsICduZ09uSW5pdCcsICduZ09uRGVzdHJveScsICduZ0RvQ2hlY2snLCAnbmdBZnRlclZpZXdJbml0JywgJ25nQWZ0ZXJWaWV3Q2hlY2tlZCcsXG4gICduZ0FmdGVyQ29udGVudEluaXQnLCAnbmdBZnRlckNvbnRlbnRDaGVja2VkJ1xuXSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlyZWN0aXZlSGFuZGxlckRhdGEge1xuICBiYXNlQ2xhc3M6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPnwnZHluYW1pYyd8bnVsbDtcbiAgdHlwZUNoZWNrTWV0YTogRGlyZWN0aXZlVHlwZUNoZWNrTWV0YTtcbiAgbWV0YTogUjNEaXJlY3RpdmVNZXRhZGF0YTtcbiAgbWV0YWRhdGFTdG10OiBTdGF0ZW1lbnR8bnVsbDtcbiAgcHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeTogU2V0PFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPj58bnVsbDtcbiAgaW5wdXRzOiBDbGFzc1Byb3BlcnR5TWFwcGluZztcbiAgb3V0cHV0czogQ2xhc3NQcm9wZXJ0eU1hcHBpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBEaXJlY3RpdmVEZWNvcmF0b3JIYW5kbGVyIGltcGxlbWVudHNcbiAgICBEZWNvcmF0b3JIYW5kbGVyPERlY29yYXRvcnxudWxsLCBEaXJlY3RpdmVIYW5kbGVyRGF0YSwgdW5rbm93bj4ge1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgcmVmbGVjdG9yOiBSZWZsZWN0aW9uSG9zdCwgcHJpdmF0ZSBldmFsdWF0b3I6IFBhcnRpYWxFdmFsdWF0b3IsXG4gICAgICBwcml2YXRlIG1ldGFSZWdpc3RyeTogTWV0YWRhdGFSZWdpc3RyeSwgcHJpdmF0ZSBzY29wZVJlZ2lzdHJ5OiBMb2NhbE1vZHVsZVNjb3BlUmVnaXN0cnksXG4gICAgICBwcml2YXRlIG1ldGFSZWFkZXI6IE1ldGFkYXRhUmVhZGVyLCBwcml2YXRlIGRlZmF1bHRJbXBvcnRSZWNvcmRlcjogRGVmYXVsdEltcG9ydFJlY29yZGVyLFxuICAgICAgcHJpdmF0ZSBpbmplY3RhYmxlUmVnaXN0cnk6IEluamVjdGFibGVDbGFzc1JlZ2lzdHJ5LCBwcml2YXRlIGlzQ29yZTogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXI6IGJvb2xlYW4sXG4gICAgICBwcml2YXRlIGNvbXBpbGVVbmRlY29yYXRlZENsYXNzZXNXaXRoQW5ndWxhckZlYXR1cmVzOiBib29sZWFuKSB7fVxuXG4gIHJlYWRvbmx5IHByZWNlZGVuY2UgPSBIYW5kbGVyUHJlY2VkZW5jZS5QUklNQVJZO1xuICByZWFkb25seSBuYW1lID0gRGlyZWN0aXZlRGVjb3JhdG9ySGFuZGxlci5uYW1lO1xuXG4gIGRldGVjdChub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBkZWNvcmF0b3JzOiBEZWNvcmF0b3JbXXxudWxsKTpcbiAgICAgIERldGVjdFJlc3VsdDxEZWNvcmF0b3J8bnVsbD58dW5kZWZpbmVkIHtcbiAgICAvLyBJZiBhIGNsYXNzIGlzIHVuZGVjb3JhdGVkIGJ1dCB1c2VzIEFuZ3VsYXIgZmVhdHVyZXMsIHdlIGRldGVjdCBpdCBhcyBhblxuICAgIC8vIGFic3RyYWN0IGRpcmVjdGl2ZS4gVGhpcyBpcyBhbiB1bnN1cHBvcnRlZCBwYXR0ZXJuIGFzIG9mIHYxMCwgYnV0IHdlIHdhbnRcbiAgICAvLyB0byBzdGlsbCBkZXRlY3QgdGhlc2UgcGF0dGVybnMgc28gdGhhdCB3ZSBjYW4gcmVwb3J0IGRpYWdub3N0aWNzLCBvciBjb21waWxlXG4gICAgLy8gdGhlbSBmb3IgYmFja3dhcmRzIGNvbXBhdGliaWxpdHkgaW4gbmdjYy5cbiAgICBpZiAoIWRlY29yYXRvcnMpIHtcbiAgICAgIGNvbnN0IGFuZ3VsYXJGaWVsZCA9IHRoaXMuZmluZENsYXNzRmllbGRXaXRoQW5ndWxhckZlYXR1cmVzKG5vZGUpO1xuICAgICAgcmV0dXJuIGFuZ3VsYXJGaWVsZCA/IHt0cmlnZ2VyOiBhbmd1bGFyRmllbGQubm9kZSwgZGVjb3JhdG9yOiBudWxsLCBtZXRhZGF0YTogbnVsbH0gOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHVuZGVmaW5lZDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZGVjb3JhdG9yID0gZmluZEFuZ3VsYXJEZWNvcmF0b3IoZGVjb3JhdG9ycywgJ0RpcmVjdGl2ZScsIHRoaXMuaXNDb3JlKTtcbiAgICAgIHJldHVybiBkZWNvcmF0b3IgPyB7dHJpZ2dlcjogZGVjb3JhdG9yLm5vZGUsIGRlY29yYXRvciwgbWV0YWRhdGE6IGRlY29yYXRvcn0gOiB1bmRlZmluZWQ7XG4gICAgfVxuICB9XG5cbiAgYW5hbHl6ZShub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBkZWNvcmF0b3I6IFJlYWRvbmx5PERlY29yYXRvcnxudWxsPiwgZmxhZ3MgPSBIYW5kbGVyRmxhZ3MuTk9ORSk6XG4gICAgICBBbmFseXNpc091dHB1dDxEaXJlY3RpdmVIYW5kbGVyRGF0YT4ge1xuICAgIC8vIFNraXAgcHJvY2Vzc2luZyBvZiB0aGUgY2xhc3MgZGVjbGFyYXRpb24gaWYgY29tcGlsYXRpb24gb2YgdW5kZWNvcmF0ZWQgY2xhc3Nlc1xuICAgIC8vIHdpdGggQW5ndWxhciBmZWF0dXJlcyBpcyBkaXNhYmxlZC4gUHJldmlvdXNseSBpbiBuZ3RzYywgc3VjaCBjbGFzc2VzIGhhdmUgYWx3YXlzXG4gICAgLy8gYmVlbiBwcm9jZXNzZWQsIGJ1dCB3ZSB3YW50IHRvIGVuZm9yY2UgYSBjb25zaXN0ZW50IGRlY29yYXRvciBtZW50YWwgbW9kZWwuXG4gICAgLy8gU2VlOiBodHRwczovL3Y5LmFuZ3VsYXIuaW8vZ3VpZGUvbWlncmF0aW9uLXVuZGVjb3JhdGVkLWNsYXNzZXMuXG4gICAgaWYgKHRoaXMuY29tcGlsZVVuZGVjb3JhdGVkQ2xhc3Nlc1dpdGhBbmd1bGFyRmVhdHVyZXMgPT09IGZhbHNlICYmIGRlY29yYXRvciA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHtkaWFnbm9zdGljczogW2dldFVuZGVjb3JhdGVkQ2xhc3NXaXRoQW5ndWxhckZlYXR1cmVzRGlhZ25vc3RpYyhub2RlKV19O1xuICAgIH1cblxuICAgIGNvbnN0IGRpcmVjdGl2ZVJlc3VsdCA9IGV4dHJhY3REaXJlY3RpdmVNZXRhZGF0YShcbiAgICAgICAgbm9kZSwgZGVjb3JhdG9yLCB0aGlzLnJlZmxlY3RvciwgdGhpcy5ldmFsdWF0b3IsIHRoaXMuZGVmYXVsdEltcG9ydFJlY29yZGVyLCB0aGlzLmlzQ29yZSxcbiAgICAgICAgZmxhZ3MsIHRoaXMuYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXIpO1xuICAgIGlmIChkaXJlY3RpdmVSZXN1bHQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIHt9O1xuICAgIH1cbiAgICBjb25zdCBhbmFseXNpcyA9IGRpcmVjdGl2ZVJlc3VsdC5tZXRhZGF0YTtcblxuICAgIGxldCBwcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5OiBTZXQ8UmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+PnxudWxsID0gbnVsbDtcbiAgICBpZiAoZGlyZWN0aXZlUmVzdWx0ICE9PSB1bmRlZmluZWQgJiYgZGlyZWN0aXZlUmVzdWx0LmRlY29yYXRvci5oYXMoJ3Byb3ZpZGVycycpKSB7XG4gICAgICBwcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5ID0gcmVzb2x2ZVByb3ZpZGVyc1JlcXVpcmluZ0ZhY3RvcnkoXG4gICAgICAgICAgZGlyZWN0aXZlUmVzdWx0LmRlY29yYXRvci5nZXQoJ3Byb3ZpZGVycycpISwgdGhpcy5yZWZsZWN0b3IsIHRoaXMuZXZhbHVhdG9yKTtcbiAgICB9XG5cbiAgICByZXR1cm4ge1xuICAgICAgYW5hbHlzaXM6IHtcbiAgICAgICAgaW5wdXRzOiBkaXJlY3RpdmVSZXN1bHQuaW5wdXRzLFxuICAgICAgICBvdXRwdXRzOiBkaXJlY3RpdmVSZXN1bHQub3V0cHV0cyxcbiAgICAgICAgbWV0YTogYW5hbHlzaXMsXG4gICAgICAgIG1ldGFkYXRhU3RtdDogZ2VuZXJhdGVTZXRDbGFzc01ldGFkYXRhQ2FsbChcbiAgICAgICAgICAgIG5vZGUsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmRlZmF1bHRJbXBvcnRSZWNvcmRlciwgdGhpcy5pc0NvcmUsXG4gICAgICAgICAgICB0aGlzLmFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyKSxcbiAgICAgICAgYmFzZUNsYXNzOiByZWFkQmFzZUNsYXNzKG5vZGUsIHRoaXMucmVmbGVjdG9yLCB0aGlzLmV2YWx1YXRvciksXG4gICAgICAgIHR5cGVDaGVja01ldGE6IGV4dHJhY3REaXJlY3RpdmVUeXBlQ2hlY2tNZXRhKG5vZGUsIGRpcmVjdGl2ZVJlc3VsdC5pbnB1dHMsIHRoaXMucmVmbGVjdG9yKSxcbiAgICAgICAgcHJvdmlkZXJzUmVxdWlyaW5nRmFjdG9yeVxuICAgICAgfVxuICAgIH07XG4gIH1cblxuICByZWdpc3Rlcihub2RlOiBDbGFzc0RlY2xhcmF0aW9uLCBhbmFseXNpczogUmVhZG9ubHk8RGlyZWN0aXZlSGFuZGxlckRhdGE+KTogdm9pZCB7XG4gICAgLy8gUmVnaXN0ZXIgdGhpcyBkaXJlY3RpdmUncyBpbmZvcm1hdGlvbiB3aXRoIHRoZSBgTWV0YWRhdGFSZWdpc3RyeWAuIFRoaXMgZW5zdXJlcyB0aGF0XG4gICAgLy8gdGhlIGluZm9ybWF0aW9uIGFib3V0IHRoZSBkaXJlY3RpdmUgaXMgYXZhaWxhYmxlIGR1cmluZyB0aGUgY29tcGlsZSgpIHBoYXNlLlxuICAgIGNvbnN0IHJlZiA9IG5ldyBSZWZlcmVuY2Uobm9kZSk7XG4gICAgdGhpcy5tZXRhUmVnaXN0cnkucmVnaXN0ZXJEaXJlY3RpdmVNZXRhZGF0YSh7XG4gICAgICByZWYsXG4gICAgICBuYW1lOiBub2RlLm5hbWUudGV4dCxcbiAgICAgIHNlbGVjdG9yOiBhbmFseXNpcy5tZXRhLnNlbGVjdG9yLFxuICAgICAgZXhwb3J0QXM6IGFuYWx5c2lzLm1ldGEuZXhwb3J0QXMsXG4gICAgICBpbnB1dHM6IGFuYWx5c2lzLmlucHV0cyxcbiAgICAgIG91dHB1dHM6IGFuYWx5c2lzLm91dHB1dHMsXG4gICAgICBxdWVyaWVzOiBhbmFseXNpcy5tZXRhLnF1ZXJpZXMubWFwKHF1ZXJ5ID0+IHF1ZXJ5LnByb3BlcnR5TmFtZSksXG4gICAgICBpc0NvbXBvbmVudDogZmFsc2UsXG4gICAgICBiYXNlQ2xhc3M6IGFuYWx5c2lzLmJhc2VDbGFzcyxcbiAgICAgIC4uLmFuYWx5c2lzLnR5cGVDaGVja01ldGEsXG4gICAgfSk7XG5cbiAgICB0aGlzLmluamVjdGFibGVSZWdpc3RyeS5yZWdpc3RlckluamVjdGFibGUobm9kZSk7XG4gIH1cblxuICByZXNvbHZlKG5vZGU6IENsYXNzRGVjbGFyYXRpb24sIGFuYWx5c2lzOiBEaXJlY3RpdmVIYW5kbGVyRGF0YSk6IFJlc29sdmVSZXN1bHQ8dW5rbm93bj4ge1xuICAgIGNvbnN0IGRpYWdub3N0aWNzOiB0cy5EaWFnbm9zdGljW10gPSBbXTtcblxuICAgIGlmIChhbmFseXNpcy5wcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5ICE9PSBudWxsICYmXG4gICAgICAgIGFuYWx5c2lzLm1ldGEucHJvdmlkZXJzIGluc3RhbmNlb2YgV3JhcHBlZE5vZGVFeHByKSB7XG4gICAgICBjb25zdCBwcm92aWRlckRpYWdub3N0aWNzID0gZ2V0UHJvdmlkZXJEaWFnbm9zdGljcyhcbiAgICAgICAgICBhbmFseXNpcy5wcm92aWRlcnNSZXF1aXJpbmdGYWN0b3J5LCBhbmFseXNpcy5tZXRhLnByb3ZpZGVycyEubm9kZSxcbiAgICAgICAgICB0aGlzLmluamVjdGFibGVSZWdpc3RyeSk7XG4gICAgICBkaWFnbm9zdGljcy5wdXNoKC4uLnByb3ZpZGVyRGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIGNvbnN0IGRpcmVjdGl2ZURpYWdub3N0aWNzID0gZ2V0RGlyZWN0aXZlRGlhZ25vc3RpY3MoXG4gICAgICAgIG5vZGUsIHRoaXMubWV0YVJlYWRlciwgdGhpcy5ldmFsdWF0b3IsIHRoaXMucmVmbGVjdG9yLCB0aGlzLnNjb3BlUmVnaXN0cnksICdEaXJlY3RpdmUnKTtcbiAgICBpZiAoZGlyZWN0aXZlRGlhZ25vc3RpY3MgIT09IG51bGwpIHtcbiAgICAgIGRpYWdub3N0aWNzLnB1c2goLi4uZGlyZWN0aXZlRGlhZ25vc3RpY3MpO1xuICAgIH1cblxuICAgIHJldHVybiB7ZGlhZ25vc3RpY3M6IGRpYWdub3N0aWNzLmxlbmd0aCA+IDAgPyBkaWFnbm9zdGljcyA6IHVuZGVmaW5lZH07XG4gIH1cblxuICBjb21waWxlKFxuICAgICAgbm9kZTogQ2xhc3NEZWNsYXJhdGlvbiwgYW5hbHlzaXM6IFJlYWRvbmx5PERpcmVjdGl2ZUhhbmRsZXJEYXRhPixcbiAgICAgIHJlc29sdXRpb246IFJlYWRvbmx5PHVua25vd24+LCBwb29sOiBDb25zdGFudFBvb2wpOiBDb21waWxlUmVzdWx0W10ge1xuICAgIGNvbnN0IG1ldGEgPSBhbmFseXNpcy5tZXRhO1xuICAgIGNvbnN0IHJlcyA9IGNvbXBpbGVEaXJlY3RpdmVGcm9tTWV0YWRhdGEobWV0YSwgcG9vbCwgbWFrZUJpbmRpbmdQYXJzZXIoKSk7XG4gICAgY29uc3QgZmFjdG9yeVJlcyA9IGNvbXBpbGVOZ0ZhY3RvcnlEZWZGaWVsZChcbiAgICAgICAgey4uLm1ldGEsIGluamVjdEZuOiBJZGVudGlmaWVycy5kaXJlY3RpdmVJbmplY3QsIHRhcmdldDogUjNGYWN0b3J5VGFyZ2V0LkRpcmVjdGl2ZX0pO1xuICAgIGlmIChhbmFseXNpcy5tZXRhZGF0YVN0bXQgIT09IG51bGwpIHtcbiAgICAgIGZhY3RvcnlSZXMuc3RhdGVtZW50cy5wdXNoKGFuYWx5c2lzLm1ldGFkYXRhU3RtdCk7XG4gICAgfVxuICAgIHJldHVybiBbXG4gICAgICBmYWN0b3J5UmVzLCB7XG4gICAgICAgIG5hbWU6ICfJtWRpcicsXG4gICAgICAgIGluaXRpYWxpemVyOiByZXMuZXhwcmVzc2lvbixcbiAgICAgICAgc3RhdGVtZW50czogW10sXG4gICAgICAgIHR5cGU6IHJlcy50eXBlLFxuICAgICAgfVxuICAgIF07XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGlmIGEgZ2l2ZW4gY2xhc3MgdXNlcyBBbmd1bGFyIGZlYXR1cmVzIGFuZCByZXR1cm5zIHRoZSBUeXBlU2NyaXB0IG5vZGVcbiAgICogdGhhdCBpbmRpY2F0ZWQgdGhlIHVzYWdlLiBDbGFzc2VzIGFyZSBjb25zaWRlcmVkIHVzaW5nIEFuZ3VsYXIgZmVhdHVyZXMgaWYgdGhleVxuICAgKiBjb250YWluIGNsYXNzIG1lbWJlcnMgdGhhdCBhcmUgZWl0aGVyIGRlY29yYXRlZCB3aXRoIGEga25vd24gQW5ndWxhciBkZWNvcmF0b3IsXG4gICAqIG9yIGlmIHRoZXkgY29ycmVzcG9uZCB0byBhIGtub3duIEFuZ3VsYXIgbGlmZWN5Y2xlIGhvb2suXG4gICAqL1xuICBwcml2YXRlIGZpbmRDbGFzc0ZpZWxkV2l0aEFuZ3VsYXJGZWF0dXJlcyhub2RlOiBDbGFzc0RlY2xhcmF0aW9uKTogQ2xhc3NNZW1iZXJ8dW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5yZWZsZWN0b3IuZ2V0TWVtYmVyc09mQ2xhc3Mobm9kZSkuZmluZChtZW1iZXIgPT4ge1xuICAgICAgaWYgKCFtZW1iZXIuaXNTdGF0aWMgJiYgbWVtYmVyLmtpbmQgPT09IENsYXNzTWVtYmVyS2luZC5NZXRob2QgJiZcbiAgICAgICAgICBMSUZFQ1lDTEVfSE9PS1MuaGFzKG1lbWJlci5uYW1lKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmIChtZW1iZXIuZGVjb3JhdG9ycykge1xuICAgICAgICByZXR1cm4gbWVtYmVyLmRlY29yYXRvcnMuc29tZShcbiAgICAgICAgICAgIGRlY29yYXRvciA9PiBGSUVMRF9ERUNPUkFUT1JTLnNvbWUoXG4gICAgICAgICAgICAgICAgZGVjb3JhdG9yTmFtZSA9PiBpc0FuZ3VsYXJEZWNvcmF0b3IoZGVjb3JhdG9yLCBkZWNvcmF0b3JOYW1lLCB0aGlzLmlzQ29yZSkpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIEhlbHBlciBmdW5jdGlvbiB0byBleHRyYWN0IG1ldGFkYXRhIGZyb20gYSBgRGlyZWN0aXZlYCBvciBgQ29tcG9uZW50YC4gYERpcmVjdGl2ZWBzIHdpdGhvdXQgYVxuICogc2VsZWN0b3IgYXJlIGFsbG93ZWQgdG8gYmUgdXNlZCBmb3IgYWJzdHJhY3QgYmFzZSBjbGFzc2VzLiBUaGVzZSBhYnN0cmFjdCBkaXJlY3RpdmVzIHNob3VsZCBub3RcbiAqIGFwcGVhciBpbiB0aGUgZGVjbGFyYXRpb25zIG9mIGFuIGBOZ01vZHVsZWAgYW5kIGFkZGl0aW9uYWwgdmVyaWZpY2F0aW9uIGlzIGRvbmUgd2hlbiBwcm9jZXNzaW5nXG4gKiB0aGUgbW9kdWxlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdERpcmVjdGl2ZU1ldGFkYXRhKFxuICAgIGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uLCBkZWNvcmF0b3I6IFJlYWRvbmx5PERlY29yYXRvcnxudWxsPiwgcmVmbGVjdG9yOiBSZWZsZWN0aW9uSG9zdCxcbiAgICBldmFsdWF0b3I6IFBhcnRpYWxFdmFsdWF0b3IsIGRlZmF1bHRJbXBvcnRSZWNvcmRlcjogRGVmYXVsdEltcG9ydFJlY29yZGVyLCBpc0NvcmU6IGJvb2xlYW4sXG4gICAgZmxhZ3M6IEhhbmRsZXJGbGFncywgYW5ub3RhdGVGb3JDbG9zdXJlQ29tcGlsZXI6IGJvb2xlYW4sXG4gICAgZGVmYXVsdFNlbGVjdG9yOiBzdHJpbmd8bnVsbCA9IG51bGwpOiB7XG4gIGRlY29yYXRvcjogTWFwPHN0cmluZywgdHMuRXhwcmVzc2lvbj4sXG4gIG1ldGFkYXRhOiBSM0RpcmVjdGl2ZU1ldGFkYXRhLFxuICBpbnB1dHM6IENsYXNzUHJvcGVydHlNYXBwaW5nLFxuICBvdXRwdXRzOiBDbGFzc1Byb3BlcnR5TWFwcGluZyxcbn18dW5kZWZpbmVkIHtcbiAgbGV0IGRpcmVjdGl2ZTogTWFwPHN0cmluZywgdHMuRXhwcmVzc2lvbj47XG4gIGlmIChkZWNvcmF0b3IgPT09IG51bGwgfHwgZGVjb3JhdG9yLmFyZ3MgPT09IG51bGwgfHwgZGVjb3JhdG9yLmFyZ3MubGVuZ3RoID09PSAwKSB7XG4gICAgZGlyZWN0aXZlID0gbmV3IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+KCk7XG4gIH0gZWxzZSBpZiAoZGVjb3JhdG9yLmFyZ3MubGVuZ3RoICE9PSAxKSB7XG4gICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX0FSSVRZX1dST05HLCBEZWNvcmF0b3Iubm9kZUZvckVycm9yKGRlY29yYXRvciksXG4gICAgICAgIGBJbmNvcnJlY3QgbnVtYmVyIG9mIGFyZ3VtZW50cyB0byBAJHtkZWNvcmF0b3IubmFtZX0gZGVjb3JhdG9yYCk7XG4gIH0gZWxzZSB7XG4gICAgY29uc3QgbWV0YSA9IHVud3JhcEV4cHJlc3Npb24oZGVjb3JhdG9yLmFyZ3NbMF0pO1xuICAgIGlmICghdHMuaXNPYmplY3RMaXRlcmFsRXhwcmVzc2lvbihtZXRhKSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQVJHX05PVF9MSVRFUkFMLCBtZXRhLFxuICAgICAgICAgIGBAJHtkZWNvcmF0b3IubmFtZX0gYXJndW1lbnQgbXVzdCBiZSBhbiBvYmplY3QgbGl0ZXJhbGApO1xuICAgIH1cbiAgICBkaXJlY3RpdmUgPSByZWZsZWN0T2JqZWN0TGl0ZXJhbChtZXRhKTtcbiAgfVxuXG4gIGlmIChkaXJlY3RpdmUuaGFzKCdqaXQnKSkge1xuICAgIC8vIFRoZSBvbmx5IGFsbG93ZWQgdmFsdWUgaXMgdHJ1ZSwgc28gdGhlcmUncyBubyBuZWVkIHRvIGV4cGFuZCBmdXJ0aGVyLlxuICAgIHJldHVybiB1bmRlZmluZWQ7XG4gIH1cblxuICBjb25zdCBtZW1iZXJzID0gcmVmbGVjdG9yLmdldE1lbWJlcnNPZkNsYXNzKGNsYXp6KTtcblxuICAvLyBQcmVjb21wdXRlIGEgbGlzdCBvZiB0cy5DbGFzc0VsZW1lbnRzIHRoYXQgaGF2ZSBkZWNvcmF0b3JzLiBUaGlzIGluY2x1ZGVzIHRoaW5ncyBsaWtlIEBJbnB1dCxcbiAgLy8gQE91dHB1dCwgQEhvc3RCaW5kaW5nLCBldGMuXG4gIGNvbnN0IGRlY29yYXRlZEVsZW1lbnRzID1cbiAgICAgIG1lbWJlcnMuZmlsdGVyKG1lbWJlciA9PiAhbWVtYmVyLmlzU3RhdGljICYmIG1lbWJlci5kZWNvcmF0b3JzICE9PSBudWxsKTtcblxuICBjb25zdCBjb3JlTW9kdWxlID0gaXNDb3JlID8gdW5kZWZpbmVkIDogJ0Bhbmd1bGFyL2NvcmUnO1xuXG4gIC8vIENvbnN0cnVjdCB0aGUgbWFwIG9mIGlucHV0cyBib3RoIGZyb20gdGhlIEBEaXJlY3RpdmUvQENvbXBvbmVudFxuICAvLyBkZWNvcmF0b3IsIGFuZCB0aGUgZGVjb3JhdGVkXG4gIC8vIGZpZWxkcy5cbiAgY29uc3QgaW5wdXRzRnJvbU1ldGEgPSBwYXJzZUZpZWxkVG9Qcm9wZXJ0eU1hcHBpbmcoZGlyZWN0aXZlLCAnaW5wdXRzJywgZXZhbHVhdG9yKTtcbiAgY29uc3QgaW5wdXRzRnJvbUZpZWxkcyA9IHBhcnNlRGVjb3JhdGVkRmllbGRzKFxuICAgICAgZmlsdGVyVG9NZW1iZXJzV2l0aERlY29yYXRvcihkZWNvcmF0ZWRFbGVtZW50cywgJ0lucHV0JywgY29yZU1vZHVsZSksIGV2YWx1YXRvcixcbiAgICAgIHJlc29sdmVJbnB1dCk7XG5cbiAgLy8gQW5kIG91dHB1dHMuXG4gIGNvbnN0IG91dHB1dHNGcm9tTWV0YSA9IHBhcnNlRmllbGRUb1Byb3BlcnR5TWFwcGluZyhkaXJlY3RpdmUsICdvdXRwdXRzJywgZXZhbHVhdG9yKTtcbiAgY29uc3Qgb3V0cHV0c0Zyb21GaWVsZHMgPVxuICAgICAgcGFyc2VEZWNvcmF0ZWRGaWVsZHMoXG4gICAgICAgICAgZmlsdGVyVG9NZW1iZXJzV2l0aERlY29yYXRvcihkZWNvcmF0ZWRFbGVtZW50cywgJ091dHB1dCcsIGNvcmVNb2R1bGUpLCBldmFsdWF0b3IsXG4gICAgICAgICAgcmVzb2x2ZU91dHB1dCkgYXMge1tmaWVsZDogc3RyaW5nXTogc3RyaW5nfTtcbiAgLy8gQ29uc3RydWN0IHRoZSBsaXN0IG9mIHF1ZXJpZXMuXG4gIGNvbnN0IGNvbnRlbnRDaGlsZEZyb21GaWVsZHMgPSBxdWVyaWVzRnJvbUZpZWxkcyhcbiAgICAgIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IoZGVjb3JhdGVkRWxlbWVudHMsICdDb250ZW50Q2hpbGQnLCBjb3JlTW9kdWxlKSwgcmVmbGVjdG9yLFxuICAgICAgZXZhbHVhdG9yKTtcbiAgY29uc3QgY29udGVudENoaWxkcmVuRnJvbUZpZWxkcyA9IHF1ZXJpZXNGcm9tRmllbGRzKFxuICAgICAgZmlsdGVyVG9NZW1iZXJzV2l0aERlY29yYXRvcihkZWNvcmF0ZWRFbGVtZW50cywgJ0NvbnRlbnRDaGlsZHJlbicsIGNvcmVNb2R1bGUpLCByZWZsZWN0b3IsXG4gICAgICBldmFsdWF0b3IpO1xuXG4gIGNvbnN0IHF1ZXJpZXMgPSBbLi4uY29udGVudENoaWxkRnJvbUZpZWxkcywgLi4uY29udGVudENoaWxkcmVuRnJvbUZpZWxkc107XG5cbiAgLy8gQ29uc3RydWN0IHRoZSBsaXN0IG9mIHZpZXcgcXVlcmllcy5cbiAgY29uc3Qgdmlld0NoaWxkRnJvbUZpZWxkcyA9IHF1ZXJpZXNGcm9tRmllbGRzKFxuICAgICAgZmlsdGVyVG9NZW1iZXJzV2l0aERlY29yYXRvcihkZWNvcmF0ZWRFbGVtZW50cywgJ1ZpZXdDaGlsZCcsIGNvcmVNb2R1bGUpLCByZWZsZWN0b3IsXG4gICAgICBldmFsdWF0b3IpO1xuICBjb25zdCB2aWV3Q2hpbGRyZW5Gcm9tRmllbGRzID0gcXVlcmllc0Zyb21GaWVsZHMoXG4gICAgICBmaWx0ZXJUb01lbWJlcnNXaXRoRGVjb3JhdG9yKGRlY29yYXRlZEVsZW1lbnRzLCAnVmlld0NoaWxkcmVuJywgY29yZU1vZHVsZSksIHJlZmxlY3RvcixcbiAgICAgIGV2YWx1YXRvcik7XG4gIGNvbnN0IHZpZXdRdWVyaWVzID0gWy4uLnZpZXdDaGlsZEZyb21GaWVsZHMsIC4uLnZpZXdDaGlsZHJlbkZyb21GaWVsZHNdO1xuXG4gIGlmIChkaXJlY3RpdmUuaGFzKCdxdWVyaWVzJykpIHtcbiAgICBjb25zdCBxdWVyaWVzRnJvbURlY29yYXRvciA9XG4gICAgICAgIGV4dHJhY3RRdWVyaWVzRnJvbURlY29yYXRvcihkaXJlY3RpdmUuZ2V0KCdxdWVyaWVzJykhLCByZWZsZWN0b3IsIGV2YWx1YXRvciwgaXNDb3JlKTtcbiAgICBxdWVyaWVzLnB1c2goLi4ucXVlcmllc0Zyb21EZWNvcmF0b3IuY29udGVudCk7XG4gICAgdmlld1F1ZXJpZXMucHVzaCguLi5xdWVyaWVzRnJvbURlY29yYXRvci52aWV3KTtcbiAgfVxuXG4gIC8vIFBhcnNlIHRoZSBzZWxlY3Rvci5cbiAgbGV0IHNlbGVjdG9yID0gZGVmYXVsdFNlbGVjdG9yO1xuICBpZiAoZGlyZWN0aXZlLmhhcygnc2VsZWN0b3InKSkge1xuICAgIGNvbnN0IGV4cHIgPSBkaXJlY3RpdmUuZ2V0KCdzZWxlY3RvcicpITtcbiAgICBjb25zdCByZXNvbHZlZCA9IGV2YWx1YXRvci5ldmFsdWF0ZShleHByKTtcbiAgICBpZiAodHlwZW9mIHJlc29sdmVkICE9PSAnc3RyaW5nJykge1xuICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihleHByLCByZXNvbHZlZCwgYHNlbGVjdG9yIG11c3QgYmUgYSBzdHJpbmdgKTtcbiAgICB9XG4gICAgLy8gdXNlIGRlZmF1bHQgc2VsZWN0b3IgaW4gY2FzZSBzZWxlY3RvciBpcyBhbiBlbXB0eSBzdHJpbmdcbiAgICBzZWxlY3RvciA9IHJlc29sdmVkID09PSAnJyA/IGRlZmF1bHRTZWxlY3RvciA6IHJlc29sdmVkO1xuICAgIGlmICghc2VsZWN0b3IpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuRElSRUNUSVZFX01JU1NJTkdfU0VMRUNUT1IsIGV4cHIsXG4gICAgICAgICAgYERpcmVjdGl2ZSAke2NsYXp6Lm5hbWUudGV4dH0gaGFzIG5vIHNlbGVjdG9yLCBwbGVhc2UgYWRkIGl0IWApO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGhvc3QgPSBleHRyYWN0SG9zdEJpbmRpbmdzKGRlY29yYXRlZEVsZW1lbnRzLCBldmFsdWF0b3IsIGNvcmVNb2R1bGUsIGRpcmVjdGl2ZSk7XG5cbiAgY29uc3QgcHJvdmlkZXJzOiBFeHByZXNzaW9ufG51bGwgPSBkaXJlY3RpdmUuaGFzKCdwcm92aWRlcnMnKSA/XG4gICAgICBuZXcgV3JhcHBlZE5vZGVFeHByKFxuICAgICAgICAgIGFubm90YXRlRm9yQ2xvc3VyZUNvbXBpbGVyID9cbiAgICAgICAgICAgICAgd3JhcEZ1bmN0aW9uRXhwcmVzc2lvbnNJblBhcmVucyhkaXJlY3RpdmUuZ2V0KCdwcm92aWRlcnMnKSEpIDpcbiAgICAgICAgICAgICAgZGlyZWN0aXZlLmdldCgncHJvdmlkZXJzJykhKSA6XG4gICAgICBudWxsO1xuXG4gIC8vIERldGVybWluZSBpZiBgbmdPbkNoYW5nZXNgIGlzIGEgbGlmZWN5Y2xlIGhvb2sgZGVmaW5lZCBvbiB0aGUgY29tcG9uZW50LlxuICBjb25zdCB1c2VzT25DaGFuZ2VzID0gbWVtYmVycy5zb21lKFxuICAgICAgbWVtYmVyID0+ICFtZW1iZXIuaXNTdGF0aWMgJiYgbWVtYmVyLmtpbmQgPT09IENsYXNzTWVtYmVyS2luZC5NZXRob2QgJiZcbiAgICAgICAgICBtZW1iZXIubmFtZSA9PT0gJ25nT25DaGFuZ2VzJyk7XG5cbiAgLy8gUGFyc2UgZXhwb3J0QXMuXG4gIGxldCBleHBvcnRBczogc3RyaW5nW118bnVsbCA9IG51bGw7XG4gIGlmIChkaXJlY3RpdmUuaGFzKCdleHBvcnRBcycpKSB7XG4gICAgY29uc3QgZXhwciA9IGRpcmVjdGl2ZS5nZXQoJ2V4cG9ydEFzJykhO1xuICAgIGNvbnN0IHJlc29sdmVkID0gZXZhbHVhdG9yLmV2YWx1YXRlKGV4cHIpO1xuICAgIGlmICh0eXBlb2YgcmVzb2x2ZWQgIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKGV4cHIsIHJlc29sdmVkLCBgZXhwb3J0QXMgbXVzdCBiZSBhIHN0cmluZ2ApO1xuICAgIH1cbiAgICBleHBvcnRBcyA9IHJlc29sdmVkLnNwbGl0KCcsJykubWFwKHBhcnQgPT4gcGFydC50cmltKCkpO1xuICB9XG5cbiAgY29uc3QgcmF3Q3RvckRlcHMgPSBnZXRDb25zdHJ1Y3RvckRlcGVuZGVuY2llcyhjbGF6eiwgcmVmbGVjdG9yLCBkZWZhdWx0SW1wb3J0UmVjb3JkZXIsIGlzQ29yZSk7XG4gIGxldCBjdG9yRGVwczogUjNEZXBlbmRlbmN5TWV0YWRhdGFbXXwnaW52YWxpZCd8bnVsbDtcblxuICAvLyBOb24tYWJzdHJhY3QgZGlyZWN0aXZlcyAodGhvc2Ugd2l0aCBhIHNlbGVjdG9yKSByZXF1aXJlIHZhbGlkIGNvbnN0cnVjdG9yIGRlcGVuZGVuY2llcywgd2hlcmVhc1xuICAvLyBhYnN0cmFjdCBkaXJlY3RpdmVzIGFyZSBhbGxvd2VkIHRvIGhhdmUgaW52YWxpZCBkZXBlbmRlbmNpZXMsIGdpdmVuIHRoYXQgYSBzdWJjbGFzcyBtYXkgY2FsbFxuICAvLyB0aGUgY29uc3RydWN0b3IgZXhwbGljaXRseS5cbiAgaWYgKHNlbGVjdG9yICE9PSBudWxsKSB7XG4gICAgY3RvckRlcHMgPSB2YWxpZGF0ZUNvbnN0cnVjdG9yRGVwZW5kZW5jaWVzKGNsYXp6LCByYXdDdG9yRGVwcyk7XG4gIH0gZWxzZSB7XG4gICAgY3RvckRlcHMgPSB1bndyYXBDb25zdHJ1Y3RvckRlcGVuZGVuY2llcyhyYXdDdG9yRGVwcyk7XG4gIH1cblxuICAvLyBEZXRlY3QgaWYgdGhlIGNvbXBvbmVudCBpbmhlcml0cyBmcm9tIGFub3RoZXIgY2xhc3NcbiAgY29uc3QgdXNlc0luaGVyaXRhbmNlID0gcmVmbGVjdG9yLmhhc0Jhc2VDbGFzcyhjbGF6eik7XG4gIGNvbnN0IHR5cGUgPSB3cmFwVHlwZVJlZmVyZW5jZShyZWZsZWN0b3IsIGNsYXp6KTtcbiAgY29uc3QgaW50ZXJuYWxUeXBlID0gbmV3IFdyYXBwZWROb2RlRXhwcihyZWZsZWN0b3IuZ2V0SW50ZXJuYWxOYW1lT2ZDbGFzcyhjbGF6eikpO1xuXG4gIGNvbnN0IGlucHV0cyA9IENsYXNzUHJvcGVydHlNYXBwaW5nLmZyb21NYXBwZWRPYmplY3Qoey4uLmlucHV0c0Zyb21NZXRhLCAuLi5pbnB1dHNGcm9tRmllbGRzfSk7XG4gIGNvbnN0IG91dHB1dHMgPSBDbGFzc1Byb3BlcnR5TWFwcGluZy5mcm9tTWFwcGVkT2JqZWN0KHsuLi5vdXRwdXRzRnJvbU1ldGEsIC4uLm91dHB1dHNGcm9tRmllbGRzfSk7XG5cbiAgY29uc3QgbWV0YWRhdGE6IFIzRGlyZWN0aXZlTWV0YWRhdGEgPSB7XG4gICAgbmFtZTogY2xhenoubmFtZS50ZXh0LFxuICAgIGRlcHM6IGN0b3JEZXBzLFxuICAgIGhvc3QsXG4gICAgbGlmZWN5Y2xlOiB7XG4gICAgICB1c2VzT25DaGFuZ2VzLFxuICAgIH0sXG4gICAgaW5wdXRzOiBpbnB1dHMudG9Kb2ludE1hcHBlZE9iamVjdCgpLFxuICAgIG91dHB1dHM6IG91dHB1dHMudG9EaXJlY3RNYXBwZWRPYmplY3QoKSxcbiAgICBxdWVyaWVzLFxuICAgIHZpZXdRdWVyaWVzLFxuICAgIHNlbGVjdG9yLFxuICAgIGZ1bGxJbmhlcml0YW5jZTogISEoZmxhZ3MgJiBIYW5kbGVyRmxhZ3MuRlVMTF9JTkhFUklUQU5DRSksXG4gICAgdHlwZSxcbiAgICBpbnRlcm5hbFR5cGUsXG4gICAgdHlwZUFyZ3VtZW50Q291bnQ6IHJlZmxlY3Rvci5nZXRHZW5lcmljQXJpdHlPZkNsYXNzKGNsYXp6KSB8fCAwLFxuICAgIHR5cGVTb3VyY2VTcGFuOiBjcmVhdGVTb3VyY2VTcGFuKGNsYXp6Lm5hbWUpLFxuICAgIHVzZXNJbmhlcml0YW5jZSxcbiAgICBleHBvcnRBcyxcbiAgICBwcm92aWRlcnNcbiAgfTtcbiAgcmV0dXJuIHtcbiAgICBkZWNvcmF0b3I6IGRpcmVjdGl2ZSxcbiAgICBtZXRhZGF0YSxcbiAgICBpbnB1dHMsXG4gICAgb3V0cHV0cyxcbiAgfTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RRdWVyeU1ldGFkYXRhKFxuICAgIGV4cHJOb2RlOiB0cy5Ob2RlLCBuYW1lOiBzdHJpbmcsIGFyZ3M6IFJlYWRvbmx5QXJyYXk8dHMuRXhwcmVzc2lvbj4sIHByb3BlcnR5TmFtZTogc3RyaW5nLFxuICAgIHJlZmxlY3RvcjogUmVmbGVjdGlvbkhvc3QsIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcik6IFIzUXVlcnlNZXRhZGF0YSB7XG4gIGlmIChhcmdzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgRXJyb3JDb2RlLkRFQ09SQVRPUl9BUklUWV9XUk9ORywgZXhwck5vZGUsIGBAJHtuYW1lfSBtdXN0IGhhdmUgYXJndW1lbnRzYCk7XG4gIH1cbiAgY29uc3QgZmlyc3QgPSBuYW1lID09PSAnVmlld0NoaWxkJyB8fCBuYW1lID09PSAnQ29udGVudENoaWxkJztcbiAgY29uc3Qgbm9kZSA9IHVud3JhcEZvcndhcmRSZWYoYXJnc1swXSwgcmVmbGVjdG9yKTtcbiAgY29uc3QgYXJnID0gZXZhbHVhdG9yLmV2YWx1YXRlKG5vZGUpO1xuXG4gIC8qKiBXaGV0aGVyIG9yIG5vdCB0aGlzIHF1ZXJ5IHNob3VsZCBjb2xsZWN0IG9ubHkgc3RhdGljIHJlc3VsdHMgKHNlZSB2aWV3L2FwaS50cykgICovXG4gIGxldCBpc1N0YXRpYzogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIC8vIEV4dHJhY3QgdGhlIHByZWRpY2F0ZVxuICBsZXQgcHJlZGljYXRlOiBFeHByZXNzaW9ufHN0cmluZ1tdfG51bGwgPSBudWxsO1xuICBpZiAoYXJnIGluc3RhbmNlb2YgUmVmZXJlbmNlIHx8IGFyZyBpbnN0YW5jZW9mIER5bmFtaWNWYWx1ZSkge1xuICAgIC8vIFJlZmVyZW5jZXMgYW5kIHByZWRpY2F0ZXMgdGhhdCBjb3VsZCBub3QgYmUgZXZhbHVhdGVkIHN0YXRpY2FsbHkgYXJlIGVtaXR0ZWQgYXMgaXMuXG4gICAgcHJlZGljYXRlID0gbmV3IFdyYXBwZWROb2RlRXhwcihub2RlKTtcbiAgfSBlbHNlIGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuICAgIHByZWRpY2F0ZSA9IFthcmddO1xuICB9IGVsc2UgaWYgKGlzU3RyaW5nQXJyYXlPckRpZShhcmcsIGBAJHtuYW1lfSBwcmVkaWNhdGVgLCBub2RlKSkge1xuICAgIHByZWRpY2F0ZSA9IGFyZztcbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKG5vZGUsIGFyZywgYEAke25hbWV9IHByZWRpY2F0ZSBjYW5ub3QgYmUgaW50ZXJwcmV0ZWRgKTtcbiAgfVxuXG4gIC8vIEV4dHJhY3QgdGhlIHJlYWQgYW5kIGRlc2NlbmRhbnRzIG9wdGlvbnMuXG4gIGxldCByZWFkOiBFeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAvLyBUaGUgZGVmYXVsdCB2YWx1ZSBmb3IgZGVzY2VuZGFudHMgaXMgdHJ1ZSBmb3IgZXZlcnkgZGVjb3JhdG9yIGV4Y2VwdCBAQ29udGVudENoaWxkcmVuLlxuICBsZXQgZGVzY2VuZGFudHM6IGJvb2xlYW4gPSBuYW1lICE9PSAnQ29udGVudENoaWxkcmVuJztcbiAgaWYgKGFyZ3MubGVuZ3RoID09PSAyKSB7XG4gICAgY29uc3Qgb3B0aW9uc0V4cHIgPSB1bndyYXBFeHByZXNzaW9uKGFyZ3NbMV0pO1xuICAgIGlmICghdHMuaXNPYmplY3RMaXRlcmFsRXhwcmVzc2lvbihvcHRpb25zRXhwcikpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX0FSR19OT1RfTElURVJBTCwgb3B0aW9uc0V4cHIsXG4gICAgICAgICAgYEAke25hbWV9IG9wdGlvbnMgbXVzdCBiZSBhbiBvYmplY3QgbGl0ZXJhbGApO1xuICAgIH1cbiAgICBjb25zdCBvcHRpb25zID0gcmVmbGVjdE9iamVjdExpdGVyYWwob3B0aW9uc0V4cHIpO1xuICAgIGlmIChvcHRpb25zLmhhcygncmVhZCcpKSB7XG4gICAgICByZWFkID0gbmV3IFdyYXBwZWROb2RlRXhwcihvcHRpb25zLmdldCgncmVhZCcpISk7XG4gICAgfVxuXG4gICAgaWYgKG9wdGlvbnMuaGFzKCdkZXNjZW5kYW50cycpKSB7XG4gICAgICBjb25zdCBkZXNjZW5kYW50c0V4cHIgPSBvcHRpb25zLmdldCgnZGVzY2VuZGFudHMnKSE7XG4gICAgICBjb25zdCBkZXNjZW5kYW50c1ZhbHVlID0gZXZhbHVhdG9yLmV2YWx1YXRlKGRlc2NlbmRhbnRzRXhwcik7XG4gICAgICBpZiAodHlwZW9mIGRlc2NlbmRhbnRzVmFsdWUgIT09ICdib29sZWFuJykge1xuICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgZGVzY2VuZGFudHNFeHByLCBkZXNjZW5kYW50c1ZhbHVlLCBgQCR7bmFtZX0gb3B0aW9ucy5kZXNjZW5kYW50cyBtdXN0IGJlIGEgYm9vbGVhbmApO1xuICAgICAgfVxuICAgICAgZGVzY2VuZGFudHMgPSBkZXNjZW5kYW50c1ZhbHVlO1xuICAgIH1cblxuICAgIGlmIChvcHRpb25zLmhhcygnc3RhdGljJykpIHtcbiAgICAgIGNvbnN0IHN0YXRpY1ZhbHVlID0gZXZhbHVhdG9yLmV2YWx1YXRlKG9wdGlvbnMuZ2V0KCdzdGF0aWMnKSEpO1xuICAgICAgaWYgKHR5cGVvZiBzdGF0aWNWYWx1ZSAhPT0gJ2Jvb2xlYW4nKSB7XG4gICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICBub2RlLCBzdGF0aWNWYWx1ZSwgYEAke25hbWV9IG9wdGlvbnMuc3RhdGljIG11c3QgYmUgYSBib29sZWFuYCk7XG4gICAgICB9XG4gICAgICBpc1N0YXRpYyA9IHN0YXRpY1ZhbHVlO1xuICAgIH1cblxuICB9IGVsc2UgaWYgKGFyZ3MubGVuZ3RoID4gMikge1xuICAgIC8vIFRvbyBtYW55IGFyZ3VtZW50cy5cbiAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQVJJVFlfV1JPTkcsIG5vZGUsIGBAJHtuYW1lfSBoYXMgdG9vIG1hbnkgYXJndW1lbnRzYCk7XG4gIH1cblxuICByZXR1cm4ge1xuICAgIHByb3BlcnR5TmFtZSxcbiAgICBwcmVkaWNhdGUsXG4gICAgZmlyc3QsXG4gICAgZGVzY2VuZGFudHMsXG4gICAgcmVhZCxcbiAgICBzdGF0aWM6IGlzU3RhdGljLFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFF1ZXJpZXNGcm9tRGVjb3JhdG9yKFxuICAgIHF1ZXJ5RGF0YTogdHMuRXhwcmVzc2lvbiwgcmVmbGVjdG9yOiBSZWZsZWN0aW9uSG9zdCwgZXZhbHVhdG9yOiBQYXJ0aWFsRXZhbHVhdG9yLFxuICAgIGlzQ29yZTogYm9vbGVhbik6IHtcbiAgY29udGVudDogUjNRdWVyeU1ldGFkYXRhW10sXG4gIHZpZXc6IFIzUXVlcnlNZXRhZGF0YVtdLFxufSB7XG4gIGNvbnN0IGNvbnRlbnQ6IFIzUXVlcnlNZXRhZGF0YVtdID0gW10sIHZpZXc6IFIzUXVlcnlNZXRhZGF0YVtdID0gW107XG4gIGlmICghdHMuaXNPYmplY3RMaXRlcmFsRXhwcmVzc2lvbihxdWVyeURhdGEpKSB7XG4gICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICBFcnJvckNvZGUuVkFMVUVfSEFTX1dST05HX1RZUEUsIHF1ZXJ5RGF0YSxcbiAgICAgICAgJ0RlY29yYXRvciBxdWVyaWVzIG1ldGFkYXRhIG11c3QgYmUgYW4gb2JqZWN0IGxpdGVyYWwnKTtcbiAgfVxuICByZWZsZWN0T2JqZWN0TGl0ZXJhbChxdWVyeURhdGEpLmZvckVhY2goKHF1ZXJ5RXhwciwgcHJvcGVydHlOYW1lKSA9PiB7XG4gICAgcXVlcnlFeHByID0gdW53cmFwRXhwcmVzc2lvbihxdWVyeUV4cHIpO1xuICAgIGlmICghdHMuaXNOZXdFeHByZXNzaW9uKHF1ZXJ5RXhwcikgfHwgIXRzLmlzSWRlbnRpZmllcihxdWVyeUV4cHIuZXhwcmVzc2lvbikpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuVkFMVUVfSEFTX1dST05HX1RZUEUsIHF1ZXJ5RGF0YSxcbiAgICAgICAgICAnRGVjb3JhdG9yIHF1ZXJ5IG1ldGFkYXRhIG11c3QgYmUgYW4gaW5zdGFuY2Ugb2YgYSBxdWVyeSB0eXBlJyk7XG4gICAgfVxuICAgIGNvbnN0IHR5cGUgPSByZWZsZWN0b3IuZ2V0SW1wb3J0T2ZJZGVudGlmaWVyKHF1ZXJ5RXhwci5leHByZXNzaW9uKTtcbiAgICBpZiAodHlwZSA9PT0gbnVsbCB8fCAoIWlzQ29yZSAmJiB0eXBlLmZyb20gIT09ICdAYW5ndWxhci9jb3JlJykgfHxcbiAgICAgICAgIVFVRVJZX1RZUEVTLmhhcyh0eXBlLm5hbWUpKSB7XG4gICAgICB0aHJvdyBuZXcgRmF0YWxEaWFnbm9zdGljRXJyb3IoXG4gICAgICAgICAgRXJyb3JDb2RlLlZBTFVFX0hBU19XUk9OR19UWVBFLCBxdWVyeURhdGEsXG4gICAgICAgICAgJ0RlY29yYXRvciBxdWVyeSBtZXRhZGF0YSBtdXN0IGJlIGFuIGluc3RhbmNlIG9mIGEgcXVlcnkgdHlwZScpO1xuICAgIH1cblxuICAgIGNvbnN0IHF1ZXJ5ID0gZXh0cmFjdFF1ZXJ5TWV0YWRhdGEoXG4gICAgICAgIHF1ZXJ5RXhwciwgdHlwZS5uYW1lLCBxdWVyeUV4cHIuYXJndW1lbnRzIHx8IFtdLCBwcm9wZXJ0eU5hbWUsIHJlZmxlY3RvciwgZXZhbHVhdG9yKTtcbiAgICBpZiAodHlwZS5uYW1lLnN0YXJ0c1dpdGgoJ0NvbnRlbnQnKSkge1xuICAgICAgY29udGVudC5wdXNoKHF1ZXJ5KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmlldy5wdXNoKHF1ZXJ5KTtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4ge2NvbnRlbnQsIHZpZXd9O1xufVxuXG5mdW5jdGlvbiBpc1N0cmluZ0FycmF5T3JEaWUodmFsdWU6IGFueSwgbmFtZTogc3RyaW5nLCBub2RlOiB0cy5FeHByZXNzaW9uKTogdmFsdWUgaXMgc3RyaW5nW10ge1xuICBpZiAoIUFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuICAgIGlmICh0eXBlb2YgdmFsdWVbaV0gIT09ICdzdHJpbmcnKSB7XG4gICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgIG5vZGUsIHZhbHVlW2ldLCBgRmFpbGVkIHRvIHJlc29sdmUgJHtuYW1lfSBhdCBwb3NpdGlvbiAke2l9IHRvIGEgc3RyaW5nYCk7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VGaWVsZEFycmF5VmFsdWUoXG4gICAgZGlyZWN0aXZlOiBNYXA8c3RyaW5nLCB0cy5FeHByZXNzaW9uPiwgZmllbGQ6IHN0cmluZywgZXZhbHVhdG9yOiBQYXJ0aWFsRXZhbHVhdG9yKTogbnVsbHxcbiAgICBzdHJpbmdbXSB7XG4gIGlmICghZGlyZWN0aXZlLmhhcyhmaWVsZCkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIFJlc29sdmUgdGhlIGZpZWxkIG9mIGludGVyZXN0IGZyb20gdGhlIGRpcmVjdGl2ZSBtZXRhZGF0YSB0byBhIHN0cmluZ1tdLlxuICBjb25zdCBleHByZXNzaW9uID0gZGlyZWN0aXZlLmdldChmaWVsZCkhO1xuICBjb25zdCB2YWx1ZSA9IGV2YWx1YXRvci5ldmFsdWF0ZShleHByZXNzaW9uKTtcbiAgaWYgKCFpc1N0cmluZ0FycmF5T3JEaWUodmFsdWUsIGZpZWxkLCBleHByZXNzaW9uKSkge1xuICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgIGV4cHJlc3Npb24sIHZhbHVlLCBgRmFpbGVkIHRvIHJlc29sdmUgQERpcmVjdGl2ZS4ke2ZpZWxkfSB0byBhIHN0cmluZyBhcnJheWApO1xuICB9XG5cbiAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKipcbiAqIEludGVycHJldCBwcm9wZXJ0eSBtYXBwaW5nIGZpZWxkcyBvbiB0aGUgZGVjb3JhdG9yIChlLmcuIGlucHV0cyBvciBvdXRwdXRzKSBhbmQgcmV0dXJuIHRoZVxuICogY29ycmVjdGx5IHNoYXBlZCBtZXRhZGF0YSBvYmplY3QuXG4gKi9cbmZ1bmN0aW9uIHBhcnNlRmllbGRUb1Byb3BlcnR5TWFwcGluZyhcbiAgICBkaXJlY3RpdmU6IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+LCBmaWVsZDogc3RyaW5nLFxuICAgIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcik6IHtbZmllbGQ6IHN0cmluZ106IHN0cmluZ30ge1xuICBjb25zdCBtZXRhVmFsdWVzID0gcGFyc2VGaWVsZEFycmF5VmFsdWUoZGlyZWN0aXZlLCBmaWVsZCwgZXZhbHVhdG9yKTtcbiAgaWYgKCFtZXRhVmFsdWVzKSB7XG4gICAgcmV0dXJuIEVNUFRZX09CSkVDVDtcbiAgfVxuXG4gIHJldHVybiBtZXRhVmFsdWVzLnJlZHVjZSgocmVzdWx0cywgdmFsdWUpID0+IHtcbiAgICAvLyBFaXRoZXIgdGhlIHZhbHVlIGlzICdmaWVsZCcgb3IgJ2ZpZWxkOiBwcm9wZXJ0eScuIEluIHRoZSBmaXJzdCBjYXNlLCBgcHJvcGVydHlgIHdpbGxcbiAgICAvLyBiZSB1bmRlZmluZWQsIGluIHdoaWNoIGNhc2UgdGhlIGZpZWxkIG5hbWUgc2hvdWxkIGFsc28gYmUgdXNlZCBhcyB0aGUgcHJvcGVydHkgbmFtZS5cbiAgICBjb25zdCBbZmllbGQsIHByb3BlcnR5XSA9IHZhbHVlLnNwbGl0KCc6JywgMikubWFwKHN0ciA9PiBzdHIudHJpbSgpKTtcbiAgICByZXN1bHRzW2ZpZWxkXSA9IHByb3BlcnR5IHx8IGZpZWxkO1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9LCB7fSBhcyB7W2ZpZWxkOiBzdHJpbmddOiBzdHJpbmd9KTtcbn1cblxuLyoqXG4gKiBQYXJzZSBwcm9wZXJ0eSBkZWNvcmF0b3JzIChlLmcuIGBJbnB1dGAgb3IgYE91dHB1dGApIGFuZCByZXR1cm4gdGhlIGNvcnJlY3RseSBzaGFwZWQgbWV0YWRhdGFcbiAqIG9iamVjdC5cbiAqL1xuZnVuY3Rpb24gcGFyc2VEZWNvcmF0ZWRGaWVsZHMoXG4gICAgZmllbGRzOiB7bWVtYmVyOiBDbGFzc01lbWJlciwgZGVjb3JhdG9yczogRGVjb3JhdG9yW119W10sIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcixcbiAgICBtYXBWYWx1ZVJlc29sdmVyOiAocHVibGljTmFtZTogc3RyaW5nLCBpbnRlcm5hbE5hbWU6IHN0cmluZykgPT5cbiAgICAgICAgc3RyaW5nIHwgW3N0cmluZywgc3RyaW5nXSk6IHtbZmllbGQ6IHN0cmluZ106IHN0cmluZ3xbc3RyaW5nLCBzdHJpbmddfSB7XG4gIHJldHVybiBmaWVsZHMucmVkdWNlKChyZXN1bHRzLCBmaWVsZCkgPT4ge1xuICAgIGNvbnN0IGZpZWxkTmFtZSA9IGZpZWxkLm1lbWJlci5uYW1lO1xuICAgIGZpZWxkLmRlY29yYXRvcnMuZm9yRWFjaChkZWNvcmF0b3IgPT4ge1xuICAgICAgLy8gVGhlIGRlY29yYXRvciBlaXRoZXIgZG9lc24ndCBoYXZlIGFuIGFyZ3VtZW50IChASW5wdXQoKSkgaW4gd2hpY2ggY2FzZSB0aGUgcHJvcGVydHlcbiAgICAgIC8vIG5hbWUgaXMgdXNlZCwgb3IgaXQgaGFzIG9uZSBhcmd1bWVudCAoQE91dHB1dCgnbmFtZWQnKSkuXG4gICAgICBpZiAoZGVjb3JhdG9yLmFyZ3MgPT0gbnVsbCB8fCBkZWNvcmF0b3IuYXJncy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmVzdWx0c1tmaWVsZE5hbWVdID0gZmllbGROYW1lO1xuICAgICAgfSBlbHNlIGlmIChkZWNvcmF0b3IuYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgY29uc3QgcHJvcGVydHkgPSBldmFsdWF0b3IuZXZhbHVhdGUoZGVjb3JhdG9yLmFyZ3NbMF0pO1xuICAgICAgICBpZiAodHlwZW9mIHByb3BlcnR5ICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgICAgIERlY29yYXRvci5ub2RlRm9yRXJyb3IoZGVjb3JhdG9yKSwgcHJvcGVydHksXG4gICAgICAgICAgICAgIGBAJHtkZWNvcmF0b3IubmFtZX0gZGVjb3JhdG9yIGFyZ3VtZW50IG11c3QgcmVzb2x2ZSB0byBhIHN0cmluZ2ApO1xuICAgICAgICB9XG4gICAgICAgIHJlc3VsdHNbZmllbGROYW1lXSA9IG1hcFZhbHVlUmVzb2x2ZXIocHJvcGVydHksIGZpZWxkTmFtZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUb28gbWFueSBhcmd1bWVudHMuXG4gICAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQVJJVFlfV1JPTkcsIERlY29yYXRvci5ub2RlRm9yRXJyb3IoZGVjb3JhdG9yKSxcbiAgICAgICAgICAgIGBAJHtkZWNvcmF0b3IubmFtZX0gY2FuIGhhdmUgYXQgbW9zdCBvbmUgYXJndW1lbnQsIGdvdCAke1xuICAgICAgICAgICAgICAgIGRlY29yYXRvci5hcmdzLmxlbmd0aH0gYXJndW1lbnQocylgKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gcmVzdWx0cztcbiAgfSwge30gYXMge1tmaWVsZDogc3RyaW5nXTogc3RyaW5nIHwgW3N0cmluZywgc3RyaW5nXX0pO1xufVxuXG5mdW5jdGlvbiByZXNvbHZlSW5wdXQocHVibGljTmFtZTogc3RyaW5nLCBpbnRlcm5hbE5hbWU6IHN0cmluZyk6IFtzdHJpbmcsIHN0cmluZ10ge1xuICByZXR1cm4gW3B1YmxpY05hbWUsIGludGVybmFsTmFtZV07XG59XG5cbmZ1bmN0aW9uIHJlc29sdmVPdXRwdXQocHVibGljTmFtZTogc3RyaW5nLCBpbnRlcm5hbE5hbWU6IHN0cmluZykge1xuICByZXR1cm4gcHVibGljTmFtZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHF1ZXJpZXNGcm9tRmllbGRzKFxuICAgIGZpZWxkczoge21lbWJlcjogQ2xhc3NNZW1iZXIsIGRlY29yYXRvcnM6IERlY29yYXRvcltdfVtdLCByZWZsZWN0b3I6IFJlZmxlY3Rpb25Ib3N0LFxuICAgIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcik6IFIzUXVlcnlNZXRhZGF0YVtdIHtcbiAgcmV0dXJuIGZpZWxkcy5tYXAoKHttZW1iZXIsIGRlY29yYXRvcnN9KSA9PiB7XG4gICAgY29uc3QgZGVjb3JhdG9yID0gZGVjb3JhdG9yc1swXTtcbiAgICBjb25zdCBub2RlID0gbWVtYmVyLm5vZGUgfHwgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWNvcmF0b3IpO1xuXG4gICAgLy8gVGhyb3cgaW4gY2FzZSBvZiBgQElucHV0KCkgQENvbnRlbnRDaGlsZCgnZm9vJykgZm9vOiBhbnlgLCB3aGljaCBpcyBub3Qgc3VwcG9ydGVkIGluIEl2eVxuICAgIGlmIChtZW1iZXIuZGVjb3JhdG9ycyEuc29tZSh2ID0+IHYubmFtZSA9PT0gJ0lucHV0JykpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX0NPTExJU0lPTiwgbm9kZSxcbiAgICAgICAgICAnQ2Fubm90IGNvbWJpbmUgQElucHV0IGRlY29yYXRvcnMgd2l0aCBxdWVyeSBkZWNvcmF0b3JzJyk7XG4gICAgfVxuICAgIGlmIChkZWNvcmF0b3JzLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgIEVycm9yQ29kZS5ERUNPUkFUT1JfQ09MTElTSU9OLCBub2RlLFxuICAgICAgICAgICdDYW5ub3QgaGF2ZSBtdWx0aXBsZSBxdWVyeSBkZWNvcmF0b3JzIG9uIHRoZSBzYW1lIGNsYXNzIG1lbWJlcicpO1xuICAgIH0gZWxzZSBpZiAoIWlzUHJvcGVydHlUeXBlTWVtYmVyKG1lbWJlcikpIHtcbiAgICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgICBFcnJvckNvZGUuREVDT1JBVE9SX1VORVhQRUNURUQsIG5vZGUsXG4gICAgICAgICAgJ1F1ZXJ5IGRlY29yYXRvciBtdXN0IGdvIG9uIGEgcHJvcGVydHktdHlwZSBtZW1iZXInKTtcbiAgICB9XG4gICAgcmV0dXJuIGV4dHJhY3RRdWVyeU1ldGFkYXRhKFxuICAgICAgICBub2RlLCBkZWNvcmF0b3IubmFtZSwgZGVjb3JhdG9yLmFyZ3MgfHwgW10sIG1lbWJlci5uYW1lLCByZWZsZWN0b3IsIGV2YWx1YXRvcik7XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBpc1Byb3BlcnR5VHlwZU1lbWJlcihtZW1iZXI6IENsYXNzTWVtYmVyKTogYm9vbGVhbiB7XG4gIHJldHVybiBtZW1iZXIua2luZCA9PT0gQ2xhc3NNZW1iZXJLaW5kLkdldHRlciB8fCBtZW1iZXIua2luZCA9PT0gQ2xhc3NNZW1iZXJLaW5kLlNldHRlciB8fFxuICAgICAgbWVtYmVyLmtpbmQgPT09IENsYXNzTWVtYmVyS2luZC5Qcm9wZXJ0eTtcbn1cblxudHlwZSBTdHJpbmdNYXA8VD4gPSB7XG4gIFtrZXk6IHN0cmluZ106IFQ7XG59O1xuXG5mdW5jdGlvbiBldmFsdWF0ZUhvc3RFeHByZXNzaW9uQmluZGluZ3MoXG4gICAgaG9zdEV4cHI6IHRzLkV4cHJlc3Npb24sIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvcik6IFBhcnNlZEhvc3RCaW5kaW5ncyB7XG4gIGNvbnN0IGhvc3RNZXRhTWFwID0gZXZhbHVhdG9yLmV2YWx1YXRlKGhvc3RFeHByKTtcbiAgaWYgKCEoaG9zdE1ldGFNYXAgaW5zdGFuY2VvZiBNYXApKSB7XG4gICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgaG9zdEV4cHIsIGhvc3RNZXRhTWFwLCBgRGVjb3JhdG9yIGhvc3QgbWV0YWRhdGEgbXVzdCBiZSBhbiBvYmplY3RgKTtcbiAgfVxuICBjb25zdCBob3N0TWV0YWRhdGE6IFN0cmluZ01hcDxzdHJpbmd8RXhwcmVzc2lvbj4gPSB7fTtcbiAgaG9zdE1ldGFNYXAuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuICAgIC8vIFJlc29sdmUgRW51bSByZWZlcmVuY2VzIHRvIHRoZWlyIGRlY2xhcmVkIHZhbHVlLlxuICAgIGlmICh2YWx1ZSBpbnN0YW5jZW9mIEVudW1WYWx1ZSkge1xuICAgICAgdmFsdWUgPSB2YWx1ZS5yZXNvbHZlZDtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGtleSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIHRocm93IGNyZWF0ZVZhbHVlSGFzV3JvbmdUeXBlRXJyb3IoXG4gICAgICAgICAgaG9zdEV4cHIsIGtleSxcbiAgICAgICAgICBgRGVjb3JhdG9yIGhvc3QgbWV0YWRhdGEgbXVzdCBiZSBhIHN0cmluZyAtPiBzdHJpbmcgb2JqZWN0LCBidXQgZm91bmQgdW5wYXJzZWFibGUga2V5YCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PSAnc3RyaW5nJykge1xuICAgICAgaG9zdE1ldGFkYXRhW2tleV0gPSB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKHZhbHVlIGluc3RhbmNlb2YgRHluYW1pY1ZhbHVlKSB7XG4gICAgICBob3N0TWV0YWRhdGFba2V5XSA9IG5ldyBXcmFwcGVkTm9kZUV4cHIodmFsdWUubm9kZSBhcyB0cy5FeHByZXNzaW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgICBob3N0RXhwciwgdmFsdWUsXG4gICAgICAgICAgYERlY29yYXRvciBob3N0IG1ldGFkYXRhIG11c3QgYmUgYSBzdHJpbmcgLT4gc3RyaW5nIG9iamVjdCwgYnV0IGZvdW5kIHVucGFyc2VhYmxlIHZhbHVlYCk7XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBiaW5kaW5ncyA9IHBhcnNlSG9zdEJpbmRpbmdzKGhvc3RNZXRhZGF0YSk7XG5cbiAgY29uc3QgZXJyb3JzID0gdmVyaWZ5SG9zdEJpbmRpbmdzKGJpbmRpbmdzLCBjcmVhdGVTb3VyY2VTcGFuKGhvc3RFeHByKSk7XG4gIGlmIChlcnJvcnMubGVuZ3RoID4gMCkge1xuICAgIHRocm93IG5ldyBGYXRhbERpYWdub3N0aWNFcnJvcihcbiAgICAgICAgLy8gVE9ETzogcHJvdmlkZSBtb3JlIGdyYW51bGFyIGRpYWdub3N0aWMgYW5kIG91dHB1dCBzcGVjaWZpYyBob3N0IGV4cHJlc3Npb24gdGhhdFxuICAgICAgICAvLyB0cmlnZ2VyZWQgYW4gZXJyb3IgaW5zdGVhZCBvZiB0aGUgd2hvbGUgaG9zdCBvYmplY3QuXG4gICAgICAgIEVycm9yQ29kZS5IT1NUX0JJTkRJTkdfUEFSU0VfRVJST1IsIGhvc3RFeHByLFxuICAgICAgICBlcnJvcnMubWFwKChlcnJvcjogUGFyc2VFcnJvcikgPT4gZXJyb3IubXNnKS5qb2luKCdcXG4nKSk7XG4gIH1cblxuICByZXR1cm4gYmluZGluZ3M7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0SG9zdEJpbmRpbmdzKFxuICAgIG1lbWJlcnM6IENsYXNzTWVtYmVyW10sIGV2YWx1YXRvcjogUGFydGlhbEV2YWx1YXRvciwgY29yZU1vZHVsZTogc3RyaW5nfHVuZGVmaW5lZCxcbiAgICBtZXRhZGF0YT86IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+KTogUGFyc2VkSG9zdEJpbmRpbmdzIHtcbiAgbGV0IGJpbmRpbmdzOiBQYXJzZWRIb3N0QmluZGluZ3M7XG4gIGlmIChtZXRhZGF0YSAmJiBtZXRhZGF0YS5oYXMoJ2hvc3QnKSkge1xuICAgIGJpbmRpbmdzID0gZXZhbHVhdGVIb3N0RXhwcmVzc2lvbkJpbmRpbmdzKG1ldGFkYXRhLmdldCgnaG9zdCcpISwgZXZhbHVhdG9yKTtcbiAgfSBlbHNlIHtcbiAgICBiaW5kaW5ncyA9IHBhcnNlSG9zdEJpbmRpbmdzKHt9KTtcbiAgfVxuXG4gIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IobWVtYmVycywgJ0hvc3RCaW5kaW5nJywgY29yZU1vZHVsZSlcbiAgICAgIC5mb3JFYWNoKCh7bWVtYmVyLCBkZWNvcmF0b3JzfSkgPT4ge1xuICAgICAgICBkZWNvcmF0b3JzLmZvckVhY2goZGVjb3JhdG9yID0+IHtcbiAgICAgICAgICBsZXQgaG9zdFByb3BlcnR5TmFtZTogc3RyaW5nID0gbWVtYmVyLm5hbWU7XG4gICAgICAgICAgaWYgKGRlY29yYXRvci5hcmdzICE9PSBudWxsICYmIGRlY29yYXRvci5hcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGlmIChkZWNvcmF0b3IuYXJncy5sZW5ndGggIT09IDEpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgICAgICAgICAgRXJyb3JDb2RlLkRFQ09SQVRPUl9BUklUWV9XUk9ORywgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWNvcmF0b3IpLFxuICAgICAgICAgICAgICAgICAgYEBIb3N0QmluZGluZyBjYW4gaGF2ZSBhdCBtb3N0IG9uZSBhcmd1bWVudCwgZ290ICR7XG4gICAgICAgICAgICAgICAgICAgICAgZGVjb3JhdG9yLmFyZ3MubGVuZ3RofSBhcmd1bWVudChzKWApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXNvbHZlZCA9IGV2YWx1YXRvci5ldmFsdWF0ZShkZWNvcmF0b3IuYXJnc1swXSk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHJlc29sdmVkICE9PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgICAgICAgRGVjb3JhdG9yLm5vZGVGb3JFcnJvcihkZWNvcmF0b3IpLCByZXNvbHZlZCxcbiAgICAgICAgICAgICAgICAgIGBASG9zdEJpbmRpbmcncyBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGhvc3RQcm9wZXJ0eU5hbWUgPSByZXNvbHZlZDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBiaW5kaW5ncy5wcm9wZXJ0aWVzW2hvc3RQcm9wZXJ0eU5hbWVdID0gbWVtYmVyLm5hbWU7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG5cbiAgZmlsdGVyVG9NZW1iZXJzV2l0aERlY29yYXRvcihtZW1iZXJzLCAnSG9zdExpc3RlbmVyJywgY29yZU1vZHVsZSlcbiAgICAgIC5mb3JFYWNoKCh7bWVtYmVyLCBkZWNvcmF0b3JzfSkgPT4ge1xuICAgICAgICBkZWNvcmF0b3JzLmZvckVhY2goZGVjb3JhdG9yID0+IHtcbiAgICAgICAgICBsZXQgZXZlbnROYW1lOiBzdHJpbmcgPSBtZW1iZXIubmFtZTtcbiAgICAgICAgICBsZXQgYXJnczogc3RyaW5nW10gPSBbXTtcbiAgICAgICAgICBpZiAoZGVjb3JhdG9yLmFyZ3MgIT09IG51bGwgJiYgZGVjb3JhdG9yLmFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgaWYgKGRlY29yYXRvci5hcmdzLmxlbmd0aCA+IDIpIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IEZhdGFsRGlhZ25vc3RpY0Vycm9yKFxuICAgICAgICAgICAgICAgICAgRXJyb3JDb2RlLkRFQ09SQVRPUl9BUklUWV9XUk9ORywgZGVjb3JhdG9yLmFyZ3NbMl0sXG4gICAgICAgICAgICAgICAgICBgQEhvc3RMaXN0ZW5lciBjYW4gaGF2ZSBhdCBtb3N0IHR3byBhcmd1bWVudHNgKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBldmFsdWF0b3IuZXZhbHVhdGUoZGVjb3JhdG9yLmFyZ3NbMF0pO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiByZXNvbHZlZCAhPT0gJ3N0cmluZycpIHtcbiAgICAgICAgICAgICAgdGhyb3cgY3JlYXRlVmFsdWVIYXNXcm9uZ1R5cGVFcnJvcihcbiAgICAgICAgICAgICAgICAgIGRlY29yYXRvci5hcmdzWzBdLCByZXNvbHZlZCxcbiAgICAgICAgICAgICAgICAgIGBASG9zdExpc3RlbmVyJ3MgZXZlbnQgbmFtZSBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nYCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGV2ZW50TmFtZSA9IHJlc29sdmVkO1xuXG4gICAgICAgICAgICBpZiAoZGVjb3JhdG9yLmFyZ3MubGVuZ3RoID09PSAyKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSBkZWNvcmF0b3IuYXJnc1sxXTtcbiAgICAgICAgICAgICAgY29uc3QgcmVzb2x2ZWRBcmdzID0gZXZhbHVhdG9yLmV2YWx1YXRlKGRlY29yYXRvci5hcmdzWzFdKTtcbiAgICAgICAgICAgICAgaWYgKCFpc1N0cmluZ0FycmF5T3JEaWUocmVzb2x2ZWRBcmdzLCAnQEhvc3RMaXN0ZW5lci5hcmdzJywgZXhwcmVzc2lvbikpIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBjcmVhdGVWYWx1ZUhhc1dyb25nVHlwZUVycm9yKFxuICAgICAgICAgICAgICAgICAgICBkZWNvcmF0b3IuYXJnc1sxXSwgcmVzb2x2ZWRBcmdzLFxuICAgICAgICAgICAgICAgICAgICBgQEhvc3RMaXN0ZW5lcidzIHNlY29uZCBhcmd1bWVudCBtdXN0IGJlIGEgc3RyaW5nIGFycmF5YCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgYXJncyA9IHJlc29sdmVkQXJncztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG5cbiAgICAgICAgICBiaW5kaW5ncy5saXN0ZW5lcnNbZXZlbnROYW1lXSA9IGAke21lbWJlci5uYW1lfSgke2FyZ3Muam9pbignLCcpfSlgO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICByZXR1cm4gYmluZGluZ3M7XG59XG5cbmNvbnN0IFFVRVJZX1RZUEVTID0gbmV3IFNldChbXG4gICdDb250ZW50Q2hpbGQnLFxuICAnQ29udGVudENoaWxkcmVuJyxcbiAgJ1ZpZXdDaGlsZCcsXG4gICdWaWV3Q2hpbGRyZW4nLFxuXSk7XG4iXX0=