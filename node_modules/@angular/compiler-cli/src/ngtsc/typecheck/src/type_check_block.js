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
        define("@angular/compiler-cli/src/ngtsc/typecheck/src/type_check_block", ["require", "exports", "tslib", "@angular/compiler", "typescript", "@angular/compiler-cli/src/ngtsc/typecheck/src/diagnostics", "@angular/compiler-cli/src/ngtsc/typecheck/src/expression", "@angular/compiler-cli/src/ngtsc/typecheck/src/template_semantics", "@angular/compiler-cli/src/ngtsc/typecheck/src/ts_util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.requiresInlineTypeCheckBlock = exports.Context = exports.generateTypeCheckBlock = void 0;
    var tslib_1 = require("tslib");
    var compiler_1 = require("@angular/compiler");
    var ts = require("typescript");
    var diagnostics_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/src/diagnostics");
    var expression_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/src/expression");
    var template_semantics_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/src/template_semantics");
    var ts_util_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/src/ts_util");
    /**
     * Given a `ts.ClassDeclaration` for a component, and metadata regarding that component, compose a
     * "type check block" function.
     *
     * When passed through TypeScript's TypeChecker, type errors that arise within the type check block
     * function indicate issues in the template itself.
     *
     * As a side effect of generating a TCB for the component, `ts.Diagnostic`s may also be produced
     * directly for issues within the template which are identified during generation. These issues are
     * recorded in either the `domSchemaChecker` (which checks usage of DOM elements and bindings) as
     * well as the `oobRecorder` (which records errors when the type-checking code generator is unable
     * to sufficiently understand a template).
     *
     * @param env an `Environment` into which type-checking code will be generated.
     * @param ref a `Reference` to the component class which should be type-checked.
     * @param name a `ts.Identifier` to use for the generated `ts.FunctionDeclaration`.
     * @param meta metadata about the component's template and the function being generated.
     * @param domSchemaChecker used to check and record errors regarding improper usage of DOM elements
     * and bindings.
     * @param oobRecorder used to record errors regarding template elements which could not be correctly
     * translated into types during TCB generation.
     */
    function generateTypeCheckBlock(env, ref, name, meta, domSchemaChecker, oobRecorder) {
        var tcb = new Context(env, domSchemaChecker, oobRecorder, meta.id, meta.boundTarget, meta.pipes, meta.schemas);
        var scope = Scope.forNodes(tcb, null, tcb.boundTarget.target.template, /* guard */ null);
        var ctxRawType = env.referenceType(ref);
        if (!ts.isTypeReferenceNode(ctxRawType)) {
            throw new Error("Expected TypeReferenceNode when referencing the ctx param for " + ref.debugName);
        }
        var paramList = [tcbCtxParam(ref.node, ctxRawType.typeName, env.config.useContextGenericType)];
        var scopeStatements = scope.render();
        var innerBody = ts.createBlock(tslib_1.__spread(env.getPreludeStatements(), scopeStatements));
        // Wrap the body in an "if (true)" expression. This is unnecessary but has the effect of causing
        // the `ts.Printer` to format the type-check block nicely.
        var body = ts.createBlock([ts.createIf(ts.createTrue(), innerBody, undefined)]);
        var fnDecl = ts.createFunctionDeclaration(
        /* decorators */ undefined, 
        /* modifiers */ undefined, 
        /* asteriskToken */ undefined, 
        /* name */ name, 
        /* typeParameters */ env.config.useContextGenericType ? ref.node.typeParameters : undefined, 
        /* parameters */ paramList, 
        /* type */ undefined, 
        /* body */ body);
        diagnostics_1.addTemplateId(fnDecl, meta.id);
        return fnDecl;
    }
    exports.generateTypeCheckBlock = generateTypeCheckBlock;
    /**
     * A code generation operation that's involved in the construction of a Type Check Block.
     *
     * The generation of a TCB is non-linear. Bindings within a template may result in the need to
     * construct certain types earlier than they otherwise would be constructed. That is, if the
     * generation of a TCB for a template is broken down into specific operations (constructing a
     * directive, extracting a variable from a let- operation, etc), then it's possible for operations
     * earlier in the sequence to depend on operations which occur later in the sequence.
     *
     * `TcbOp` abstracts the different types of operations which are required to convert a template into
     * a TCB. This allows for two phases of processing for the template, where 1) a linear sequence of
     * `TcbOp`s is generated, and then 2) these operations are executed, not necessarily in linear
     * order.
     *
     * Each `TcbOp` may insert statements into the body of the TCB, and also optionally return a
     * `ts.Expression` which can be used to reference the operation's result.
     */
    var TcbOp = /** @class */ (function () {
        function TcbOp() {
        }
        /**
         * Replacement value or operation used while this `TcbOp` is executing (i.e. to resolve circular
         * references during its execution).
         *
         * This is usually a `null!` expression (which asks TS to infer an appropriate type), but another
         * `TcbOp` can be returned in cases where additional code generation is necessary to deal with
         * circular references.
         */
        TcbOp.prototype.circularFallback = function () {
            return INFER_TYPE_FOR_CIRCULAR_OP_EXPR;
        };
        return TcbOp;
    }());
    /**
     * A `TcbOp` which creates an expression for a native DOM element (or web component) from a
     * `TmplAstElement`.
     *
     * Executing this operation returns a reference to the element variable.
     */
    var TcbElementOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbElementOp, _super);
        function TcbElementOp(tcb, scope, element) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.element = element;
            return _this;
        }
        Object.defineProperty(TcbElementOp.prototype, "optional", {
            get: function () {
                // The statement generated by this operation is only used for type-inference of the DOM
                // element's type and won't report diagnostics by itself, so the operation is marked as optional
                // to avoid generating statements for DOM elements that are never referenced.
                return true;
            },
            enumerable: false,
            configurable: true
        });
        TcbElementOp.prototype.execute = function () {
            var id = this.tcb.allocateId();
            // Add the declaration of the element using document.createElement.
            var initializer = ts_util_1.tsCreateElement(this.element.name);
            diagnostics_1.addParseSpanInfo(initializer, this.element.startSourceSpan || this.element.sourceSpan);
            this.scope.addStatement(ts_util_1.tsCreateVariable(id, initializer));
            return id;
        };
        return TcbElementOp;
    }(TcbOp));
    /**
     * A `TcbOp` which creates an expression for particular let- `TmplAstVariable` on a
     * `TmplAstTemplate`'s context.
     *
     * Executing this operation returns a reference to the variable variable (lol).
     */
    var TcbVariableOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbVariableOp, _super);
        function TcbVariableOp(tcb, scope, template, variable) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.template = template;
            _this.variable = variable;
            return _this;
        }
        Object.defineProperty(TcbVariableOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbVariableOp.prototype.execute = function () {
            // Look for a context variable for the template.
            var ctx = this.scope.resolve(this.template);
            // Allocate an identifier for the TmplAstVariable, and initialize it to a read of the variable
            // on the template context.
            var id = this.tcb.allocateId();
            var initializer = ts.createPropertyAccess(
            /* expression */ ctx, 
            /* name */ this.variable.value || '$implicit');
            diagnostics_1.addParseSpanInfo(initializer, this.variable.sourceSpan);
            // Declare the variable, and return its identifier.
            this.scope.addStatement(ts_util_1.tsCreateVariable(id, initializer));
            return id;
        };
        return TcbVariableOp;
    }(TcbOp));
    /**
     * A `TcbOp` which generates a variable for a `TmplAstTemplate`'s context.
     *
     * Executing this operation returns a reference to the template's context variable.
     */
    var TcbTemplateContextOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbTemplateContextOp, _super);
        function TcbTemplateContextOp(tcb, scope) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            return _this;
        }
        Object.defineProperty(TcbTemplateContextOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbTemplateContextOp.prototype.execute = function () {
            // Allocate a template ctx variable and declare it with an 'any' type. The type of this variable
            // may be narrowed as a result of template guard conditions.
            var ctx = this.tcb.allocateId();
            var type = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
            this.scope.addStatement(ts_util_1.tsDeclareVariable(ctx, type));
            return ctx;
        };
        return TcbTemplateContextOp;
    }(TcbOp));
    /**
     * A `TcbOp` which descends into a `TmplAstTemplate`'s children and generates type-checking code for
     * them.
     *
     * This operation wraps the children's type-checking code in an `if` block, which may include one
     * or more type guard conditions that narrow types within the template body.
     */
    var TcbTemplateBodyOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbTemplateBodyOp, _super);
        function TcbTemplateBodyOp(tcb, scope, template) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.template = template;
            return _this;
        }
        Object.defineProperty(TcbTemplateBodyOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbTemplateBodyOp.prototype.execute = function () {
            var e_1, _a;
            var _this = this;
            // An `if` will be constructed, within which the template's children will be type checked. The
            // `if` is used for two reasons: it creates a new syntactic scope, isolating variables declared
            // in the template's TCB from the outer context, and it allows any directives on the templates
            // to perform type narrowing of either expressions or the template's context.
            //
            // The guard is the `if` block's condition. It's usually set to `true` but directives that exist
            // on the template can trigger extra guard expressions that serve to narrow types within the
            // `if`. `guard` is calculated by starting with `true` and adding other conditions as needed.
            // Collect these into `guards` by processing the directives.
            var directiveGuards = [];
            var directives = this.tcb.boundTarget.getDirectivesOfNode(this.template);
            if (directives !== null) {
                var _loop_1 = function (dir) {
                    var dirInstId = this_1.scope.resolve(this_1.template, dir);
                    var dirId = this_1.tcb.env.reference(dir.ref);
                    // There are two kinds of guards. Template guards (ngTemplateGuards) allow type narrowing of
                    // the expression passed to an @Input of the directive. Scan the directive to see if it has
                    // any template guards, and generate them if needed.
                    dir.ngTemplateGuards.forEach(function (guard) {
                        // For each template guard function on the directive, look for a binding to that input.
                        var boundInput = _this.template.inputs.find(function (i) { return i.name === guard.inputName; }) ||
                            _this.template.templateAttrs.find(function (i) {
                                return i instanceof compiler_1.TmplAstBoundAttribute && i.name === guard.inputName;
                            });
                        if (boundInput !== undefined) {
                            // If there is such a binding, generate an expression for it.
                            var expr = tcbExpression(boundInput.value, _this.tcb, _this.scope);
                            // The expression has already been checked in the type constructor invocation, so
                            // it should be ignored when used within a template guard.
                            diagnostics_1.ignoreDiagnostics(expr);
                            if (guard.type === 'binding') {
                                // Use the binding expression itself as guard.
                                directiveGuards.push(expr);
                            }
                            else {
                                // Call the guard function on the directive with the directive instance and that
                                // expression.
                                var guardInvoke = ts_util_1.tsCallMethod(dirId, "ngTemplateGuard_" + guard.inputName, [
                                    dirInstId,
                                    expr,
                                ]);
                                diagnostics_1.addParseSpanInfo(guardInvoke, boundInput.value.sourceSpan);
                                directiveGuards.push(guardInvoke);
                            }
                        }
                    });
                    // The second kind of guard is a template context guard. This guard narrows the template
                    // rendering context variable `ctx`.
                    if (dir.hasNgTemplateContextGuard && this_1.tcb.env.config.applyTemplateContextGuards) {
                        var ctx = this_1.scope.resolve(this_1.template);
                        var guardInvoke = ts_util_1.tsCallMethod(dirId, 'ngTemplateContextGuard', [dirInstId, ctx]);
                        diagnostics_1.addParseSpanInfo(guardInvoke, this_1.template.sourceSpan);
                        directiveGuards.push(guardInvoke);
                    }
                };
                var this_1 = this;
                try {
                    for (var directives_1 = tslib_1.__values(directives), directives_1_1 = directives_1.next(); !directives_1_1.done; directives_1_1 = directives_1.next()) {
                        var dir = directives_1_1.value;
                        _loop_1(dir);
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (directives_1_1 && !directives_1_1.done && (_a = directives_1.return)) _a.call(directives_1);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
            }
            // By default the guard is simply `true`.
            var guard = null;
            // If there are any guards from directives, use them instead.
            if (directiveGuards.length > 0) {
                // Pop the first value and use it as the initializer to reduce(). This way, a single guard
                // will be used on its own, but two or more will be combined into binary AND expressions.
                guard = directiveGuards.reduce(function (expr, dirGuard) {
                    return ts.createBinary(expr, ts.SyntaxKind.AmpersandAmpersandToken, dirGuard);
                }, directiveGuards.pop());
            }
            // Create a new Scope for the template. This constructs the list of operations for the template
            // children, as well as tracks bindings within the template.
            var tmplScope = Scope.forNodes(this.tcb, this.scope, this.template, guard);
            // Render the template's `Scope` into its statements.
            var statements = tmplScope.render();
            if (statements.length === 0) {
                // As an optimization, don't generate the scope's block if it has no statements. This is
                // beneficial for templates that contain for example `<span *ngIf="first"></span>`, in which
                // case there's no need to render the `NgIf` guard expression. This seems like a minor
                // improvement, however it reduces the number of flow-node antecedents that TypeScript needs
                // to keep into account for such cases, resulting in an overall reduction of
                // type-checking time.
                return null;
            }
            var tmplBlock = ts.createBlock(statements);
            if (guard !== null) {
                // The scope has a guard that needs to be applied, so wrap the template block into an `if`
                // statement containing the guard expression.
                tmplBlock = ts.createIf(/* expression */ guard, /* thenStatement */ tmplBlock);
            }
            this.scope.addStatement(tmplBlock);
            return null;
        };
        return TcbTemplateBodyOp;
    }(TcbOp));
    /**
     * A `TcbOp` which renders a text binding (interpolation) into the TCB.
     *
     * Executing this operation returns nothing.
     */
    var TcbTextInterpolationOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbTextInterpolationOp, _super);
        function TcbTextInterpolationOp(tcb, scope, binding) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.binding = binding;
            return _this;
        }
        Object.defineProperty(TcbTextInterpolationOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbTextInterpolationOp.prototype.execute = function () {
            var expr = tcbExpression(this.binding.value, this.tcb, this.scope);
            this.scope.addStatement(ts.createExpressionStatement(expr));
            return null;
        };
        return TcbTextInterpolationOp;
    }(TcbOp));
    /**
     * A `TcbOp` which constructs an instance of a directive _without_ setting any of its inputs. Inputs
     * are later set in the `TcbDirectiveInputsOp`. Type checking was found to be faster when done in
     * this way as opposed to `TcbDirectiveCtorOp` which is only necessary when the directive is
     * generic.
     *
     * Executing this operation returns a reference to the directive instance variable with its inferred
     * type.
     */
    var TcbDirectiveTypeOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbDirectiveTypeOp, _super);
        function TcbDirectiveTypeOp(tcb, scope, node, dir) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.node = node;
            _this.dir = dir;
            return _this;
        }
        Object.defineProperty(TcbDirectiveTypeOp.prototype, "optional", {
            get: function () {
                // The statement generated by this operation is only used to declare the directive's type and
                // won't report diagnostics by itself, so the operation is marked as optional to avoid
                // generating declarations for directives that don't have any inputs/outputs.
                return true;
            },
            enumerable: false,
            configurable: true
        });
        TcbDirectiveTypeOp.prototype.execute = function () {
            var id = this.tcb.allocateId();
            var type = this.tcb.env.referenceType(this.dir.ref);
            this.scope.addStatement(ts_util_1.tsDeclareVariable(id, type));
            return id;
        };
        return TcbDirectiveTypeOp;
    }(TcbOp));
    /**
     * A `TcbOp` which constructs an instance of a directive with types inferred from its inputs. The
     * inputs themselves are not checked here; checking of inputs is achieved in `TcbDirectiveInputsOp`.
     * Any errors reported in this statement are ignored, as the type constructor call is only present
     * for type-inference.
     *
     * When a Directive is generic, it is required that the TCB generates the instance using this method
     * in order to infer the type information correctly.
     *
     * Executing this operation returns a reference to the directive instance variable with its inferred
     * type.
     */
    var TcbDirectiveCtorOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbDirectiveCtorOp, _super);
        function TcbDirectiveCtorOp(tcb, scope, node, dir) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.node = node;
            _this.dir = dir;
            return _this;
        }
        Object.defineProperty(TcbDirectiveCtorOp.prototype, "optional", {
            get: function () {
                // The statement generated by this operation is only used to infer the directive's type and
                // won't report diagnostics by itself, so the operation is marked as optional.
                return true;
            },
            enumerable: false,
            configurable: true
        });
        TcbDirectiveCtorOp.prototype.execute = function () {
            var e_2, _a, e_3, _b, e_4, _c;
            var id = this.tcb.allocateId();
            var genericInputs = new Map();
            var inputs = getBoundInputs(this.dir, this.node, this.tcb);
            try {
                for (var inputs_1 = tslib_1.__values(inputs), inputs_1_1 = inputs_1.next(); !inputs_1_1.done; inputs_1_1 = inputs_1.next()) {
                    var input = inputs_1_1.value;
                    try {
                        for (var _d = (e_3 = void 0, tslib_1.__values(input.fieldNames)), _e = _d.next(); !_e.done; _e = _d.next()) {
                            var fieldName = _e.value;
                            // Skip the field if an attribute has already been bound to it; we can't have a duplicate
                            // key in the type constructor call.
                            if (genericInputs.has(fieldName)) {
                                continue;
                            }
                            var expression = translateInput(input.attribute, this.tcb, this.scope);
                            genericInputs.set(fieldName, {
                                type: 'binding',
                                field: fieldName,
                                expression: expression,
                                sourceSpan: input.attribute.sourceSpan
                            });
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_e && !_e.done && (_b = _d.return)) _b.call(_d);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (inputs_1_1 && !inputs_1_1.done && (_a = inputs_1.return)) _a.call(inputs_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
            try {
                // Add unset directive inputs for each of the remaining unset fields.
                for (var _f = tslib_1.__values(this.dir.inputs), _g = _f.next(); !_g.done; _g = _f.next()) {
                    var _h = tslib_1.__read(_g.value, 1), fieldName = _h[0];
                    if (!genericInputs.has(fieldName)) {
                        genericInputs.set(fieldName, { type: 'unset', field: fieldName });
                    }
                }
            }
            catch (e_4_1) { e_4 = { error: e_4_1 }; }
            finally {
                try {
                    if (_g && !_g.done && (_c = _f.return)) _c.call(_f);
                }
                finally { if (e_4) throw e_4.error; }
            }
            // Call the type constructor of the directive to infer a type, and assign the directive
            // instance.
            var typeCtor = tcbCallTypeCtor(this.dir, this.tcb, Array.from(genericInputs.values()));
            diagnostics_1.ignoreDiagnostics(typeCtor);
            this.scope.addStatement(ts_util_1.tsCreateVariable(id, typeCtor));
            return id;
        };
        TcbDirectiveCtorOp.prototype.circularFallback = function () {
            return new TcbDirectiveCtorCircularFallbackOp(this.tcb, this.scope, this.node, this.dir);
        };
        return TcbDirectiveCtorOp;
    }(TcbOp));
    /**
     * A `TcbOp` which generates code to check input bindings on an element that correspond with the
     * members of a directive.
     *
     * Executing this operation returns nothing.
     */
    var TcbDirectiveInputsOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbDirectiveInputsOp, _super);
        function TcbDirectiveInputsOp(tcb, scope, node, dir) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.node = node;
            _this.dir = dir;
            return _this;
        }
        Object.defineProperty(TcbDirectiveInputsOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbDirectiveInputsOp.prototype.execute = function () {
            var e_5, _a, e_6, _b;
            var dirId = null;
            // TODO(joost): report duplicate properties
            var inputs = getBoundInputs(this.dir, this.node, this.tcb);
            try {
                for (var inputs_2 = tslib_1.__values(inputs), inputs_2_1 = inputs_2.next(); !inputs_2_1.done; inputs_2_1 = inputs_2.next()) {
                    var input = inputs_2_1.value;
                    // For bound inputs, the property is assigned the binding expression.
                    var expr = translateInput(input.attribute, this.tcb, this.scope);
                    if (!this.tcb.env.config.checkTypeOfInputBindings) {
                        // If checking the type of bindings is disabled, cast the resulting expression to 'any'
                        // before the assignment.
                        expr = ts_util_1.tsCastToAny(expr);
                    }
                    else if (!this.tcb.env.config.strictNullInputBindings) {
                        // If strict null checks are disabled, erase `null` and `undefined` from the type by
                        // wrapping the expression in a non-null assertion.
                        expr = ts.createNonNullExpression(expr);
                    }
                    var assignment = diagnostics_1.wrapForDiagnostics(expr);
                    try {
                        for (var _c = (e_6 = void 0, tslib_1.__values(input.fieldNames)), _d = _c.next(); !_d.done; _d = _c.next()) {
                            var fieldName = _d.value;
                            var target = void 0;
                            if (this.dir.coercedInputFields.has(fieldName)) {
                                // The input has a coercion declaration which should be used instead of assigning the
                                // expression into the input field directly. To achieve this, a variable is declared
                                // with a type of `typeof Directive.ngAcceptInputType_fieldName` which is then used as
                                // target of the assignment.
                                var dirTypeRef = this.tcb.env.referenceType(this.dir.ref);
                                if (!ts.isTypeReferenceNode(dirTypeRef)) {
                                    throw new Error("Expected TypeReferenceNode from reference to " + this.dir.ref.debugName);
                                }
                                var id = this.tcb.allocateId();
                                var type = ts_util_1.tsCreateTypeQueryForCoercedInput(dirTypeRef.typeName, fieldName);
                                this.scope.addStatement(ts_util_1.tsDeclareVariable(id, type));
                                target = id;
                            }
                            else if (this.dir.undeclaredInputFields.has(fieldName)) {
                                // If no coercion declaration is present nor is the field declared (i.e. the input is
                                // declared in a `@Directive` or `@Component` decorator's `inputs` property) there is no
                                // assignment target available, so this field is skipped.
                                continue;
                            }
                            else if (!this.tcb.env.config.honorAccessModifiersForInputBindings &&
                                this.dir.restrictedInputFields.has(fieldName)) {
                                // If strict checking of access modifiers is disabled and the field is restricted
                                // (i.e. private/protected/readonly), generate an assignment into a temporary variable
                                // that has the type of the field. This achieves type-checking but circumvents the access
                                // modifiers.
                                if (dirId === null) {
                                    dirId = this.scope.resolve(this.node, this.dir);
                                }
                                var id = this.tcb.allocateId();
                                var dirTypeRef = this.tcb.env.referenceType(this.dir.ref);
                                if (!ts.isTypeReferenceNode(dirTypeRef)) {
                                    throw new Error("Expected TypeReferenceNode from reference to " + this.dir.ref.debugName);
                                }
                                var type = ts.createIndexedAccessTypeNode(ts.createTypeQueryNode(dirId), ts.createLiteralTypeNode(ts.createStringLiteral(fieldName)));
                                var temp = ts_util_1.tsDeclareVariable(id, type);
                                this.scope.addStatement(temp);
                                target = id;
                            }
                            else {
                                if (dirId === null) {
                                    dirId = this.scope.resolve(this.node, this.dir);
                                }
                                // To get errors assign directly to the fields on the instance, using property access
                                // when possible. String literal fields may not be valid JS identifiers so we use
                                // literal element access instead for those cases.
                                target = this.dir.stringLiteralInputFields.has(fieldName) ?
                                    ts.createElementAccess(dirId, ts.createStringLiteral(fieldName)) :
                                    ts.createPropertyAccess(dirId, ts.createIdentifier(fieldName));
                            }
                            // Finally the assignment is extended by assigning it into the target expression.
                            assignment = ts.createBinary(target, ts.SyntaxKind.EqualsToken, assignment);
                        }
                    }
                    catch (e_6_1) { e_6 = { error: e_6_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                        }
                        finally { if (e_6) throw e_6.error; }
                    }
                    diagnostics_1.addParseSpanInfo(assignment, input.attribute.sourceSpan);
                    this.scope.addStatement(ts.createExpressionStatement(assignment));
                }
            }
            catch (e_5_1) { e_5 = { error: e_5_1 }; }
            finally {
                try {
                    if (inputs_2_1 && !inputs_2_1.done && (_a = inputs_2.return)) _a.call(inputs_2);
                }
                finally { if (e_5) throw e_5.error; }
            }
            return null;
        };
        return TcbDirectiveInputsOp;
    }(TcbOp));
    /**
     * A `TcbOp` which is used to generate a fallback expression if the inference of a directive type
     * via `TcbDirectiveCtorOp` requires a reference to its own type. This can happen using a template
     * reference:
     *
     * ```html
     * <some-cmp #ref [prop]="ref.foo"></some-cmp>
     * ```
     *
     * In this case, `TcbDirectiveCtorCircularFallbackOp` will add a second inference of the directive
     * type to the type-check block, this time calling the directive's type constructor without any
     * input expressions. This infers the widest possible supertype for the directive, which is used to
     * resolve any recursive references required to infer the real type.
     */
    var TcbDirectiveCtorCircularFallbackOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbDirectiveCtorCircularFallbackOp, _super);
        function TcbDirectiveCtorCircularFallbackOp(tcb, scope, node, dir) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.node = node;
            _this.dir = dir;
            return _this;
        }
        Object.defineProperty(TcbDirectiveCtorCircularFallbackOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbDirectiveCtorCircularFallbackOp.prototype.execute = function () {
            var id = this.tcb.allocateId();
            var typeCtor = this.tcb.env.typeCtorFor(this.dir);
            var circularPlaceholder = ts.createCall(typeCtor, /* typeArguments */ undefined, [ts.createNonNullExpression(ts.createNull())]);
            this.scope.addStatement(ts_util_1.tsCreateVariable(id, circularPlaceholder));
            return id;
        };
        return TcbDirectiveCtorCircularFallbackOp;
    }(TcbOp));
    /**
     * A `TcbOp` which feeds elements and unclaimed properties to the `DomSchemaChecker`.
     *
     * The DOM schema is not checked via TCB code generation. Instead, the `DomSchemaChecker` ingests
     * elements and property bindings and accumulates synthetic `ts.Diagnostic`s out-of-band. These are
     * later merged with the diagnostics generated from the TCB.
     *
     * For convenience, the TCB iteration of the template is used to drive the `DomSchemaChecker` via
     * the `TcbDomSchemaCheckerOp`.
     */
    var TcbDomSchemaCheckerOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbDomSchemaCheckerOp, _super);
        function TcbDomSchemaCheckerOp(tcb, element, checkElement, claimedInputs) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.element = element;
            _this.checkElement = checkElement;
            _this.claimedInputs = claimedInputs;
            return _this;
        }
        Object.defineProperty(TcbDomSchemaCheckerOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbDomSchemaCheckerOp.prototype.execute = function () {
            var e_7, _a;
            if (this.checkElement) {
                this.tcb.domSchemaChecker.checkElement(this.tcb.id, this.element, this.tcb.schemas);
            }
            try {
                // TODO(alxhub): this could be more efficient.
                for (var _b = tslib_1.__values(this.element.inputs), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var binding = _c.value;
                    if (binding.type === 0 /* Property */ && this.claimedInputs.has(binding.name)) {
                        // Skip this binding as it was claimed by a directive.
                        continue;
                    }
                    if (binding.type === 0 /* Property */) {
                        if (binding.name !== 'style' && binding.name !== 'class') {
                            // A direct binding to a property.
                            var propertyName = ATTR_TO_PROP[binding.name] || binding.name;
                            this.tcb.domSchemaChecker.checkProperty(this.tcb.id, this.element, propertyName, binding.sourceSpan, this.tcb.schemas);
                        }
                    }
                }
            }
            catch (e_7_1) { e_7 = { error: e_7_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_7) throw e_7.error; }
            }
            return null;
        };
        return TcbDomSchemaCheckerOp;
    }(TcbOp));
    /**
     * Mapping between attributes names that don't correspond to their element property names.
     * Note: this mapping has to be kept in sync with the equally named mapping in the runtime.
     */
    var ATTR_TO_PROP = {
        'class': 'className',
        'for': 'htmlFor',
        'formaction': 'formAction',
        'innerHtml': 'innerHTML',
        'readonly': 'readOnly',
        'tabindex': 'tabIndex',
    };
    /**
     * A `TcbOp` which generates code to check "unclaimed inputs" - bindings on an element which were
     * not attributed to any directive or component, and are instead processed against the HTML element
     * itself.
     *
     * Currently, only the expressions of these bindings are checked. The targets of the bindings are
     * checked against the DOM schema via a `TcbDomSchemaCheckerOp`.
     *
     * Executing this operation returns nothing.
     */
    var TcbUnclaimedInputsOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbUnclaimedInputsOp, _super);
        function TcbUnclaimedInputsOp(tcb, scope, element, claimedInputs) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.element = element;
            _this.claimedInputs = claimedInputs;
            return _this;
        }
        Object.defineProperty(TcbUnclaimedInputsOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbUnclaimedInputsOp.prototype.execute = function () {
            var e_8, _a;
            // `this.inputs` contains only those bindings not matched by any directive. These bindings go to
            // the element itself.
            var elId = null;
            try {
                // TODO(alxhub): this could be more efficient.
                for (var _b = tslib_1.__values(this.element.inputs), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var binding = _c.value;
                    if (binding.type === 0 /* Property */ && this.claimedInputs.has(binding.name)) {
                        // Skip this binding as it was claimed by a directive.
                        continue;
                    }
                    var expr = tcbExpression(binding.value, this.tcb, this.scope);
                    if (!this.tcb.env.config.checkTypeOfInputBindings) {
                        // If checking the type of bindings is disabled, cast the resulting expression to 'any'
                        // before the assignment.
                        expr = ts_util_1.tsCastToAny(expr);
                    }
                    else if (!this.tcb.env.config.strictNullInputBindings) {
                        // If strict null checks are disabled, erase `null` and `undefined` from the type by
                        // wrapping the expression in a non-null assertion.
                        expr = ts.createNonNullExpression(expr);
                    }
                    if (this.tcb.env.config.checkTypeOfDomBindings && binding.type === 0 /* Property */) {
                        if (binding.name !== 'style' && binding.name !== 'class') {
                            if (elId === null) {
                                elId = this.scope.resolve(this.element);
                            }
                            // A direct binding to a property.
                            var propertyName = ATTR_TO_PROP[binding.name] || binding.name;
                            var prop = ts.createElementAccess(elId, ts.createStringLiteral(propertyName));
                            var stmt = ts.createBinary(prop, ts.SyntaxKind.EqualsToken, diagnostics_1.wrapForDiagnostics(expr));
                            diagnostics_1.addParseSpanInfo(stmt, binding.sourceSpan);
                            this.scope.addStatement(ts.createExpressionStatement(stmt));
                        }
                        else {
                            this.scope.addStatement(ts.createExpressionStatement(expr));
                        }
                    }
                    else {
                        // A binding to an animation, attribute, class or style. For now, only validate the right-
                        // hand side of the expression.
                        // TODO: properly check class and style bindings.
                        this.scope.addStatement(ts.createExpressionStatement(expr));
                    }
                }
            }
            catch (e_8_1) { e_8 = { error: e_8_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_8) throw e_8.error; }
            }
            return null;
        };
        return TcbUnclaimedInputsOp;
    }(TcbOp));
    /**
     * A `TcbOp` which generates code to check event bindings on an element that correspond with the
     * outputs of a directive.
     *
     * Executing this operation returns nothing.
     */
    var TcbDirectiveOutputsOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbDirectiveOutputsOp, _super);
        function TcbDirectiveOutputsOp(tcb, scope, node, dir) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.node = node;
            _this.dir = dir;
            return _this;
        }
        Object.defineProperty(TcbDirectiveOutputsOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbDirectiveOutputsOp.prototype.execute = function () {
            var e_9, _a;
            var dirId = null;
            var outputs = this.dir.outputs;
            try {
                for (var _b = tslib_1.__values(this.node.outputs), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var output = _c.value;
                    if (output.type !== 0 /* Regular */ || !outputs.hasBindingPropertyName(output.name)) {
                        continue;
                    }
                    // TODO(alxhub): consider supporting multiple fields with the same property name for outputs.
                    var field = outputs.getByBindingPropertyName(output.name)[0].classPropertyName;
                    if (this.tcb.env.config.checkTypeOfOutputEvents) {
                        // For strict checking of directive events, generate a call to the `subscribe` method
                        // on the directive's output field to let type information flow into the handler function's
                        // `$event` parameter.
                        //
                        // Note that the `EventEmitter<T>` type from '@angular/core' that is typically used for
                        // outputs has a typings deficiency in its `subscribe` method. The generic type `T` is not
                        // carried into the handler function, which is vital for inference of the type of `$event`.
                        // As a workaround, the directive's field is passed into a helper function that has a
                        // specially crafted set of signatures, to effectively cast `EventEmitter<T>` to something
                        // that has a `subscribe` method that properly carries the `T` into the handler function.
                        var handler = tcbCreateEventHandler(output, this.tcb, this.scope, 0 /* Infer */);
                        if (dirId === null) {
                            dirId = this.scope.resolve(this.node, this.dir);
                        }
                        var outputField = ts.createElementAccess(dirId, ts.createStringLiteral(field));
                        var outputHelper = ts.createCall(this.tcb.env.declareOutputHelper(), undefined, [outputField]);
                        var subscribeFn = ts.createPropertyAccess(outputHelper, 'subscribe');
                        var call = ts.createCall(subscribeFn, /* typeArguments */ undefined, [handler]);
                        diagnostics_1.addParseSpanInfo(call, output.sourceSpan);
                        this.scope.addStatement(ts.createExpressionStatement(call));
                    }
                    else {
                        // If strict checking of directive events is disabled, emit a handler function where the
                        // `$event` parameter has an explicit `any` type.
                        var handler = tcbCreateEventHandler(output, this.tcb, this.scope, 1 /* Any */);
                        this.scope.addStatement(ts.createExpressionStatement(handler));
                    }
                    template_semantics_1.ExpressionSemanticVisitor.visit(output.handler, this.tcb.id, this.tcb.boundTarget, this.tcb.oobRecorder);
                }
            }
            catch (e_9_1) { e_9 = { error: e_9_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_9) throw e_9.error; }
            }
            return null;
        };
        return TcbDirectiveOutputsOp;
    }(TcbOp));
    /**
     * A `TcbOp` which generates code to check "unclaimed outputs" - event bindings on an element which
     * were not attributed to any directive or component, and are instead processed against the HTML
     * element itself.
     *
     * Executing this operation returns nothing.
     */
    var TcbUnclaimedOutputsOp = /** @class */ (function (_super) {
        tslib_1.__extends(TcbUnclaimedOutputsOp, _super);
        function TcbUnclaimedOutputsOp(tcb, scope, element, claimedOutputs) {
            var _this = _super.call(this) || this;
            _this.tcb = tcb;
            _this.scope = scope;
            _this.element = element;
            _this.claimedOutputs = claimedOutputs;
            return _this;
        }
        Object.defineProperty(TcbUnclaimedOutputsOp.prototype, "optional", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        TcbUnclaimedOutputsOp.prototype.execute = function () {
            var e_10, _a;
            var elId = null;
            try {
                // TODO(alxhub): this could be more efficient.
                for (var _b = tslib_1.__values(this.element.outputs), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var output = _c.value;
                    if (this.claimedOutputs.has(output.name)) {
                        // Skip this event handler as it was claimed by a directive.
                        continue;
                    }
                    if (output.type === 1 /* Animation */) {
                        // Animation output bindings always have an `$event` parameter of type `AnimationEvent`.
                        var eventType = this.tcb.env.config.checkTypeOfAnimationEvents ?
                            this.tcb.env.referenceExternalType('@angular/animations', 'AnimationEvent') :
                            1 /* Any */;
                        var handler = tcbCreateEventHandler(output, this.tcb, this.scope, eventType);
                        this.scope.addStatement(ts.createExpressionStatement(handler));
                    }
                    else if (this.tcb.env.config.checkTypeOfDomEvents) {
                        // If strict checking of DOM events is enabled, generate a call to `addEventListener` on
                        // the element instance so that TypeScript's type inference for
                        // `HTMLElement.addEventListener` using `HTMLElementEventMap` to infer an accurate type for
                        // `$event` depending on the event name. For unknown event names, TypeScript resorts to the
                        // base `Event` type.
                        var handler = tcbCreateEventHandler(output, this.tcb, this.scope, 0 /* Infer */);
                        if (elId === null) {
                            elId = this.scope.resolve(this.element);
                        }
                        var call = ts.createCall(
                        /* expression */ ts.createPropertyAccess(elId, 'addEventListener'), 
                        /* typeArguments */ undefined, 
                        /* arguments */ [ts.createStringLiteral(output.name), handler]);
                        diagnostics_1.addParseSpanInfo(call, output.sourceSpan);
                        this.scope.addStatement(ts.createExpressionStatement(call));
                    }
                    else {
                        // If strict checking of DOM inputs is disabled, emit a handler function where the `$event`
                        // parameter has an explicit `any` type.
                        var handler = tcbCreateEventHandler(output, this.tcb, this.scope, 1 /* Any */);
                        this.scope.addStatement(ts.createExpressionStatement(handler));
                    }
                    template_semantics_1.ExpressionSemanticVisitor.visit(output.handler, this.tcb.id, this.tcb.boundTarget, this.tcb.oobRecorder);
                }
            }
            catch (e_10_1) { e_10 = { error: e_10_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_10) throw e_10.error; }
            }
            return null;
        };
        return TcbUnclaimedOutputsOp;
    }(TcbOp));
    /**
     * Value used to break a circular reference between `TcbOp`s.
     *
     * This value is returned whenever `TcbOp`s have a circular dependency. The expression is a non-null
     * assertion of the null value (in TypeScript, the expression `null!`). This construction will infer
     * the least narrow type for whatever it's assigned to.
     */
    var INFER_TYPE_FOR_CIRCULAR_OP_EXPR = ts.createNonNullExpression(ts.createNull());
    /**
     * Overall generation context for the type check block.
     *
     * `Context` handles operations during code generation which are global with respect to the whole
     * block. It's responsible for variable name allocation and management of any imports needed. It
     * also contains the template metadata itself.
     */
    var Context = /** @class */ (function () {
        function Context(env, domSchemaChecker, oobRecorder, id, boundTarget, pipes, schemas) {
            this.env = env;
            this.domSchemaChecker = domSchemaChecker;
            this.oobRecorder = oobRecorder;
            this.id = id;
            this.boundTarget = boundTarget;
            this.pipes = pipes;
            this.schemas = schemas;
            this.nextId = 1;
        }
        /**
         * Allocate a new variable name for use within the `Context`.
         *
         * Currently this uses a monotonically increasing counter, but in the future the variable name
         * might change depending on the type of data being stored.
         */
        Context.prototype.allocateId = function () {
            return ts.createIdentifier("_t" + this.nextId++);
        };
        Context.prototype.getPipeByName = function (name) {
            if (!this.pipes.has(name)) {
                return null;
            }
            return this.env.pipeInst(this.pipes.get(name));
        };
        return Context;
    }());
    exports.Context = Context;
    /**
     * Local scope within the type check block for a particular template.
     *
     * The top-level template and each nested `<ng-template>` have their own `Scope`, which exist in a
     * hierarchy. The structure of this hierarchy mirrors the syntactic scopes in the generated type
     * check block, where each nested template is encased in an `if` structure.
     *
     * As a template's `TcbOp`s are executed in a given `Scope`, statements are added via
     * `addStatement()`. When this processing is complete, the `Scope` can be turned into a `ts.Block`
     * via `renderToBlock()`.
     *
     * If a `TcbOp` requires the output of another, it can call `resolve()`.
     */
    var Scope = /** @class */ (function () {
        function Scope(tcb, parent, guard) {
            if (parent === void 0) { parent = null; }
            if (guard === void 0) { guard = null; }
            this.tcb = tcb;
            this.parent = parent;
            this.guard = guard;
            /**
             * A queue of operations which need to be performed to generate the TCB code for this scope.
             *
             * This array can contain either a `TcbOp` which has yet to be executed, or a `ts.Expression|null`
             * representing the memoized result of executing the operation. As operations are executed, their
             * results are written into the `opQueue`, overwriting the original operation.
             *
             * If an operation is in the process of being executed, it is temporarily overwritten here with
             * `INFER_TYPE_FOR_CIRCULAR_OP_EXPR`. This way, if a cycle is encountered where an operation
             * depends transitively on its own result, the inner operation will infer the least narrow type
             * that fits instead. This has the same semantics as TypeScript itself when types are referenced
             * circularly.
             */
            this.opQueue = [];
            /**
             * A map of `TmplAstElement`s to the index of their `TcbElementOp` in the `opQueue`
             */
            this.elementOpMap = new Map();
            /**
             * A map of maps which tracks the index of `TcbDirectiveCtorOp`s in the `opQueue` for each
             * directive on a `TmplAstElement` or `TmplAstTemplate` node.
             */
            this.directiveOpMap = new Map();
            /**
             * Map of immediately nested <ng-template>s (within this `Scope`) represented by `TmplAstTemplate`
             * nodes to the index of their `TcbTemplateContextOp`s in the `opQueue`.
             */
            this.templateCtxOpMap = new Map();
            /**
             * Map of variables declared on the template that created this `Scope` (represented by
             * `TmplAstVariable` nodes) to the index of their `TcbVariableOp`s in the `opQueue`.
             */
            this.varMap = new Map();
            /**
             * Statements for this template.
             *
             * Executing the `TcbOp`s in the `opQueue` populates this array.
             */
            this.statements = [];
        }
        /**
         * Constructs a `Scope` given either a `TmplAstTemplate` or a list of `TmplAstNode`s.
         *
         * @param tcb the overall context of TCB generation.
         * @param parent the `Scope` of the parent template (if any) or `null` if this is the root
         * `Scope`.
         * @param templateOrNodes either a `TmplAstTemplate` representing the template for which to
         * calculate the `Scope`, or a list of nodes if no outer template object is available.
         * @param guard an expression that is applied to this scope for type narrowing purposes.
         */
        Scope.forNodes = function (tcb, parent, templateOrNodes, guard) {
            var e_11, _a, e_12, _b;
            var scope = new Scope(tcb, parent, guard);
            var children;
            // If given an actual `TmplAstTemplate` instance, then process any additional information it
            // has.
            if (templateOrNodes instanceof compiler_1.TmplAstTemplate) {
                // The template's variable declarations need to be added as `TcbVariableOp`s.
                var varMap = new Map();
                try {
                    for (var _c = tslib_1.__values(templateOrNodes.variables), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var v = _d.value;
                        // Validate that variables on the `TmplAstTemplate` are only declared once.
                        if (!varMap.has(v.name)) {
                            varMap.set(v.name, v);
                        }
                        else {
                            var firstDecl = varMap.get(v.name);
                            tcb.oobRecorder.duplicateTemplateVar(tcb.id, v, firstDecl);
                        }
                        var opIndex = scope.opQueue.push(new TcbVariableOp(tcb, scope, templateOrNodes, v)) - 1;
                        scope.varMap.set(v, opIndex);
                    }
                }
                catch (e_11_1) { e_11 = { error: e_11_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                    }
                    finally { if (e_11) throw e_11.error; }
                }
                children = templateOrNodes.children;
            }
            else {
                children = templateOrNodes;
            }
            try {
                for (var children_1 = tslib_1.__values(children), children_1_1 = children_1.next(); !children_1_1.done; children_1_1 = children_1.next()) {
                    var node = children_1_1.value;
                    scope.appendNode(node);
                }
            }
            catch (e_12_1) { e_12 = { error: e_12_1 }; }
            finally {
                try {
                    if (children_1_1 && !children_1_1.done && (_b = children_1.return)) _b.call(children_1);
                }
                finally { if (e_12) throw e_12.error; }
            }
            return scope;
        };
        /**
         * Look up a `ts.Expression` representing the value of some operation in the current `Scope`,
         * including any parent scope(s).
         *
         * @param node a `TmplAstNode` of the operation in question. The lookup performed will depend on
         * the type of this node:
         *
         * Assuming `directive` is not present, then `resolve` will return:
         *
         * * `TmplAstElement` - retrieve the expression for the element DOM node
         * * `TmplAstTemplate` - retrieve the template context variable
         * * `TmplAstVariable` - retrieve a template let- variable
         *
         * @param directive if present, a directive type on a `TmplAstElement` or `TmplAstTemplate` to
         * look up instead of the default for an element or template node.
         */
        Scope.prototype.resolve = function (node, directive) {
            // Attempt to resolve the operation locally.
            var res = this.resolveLocal(node, directive);
            if (res !== null) {
                return res;
            }
            else if (this.parent !== null) {
                // Check with the parent.
                return this.parent.resolve(node, directive);
            }
            else {
                throw new Error("Could not resolve " + node + " / " + directive);
            }
        };
        /**
         * Add a statement to this scope.
         */
        Scope.prototype.addStatement = function (stmt) {
            this.statements.push(stmt);
        };
        /**
         * Get the statements.
         */
        Scope.prototype.render = function () {
            for (var i = 0; i < this.opQueue.length; i++) {
                this.executeOp(i, /* skipOptional */ true);
            }
            return this.statements;
        };
        /**
         * Returns an expression of all template guards that apply to this scope, including those of
         * parent scopes. If no guards have been applied, null is returned.
         */
        Scope.prototype.guards = function () {
            var parentGuards = null;
            if (this.parent !== null) {
                // Start with the guards from the parent scope, if present.
                parentGuards = this.parent.guards();
            }
            if (this.guard === null) {
                // This scope does not have a guard, so return the parent's guards as is.
                return parentGuards;
            }
            else if (parentGuards === null) {
                // There's no guards from the parent scope, so this scope's guard represents all available
                // guards.
                return this.guard;
            }
            else {
                // Both the parent scope and this scope provide a guard, so create a combination of the two.
                // It is important that the parent guard is used as left operand, given that it may provide
                // narrowing that is required for this scope's guard to be valid.
                return ts.createBinary(parentGuards, ts.SyntaxKind.AmpersandAmpersandToken, this.guard);
            }
        };
        Scope.prototype.resolveLocal = function (ref, directive) {
            if (ref instanceof compiler_1.TmplAstVariable && this.varMap.has(ref)) {
                // Resolving a context variable for this template.
                // Execute the `TcbVariableOp` associated with the `TmplAstVariable`.
                return this.resolveOp(this.varMap.get(ref));
            }
            else if (ref instanceof compiler_1.TmplAstTemplate && directive === undefined &&
                this.templateCtxOpMap.has(ref)) {
                // Resolving the context of the given sub-template.
                // Execute the `TcbTemplateContextOp` for the template.
                return this.resolveOp(this.templateCtxOpMap.get(ref));
            }
            else if ((ref instanceof compiler_1.TmplAstElement || ref instanceof compiler_1.TmplAstTemplate) &&
                directive !== undefined && this.directiveOpMap.has(ref)) {
                // Resolving a directive on an element or sub-template.
                var dirMap = this.directiveOpMap.get(ref);
                if (dirMap.has(directive)) {
                    return this.resolveOp(dirMap.get(directive));
                }
                else {
                    return null;
                }
            }
            else if (ref instanceof compiler_1.TmplAstElement && this.elementOpMap.has(ref)) {
                // Resolving the DOM node of an element in this template.
                return this.resolveOp(this.elementOpMap.get(ref));
            }
            else {
                return null;
            }
        };
        /**
         * Like `executeOp`, but assert that the operation actually returned `ts.Expression`.
         */
        Scope.prototype.resolveOp = function (opIndex) {
            var res = this.executeOp(opIndex, /* skipOptional */ false);
            if (res === null) {
                throw new Error("Error resolving operation, got null");
            }
            return res;
        };
        /**
         * Execute a particular `TcbOp` in the `opQueue`.
         *
         * This method replaces the operation in the `opQueue` with the result of execution (once done)
         * and also protects against a circular dependency from the operation to itself by temporarily
         * setting the operation's result to a special expression.
         */
        Scope.prototype.executeOp = function (opIndex, skipOptional) {
            var op = this.opQueue[opIndex];
            if (!(op instanceof TcbOp)) {
                return op;
            }
            if (skipOptional && op.optional) {
                return null;
            }
            // Set the result of the operation in the queue to its circular fallback. If executing this
            // operation results in a circular dependency, this will prevent an infinite loop and allow for
            // the resolution of such cycles.
            this.opQueue[opIndex] = op.circularFallback();
            var res = op.execute();
            // Once the operation has finished executing, it's safe to cache the real result.
            this.opQueue[opIndex] = res;
            return res;
        };
        Scope.prototype.appendNode = function (node) {
            var e_13, _a;
            if (node instanceof compiler_1.TmplAstElement) {
                var opIndex = this.opQueue.push(new TcbElementOp(this.tcb, this, node)) - 1;
                this.elementOpMap.set(node, opIndex);
                this.appendDirectivesAndInputsOfNode(node);
                this.appendOutputsOfNode(node);
                try {
                    for (var _b = tslib_1.__values(node.children), _c = _b.next(); !_c.done; _c = _b.next()) {
                        var child = _c.value;
                        this.appendNode(child);
                    }
                }
                catch (e_13_1) { e_13 = { error: e_13_1 }; }
                finally {
                    try {
                        if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                    }
                    finally { if (e_13) throw e_13.error; }
                }
                this.checkReferencesOfNode(node);
            }
            else if (node instanceof compiler_1.TmplAstTemplate) {
                // Template children are rendered in a child scope.
                this.appendDirectivesAndInputsOfNode(node);
                this.appendOutputsOfNode(node);
                if (this.tcb.env.config.checkTemplateBodies) {
                    var ctxIndex = this.opQueue.push(new TcbTemplateContextOp(this.tcb, this)) - 1;
                    this.templateCtxOpMap.set(node, ctxIndex);
                    this.opQueue.push(new TcbTemplateBodyOp(this.tcb, this, node));
                }
                else if (this.tcb.env.config.alwaysCheckSchemaInTemplateBodies) {
                    this.appendDeepSchemaChecks(node.children);
                }
                this.checkReferencesOfNode(node);
            }
            else if (node instanceof compiler_1.TmplAstBoundText) {
                this.opQueue.push(new TcbTextInterpolationOp(this.tcb, this, node));
            }
        };
        Scope.prototype.checkReferencesOfNode = function (node) {
            var e_14, _a;
            try {
                for (var _b = tslib_1.__values(node.references), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var ref = _c.value;
                    if (this.tcb.boundTarget.getReferenceTarget(ref) === null) {
                        this.tcb.oobRecorder.missingReferenceTarget(this.tcb.id, ref);
                    }
                }
            }
            catch (e_14_1) { e_14 = { error: e_14_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_14) throw e_14.error; }
            }
        };
        Scope.prototype.appendDirectivesAndInputsOfNode = function (node) {
            var e_15, _a, e_16, _b, e_17, _c;
            // Collect all the inputs on the element.
            var claimedInputs = new Set();
            var directives = this.tcb.boundTarget.getDirectivesOfNode(node);
            if (directives === null || directives.length === 0) {
                // If there are no directives, then all inputs are unclaimed inputs, so queue an operation
                // to add them if needed.
                if (node instanceof compiler_1.TmplAstElement) {
                    this.opQueue.push(new TcbUnclaimedInputsOp(this.tcb, this, node, claimedInputs));
                    this.opQueue.push(new TcbDomSchemaCheckerOp(this.tcb, node, /* checkElement */ true, claimedInputs));
                }
                return;
            }
            var dirMap = new Map();
            try {
                for (var directives_2 = tslib_1.__values(directives), directives_2_1 = directives_2.next(); !directives_2_1.done; directives_2_1 = directives_2.next()) {
                    var dir = directives_2_1.value;
                    var directiveOp = dir.isGeneric ? new TcbDirectiveCtorOp(this.tcb, this, node, dir) :
                        new TcbDirectiveTypeOp(this.tcb, this, node, dir);
                    var dirIndex = this.opQueue.push(directiveOp) - 1;
                    dirMap.set(dir, dirIndex);
                    this.opQueue.push(new TcbDirectiveInputsOp(this.tcb, this, node, dir));
                }
            }
            catch (e_15_1) { e_15 = { error: e_15_1 }; }
            finally {
                try {
                    if (directives_2_1 && !directives_2_1.done && (_a = directives_2.return)) _a.call(directives_2);
                }
                finally { if (e_15) throw e_15.error; }
            }
            this.directiveOpMap.set(node, dirMap);
            // After expanding the directives, we might need to queue an operation to check any unclaimed
            // inputs.
            if (node instanceof compiler_1.TmplAstElement) {
                try {
                    // Go through the directives and remove any inputs that it claims from `elementInputs`.
                    for (var directives_3 = tslib_1.__values(directives), directives_3_1 = directives_3.next(); !directives_3_1.done; directives_3_1 = directives_3.next()) {
                        var dir = directives_3_1.value;
                        try {
                            for (var _d = (e_17 = void 0, tslib_1.__values(dir.inputs.propertyNames)), _e = _d.next(); !_e.done; _e = _d.next()) {
                                var propertyName = _e.value;
                                claimedInputs.add(propertyName);
                            }
                        }
                        catch (e_17_1) { e_17 = { error: e_17_1 }; }
                        finally {
                            try {
                                if (_e && !_e.done && (_c = _d.return)) _c.call(_d);
                            }
                            finally { if (e_17) throw e_17.error; }
                        }
                    }
                }
                catch (e_16_1) { e_16 = { error: e_16_1 }; }
                finally {
                    try {
                        if (directives_3_1 && !directives_3_1.done && (_b = directives_3.return)) _b.call(directives_3);
                    }
                    finally { if (e_16) throw e_16.error; }
                }
                this.opQueue.push(new TcbUnclaimedInputsOp(this.tcb, this, node, claimedInputs));
                // If there are no directives which match this element, then it's a "plain" DOM element (or a
                // web component), and should be checked against the DOM schema. If any directives match,
                // we must assume that the element could be custom (either a component, or a directive like
                // <router-outlet>) and shouldn't validate the element name itself.
                var checkElement = directives.length === 0;
                this.opQueue.push(new TcbDomSchemaCheckerOp(this.tcb, node, checkElement, claimedInputs));
            }
        };
        Scope.prototype.appendOutputsOfNode = function (node) {
            var e_18, _a, e_19, _b, e_20, _c;
            // Collect all the outputs on the element.
            var claimedOutputs = new Set();
            var directives = this.tcb.boundTarget.getDirectivesOfNode(node);
            if (directives === null || directives.length === 0) {
                // If there are no directives, then all outputs are unclaimed outputs, so queue an operation
                // to add them if needed.
                if (node instanceof compiler_1.TmplAstElement) {
                    this.opQueue.push(new TcbUnclaimedOutputsOp(this.tcb, this, node, claimedOutputs));
                }
                return;
            }
            try {
                // Queue operations for all directives to check the relevant outputs for a directive.
                for (var directives_4 = tslib_1.__values(directives), directives_4_1 = directives_4.next(); !directives_4_1.done; directives_4_1 = directives_4.next()) {
                    var dir = directives_4_1.value;
                    this.opQueue.push(new TcbDirectiveOutputsOp(this.tcb, this, node, dir));
                }
            }
            catch (e_18_1) { e_18 = { error: e_18_1 }; }
            finally {
                try {
                    if (directives_4_1 && !directives_4_1.done && (_a = directives_4.return)) _a.call(directives_4);
                }
                finally { if (e_18) throw e_18.error; }
            }
            // After expanding the directives, we might need to queue an operation to check any unclaimed
            // outputs.
            if (node instanceof compiler_1.TmplAstElement) {
                try {
                    // Go through the directives and register any outputs that it claims in `claimedOutputs`.
                    for (var directives_5 = tslib_1.__values(directives), directives_5_1 = directives_5.next(); !directives_5_1.done; directives_5_1 = directives_5.next()) {
                        var dir = directives_5_1.value;
                        try {
                            for (var _d = (e_20 = void 0, tslib_1.__values(dir.outputs.propertyNames)), _e = _d.next(); !_e.done; _e = _d.next()) {
                                var outputProperty = _e.value;
                                claimedOutputs.add(outputProperty);
                            }
                        }
                        catch (e_20_1) { e_20 = { error: e_20_1 }; }
                        finally {
                            try {
                                if (_e && !_e.done && (_c = _d.return)) _c.call(_d);
                            }
                            finally { if (e_20) throw e_20.error; }
                        }
                    }
                }
                catch (e_19_1) { e_19 = { error: e_19_1 }; }
                finally {
                    try {
                        if (directives_5_1 && !directives_5_1.done && (_b = directives_5.return)) _b.call(directives_5);
                    }
                    finally { if (e_19) throw e_19.error; }
                }
                this.opQueue.push(new TcbUnclaimedOutputsOp(this.tcb, this, node, claimedOutputs));
            }
        };
        Scope.prototype.appendDeepSchemaChecks = function (nodes) {
            var e_21, _a, e_22, _b, e_23, _c;
            try {
                for (var nodes_1 = tslib_1.__values(nodes), nodes_1_1 = nodes_1.next(); !nodes_1_1.done; nodes_1_1 = nodes_1.next()) {
                    var node = nodes_1_1.value;
                    if (!(node instanceof compiler_1.TmplAstElement || node instanceof compiler_1.TmplAstTemplate)) {
                        continue;
                    }
                    if (node instanceof compiler_1.TmplAstElement) {
                        var claimedInputs = new Set();
                        var directives = this.tcb.boundTarget.getDirectivesOfNode(node);
                        var hasDirectives = void 0;
                        if (directives === null || directives.length === 0) {
                            hasDirectives = false;
                        }
                        else {
                            hasDirectives = true;
                            try {
                                for (var directives_6 = (e_22 = void 0, tslib_1.__values(directives)), directives_6_1 = directives_6.next(); !directives_6_1.done; directives_6_1 = directives_6.next()) {
                                    var dir = directives_6_1.value;
                                    try {
                                        for (var _d = (e_23 = void 0, tslib_1.__values(dir.inputs.propertyNames)), _e = _d.next(); !_e.done; _e = _d.next()) {
                                            var propertyName = _e.value;
                                            claimedInputs.add(propertyName);
                                        }
                                    }
                                    catch (e_23_1) { e_23 = { error: e_23_1 }; }
                                    finally {
                                        try {
                                            if (_e && !_e.done && (_c = _d.return)) _c.call(_d);
                                        }
                                        finally { if (e_23) throw e_23.error; }
                                    }
                                }
                            }
                            catch (e_22_1) { e_22 = { error: e_22_1 }; }
                            finally {
                                try {
                                    if (directives_6_1 && !directives_6_1.done && (_b = directives_6.return)) _b.call(directives_6);
                                }
                                finally { if (e_22) throw e_22.error; }
                            }
                        }
                        this.opQueue.push(new TcbDomSchemaCheckerOp(this.tcb, node, !hasDirectives, claimedInputs));
                    }
                    this.appendDeepSchemaChecks(node.children);
                }
            }
            catch (e_21_1) { e_21 = { error: e_21_1 }; }
            finally {
                try {
                    if (nodes_1_1 && !nodes_1_1.done && (_a = nodes_1.return)) _a.call(nodes_1);
                }
                finally { if (e_21) throw e_21.error; }
            }
        };
        return Scope;
    }());
    /**
     * Create the `ctx` parameter to the top-level TCB function.
     *
     * This is a parameter with a type equivalent to the component type, with all generic type
     * parameters listed (without their generic bounds).
     */
    function tcbCtxParam(node, name, useGenericType) {
        var typeArguments = undefined;
        // Check if the component is generic, and pass generic type parameters if so.
        if (node.typeParameters !== undefined) {
            if (useGenericType) {
                typeArguments =
                    node.typeParameters.map(function (param) { return ts.createTypeReferenceNode(param.name, undefined); });
            }
            else {
                typeArguments =
                    node.typeParameters.map(function () { return ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword); });
            }
        }
        var type = ts.createTypeReferenceNode(name, typeArguments);
        return ts.createParameter(
        /* decorators */ undefined, 
        /* modifiers */ undefined, 
        /* dotDotDotToken */ undefined, 
        /* name */ 'ctx', 
        /* questionToken */ undefined, 
        /* type */ type, 
        /* initializer */ undefined);
    }
    /**
     * Process an `AST` expression and convert it into a `ts.Expression`, generating references to the
     * correct identifiers in the current scope.
     */
    function tcbExpression(ast, tcb, scope) {
        var translator = new TcbExpressionTranslator(tcb, scope);
        return translator.translate(ast);
    }
    var TcbExpressionTranslator = /** @class */ (function () {
        function TcbExpressionTranslator(tcb, scope) {
            this.tcb = tcb;
            this.scope = scope;
        }
        TcbExpressionTranslator.prototype.translate = function (ast) {
            var _this = this;
            // `astToTypescript` actually does the conversion. A special resolver `tcbResolve` is passed
            // which interprets specific expression nodes that interact with the `ImplicitReceiver`. These
            // nodes actually refer to identifiers within the current scope.
            return expression_1.astToTypescript(ast, function (ast) { return _this.resolve(ast); }, this.tcb.env.config);
        };
        /**
         * Resolve an `AST` expression within the given scope.
         *
         * Some `AST` expressions refer to top-level concepts (references, variables, the component
         * context). This method assists in resolving those.
         */
        TcbExpressionTranslator.prototype.resolve = function (ast) {
            var _this = this;
            if (ast instanceof compiler_1.PropertyRead && ast.receiver instanceof compiler_1.ImplicitReceiver) {
                // Try to resolve a bound target for this expression. If no such target is available, then
                // the expression is referencing the top-level component context. In that case, `null` is
                // returned here to let it fall through resolution so it will be caught when the
                // `ImplicitReceiver` is resolved in the branch below.
                return this.resolveTarget(ast);
            }
            else if (ast instanceof compiler_1.PropertyWrite && ast.receiver instanceof compiler_1.ImplicitReceiver) {
                var target = this.resolveTarget(ast);
                if (target === null) {
                    return null;
                }
                var expr = this.translate(ast.value);
                var result = ts.createParen(ts.createBinary(target, ts.SyntaxKind.EqualsToken, expr));
                diagnostics_1.addParseSpanInfo(result, ast.sourceSpan);
                return result;
            }
            else if (ast instanceof compiler_1.ImplicitReceiver) {
                // AST instances representing variables and references look very similar to property reads
                // or method calls from the component context: both have the shape
                // PropertyRead(ImplicitReceiver, 'propName') or MethodCall(ImplicitReceiver, 'methodName').
                //
                // `translate` will first try to `resolve` the outer PropertyRead/MethodCall. If this works,
                // it's because the `BoundTarget` found an expression target for the whole expression, and
                // therefore `translate` will never attempt to `resolve` the ImplicitReceiver of that
                // PropertyRead/MethodCall.
                //
                // Therefore if `resolve` is called on an `ImplicitReceiver`, it's because no outer
                // PropertyRead/MethodCall resolved to a variable or reference, and therefore this is a
                // property read or method call on the component context itself.
                return ts.createIdentifier('ctx');
            }
            else if (ast instanceof compiler_1.BindingPipe) {
                var expr = this.translate(ast.exp);
                var pipe = void 0;
                if (this.tcb.env.config.checkTypeOfPipes) {
                    pipe = this.tcb.getPipeByName(ast.name);
                    if (pipe === null) {
                        // No pipe by that name exists in scope. Record this as an error.
                        this.tcb.oobRecorder.missingPipe(this.tcb.id, ast);
                        // Return an 'any' value to at least allow the rest of the expression to be checked.
                        pipe = expression_1.NULL_AS_ANY;
                    }
                }
                else {
                    pipe = ts.createParen(ts.createAsExpression(ts.createNull(), ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)));
                }
                var args = ast.args.map(function (arg) { return _this.translate(arg); });
                var result = ts_util_1.tsCallMethod(pipe, 'transform', tslib_1.__spread([expr], args));
                diagnostics_1.addParseSpanInfo(result, ast.sourceSpan);
                return result;
            }
            else if (ast instanceof compiler_1.MethodCall && ast.receiver instanceof compiler_1.ImplicitReceiver) {
                // Resolve the special `$any(expr)` syntax to insert a cast of the argument to type `any`.
                // `$any(expr)` -> `expr as any`
                if (ast.name === '$any' && ast.args.length === 1) {
                    var expr = this.translate(ast.args[0]);
                    var exprAsAny = ts.createAsExpression(expr, ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
                    var result = ts.createParen(exprAsAny);
                    diagnostics_1.addParseSpanInfo(result, ast.sourceSpan);
                    return result;
                }
                // Attempt to resolve a bound target for the method, and generate the method call if a target
                // could be resolved. If no target is available, then the method is referencing the top-level
                // component context, in which case `null` is returned to let the `ImplicitReceiver` being
                // resolved to the component context.
                var receiver = this.resolveTarget(ast);
                if (receiver === null) {
                    return null;
                }
                var method = ts.createPropertyAccess(diagnostics_1.wrapForDiagnostics(receiver), ast.name);
                diagnostics_1.addParseSpanInfo(method, ast.nameSpan);
                var args = ast.args.map(function (arg) { return _this.translate(arg); });
                var node = ts.createCall(method, undefined, args);
                diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
                return node;
            }
            else {
                // This AST isn't special after all.
                return null;
            }
        };
        /**
         * Attempts to resolve a bound target for a given expression, and translates it into the
         * appropriate `ts.Expression` that represents the bound target. If no target is available,
         * `null` is returned.
         */
        TcbExpressionTranslator.prototype.resolveTarget = function (ast) {
            var binding = this.tcb.boundTarget.getExpressionTarget(ast);
            if (binding === null) {
                return null;
            }
            // This expression has a binding to some variable or reference in the template. Resolve it.
            if (binding instanceof compiler_1.TmplAstVariable) {
                var expr = ts.getMutableClone(this.scope.resolve(binding));
                diagnostics_1.addParseSpanInfo(expr, ast.sourceSpan);
                return expr;
            }
            else if (binding instanceof compiler_1.TmplAstReference) {
                var target = this.tcb.boundTarget.getReferenceTarget(binding);
                if (target === null) {
                    // This reference is unbound. Traversal of the `TmplAstReference` itself should have
                    // recorded the error in the `OutOfBandDiagnosticRecorder`.
                    // Still check the rest of the expression if possible by using an `any` value.
                    return expression_1.NULL_AS_ANY;
                }
                // The reference is either to an element, an <ng-template> node, or to a directive on an
                // element or template.
                if (target instanceof compiler_1.TmplAstElement) {
                    if (!this.tcb.env.config.checkTypeOfDomReferences) {
                        // References to DOM nodes are pinned to 'any'.
                        return expression_1.NULL_AS_ANY;
                    }
                    var expr = ts.getMutableClone(this.scope.resolve(target));
                    diagnostics_1.addParseSpanInfo(expr, ast.sourceSpan);
                    return expr;
                }
                else if (target instanceof compiler_1.TmplAstTemplate) {
                    if (!this.tcb.env.config.checkTypeOfNonDomReferences) {
                        // References to `TemplateRef`s pinned to 'any'.
                        return expression_1.NULL_AS_ANY;
                    }
                    // Direct references to an <ng-template> node simply require a value of type
                    // `TemplateRef<any>`. To get this, an expression of the form
                    // `(null as any as TemplateRef<any>)` is constructed.
                    var value = ts.createNull();
                    value = ts.createAsExpression(value, ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
                    value = ts.createAsExpression(value, this.tcb.env.referenceExternalType('@angular/core', 'TemplateRef', [compiler_1.DYNAMIC_TYPE]));
                    value = ts.createParen(value);
                    diagnostics_1.addParseSpanInfo(value, ast.sourceSpan);
                    return value;
                }
                else {
                    if (!this.tcb.env.config.checkTypeOfNonDomReferences) {
                        // References to directives are pinned to 'any'.
                        return expression_1.NULL_AS_ANY;
                    }
                    var expr = ts.getMutableClone(this.scope.resolve(target.node, target.directive));
                    diagnostics_1.addParseSpanInfo(expr, ast.sourceSpan);
                    return expr;
                }
            }
            else {
                throw new Error("Unreachable: " + binding);
            }
        };
        return TcbExpressionTranslator;
    }());
    /**
     * Call the type constructor of a directive instance on a given template node, inferring a type for
     * the directive instance from any bound inputs.
     */
    function tcbCallTypeCtor(dir, tcb, inputs) {
        var typeCtor = tcb.env.typeCtorFor(dir);
        // Construct an array of `ts.PropertyAssignment`s for each of the directive's inputs.
        var members = inputs.map(function (input) {
            var propertyName = ts.createStringLiteral(input.field);
            if (input.type === 'binding') {
                // For bound inputs, the property is assigned the binding expression.
                var expr = input.expression;
                if (!tcb.env.config.checkTypeOfInputBindings) {
                    // If checking the type of bindings is disabled, cast the resulting expression to 'any'
                    // before the assignment.
                    expr = ts_util_1.tsCastToAny(expr);
                }
                else if (!tcb.env.config.strictNullInputBindings) {
                    // If strict null checks are disabled, erase `null` and `undefined` from the type by
                    // wrapping the expression in a non-null assertion.
                    expr = ts.createNonNullExpression(expr);
                }
                var assignment = ts.createPropertyAssignment(propertyName, diagnostics_1.wrapForDiagnostics(expr));
                diagnostics_1.addParseSpanInfo(assignment, input.sourceSpan);
                return assignment;
            }
            else {
                // A type constructor is required to be called with all input properties, so any unset
                // inputs are simply assigned a value of type `any` to ignore them.
                return ts.createPropertyAssignment(propertyName, expression_1.NULL_AS_ANY);
            }
        });
        // Call the `ngTypeCtor` method on the directive class, with an object literal argument created
        // from the matched inputs.
        return ts.createCall(
        /* expression */ typeCtor, 
        /* typeArguments */ undefined, 
        /* argumentsArray */ [ts.createObjectLiteral(members)]);
    }
    function getBoundInputs(directive, node, tcb) {
        var boundInputs = [];
        var processAttribute = function (attr) {
            // Skip non-property bindings.
            if (attr instanceof compiler_1.TmplAstBoundAttribute && attr.type !== 0 /* Property */) {
                return;
            }
            // Skip text attributes if configured to do so.
            if (!tcb.env.config.checkTypeOfAttributes && attr instanceof compiler_1.TmplAstTextAttribute) {
                return;
            }
            // Skip the attribute if the directive does not have an input for it.
            var inputs = directive.inputs.getByBindingPropertyName(attr.name);
            if (inputs === null) {
                return;
            }
            var fieldNames = inputs.map(function (input) { return input.classPropertyName; });
            boundInputs.push({ attribute: attr, fieldNames: fieldNames });
        };
        node.inputs.forEach(processAttribute);
        node.attributes.forEach(processAttribute);
        if (node instanceof compiler_1.TmplAstTemplate) {
            node.templateAttrs.forEach(processAttribute);
        }
        return boundInputs;
    }
    /**
     * Translates the given attribute binding to a `ts.Expression`.
     */
    function translateInput(attr, tcb, scope) {
        if (attr instanceof compiler_1.TmplAstBoundAttribute) {
            // Produce an expression representing the value of the binding.
            return tcbExpression(attr.value, tcb, scope);
        }
        else {
            // For regular attributes with a static string value, use the represented string literal.
            return ts.createStringLiteral(attr.value);
        }
    }
    var EVENT_PARAMETER = '$event';
    /**
     * Creates an arrow function to be used as handler function for event bindings. The handler
     * function has a single parameter `$event` and the bound event's handler `AST` represented as a
     * TypeScript expression as its body.
     *
     * When `eventType` is set to `Infer`, the `$event` parameter will not have an explicit type. This
     * allows for the created handler function to have its `$event` parameter's type inferred based on
     * how it's used, to enable strict type checking of event bindings. When set to `Any`, the `$event`
     * parameter will have an explicit `any` type, effectively disabling strict type checking of event
     * bindings. Alternatively, an explicit type can be passed for the `$event` parameter.
     */
    function tcbCreateEventHandler(event, tcb, scope, eventType) {
        var handler = tcbEventHandlerExpression(event.handler, tcb, scope);
        var eventParamType;
        if (eventType === 0 /* Infer */) {
            eventParamType = undefined;
        }
        else if (eventType === 1 /* Any */) {
            eventParamType = ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
        }
        else {
            eventParamType = eventType;
        }
        // Obtain all guards that have been applied to the scope and its parents, as they have to be
        // repeated within the handler function for their narrowing to be in effect within the handler.
        var guards = scope.guards();
        var body = ts.createExpressionStatement(handler);
        if (guards !== null) {
            // Wrap the body in an `if` statement containing all guards that have to be applied.
            body = ts.createIf(guards, body);
        }
        var eventParam = ts.createParameter(
        /* decorators */ undefined, 
        /* modifiers */ undefined, 
        /* dotDotDotToken */ undefined, 
        /* name */ EVENT_PARAMETER, 
        /* questionToken */ undefined, 
        /* type */ eventParamType);
        return ts.createFunctionExpression(
        /* modifier */ undefined, 
        /* asteriskToken */ undefined, 
        /* name */ undefined, 
        /* typeParameters */ undefined, 
        /* parameters */ [eventParam], 
        /* type */ ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword), 
        /* body */ ts.createBlock([body]));
    }
    /**
     * Similar to `tcbExpression`, this function converts the provided `AST` expression into a
     * `ts.Expression`, with special handling of the `$event` variable that can be used within event
     * bindings.
     */
    function tcbEventHandlerExpression(ast, tcb, scope) {
        var translator = new TcbEventHandlerTranslator(tcb, scope);
        return translator.translate(ast);
    }
    var TcbEventHandlerTranslator = /** @class */ (function (_super) {
        tslib_1.__extends(TcbEventHandlerTranslator, _super);
        function TcbEventHandlerTranslator() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        TcbEventHandlerTranslator.prototype.resolve = function (ast) {
            // Recognize a property read on the implicit receiver corresponding with the event parameter
            // that is available in event bindings. Since this variable is a parameter of the handler
            // function that the converted expression becomes a child of, just create a reference to the
            // parameter by its name.
            if (ast instanceof compiler_1.PropertyRead && ast.receiver instanceof compiler_1.ImplicitReceiver &&
                ast.name === EVENT_PARAMETER) {
                var event_1 = ts.createIdentifier(EVENT_PARAMETER);
                diagnostics_1.addParseSpanInfo(event_1, ast.nameSpan);
                return event_1;
            }
            return _super.prototype.resolve.call(this, ast);
        };
        return TcbEventHandlerTranslator;
    }(TcbExpressionTranslator));
    function requiresInlineTypeCheckBlock(node) {
        // In order to qualify for a declared TCB (not inline) two conditions must be met:
        // 1) the class must be exported
        // 2) it must not have constrained generic types
        if (!ts_util_1.checkIfClassIsExported(node)) {
            // Condition 1 is false, the class is not exported.
            return true;
        }
        else if (!ts_util_1.checkIfGenericTypesAreUnbound(node)) {
            // Condition 2 is false, the class has constrained generic types
            return true;
        }
        else {
            return false;
        }
    }
    exports.requiresInlineTypeCheckBlock = requiresInlineTypeCheckBlock;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZV9jaGVja19ibG9jay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy90eXBlX2NoZWNrX2Jsb2NrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFFSCw4Q0FBMlc7SUFDM1csK0JBQWlDO0lBT2pDLHlGQUFxRztJQUdyRyx1RkFBMEQ7SUFFMUQsdUdBQStEO0lBQy9ELGlGQUFtTTtJQUluTTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O09BcUJHO0lBQ0gsU0FBZ0Isc0JBQXNCLENBQ2xDLEdBQWdCLEVBQUUsR0FBcUQsRUFBRSxJQUFtQixFQUM1RixJQUE0QixFQUFFLGdCQUFrQyxFQUNoRSxXQUF3QztRQUMxQyxJQUFNLEdBQUcsR0FBRyxJQUFJLE9BQU8sQ0FDbkIsR0FBRyxFQUFFLGdCQUFnQixFQUFFLFdBQVcsRUFBRSxJQUFJLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0YsSUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDLFFBQVUsRUFBRSxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDN0YsSUFBTSxVQUFVLEdBQUcsR0FBRyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3ZDLE1BQU0sSUFBSSxLQUFLLENBQ1gsbUVBQWlFLEdBQUcsQ0FBQyxTQUFXLENBQUMsQ0FBQztTQUN2RjtRQUNELElBQU0sU0FBUyxHQUFHLENBQUMsV0FBVyxDQUFD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QUFFO1lBQy9DLGdFQUFnRTtZQUNoRSxPQUFPLElBQUksQ0FBQztTQUNiO2FBQU07WUFDTCxPQUFPLEtBQUssQ0FBQztTQUNkO0lBQ0gsQ0FBQztJQWJELG9FQWFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QVNULCBCaW5kaW5nUGlwZSwgQmluZGluZ1R5cGUsIEJvdW5kVGFyZ2V0LCBEWU5BTUlDX1RZUEUsIEltcGxpY2l0UmVjZWl2ZXIsIE1ldGhvZENhbGwsIFBhcnNlZEV2ZW50VHlwZSwgUGFyc2VTb3VyY2VTcGFuLCBQcm9wZXJ0eVJlYWQsIFByb3BlcnR5V3JpdGUsIFNjaGVtYU1ldGFkYXRhLCBUbXBsQXN0Qm91bmRBdHRyaWJ1dGUsIFRtcGxBc3RCb3VuZEV2ZW50LCBUbXBsQXN0Qm91bmRUZXh0LCBUbXBsQXN0RWxlbWVudCwgVG1wbEFzdE5vZGUsIFRtcGxBc3RSZWZlcmVuY2UsIFRtcGxBc3RUZW1wbGF0ZSwgVG1wbEFzdFRleHRBdHRyaWJ1dGUsIFRtcGxBc3RWYXJpYWJsZX0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7UmVmZXJlbmNlfSBmcm9tICcuLi8uLi9pbXBvcnRzJztcbmltcG9ydCB7Q2xhc3NQcm9wZXJ0eU5hbWV9IGZyb20gJy4uLy4uL21ldGFkYXRhJztcbmltcG9ydCB7Q2xhc3NEZWNsYXJhdGlvbn0gZnJvbSAnLi4vLi4vcmVmbGVjdGlvbic7XG5pbXBvcnQge1RlbXBsYXRlSWQsIFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhLCBUeXBlQ2hlY2tCbG9ja01ldGFkYXRhfSBmcm9tICcuLi9hcGknO1xuXG5pbXBvcnQge2FkZFBhcnNlU3BhbkluZm8sIGFkZFRlbXBsYXRlSWQsIGlnbm9yZURpYWdub3N0aWNzLCB3cmFwRm9yRGlhZ25vc3RpY3N9IGZyb20gJy4vZGlhZ25vc3RpY3MnO1xuaW1wb3J0IHtEb21TY2hlbWFDaGVja2VyfSBmcm9tICcuL2RvbSc7XG5pbXBvcnQge0Vudmlyb25tZW50fSBmcm9tICcuL2Vudmlyb25tZW50JztcbmltcG9ydCB7YXN0VG9UeXBlc2NyaXB0LCBOVUxMX0FTX0FOWX0gZnJvbSAnLi9leHByZXNzaW9uJztcbmltcG9ydCB7T3V0T2ZCYW5kRGlhZ25vc3RpY1JlY29yZGVyfSBmcm9tICcuL29vYic7XG5pbXBvcnQge0V4cHJlc3Npb25TZW1hbnRpY1Zpc2l0b3J9IGZyb20gJy4vdGVtcGxhdGVfc2VtYW50aWNzJztcbmltcG9ydCB7Y2hlY2tJZkNsYXNzSXNFeHBvcnRlZCwgY2hlY2tJZkdlbmVyaWNUeXBlc0FyZVVuYm91bmQsIHRzQ2FsbE1ldGhvZCwgdHNDYXN0VG9BbnksIHRzQ3JlYXRlRWxlbWVudCwgdHNDcmVhdGVUeXBlUXVlcnlGb3JDb2VyY2VkSW5wdXQsIHRzQ3JlYXRlVmFyaWFibGUsIHRzRGVjbGFyZVZhcmlhYmxlfSBmcm9tICcuL3RzX3V0aWwnO1xuXG5cblxuLyoqXG4gKiBHaXZlbiBhIGB0cy5DbGFzc0RlY2xhcmF0aW9uYCBmb3IgYSBjb21wb25lbnQsIGFuZCBtZXRhZGF0YSByZWdhcmRpbmcgdGhhdCBjb21wb25lbnQsIGNvbXBvc2UgYVxuICogXCJ0eXBlIGNoZWNrIGJsb2NrXCIgZnVuY3Rpb24uXG4gKlxuICogV2hlbiBwYXNzZWQgdGhyb3VnaCBUeXBlU2NyaXB0J3MgVHlwZUNoZWNrZXIsIHR5cGUgZXJyb3JzIHRoYXQgYXJpc2Ugd2l0aGluIHRoZSB0eXBlIGNoZWNrIGJsb2NrXG4gKiBmdW5jdGlvbiBpbmRpY2F0ZSBpc3N1ZXMgaW4gdGhlIHRlbXBsYXRlIGl0c2VsZi5cbiAqXG4gKiBBcyBhIHNpZGUgZWZmZWN0IG9mIGdlbmVyYXRpbmcgYSBUQ0IgZm9yIHRoZSBjb21wb25lbnQsIGB0cy5EaWFnbm9zdGljYHMgbWF5IGFsc28gYmUgcHJvZHVjZWRcbiAqIGRpcmVjdGx5IGZvciBpc3N1ZXMgd2l0aGluIHRoZSB0ZW1wbGF0ZSB3aGljaCBhcmUgaWRlbnRpZmllZCBkdXJpbmcgZ2VuZXJhdGlvbi4gVGhlc2UgaXNzdWVzIGFyZVxuICogcmVjb3JkZWQgaW4gZWl0aGVyIHRoZSBgZG9tU2NoZW1hQ2hlY2tlcmAgKHdoaWNoIGNoZWNrcyB1c2FnZSBvZiBET00gZWxlbWVudHMgYW5kIGJpbmRpbmdzKSBhc1xuICogd2VsbCBhcyB0aGUgYG9vYlJlY29yZGVyYCAod2hpY2ggcmVjb3JkcyBlcnJvcnMgd2hlbiB0aGUgdHlwZS1jaGVja2luZyBjb2RlIGdlbmVyYXRvciBpcyB1bmFibGVcbiAqIHRvIHN1ZmZpY2llbnRseSB1bmRlcnN0YW5kIGEgdGVtcGxhdGUpLlxuICpcbiAqIEBwYXJhbSBlbnYgYW4gYEVudmlyb25tZW50YCBpbnRvIHdoaWNoIHR5cGUtY2hlY2tpbmcgY29kZSB3aWxsIGJlIGdlbmVyYXRlZC5cbiAqIEBwYXJhbSByZWYgYSBgUmVmZXJlbmNlYCB0byB0aGUgY29tcG9uZW50IGNsYXNzIHdoaWNoIHNob3VsZCBiZSB0eXBlLWNoZWNrZWQuXG4gKiBAcGFyYW0gbmFtZSBhIGB0cy5JZGVudGlmaWVyYCB0byB1c2UgZm9yIHRoZSBnZW5lcmF0ZWQgYHRzLkZ1bmN0aW9uRGVjbGFyYXRpb25gLlxuICogQHBhcmFtIG1ldGEgbWV0YWRhdGEgYWJvdXQgdGhlIGNvbXBvbmVudCdzIHRlbXBsYXRlIGFuZCB0aGUgZnVuY3Rpb24gYmVpbmcgZ2VuZXJhdGVkLlxuICogQHBhcmFtIGRvbVNjaGVtYUNoZWNrZXIgdXNlZCB0byBjaGVjayBhbmQgcmVjb3JkIGVycm9ycyByZWdhcmRpbmcgaW1wcm9wZXIgdXNhZ2Ugb2YgRE9NIGVsZW1lbnRzXG4gKiBhbmQgYmluZGluZ3MuXG4gKiBAcGFyYW0gb29iUmVjb3JkZXIgdXNlZCB0byByZWNvcmQgZXJyb3JzIHJlZ2FyZGluZyB0ZW1wbGF0ZSBlbGVtZW50cyB3aGljaCBjb3VsZCBub3QgYmUgY29ycmVjdGx5XG4gKiB0cmFuc2xhdGVkIGludG8gdHlwZXMgZHVyaW5nIFRDQiBnZW5lcmF0aW9uLlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ2VuZXJhdGVUeXBlQ2hlY2tCbG9jayhcbiAgICBlbnY6IEVudmlyb25tZW50LCByZWY6IFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPHRzLkNsYXNzRGVjbGFyYXRpb24+PiwgbmFtZTogdHMuSWRlbnRpZmllcixcbiAgICBtZXRhOiBUeXBlQ2hlY2tCbG9ja01ldGFkYXRhLCBkb21TY2hlbWFDaGVja2VyOiBEb21TY2hlbWFDaGVja2VyLFxuICAgIG9vYlJlY29yZGVyOiBPdXRPZkJhbmREaWFnbm9zdGljUmVjb3JkZXIpOiB0cy5GdW5jdGlvbkRlY2xhcmF0aW9uIHtcbiAgY29uc3QgdGNiID0gbmV3IENvbnRleHQoXG4gICAgICBlbnYsIGRvbVNjaGVtYUNoZWNrZXIsIG9vYlJlY29yZGVyLCBtZXRhLmlkLCBtZXRhLmJvdW5kVGFyZ2V0LCBtZXRhLnBpcGVzLCBtZXRhLnNjaGVtYXMpO1xuICBjb25zdCBzY29wZSA9IFNjb3BlLmZvck5vZGVzKHRjYiwgbnVsbCwgdGNiLmJvdW5kVGFyZ2V0LnRhcmdldC50ZW1wbGF0ZSAhLCAvKiBndWFyZCAqLyBudWxsKTtcbiAgY29uc3QgY3R4UmF3VHlwZSA9IGVudi5yZWZlcmVuY2VUeXBlKHJlZik7XG4gIGlmICghdHMuaXNUeXBlUmVmZXJlbmNlTm9kZShjdHhSYXdUeXBlKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEV4cGVjdGVkIFR5cGVSZWZlcmVuY2VOb2RlIHdoZW4gcmVmZXJlbmNpbmcgdGhlIGN0eCBwYXJhbSBmb3IgJHtyZWYuZGVidWdOYW1lfWApO1xuICB9XG4gIGNvbnN0IHBhcmFtTGlzdCA9IFt0Y2JDdHhQYXJhbShyZWYubm9kZSwgY3R4UmF3VHlwZS50eXBlTmFtZSwgZW52LmNvbmZpZy51c2VDb250ZXh0R2VuZXJpY1R5cGUpXTtcblxuICBjb25zdCBzY29wZVN0YXRlbWVudHMgPSBzY29wZS5yZW5kZXIoKTtcbiAgY29uc3QgaW5uZXJCb2R5ID0gdHMuY3JlYXRlQmxvY2soW1xuICAgIC4uLmVudi5nZXRQcmVsdWRlU3RhdGVtZW50cygpLFxuICAgIC4uLnNjb3BlU3RhdGVtZW50cyxcbiAgXSk7XG5cbiAgLy8gV3JhcCB0aGUgYm9keSBpbiBhbiBcImlmICh0cnVlKVwiIGV4cHJlc3Npb24uIFRoaXMgaXMgdW5uZWNlc3NhcnkgYnV0IGhhcyB0aGUgZWZmZWN0IG9mIGNhdXNpbmdcbiAgLy8gdGhlIGB0cy5QcmludGVyYCB0byBmb3JtYXQgdGhlIHR5cGUtY2hlY2sgYmxvY2sgbmljZWx5LlxuICBjb25zdCBib2R5ID0gdHMuY3JlYXRlQmxvY2soW3RzLmNyZWF0ZUlmKHRzLmNyZWF0ZVRydWUoKSwgaW5uZXJCb2R5LCB1bmRlZmluZWQpXSk7XG4gIGNvbnN0IGZuRGVjbCA9IHRzLmNyZWF0ZUZ1bmN0aW9uRGVjbGFyYXRpb24oXG4gICAgICAvKiBkZWNvcmF0b3JzICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBhc3Rlcmlza1Rva2VuICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIG5hbWUgKi8gbmFtZSxcbiAgICAgIC8qIHR5cGVQYXJhbWV0ZXJzICovIGVudi5jb25maWcudXNlQ29udGV4dEdlbmVyaWNUeXBlID8gcmVmLm5vZGUudHlwZVBhcmFtZXRlcnMgOiB1bmRlZmluZWQsXG4gICAgICAvKiBwYXJhbWV0ZXJzICovIHBhcmFtTGlzdCxcbiAgICAgIC8qIHR5cGUgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogYm9keSAqLyBib2R5KTtcbiAgYWRkVGVtcGxhdGVJZChmbkRlY2wsIG1ldGEuaWQpO1xuICByZXR1cm4gZm5EZWNsO1xufVxuXG4vKipcbiAqIEEgY29kZSBnZW5lcmF0aW9uIG9wZXJhdGlvbiB0aGF0J3MgaW52b2x2ZWQgaW4gdGhlIGNvbnN0cnVjdGlvbiBvZiBhIFR5cGUgQ2hlY2sgQmxvY2suXG4gKlxuICogVGhlIGdlbmVyYXRpb24gb2YgYSBUQ0IgaXMgbm9uLWxpbmVhci4gQmluZGluZ3Mgd2l0aGluIGEgdGVtcGxhdGUgbWF5IHJlc3VsdCBpbiB0aGUgbmVlZCB0b1xuICogY29uc3RydWN0IGNlcnRhaW4gdHlwZXMgZWFybGllciB0aGFuIHRoZXkgb3RoZXJ3aXNlIHdvdWxkIGJlIGNvbnN0cnVjdGVkLiBUaGF0IGlzLCBpZiB0aGVcbiAqIGdlbmVyYXRpb24gb2YgYSBUQ0IgZm9yIGEgdGVtcGxhdGUgaXMgYnJva2VuIGRvd24gaW50byBzcGVjaWZpYyBvcGVyYXRpb25zIChjb25zdHJ1Y3RpbmcgYVxuICogZGlyZWN0aXZlLCBleHRyYWN0aW5nIGEgdmFyaWFibGUgZnJvbSBhIGxldC0gb3BlcmF0aW9uLCBldGMpLCB0aGVuIGl0J3MgcG9zc2libGUgZm9yIG9wZXJhdGlvbnNcbiAqIGVhcmxpZXIgaW4gdGhlIHNlcXVlbmNlIHRvIGRlcGVuZCBvbiBvcGVyYXRpb25zIHdoaWNoIG9jY3VyIGxhdGVyIGluIHRoZSBzZXF1ZW5jZS5cbiAqXG4gKiBgVGNiT3BgIGFic3RyYWN0cyB0aGUgZGlmZmVyZW50IHR5cGVzIG9mIG9wZXJhdGlvbnMgd2hpY2ggYXJlIHJlcXVpcmVkIHRvIGNvbnZlcnQgYSB0ZW1wbGF0ZSBpbnRvXG4gKiBhIFRDQi4gVGhpcyBhbGxvd3MgZm9yIHR3byBwaGFzZXMgb2YgcHJvY2Vzc2luZyBmb3IgdGhlIHRlbXBsYXRlLCB3aGVyZSAxKSBhIGxpbmVhciBzZXF1ZW5jZSBvZlxuICogYFRjYk9wYHMgaXMgZ2VuZXJhdGVkLCBhbmQgdGhlbiAyKSB0aGVzZSBvcGVyYXRpb25zIGFyZSBleGVjdXRlZCwgbm90IG5lY2Vzc2FyaWx5IGluIGxpbmVhclxuICogb3JkZXIuXG4gKlxuICogRWFjaCBgVGNiT3BgIG1heSBpbnNlcnQgc3RhdGVtZW50cyBpbnRvIHRoZSBib2R5IG9mIHRoZSBUQ0IsIGFuZCBhbHNvIG9wdGlvbmFsbHkgcmV0dXJuIGFcbiAqIGB0cy5FeHByZXNzaW9uYCB3aGljaCBjYW4gYmUgdXNlZCB0byByZWZlcmVuY2UgdGhlIG9wZXJhdGlvbidzIHJlc3VsdC5cbiAqL1xuYWJzdHJhY3QgY2xhc3MgVGNiT3Age1xuICAvKipcbiAgICogU2V0IHRvIHRydWUgaWYgdGhpcyBvcGVyYXRpb24gY2FuIGJlIGNvbnNpZGVyZWQgb3B0aW9uYWwuIE9wdGlvbmFsIG9wZXJhdGlvbnMgYXJlIG9ubHkgZXhlY3V0ZWRcbiAgICogd2hlbiBkZXBlbmRlZCB1cG9uIGJ5IG90aGVyIG9wZXJhdGlvbnMsIG90aGVyd2lzZSB0aGV5IGFyZSBkaXNyZWdhcmRlZC4gVGhpcyBhbGxvd3MgZm9yIGxlc3NcbiAgICogY29kZSB0byBnZW5lcmF0ZSwgcGFyc2UgYW5kIHR5cGUtY2hlY2ssIG92ZXJhbGwgcG9zaXRpdmVseSBjb250cmlidXRpbmcgdG8gcGVyZm9ybWFuY2UuXG4gICAqL1xuICBhYnN0cmFjdCByZWFkb25seSBvcHRpb25hbDogYm9vbGVhbjtcblxuICBhYnN0cmFjdCBleGVjdXRlKCk6IHRzLkV4cHJlc3Npb258bnVsbDtcblxuICAvKipcbiAgICogUmVwbGFjZW1lbnQgdmFsdWUgb3Igb3BlcmF0aW9uIHVzZWQgd2hpbGUgdGhpcyBgVGNiT3BgIGlzIGV4ZWN1dGluZyAoaS5lLiB0byByZXNvbHZlIGNpcmN1bGFyXG4gICAqIHJlZmVyZW5jZXMgZHVyaW5nIGl0cyBleGVjdXRpb24pLlxuICAgKlxuICAgKiBUaGlzIGlzIHVzdWFsbHkgYSBgbnVsbCFgIGV4cHJlc3Npb24gKHdoaWNoIGFza3MgVFMgdG8gaW5mZXIgYW4gYXBwcm9wcmlhdGUgdHlwZSksIGJ1dCBhbm90aGVyXG4gICAqIGBUY2JPcGAgY2FuIGJlIHJldHVybmVkIGluIGNhc2VzIHdoZXJlIGFkZGl0aW9uYWwgY29kZSBnZW5lcmF0aW9uIGlzIG5lY2Vzc2FyeSB0byBkZWFsIHdpdGhcbiAgICogY2lyY3VsYXIgcmVmZXJlbmNlcy5cbiAgICovXG4gIGNpcmN1bGFyRmFsbGJhY2soKTogVGNiT3B8dHMuRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIElORkVSX1RZUEVfRk9SX0NJUkNVTEFSX09QX0VYUFI7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggY3JlYXRlcyBhbiBleHByZXNzaW9uIGZvciBhIG5hdGl2ZSBET00gZWxlbWVudCAob3Igd2ViIGNvbXBvbmVudCkgZnJvbSBhXG4gKiBgVG1wbEFzdEVsZW1lbnRgLlxuICpcbiAqIEV4ZWN1dGluZyB0aGlzIG9wZXJhdGlvbiByZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSBlbGVtZW50IHZhcmlhYmxlLlxuICovXG5jbGFzcyBUY2JFbGVtZW50T3AgZXh0ZW5kcyBUY2JPcCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSBlbGVtZW50OiBUbXBsQXN0RWxlbWVudCkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgLy8gVGhlIHN0YXRlbWVudCBnZW5lcmF0ZWQgYnkgdGhpcyBvcGVyYXRpb24gaXMgb25seSB1c2VkIGZvciB0eXBlLWluZmVyZW5jZSBvZiB0aGUgRE9NXG4gICAgLy8gZWxlbWVudCdzIHR5cGUgYW5kIHdvbid0IHJlcG9ydCBkaWFnbm9zdGljcyBieSBpdHNlbGYsIHNvIHRoZSBvcGVyYXRpb24gaXMgbWFya2VkIGFzIG9wdGlvbmFsXG4gICAgLy8gdG8gYXZvaWQgZ2VuZXJhdGluZyBzdGF0ZW1lbnRzIGZvciBET00gZWxlbWVudHMgdGhhdCBhcmUgbmV2ZXIgcmVmZXJlbmNlZC5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogdHMuSWRlbnRpZmllciB7XG4gICAgY29uc3QgaWQgPSB0aGlzLnRjYi5hbGxvY2F0ZUlkKCk7XG4gICAgLy8gQWRkIHRoZSBkZWNsYXJhdGlvbiBvZiB0aGUgZWxlbWVudCB1c2luZyBkb2N1bWVudC5jcmVhdGVFbGVtZW50LlxuICAgIGNvbnN0IGluaXRpYWxpemVyID0gdHNDcmVhdGVFbGVtZW50KHRoaXMuZWxlbWVudC5uYW1lKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKGluaXRpYWxpemVyLCB0aGlzLmVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuIHx8IHRoaXMuZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0c0NyZWF0ZVZhcmlhYmxlKGlkLCBpbml0aWFsaXplcikpO1xuICAgIHJldHVybiBpZDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBjcmVhdGVzIGFuIGV4cHJlc3Npb24gZm9yIHBhcnRpY3VsYXIgbGV0LSBgVG1wbEFzdFZhcmlhYmxlYCBvbiBhXG4gKiBgVG1wbEFzdFRlbXBsYXRlYCdzIGNvbnRleHQuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIHZhcmlhYmxlIHZhcmlhYmxlIChsb2wpLlxuICovXG5jbGFzcyBUY2JWYXJpYWJsZU9wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSB0ZW1wbGF0ZTogVG1wbEFzdFRlbXBsYXRlLFxuICAgICAgcHJpdmF0ZSB2YXJpYWJsZTogVG1wbEFzdFZhcmlhYmxlKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGdldCBvcHRpb25hbCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBleGVjdXRlKCk6IHRzLklkZW50aWZpZXIge1xuICAgIC8vIExvb2sgZm9yIGEgY29udGV4dCB2YXJpYWJsZSBmb3IgdGhlIHRlbXBsYXRlLlxuICAgIGNvbnN0IGN0eCA9IHRoaXMuc2NvcGUucmVzb2x2ZSh0aGlzLnRlbXBsYXRlKTtcblxuICAgIC8vIEFsbG9jYXRlIGFuIGlkZW50aWZpZXIgZm9yIHRoZSBUbXBsQXN0VmFyaWFibGUsIGFuZCBpbml0aWFsaXplIGl0IHRvIGEgcmVhZCBvZiB0aGUgdmFyaWFibGVcbiAgICAvLyBvbiB0aGUgdGVtcGxhdGUgY29udGV4dC5cbiAgICBjb25zdCBpZCA9IHRoaXMudGNiLmFsbG9jYXRlSWQoKTtcbiAgICBjb25zdCBpbml0aWFsaXplciA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKFxuICAgICAgICAvKiBleHByZXNzaW9uICovIGN0eCxcbiAgICAgICAgLyogbmFtZSAqLyB0aGlzLnZhcmlhYmxlLnZhbHVlIHx8ICckaW1wbGljaXQnKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKGluaXRpYWxpemVyLCB0aGlzLnZhcmlhYmxlLnNvdXJjZVNwYW4pO1xuXG4gICAgLy8gRGVjbGFyZSB0aGUgdmFyaWFibGUsIGFuZCByZXR1cm4gaXRzIGlkZW50aWZpZXIuXG4gICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHNDcmVhdGVWYXJpYWJsZShpZCwgaW5pdGlhbGl6ZXIpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggZ2VuZXJhdGVzIGEgdmFyaWFibGUgZm9yIGEgYFRtcGxBc3RUZW1wbGF0ZWAncyBjb250ZXh0LlxuICpcbiAqIEV4ZWN1dGluZyB0aGlzIG9wZXJhdGlvbiByZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSB0ZW1wbGF0ZSdzIGNvbnRleHQgdmFyaWFibGUuXG4gKi9cbmNsYXNzIFRjYlRlbXBsYXRlQ29udGV4dE9wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHRjYjogQ29udGV4dCwgcHJpdmF0ZSBzY29wZTogU2NvcGUpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogdHMuSWRlbnRpZmllciB7XG4gICAgLy8gQWxsb2NhdGUgYSB0ZW1wbGF0ZSBjdHggdmFyaWFibGUgYW5kIGRlY2xhcmUgaXQgd2l0aCBhbiAnYW55JyB0eXBlLiBUaGUgdHlwZSBvZiB0aGlzIHZhcmlhYmxlXG4gICAgLy8gbWF5IGJlIG5hcnJvd2VkIGFzIGEgcmVzdWx0IG9mIHRlbXBsYXRlIGd1YXJkIGNvbmRpdGlvbnMuXG4gICAgY29uc3QgY3R4ID0gdGhpcy50Y2IuYWxsb2NhdGVJZCgpO1xuICAgIGNvbnN0IHR5cGUgPSB0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5BbnlLZXl3b3JkKTtcbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0c0RlY2xhcmVWYXJpYWJsZShjdHgsIHR5cGUpKTtcbiAgICByZXR1cm4gY3R4O1xuICB9XG59XG5cbi8qKlxuICogQSBgVGNiT3BgIHdoaWNoIGRlc2NlbmRzIGludG8gYSBgVG1wbEFzdFRlbXBsYXRlYCdzIGNoaWxkcmVuIGFuZCBnZW5lcmF0ZXMgdHlwZS1jaGVja2luZyBjb2RlIGZvclxuICogdGhlbS5cbiAqXG4gKiBUaGlzIG9wZXJhdGlvbiB3cmFwcyB0aGUgY2hpbGRyZW4ncyB0eXBlLWNoZWNraW5nIGNvZGUgaW4gYW4gYGlmYCBibG9jaywgd2hpY2ggbWF5IGluY2x1ZGUgb25lXG4gKiBvciBtb3JlIHR5cGUgZ3VhcmQgY29uZGl0aW9ucyB0aGF0IG5hcnJvdyB0eXBlcyB3aXRoaW4gdGhlIHRlbXBsYXRlIGJvZHkuXG4gKi9cbmNsYXNzIFRjYlRlbXBsYXRlQm9keU9wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHRjYjogQ29udGV4dCwgcHJpdmF0ZSBzY29wZTogU2NvcGUsIHByaXZhdGUgdGVtcGxhdGU6IFRtcGxBc3RUZW1wbGF0ZSkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZXhlY3V0ZSgpOiBudWxsIHtcbiAgICAvLyBBbiBgaWZgIHdpbGwgYmUgY29uc3RydWN0ZWQsIHdpdGhpbiB3aGljaCB0aGUgdGVtcGxhdGUncyBjaGlsZHJlbiB3aWxsIGJlIHR5cGUgY2hlY2tlZC4gVGhlXG4gICAgLy8gYGlmYCBpcyB1c2VkIGZvciB0d28gcmVhc29uczogaXQgY3JlYXRlcyBhIG5ldyBzeW50YWN0aWMgc2NvcGUsIGlzb2xhdGluZyB2YXJpYWJsZXMgZGVjbGFyZWRcbiAgICAvLyBpbiB0aGUgdGVtcGxhdGUncyBUQ0IgZnJvbSB0aGUgb3V0ZXIgY29udGV4dCwgYW5kIGl0IGFsbG93cyBhbnkgZGlyZWN0aXZlcyBvbiB0aGUgdGVtcGxhdGVzXG4gICAgLy8gdG8gcGVyZm9ybSB0eXBlIG5hcnJvd2luZyBvZiBlaXRoZXIgZXhwcmVzc2lvbnMgb3IgdGhlIHRlbXBsYXRlJ3MgY29udGV4dC5cbiAgICAvL1xuICAgIC8vIFRoZSBndWFyZCBpcyB0aGUgYGlmYCBibG9jaydzIGNvbmRpdGlvbi4gSXQncyB1c3VhbGx5IHNldCB0byBgdHJ1ZWAgYnV0IGRpcmVjdGl2ZXMgdGhhdCBleGlzdFxuICAgIC8vIG9uIHRoZSB0ZW1wbGF0ZSBjYW4gdHJpZ2dlciBleHRyYSBndWFyZCBleHByZXNzaW9ucyB0aGF0IHNlcnZlIHRvIG5hcnJvdyB0eXBlcyB3aXRoaW4gdGhlXG4gICAgLy8gYGlmYC4gYGd1YXJkYCBpcyBjYWxjdWxhdGVkIGJ5IHN0YXJ0aW5nIHdpdGggYHRydWVgIGFuZCBhZGRpbmcgb3RoZXIgY29uZGl0aW9ucyBhcyBuZWVkZWQuXG4gICAgLy8gQ29sbGVjdCB0aGVzZSBpbnRvIGBndWFyZHNgIGJ5IHByb2Nlc3NpbmcgdGhlIGRpcmVjdGl2ZXMuXG4gICAgY29uc3QgZGlyZWN0aXZlR3VhcmRzOiB0cy5FeHByZXNzaW9uW10gPSBbXTtcblxuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSB0aGlzLnRjYi5ib3VuZFRhcmdldC5nZXREaXJlY3RpdmVzT2ZOb2RlKHRoaXMudGVtcGxhdGUpO1xuICAgIGlmIChkaXJlY3RpdmVzICE9PSBudWxsKSB7XG4gICAgICBmb3IgKGNvbnN0IGRpciBvZiBkaXJlY3RpdmVzKSB7XG4gICAgICAgIGNvbnN0IGRpckluc3RJZCA9IHRoaXMuc2NvcGUucmVzb2x2ZSh0aGlzLnRlbXBsYXRlLCBkaXIpO1xuICAgICAgICBjb25zdCBkaXJJZCA9XG4gICAgICAgICAgICB0aGlzLnRjYi5lbnYucmVmZXJlbmNlKGRpci5yZWYgYXMgUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4+KTtcblxuICAgICAgICAvLyBUaGVyZSBhcmUgdHdvIGtpbmRzIG9mIGd1YXJkcy4gVGVtcGxhdGUgZ3VhcmRzIChuZ1RlbXBsYXRlR3VhcmRzKSBhbGxvdyB0eXBlIG5hcnJvd2luZyBvZlxuICAgICAgICAvLyB0aGUgZXhwcmVzc2lvbiBwYXNzZWQgdG8gYW4gQElucHV0IG9mIHRoZSBkaXJlY3RpdmUuIFNjYW4gdGhlIGRpcmVjdGl2ZSB0byBzZWUgaWYgaXQgaGFzXG4gICAgICAgIC8vIGFueSB0ZW1wbGF0ZSBndWFyZHMsIGFuZCBnZW5lcmF0ZSB0aGVtIGlmIG5lZWRlZC5cbiAgICAgICAgZGlyLm5nVGVtcGxhdGVHdWFyZHMuZm9yRWFjaChndWFyZCA9PiB7XG4gICAgICAgICAgLy8gRm9yIGVhY2ggdGVtcGxhdGUgZ3VhcmQgZnVuY3Rpb24gb24gdGhlIGRpcmVjdGl2ZSwgbG9vayBmb3IgYSBiaW5kaW5nIHRvIHRoYXQgaW5wdXQuXG4gICAgICAgICAgY29uc3QgYm91bmRJbnB1dCA9IHRoaXMudGVtcGxhdGUuaW5wdXRzLmZpbmQoaSA9PiBpLm5hbWUgPT09IGd1YXJkLmlucHV0TmFtZSkgfHxcbiAgICAgICAgICAgICAgdGhpcy50ZW1wbGF0ZS50ZW1wbGF0ZUF0dHJzLmZpbmQoXG4gICAgICAgICAgICAgICAgICAoaTogVG1wbEFzdFRleHRBdHRyaWJ1dGV8VG1wbEFzdEJvdW5kQXR0cmlidXRlKTogaSBpcyBUbXBsQXN0Qm91bmRBdHRyaWJ1dGUgPT5cbiAgICAgICAgICAgICAgICAgICAgICBpIGluc3RhbmNlb2YgVG1wbEFzdEJvdW5kQXR0cmlidXRlICYmIGkubmFtZSA9PT0gZ3VhcmQuaW5wdXROYW1lKTtcbiAgICAgICAgICBpZiAoYm91bmRJbnB1dCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAvLyBJZiB0aGVyZSBpcyBzdWNoIGEgYmluZGluZywgZ2VuZXJhdGUgYW4gZXhwcmVzc2lvbiBmb3IgaXQuXG4gICAgICAgICAgICBjb25zdCBleHByID0gdGNiRXhwcmVzc2lvbihib3VuZElucHV0LnZhbHVlLCB0aGlzLnRjYiwgdGhpcy5zY29wZSk7XG5cbiAgICAgICAgICAgIC8vIFRoZSBleHByZXNzaW9uIGhhcyBhbHJlYWR5IGJlZW4gY2hlY2tlZCBpbiB0aGUgdHlwZSBjb25zdHJ1Y3RvciBpbnZvY2F0aW9uLCBzb1xuICAgICAgICAgICAgLy8gaXQgc2hvdWxkIGJlIGlnbm9yZWQgd2hlbiB1c2VkIHdpdGhpbiBhIHRlbXBsYXRlIGd1YXJkLlxuICAgICAgICAgICAgaWdub3JlRGlhZ25vc3RpY3MoZXhwcik7XG5cbiAgICAgICAgICAgIGlmIChndWFyZC50eXBlID09PSAnYmluZGluZycpIHtcbiAgICAgICAgICAgICAgLy8gVXNlIHRoZSBiaW5kaW5nIGV4cHJlc3Npb24gaXRzZWxmIGFzIGd1YXJkLlxuICAgICAgICAgICAgICBkaXJlY3RpdmVHdWFyZHMucHVzaChleHByKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIENhbGwgdGhlIGd1YXJkIGZ1bmN0aW9uIG9uIHRoZSBkaXJlY3RpdmUgd2l0aCB0aGUgZGlyZWN0aXZlIGluc3RhbmNlIGFuZCB0aGF0XG4gICAgICAgICAgICAgIC8vIGV4cHJlc3Npb24uXG4gICAgICAgICAgICAgIGNvbnN0IGd1YXJkSW52b2tlID0gdHNDYWxsTWV0aG9kKGRpcklkLCBgbmdUZW1wbGF0ZUd1YXJkXyR7Z3VhcmQuaW5wdXROYW1lfWAsIFtcbiAgICAgICAgICAgICAgICBkaXJJbnN0SWQsXG4gICAgICAgICAgICAgICAgZXhwcixcbiAgICAgICAgICAgICAgXSk7XG4gICAgICAgICAgICAgIGFkZFBhcnNlU3BhbkluZm8oZ3VhcmRJbnZva2UsIGJvdW5kSW5wdXQudmFsdWUuc291cmNlU3Bhbik7XG4gICAgICAgICAgICAgIGRpcmVjdGl2ZUd1YXJkcy5wdXNoKGd1YXJkSW52b2tlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFRoZSBzZWNvbmQga2luZCBvZiBndWFyZCBpcyBhIHRlbXBsYXRlIGNvbnRleHQgZ3VhcmQuIFRoaXMgZ3VhcmQgbmFycm93cyB0aGUgdGVtcGxhdGVcbiAgICAgICAgLy8gcmVuZGVyaW5nIGNvbnRleHQgdmFyaWFibGUgYGN0eGAuXG4gICAgICAgIGlmIChkaXIuaGFzTmdUZW1wbGF0ZUNvbnRleHRHdWFyZCAmJiB0aGlzLnRjYi5lbnYuY29uZmlnLmFwcGx5VGVtcGxhdGVDb250ZXh0R3VhcmRzKSB7XG4gICAgICAgICAgY29uc3QgY3R4ID0gdGhpcy5zY29wZS5yZXNvbHZlKHRoaXMudGVtcGxhdGUpO1xuICAgICAgICAgIGNvbnN0IGd1YXJkSW52b2tlID0gdHNDYWxsTWV0aG9kKGRpcklkLCAnbmdUZW1wbGF0ZUNvbnRleHRHdWFyZCcsIFtkaXJJbnN0SWQsIGN0eF0pO1xuICAgICAgICAgIGFkZFBhcnNlU3BhbkluZm8oZ3VhcmRJbnZva2UsIHRoaXMudGVtcGxhdGUuc291cmNlU3Bhbik7XG4gICAgICAgICAgZGlyZWN0aXZlR3VhcmRzLnB1c2goZ3VhcmRJbnZva2UpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQnkgZGVmYXVsdCB0aGUgZ3VhcmQgaXMgc2ltcGx5IGB0cnVlYC5cbiAgICBsZXQgZ3VhcmQ6IHRzLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgICAvLyBJZiB0aGVyZSBhcmUgYW55IGd1YXJkcyBmcm9tIGRpcmVjdGl2ZXMsIHVzZSB0aGVtIGluc3RlYWQuXG4gICAgaWYgKGRpcmVjdGl2ZUd1YXJkcy5sZW5ndGggPiAwKSB7XG4gICAgICAvLyBQb3AgdGhlIGZpcnN0IHZhbHVlIGFuZCB1c2UgaXQgYXMgdGhlIGluaXRpYWxpemVyIHRvIHJlZHVjZSgpLiBUaGlzIHdheSwgYSBzaW5nbGUgZ3VhcmRcbiAgICAgIC8vIHdpbGwgYmUgdXNlZCBvbiBpdHMgb3duLCBidXQgdHdvIG9yIG1vcmUgd2lsbCBiZSBjb21iaW5lZCBpbnRvIGJpbmFyeSBBTkQgZXhwcmVzc2lvbnMuXG4gICAgICBndWFyZCA9IGRpcmVjdGl2ZUd1YXJkcy5yZWR1Y2UoXG4gICAgICAgICAgKGV4cHIsIGRpckd1YXJkKSA9PlxuICAgICAgICAgICAgICB0cy5jcmVhdGVCaW5hcnkoZXhwciwgdHMuU3ludGF4S2luZC5BbXBlcnNhbmRBbXBlcnNhbmRUb2tlbiwgZGlyR3VhcmQpLFxuICAgICAgICAgIGRpcmVjdGl2ZUd1YXJkcy5wb3AoKSEpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBhIG5ldyBTY29wZSBmb3IgdGhlIHRlbXBsYXRlLiBUaGlzIGNvbnN0cnVjdHMgdGhlIGxpc3Qgb2Ygb3BlcmF0aW9ucyBmb3IgdGhlIHRlbXBsYXRlXG4gICAgLy8gY2hpbGRyZW4sIGFzIHdlbGwgYXMgdHJhY2tzIGJpbmRpbmdzIHdpdGhpbiB0aGUgdGVtcGxhdGUuXG4gICAgY29uc3QgdG1wbFNjb3BlID0gU2NvcGUuZm9yTm9kZXModGhpcy50Y2IsIHRoaXMuc2NvcGUsIHRoaXMudGVtcGxhdGUsIGd1YXJkKTtcblxuICAgIC8vIFJlbmRlciB0aGUgdGVtcGxhdGUncyBgU2NvcGVgIGludG8gaXRzIHN0YXRlbWVudHMuXG4gICAgY29uc3Qgc3RhdGVtZW50cyA9IHRtcGxTY29wZS5yZW5kZXIoKTtcbiAgICBpZiAoc3RhdGVtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICAgIC8vIEFzIGFuIG9wdGltaXphdGlvbiwgZG9uJ3QgZ2VuZXJhdGUgdGhlIHNjb3BlJ3MgYmxvY2sgaWYgaXQgaGFzIG5vIHN0YXRlbWVudHMuIFRoaXMgaXNcbiAgICAgIC8vIGJlbmVmaWNpYWwgZm9yIHRlbXBsYXRlcyB0aGF0IGNvbnRhaW4gZm9yIGV4YW1wbGUgYDxzcGFuICpuZ0lmPVwiZmlyc3RcIj48L3NwYW4+YCwgaW4gd2hpY2hcbiAgICAgIC8vIGNhc2UgdGhlcmUncyBubyBuZWVkIHRvIHJlbmRlciB0aGUgYE5nSWZgIGd1YXJkIGV4cHJlc3Npb24uIFRoaXMgc2VlbXMgbGlrZSBhIG1pbm9yXG4gICAgICAvLyBpbXByb3ZlbWVudCwgaG93ZXZlciBpdCByZWR1Y2VzIHRoZSBudW1iZXIgb2YgZmxvdy1ub2RlIGFudGVjZWRlbnRzIHRoYXQgVHlwZVNjcmlwdCBuZWVkc1xuICAgICAgLy8gdG8ga2VlcCBpbnRvIGFjY291bnQgZm9yIHN1Y2ggY2FzZXMsIHJlc3VsdGluZyBpbiBhbiBvdmVyYWxsIHJlZHVjdGlvbiBvZlxuICAgICAgLy8gdHlwZS1jaGVja2luZyB0aW1lLlxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgbGV0IHRtcGxCbG9jazogdHMuU3RhdGVtZW50ID0gdHMuY3JlYXRlQmxvY2soc3RhdGVtZW50cyk7XG4gICAgaWYgKGd1YXJkICE9PSBudWxsKSB7XG4gICAgICAvLyBUaGUgc2NvcGUgaGFzIGEgZ3VhcmQgdGhhdCBuZWVkcyB0byBiZSBhcHBsaWVkLCBzbyB3cmFwIHRoZSB0ZW1wbGF0ZSBibG9jayBpbnRvIGFuIGBpZmBcbiAgICAgIC8vIHN0YXRlbWVudCBjb250YWluaW5nIHRoZSBndWFyZCBleHByZXNzaW9uLlxuICAgICAgdG1wbEJsb2NrID0gdHMuY3JlYXRlSWYoLyogZXhwcmVzc2lvbiAqLyBndWFyZCwgLyogdGhlblN0YXRlbWVudCAqLyB0bXBsQmxvY2spO1xuICAgIH1cbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0bXBsQmxvY2spO1xuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggcmVuZGVycyBhIHRleHQgYmluZGluZyAoaW50ZXJwb2xhdGlvbikgaW50byB0aGUgVENCLlxuICpcbiAqIEV4ZWN1dGluZyB0aGlzIG9wZXJhdGlvbiByZXR1cm5zIG5vdGhpbmcuXG4gKi9cbmNsYXNzIFRjYlRleHRJbnRlcnBvbGF0aW9uT3AgZXh0ZW5kcyBUY2JPcCB7XG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSBiaW5kaW5nOiBUbXBsQXN0Qm91bmRUZXh0KSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGdldCBvcHRpb25hbCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBleGVjdXRlKCk6IG51bGwge1xuICAgIGNvbnN0IGV4cHIgPSB0Y2JFeHByZXNzaW9uKHRoaXMuYmluZGluZy52YWx1ZSwgdGhpcy50Y2IsIHRoaXMuc2NvcGUpO1xuICAgIHRoaXMuc2NvcGUuYWRkU3RhdGVtZW50KHRzLmNyZWF0ZUV4cHJlc3Npb25TdGF0ZW1lbnQoZXhwcikpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQSBgVGNiT3BgIHdoaWNoIGNvbnN0cnVjdHMgYW4gaW5zdGFuY2Ugb2YgYSBkaXJlY3RpdmUgX3dpdGhvdXRfIHNldHRpbmcgYW55IG9mIGl0cyBpbnB1dHMuIElucHV0c1xuICogYXJlIGxhdGVyIHNldCBpbiB0aGUgYFRjYkRpcmVjdGl2ZUlucHV0c09wYC4gVHlwZSBjaGVja2luZyB3YXMgZm91bmQgdG8gYmUgZmFzdGVyIHdoZW4gZG9uZSBpblxuICogdGhpcyB3YXkgYXMgb3Bwb3NlZCB0byBgVGNiRGlyZWN0aXZlQ3Rvck9wYCB3aGljaCBpcyBvbmx5IG5lY2Vzc2FyeSB3aGVuIHRoZSBkaXJlY3RpdmUgaXNcbiAqIGdlbmVyaWMuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgYSByZWZlcmVuY2UgdG8gdGhlIGRpcmVjdGl2ZSBpbnN0YW5jZSB2YXJpYWJsZSB3aXRoIGl0cyBpbmZlcnJlZFxuICogdHlwZS5cbiAqL1xuY2xhc3MgVGNiRGlyZWN0aXZlVHlwZU9wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSBub2RlOiBUbXBsQXN0VGVtcGxhdGV8VG1wbEFzdEVsZW1lbnQsXG4gICAgICBwcml2YXRlIGRpcjogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IG9wdGlvbmFsKCkge1xuICAgIC8vIFRoZSBzdGF0ZW1lbnQgZ2VuZXJhdGVkIGJ5IHRoaXMgb3BlcmF0aW9uIGlzIG9ubHkgdXNlZCB0byBkZWNsYXJlIHRoZSBkaXJlY3RpdmUncyB0eXBlIGFuZFxuICAgIC8vIHdvbid0IHJlcG9ydCBkaWFnbm9zdGljcyBieSBpdHNlbGYsIHNvIHRoZSBvcGVyYXRpb24gaXMgbWFya2VkIGFzIG9wdGlvbmFsIHRvIGF2b2lkXG4gICAgLy8gZ2VuZXJhdGluZyBkZWNsYXJhdGlvbnMgZm9yIGRpcmVjdGl2ZXMgdGhhdCBkb24ndCBoYXZlIGFueSBpbnB1dHMvb3V0cHV0cy5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogdHMuSWRlbnRpZmllciB7XG4gICAgY29uc3QgaWQgPSB0aGlzLnRjYi5hbGxvY2F0ZUlkKCk7XG5cbiAgICBjb25zdCB0eXBlID0gdGhpcy50Y2IuZW52LnJlZmVyZW5jZVR5cGUodGhpcy5kaXIucmVmKTtcbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0c0RlY2xhcmVWYXJpYWJsZShpZCwgdHlwZSkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBjb25zdHJ1Y3RzIGFuIGluc3RhbmNlIG9mIGEgZGlyZWN0aXZlIHdpdGggdHlwZXMgaW5mZXJyZWQgZnJvbSBpdHMgaW5wdXRzLiBUaGVcbiAqIGlucHV0cyB0aGVtc2VsdmVzIGFyZSBub3QgY2hlY2tlZCBoZXJlOyBjaGVja2luZyBvZiBpbnB1dHMgaXMgYWNoaWV2ZWQgaW4gYFRjYkRpcmVjdGl2ZUlucHV0c09wYC5cbiAqIEFueSBlcnJvcnMgcmVwb3J0ZWQgaW4gdGhpcyBzdGF0ZW1lbnQgYXJlIGlnbm9yZWQsIGFzIHRoZSB0eXBlIGNvbnN0cnVjdG9yIGNhbGwgaXMgb25seSBwcmVzZW50XG4gKiBmb3IgdHlwZS1pbmZlcmVuY2UuXG4gKlxuICogV2hlbiBhIERpcmVjdGl2ZSBpcyBnZW5lcmljLCBpdCBpcyByZXF1aXJlZCB0aGF0IHRoZSBUQ0IgZ2VuZXJhdGVzIHRoZSBpbnN0YW5jZSB1c2luZyB0aGlzIG1ldGhvZFxuICogaW4gb3JkZXIgdG8gaW5mZXIgdGhlIHR5cGUgaW5mb3JtYXRpb24gY29ycmVjdGx5LlxuICpcbiAqIEV4ZWN1dGluZyB0aGlzIG9wZXJhdGlvbiByZXR1cm5zIGEgcmVmZXJlbmNlIHRvIHRoZSBkaXJlY3RpdmUgaW5zdGFuY2UgdmFyaWFibGUgd2l0aCBpdHMgaW5mZXJyZWRcbiAqIHR5cGUuXG4gKi9cbmNsYXNzIFRjYkRpcmVjdGl2ZUN0b3JPcCBleHRlbmRzIFRjYk9wIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHRjYjogQ29udGV4dCwgcHJpdmF0ZSBzY29wZTogU2NvcGUsIHByaXZhdGUgbm9kZTogVG1wbEFzdFRlbXBsYXRlfFRtcGxBc3RFbGVtZW50LFxuICAgICAgcHJpdmF0ZSBkaXI6IFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhKSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGdldCBvcHRpb25hbCgpIHtcbiAgICAvLyBUaGUgc3RhdGVtZW50IGdlbmVyYXRlZCBieSB0aGlzIG9wZXJhdGlvbiBpcyBvbmx5IHVzZWQgdG8gaW5mZXIgdGhlIGRpcmVjdGl2ZSdzIHR5cGUgYW5kXG4gICAgLy8gd29uJ3QgcmVwb3J0IGRpYWdub3N0aWNzIGJ5IGl0c2VsZiwgc28gdGhlIG9wZXJhdGlvbiBpcyBtYXJrZWQgYXMgb3B0aW9uYWwuXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBleGVjdXRlKCk6IHRzLklkZW50aWZpZXIge1xuICAgIGNvbnN0IGlkID0gdGhpcy50Y2IuYWxsb2NhdGVJZCgpO1xuXG4gICAgY29uc3QgZ2VuZXJpY0lucHV0cyA9IG5ldyBNYXA8c3RyaW5nLCBUY2JEaXJlY3RpdmVJbnB1dD4oKTtcblxuICAgIGNvbnN0IGlucHV0cyA9IGdldEJvdW5kSW5wdXRzKHRoaXMuZGlyLCB0aGlzLm5vZGUsIHRoaXMudGNiKTtcbiAgICBmb3IgKGNvbnN0IGlucHV0IG9mIGlucHV0cykge1xuICAgICAgZm9yIChjb25zdCBmaWVsZE5hbWUgb2YgaW5wdXQuZmllbGROYW1lcykge1xuICAgICAgICAvLyBTa2lwIHRoZSBmaWVsZCBpZiBhbiBhdHRyaWJ1dGUgaGFzIGFscmVhZHkgYmVlbiBib3VuZCB0byBpdDsgd2UgY2FuJ3QgaGF2ZSBhIGR1cGxpY2F0ZVxuICAgICAgICAvLyBrZXkgaW4gdGhlIHR5cGUgY29uc3RydWN0b3IgY2FsbC5cbiAgICAgICAgaWYgKGdlbmVyaWNJbnB1dHMuaGFzKGZpZWxkTmFtZSkpIHtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGV4cHJlc3Npb24gPSB0cmFuc2xhdGVJbnB1dChpbnB1dC5hdHRyaWJ1dGUsIHRoaXMudGNiLCB0aGlzLnNjb3BlKTtcbiAgICAgICAgZ2VuZXJpY0lucHV0cy5zZXQoZmllbGROYW1lLCB7XG4gICAgICAgICAgdHlwZTogJ2JpbmRpbmcnLFxuICAgICAgICAgIGZpZWxkOiBmaWVsZE5hbWUsXG4gICAgICAgICAgZXhwcmVzc2lvbixcbiAgICAgICAgICBzb3VyY2VTcGFuOiBpbnB1dC5hdHRyaWJ1dGUuc291cmNlU3BhblxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBBZGQgdW5zZXQgZGlyZWN0aXZlIGlucHV0cyBmb3IgZWFjaCBvZiB0aGUgcmVtYWluaW5nIHVuc2V0IGZpZWxkcy5cbiAgICBmb3IgKGNvbnN0IFtmaWVsZE5hbWVdIG9mIHRoaXMuZGlyLmlucHV0cykge1xuICAgICAgaWYgKCFnZW5lcmljSW5wdXRzLmhhcyhmaWVsZE5hbWUpKSB7XG4gICAgICAgIGdlbmVyaWNJbnB1dHMuc2V0KGZpZWxkTmFtZSwge3R5cGU6ICd1bnNldCcsIGZpZWxkOiBmaWVsZE5hbWV9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDYWxsIHRoZSB0eXBlIGNvbnN0cnVjdG9yIG9mIHRoZSBkaXJlY3RpdmUgdG8gaW5mZXIgYSB0eXBlLCBhbmQgYXNzaWduIHRoZSBkaXJlY3RpdmVcbiAgICAvLyBpbnN0YW5jZS5cbiAgICBjb25zdCB0eXBlQ3RvciA9IHRjYkNhbGxUeXBlQ3Rvcih0aGlzLmRpciwgdGhpcy50Y2IsIEFycmF5LmZyb20oZ2VuZXJpY0lucHV0cy52YWx1ZXMoKSkpO1xuICAgIGlnbm9yZURpYWdub3N0aWNzKHR5cGVDdG9yKTtcbiAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0c0NyZWF0ZVZhcmlhYmxlKGlkLCB0eXBlQ3RvcikpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuXG4gIGNpcmN1bGFyRmFsbGJhY2soKTogVGNiT3Age1xuICAgIHJldHVybiBuZXcgVGNiRGlyZWN0aXZlQ3RvckNpcmN1bGFyRmFsbGJhY2tPcCh0aGlzLnRjYiwgdGhpcy5zY29wZSwgdGhpcy5ub2RlLCB0aGlzLmRpcik7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggZ2VuZXJhdGVzIGNvZGUgdG8gY2hlY2sgaW5wdXQgYmluZGluZ3Mgb24gYW4gZWxlbWVudCB0aGF0IGNvcnJlc3BvbmQgd2l0aCB0aGVcbiAqIG1lbWJlcnMgb2YgYSBkaXJlY3RpdmUuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgbm90aGluZy5cbiAqL1xuY2xhc3MgVGNiRGlyZWN0aXZlSW5wdXRzT3AgZXh0ZW5kcyBUY2JPcCB7XG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0Y2I6IENvbnRleHQsIHByaXZhdGUgc2NvcGU6IFNjb3BlLCBwcml2YXRlIG5vZGU6IFRtcGxBc3RUZW1wbGF0ZXxUbXBsQXN0RWxlbWVudCxcbiAgICAgIHByaXZhdGUgZGlyOiBUeXBlQ2hlY2thYmxlRGlyZWN0aXZlTWV0YSkge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZXhlY3V0ZSgpOiBudWxsIHtcbiAgICBsZXQgZGlySWQ6IHRzLkV4cHJlc3Npb258bnVsbCA9IG51bGw7XG5cbiAgICAvLyBUT0RPKGpvb3N0KTogcmVwb3J0IGR1cGxpY2F0ZSBwcm9wZXJ0aWVzXG5cbiAgICBjb25zdCBpbnB1dHMgPSBnZXRCb3VuZElucHV0cyh0aGlzLmRpciwgdGhpcy5ub2RlLCB0aGlzLnRjYik7XG4gICAgZm9yIChjb25zdCBpbnB1dCBvZiBpbnB1dHMpIHtcbiAgICAgIC8vIEZvciBib3VuZCBpbnB1dHMsIHRoZSBwcm9wZXJ0eSBpcyBhc3NpZ25lZCB0aGUgYmluZGluZyBleHByZXNzaW9uLlxuICAgICAgbGV0IGV4cHIgPSB0cmFuc2xhdGVJbnB1dChpbnB1dC5hdHRyaWJ1dGUsIHRoaXMudGNiLCB0aGlzLnNjb3BlKTtcbiAgICAgIGlmICghdGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZklucHV0QmluZGluZ3MpIHtcbiAgICAgICAgLy8gSWYgY2hlY2tpbmcgdGhlIHR5cGUgb2YgYmluZGluZ3MgaXMgZGlzYWJsZWQsIGNhc3QgdGhlIHJlc3VsdGluZyBleHByZXNzaW9uIHRvICdhbnknXG4gICAgICAgIC8vIGJlZm9yZSB0aGUgYXNzaWdubWVudC5cbiAgICAgICAgZXhwciA9IHRzQ2FzdFRvQW55KGV4cHIpO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy50Y2IuZW52LmNvbmZpZy5zdHJpY3ROdWxsSW5wdXRCaW5kaW5ncykge1xuICAgICAgICAvLyBJZiBzdHJpY3QgbnVsbCBjaGVja3MgYXJlIGRpc2FibGVkLCBlcmFzZSBgbnVsbGAgYW5kIGB1bmRlZmluZWRgIGZyb20gdGhlIHR5cGUgYnlcbiAgICAgICAgLy8gd3JhcHBpbmcgdGhlIGV4cHJlc3Npb24gaW4gYSBub24tbnVsbCBhc3NlcnRpb24uXG4gICAgICAgIGV4cHIgPSB0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihleHByKTtcbiAgICAgIH1cblxuICAgICAgbGV0IGFzc2lnbm1lbnQ6IHRzLkV4cHJlc3Npb24gPSB3cmFwRm9yRGlhZ25vc3RpY3MoZXhwcik7XG5cbiAgICAgIGZvciAoY29uc3QgZmllbGROYW1lIG9mIGlucHV0LmZpZWxkTmFtZXMpIHtcbiAgICAgICAgbGV0IHRhcmdldDogdHMuTGVmdEhhbmRTaWRlRXhwcmVzc2lvbjtcbiAgICAgICAgaWYgKHRoaXMuZGlyLmNvZXJjZWRJbnB1dEZpZWxkcy5oYXMoZmllbGROYW1lKSkge1xuICAgICAgICAgIC8vIFRoZSBpbnB1dCBoYXMgYSBjb2VyY2lvbiBkZWNsYXJhdGlvbiB3aGljaCBzaG91bGQgYmUgdXNlZCBpbnN0ZWFkIG9mIGFzc2lnbmluZyB0aGVcbiAgICAgICAgICAvLyBleHByZXNzaW9uIGludG8gdGhlIGlucHV0IGZpZWxkIGRpcmVjdGx5LiBUbyBhY2hpZXZlIHRoaXMsIGEgdmFyaWFibGUgaXMgZGVjbGFyZWRcbiAgICAgICAgICAvLyB3aXRoIGEgdHlwZSBvZiBgdHlwZW9mIERpcmVjdGl2ZS5uZ0FjY2VwdElucHV0VHlwZV9maWVsZE5hbWVgIHdoaWNoIGlzIHRoZW4gdXNlZCBhc1xuICAgICAgICAgIC8vIHRhcmdldCBvZiB0aGUgYXNzaWdubWVudC5cbiAgICAgICAgICBjb25zdCBkaXJUeXBlUmVmID0gdGhpcy50Y2IuZW52LnJlZmVyZW5jZVR5cGUodGhpcy5kaXIucmVmKTtcbiAgICAgICAgICBpZiAoIXRzLmlzVHlwZVJlZmVyZW5jZU5vZGUoZGlyVHlwZVJlZikpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgICBgRXhwZWN0ZWQgVHlwZVJlZmVyZW5jZU5vZGUgZnJvbSByZWZlcmVuY2UgdG8gJHt0aGlzLmRpci5yZWYuZGVidWdOYW1lfWApO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IGlkID0gdGhpcy50Y2IuYWxsb2NhdGVJZCgpO1xuICAgICAgICAgIGNvbnN0IHR5cGUgPSB0c0NyZWF0ZVR5cGVRdWVyeUZvckNvZXJjZWRJbnB1dChkaXJUeXBlUmVmLnR5cGVOYW1lLCBmaWVsZE5hbWUpO1xuICAgICAgICAgIHRoaXMuc2NvcGUuYWRkU3RhdGVtZW50KHRzRGVjbGFyZVZhcmlhYmxlKGlkLCB0eXBlKSk7XG5cbiAgICAgICAgICB0YXJnZXQgPSBpZDtcbiAgICAgICAgfSBlbHNlIGlmICh0aGlzLmRpci51bmRlY2xhcmVkSW5wdXRGaWVsZHMuaGFzKGZpZWxkTmFtZSkpIHtcbiAgICAgICAgICAvLyBJZiBubyBjb2VyY2lvbiBkZWNsYXJhdGlvbiBpcyBwcmVzZW50IG5vciBpcyB0aGUgZmllbGQgZGVjbGFyZWQgKGkuZS4gdGhlIGlucHV0IGlzXG4gICAgICAgICAgLy8gZGVjbGFyZWQgaW4gYSBgQERpcmVjdGl2ZWAgb3IgYEBDb21wb25lbnRgIGRlY29yYXRvcidzIGBpbnB1dHNgIHByb3BlcnR5KSB0aGVyZSBpcyBub1xuICAgICAgICAgIC8vIGFzc2lnbm1lbnQgdGFyZ2V0IGF2YWlsYWJsZSwgc28gdGhpcyBmaWVsZCBpcyBza2lwcGVkLlxuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9IGVsc2UgaWYgKFxuICAgICAgICAgICAgIXRoaXMudGNiLmVudi5jb25maWcuaG9ub3JBY2Nlc3NNb2RpZmllcnNGb3JJbnB1dEJpbmRpbmdzICYmXG4gICAgICAgICAgICB0aGlzLmRpci5yZXN0cmljdGVkSW5wdXRGaWVsZHMuaGFzKGZpZWxkTmFtZSkpIHtcbiAgICAgICAgICAvLyBJZiBzdHJpY3QgY2hlY2tpbmcgb2YgYWNjZXNzIG1vZGlmaWVycyBpcyBkaXNhYmxlZCBhbmQgdGhlIGZpZWxkIGlzIHJlc3RyaWN0ZWRcbiAgICAgICAgICAvLyAoaS5lLiBwcml2YXRlL3Byb3RlY3RlZC9yZWFkb25seSksIGdlbmVyYXRlIGFuIGFzc2lnbm1lbnQgaW50byBhIHRlbXBvcmFyeSB2YXJpYWJsZVxuICAgICAgICAgIC8vIHRoYXQgaGFzIHRoZSB0eXBlIG9mIHRoZSBmaWVsZC4gVGhpcyBhY2hpZXZlcyB0eXBlLWNoZWNraW5nIGJ1dCBjaXJjdW12ZW50cyB0aGUgYWNjZXNzXG4gICAgICAgICAgLy8gbW9kaWZpZXJzLlxuICAgICAgICAgIGlmIChkaXJJZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgZGlySWQgPSB0aGlzLnNjb3BlLnJlc29sdmUodGhpcy5ub2RlLCB0aGlzLmRpcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgaWQgPSB0aGlzLnRjYi5hbGxvY2F0ZUlkKCk7XG4gICAgICAgICAgY29uc3QgZGlyVHlwZVJlZiA9IHRoaXMudGNiLmVudi5yZWZlcmVuY2VUeXBlKHRoaXMuZGlyLnJlZik7XG4gICAgICAgICAgaWYgKCF0cy5pc1R5cGVSZWZlcmVuY2VOb2RlKGRpclR5cGVSZWYpKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgYEV4cGVjdGVkIFR5cGVSZWZlcmVuY2VOb2RlIGZyb20gcmVmZXJlbmNlIHRvICR7dGhpcy5kaXIucmVmLmRlYnVnTmFtZX1gKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc3QgdHlwZSA9IHRzLmNyZWF0ZUluZGV4ZWRBY2Nlc3NUeXBlTm9kZShcbiAgICAgICAgICAgICAgdHMuY3JlYXRlVHlwZVF1ZXJ5Tm9kZShkaXJJZCBhcyB0cy5JZGVudGlmaWVyKSxcbiAgICAgICAgICAgICAgdHMuY3JlYXRlTGl0ZXJhbFR5cGVOb2RlKHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwoZmllbGROYW1lKSkpO1xuICAgICAgICAgIGNvbnN0IHRlbXAgPSB0c0RlY2xhcmVWYXJpYWJsZShpZCwgdHlwZSk7XG4gICAgICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodGVtcCk7XG4gICAgICAgICAgdGFyZ2V0ID0gaWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaWYgKGRpcklkID09PSBudWxsKSB7XG4gICAgICAgICAgICBkaXJJZCA9IHRoaXMuc2NvcGUucmVzb2x2ZSh0aGlzLm5vZGUsIHRoaXMuZGlyKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBUbyBnZXQgZXJyb3JzIGFzc2lnbiBkaXJlY3RseSB0byB0aGUgZmllbGRzIG9uIHRoZSBpbnN0YW5jZSwgdXNpbmcgcHJvcGVydHkgYWNjZXNzXG4gICAgICAgICAgLy8gd2hlbiBwb3NzaWJsZS4gU3RyaW5nIGxpdGVyYWwgZmllbGRzIG1heSBub3QgYmUgdmFsaWQgSlMgaWRlbnRpZmllcnMgc28gd2UgdXNlXG4gICAgICAgICAgLy8gbGl0ZXJhbCBlbGVtZW50IGFjY2VzcyBpbnN0ZWFkIGZvciB0aG9zZSBjYXNlcy5cbiAgICAgICAgICB0YXJnZXQgPSB0aGlzLmRpci5zdHJpbmdMaXRlcmFsSW5wdXRGaWVsZHMuaGFzKGZpZWxkTmFtZSkgP1xuICAgICAgICAgICAgICB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKGRpcklkLCB0cy5jcmVhdGVTdHJpbmdMaXRlcmFsKGZpZWxkTmFtZSkpIDpcbiAgICAgICAgICAgICAgdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MoZGlySWQsIHRzLmNyZWF0ZUlkZW50aWZpZXIoZmllbGROYW1lKSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGaW5hbGx5IHRoZSBhc3NpZ25tZW50IGlzIGV4dGVuZGVkIGJ5IGFzc2lnbmluZyBpdCBpbnRvIHRoZSB0YXJnZXQgZXhwcmVzc2lvbi5cbiAgICAgICAgYXNzaWdubWVudCA9IHRzLmNyZWF0ZUJpbmFyeSh0YXJnZXQsIHRzLlN5bnRheEtpbmQuRXF1YWxzVG9rZW4sIGFzc2lnbm1lbnQpO1xuICAgICAgfVxuXG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKGFzc2lnbm1lbnQsIGlucHV0LmF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgICAgIHRoaXMuc2NvcGUuYWRkU3RhdGVtZW50KHRzLmNyZWF0ZUV4cHJlc3Npb25TdGF0ZW1lbnQoYXNzaWdubWVudCkpO1xuICAgIH1cblxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogQSBgVGNiT3BgIHdoaWNoIGlzIHVzZWQgdG8gZ2VuZXJhdGUgYSBmYWxsYmFjayBleHByZXNzaW9uIGlmIHRoZSBpbmZlcmVuY2Ugb2YgYSBkaXJlY3RpdmUgdHlwZVxuICogdmlhIGBUY2JEaXJlY3RpdmVDdG9yT3BgIHJlcXVpcmVzIGEgcmVmZXJlbmNlIHRvIGl0cyBvd24gdHlwZS4gVGhpcyBjYW4gaGFwcGVuIHVzaW5nIGEgdGVtcGxhdGVcbiAqIHJlZmVyZW5jZTpcbiAqXG4gKiBgYGBodG1sXG4gKiA8c29tZS1jbXAgI3JlZiBbcHJvcF09XCJyZWYuZm9vXCI+PC9zb21lLWNtcD5cbiAqIGBgYFxuICpcbiAqIEluIHRoaXMgY2FzZSwgYFRjYkRpcmVjdGl2ZUN0b3JDaXJjdWxhckZhbGxiYWNrT3BgIHdpbGwgYWRkIGEgc2Vjb25kIGluZmVyZW5jZSBvZiB0aGUgZGlyZWN0aXZlXG4gKiB0eXBlIHRvIHRoZSB0eXBlLWNoZWNrIGJsb2NrLCB0aGlzIHRpbWUgY2FsbGluZyB0aGUgZGlyZWN0aXZlJ3MgdHlwZSBjb25zdHJ1Y3RvciB3aXRob3V0IGFueVxuICogaW5wdXQgZXhwcmVzc2lvbnMuIFRoaXMgaW5mZXJzIHRoZSB3aWRlc3QgcG9zc2libGUgc3VwZXJ0eXBlIGZvciB0aGUgZGlyZWN0aXZlLCB3aGljaCBpcyB1c2VkIHRvXG4gKiByZXNvbHZlIGFueSByZWN1cnNpdmUgcmVmZXJlbmNlcyByZXF1aXJlZCB0byBpbmZlciB0aGUgcmVhbCB0eXBlLlxuICovXG5jbGFzcyBUY2JEaXJlY3RpdmVDdG9yQ2lyY3VsYXJGYWxsYmFja09wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSBub2RlOiBUbXBsQXN0VGVtcGxhdGV8VG1wbEFzdEVsZW1lbnQsXG4gICAgICBwcml2YXRlIGRpcjogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogdHMuSWRlbnRpZmllciB7XG4gICAgY29uc3QgaWQgPSB0aGlzLnRjYi5hbGxvY2F0ZUlkKCk7XG4gICAgY29uc3QgdHlwZUN0b3IgPSB0aGlzLnRjYi5lbnYudHlwZUN0b3JGb3IodGhpcy5kaXIpO1xuICAgIGNvbnN0IGNpcmN1bGFyUGxhY2Vob2xkZXIgPSB0cy5jcmVhdGVDYWxsKFxuICAgICAgICB0eXBlQ3RvciwgLyogdHlwZUFyZ3VtZW50cyAqLyB1bmRlZmluZWQsIFt0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbih0cy5jcmVhdGVOdWxsKCkpXSk7XG4gICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHNDcmVhdGVWYXJpYWJsZShpZCwgY2lyY3VsYXJQbGFjZWhvbGRlcikpO1xuICAgIHJldHVybiBpZDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBmZWVkcyBlbGVtZW50cyBhbmQgdW5jbGFpbWVkIHByb3BlcnRpZXMgdG8gdGhlIGBEb21TY2hlbWFDaGVja2VyYC5cbiAqXG4gKiBUaGUgRE9NIHNjaGVtYSBpcyBub3QgY2hlY2tlZCB2aWEgVENCIGNvZGUgZ2VuZXJhdGlvbi4gSW5zdGVhZCwgdGhlIGBEb21TY2hlbWFDaGVja2VyYCBpbmdlc3RzXG4gKiBlbGVtZW50cyBhbmQgcHJvcGVydHkgYmluZGluZ3MgYW5kIGFjY3VtdWxhdGVzIHN5bnRoZXRpYyBgdHMuRGlhZ25vc3RpY2BzIG91dC1vZi1iYW5kLiBUaGVzZSBhcmVcbiAqIGxhdGVyIG1lcmdlZCB3aXRoIHRoZSBkaWFnbm9zdGljcyBnZW5lcmF0ZWQgZnJvbSB0aGUgVENCLlxuICpcbiAqIEZvciBjb252ZW5pZW5jZSwgdGhlIFRDQiBpdGVyYXRpb24gb2YgdGhlIHRlbXBsYXRlIGlzIHVzZWQgdG8gZHJpdmUgdGhlIGBEb21TY2hlbWFDaGVja2VyYCB2aWFcbiAqIHRoZSBgVGNiRG9tU2NoZW1hQ2hlY2tlck9wYC5cbiAqL1xuY2xhc3MgVGNiRG9tU2NoZW1hQ2hlY2tlck9wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIGVsZW1lbnQ6IFRtcGxBc3RFbGVtZW50LCBwcml2YXRlIGNoZWNrRWxlbWVudDogYm9vbGVhbixcbiAgICAgIHByaXZhdGUgY2xhaW1lZElucHV0czogU2V0PHN0cmluZz4pIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogdHMuRXhwcmVzc2lvbnxudWxsIHtcbiAgICBpZiAodGhpcy5jaGVja0VsZW1lbnQpIHtcbiAgICAgIHRoaXMudGNiLmRvbVNjaGVtYUNoZWNrZXIuY2hlY2tFbGVtZW50KHRoaXMudGNiLmlkLCB0aGlzLmVsZW1lbnQsIHRoaXMudGNiLnNjaGVtYXMpO1xuICAgIH1cblxuICAgIC8vIFRPRE8oYWx4aHViKTogdGhpcyBjb3VsZCBiZSBtb3JlIGVmZmljaWVudC5cbiAgICBmb3IgKGNvbnN0IGJpbmRpbmcgb2YgdGhpcy5lbGVtZW50LmlucHV0cykge1xuICAgICAgaWYgKGJpbmRpbmcudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkgJiYgdGhpcy5jbGFpbWVkSW5wdXRzLmhhcyhiaW5kaW5nLm5hbWUpKSB7XG4gICAgICAgIC8vIFNraXAgdGhpcyBiaW5kaW5nIGFzIGl0IHdhcyBjbGFpbWVkIGJ5IGEgZGlyZWN0aXZlLlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGJpbmRpbmcudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkpIHtcbiAgICAgICAgaWYgKGJpbmRpbmcubmFtZSAhPT0gJ3N0eWxlJyAmJiBiaW5kaW5nLm5hbWUgIT09ICdjbGFzcycpIHtcbiAgICAgICAgICAvLyBBIGRpcmVjdCBiaW5kaW5nIHRvIGEgcHJvcGVydHkuXG4gICAgICAgICAgY29uc3QgcHJvcGVydHlOYW1lID0gQVRUUl9UT19QUk9QW2JpbmRpbmcubmFtZV0gfHwgYmluZGluZy5uYW1lO1xuICAgICAgICAgIHRoaXMudGNiLmRvbVNjaGVtYUNoZWNrZXIuY2hlY2tQcm9wZXJ0eShcbiAgICAgICAgICAgICAgdGhpcy50Y2IuaWQsIHRoaXMuZWxlbWVudCwgcHJvcGVydHlOYW1lLCBiaW5kaW5nLnNvdXJjZVNwYW4sIHRoaXMudGNiLnNjaGVtYXMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cblxuLyoqXG4gKiBNYXBwaW5nIGJldHdlZW4gYXR0cmlidXRlcyBuYW1lcyB0aGF0IGRvbid0IGNvcnJlc3BvbmQgdG8gdGhlaXIgZWxlbWVudCBwcm9wZXJ0eSBuYW1lcy5cbiAqIE5vdGU6IHRoaXMgbWFwcGluZyBoYXMgdG8gYmUga2VwdCBpbiBzeW5jIHdpdGggdGhlIGVxdWFsbHkgbmFtZWQgbWFwcGluZyBpbiB0aGUgcnVudGltZS5cbiAqL1xuY29uc3QgQVRUUl9UT19QUk9QOiB7W25hbWU6IHN0cmluZ106IHN0cmluZ30gPSB7XG4gICdjbGFzcyc6ICdjbGFzc05hbWUnLFxuICAnZm9yJzogJ2h0bWxGb3InLFxuICAnZm9ybWFjdGlvbic6ICdmb3JtQWN0aW9uJyxcbiAgJ2lubmVySHRtbCc6ICdpbm5lckhUTUwnLFxuICAncmVhZG9ubHknOiAncmVhZE9ubHknLFxuICAndGFiaW5kZXgnOiAndGFiSW5kZXgnLFxufTtcblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggZ2VuZXJhdGVzIGNvZGUgdG8gY2hlY2sgXCJ1bmNsYWltZWQgaW5wdXRzXCIgLSBiaW5kaW5ncyBvbiBhbiBlbGVtZW50IHdoaWNoIHdlcmVcbiAqIG5vdCBhdHRyaWJ1dGVkIHRvIGFueSBkaXJlY3RpdmUgb3IgY29tcG9uZW50LCBhbmQgYXJlIGluc3RlYWQgcHJvY2Vzc2VkIGFnYWluc3QgdGhlIEhUTUwgZWxlbWVudFxuICogaXRzZWxmLlxuICpcbiAqIEN1cnJlbnRseSwgb25seSB0aGUgZXhwcmVzc2lvbnMgb2YgdGhlc2UgYmluZGluZ3MgYXJlIGNoZWNrZWQuIFRoZSB0YXJnZXRzIG9mIHRoZSBiaW5kaW5ncyBhcmVcbiAqIGNoZWNrZWQgYWdhaW5zdCB0aGUgRE9NIHNjaGVtYSB2aWEgYSBgVGNiRG9tU2NoZW1hQ2hlY2tlck9wYC5cbiAqXG4gKiBFeGVjdXRpbmcgdGhpcyBvcGVyYXRpb24gcmV0dXJucyBub3RoaW5nLlxuICovXG5jbGFzcyBUY2JVbmNsYWltZWRJbnB1dHNPcCBleHRlbmRzIFRjYk9wIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHRjYjogQ29udGV4dCwgcHJpdmF0ZSBzY29wZTogU2NvcGUsIHByaXZhdGUgZWxlbWVudDogVG1wbEFzdEVsZW1lbnQsXG4gICAgICBwcml2YXRlIGNsYWltZWRJbnB1dHM6IFNldDxzdHJpbmc+KSB7XG4gICAgc3VwZXIoKTtcbiAgfVxuXG4gIGdldCBvcHRpb25hbCgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICBleGVjdXRlKCk6IG51bGwge1xuICAgIC8vIGB0aGlzLmlucHV0c2AgY29udGFpbnMgb25seSB0aG9zZSBiaW5kaW5ncyBub3QgbWF0Y2hlZCBieSBhbnkgZGlyZWN0aXZlLiBUaGVzZSBiaW5kaW5ncyBnbyB0b1xuICAgIC8vIHRoZSBlbGVtZW50IGl0c2VsZi5cbiAgICBsZXQgZWxJZDogdHMuRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcblxuICAgIC8vIFRPRE8oYWx4aHViKTogdGhpcyBjb3VsZCBiZSBtb3JlIGVmZmljaWVudC5cbiAgICBmb3IgKGNvbnN0IGJpbmRpbmcgb2YgdGhpcy5lbGVtZW50LmlucHV0cykge1xuICAgICAgaWYgKGJpbmRpbmcudHlwZSA9PT0gQmluZGluZ1R5cGUuUHJvcGVydHkgJiYgdGhpcy5jbGFpbWVkSW5wdXRzLmhhcyhiaW5kaW5nLm5hbWUpKSB7XG4gICAgICAgIC8vIFNraXAgdGhpcyBiaW5kaW5nIGFzIGl0IHdhcyBjbGFpbWVkIGJ5IGEgZGlyZWN0aXZlLlxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgbGV0IGV4cHIgPSB0Y2JFeHByZXNzaW9uKGJpbmRpbmcudmFsdWUsIHRoaXMudGNiLCB0aGlzLnNjb3BlKTtcbiAgICAgIGlmICghdGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZklucHV0QmluZGluZ3MpIHtcbiAgICAgICAgLy8gSWYgY2hlY2tpbmcgdGhlIHR5cGUgb2YgYmluZGluZ3MgaXMgZGlzYWJsZWQsIGNhc3QgdGhlIHJlc3VsdGluZyBleHByZXNzaW9uIHRvICdhbnknXG4gICAgICAgIC8vIGJlZm9yZSB0aGUgYXNzaWdubWVudC5cbiAgICAgICAgZXhwciA9IHRzQ2FzdFRvQW55KGV4cHIpO1xuICAgICAgfSBlbHNlIGlmICghdGhpcy50Y2IuZW52LmNvbmZpZy5zdHJpY3ROdWxsSW5wdXRCaW5kaW5ncykge1xuICAgICAgICAvLyBJZiBzdHJpY3QgbnVsbCBjaGVja3MgYXJlIGRpc2FibGVkLCBlcmFzZSBgbnVsbGAgYW5kIGB1bmRlZmluZWRgIGZyb20gdGhlIHR5cGUgYnlcbiAgICAgICAgLy8gd3JhcHBpbmcgdGhlIGV4cHJlc3Npb24gaW4gYSBub24tbnVsbCBhc3NlcnRpb24uXG4gICAgICAgIGV4cHIgPSB0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihleHByKTtcbiAgICAgIH1cblxuICAgICAgaWYgKHRoaXMudGNiLmVudi5jb25maWcuY2hlY2tUeXBlT2ZEb21CaW5kaW5ncyAmJiBiaW5kaW5nLnR5cGUgPT09IEJpbmRpbmdUeXBlLlByb3BlcnR5KSB7XG4gICAgICAgIGlmIChiaW5kaW5nLm5hbWUgIT09ICdzdHlsZScgJiYgYmluZGluZy5uYW1lICE9PSAnY2xhc3MnKSB7XG4gICAgICAgICAgaWYgKGVsSWQgPT09IG51bGwpIHtcbiAgICAgICAgICAgIGVsSWQgPSB0aGlzLnNjb3BlLnJlc29sdmUodGhpcy5lbGVtZW50KTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gQSBkaXJlY3QgYmluZGluZyB0byBhIHByb3BlcnR5LlxuICAgICAgICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IEFUVFJfVE9fUFJPUFtiaW5kaW5nLm5hbWVdIHx8IGJpbmRpbmcubmFtZTtcbiAgICAgICAgICBjb25zdCBwcm9wID0gdHMuY3JlYXRlRWxlbWVudEFjY2VzcyhlbElkLCB0cy5jcmVhdGVTdHJpbmdMaXRlcmFsKHByb3BlcnR5TmFtZSkpO1xuICAgICAgICAgIGNvbnN0IHN0bXQgPSB0cy5jcmVhdGVCaW5hcnkocHJvcCwgdHMuU3ludGF4S2luZC5FcXVhbHNUb2tlbiwgd3JhcEZvckRpYWdub3N0aWNzKGV4cHIpKTtcbiAgICAgICAgICBhZGRQYXJzZVNwYW5JbmZvKHN0bXQsIGJpbmRpbmcuc291cmNlU3Bhbik7XG4gICAgICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHMuY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudChzdG10KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHMuY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudChleHByKSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIEEgYmluZGluZyB0byBhbiBhbmltYXRpb24sIGF0dHJpYnV0ZSwgY2xhc3Mgb3Igc3R5bGUuIEZvciBub3csIG9ubHkgdmFsaWRhdGUgdGhlIHJpZ2h0LVxuICAgICAgICAvLyBoYW5kIHNpZGUgb2YgdGhlIGV4cHJlc3Npb24uXG4gICAgICAgIC8vIFRPRE86IHByb3Blcmx5IGNoZWNrIGNsYXNzIGFuZCBzdHlsZSBiaW5kaW5ncy5cbiAgICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHMuY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudChleHByKSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBBIGBUY2JPcGAgd2hpY2ggZ2VuZXJhdGVzIGNvZGUgdG8gY2hlY2sgZXZlbnQgYmluZGluZ3Mgb24gYW4gZWxlbWVudCB0aGF0IGNvcnJlc3BvbmQgd2l0aCB0aGVcbiAqIG91dHB1dHMgb2YgYSBkaXJlY3RpdmUuXG4gKlxuICogRXhlY3V0aW5nIHRoaXMgb3BlcmF0aW9uIHJldHVybnMgbm90aGluZy5cbiAqL1xuY2xhc3MgVGNiRGlyZWN0aXZlT3V0cHV0c09wIGV4dGVuZHMgVGNiT3Age1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgdGNiOiBDb250ZXh0LCBwcml2YXRlIHNjb3BlOiBTY29wZSwgcHJpdmF0ZSBub2RlOiBUbXBsQXN0VGVtcGxhdGV8VG1wbEFzdEVsZW1lbnQsXG4gICAgICBwcml2YXRlIGRpcjogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEpIHtcbiAgICBzdXBlcigpO1xuICB9XG5cbiAgZ2V0IG9wdGlvbmFsKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGV4ZWN1dGUoKTogbnVsbCB7XG4gICAgbGV0IGRpcklkOiB0cy5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAgIGNvbnN0IG91dHB1dHMgPSB0aGlzLmRpci5vdXRwdXRzO1xuXG4gICAgZm9yIChjb25zdCBvdXRwdXQgb2YgdGhpcy5ub2RlLm91dHB1dHMpIHtcbiAgICAgIGlmIChvdXRwdXQudHlwZSAhPT0gUGFyc2VkRXZlbnRUeXBlLlJlZ3VsYXIgfHwgIW91dHB1dHMuaGFzQmluZGluZ1Byb3BlcnR5TmFtZShvdXRwdXQubmFtZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgICAvLyBUT0RPKGFseGh1Yik6IGNvbnNpZGVyIHN1cHBvcnRpbmcgbXVsdGlwbGUgZmllbGRzIHdpdGggdGhlIHNhbWUgcHJvcGVydHkgbmFtZSBmb3Igb3V0cHV0cy5cbiAgICAgIGNvbnN0IGZpZWxkID0gb3V0cHV0cy5nZXRCeUJpbmRpbmdQcm9wZXJ0eU5hbWUob3V0cHV0Lm5hbWUpIVswXS5jbGFzc1Byb3BlcnR5TmFtZTtcblxuICAgICAgaWYgKHRoaXMudGNiLmVudi5jb25maWcuY2hlY2tUeXBlT2ZPdXRwdXRFdmVudHMpIHtcbiAgICAgICAgLy8gRm9yIHN0cmljdCBjaGVja2luZyBvZiBkaXJlY3RpdmUgZXZlbnRzLCBnZW5lcmF0ZSBhIGNhbGwgdG8gdGhlIGBzdWJzY3JpYmVgIG1ldGhvZFxuICAgICAgICAvLyBvbiB0aGUgZGlyZWN0aXZlJ3Mgb3V0cHV0IGZpZWxkIHRvIGxldCB0eXBlIGluZm9ybWF0aW9uIGZsb3cgaW50byB0aGUgaGFuZGxlciBmdW5jdGlvbidzXG4gICAgICAgIC8vIGAkZXZlbnRgIHBhcmFtZXRlci5cbiAgICAgICAgLy9cbiAgICAgICAgLy8gTm90ZSB0aGF0IHRoZSBgRXZlbnRFbWl0dGVyPFQ+YCB0eXBlIGZyb20gJ0Bhbmd1bGFyL2NvcmUnIHRoYXQgaXMgdHlwaWNhbGx5IHVzZWQgZm9yXG4gICAgICAgIC8vIG91dHB1dHMgaGFzIGEgdHlwaW5ncyBkZWZpY2llbmN5IGluIGl0cyBgc3Vic2NyaWJlYCBtZXRob2QuIFRoZSBnZW5lcmljIHR5cGUgYFRgIGlzIG5vdFxuICAgICAgICAvLyBjYXJyaWVkIGludG8gdGhlIGhhbmRsZXIgZnVuY3Rpb24sIHdoaWNoIGlzIHZpdGFsIGZvciBpbmZlcmVuY2Ugb2YgdGhlIHR5cGUgb2YgYCRldmVudGAuXG4gICAgICAgIC8vIEFzIGEgd29ya2Fyb3VuZCwgdGhlIGRpcmVjdGl2ZSdzIGZpZWxkIGlzIHBhc3NlZCBpbnRvIGEgaGVscGVyIGZ1bmN0aW9uIHRoYXQgaGFzIGFcbiAgICAgICAgLy8gc3BlY2lhbGx5IGNyYWZ0ZWQgc2V0IG9mIHNpZ25hdHVyZXMsIHRvIGVmZmVjdGl2ZWx5IGNhc3QgYEV2ZW50RW1pdHRlcjxUPmAgdG8gc29tZXRoaW5nXG4gICAgICAgIC8vIHRoYXQgaGFzIGEgYHN1YnNjcmliZWAgbWV0aG9kIHRoYXQgcHJvcGVybHkgY2FycmllcyB0aGUgYFRgIGludG8gdGhlIGhhbmRsZXIgZnVuY3Rpb24uXG4gICAgICAgIGNvbnN0IGhhbmRsZXIgPSB0Y2JDcmVhdGVFdmVudEhhbmRsZXIob3V0cHV0LCB0aGlzLnRjYiwgdGhpcy5zY29wZSwgRXZlbnRQYXJhbVR5cGUuSW5mZXIpO1xuXG4gICAgICAgIGlmIChkaXJJZCA9PT0gbnVsbCkge1xuICAgICAgICAgIGRpcklkID0gdGhpcy5zY29wZS5yZXNvbHZlKHRoaXMubm9kZSwgdGhpcy5kaXIpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IG91dHB1dEZpZWxkID0gdHMuY3JlYXRlRWxlbWVudEFjY2VzcyhkaXJJZCwgdHMuY3JlYXRlU3RyaW5nTGl0ZXJhbChmaWVsZCkpO1xuICAgICAgICBjb25zdCBvdXRwdXRIZWxwZXIgPVxuICAgICAgICAgICAgdHMuY3JlYXRlQ2FsbCh0aGlzLnRjYi5lbnYuZGVjbGFyZU91dHB1dEhlbHBlcigpLCB1bmRlZmluZWQsIFtvdXRwdXRGaWVsZF0pO1xuICAgICAgICBjb25zdCBzdWJzY3JpYmVGbiA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKG91dHB1dEhlbHBlciwgJ3N1YnNjcmliZScpO1xuICAgICAgICBjb25zdCBjYWxsID0gdHMuY3JlYXRlQ2FsbChzdWJzY3JpYmVGbiwgLyogdHlwZUFyZ3VtZW50cyAqLyB1bmRlZmluZWQsIFtoYW5kbGVyXSk7XG4gICAgICAgIGFkZFBhcnNlU3BhbkluZm8oY2FsbCwgb3V0cHV0LnNvdXJjZVNwYW4pO1xuICAgICAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0cy5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KGNhbGwpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElmIHN0cmljdCBjaGVja2luZyBvZiBkaXJlY3RpdmUgZXZlbnRzIGlzIGRpc2FibGVkLCBlbWl0IGEgaGFuZGxlciBmdW5jdGlvbiB3aGVyZSB0aGVcbiAgICAgICAgLy8gYCRldmVudGAgcGFyYW1ldGVyIGhhcyBhbiBleHBsaWNpdCBgYW55YCB0eXBlLlxuICAgICAgICBjb25zdCBoYW5kbGVyID0gdGNiQ3JlYXRlRXZlbnRIYW5kbGVyKG91dHB1dCwgdGhpcy50Y2IsIHRoaXMuc2NvcGUsIEV2ZW50UGFyYW1UeXBlLkFueSk7XG4gICAgICAgIHRoaXMuc2NvcGUuYWRkU3RhdGVtZW50KHRzLmNyZWF0ZUV4cHJlc3Npb25TdGF0ZW1lbnQoaGFuZGxlcikpO1xuICAgICAgfVxuXG4gICAgICBFeHByZXNzaW9uU2VtYW50aWNWaXNpdG9yLnZpc2l0KFxuICAgICAgICAgIG91dHB1dC5oYW5kbGVyLCB0aGlzLnRjYi5pZCwgdGhpcy50Y2IuYm91bmRUYXJnZXQsIHRoaXMudGNiLm9vYlJlY29yZGVyKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIEEgYFRjYk9wYCB3aGljaCBnZW5lcmF0ZXMgY29kZSB0byBjaGVjayBcInVuY2xhaW1lZCBvdXRwdXRzXCIgLSBldmVudCBiaW5kaW5ncyBvbiBhbiBlbGVtZW50IHdoaWNoXG4gKiB3ZXJlIG5vdCBhdHRyaWJ1dGVkIHRvIGFueSBkaXJlY3RpdmUgb3IgY29tcG9uZW50LCBhbmQgYXJlIGluc3RlYWQgcHJvY2Vzc2VkIGFnYWluc3QgdGhlIEhUTUxcbiAqIGVsZW1lbnQgaXRzZWxmLlxuICpcbiAqIEV4ZWN1dGluZyB0aGlzIG9wZXJhdGlvbiByZXR1cm5zIG5vdGhpbmcuXG4gKi9cbmNsYXNzIFRjYlVuY2xhaW1lZE91dHB1dHNPcCBleHRlbmRzIFRjYk9wIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIHRjYjogQ29udGV4dCwgcHJpdmF0ZSBzY29wZTogU2NvcGUsIHByaXZhdGUgZWxlbWVudDogVG1wbEFzdEVsZW1lbnQsXG4gICAgICBwcml2YXRlIGNsYWltZWRPdXRwdXRzOiBTZXQ8c3RyaW5nPikge1xuICAgIHN1cGVyKCk7XG4gIH1cblxuICBnZXQgb3B0aW9uYWwoKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgZXhlY3V0ZSgpOiBudWxsIHtcbiAgICBsZXQgZWxJZDogdHMuRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcblxuICAgIC8vIFRPRE8oYWx4aHViKTogdGhpcyBjb3VsZCBiZSBtb3JlIGVmZmljaWVudC5cbiAgICBmb3IgKGNvbnN0IG91dHB1dCBvZiB0aGlzLmVsZW1lbnQub3V0cHV0cykge1xuICAgICAgaWYgKHRoaXMuY2xhaW1lZE91dHB1dHMuaGFzKG91dHB1dC5uYW1lKSkge1xuICAgICAgICAvLyBTa2lwIHRoaXMgZXZlbnQgaGFuZGxlciBhcyBpdCB3YXMgY2xhaW1lZCBieSBhIGRpcmVjdGl2ZS5cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChvdXRwdXQudHlwZSA9PT0gUGFyc2VkRXZlbnRUeXBlLkFuaW1hdGlvbikge1xuICAgICAgICAvLyBBbmltYXRpb24gb3V0cHV0IGJpbmRpbmdzIGFsd2F5cyBoYXZlIGFuIGAkZXZlbnRgIHBhcmFtZXRlciBvZiB0eXBlIGBBbmltYXRpb25FdmVudGAuXG4gICAgICAgIGNvbnN0IGV2ZW50VHlwZSA9IHRoaXMudGNiLmVudi5jb25maWcuY2hlY2tUeXBlT2ZBbmltYXRpb25FdmVudHMgP1xuICAgICAgICAgICAgdGhpcy50Y2IuZW52LnJlZmVyZW5jZUV4dGVybmFsVHlwZSgnQGFuZ3VsYXIvYW5pbWF0aW9ucycsICdBbmltYXRpb25FdmVudCcpIDpcbiAgICAgICAgICAgIEV2ZW50UGFyYW1UeXBlLkFueTtcblxuICAgICAgICBjb25zdCBoYW5kbGVyID0gdGNiQ3JlYXRlRXZlbnRIYW5kbGVyKG91dHB1dCwgdGhpcy50Y2IsIHRoaXMuc2NvcGUsIGV2ZW50VHlwZSk7XG4gICAgICAgIHRoaXMuc2NvcGUuYWRkU3RhdGVtZW50KHRzLmNyZWF0ZUV4cHJlc3Npb25TdGF0ZW1lbnQoaGFuZGxlcikpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnRjYi5lbnYuY29uZmlnLmNoZWNrVHlwZU9mRG9tRXZlbnRzKSB7XG4gICAgICAgIC8vIElmIHN0cmljdCBjaGVja2luZyBvZiBET00gZXZlbnRzIGlzIGVuYWJsZWQsIGdlbmVyYXRlIGEgY2FsbCB0byBgYWRkRXZlbnRMaXN0ZW5lcmAgb25cbiAgICAgICAgLy8gdGhlIGVsZW1lbnQgaW5zdGFuY2Ugc28gdGhhdCBUeXBlU2NyaXB0J3MgdHlwZSBpbmZlcmVuY2UgZm9yXG4gICAgICAgIC8vIGBIVE1MRWxlbWVudC5hZGRFdmVudExpc3RlbmVyYCB1c2luZyBgSFRNTEVsZW1lbnRFdmVudE1hcGAgdG8gaW5mZXIgYW4gYWNjdXJhdGUgdHlwZSBmb3JcbiAgICAgICAgLy8gYCRldmVudGAgZGVwZW5kaW5nIG9uIHRoZSBldmVudCBuYW1lLiBGb3IgdW5rbm93biBldmVudCBuYW1lcywgVHlwZVNjcmlwdCByZXNvcnRzIHRvIHRoZVxuICAgICAgICAvLyBiYXNlIGBFdmVudGAgdHlwZS5cbiAgICAgICAgY29uc3QgaGFuZGxlciA9IHRjYkNyZWF0ZUV2ZW50SGFuZGxlcihvdXRwdXQsIHRoaXMudGNiLCB0aGlzLnNjb3BlLCBFdmVudFBhcmFtVHlwZS5JbmZlcik7XG5cbiAgICAgICAgaWYgKGVsSWQgPT09IG51bGwpIHtcbiAgICAgICAgICBlbElkID0gdGhpcy5zY29wZS5yZXNvbHZlKHRoaXMuZWxlbWVudCk7XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY2FsbCA9IHRzLmNyZWF0ZUNhbGwoXG4gICAgICAgICAgICAvKiBleHByZXNzaW9uICovIHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKGVsSWQsICdhZGRFdmVudExpc3RlbmVyJyksXG4gICAgICAgICAgICAvKiB0eXBlQXJndW1lbnRzICovIHVuZGVmaW5lZCxcbiAgICAgICAgICAgIC8qIGFyZ3VtZW50cyAqL1t0cy5jcmVhdGVTdHJpbmdMaXRlcmFsKG91dHB1dC5uYW1lKSwgaGFuZGxlcl0pO1xuICAgICAgICBhZGRQYXJzZVNwYW5JbmZvKGNhbGwsIG91dHB1dC5zb3VyY2VTcGFuKTtcbiAgICAgICAgdGhpcy5zY29wZS5hZGRTdGF0ZW1lbnQodHMuY3JlYXRlRXhwcmVzc2lvblN0YXRlbWVudChjYWxsKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBJZiBzdHJpY3QgY2hlY2tpbmcgb2YgRE9NIGlucHV0cyBpcyBkaXNhYmxlZCwgZW1pdCBhIGhhbmRsZXIgZnVuY3Rpb24gd2hlcmUgdGhlIGAkZXZlbnRgXG4gICAgICAgIC8vIHBhcmFtZXRlciBoYXMgYW4gZXhwbGljaXQgYGFueWAgdHlwZS5cbiAgICAgICAgY29uc3QgaGFuZGxlciA9IHRjYkNyZWF0ZUV2ZW50SGFuZGxlcihvdXRwdXQsIHRoaXMudGNiLCB0aGlzLnNjb3BlLCBFdmVudFBhcmFtVHlwZS5BbnkpO1xuICAgICAgICB0aGlzLnNjb3BlLmFkZFN0YXRlbWVudCh0cy5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KGhhbmRsZXIpKTtcbiAgICAgIH1cblxuICAgICAgRXhwcmVzc2lvblNlbWFudGljVmlzaXRvci52aXNpdChcbiAgICAgICAgICBvdXRwdXQuaGFuZGxlciwgdGhpcy50Y2IuaWQsIHRoaXMudGNiLmJvdW5kVGFyZ2V0LCB0aGlzLnRjYi5vb2JSZWNvcmRlcik7XG4gICAgfVxuXG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBWYWx1ZSB1c2VkIHRvIGJyZWFrIGEgY2lyY3VsYXIgcmVmZXJlbmNlIGJldHdlZW4gYFRjYk9wYHMuXG4gKlxuICogVGhpcyB2YWx1ZSBpcyByZXR1cm5lZCB3aGVuZXZlciBgVGNiT3BgcyBoYXZlIGEgY2lyY3VsYXIgZGVwZW5kZW5jeS4gVGhlIGV4cHJlc3Npb24gaXMgYSBub24tbnVsbFxuICogYXNzZXJ0aW9uIG9mIHRoZSBudWxsIHZhbHVlIChpbiBUeXBlU2NyaXB0LCB0aGUgZXhwcmVzc2lvbiBgbnVsbCFgKS4gVGhpcyBjb25zdHJ1Y3Rpb24gd2lsbCBpbmZlclxuICogdGhlIGxlYXN0IG5hcnJvdyB0eXBlIGZvciB3aGF0ZXZlciBpdCdzIGFzc2lnbmVkIHRvLlxuICovXG5jb25zdCBJTkZFUl9UWVBFX0ZPUl9DSVJDVUxBUl9PUF9FWFBSID0gdHMuY3JlYXRlTm9uTnVsbEV4cHJlc3Npb24odHMuY3JlYXRlTnVsbCgpKTtcblxuLyoqXG4gKiBPdmVyYWxsIGdlbmVyYXRpb24gY29udGV4dCBmb3IgdGhlIHR5cGUgY2hlY2sgYmxvY2suXG4gKlxuICogYENvbnRleHRgIGhhbmRsZXMgb3BlcmF0aW9ucyBkdXJpbmcgY29kZSBnZW5lcmF0aW9uIHdoaWNoIGFyZSBnbG9iYWwgd2l0aCByZXNwZWN0IHRvIHRoZSB3aG9sZVxuICogYmxvY2suIEl0J3MgcmVzcG9uc2libGUgZm9yIHZhcmlhYmxlIG5hbWUgYWxsb2NhdGlvbiBhbmQgbWFuYWdlbWVudCBvZiBhbnkgaW1wb3J0cyBuZWVkZWQuIEl0XG4gKiBhbHNvIGNvbnRhaW5zIHRoZSB0ZW1wbGF0ZSBtZXRhZGF0YSBpdHNlbGYuXG4gKi9cbmV4cG9ydCBjbGFzcyBDb250ZXh0IHtcbiAgcHJpdmF0ZSBuZXh0SWQgPSAxO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgICAgcmVhZG9ubHkgZW52OiBFbnZpcm9ubWVudCwgcmVhZG9ubHkgZG9tU2NoZW1hQ2hlY2tlcjogRG9tU2NoZW1hQ2hlY2tlcixcbiAgICAgIHJlYWRvbmx5IG9vYlJlY29yZGVyOiBPdXRPZkJhbmREaWFnbm9zdGljUmVjb3JkZXIsIHJlYWRvbmx5IGlkOiBUZW1wbGF0ZUlkLFxuICAgICAgcmVhZG9ubHkgYm91bmRUYXJnZXQ6IEJvdW5kVGFyZ2V0PFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhPixcbiAgICAgIHByaXZhdGUgcGlwZXM6IE1hcDxzdHJpbmcsIFJlZmVyZW5jZTxDbGFzc0RlY2xhcmF0aW9uPHRzLkNsYXNzRGVjbGFyYXRpb24+Pj4sXG4gICAgICByZWFkb25seSBzY2hlbWFzOiBTY2hlbWFNZXRhZGF0YVtdKSB7fVxuXG4gIC8qKlxuICAgKiBBbGxvY2F0ZSBhIG5ldyB2YXJpYWJsZSBuYW1lIGZvciB1c2Ugd2l0aGluIHRoZSBgQ29udGV4dGAuXG4gICAqXG4gICAqIEN1cnJlbnRseSB0aGlzIHVzZXMgYSBtb25vdG9uaWNhbGx5IGluY3JlYXNpbmcgY291bnRlciwgYnV0IGluIHRoZSBmdXR1cmUgdGhlIHZhcmlhYmxlIG5hbWVcbiAgICogbWlnaHQgY2hhbmdlIGRlcGVuZGluZyBvbiB0aGUgdHlwZSBvZiBkYXRhIGJlaW5nIHN0b3JlZC5cbiAgICovXG4gIGFsbG9jYXRlSWQoKTogdHMuSWRlbnRpZmllciB7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZUlkZW50aWZpZXIoYF90JHt0aGlzLm5leHRJZCsrfWApO1xuICB9XG5cbiAgZ2V0UGlwZUJ5TmFtZShuYW1lOiBzdHJpbmcpOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmICghdGhpcy5waXBlcy5oYXMobmFtZSkpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5lbnYucGlwZUluc3QodGhpcy5waXBlcy5nZXQobmFtZSkhKTtcbiAgfVxufVxuXG4vKipcbiAqIExvY2FsIHNjb3BlIHdpdGhpbiB0aGUgdHlwZSBjaGVjayBibG9jayBmb3IgYSBwYXJ0aWN1bGFyIHRlbXBsYXRlLlxuICpcbiAqIFRoZSB0b3AtbGV2ZWwgdGVtcGxhdGUgYW5kIGVhY2ggbmVzdGVkIGA8bmctdGVtcGxhdGU+YCBoYXZlIHRoZWlyIG93biBgU2NvcGVgLCB3aGljaCBleGlzdCBpbiBhXG4gKiBoaWVyYXJjaHkuIFRoZSBzdHJ1Y3R1cmUgb2YgdGhpcyBoaWVyYXJjaHkgbWlycm9ycyB0aGUgc3ludGFjdGljIHNjb3BlcyBpbiB0aGUgZ2VuZXJhdGVkIHR5cGVcbiAqIGNoZWNrIGJsb2NrLCB3aGVyZSBlYWNoIG5lc3RlZCB0ZW1wbGF0ZSBpcyBlbmNhc2VkIGluIGFuIGBpZmAgc3RydWN0dXJlLlxuICpcbiAqIEFzIGEgdGVtcGxhdGUncyBgVGNiT3BgcyBhcmUgZXhlY3V0ZWQgaW4gYSBnaXZlbiBgU2NvcGVgLCBzdGF0ZW1lbnRzIGFyZSBhZGRlZCB2aWFcbiAqIGBhZGRTdGF0ZW1lbnQoKWAuIFdoZW4gdGhpcyBwcm9jZXNzaW5nIGlzIGNvbXBsZXRlLCB0aGUgYFNjb3BlYCBjYW4gYmUgdHVybmVkIGludG8gYSBgdHMuQmxvY2tgXG4gKiB2aWEgYHJlbmRlclRvQmxvY2soKWAuXG4gKlxuICogSWYgYSBgVGNiT3BgIHJlcXVpcmVzIHRoZSBvdXRwdXQgb2YgYW5vdGhlciwgaXQgY2FuIGNhbGwgYHJlc29sdmUoKWAuXG4gKi9cbmNsYXNzIFNjb3BlIHtcbiAgLyoqXG4gICAqIEEgcXVldWUgb2Ygb3BlcmF0aW9ucyB3aGljaCBuZWVkIHRvIGJlIHBlcmZvcm1lZCB0byBnZW5lcmF0ZSB0aGUgVENCIGNvZGUgZm9yIHRoaXMgc2NvcGUuXG4gICAqXG4gICAqIFRoaXMgYXJyYXkgY2FuIGNvbnRhaW4gZWl0aGVyIGEgYFRjYk9wYCB3aGljaCBoYXMgeWV0IHRvIGJlIGV4ZWN1dGVkLCBvciBhIGB0cy5FeHByZXNzaW9ufG51bGxgXG4gICAqIHJlcHJlc2VudGluZyB0aGUgbWVtb2l6ZWQgcmVzdWx0IG9mIGV4ZWN1dGluZyB0aGUgb3BlcmF0aW9uLiBBcyBvcGVyYXRpb25zIGFyZSBleGVjdXRlZCwgdGhlaXJcbiAgICogcmVzdWx0cyBhcmUgd3JpdHRlbiBpbnRvIHRoZSBgb3BRdWV1ZWAsIG92ZXJ3cml0aW5nIHRoZSBvcmlnaW5hbCBvcGVyYXRpb24uXG4gICAqXG4gICAqIElmIGFuIG9wZXJhdGlvbiBpcyBpbiB0aGUgcHJvY2VzcyBvZiBiZWluZyBleGVjdXRlZCwgaXQgaXMgdGVtcG9yYXJpbHkgb3ZlcndyaXR0ZW4gaGVyZSB3aXRoXG4gICAqIGBJTkZFUl9UWVBFX0ZPUl9DSVJDVUxBUl9PUF9FWFBSYC4gVGhpcyB3YXksIGlmIGEgY3ljbGUgaXMgZW5jb3VudGVyZWQgd2hlcmUgYW4gb3BlcmF0aW9uXG4gICAqIGRlcGVuZHMgdHJhbnNpdGl2ZWx5IG9uIGl0cyBvd24gcmVzdWx0LCB0aGUgaW5uZXIgb3BlcmF0aW9uIHdpbGwgaW5mZXIgdGhlIGxlYXN0IG5hcnJvdyB0eXBlXG4gICAqIHRoYXQgZml0cyBpbnN0ZWFkLiBUaGlzIGhhcyB0aGUgc2FtZSBzZW1hbnRpY3MgYXMgVHlwZVNjcmlwdCBpdHNlbGYgd2hlbiB0eXBlcyBhcmUgcmVmZXJlbmNlZFxuICAgKiBjaXJjdWxhcmx5LlxuICAgKi9cbiAgcHJpdmF0ZSBvcFF1ZXVlOiAoVGNiT3B8dHMuRXhwcmVzc2lvbnxudWxsKVtdID0gW107XG5cbiAgLyoqXG4gICAqIEEgbWFwIG9mIGBUbXBsQXN0RWxlbWVudGBzIHRvIHRoZSBpbmRleCBvZiB0aGVpciBgVGNiRWxlbWVudE9wYCBpbiB0aGUgYG9wUXVldWVgXG4gICAqL1xuICBwcml2YXRlIGVsZW1lbnRPcE1hcCA9IG5ldyBNYXA8VG1wbEFzdEVsZW1lbnQsIG51bWJlcj4oKTtcbiAgLyoqXG4gICAqIEEgbWFwIG9mIG1hcHMgd2hpY2ggdHJhY2tzIHRoZSBpbmRleCBvZiBgVGNiRGlyZWN0aXZlQ3Rvck9wYHMgaW4gdGhlIGBvcFF1ZXVlYCBmb3IgZWFjaFxuICAgKiBkaXJlY3RpdmUgb24gYSBgVG1wbEFzdEVsZW1lbnRgIG9yIGBUbXBsQXN0VGVtcGxhdGVgIG5vZGUuXG4gICAqL1xuICBwcml2YXRlIGRpcmVjdGl2ZU9wTWFwID1cbiAgICAgIG5ldyBNYXA8VG1wbEFzdEVsZW1lbnR8VG1wbEFzdFRlbXBsYXRlLCBNYXA8VHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEsIG51bWJlcj4+KCk7XG5cbiAgLyoqXG4gICAqIE1hcCBvZiBpbW1lZGlhdGVseSBuZXN0ZWQgPG5nLXRlbXBsYXRlPnMgKHdpdGhpbiB0aGlzIGBTY29wZWApIHJlcHJlc2VudGVkIGJ5IGBUbXBsQXN0VGVtcGxhdGVgXG4gICAqIG5vZGVzIHRvIHRoZSBpbmRleCBvZiB0aGVpciBgVGNiVGVtcGxhdGVDb250ZXh0T3BgcyBpbiB0aGUgYG9wUXVldWVgLlxuICAgKi9cbiAgcHJpdmF0ZSB0ZW1wbGF0ZUN0eE9wTWFwID0gbmV3IE1hcDxUbXBsQXN0VGVtcGxhdGUsIG51bWJlcj4oKTtcblxuICAvKipcbiAgICogTWFwIG9mIHZhcmlhYmxlcyBkZWNsYXJlZCBvbiB0aGUgdGVtcGxhdGUgdGhhdCBjcmVhdGVkIHRoaXMgYFNjb3BlYCAocmVwcmVzZW50ZWQgYnlcbiAgICogYFRtcGxBc3RWYXJpYWJsZWAgbm9kZXMpIHRvIHRoZSBpbmRleCBvZiB0aGVpciBgVGNiVmFyaWFibGVPcGBzIGluIHRoZSBgb3BRdWV1ZWAuXG4gICAqL1xuICBwcml2YXRlIHZhck1hcCA9IG5ldyBNYXA8VG1wbEFzdFZhcmlhYmxlLCBudW1iZXI+KCk7XG5cbiAgLyoqXG4gICAqIFN0YXRlbWVudHMgZm9yIHRoaXMgdGVtcGxhdGUuXG4gICAqXG4gICAqIEV4ZWN1dGluZyB0aGUgYFRjYk9wYHMgaW4gdGhlIGBvcFF1ZXVlYCBwb3B1bGF0ZXMgdGhpcyBhcnJheS5cbiAgICovXG4gIHByaXZhdGUgc3RhdGVtZW50czogdHMuU3RhdGVtZW50W10gPSBbXTtcblxuICBwcml2YXRlIGNvbnN0cnVjdG9yKFxuICAgICAgcHJpdmF0ZSB0Y2I6IENvbnRleHQsIHByaXZhdGUgcGFyZW50OiBTY29wZXxudWxsID0gbnVsbCxcbiAgICAgIHByaXZhdGUgZ3VhcmQ6IHRzLkV4cHJlc3Npb258bnVsbCA9IG51bGwpIHt9XG5cbiAgLyoqXG4gICAqIENvbnN0cnVjdHMgYSBgU2NvcGVgIGdpdmVuIGVpdGhlciBhIGBUbXBsQXN0VGVtcGxhdGVgIG9yIGEgbGlzdCBvZiBgVG1wbEFzdE5vZGVgcy5cbiAgICpcbiAgICogQHBhcmFtIHRjYiB0aGUgb3ZlcmFsbCBjb250ZXh0IG9mIFRDQiBnZW5lcmF0aW9uLlxuICAgKiBAcGFyYW0gcGFyZW50IHRoZSBgU2NvcGVgIG9mIHRoZSBwYXJlbnQgdGVtcGxhdGUgKGlmIGFueSkgb3IgYG51bGxgIGlmIHRoaXMgaXMgdGhlIHJvb3RcbiAgICogYFNjb3BlYC5cbiAgICogQHBhcmFtIHRlbXBsYXRlT3JOb2RlcyBlaXRoZXIgYSBgVG1wbEFzdFRlbXBsYXRlYCByZXByZXNlbnRpbmcgdGhlIHRlbXBsYXRlIGZvciB3aGljaCB0b1xuICAgKiBjYWxjdWxhdGUgdGhlIGBTY29wZWAsIG9yIGEgbGlzdCBvZiBub2RlcyBpZiBubyBvdXRlciB0ZW1wbGF0ZSBvYmplY3QgaXMgYXZhaWxhYmxlLlxuICAgKiBAcGFyYW0gZ3VhcmQgYW4gZXhwcmVzc2lvbiB0aGF0IGlzIGFwcGxpZWQgdG8gdGhpcyBzY29wZSBmb3IgdHlwZSBuYXJyb3dpbmcgcHVycG9zZXMuXG4gICAqL1xuICBzdGF0aWMgZm9yTm9kZXMoXG4gICAgICB0Y2I6IENvbnRleHQsIHBhcmVudDogU2NvcGV8bnVsbCwgdGVtcGxhdGVPck5vZGVzOiBUbXBsQXN0VGVtcGxhdGV8KFRtcGxBc3ROb2RlW10pLFxuICAgICAgZ3VhcmQ6IHRzLkV4cHJlc3Npb258bnVsbCk6IFNjb3BlIHtcbiAgICBjb25zdCBzY29wZSA9IG5ldyBTY29wZSh0Y2IsIHBhcmVudCwgZ3VhcmQpO1xuXG4gICAgbGV0IGNoaWxkcmVuOiBUbXBsQXN0Tm9kZVtdO1xuXG4gICAgLy8gSWYgZ2l2ZW4gYW4gYWN0dWFsIGBUbXBsQXN0VGVtcGxhdGVgIGluc3RhbmNlLCB0aGVuIHByb2Nlc3MgYW55IGFkZGl0aW9uYWwgaW5mb3JtYXRpb24gaXRcbiAgICAvLyBoYXMuXG4gICAgaWYgKHRlbXBsYXRlT3JOb2RlcyBpbnN0YW5jZW9mIFRtcGxBc3RUZW1wbGF0ZSkge1xuICAgICAgLy8gVGhlIHRlbXBsYXRlJ3MgdmFyaWFibGUgZGVjbGFyYXRpb25zIG5lZWQgdG8gYmUgYWRkZWQgYXMgYFRjYlZhcmlhYmxlT3Bgcy5cbiAgICAgIGNvbnN0IHZhck1hcCA9IG5ldyBNYXA8c3RyaW5nLCBUbXBsQXN0VmFyaWFibGU+KCk7XG5cbiAgICAgIGZvciAoY29uc3QgdiBvZiB0ZW1wbGF0ZU9yTm9kZXMudmFyaWFibGVzKSB7XG4gICAgICAgIC8vIFZhbGlkYXRlIHRoYXQgdmFyaWFibGVzIG9uIHRoZSBgVG1wbEFzdFRlbXBsYXRlYCBhcmUgb25seSBkZWNsYXJlZCBvbmNlLlxuICAgICAgICBpZiAoIXZhck1hcC5oYXModi5uYW1lKSkge1xuICAgICAgICAgIHZhck1hcC5zZXQodi5uYW1lLCB2KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBmaXJzdERlY2wgPSB2YXJNYXAuZ2V0KHYubmFtZSkhO1xuICAgICAgICAgIHRjYi5vb2JSZWNvcmRlci5kdXBsaWNhdGVUZW1wbGF0ZVZhcih0Y2IuaWQsIHYsIGZpcnN0RGVjbCk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBvcEluZGV4ID0gc2NvcGUub3BRdWV1ZS5wdXNoKG5ldyBUY2JWYXJpYWJsZU9wKHRjYiwgc2NvcGUsIHRlbXBsYXRlT3JOb2RlcywgdikpIC0gMTtcbiAgICAgICAgc2NvcGUudmFyTWFwLnNldCh2LCBvcEluZGV4KTtcbiAgICAgIH1cbiAgICAgIGNoaWxkcmVuID0gdGVtcGxhdGVPck5vZGVzLmNoaWxkcmVuO1xuICAgIH0gZWxzZSB7XG4gICAgICBjaGlsZHJlbiA9IHRlbXBsYXRlT3JOb2RlcztcbiAgICB9XG4gICAgZm9yIChjb25zdCBub2RlIG9mIGNoaWxkcmVuKSB7XG4gICAgICBzY29wZS5hcHBlbmROb2RlKG5vZGUpO1xuICAgIH1cbiAgICByZXR1cm4gc2NvcGU7XG4gIH1cblxuICAvKipcbiAgICogTG9vayB1cCBhIGB0cy5FeHByZXNzaW9uYCByZXByZXNlbnRpbmcgdGhlIHZhbHVlIG9mIHNvbWUgb3BlcmF0aW9uIGluIHRoZSBjdXJyZW50IGBTY29wZWAsXG4gICAqIGluY2x1ZGluZyBhbnkgcGFyZW50IHNjb3BlKHMpLlxuICAgKlxuICAgKiBAcGFyYW0gbm9kZSBhIGBUbXBsQXN0Tm9kZWAgb2YgdGhlIG9wZXJhdGlvbiBpbiBxdWVzdGlvbi4gVGhlIGxvb2t1cCBwZXJmb3JtZWQgd2lsbCBkZXBlbmQgb25cbiAgICogdGhlIHR5cGUgb2YgdGhpcyBub2RlOlxuICAgKlxuICAgKiBBc3N1bWluZyBgZGlyZWN0aXZlYCBpcyBub3QgcHJlc2VudCwgdGhlbiBgcmVzb2x2ZWAgd2lsbCByZXR1cm46XG4gICAqXG4gICAqICogYFRtcGxBc3RFbGVtZW50YCAtIHJldHJpZXZlIHRoZSBleHByZXNzaW9uIGZvciB0aGUgZWxlbWVudCBET00gbm9kZVxuICAgKiAqIGBUbXBsQXN0VGVtcGxhdGVgIC0gcmV0cmlldmUgdGhlIHRlbXBsYXRlIGNvbnRleHQgdmFyaWFibGVcbiAgICogKiBgVG1wbEFzdFZhcmlhYmxlYCAtIHJldHJpZXZlIGEgdGVtcGxhdGUgbGV0LSB2YXJpYWJsZVxuICAgKlxuICAgKiBAcGFyYW0gZGlyZWN0aXZlIGlmIHByZXNlbnQsIGEgZGlyZWN0aXZlIHR5cGUgb24gYSBgVG1wbEFzdEVsZW1lbnRgIG9yIGBUbXBsQXN0VGVtcGxhdGVgIHRvXG4gICAqIGxvb2sgdXAgaW5zdGVhZCBvZiB0aGUgZGVmYXVsdCBmb3IgYW4gZWxlbWVudCBvciB0ZW1wbGF0ZSBub2RlLlxuICAgKi9cbiAgcmVzb2x2ZShcbiAgICAgIG5vZGU6IFRtcGxBc3RFbGVtZW50fFRtcGxBc3RUZW1wbGF0ZXxUbXBsQXN0VmFyaWFibGUsXG4gICAgICBkaXJlY3RpdmU/OiBUeXBlQ2hlY2thYmxlRGlyZWN0aXZlTWV0YSk6IHRzLkV4cHJlc3Npb24ge1xuICAgIC8vIEF0dGVtcHQgdG8gcmVzb2x2ZSB0aGUgb3BlcmF0aW9uIGxvY2FsbHkuXG4gICAgY29uc3QgcmVzID0gdGhpcy5yZXNvbHZlTG9jYWwobm9kZSwgZGlyZWN0aXZlKTtcbiAgICBpZiAocmVzICE9PSBudWxsKSB7XG4gICAgICByZXR1cm4gcmVzO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wYXJlbnQgIT09IG51bGwpIHtcbiAgICAgIC8vIENoZWNrIHdpdGggdGhlIHBhcmVudC5cbiAgICAgIHJldHVybiB0aGlzLnBhcmVudC5yZXNvbHZlKG5vZGUsIGRpcmVjdGl2ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IHJlc29sdmUgJHtub2RlfSAvICR7ZGlyZWN0aXZlfWApO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBZGQgYSBzdGF0ZW1lbnQgdG8gdGhpcyBzY29wZS5cbiAgICovXG4gIGFkZFN0YXRlbWVudChzdG10OiB0cy5TdGF0ZW1lbnQpOiB2b2lkIHtcbiAgICB0aGlzLnN0YXRlbWVudHMucHVzaChzdG10KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHN0YXRlbWVudHMuXG4gICAqL1xuICByZW5kZXIoKTogdHMuU3RhdGVtZW50W10ge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5vcFF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICB0aGlzLmV4ZWN1dGVPcChpLCAvKiBza2lwT3B0aW9uYWwgKi8gdHJ1ZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLnN0YXRlbWVudHM7XG4gIH1cblxuICAvKipcbiAgICogUmV0dXJucyBhbiBleHByZXNzaW9uIG9mIGFsbCB0ZW1wbGF0ZSBndWFyZHMgdGhhdCBhcHBseSB0byB0aGlzIHNjb3BlLCBpbmNsdWRpbmcgdGhvc2Ugb2ZcbiAgICogcGFyZW50IHNjb3Blcy4gSWYgbm8gZ3VhcmRzIGhhdmUgYmVlbiBhcHBsaWVkLCBudWxsIGlzIHJldHVybmVkLlxuICAgKi9cbiAgZ3VhcmRzKCk6IHRzLkV4cHJlc3Npb258bnVsbCB7XG4gICAgbGV0IHBhcmVudEd1YXJkczogdHMuRXhwcmVzc2lvbnxudWxsID0gbnVsbDtcbiAgICBpZiAodGhpcy5wYXJlbnQgIT09IG51bGwpIHtcbiAgICAgIC8vIFN0YXJ0IHdpdGggdGhlIGd1YXJkcyBmcm9tIHRoZSBwYXJlbnQgc2NvcGUsIGlmIHByZXNlbnQuXG4gICAgICBwYXJlbnRHdWFyZHMgPSB0aGlzLnBhcmVudC5ndWFyZHMoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5ndWFyZCA9PT0gbnVsbCkge1xuICAgICAgLy8gVGhpcyBzY29wZSBkb2VzIG5vdCBoYXZlIGEgZ3VhcmQsIHNvIHJldHVybiB0aGUgcGFyZW50J3MgZ3VhcmRzIGFzIGlzLlxuICAgICAgcmV0dXJuIHBhcmVudEd1YXJkcztcbiAgICB9IGVsc2UgaWYgKHBhcmVudEd1YXJkcyA9PT0gbnVsbCkge1xuICAgICAgLy8gVGhlcmUncyBubyBndWFyZHMgZnJvbSB0aGUgcGFyZW50IHNjb3BlLCBzbyB0aGlzIHNjb3BlJ3MgZ3VhcmQgcmVwcmVzZW50cyBhbGwgYXZhaWxhYmxlXG4gICAgICAvLyBndWFyZHMuXG4gICAgICByZXR1cm4gdGhpcy5ndWFyZDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQm90aCB0aGUgcGFyZW50IHNjb3BlIGFuZCB0aGlzIHNjb3BlIHByb3ZpZGUgYSBndWFyZCwgc28gY3JlYXRlIGEgY29tYmluYXRpb24gb2YgdGhlIHR3by5cbiAgICAgIC8vIEl0IGlzIGltcG9ydGFudCB0aGF0IHRoZSBwYXJlbnQgZ3VhcmQgaXMgdXNlZCBhcyBsZWZ0IG9wZXJhbmQsIGdpdmVuIHRoYXQgaXQgbWF5IHByb3ZpZGVcbiAgICAgIC8vIG5hcnJvd2luZyB0aGF0IGlzIHJlcXVpcmVkIGZvciB0aGlzIHNjb3BlJ3MgZ3VhcmQgdG8gYmUgdmFsaWQuXG4gICAgICByZXR1cm4gdHMuY3JlYXRlQmluYXJ5KHBhcmVudEd1YXJkcywgdHMuU3ludGF4S2luZC5BbXBlcnNhbmRBbXBlcnNhbmRUb2tlbiwgdGhpcy5ndWFyZCk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSByZXNvbHZlTG9jYWwoXG4gICAgICByZWY6IFRtcGxBc3RFbGVtZW50fFRtcGxBc3RUZW1wbGF0ZXxUbXBsQXN0VmFyaWFibGUsXG4gICAgICBkaXJlY3RpdmU/OiBUeXBlQ2hlY2thYmxlRGlyZWN0aXZlTWV0YSk6IHRzLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKHJlZiBpbnN0YW5jZW9mIFRtcGxBc3RWYXJpYWJsZSAmJiB0aGlzLnZhck1hcC5oYXMocmVmKSkge1xuICAgICAgLy8gUmVzb2x2aW5nIGEgY29udGV4dCB2YXJpYWJsZSBmb3IgdGhpcyB0ZW1wbGF0ZS5cbiAgICAgIC8vIEV4ZWN1dGUgdGhlIGBUY2JWYXJpYWJsZU9wYCBhc3NvY2lhdGVkIHdpdGggdGhlIGBUbXBsQXN0VmFyaWFibGVgLlxuICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZU9wKHRoaXMudmFyTWFwLmdldChyZWYpISk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgcmVmIGluc3RhbmNlb2YgVG1wbEFzdFRlbXBsYXRlICYmIGRpcmVjdGl2ZSA9PT0gdW5kZWZpbmVkICYmXG4gICAgICAgIHRoaXMudGVtcGxhdGVDdHhPcE1hcC5oYXMocmVmKSkge1xuICAgICAgLy8gUmVzb2x2aW5nIHRoZSBjb250ZXh0IG9mIHRoZSBnaXZlbiBzdWItdGVtcGxhdGUuXG4gICAgICAvLyBFeGVjdXRlIHRoZSBgVGNiVGVtcGxhdGVDb250ZXh0T3BgIGZvciB0aGUgdGVtcGxhdGUuXG4gICAgICByZXR1cm4gdGhpcy5yZXNvbHZlT3AodGhpcy50ZW1wbGF0ZUN0eE9wTWFwLmdldChyZWYpISk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgICAgKHJlZiBpbnN0YW5jZW9mIFRtcGxBc3RFbGVtZW50IHx8IHJlZiBpbnN0YW5jZW9mIFRtcGxBc3RUZW1wbGF0ZSkgJiZcbiAgICAgICAgZGlyZWN0aXZlICE9PSB1bmRlZmluZWQgJiYgdGhpcy5kaXJlY3RpdmVPcE1hcC5oYXMocmVmKSkge1xuICAgICAgLy8gUmVzb2x2aW5nIGEgZGlyZWN0aXZlIG9uIGFuIGVsZW1lbnQgb3Igc3ViLXRlbXBsYXRlLlxuICAgICAgY29uc3QgZGlyTWFwID0gdGhpcy5kaXJlY3RpdmVPcE1hcC5nZXQocmVmKSE7XG4gICAgICBpZiAoZGlyTWFwLmhhcyhkaXJlY3RpdmUpKSB7XG4gICAgICAgIHJldHVybiB0aGlzLnJlc29sdmVPcChkaXJNYXAuZ2V0KGRpcmVjdGl2ZSkhKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocmVmIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQgJiYgdGhpcy5lbGVtZW50T3BNYXAuaGFzKHJlZikpIHtcbiAgICAgIC8vIFJlc29sdmluZyB0aGUgRE9NIG5vZGUgb2YgYW4gZWxlbWVudCBpbiB0aGlzIHRlbXBsYXRlLlxuICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZU9wKHRoaXMuZWxlbWVudE9wTWFwLmdldChyZWYpISk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBMaWtlIGBleGVjdXRlT3BgLCBidXQgYXNzZXJ0IHRoYXQgdGhlIG9wZXJhdGlvbiBhY3R1YWxseSByZXR1cm5lZCBgdHMuRXhwcmVzc2lvbmAuXG4gICAqL1xuICBwcml2YXRlIHJlc29sdmVPcChvcEluZGV4OiBudW1iZXIpOiB0cy5FeHByZXNzaW9uIHtcbiAgICBjb25zdCByZXMgPSB0aGlzLmV4ZWN1dGVPcChvcEluZGV4LCAvKiBza2lwT3B0aW9uYWwgKi8gZmFsc2UpO1xuICAgIGlmIChyZXMgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRXJyb3IgcmVzb2x2aW5nIG9wZXJhdGlvbiwgZ290IG51bGxgKTtcbiAgICB9XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIC8qKlxuICAgKiBFeGVjdXRlIGEgcGFydGljdWxhciBgVGNiT3BgIGluIHRoZSBgb3BRdWV1ZWAuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIHJlcGxhY2VzIHRoZSBvcGVyYXRpb24gaW4gdGhlIGBvcFF1ZXVlYCB3aXRoIHRoZSByZXN1bHQgb2YgZXhlY3V0aW9uIChvbmNlIGRvbmUpXG4gICAqIGFuZCBhbHNvIHByb3RlY3RzIGFnYWluc3QgYSBjaXJjdWxhciBkZXBlbmRlbmN5IGZyb20gdGhlIG9wZXJhdGlvbiB0byBpdHNlbGYgYnkgdGVtcG9yYXJpbHlcbiAgICogc2V0dGluZyB0aGUgb3BlcmF0aW9uJ3MgcmVzdWx0IHRvIGEgc3BlY2lhbCBleHByZXNzaW9uLlxuICAgKi9cbiAgcHJpdmF0ZSBleGVjdXRlT3Aob3BJbmRleDogbnVtYmVyLCBza2lwT3B0aW9uYWw6IGJvb2xlYW4pOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIGNvbnN0IG9wID0gdGhpcy5vcFF1ZXVlW29wSW5kZXhdO1xuICAgIGlmICghKG9wIGluc3RhbmNlb2YgVGNiT3ApKSB7XG4gICAgICByZXR1cm4gb3A7XG4gICAgfVxuXG4gICAgaWYgKHNraXBPcHRpb25hbCAmJiBvcC5vcHRpb25hbCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgLy8gU2V0IHRoZSByZXN1bHQgb2YgdGhlIG9wZXJhdGlvbiBpbiB0aGUgcXVldWUgdG8gaXRzIGNpcmN1bGFyIGZhbGxiYWNrLiBJZiBleGVjdXRpbmcgdGhpc1xuICAgIC8vIG9wZXJhdGlvbiByZXN1bHRzIGluIGEgY2lyY3VsYXIgZGVwZW5kZW5jeSwgdGhpcyB3aWxsIHByZXZlbnQgYW4gaW5maW5pdGUgbG9vcCBhbmQgYWxsb3cgZm9yXG4gICAgLy8gdGhlIHJlc29sdXRpb24gb2Ygc3VjaCBjeWNsZXMuXG4gICAgdGhpcy5vcFF1ZXVlW29wSW5kZXhdID0gb3AuY2lyY3VsYXJGYWxsYmFjaygpO1xuICAgIGNvbnN0IHJlcyA9IG9wLmV4ZWN1dGUoKTtcbiAgICAvLyBPbmNlIHRoZSBvcGVyYXRpb24gaGFzIGZpbmlzaGVkIGV4ZWN1dGluZywgaXQncyBzYWZlIHRvIGNhY2hlIHRoZSByZWFsIHJlc3VsdC5cbiAgICB0aGlzLm9wUXVldWVbb3BJbmRleF0gPSByZXM7XG4gICAgcmV0dXJuIHJlcztcbiAgfVxuXG4gIHByaXZhdGUgYXBwZW5kTm9kZShub2RlOiBUbXBsQXN0Tm9kZSk6IHZvaWQge1xuICAgIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQpIHtcbiAgICAgIGNvbnN0IG9wSW5kZXggPSB0aGlzLm9wUXVldWUucHVzaChuZXcgVGNiRWxlbWVudE9wKHRoaXMudGNiLCB0aGlzLCBub2RlKSkgLSAxO1xuICAgICAgdGhpcy5lbGVtZW50T3BNYXAuc2V0KG5vZGUsIG9wSW5kZXgpO1xuICAgICAgdGhpcy5hcHBlbmREaXJlY3RpdmVzQW5kSW5wdXRzT2ZOb2RlKG5vZGUpO1xuICAgICAgdGhpcy5hcHBlbmRPdXRwdXRzT2ZOb2RlKG5vZGUpO1xuICAgICAgZm9yIChjb25zdCBjaGlsZCBvZiBub2RlLmNoaWxkcmVuKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kTm9kZShjaGlsZCk7XG4gICAgICB9XG4gICAgICB0aGlzLmNoZWNrUmVmZXJlbmNlc09mTm9kZShub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0VGVtcGxhdGUpIHtcbiAgICAgIC8vIFRlbXBsYXRlIGNoaWxkcmVuIGFyZSByZW5kZXJlZCBpbiBhIGNoaWxkIHNjb3BlLlxuICAgICAgdGhpcy5hcHBlbmREaXJlY3RpdmVzQW5kSW5wdXRzT2ZOb2RlKG5vZGUpO1xuICAgICAgdGhpcy5hcHBlbmRPdXRwdXRzT2ZOb2RlKG5vZGUpO1xuICAgICAgaWYgKHRoaXMudGNiLmVudi5jb25maWcuY2hlY2tUZW1wbGF0ZUJvZGllcykge1xuICAgICAgICBjb25zdCBjdHhJbmRleCA9IHRoaXMub3BRdWV1ZS5wdXNoKG5ldyBUY2JUZW1wbGF0ZUNvbnRleHRPcCh0aGlzLnRjYiwgdGhpcykpIC0gMTtcbiAgICAgICAgdGhpcy50ZW1wbGF0ZUN0eE9wTWFwLnNldChub2RlLCBjdHhJbmRleCk7XG4gICAgICAgIHRoaXMub3BRdWV1ZS5wdXNoKG5ldyBUY2JUZW1wbGF0ZUJvZHlPcCh0aGlzLnRjYiwgdGhpcywgbm9kZSkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnRjYi5lbnYuY29uZmlnLmFsd2F5c0NoZWNrU2NoZW1hSW5UZW1wbGF0ZUJvZGllcykge1xuICAgICAgICB0aGlzLmFwcGVuZERlZXBTY2hlbWFDaGVja3Mobm9kZS5jaGlsZHJlbik7XG4gICAgICB9XG4gICAgICB0aGlzLmNoZWNrUmVmZXJlbmNlc09mTm9kZShub2RlKTtcbiAgICB9IGVsc2UgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0Qm91bmRUZXh0KSB7XG4gICAgICB0aGlzLm9wUXVldWUucHVzaChuZXcgVGNiVGV4dEludGVycG9sYXRpb25PcCh0aGlzLnRjYiwgdGhpcywgbm9kZSkpO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY2hlY2tSZWZlcmVuY2VzT2ZOb2RlKG5vZGU6IFRtcGxBc3RFbGVtZW50fFRtcGxBc3RUZW1wbGF0ZSk6IHZvaWQge1xuICAgIGZvciAoY29uc3QgcmVmIG9mIG5vZGUucmVmZXJlbmNlcykge1xuICAgICAgaWYgKHRoaXMudGNiLmJvdW5kVGFyZ2V0LmdldFJlZmVyZW5jZVRhcmdldChyZWYpID09PSBudWxsKSB7XG4gICAgICAgIHRoaXMudGNiLm9vYlJlY29yZGVyLm1pc3NpbmdSZWZlcmVuY2VUYXJnZXQodGhpcy50Y2IuaWQsIHJlZik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhcHBlbmREaXJlY3RpdmVzQW5kSW5wdXRzT2ZOb2RlKG5vZGU6IFRtcGxBc3RFbGVtZW50fFRtcGxBc3RUZW1wbGF0ZSk6IHZvaWQge1xuICAgIC8vIENvbGxlY3QgYWxsIHRoZSBpbnB1dHMgb24gdGhlIGVsZW1lbnQuXG4gICAgY29uc3QgY2xhaW1lZElucHV0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgIGNvbnN0IGRpcmVjdGl2ZXMgPSB0aGlzLnRjYi5ib3VuZFRhcmdldC5nZXREaXJlY3RpdmVzT2ZOb2RlKG5vZGUpO1xuICAgIGlmIChkaXJlY3RpdmVzID09PSBudWxsIHx8IGRpcmVjdGl2ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgbm8gZGlyZWN0aXZlcywgdGhlbiBhbGwgaW5wdXRzIGFyZSB1bmNsYWltZWQgaW5wdXRzLCBzbyBxdWV1ZSBhbiBvcGVyYXRpb25cbiAgICAgIC8vIHRvIGFkZCB0aGVtIGlmIG5lZWRlZC5cbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYlVuY2xhaW1lZElucHV0c09wKHRoaXMudGNiLCB0aGlzLCBub2RlLCBjbGFpbWVkSW5wdXRzKSk7XG4gICAgICAgIHRoaXMub3BRdWV1ZS5wdXNoKFxuICAgICAgICAgICAgbmV3IFRjYkRvbVNjaGVtYUNoZWNrZXJPcCh0aGlzLnRjYiwgbm9kZSwgLyogY2hlY2tFbGVtZW50ICovIHRydWUsIGNsYWltZWRJbnB1dHMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBkaXJNYXAgPSBuZXcgTWFwPFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhLCBudW1iZXI+KCk7XG4gICAgZm9yIChjb25zdCBkaXIgb2YgZGlyZWN0aXZlcykge1xuICAgICAgY29uc3QgZGlyZWN0aXZlT3AgPSBkaXIuaXNHZW5lcmljID8gbmV3IFRjYkRpcmVjdGl2ZUN0b3JPcCh0aGlzLnRjYiwgdGhpcywgbm9kZSwgZGlyKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBuZXcgVGNiRGlyZWN0aXZlVHlwZU9wKHRoaXMudGNiLCB0aGlzLCBub2RlLCBkaXIpO1xuICAgICAgY29uc3QgZGlySW5kZXggPSB0aGlzLm9wUXVldWUucHVzaChkaXJlY3RpdmVPcCkgLSAxO1xuICAgICAgZGlyTWFwLnNldChkaXIsIGRpckluZGV4KTtcblxuICAgICAgdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYkRpcmVjdGl2ZUlucHV0c09wKHRoaXMudGNiLCB0aGlzLCBub2RlLCBkaXIpKTtcbiAgICB9XG4gICAgdGhpcy5kaXJlY3RpdmVPcE1hcC5zZXQobm9kZSwgZGlyTWFwKTtcblxuICAgIC8vIEFmdGVyIGV4cGFuZGluZyB0aGUgZGlyZWN0aXZlcywgd2UgbWlnaHQgbmVlZCB0byBxdWV1ZSBhbiBvcGVyYXRpb24gdG8gY2hlY2sgYW55IHVuY2xhaW1lZFxuICAgIC8vIGlucHV0cy5cbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIFRtcGxBc3RFbGVtZW50KSB7XG4gICAgICAvLyBHbyB0aHJvdWdoIHRoZSBkaXJlY3RpdmVzIGFuZCByZW1vdmUgYW55IGlucHV0cyB0aGF0IGl0IGNsYWltcyBmcm9tIGBlbGVtZW50SW5wdXRzYC5cbiAgICAgIGZvciAoY29uc3QgZGlyIG9mIGRpcmVjdGl2ZXMpIHtcbiAgICAgICAgZm9yIChjb25zdCBwcm9wZXJ0eU5hbWUgb2YgZGlyLmlucHV0cy5wcm9wZXJ0eU5hbWVzKSB7XG4gICAgICAgICAgY2xhaW1lZElucHV0cy5hZGQocHJvcGVydHlOYW1lKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICB0aGlzLm9wUXVldWUucHVzaChuZXcgVGNiVW5jbGFpbWVkSW5wdXRzT3AodGhpcy50Y2IsIHRoaXMsIG5vZGUsIGNsYWltZWRJbnB1dHMpKTtcbiAgICAgIC8vIElmIHRoZXJlIGFyZSBubyBkaXJlY3RpdmVzIHdoaWNoIG1hdGNoIHRoaXMgZWxlbWVudCwgdGhlbiBpdCdzIGEgXCJwbGFpblwiIERPTSBlbGVtZW50IChvciBhXG4gICAgICAvLyB3ZWIgY29tcG9uZW50KSwgYW5kIHNob3VsZCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIERPTSBzY2hlbWEuIElmIGFueSBkaXJlY3RpdmVzIG1hdGNoLFxuICAgICAgLy8gd2UgbXVzdCBhc3N1bWUgdGhhdCB0aGUgZWxlbWVudCBjb3VsZCBiZSBjdXN0b20gKGVpdGhlciBhIGNvbXBvbmVudCwgb3IgYSBkaXJlY3RpdmUgbGlrZVxuICAgICAgLy8gPHJvdXRlci1vdXRsZXQ+KSBhbmQgc2hvdWxkbid0IHZhbGlkYXRlIHRoZSBlbGVtZW50IG5hbWUgaXRzZWxmLlxuICAgICAgY29uc3QgY2hlY2tFbGVtZW50ID0gZGlyZWN0aXZlcy5sZW5ndGggPT09IDA7XG4gICAgICB0aGlzLm9wUXVldWUucHVzaChuZXcgVGNiRG9tU2NoZW1hQ2hlY2tlck9wKHRoaXMudGNiLCBub2RlLCBjaGVja0VsZW1lbnQsIGNsYWltZWRJbnB1dHMpKTtcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGFwcGVuZE91dHB1dHNPZk5vZGUobm9kZTogVG1wbEFzdEVsZW1lbnR8VG1wbEFzdFRlbXBsYXRlKTogdm9pZCB7XG4gICAgLy8gQ29sbGVjdCBhbGwgdGhlIG91dHB1dHMgb24gdGhlIGVsZW1lbnQuXG4gICAgY29uc3QgY2xhaW1lZE91dHB1dHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBjb25zdCBkaXJlY3RpdmVzID0gdGhpcy50Y2IuYm91bmRUYXJnZXQuZ2V0RGlyZWN0aXZlc09mTm9kZShub2RlKTtcbiAgICBpZiAoZGlyZWN0aXZlcyA9PT0gbnVsbCB8fCBkaXJlY3RpdmVzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gSWYgdGhlcmUgYXJlIG5vIGRpcmVjdGl2ZXMsIHRoZW4gYWxsIG91dHB1dHMgYXJlIHVuY2xhaW1lZCBvdXRwdXRzLCBzbyBxdWV1ZSBhbiBvcGVyYXRpb25cbiAgICAgIC8vIHRvIGFkZCB0aGVtIGlmIG5lZWRlZC5cbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQpIHtcbiAgICAgICAgdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYlVuY2xhaW1lZE91dHB1dHNPcCh0aGlzLnRjYiwgdGhpcywgbm9kZSwgY2xhaW1lZE91dHB1dHMpKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBRdWV1ZSBvcGVyYXRpb25zIGZvciBhbGwgZGlyZWN0aXZlcyB0byBjaGVjayB0aGUgcmVsZXZhbnQgb3V0cHV0cyBmb3IgYSBkaXJlY3RpdmUuXG4gICAgZm9yIChjb25zdCBkaXIgb2YgZGlyZWN0aXZlcykge1xuICAgICAgdGhpcy5vcFF1ZXVlLnB1c2gobmV3IFRjYkRpcmVjdGl2ZU91dHB1dHNPcCh0aGlzLnRjYiwgdGhpcywgbm9kZSwgZGlyKSk7XG4gICAgfVxuXG4gICAgLy8gQWZ0ZXIgZXhwYW5kaW5nIHRoZSBkaXJlY3RpdmVzLCB3ZSBtaWdodCBuZWVkIHRvIHF1ZXVlIGFuIG9wZXJhdGlvbiB0byBjaGVjayBhbnkgdW5jbGFpbWVkXG4gICAgLy8gb3V0cHV0cy5cbiAgICBpZiAobm9kZSBpbnN0YW5jZW9mIFRtcGxBc3RFbGVtZW50KSB7XG4gICAgICAvLyBHbyB0aHJvdWdoIHRoZSBkaXJlY3RpdmVzIGFuZCByZWdpc3RlciBhbnkgb3V0cHV0cyB0aGF0IGl0IGNsYWltcyBpbiBgY2xhaW1lZE91dHB1dHNgLlxuICAgICAgZm9yIChjb25zdCBkaXIgb2YgZGlyZWN0aXZlcykge1xuICAgICAgICBmb3IgKGNvbnN0IG91dHB1dFByb3BlcnR5IG9mIGRpci5vdXRwdXRzLnByb3BlcnR5TmFtZXMpIHtcbiAgICAgICAgICBjbGFpbWVkT3V0cHV0cy5hZGQob3V0cHV0UHJvcGVydHkpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHRoaXMub3BRdWV1ZS5wdXNoKG5ldyBUY2JVbmNsYWltZWRPdXRwdXRzT3AodGhpcy50Y2IsIHRoaXMsIG5vZGUsIGNsYWltZWRPdXRwdXRzKSk7XG4gICAgfVxuICB9XG5cbiAgcHJpdmF0ZSBhcHBlbmREZWVwU2NoZW1hQ2hlY2tzKG5vZGVzOiBUbXBsQXN0Tm9kZVtdKTogdm9pZCB7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICBpZiAoIShub2RlIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQgfHwgbm9kZSBpbnN0YW5jZW9mIFRtcGxBc3RUZW1wbGF0ZSkpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQpIHtcbiAgICAgICAgY29uc3QgY2xhaW1lZElucHV0cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICAgICAgICBjb25zdCBkaXJlY3RpdmVzID0gdGhpcy50Y2IuYm91bmRUYXJnZXQuZ2V0RGlyZWN0aXZlc09mTm9kZShub2RlKTtcbiAgICAgICAgbGV0IGhhc0RpcmVjdGl2ZXM6IGJvb2xlYW47XG4gICAgICAgIGlmIChkaXJlY3RpdmVzID09PSBudWxsIHx8IGRpcmVjdGl2ZXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgaGFzRGlyZWN0aXZlcyA9IGZhbHNlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGhhc0RpcmVjdGl2ZXMgPSB0cnVlO1xuICAgICAgICAgIGZvciAoY29uc3QgZGlyIG9mIGRpcmVjdGl2ZXMpIHtcbiAgICAgICAgICAgIGZvciAoY29uc3QgcHJvcGVydHlOYW1lIG9mIGRpci5pbnB1dHMucHJvcGVydHlOYW1lcykge1xuICAgICAgICAgICAgICBjbGFpbWVkSW5wdXRzLmFkZChwcm9wZXJ0eU5hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9wUXVldWUucHVzaChuZXcgVGNiRG9tU2NoZW1hQ2hlY2tlck9wKHRoaXMudGNiLCBub2RlLCAhaGFzRGlyZWN0aXZlcywgY2xhaW1lZElucHV0cykpO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmFwcGVuZERlZXBTY2hlbWFDaGVja3Mobm9kZS5jaGlsZHJlbik7XG4gICAgfVxuICB9XG59XG5cbmludGVyZmFjZSBUY2JCb3VuZElucHV0IHtcbiAgYXR0cmlidXRlOiBUbXBsQXN0Qm91bmRBdHRyaWJ1dGV8VG1wbEFzdFRleHRBdHRyaWJ1dGU7XG4gIGZpZWxkTmFtZXM6IENsYXNzUHJvcGVydHlOYW1lW107XG59XG5cbi8qKlxuICogQ3JlYXRlIHRoZSBgY3R4YCBwYXJhbWV0ZXIgdG8gdGhlIHRvcC1sZXZlbCBUQ0IgZnVuY3Rpb24uXG4gKlxuICogVGhpcyBpcyBhIHBhcmFtZXRlciB3aXRoIGEgdHlwZSBlcXVpdmFsZW50IHRvIHRoZSBjb21wb25lbnQgdHlwZSwgd2l0aCBhbGwgZ2VuZXJpYyB0eXBlXG4gKiBwYXJhbWV0ZXJzIGxpc3RlZCAod2l0aG91dCB0aGVpciBnZW5lcmljIGJvdW5kcykuXG4gKi9cbmZ1bmN0aW9uIHRjYkN0eFBhcmFtKFxuICAgIG5vZGU6IENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4sIG5hbWU6IHRzLkVudGl0eU5hbWUsXG4gICAgdXNlR2VuZXJpY1R5cGU6IGJvb2xlYW4pOiB0cy5QYXJhbWV0ZXJEZWNsYXJhdGlvbiB7XG4gIGxldCB0eXBlQXJndW1lbnRzOiB0cy5UeXBlTm9kZVtdfHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgLy8gQ2hlY2sgaWYgdGhlIGNvbXBvbmVudCBpcyBnZW5lcmljLCBhbmQgcGFzcyBnZW5lcmljIHR5cGUgcGFyYW1ldGVycyBpZiBzby5cbiAgaWYgKG5vZGUudHlwZVBhcmFtZXRlcnMgIT09IHVuZGVmaW5lZCkge1xuICAgIGlmICh1c2VHZW5lcmljVHlwZSkge1xuICAgICAgdHlwZUFyZ3VtZW50cyA9XG4gICAgICAgICAgbm9kZS50eXBlUGFyYW1ldGVycy5tYXAocGFyYW0gPT4gdHMuY3JlYXRlVHlwZVJlZmVyZW5jZU5vZGUocGFyYW0ubmFtZSwgdW5kZWZpbmVkKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHR5cGVBcmd1bWVudHMgPVxuICAgICAgICAgIG5vZGUudHlwZVBhcmFtZXRlcnMubWFwKCgpID0+IHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpKTtcbiAgICB9XG4gIH1cbiAgY29uc3QgdHlwZSA9IHRzLmNyZWF0ZVR5cGVSZWZlcmVuY2VOb2RlKG5hbWUsIHR5cGVBcmd1bWVudHMpO1xuICByZXR1cm4gdHMuY3JlYXRlUGFyYW1ldGVyKFxuICAgICAgLyogZGVjb3JhdG9ycyAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBtb2RpZmllcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogZG90RG90RG90VG9rZW4gKi8gdW5kZWZpbmVkLFxuICAgICAgLyogbmFtZSAqLyAnY3R4JyxcbiAgICAgIC8qIHF1ZXN0aW9uVG9rZW4gKi8gdW5kZWZpbmVkLFxuICAgICAgLyogdHlwZSAqLyB0eXBlLFxuICAgICAgLyogaW5pdGlhbGl6ZXIgKi8gdW5kZWZpbmVkKTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGFuIGBBU1RgIGV4cHJlc3Npb24gYW5kIGNvbnZlcnQgaXQgaW50byBhIGB0cy5FeHByZXNzaW9uYCwgZ2VuZXJhdGluZyByZWZlcmVuY2VzIHRvIHRoZVxuICogY29ycmVjdCBpZGVudGlmaWVycyBpbiB0aGUgY3VycmVudCBzY29wZS5cbiAqL1xuZnVuY3Rpb24gdGNiRXhwcmVzc2lvbihhc3Q6IEFTVCwgdGNiOiBDb250ZXh0LCBzY29wZTogU2NvcGUpOiB0cy5FeHByZXNzaW9uIHtcbiAgY29uc3QgdHJhbnNsYXRvciA9IG5ldyBUY2JFeHByZXNzaW9uVHJhbnNsYXRvcih0Y2IsIHNjb3BlKTtcbiAgcmV0dXJuIHRyYW5zbGF0b3IudHJhbnNsYXRlKGFzdCk7XG59XG5cbmNsYXNzIFRjYkV4cHJlc3Npb25UcmFuc2xhdG9yIHtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIHRjYjogQ29udGV4dCwgcHJvdGVjdGVkIHNjb3BlOiBTY29wZSkge31cblxuICB0cmFuc2xhdGUoYXN0OiBBU1QpOiB0cy5FeHByZXNzaW9uIHtcbiAgICAvLyBgYXN0VG9UeXBlc2NyaXB0YCBhY3R1YWxseSBkb2VzIHRoZSBjb252ZXJzaW9uLiBBIHNwZWNpYWwgcmVzb2x2ZXIgYHRjYlJlc29sdmVgIGlzIHBhc3NlZFxuICAgIC8vIHdoaWNoIGludGVycHJldHMgc3BlY2lmaWMgZXhwcmVzc2lvbiBub2RlcyB0aGF0IGludGVyYWN0IHdpdGggdGhlIGBJbXBsaWNpdFJlY2VpdmVyYC4gVGhlc2VcbiAgICAvLyBub2RlcyBhY3R1YWxseSByZWZlciB0byBpZGVudGlmaWVycyB3aXRoaW4gdGhlIGN1cnJlbnQgc2NvcGUuXG4gICAgcmV0dXJuIGFzdFRvVHlwZXNjcmlwdChhc3QsIGFzdCA9PiB0aGlzLnJlc29sdmUoYXN0KSwgdGhpcy50Y2IuZW52LmNvbmZpZyk7XG4gIH1cblxuICAvKipcbiAgICogUmVzb2x2ZSBhbiBgQVNUYCBleHByZXNzaW9uIHdpdGhpbiB0aGUgZ2l2ZW4gc2NvcGUuXG4gICAqXG4gICAqIFNvbWUgYEFTVGAgZXhwcmVzc2lvbnMgcmVmZXIgdG8gdG9wLWxldmVsIGNvbmNlcHRzIChyZWZlcmVuY2VzLCB2YXJpYWJsZXMsIHRoZSBjb21wb25lbnRcbiAgICogY29udGV4dCkuIFRoaXMgbWV0aG9kIGFzc2lzdHMgaW4gcmVzb2x2aW5nIHRob3NlLlxuICAgKi9cbiAgcHJvdGVjdGVkIHJlc29sdmUoYXN0OiBBU1QpOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIGlmIChhc3QgaW5zdGFuY2VvZiBQcm9wZXJ0eVJlYWQgJiYgYXN0LnJlY2VpdmVyIGluc3RhbmNlb2YgSW1wbGljaXRSZWNlaXZlcikge1xuICAgICAgLy8gVHJ5IHRvIHJlc29sdmUgYSBib3VuZCB0YXJnZXQgZm9yIHRoaXMgZXhwcmVzc2lvbi4gSWYgbm8gc3VjaCB0YXJnZXQgaXMgYXZhaWxhYmxlLCB0aGVuXG4gICAgICAvLyB0aGUgZXhwcmVzc2lvbiBpcyByZWZlcmVuY2luZyB0aGUgdG9wLWxldmVsIGNvbXBvbmVudCBjb250ZXh0LiBJbiB0aGF0IGNhc2UsIGBudWxsYCBpc1xuICAgICAgLy8gcmV0dXJuZWQgaGVyZSB0byBsZXQgaXQgZmFsbCB0aHJvdWdoIHJlc29sdXRpb24gc28gaXQgd2lsbCBiZSBjYXVnaHQgd2hlbiB0aGVcbiAgICAgIC8vIGBJbXBsaWNpdFJlY2VpdmVyYCBpcyByZXNvbHZlZCBpbiB0aGUgYnJhbmNoIGJlbG93LlxuICAgICAgcmV0dXJuIHRoaXMucmVzb2x2ZVRhcmdldChhc3QpO1xuICAgIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgUHJvcGVydHlXcml0ZSAmJiBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnJlc29sdmVUYXJnZXQoYXN0KTtcbiAgICAgIGlmICh0YXJnZXQgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGV4cHIgPSB0aGlzLnRyYW5zbGF0ZShhc3QudmFsdWUpO1xuICAgICAgY29uc3QgcmVzdWx0ID0gdHMuY3JlYXRlUGFyZW4odHMuY3JlYXRlQmluYXJ5KHRhcmdldCwgdHMuU3ludGF4S2luZC5FcXVhbHNUb2tlbiwgZXhwcikpO1xuICAgICAgYWRkUGFyc2VTcGFuSW5mbyhyZXN1bHQsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAvLyBBU1QgaW5zdGFuY2VzIHJlcHJlc2VudGluZyB2YXJpYWJsZXMgYW5kIHJlZmVyZW5jZXMgbG9vayB2ZXJ5IHNpbWlsYXIgdG8gcHJvcGVydHkgcmVhZHNcbiAgICAgIC8vIG9yIG1ldGhvZCBjYWxscyBmcm9tIHRoZSBjb21wb25lbnQgY29udGV4dDogYm90aCBoYXZlIHRoZSBzaGFwZVxuICAgICAgLy8gUHJvcGVydHlSZWFkKEltcGxpY2l0UmVjZWl2ZXIsICdwcm9wTmFtZScpIG9yIE1ldGhvZENhbGwoSW1wbGljaXRSZWNlaXZlciwgJ21ldGhvZE5hbWUnKS5cbiAgICAgIC8vXG4gICAgICAvLyBgdHJhbnNsYXRlYCB3aWxsIGZpcnN0IHRyeSB0byBgcmVzb2x2ZWAgdGhlIG91dGVyIFByb3BlcnR5UmVhZC9NZXRob2RDYWxsLiBJZiB0aGlzIHdvcmtzLFxuICAgICAgLy8gaXQncyBiZWNhdXNlIHRoZSBgQm91bmRUYXJnZXRgIGZvdW5kIGFuIGV4cHJlc3Npb24gdGFyZ2V0IGZvciB0aGUgd2hvbGUgZXhwcmVzc2lvbiwgYW5kXG4gICAgICAvLyB0aGVyZWZvcmUgYHRyYW5zbGF0ZWAgd2lsbCBuZXZlciBhdHRlbXB0IHRvIGByZXNvbHZlYCB0aGUgSW1wbGljaXRSZWNlaXZlciBvZiB0aGF0XG4gICAgICAvLyBQcm9wZXJ0eVJlYWQvTWV0aG9kQ2FsbC5cbiAgICAgIC8vXG4gICAgICAvLyBUaGVyZWZvcmUgaWYgYHJlc29sdmVgIGlzIGNhbGxlZCBvbiBhbiBgSW1wbGljaXRSZWNlaXZlcmAsIGl0J3MgYmVjYXVzZSBubyBvdXRlclxuICAgICAgLy8gUHJvcGVydHlSZWFkL01ldGhvZENhbGwgcmVzb2x2ZWQgdG8gYSB2YXJpYWJsZSBvciByZWZlcmVuY2UsIGFuZCB0aGVyZWZvcmUgdGhpcyBpcyBhXG4gICAgICAvLyBwcm9wZXJ0eSByZWFkIG9yIG1ldGhvZCBjYWxsIG9uIHRoZSBjb21wb25lbnQgY29udGV4dCBpdHNlbGYuXG4gICAgICByZXR1cm4gdHMuY3JlYXRlSWRlbnRpZmllcignY3R4Jyk7XG4gICAgfSBlbHNlIGlmIChhc3QgaW5zdGFuY2VvZiBCaW5kaW5nUGlwZSkge1xuICAgICAgY29uc3QgZXhwciA9IHRoaXMudHJhbnNsYXRlKGFzdC5leHApO1xuICAgICAgbGV0IHBpcGU6IHRzLkV4cHJlc3Npb258bnVsbDtcbiAgICAgIGlmICh0aGlzLnRjYi5lbnYuY29uZmlnLmNoZWNrVHlwZU9mUGlwZXMpIHtcbiAgICAgICAgcGlwZSA9IHRoaXMudGNiLmdldFBpcGVCeU5hbWUoYXN0Lm5hbWUpO1xuICAgICAgICBpZiAocGlwZSA9PT0gbnVsbCkge1xuICAgICAgICAgIC8vIE5vIHBpcGUgYnkgdGhhdCBuYW1lIGV4aXN0cyBpbiBzY29wZS4gUmVjb3JkIHRoaXMgYXMgYW4gZXJyb3IuXG4gICAgICAgICAgdGhpcy50Y2Iub29iUmVjb3JkZXIubWlzc2luZ1BpcGUodGhpcy50Y2IuaWQsIGFzdCk7XG5cbiAgICAgICAgICAvLyBSZXR1cm4gYW4gJ2FueScgdmFsdWUgdG8gYXQgbGVhc3QgYWxsb3cgdGhlIHJlc3Qgb2YgdGhlIGV4cHJlc3Npb24gdG8gYmUgY2hlY2tlZC5cbiAgICAgICAgICBwaXBlID0gTlVMTF9BU19BTlk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBpcGUgPSB0cy5jcmVhdGVQYXJlbih0cy5jcmVhdGVBc0V4cHJlc3Npb24oXG4gICAgICAgICAgICB0cy5jcmVhdGVOdWxsKCksIHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpKSk7XG4gICAgICB9XG4gICAgICBjb25zdCBhcmdzID0gYXN0LmFyZ3MubWFwKGFyZyA9PiB0aGlzLnRyYW5zbGF0ZShhcmcpKTtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRzQ2FsbE1ldGhvZChwaXBlLCAndHJhbnNmb3JtJywgW2V4cHIsIC4uLmFyZ3NdKTtcbiAgICAgIGFkZFBhcnNlU3BhbkluZm8ocmVzdWx0LCBhc3Quc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0gZWxzZSBpZiAoYXN0IGluc3RhbmNlb2YgTWV0aG9kQ2FsbCAmJiBhc3QucmVjZWl2ZXIgaW5zdGFuY2VvZiBJbXBsaWNpdFJlY2VpdmVyKSB7XG4gICAgICAvLyBSZXNvbHZlIHRoZSBzcGVjaWFsIGAkYW55KGV4cHIpYCBzeW50YXggdG8gaW5zZXJ0IGEgY2FzdCBvZiB0aGUgYXJndW1lbnQgdG8gdHlwZSBgYW55YC5cbiAgICAgIC8vIGAkYW55KGV4cHIpYCAtPiBgZXhwciBhcyBhbnlgXG4gICAgICBpZiAoYXN0Lm5hbWUgPT09ICckYW55JyAmJiBhc3QuYXJncy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgY29uc3QgZXhwciA9IHRoaXMudHJhbnNsYXRlKGFzdC5hcmdzWzBdKTtcbiAgICAgICAgY29uc3QgZXhwckFzQW55ID1cbiAgICAgICAgICAgIHRzLmNyZWF0ZUFzRXhwcmVzc2lvbihleHByLCB0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5BbnlLZXl3b3JkKSk7XG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IHRzLmNyZWF0ZVBhcmVuKGV4cHJBc0FueSk7XG4gICAgICAgIGFkZFBhcnNlU3BhbkluZm8ocmVzdWx0LCBhc3Quc291cmNlU3Bhbik7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG5cbiAgICAgIC8vIEF0dGVtcHQgdG8gcmVzb2x2ZSBhIGJvdW5kIHRhcmdldCBmb3IgdGhlIG1ldGhvZCwgYW5kIGdlbmVyYXRlIHRoZSBtZXRob2QgY2FsbCBpZiBhIHRhcmdldFxuICAgICAgLy8gY291bGQgYmUgcmVzb2x2ZWQuIElmIG5vIHRhcmdldCBpcyBhdmFpbGFibGUsIHRoZW4gdGhlIG1ldGhvZCBpcyByZWZlcmVuY2luZyB0aGUgdG9wLWxldmVsXG4gICAgICAvLyBjb21wb25lbnQgY29udGV4dCwgaW4gd2hpY2ggY2FzZSBgbnVsbGAgaXMgcmV0dXJuZWQgdG8gbGV0IHRoZSBgSW1wbGljaXRSZWNlaXZlcmAgYmVpbmdcbiAgICAgIC8vIHJlc29sdmVkIHRvIHRoZSBjb21wb25lbnQgY29udGV4dC5cbiAgICAgIGNvbnN0IHJlY2VpdmVyID0gdGhpcy5yZXNvbHZlVGFyZ2V0KGFzdCk7XG4gICAgICBpZiAocmVjZWl2ZXIgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IG1ldGhvZCA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHdyYXBGb3JEaWFnbm9zdGljcyhyZWNlaXZlciksIGFzdC5uYW1lKTtcbiAgICAgIGFkZFBhcnNlU3BhbkluZm8obWV0aG9kLCBhc3QubmFtZVNwYW4pO1xuICAgICAgY29uc3QgYXJncyA9IGFzdC5hcmdzLm1hcChhcmcgPT4gdGhpcy50cmFuc2xhdGUoYXJnKSk7XG4gICAgICBjb25zdCBub2RlID0gdHMuY3JlYXRlQ2FsbChtZXRob2QsIHVuZGVmaW5lZCwgYXJncyk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICAgIHJldHVybiBub2RlO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUaGlzIEFTVCBpc24ndCBzcGVjaWFsIGFmdGVyIGFsbC5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBBdHRlbXB0cyB0byByZXNvbHZlIGEgYm91bmQgdGFyZ2V0IGZvciBhIGdpdmVuIGV4cHJlc3Npb24sIGFuZCB0cmFuc2xhdGVzIGl0IGludG8gdGhlXG4gICAqIGFwcHJvcHJpYXRlIGB0cy5FeHByZXNzaW9uYCB0aGF0IHJlcHJlc2VudHMgdGhlIGJvdW5kIHRhcmdldC4gSWYgbm8gdGFyZ2V0IGlzIGF2YWlsYWJsZSxcbiAgICogYG51bGxgIGlzIHJldHVybmVkLlxuICAgKi9cbiAgcHJvdGVjdGVkIHJlc29sdmVUYXJnZXQoYXN0OiBBU1QpOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIGNvbnN0IGJpbmRpbmcgPSB0aGlzLnRjYi5ib3VuZFRhcmdldC5nZXRFeHByZXNzaW9uVGFyZ2V0KGFzdCk7XG4gICAgaWYgKGJpbmRpbmcgPT09IG51bGwpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFRoaXMgZXhwcmVzc2lvbiBoYXMgYSBiaW5kaW5nIHRvIHNvbWUgdmFyaWFibGUgb3IgcmVmZXJlbmNlIGluIHRoZSB0ZW1wbGF0ZS4gUmVzb2x2ZSBpdC5cbiAgICBpZiAoYmluZGluZyBpbnN0YW5jZW9mIFRtcGxBc3RWYXJpYWJsZSkge1xuICAgICAgY29uc3QgZXhwciA9IHRzLmdldE11dGFibGVDbG9uZSh0aGlzLnNjb3BlLnJlc29sdmUoYmluZGluZykpO1xuICAgICAgYWRkUGFyc2VTcGFuSW5mbyhleHByLCBhc3Quc291cmNlU3Bhbik7XG4gICAgICByZXR1cm4gZXhwcjtcbiAgICB9IGVsc2UgaWYgKGJpbmRpbmcgaW5zdGFuY2VvZiBUbXBsQXN0UmVmZXJlbmNlKSB7XG4gICAgICBjb25zdCB0YXJnZXQgPSB0aGlzLnRjYi5ib3VuZFRhcmdldC5nZXRSZWZlcmVuY2VUYXJnZXQoYmluZGluZyk7XG4gICAgICBpZiAodGFyZ2V0ID09PSBudWxsKSB7XG4gICAgICAgIC8vIFRoaXMgcmVmZXJlbmNlIGlzIHVuYm91bmQuIFRyYXZlcnNhbCBvZiB0aGUgYFRtcGxBc3RSZWZlcmVuY2VgIGl0c2VsZiBzaG91bGQgaGF2ZVxuICAgICAgICAvLyByZWNvcmRlZCB0aGUgZXJyb3IgaW4gdGhlIGBPdXRPZkJhbmREaWFnbm9zdGljUmVjb3JkZXJgLlxuICAgICAgICAvLyBTdGlsbCBjaGVjayB0aGUgcmVzdCBvZiB0aGUgZXhwcmVzc2lvbiBpZiBwb3NzaWJsZSBieSB1c2luZyBhbiBgYW55YCB2YWx1ZS5cbiAgICAgICAgcmV0dXJuIE5VTExfQVNfQU5ZO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGUgcmVmZXJlbmNlIGlzIGVpdGhlciB0byBhbiBlbGVtZW50LCBhbiA8bmctdGVtcGxhdGU+IG5vZGUsIG9yIHRvIGEgZGlyZWN0aXZlIG9uIGFuXG4gICAgICAvLyBlbGVtZW50IG9yIHRlbXBsYXRlLlxuXG4gICAgICBpZiAodGFyZ2V0IGluc3RhbmNlb2YgVG1wbEFzdEVsZW1lbnQpIHtcbiAgICAgICAgaWYgKCF0aGlzLnRjYi5lbnYuY29uZmlnLmNoZWNrVHlwZU9mRG9tUmVmZXJlbmNlcykge1xuICAgICAgICAgIC8vIFJlZmVyZW5jZXMgdG8gRE9NIG5vZGVzIGFyZSBwaW5uZWQgdG8gJ2FueScuXG4gICAgICAgICAgcmV0dXJuIE5VTExfQVNfQU5ZO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZXhwciA9IHRzLmdldE11dGFibGVDbG9uZSh0aGlzLnNjb3BlLnJlc29sdmUodGFyZ2V0KSk7XG4gICAgICAgIGFkZFBhcnNlU3BhbkluZm8oZXhwciwgYXN0LnNvdXJjZVNwYW4pO1xuICAgICAgICByZXR1cm4gZXhwcjtcbiAgICAgIH0gZWxzZSBpZiAodGFyZ2V0IGluc3RhbmNlb2YgVG1wbEFzdFRlbXBsYXRlKSB7XG4gICAgICAgIGlmICghdGhpcy50Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZk5vbkRvbVJlZmVyZW5jZXMpIHtcbiAgICAgICAgICAvLyBSZWZlcmVuY2VzIHRvIGBUZW1wbGF0ZVJlZmBzIHBpbm5lZCB0byAnYW55Jy5cbiAgICAgICAgICByZXR1cm4gTlVMTF9BU19BTlk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBEaXJlY3QgcmVmZXJlbmNlcyB0byBhbiA8bmctdGVtcGxhdGU+IG5vZGUgc2ltcGx5IHJlcXVpcmUgYSB2YWx1ZSBvZiB0eXBlXG4gICAgICAgIC8vIGBUZW1wbGF0ZVJlZjxhbnk+YC4gVG8gZ2V0IHRoaXMsIGFuIGV4cHJlc3Npb24gb2YgdGhlIGZvcm1cbiAgICAgICAgLy8gYChudWxsIGFzIGFueSBhcyBUZW1wbGF0ZVJlZjxhbnk+KWAgaXMgY29uc3RydWN0ZWQuXG4gICAgICAgIGxldCB2YWx1ZTogdHMuRXhwcmVzc2lvbiA9IHRzLmNyZWF0ZU51bGwoKTtcbiAgICAgICAgdmFsdWUgPSB0cy5jcmVhdGVBc0V4cHJlc3Npb24odmFsdWUsIHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpKTtcbiAgICAgICAgdmFsdWUgPSB0cy5jcmVhdGVBc0V4cHJlc3Npb24oXG4gICAgICAgICAgICB2YWx1ZSxcbiAgICAgICAgICAgIHRoaXMudGNiLmVudi5yZWZlcmVuY2VFeHRlcm5hbFR5cGUoJ0Bhbmd1bGFyL2NvcmUnLCAnVGVtcGxhdGVSZWYnLCBbRFlOQU1JQ19UWVBFXSkpO1xuICAgICAgICB2YWx1ZSA9IHRzLmNyZWF0ZVBhcmVuKHZhbHVlKTtcbiAgICAgICAgYWRkUGFyc2VTcGFuSW5mbyh2YWx1ZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoIXRoaXMudGNiLmVudi5jb25maWcuY2hlY2tUeXBlT2ZOb25Eb21SZWZlcmVuY2VzKSB7XG4gICAgICAgICAgLy8gUmVmZXJlbmNlcyB0byBkaXJlY3RpdmVzIGFyZSBwaW5uZWQgdG8gJ2FueScuXG4gICAgICAgICAgcmV0dXJuIE5VTExfQVNfQU5ZO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZXhwciA9IHRzLmdldE11dGFibGVDbG9uZSh0aGlzLnNjb3BlLnJlc29sdmUodGFyZ2V0Lm5vZGUsIHRhcmdldC5kaXJlY3RpdmUpKTtcbiAgICAgICAgYWRkUGFyc2VTcGFuSW5mbyhleHByLCBhc3Quc291cmNlU3Bhbik7XG4gICAgICAgIHJldHVybiBleHByO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVucmVhY2hhYmxlOiAke2JpbmRpbmd9YCk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ2FsbCB0aGUgdHlwZSBjb25zdHJ1Y3RvciBvZiBhIGRpcmVjdGl2ZSBpbnN0YW5jZSBvbiBhIGdpdmVuIHRlbXBsYXRlIG5vZGUsIGluZmVycmluZyBhIHR5cGUgZm9yXG4gKiB0aGUgZGlyZWN0aXZlIGluc3RhbmNlIGZyb20gYW55IGJvdW5kIGlucHV0cy5cbiAqL1xuZnVuY3Rpb24gdGNiQ2FsbFR5cGVDdG9yKFxuICAgIGRpcjogVHlwZUNoZWNrYWJsZURpcmVjdGl2ZU1ldGEsIHRjYjogQ29udGV4dCwgaW5wdXRzOiBUY2JEaXJlY3RpdmVJbnB1dFtdKTogdHMuRXhwcmVzc2lvbiB7XG4gIGNvbnN0IHR5cGVDdG9yID0gdGNiLmVudi50eXBlQ3RvckZvcihkaXIpO1xuXG4gIC8vIENvbnN0cnVjdCBhbiBhcnJheSBvZiBgdHMuUHJvcGVydHlBc3NpZ25tZW50YHMgZm9yIGVhY2ggb2YgdGhlIGRpcmVjdGl2ZSdzIGlucHV0cy5cbiAgY29uc3QgbWVtYmVycyA9IGlucHV0cy5tYXAoaW5wdXQgPT4ge1xuICAgIGNvbnN0IHByb3BlcnR5TmFtZSA9IHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwoaW5wdXQuZmllbGQpO1xuXG4gICAgaWYgKGlucHV0LnR5cGUgPT09ICdiaW5kaW5nJykge1xuICAgICAgLy8gRm9yIGJvdW5kIGlucHV0cywgdGhlIHByb3BlcnR5IGlzIGFzc2lnbmVkIHRoZSBiaW5kaW5nIGV4cHJlc3Npb24uXG4gICAgICBsZXQgZXhwciA9IGlucHV0LmV4cHJlc3Npb247XG4gICAgICBpZiAoIXRjYi5lbnYuY29uZmlnLmNoZWNrVHlwZU9mSW5wdXRCaW5kaW5ncykge1xuICAgICAgICAvLyBJZiBjaGVja2luZyB0aGUgdHlwZSBvZiBiaW5kaW5ncyBpcyBkaXNhYmxlZCwgY2FzdCB0aGUgcmVzdWx0aW5nIGV4cHJlc3Npb24gdG8gJ2FueSdcbiAgICAgICAgLy8gYmVmb3JlIHRoZSBhc3NpZ25tZW50LlxuICAgICAgICBleHByID0gdHNDYXN0VG9BbnkoZXhwcik7XG4gICAgICB9IGVsc2UgaWYgKCF0Y2IuZW52LmNvbmZpZy5zdHJpY3ROdWxsSW5wdXRCaW5kaW5ncykge1xuICAgICAgICAvLyBJZiBzdHJpY3QgbnVsbCBjaGVja3MgYXJlIGRpc2FibGVkLCBlcmFzZSBgbnVsbGAgYW5kIGB1bmRlZmluZWRgIGZyb20gdGhlIHR5cGUgYnlcbiAgICAgICAgLy8gd3JhcHBpbmcgdGhlIGV4cHJlc3Npb24gaW4gYSBub24tbnVsbCBhc3NlcnRpb24uXG4gICAgICAgIGV4cHIgPSB0cy5jcmVhdGVOb25OdWxsRXhwcmVzc2lvbihleHByKTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgYXNzaWdubWVudCA9IHRzLmNyZWF0ZVByb3BlcnR5QXNzaWdubWVudChwcm9wZXJ0eU5hbWUsIHdyYXBGb3JEaWFnbm9zdGljcyhleHByKSk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKGFzc2lnbm1lbnQsIGlucHV0LnNvdXJjZVNwYW4pO1xuICAgICAgcmV0dXJuIGFzc2lnbm1lbnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEEgdHlwZSBjb25zdHJ1Y3RvciBpcyByZXF1aXJlZCB0byBiZSBjYWxsZWQgd2l0aCBhbGwgaW5wdXQgcHJvcGVydGllcywgc28gYW55IHVuc2V0XG4gICAgICAvLyBpbnB1dHMgYXJlIHNpbXBseSBhc3NpZ25lZCBhIHZhbHVlIG9mIHR5cGUgYGFueWAgdG8gaWdub3JlIHRoZW0uXG4gICAgICByZXR1cm4gdHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KHByb3BlcnR5TmFtZSwgTlVMTF9BU19BTlkpO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gQ2FsbCB0aGUgYG5nVHlwZUN0b3JgIG1ldGhvZCBvbiB0aGUgZGlyZWN0aXZlIGNsYXNzLCB3aXRoIGFuIG9iamVjdCBsaXRlcmFsIGFyZ3VtZW50IGNyZWF0ZWRcbiAgLy8gZnJvbSB0aGUgbWF0Y2hlZCBpbnB1dHMuXG4gIHJldHVybiB0cy5jcmVhdGVDYWxsKFxuICAgICAgLyogZXhwcmVzc2lvbiAqLyB0eXBlQ3RvcixcbiAgICAgIC8qIHR5cGVBcmd1bWVudHMgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogYXJndW1lbnRzQXJyYXkgKi9bdHMuY3JlYXRlT2JqZWN0TGl0ZXJhbChtZW1iZXJzKV0pO1xufVxuXG5mdW5jdGlvbiBnZXRCb3VuZElucHV0cyhcbiAgICBkaXJlY3RpdmU6IFR5cGVDaGVja2FibGVEaXJlY3RpdmVNZXRhLCBub2RlOiBUbXBsQXN0VGVtcGxhdGV8VG1wbEFzdEVsZW1lbnQsXG4gICAgdGNiOiBDb250ZXh0KTogVGNiQm91bmRJbnB1dFtdIHtcbiAgY29uc3QgYm91bmRJbnB1dHM6IFRjYkJvdW5kSW5wdXRbXSA9IFtdO1xuXG4gIGNvbnN0IHByb2Nlc3NBdHRyaWJ1dGUgPSAoYXR0cjogVG1wbEFzdEJvdW5kQXR0cmlidXRlfFRtcGxBc3RUZXh0QXR0cmlidXRlKSA9PiB7XG4gICAgLy8gU2tpcCBub24tcHJvcGVydHkgYmluZGluZ3MuXG4gICAgaWYgKGF0dHIgaW5zdGFuY2VvZiBUbXBsQXN0Qm91bmRBdHRyaWJ1dGUgJiYgYXR0ci50eXBlICE9PSBCaW5kaW5nVHlwZS5Qcm9wZXJ0eSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFNraXAgdGV4dCBhdHRyaWJ1dGVzIGlmIGNvbmZpZ3VyZWQgdG8gZG8gc28uXG4gICAgaWYgKCF0Y2IuZW52LmNvbmZpZy5jaGVja1R5cGVPZkF0dHJpYnV0ZXMgJiYgYXR0ciBpbnN0YW5jZW9mIFRtcGxBc3RUZXh0QXR0cmlidXRlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gU2tpcCB0aGUgYXR0cmlidXRlIGlmIHRoZSBkaXJlY3RpdmUgZG9lcyBub3QgaGF2ZSBhbiBpbnB1dCBmb3IgaXQuXG4gICAgY29uc3QgaW5wdXRzID0gZGlyZWN0aXZlLmlucHV0cy5nZXRCeUJpbmRpbmdQcm9wZXJ0eU5hbWUoYXR0ci5uYW1lKTtcbiAgICBpZiAoaW5wdXRzID09PSBudWxsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGZpZWxkTmFtZXMgPSBpbnB1dHMubWFwKGlucHV0ID0+IGlucHV0LmNsYXNzUHJvcGVydHlOYW1lKTtcbiAgICBib3VuZElucHV0cy5wdXNoKHthdHRyaWJ1dGU6IGF0dHIsIGZpZWxkTmFtZXN9KTtcbiAgfTtcblxuICBub2RlLmlucHV0cy5mb3JFYWNoKHByb2Nlc3NBdHRyaWJ1dGUpO1xuICBub2RlLmF0dHJpYnV0ZXMuZm9yRWFjaChwcm9jZXNzQXR0cmlidXRlKTtcbiAgaWYgKG5vZGUgaW5zdGFuY2VvZiBUbXBsQXN0VGVtcGxhdGUpIHtcbiAgICBub2RlLnRlbXBsYXRlQXR0cnMuZm9yRWFjaChwcm9jZXNzQXR0cmlidXRlKTtcbiAgfVxuXG4gIHJldHVybiBib3VuZElucHV0cztcbn1cblxuLyoqXG4gKiBUcmFuc2xhdGVzIHRoZSBnaXZlbiBhdHRyaWJ1dGUgYmluZGluZyB0byBhIGB0cy5FeHByZXNzaW9uYC5cbiAqL1xuZnVuY3Rpb24gdHJhbnNsYXRlSW5wdXQoXG4gICAgYXR0cjogVG1wbEFzdEJvdW5kQXR0cmlidXRlfFRtcGxBc3RUZXh0QXR0cmlidXRlLCB0Y2I6IENvbnRleHQsIHNjb3BlOiBTY29wZSk6IHRzLkV4cHJlc3Npb24ge1xuICBpZiAoYXR0ciBpbnN0YW5jZW9mIFRtcGxBc3RCb3VuZEF0dHJpYnV0ZSkge1xuICAgIC8vIFByb2R1Y2UgYW4gZXhwcmVzc2lvbiByZXByZXNlbnRpbmcgdGhlIHZhbHVlIG9mIHRoZSBiaW5kaW5nLlxuICAgIHJldHVybiB0Y2JFeHByZXNzaW9uKGF0dHIudmFsdWUsIHRjYiwgc2NvcGUpO1xuICB9IGVsc2Uge1xuICAgIC8vIEZvciByZWd1bGFyIGF0dHJpYnV0ZXMgd2l0aCBhIHN0YXRpYyBzdHJpbmcgdmFsdWUsIHVzZSB0aGUgcmVwcmVzZW50ZWQgc3RyaW5nIGxpdGVyYWwuXG4gICAgcmV0dXJuIHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwoYXR0ci52YWx1ZSk7XG4gIH1cbn1cblxuLyoqXG4gKiBBbiBpbnB1dCBiaW5kaW5nIHRoYXQgY29ycmVzcG9uZHMgd2l0aCBhIGZpZWxkIG9mIGEgZGlyZWN0aXZlLlxuICovXG5pbnRlcmZhY2UgVGNiRGlyZWN0aXZlQm91bmRJbnB1dCB7XG4gIHR5cGU6ICdiaW5kaW5nJztcblxuICAvKipcbiAgICogVGhlIG5hbWUgb2YgYSBmaWVsZCBvbiB0aGUgZGlyZWN0aXZlIHRoYXQgaXMgc2V0LlxuICAgKi9cbiAgZmllbGQ6IHN0cmluZztcblxuICAvKipcbiAgICogVGhlIGB0cy5FeHByZXNzaW9uYCBjb3JyZXNwb25kaW5nIHdpdGggdGhlIGlucHV0IGJpbmRpbmcgZXhwcmVzc2lvbi5cbiAgICovXG4gIGV4cHJlc3Npb246IHRzLkV4cHJlc3Npb247XG5cbiAgLyoqXG4gICAqIFRoZSBzb3VyY2Ugc3BhbiBvZiB0aGUgZnVsbCBhdHRyaWJ1dGUgYmluZGluZy5cbiAgICovXG4gIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3Bhbjtcbn1cblxuLyoqXG4gKiBJbmRpY2F0ZXMgdGhhdCBhIGNlcnRhaW4gZmllbGQgb2YgYSBkaXJlY3RpdmUgZG9lcyBub3QgaGF2ZSBhIGNvcnJlc3BvbmRpbmcgaW5wdXQgYmluZGluZy5cbiAqL1xuaW50ZXJmYWNlIFRjYkRpcmVjdGl2ZVVuc2V0SW5wdXQge1xuICB0eXBlOiAndW5zZXQnO1xuXG4gIC8qKlxuICAgKiBUaGUgbmFtZSBvZiBhIGZpZWxkIG9uIHRoZSBkaXJlY3RpdmUgZm9yIHdoaWNoIG5vIGlucHV0IGJpbmRpbmcgaXMgcHJlc2VudC5cbiAgICovXG4gIGZpZWxkOiBzdHJpbmc7XG59XG5cbnR5cGUgVGNiRGlyZWN0aXZlSW5wdXQgPSBUY2JEaXJlY3RpdmVCb3VuZElucHV0fFRjYkRpcmVjdGl2ZVVuc2V0SW5wdXQ7XG5cbmNvbnN0IEVWRU5UX1BBUkFNRVRFUiA9ICckZXZlbnQnO1xuXG5jb25zdCBlbnVtIEV2ZW50UGFyYW1UeXBlIHtcbiAgLyogR2VuZXJhdGVzIGNvZGUgdG8gaW5mZXIgdGhlIHR5cGUgb2YgYCRldmVudGAgYmFzZWQgb24gaG93IHRoZSBsaXN0ZW5lciBpcyByZWdpc3RlcmVkLiAqL1xuICBJbmZlcixcblxuICAvKiBEZWNsYXJlcyB0aGUgdHlwZSBvZiB0aGUgYCRldmVudGAgcGFyYW1ldGVyIGFzIGBhbnlgLiAqL1xuICBBbnksXG59XG5cbi8qKlxuICogQ3JlYXRlcyBhbiBhcnJvdyBmdW5jdGlvbiB0byBiZSB1c2VkIGFzIGhhbmRsZXIgZnVuY3Rpb24gZm9yIGV2ZW50IGJpbmRpbmdzLiBUaGUgaGFuZGxlclxuICogZnVuY3Rpb24gaGFzIGEgc2luZ2xlIHBhcmFtZXRlciBgJGV2ZW50YCBhbmQgdGhlIGJvdW5kIGV2ZW50J3MgaGFuZGxlciBgQVNUYCByZXByZXNlbnRlZCBhcyBhXG4gKiBUeXBlU2NyaXB0IGV4cHJlc3Npb24gYXMgaXRzIGJvZHkuXG4gKlxuICogV2hlbiBgZXZlbnRUeXBlYCBpcyBzZXQgdG8gYEluZmVyYCwgdGhlIGAkZXZlbnRgIHBhcmFtZXRlciB3aWxsIG5vdCBoYXZlIGFuIGV4cGxpY2l0IHR5cGUuIFRoaXNcbiAqIGFsbG93cyBmb3IgdGhlIGNyZWF0ZWQgaGFuZGxlciBmdW5jdGlvbiB0byBoYXZlIGl0cyBgJGV2ZW50YCBwYXJhbWV0ZXIncyB0eXBlIGluZmVycmVkIGJhc2VkIG9uXG4gKiBob3cgaXQncyB1c2VkLCB0byBlbmFibGUgc3RyaWN0IHR5cGUgY2hlY2tpbmcgb2YgZXZlbnQgYmluZGluZ3MuIFdoZW4gc2V0IHRvIGBBbnlgLCB0aGUgYCRldmVudGBcbiAqIHBhcmFtZXRlciB3aWxsIGhhdmUgYW4gZXhwbGljaXQgYGFueWAgdHlwZSwgZWZmZWN0aXZlbHkgZGlzYWJsaW5nIHN0cmljdCB0eXBlIGNoZWNraW5nIG9mIGV2ZW50XG4gKiBiaW5kaW5ncy4gQWx0ZXJuYXRpdmVseSwgYW4gZXhwbGljaXQgdHlwZSBjYW4gYmUgcGFzc2VkIGZvciB0aGUgYCRldmVudGAgcGFyYW1ldGVyLlxuICovXG5mdW5jdGlvbiB0Y2JDcmVhdGVFdmVudEhhbmRsZXIoXG4gICAgZXZlbnQ6IFRtcGxBc3RCb3VuZEV2ZW50LCB0Y2I6IENvbnRleHQsIHNjb3BlOiBTY29wZSxcbiAgICBldmVudFR5cGU6IEV2ZW50UGFyYW1UeXBlfHRzLlR5cGVOb2RlKTogdHMuRXhwcmVzc2lvbiB7XG4gIGNvbnN0IGhhbmRsZXIgPSB0Y2JFdmVudEhhbmRsZXJFeHByZXNzaW9uKGV2ZW50LmhhbmRsZXIsIHRjYiwgc2NvcGUpO1xuXG4gIGxldCBldmVudFBhcmFtVHlwZTogdHMuVHlwZU5vZGV8dW5kZWZpbmVkO1xuICBpZiAoZXZlbnRUeXBlID09PSBFdmVudFBhcmFtVHlwZS5JbmZlcikge1xuICAgIGV2ZW50UGFyYW1UeXBlID0gdW5kZWZpbmVkO1xuICB9IGVsc2UgaWYgKGV2ZW50VHlwZSA9PT0gRXZlbnRQYXJhbVR5cGUuQW55KSB7XG4gICAgZXZlbnRQYXJhbVR5cGUgPSB0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5BbnlLZXl3b3JkKTtcbiAgfSBlbHNlIHtcbiAgICBldmVudFBhcmFtVHlwZSA9IGV2ZW50VHlwZTtcbiAgfVxuXG4gIC8vIE9idGFpbiBhbGwgZ3VhcmRzIHRoYXQgaGF2ZSBiZWVuIGFwcGxpZWQgdG8gdGhlIHNjb3BlIGFuZCBpdHMgcGFyZW50cywgYXMgdGhleSBoYXZlIHRvIGJlXG4gIC8vIHJlcGVhdGVkIHdpdGhpbiB0aGUgaGFuZGxlciBmdW5jdGlvbiBmb3IgdGhlaXIgbmFycm93aW5nIHRvIGJlIGluIGVmZmVjdCB3aXRoaW4gdGhlIGhhbmRsZXIuXG4gIGNvbnN0IGd1YXJkcyA9IHNjb3BlLmd1YXJkcygpO1xuXG4gIGxldCBib2R5OiB0cy5TdGF0ZW1lbnQgPSB0cy5jcmVhdGVFeHByZXNzaW9uU3RhdGVtZW50KGhhbmRsZXIpO1xuICBpZiAoZ3VhcmRzICE9PSBudWxsKSB7XG4gICAgLy8gV3JhcCB0aGUgYm9keSBpbiBhbiBgaWZgIHN0YXRlbWVudCBjb250YWluaW5nIGFsbCBndWFyZHMgdGhhdCBoYXZlIHRvIGJlIGFwcGxpZWQuXG4gICAgYm9keSA9IHRzLmNyZWF0ZUlmKGd1YXJkcywgYm9keSk7XG4gIH1cblxuICBjb25zdCBldmVudFBhcmFtID0gdHMuY3JlYXRlUGFyYW1ldGVyKFxuICAgICAgLyogZGVjb3JhdG9ycyAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBtb2RpZmllcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogZG90RG90RG90VG9rZW4gKi8gdW5kZWZpbmVkLFxuICAgICAgLyogbmFtZSAqLyBFVkVOVF9QQVJBTUVURVIsXG4gICAgICAvKiBxdWVzdGlvblRva2VuICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIHR5cGUgKi8gZXZlbnRQYXJhbVR5cGUpO1xuXG4gIHJldHVybiB0cy5jcmVhdGVGdW5jdGlvbkV4cHJlc3Npb24oXG4gICAgICAvKiBtb2RpZmllciAqLyB1bmRlZmluZWQsXG4gICAgICAvKiBhc3Rlcmlza1Rva2VuICovIHVuZGVmaW5lZCxcbiAgICAgIC8qIG5hbWUgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogdHlwZVBhcmFtZXRlcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgLyogcGFyYW1ldGVycyAqL1tldmVudFBhcmFtXSxcbiAgICAgIC8qIHR5cGUgKi8gdHMuY3JlYXRlS2V5d29yZFR5cGVOb2RlKHRzLlN5bnRheEtpbmQuQW55S2V5d29yZCksXG4gICAgICAvKiBib2R5ICovIHRzLmNyZWF0ZUJsb2NrKFtib2R5XSkpO1xufVxuXG4vKipcbiAqIFNpbWlsYXIgdG8gYHRjYkV4cHJlc3Npb25gLCB0aGlzIGZ1bmN0aW9uIGNvbnZlcnRzIHRoZSBwcm92aWRlZCBgQVNUYCBleHByZXNzaW9uIGludG8gYVxuICogYHRzLkV4cHJlc3Npb25gLCB3aXRoIHNwZWNpYWwgaGFuZGxpbmcgb2YgdGhlIGAkZXZlbnRgIHZhcmlhYmxlIHRoYXQgY2FuIGJlIHVzZWQgd2l0aGluIGV2ZW50XG4gKiBiaW5kaW5ncy5cbiAqL1xuZnVuY3Rpb24gdGNiRXZlbnRIYW5kbGVyRXhwcmVzc2lvbihhc3Q6IEFTVCwgdGNiOiBDb250ZXh0LCBzY29wZTogU2NvcGUpOiB0cy5FeHByZXNzaW9uIHtcbiAgY29uc3QgdHJhbnNsYXRvciA9IG5ldyBUY2JFdmVudEhhbmRsZXJUcmFuc2xhdG9yKHRjYiwgc2NvcGUpO1xuICByZXR1cm4gdHJhbnNsYXRvci50cmFuc2xhdGUoYXN0KTtcbn1cblxuY2xhc3MgVGNiRXZlbnRIYW5kbGVyVHJhbnNsYXRvciBleHRlbmRzIFRjYkV4cHJlc3Npb25UcmFuc2xhdG9yIHtcbiAgcHJvdGVjdGVkIHJlc29sdmUoYXN0OiBBU1QpOiB0cy5FeHByZXNzaW9ufG51bGwge1xuICAgIC8vIFJlY29nbml6ZSBhIHByb3BlcnR5IHJlYWQgb24gdGhlIGltcGxpY2l0IHJlY2VpdmVyIGNvcnJlc3BvbmRpbmcgd2l0aCB0aGUgZXZlbnQgcGFyYW1ldGVyXG4gICAgLy8gdGhhdCBpcyBhdmFpbGFibGUgaW4gZXZlbnQgYmluZGluZ3MuIFNpbmNlIHRoaXMgdmFyaWFibGUgaXMgYSBwYXJhbWV0ZXIgb2YgdGhlIGhhbmRsZXJcbiAgICAvLyBmdW5jdGlvbiB0aGF0IHRoZSBjb252ZXJ0ZWQgZXhwcmVzc2lvbiBiZWNvbWVzIGEgY2hpbGQgb2YsIGp1c3QgY3JlYXRlIGEgcmVmZXJlbmNlIHRvIHRoZVxuICAgIC8vIHBhcmFtZXRlciBieSBpdHMgbmFtZS5cbiAgICBpZiAoYXN0IGluc3RhbmNlb2YgUHJvcGVydHlSZWFkICYmIGFzdC5yZWNlaXZlciBpbnN0YW5jZW9mIEltcGxpY2l0UmVjZWl2ZXIgJiZcbiAgICAgICAgYXN0Lm5hbWUgPT09IEVWRU5UX1BBUkFNRVRFUikge1xuICAgICAgY29uc3QgZXZlbnQgPSB0cy5jcmVhdGVJZGVudGlmaWVyKEVWRU5UX1BBUkFNRVRFUik7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKGV2ZW50LCBhc3QubmFtZVNwYW4pO1xuICAgICAgcmV0dXJuIGV2ZW50O1xuICAgIH1cblxuICAgIHJldHVybiBzdXBlci5yZXNvbHZlKGFzdCk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVpcmVzSW5saW5lVHlwZUNoZWNrQmxvY2sobm9kZTogQ2xhc3NEZWNsYXJhdGlvbjx0cy5DbGFzc0RlY2xhcmF0aW9uPik6IGJvb2xlYW4ge1xuICAvLyBJbiBvcmRlciB0byBxdWFsaWZ5IGZvciBhIGRlY2xhcmVkIFRDQiAobm90IGlubGluZSkgdHdvIGNvbmRpdGlvbnMgbXVzdCBiZSBtZXQ6XG4gIC8vIDEpIHRoZSBjbGFzcyBtdXN0IGJlIGV4cG9ydGVkXG4gIC8vIDIpIGl0IG11c3Qgbm90IGhhdmUgY29uc3RyYWluZWQgZ2VuZXJpYyB0eXBlc1xuICBpZiAoIWNoZWNrSWZDbGFzc0lzRXhwb3J0ZWQobm9kZSkpIHtcbiAgICAvLyBDb25kaXRpb24gMSBpcyBmYWxzZSwgdGhlIGNsYXNzIGlzIG5vdCBleHBvcnRlZC5cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBlbHNlIGlmICghY2hlY2tJZkdlbmVyaWNUeXBlc0FyZVVuYm91bmQobm9kZSkpIHtcbiAgICAvLyBDb25kaXRpb24gMiBpcyBmYWxzZSwgdGhlIGNsYXNzIGhhcyBjb25zdHJhaW5lZCBnZW5lcmljIHR5cGVzXG4gICAgcmV0dXJuIHRydWU7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG59XG4iXX0=