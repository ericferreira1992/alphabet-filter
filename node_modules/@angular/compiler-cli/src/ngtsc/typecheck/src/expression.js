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
        define("@angular/compiler-cli/src/ngtsc/typecheck/src/expression", ["require", "exports", "@angular/compiler", "typescript", "@angular/compiler-cli/src/ngtsc/typecheck/src/diagnostics", "@angular/compiler-cli/src/ngtsc/typecheck/src/ts_util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.astToTypescript = exports.NULL_AS_ANY = void 0;
    var compiler_1 = require("@angular/compiler");
    var ts = require("typescript");
    var diagnostics_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/src/diagnostics");
    var ts_util_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/src/ts_util");
    exports.NULL_AS_ANY = ts.createAsExpression(ts.createNull(), ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword));
    var UNDEFINED = ts.createIdentifier('undefined');
    var UNARY_OPS = new Map([
        ['+', ts.SyntaxKind.PlusToken],
        ['-', ts.SyntaxKind.MinusToken],
    ]);
    var BINARY_OPS = new Map([
        ['+', ts.SyntaxKind.PlusToken],
        ['-', ts.SyntaxKind.MinusToken],
        ['<', ts.SyntaxKind.LessThanToken],
        ['>', ts.SyntaxKind.GreaterThanToken],
        ['<=', ts.SyntaxKind.LessThanEqualsToken],
        ['>=', ts.SyntaxKind.GreaterThanEqualsToken],
        ['==', ts.SyntaxKind.EqualsEqualsToken],
        ['===', ts.SyntaxKind.EqualsEqualsEqualsToken],
        ['*', ts.SyntaxKind.AsteriskToken],
        ['/', ts.SyntaxKind.SlashToken],
        ['%', ts.SyntaxKind.PercentToken],
        ['!=', ts.SyntaxKind.ExclamationEqualsToken],
        ['!==', ts.SyntaxKind.ExclamationEqualsEqualsToken],
        ['||', ts.SyntaxKind.BarBarToken],
        ['&&', ts.SyntaxKind.AmpersandAmpersandToken],
        ['&', ts.SyntaxKind.AmpersandToken],
        ['|', ts.SyntaxKind.BarToken],
    ]);
    /**
     * Convert an `AST` to TypeScript code directly, without going through an intermediate `Expression`
     * AST.
     */
    function astToTypescript(ast, maybeResolve, config) {
        var translator = new AstTranslator(maybeResolve, config);
        return translator.translate(ast);
    }
    exports.astToTypescript = astToTypescript;
    var AstTranslator = /** @class */ (function () {
        function AstTranslator(maybeResolve, config) {
            this.maybeResolve = maybeResolve;
            this.config = config;
        }
        AstTranslator.prototype.translate = function (ast) {
            // Skip over an `ASTWithSource` as its `visit` method calls directly into its ast's `visit`,
            // which would prevent any custom resolution through `maybeResolve` for that node.
            if (ast instanceof compiler_1.ASTWithSource) {
                ast = ast.ast;
            }
            // The `EmptyExpr` doesn't have a dedicated method on `AstVisitor`, so it's special cased here.
            if (ast instanceof compiler_1.EmptyExpr) {
                return UNDEFINED;
            }
            // First attempt to let any custom resolution logic provide a translation for the given node.
            var resolved = this.maybeResolve(ast);
            if (resolved !== null) {
                return resolved;
            }
            return ast.visit(this);
        };
        AstTranslator.prototype.visitUnary = function (ast) {
            var expr = this.translate(ast.expr);
            var op = UNARY_OPS.get(ast.operator);
            if (op === undefined) {
                throw new Error("Unsupported Unary.operator: " + ast.operator);
            }
            var node = diagnostics_1.wrapForDiagnostics(ts.createPrefix(op, expr));
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitBinary = function (ast) {
            var lhs = diagnostics_1.wrapForDiagnostics(this.translate(ast.left));
            var rhs = diagnostics_1.wrapForDiagnostics(this.translate(ast.right));
            var op = BINARY_OPS.get(ast.operation);
            if (op === undefined) {
                throw new Error("Unsupported Binary.operation: " + ast.operation);
            }
            var node = ts.createBinary(lhs, op, rhs);
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitChain = function (ast) {
            var _this = this;
            var elements = ast.expressions.map(function (expr) { return _this.translate(expr); });
            var node = diagnostics_1.wrapForDiagnostics(ts.createCommaList(elements));
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitConditional = function (ast) {
            var condExpr = this.translate(ast.condition);
            var trueExpr = this.translate(ast.trueExp);
            var falseExpr = this.translate(ast.falseExp);
            var node = ts.createParen(ts.createConditional(condExpr, trueExpr, falseExpr));
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitFunctionCall = function (ast) {
            var _this = this;
            var receiver = diagnostics_1.wrapForDiagnostics(this.translate(ast.target));
            var args = ast.args.map(function (expr) { return _this.translate(expr); });
            var node = ts.createCall(receiver, undefined, args);
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitImplicitReceiver = function (ast) {
            throw new Error('Method not implemented.');
        };
        AstTranslator.prototype.visitInterpolation = function (ast) {
            var _this = this;
            // Build up a chain of binary + operations to simulate the string concatenation of the
            // interpolation's expressions. The chain is started using an actual string literal to ensure
            // the type is inferred as 'string'.
            return ast.expressions.reduce(function (lhs, ast) { return ts.createBinary(lhs, ts.SyntaxKind.PlusToken, _this.translate(ast)); }, ts.createLiteral(''));
        };
        AstTranslator.prototype.visitKeyedRead = function (ast) {
            var receiver = diagnostics_1.wrapForDiagnostics(this.translate(ast.obj));
            var key = this.translate(ast.key);
            var node = ts.createElementAccess(receiver, key);
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitKeyedWrite = function (ast) {
            var receiver = diagnostics_1.wrapForDiagnostics(this.translate(ast.obj));
            var left = ts.createElementAccess(receiver, this.translate(ast.key));
            // TODO(joost): annotate `left` with the span of the element access, which is not currently
            //  available on `ast`.
            var right = this.translate(ast.value);
            var node = diagnostics_1.wrapForDiagnostics(ts.createBinary(left, ts.SyntaxKind.EqualsToken, right));
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitLiteralArray = function (ast) {
            var _this = this;
            var elements = ast.expressions.map(function (expr) { return _this.translate(expr); });
            var literal = ts.createArrayLiteral(elements);
            // If strictLiteralTypes is disabled, array literals are cast to `any`.
            var node = this.config.strictLiteralTypes ? literal : ts_util_1.tsCastToAny(literal);
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitLiteralMap = function (ast) {
            var _this = this;
            var properties = ast.keys.map(function (_a, idx) {
                var key = _a.key;
                var value = _this.translate(ast.values[idx]);
                return ts.createPropertyAssignment(ts.createStringLiteral(key), value);
            });
            var literal = ts.createObjectLiteral(properties, true);
            // If strictLiteralTypes is disabled, object literals are cast to `any`.
            var node = this.config.strictLiteralTypes ? literal : ts_util_1.tsCastToAny(literal);
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitLiteralPrimitive = function (ast) {
            var node;
            if (ast.value === undefined) {
                node = ts.createIdentifier('undefined');
            }
            else if (ast.value === null) {
                node = ts.createNull();
            }
            else {
                node = ts.createLiteral(ast.value);
            }
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitMethodCall = function (ast) {
            var _this = this;
            var receiver = diagnostics_1.wrapForDiagnostics(this.translate(ast.receiver));
            var method = ts.createPropertyAccess(receiver, ast.name);
            diagnostics_1.addParseSpanInfo(method, ast.nameSpan);
            var args = ast.args.map(function (expr) { return _this.translate(expr); });
            var node = ts.createCall(method, undefined, args);
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitNonNullAssert = function (ast) {
            var expr = diagnostics_1.wrapForDiagnostics(this.translate(ast.expression));
            var node = ts.createNonNullExpression(expr);
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitPipe = function (ast) {
            throw new Error('Method not implemented.');
        };
        AstTranslator.prototype.visitPrefixNot = function (ast) {
            var expression = diagnostics_1.wrapForDiagnostics(this.translate(ast.expression));
            var node = ts.createLogicalNot(expression);
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitPropertyRead = function (ast) {
            // This is a normal property read - convert the receiver to an expression and emit the correct
            // TypeScript expression to read the property.
            var receiver = diagnostics_1.wrapForDiagnostics(this.translate(ast.receiver));
            var name = ts.createPropertyAccess(receiver, ast.name);
            diagnostics_1.addParseSpanInfo(name, ast.nameSpan);
            var node = diagnostics_1.wrapForDiagnostics(name);
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitPropertyWrite = function (ast) {
            var receiver = diagnostics_1.wrapForDiagnostics(this.translate(ast.receiver));
            var left = ts.createPropertyAccess(receiver, ast.name);
            diagnostics_1.addParseSpanInfo(left, ast.nameSpan);
            // TypeScript reports assignment errors on the entire lvalue expression. Annotate the lvalue of
            // the assignment with the sourceSpan, which includes receivers, rather than nameSpan for
            // consistency of the diagnostic location.
            // a.b.c = 1
            // ^^^^^^^^^ sourceSpan
            //     ^     nameSpan
            var leftWithPath = diagnostics_1.wrapForDiagnostics(left);
            diagnostics_1.addParseSpanInfo(leftWithPath, ast.sourceSpan);
            var right = this.translate(ast.value);
            var node = diagnostics_1.wrapForDiagnostics(ts.createBinary(leftWithPath, ts.SyntaxKind.EqualsToken, right));
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitQuote = function (ast) {
            return exports.NULL_AS_ANY;
        };
        AstTranslator.prototype.visitSafeMethodCall = function (ast) {
            var _this = this;
            // See the comments in SafePropertyRead above for an explanation of the cases here.
            var node;
            var receiver = diagnostics_1.wrapForDiagnostics(this.translate(ast.receiver));
            var args = ast.args.map(function (expr) { return _this.translate(expr); });
            if (this.config.strictSafeNavigationTypes) {
                // "a?.method(...)" becomes (null as any ? a!.method(...) : undefined)
                var method = ts.createPropertyAccess(ts.createNonNullExpression(receiver), ast.name);
                diagnostics_1.addParseSpanInfo(method, ast.nameSpan);
                var call = ts.createCall(method, undefined, args);
                node = ts.createParen(ts.createConditional(exports.NULL_AS_ANY, call, UNDEFINED));
            }
            else if (VeSafeLhsInferenceBugDetector.veWillInferAnyFor(ast)) {
                // "a?.method(...)" becomes (a as any).method(...)
                var method = ts.createPropertyAccess(ts_util_1.tsCastToAny(receiver), ast.name);
                diagnostics_1.addParseSpanInfo(method, ast.nameSpan);
                node = ts.createCall(method, undefined, args);
            }
            else {
                // "a?.method(...)" becomes (a!.method(...) as any)
                var method = ts.createPropertyAccess(ts.createNonNullExpression(receiver), ast.name);
                diagnostics_1.addParseSpanInfo(method, ast.nameSpan);
                node = ts_util_1.tsCastToAny(ts.createCall(method, undefined, args));
            }
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        AstTranslator.prototype.visitSafePropertyRead = function (ast) {
            var node;
            var receiver = diagnostics_1.wrapForDiagnostics(this.translate(ast.receiver));
            // The form of safe property reads depends on whether strictness is in use.
            if (this.config.strictSafeNavigationTypes) {
                // Basically, the return here is either the type of the complete expression with a null-safe
                // property read, or `undefined`. So a ternary is used to create an "or" type:
                // "a?.b" becomes (null as any ? a!.b : undefined)
                // The type of this expression is (typeof a!.b) | undefined, which is exactly as desired.
                var expr = ts.createPropertyAccess(ts.createNonNullExpression(receiver), ast.name);
                node = ts.createParen(ts.createConditional(exports.NULL_AS_ANY, expr, UNDEFINED));
            }
            else if (VeSafeLhsInferenceBugDetector.veWillInferAnyFor(ast)) {
                // Emulate a View Engine bug where 'any' is inferred for the left-hand side of the safe
                // navigation operation. With this bug, the type of the left-hand side is regarded as any.
                // Therefore, the left-hand side only needs repeating in the output (to validate it), and then
                // 'any' is used for the rest of the expression. This is done using a comma operator:
                // "a?.b" becomes (a as any).b, which will of course have type 'any'.
                node = ts.createPropertyAccess(ts_util_1.tsCastToAny(receiver), ast.name);
            }
            else {
                // The View Engine bug isn't active, so check the entire type of the expression, but the final
                // result is still inferred as `any`.
                // "a?.b" becomes (a!.b as any)
                var expr = ts.createPropertyAccess(ts.createNonNullExpression(receiver), ast.name);
                node = ts_util_1.tsCastToAny(expr);
            }
            diagnostics_1.addParseSpanInfo(node, ast.sourceSpan);
            return node;
        };
        return AstTranslator;
    }());
    /**
     * Checks whether View Engine will infer a type of 'any' for the left-hand side of a safe navigation
     * operation.
     *
     * In View Engine's template type-checker, certain receivers of safe navigation operations will
     * cause a temporary variable to be allocated as part of the checking expression, to save the value
     * of the receiver and use it more than once in the expression. This temporary variable has type
     * 'any'. In practice, this means certain receivers cause View Engine to not check the full
     * expression, and other receivers will receive more complete checking.
     *
     * For compatibility, this logic is adapted from View Engine's expression_converter.ts so that the
     * Ivy checker can emulate this bug when needed.
     */
    var VeSafeLhsInferenceBugDetector = /** @class */ (function () {
        function VeSafeLhsInferenceBugDetector() {
        }
        VeSafeLhsInferenceBugDetector.veWillInferAnyFor = function (ast) {
            return ast.receiver.visit(VeSafeLhsInferenceBugDetector.SINGLETON);
        };
        VeSafeLhsInferenceBugDetector.prototype.visitUnary = function (ast) {
            return ast.expr.visit(this);
        };
        VeSafeLhsInferenceBugDetector.prototype.visitBinary = function (ast) {
            return ast.left.visit(this) || ast.right.visit(this);
        };
        VeSafeLhsInferenceBugDetector.prototype.visitChain = function (ast) {
            return false;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitConditional = function (ast) {
            return ast.condition.visit(this) || ast.trueExp.visit(this) || ast.falseExp.visit(this);
        };
        VeSafeLhsInferenceBugDetector.prototype.visitFunctionCall = function (ast) {
            return true;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitImplicitReceiver = function (ast) {
            return false;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitInterpolation = function (ast) {
            var _this = this;
            return ast.expressions.some(function (exp) { return exp.visit(_this); });
        };
        VeSafeLhsInferenceBugDetector.prototype.visitKeyedRead = function (ast) {
            return false;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitKeyedWrite = function (ast) {
            return false;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitLiteralArray = function (ast) {
            return true;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitLiteralMap = function (ast) {
            return true;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitLiteralPrimitive = function (ast) {
            return false;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitMethodCall = function (ast) {
            return true;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitPipe = function (ast) {
            return true;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitPrefixNot = function (ast) {
            return ast.expression.visit(this);
        };
        VeSafeLhsInferenceBugDetector.prototype.visitNonNullAssert = function (ast) {
            return ast.expression.visit(this);
        };
        VeSafeLhsInferenceBugDetector.prototype.visitPropertyRead = function (ast) {
            return false;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitPropertyWrite = function (ast) {
            return false;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitQuote = function (ast) {
            return false;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitSafeMethodCall = function (ast) {
            return true;
        };
        VeSafeLhsInferenceBugDetector.prototype.visitSafePropertyRead = function (ast) {
            return false;
        };
        VeSafeLhsInferenceBugDetector.SINGLETON = new VeSafeLhsInferenceBugDetector();
        return VeSafeLhsInferenceBugDetector;
    }());
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXhwcmVzc2lvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHlwZWNoZWNrL3NyYy9leHByZXNzaW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7OztJQUVILDhDQUEwVjtJQUMxViwrQkFBaUM7SUFHakMseUZBQW1FO0lBQ25FLGlGQUFzQztJQUV6QixRQUFBLFdBQVcsR0FDcEIsRUFBRSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsQ0FBQyxVQUFVLEVBQUUsRUFBRSxFQUFFLENBQUMscUJBQXFCLENBQUMsRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBQy9GLElBQU0sU0FBUyxHQUFHLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUVuRCxJQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBaUM7UUFDeEQsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUM7UUFDOUIsQ0FBQyxHQUFHLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxVQUFVLENBQUM7S0FDaEMsQ0FBQyxDQUFDO0lBRUgsSUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLENBQTRCO1FBQ3BELENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDO1FBQzlCLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDO1FBQy9CLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxDQUFDO1FBQ2xDLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUM7UUFDckMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQztRQUN6QyxD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RCx1REFBZSxHQUFmLFVBQWdCLEdBQWU7WUFDN0IsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsNkRBQXFCLEdBQXJCLFVBQXNCLEdBQXFCO1lBQ3pDLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUNELHVEQUFlLEdBQWYsVUFBZ0IsR0FBZTtZQUM3QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUM7UUFDRCxpREFBUyxHQUFULFVBQVUsR0FBZ0I7WUFDeEIsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0Qsc0RBQWMsR0FBZCxVQUFlLEdBQWM7WUFDM0IsT0FBTyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBQ0QsMERBQWtCLEdBQWxCLFVBQW1CLEdBQWM7WUFDL0IsT0FBTyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNwQyxDQUFDO1FBQ0QseURBQWlCLEdBQWpCLFVBQWtCLEdBQWlCO1lBQ2pDLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQUNELDBEQUFrQixHQUFsQixVQUFtQixHQUFrQjtZQUNuQyxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCxrREFBVSxHQUFWLFVBQVcsR0FBVTtZQUNuQixPQUFPLEtBQUssQ0FBQztRQUNmLENBQUM7UUFDRCwyREFBbUIsR0FBbkIsVUFBb0IsR0FBbUI7WUFDckMsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDO1FBQ0QsNkRBQXFCLEdBQXJCLFVBQXNCLEdBQXFCO1lBQ3pDLE9BQU8sS0FBSyxDQUFDO1FBQ2YsQ0FBQztRQXBFYyx1Q0FBUyxHQUFHLElBQUksNkJBQTZCLEVBQUUsQ0FBQztRQXFFakUsb0NBQUM7S0FBQSxBQXRFRCxJQXNFQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0FTVCwgQXN0VmlzaXRvciwgQVNUV2l0aFNvdXJjZSwgQmluYXJ5LCBCaW5kaW5nUGlwZSwgQ2hhaW4sIENvbmRpdGlvbmFsLCBFbXB0eUV4cHIsIEZ1bmN0aW9uQ2FsbCwgSW1wbGljaXRSZWNlaXZlciwgSW50ZXJwb2xhdGlvbiwgS2V5ZWRSZWFkLCBLZXllZFdyaXRlLCBMaXRlcmFsQXJyYXksIExpdGVyYWxNYXAsIExpdGVyYWxQcmltaXRpdmUsIE1ldGhvZENhbGwsIE5vbk51bGxBc3NlcnQsIFByZWZpeE5vdCwgUHJvcGVydHlSZWFkLCBQcm9wZXJ0eVdyaXRlLCBRdW90ZSwgU2FmZU1ldGhvZENhbGwsIFNhZmVQcm9wZXJ0eVJlYWQsIFVuYXJ5fSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcbmltcG9ydCB7VHlwZUNoZWNraW5nQ29uZmlnfSBmcm9tICcuLi9hcGknO1xuXG5pbXBvcnQge2FkZFBhcnNlU3BhbkluZm8sIHdyYXBGb3JEaWFnbm9zdGljc30gZnJvbSAnLi9kaWFnbm9zdGljcyc7XG5pbXBvcnQge3RzQ2FzdFRvQW55fSBmcm9tICcuL3RzX3V0aWwnO1xuXG5leHBvcnQgY29uc3QgTlVMTF9BU19BTlkgPVxuICAgIHRzLmNyZWF0ZUFzRXhwcmVzc2lvbih0cy5jcmVhdGVOdWxsKCksIHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpKTtcbmNvbnN0IFVOREVGSU5FRCA9IHRzLmNyZWF0ZUlkZW50aWZpZXIoJ3VuZGVmaW5lZCcpO1xuXG5jb25zdCBVTkFSWV9PUFMgPSBuZXcgTWFwPHN0cmluZywgdHMuUHJlZml4VW5hcnlPcGVyYXRvcj4oW1xuICBbJysnLCB0cy5TeW50YXhLaW5kLlBsdXNUb2tlbl0sXG4gIFsnLScsIHRzLlN5bnRheEtpbmQuTWludXNUb2tlbl0sXG5dKTtcblxuY29uc3QgQklOQVJZX09QUyA9IG5ldyBNYXA8c3RyaW5nLCB0cy5CaW5hcnlPcGVyYXRvcj4oW1xuICBbJysnLCB0cy5TeW50YXhLaW5kLlBsdXNUb2tlbl0sXG4gIFsnLScsIHRzLlN5bnRheEtpbmQuTWludXNUb2tlbl0sXG4gIFsnPCcsIHRzLlN5bnRheEtpbmQuTGVzc1RoYW5Ub2tlbl0sXG4gIFsnPicsIHRzLlN5bnRheEtpbmQuR3JlYXRlclRoYW5Ub2tlbl0sXG4gIFsnPD0nLCB0cy5TeW50YXhLaW5kLkxlc3NUaGFuRXF1YWxzVG9rZW5dLFxuICBbJz49JywgdHMuU3ludGF4S2luZC5HcmVhdGVyVGhhbkVxdWFsc1Rva2VuXSxcbiAgWyc9PScsIHRzLlN5bnRheEtpbmQuRXF1YWxzRXF1YWxzVG9rZW5dLFxuICBbJz09PScsIHRzLlN5bnRheEtpbmQuRXF1YWxzRXF1YWxzRXF1YWxzVG9rZW5dLFxuICBbJyonLCB0cy5TeW50YXhLaW5kLkFzdGVyaXNrVG9rZW5dLFxuICBbJy8nLCB0cy5TeW50YXhLaW5kLlNsYXNoVG9rZW5dLFxuICBbJyUnLCB0cy5TeW50YXhLaW5kLlBlcmNlbnRUb2tlbl0sXG4gIFsnIT0nLCB0cy5TeW50YXhLaW5kLkV4Y2xhbWF0aW9uRXF1YWxzVG9rZW5dLFxuICBbJyE9PScsIHRzLlN5bnRheEtpbmQuRXhjbGFtYXRpb25FcXVhbHNFcXVhbHNUb2tlbl0sXG4gIFsnfHwnLCB0cy5TeW50YXhLaW5kLkJhckJhclRva2VuXSxcbiAgWycmJicsIHRzLlN5bnRheEtpbmQuQW1wZXJzYW5kQW1wZXJzYW5kVG9rZW5dLFxuICBbJyYnLCB0cy5TeW50YXhLaW5kLkFtcGVyc2FuZFRva2VuXSxcbiAgWyd8JywgdHMuU3ludGF4S2luZC5CYXJUb2tlbl0sXG5dKTtcblxuLyoqXG4gKiBDb252ZXJ0IGFuIGBBU1RgIHRvIFR5cGVTY3JpcHQgY29kZSBkaXJlY3RseSwgd2l0aG91dCBnb2luZyB0aHJvdWdoIGFuIGludGVybWVkaWF0ZSBgRXhwcmVzc2lvbmBcbiAqIEFTVC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFzdFRvVHlwZXNjcmlwdChcbiAgICBhc3Q6IEFTVCwgbWF5YmVSZXNvbHZlOiAoYXN0OiBBU1QpID0+ICh0cy5FeHByZXNzaW9uIHwgbnVsbCksXG4gICAgY29uZmlnOiBUeXBlQ2hlY2tpbmdDb25maWcpOiB0cy5FeHByZXNzaW9uIHtcbiAgY29uc3QgdHJhbnNsYXRvciA9IG5ldyBBc3RUcmFuc2xhdG9yKG1heWJlUmVzb2x2ZSwgY29uZmlnKTtcbiAgcmV0dXJuIHRyYW5zbGF0b3IudHJhbnNsYXRlKGFzdCk7XG59XG5cbmNsYXNzIEFzdFRyYW5zbGF0b3IgaW1wbGVtZW50cyBBc3RWaXNpdG9yIHtcbiAgY29uc3RydWN0b3IoXG4gICAgICBwcml2YXRlIG1heWJlUmVzb2x2ZTogKGFzdDogQVNUKSA9PiAodHMuRXhwcmVzc2lvbiB8IG51bGwpLFxuICAgICAgcHJpdmF0ZSBjb25maWc6IFR5cGVDaGVja2luZ0NvbmZpZykge31cblxuICB0cmFuc2xhdGUoYXN0OiBBU1QpOiB0cy5FeHByZXNzaW9uIHtcbiAgICAvLyBTa2lwIG92ZXIgYW4gYEFTVFdpdGhTb3VyY2VgIGFzIGl0cyBgdmlzaXRgIG1ldGhvZCBjYWxscyBkaXJlY3RseSBpbnRvIGl0cyBhc3QncyBgdmlzaXRgLFxuICAgIC8vIHdoaWNoIHdvdWxkIHByZXZlbnQgYW55IGN1c3RvbSByZXNvbHV0aW9uIHRocm91Z2ggYG1heWJlUmVzb2x2ZWAgZm9yIHRoYXQgbm9kZS5cbiAgICBpZiAoYXN0IGluc3RhbmNlb2YgQVNUV2l0aFNvdXJjZSkge1xuICAgICAgYXN0ID0gYXN0LmFzdDtcbiAgICB9XG5cbiAgICAvLyBUaGUgYEVtcHR5RXhwcmAgZG9lc24ndCBoYXZlIGEgZGVkaWNhdGVkIG1ldGhvZCBvbiBgQXN0VmlzaXRvcmAsIHNvIGl0J3Mgc3BlY2lhbCBjYXNlZCBoZXJlLlxuICAgIGlmIChhc3QgaW5zdGFuY2VvZiBFbXB0eUV4cHIpIHtcbiAgICAgIHJldHVybiBVTkRFRklORUQ7XG4gICAgfVxuXG4gICAgLy8gRmlyc3QgYXR0ZW1wdCB0byBsZXQgYW55IGN1c3RvbSByZXNvbHV0aW9uIGxvZ2ljIHByb3ZpZGUgYSB0cmFuc2xhdGlvbiBmb3IgdGhlIGdpdmVuIG5vZGUuXG4gICAgY29uc3QgcmVzb2x2ZWQgPSB0aGlzLm1heWJlUmVzb2x2ZShhc3QpO1xuICAgIGlmIChyZXNvbHZlZCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHJlc29sdmVkO1xuICAgIH1cblxuICAgIHJldHVybiBhc3QudmlzaXQodGhpcyk7XG4gIH1cblxuICB2aXNpdFVuYXJ5KGFzdDogVW5hcnkpOiB0cy5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBleHByID0gdGhpcy50cmFuc2xhdGUoYXN0LmV4cHIpO1xuICAgIGNvbnN0IG9wID0gVU5BUllfT1BTLmdldChhc3Qub3BlcmF0b3IpO1xuICAgIGlmIChvcCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVuc3VwcG9ydGVkIFVuYXJ5Lm9wZXJhdG9yOiAke2FzdC5vcGVyYXRvcn1gKTtcbiAgICB9XG4gICAgY29uc3Qgbm9kZSA9IHdyYXBGb3JEaWFnbm9zdGljcyh0cy5jcmVhdGVQcmVmaXgob3AsIGV4cHIpKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5KTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgbGhzID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5sZWZ0KSk7XG4gICAgY29uc3QgcmhzID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5yaWdodCkpO1xuICAgIGNvbnN0IG9wID0gQklOQVJZX09QUy5nZXQoYXN0Lm9wZXJhdGlvbik7XG4gICAgaWYgKG9wID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5zdXBwb3J0ZWQgQmluYXJ5Lm9wZXJhdGlvbjogJHthc3Qub3BlcmF0aW9ufWApO1xuICAgIH1cbiAgICBjb25zdCBub2RlID0gdHMuY3JlYXRlQmluYXJ5KGxocywgb3AsIHJocyk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4pOiB0cy5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBlbGVtZW50cyA9IGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiB0aGlzLnRyYW5zbGF0ZShleHByKSk7XG4gICAgY29uc3Qgbm9kZSA9IHdyYXBGb3JEaWFnbm9zdGljcyh0cy5jcmVhdGVDb21tYUxpc3QoZWxlbWVudHMpKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0Q29uZGl0aW9uYWwoYXN0OiBDb25kaXRpb25hbCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGNvbmRFeHByID0gdGhpcy50cmFuc2xhdGUoYXN0LmNvbmRpdGlvbik7XG4gICAgY29uc3QgdHJ1ZUV4cHIgPSB0aGlzLnRyYW5zbGF0ZShhc3QudHJ1ZUV4cCk7XG4gICAgY29uc3QgZmFsc2VFeHByID0gdGhpcy50cmFuc2xhdGUoYXN0LmZhbHNlRXhwKTtcbiAgICBjb25zdCBub2RlID0gdHMuY3JlYXRlUGFyZW4odHMuY3JlYXRlQ29uZGl0aW9uYWwoY29uZEV4cHIsIHRydWVFeHByLCBmYWxzZUV4cHIpKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogRnVuY3Rpb25DYWxsKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSB3cmFwRm9yRGlhZ25vc3RpY3ModGhpcy50cmFuc2xhdGUoYXN0LnRhcmdldCEpKTtcbiAgICBjb25zdCBhcmdzID0gYXN0LmFyZ3MubWFwKGV4cHIgPT4gdGhpcy50cmFuc2xhdGUoZXhwcikpO1xuICAgIGNvbnN0IG5vZGUgPSB0cy5jcmVhdGVDYWxsKHJlY2VpdmVyLCB1bmRlZmluZWQsIGFyZ3MpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlcik6IG5ldmVyIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgLy8gQnVpbGQgdXAgYSBjaGFpbiBvZiBiaW5hcnkgKyBvcGVyYXRpb25zIHRvIHNpbXVsYXRlIHRoZSBzdHJpbmcgY29uY2F0ZW5hdGlvbiBvZiB0aGVcbiAgICAvLyBpbnRlcnBvbGF0aW9uJ3MgZXhwcmVzc2lvbnMuIFRoZSBjaGFpbiBpcyBzdGFydGVkIHVzaW5nIGFuIGFjdHVhbCBzdHJpbmcgbGl0ZXJhbCB0byBlbnN1cmVcbiAgICAvLyB0aGUgdHlwZSBpcyBpbmZlcnJlZCBhcyAnc3RyaW5nJy5cbiAgICByZXR1cm4gYXN0LmV4cHJlc3Npb25zLnJlZHVjZShcbiAgICAgICAgKGxocywgYXN0KSA9PiB0cy5jcmVhdGVCaW5hcnkobGhzLCB0cy5TeW50YXhLaW5kLlBsdXNUb2tlbiwgdGhpcy50cmFuc2xhdGUoYXN0KSksXG4gICAgICAgIHRzLmNyZWF0ZUxpdGVyYWwoJycpKTtcbiAgfVxuXG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSB3cmFwRm9yRGlhZ25vc3RpY3ModGhpcy50cmFuc2xhdGUoYXN0Lm9iaikpO1xuICAgIGNvbnN0IGtleSA9IHRoaXMudHJhbnNsYXRlKGFzdC5rZXkpO1xuICAgIGNvbnN0IG5vZGUgPSB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKHJlY2VpdmVyLCBrZXkpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRLZXllZFdyaXRlKGFzdDogS2V5ZWRXcml0ZSk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5vYmopKTtcbiAgICBjb25zdCBsZWZ0ID0gdHMuY3JlYXRlRWxlbWVudEFjY2VzcyhyZWNlaXZlciwgdGhpcy50cmFuc2xhdGUoYXN0LmtleSkpO1xuICAgIC8vIFRPRE8oam9vc3QpOiBhbm5vdGF0ZSBgbGVmdGAgd2l0aCB0aGUgc3BhbiBvZiB0aGUgZWxlbWVudCBhY2Nlc3MsIHdoaWNoIGlzIG5vdCBjdXJyZW50bHlcbiAgICAvLyAgYXZhaWxhYmxlIG9uIGBhc3RgLlxuICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy50cmFuc2xhdGUoYXN0LnZhbHVlKTtcbiAgICBjb25zdCBub2RlID0gd3JhcEZvckRpYWdub3N0aWNzKHRzLmNyZWF0ZUJpbmFyeShsZWZ0LCB0cy5TeW50YXhLaW5kLkVxdWFsc1Rva2VuLCByaWdodCkpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXkpOiB0cy5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBlbGVtZW50cyA9IGFzdC5leHByZXNzaW9ucy5tYXAoZXhwciA9PiB0aGlzLnRyYW5zbGF0ZShleHByKSk7XG4gICAgY29uc3QgbGl0ZXJhbCA9IHRzLmNyZWF0ZUFycmF5TGl0ZXJhbChlbGVtZW50cyk7XG4gICAgLy8gSWYgc3RyaWN0TGl0ZXJhbFR5cGVzIGlzIGRpc2FibGVkLCBhcnJheSBsaXRlcmFscyBhcmUgY2FzdCB0byBgYW55YC5cbiAgICBjb25zdCBub2RlID0gdGhpcy5jb25maWcuc3RyaWN0TGl0ZXJhbFR5cGVzID8gbGl0ZXJhbCA6IHRzQ2FzdFRvQW55KGxpdGVyYWwpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsTWFwKGFzdDogTGl0ZXJhbE1hcCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IHByb3BlcnRpZXMgPSBhc3Qua2V5cy5tYXAoKHtrZXl9LCBpZHgpID0+IHtcbiAgICAgIGNvbnN0IHZhbHVlID0gdGhpcy50cmFuc2xhdGUoYXN0LnZhbHVlc1tpZHhdKTtcbiAgICAgIHJldHVybiB0cy5jcmVhdGVQcm9wZXJ0eUFzc2lnbm1lbnQodHMuY3JlYXRlU3RyaW5nTGl0ZXJhbChrZXkpLCB2YWx1ZSk7XG4gICAgfSk7XG4gICAgY29uc3QgbGl0ZXJhbCA9IHRzLmNyZWF0ZU9iamVjdExpdGVyYWwocHJvcGVydGllcywgdHJ1ZSk7XG4gICAgLy8gSWYgc3RyaWN0TGl0ZXJhbFR5cGVzIGlzIGRpc2FibGVkLCBvYmplY3QgbGl0ZXJhbHMgYXJlIGNhc3QgdG8gYGFueWAuXG4gICAgY29uc3Qgbm9kZSA9IHRoaXMuY29uZmlnLnN0cmljdExpdGVyYWxUeXBlcyA/IGxpdGVyYWwgOiB0c0Nhc3RUb0FueShsaXRlcmFsKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbFByaW1pdGl2ZShhc3Q6IExpdGVyYWxQcmltaXRpdmUpOiB0cy5FeHByZXNzaW9uIHtcbiAgICBsZXQgbm9kZTogdHMuRXhwcmVzc2lvbjtcbiAgICBpZiAoYXN0LnZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIG5vZGUgPSB0cy5jcmVhdGVJZGVudGlmaWVyKCd1bmRlZmluZWQnKTtcbiAgICB9IGVsc2UgaWYgKGFzdC52YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgbm9kZSA9IHRzLmNyZWF0ZU51bGwoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbm9kZSA9IHRzLmNyZWF0ZUxpdGVyYWwoYXN0LnZhbHVlKTtcbiAgICB9XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSB3cmFwRm9yRGlhZ25vc3RpY3ModGhpcy50cmFuc2xhdGUoYXN0LnJlY2VpdmVyKSk7XG4gICAgY29uc3QgbWV0aG9kID0gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MocmVjZWl2ZXIsIGFzdC5uYW1lKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG1ldGhvZCwgYXN0Lm5hbWVTcGFuKTtcbiAgICBjb25zdCBhcmdzID0gYXN0LmFyZ3MubWFwKGV4cHIgPT4gdGhpcy50cmFuc2xhdGUoZXhwcikpO1xuICAgIGNvbnN0IG5vZGUgPSB0cy5jcmVhdGVDYWxsKG1ldGhvZCwgdW5kZWZpbmVkLCBhcmdzKTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxuXG4gIHZpc2l0Tm9uTnVsbEFzc2VydChhc3Q6IE5vbk51bGxBc3NlcnQpOiB0cy5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBleHByID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5leHByZXNzaW9uKSk7XG4gICAgY29uc3Qgbm9kZSA9IHRzLmNyZWF0ZU5vbk51bGxFeHByZXNzaW9uKGV4cHIpO1xuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUpOiBuZXZlciB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXRQcmVmaXhOb3QoYXN0OiBQcmVmaXhOb3QpOiB0cy5FeHByZXNzaW9uIHtcbiAgICBjb25zdCBleHByZXNzaW9uID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5leHByZXNzaW9uKSk7XG4gICAgY29uc3Qgbm9kZSA9IHRzLmNyZWF0ZUxvZ2ljYWxOb3QoZXhwcmVzc2lvbik7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdFByb3BlcnR5UmVhZChhc3Q6IFByb3BlcnR5UmVhZCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIC8vIFRoaXMgaXMgYSBub3JtYWwgcHJvcGVydHkgcmVhZCAtIGNvbnZlcnQgdGhlIHJlY2VpdmVyIHRvIGFuIGV4cHJlc3Npb24gYW5kIGVtaXQgdGhlIGNvcnJlY3RcbiAgICAvLyBUeXBlU2NyaXB0IGV4cHJlc3Npb24gdG8gcmVhZCB0aGUgcHJvcGVydHkuXG4gICAgY29uc3QgcmVjZWl2ZXIgPSB3cmFwRm9yRGlhZ25vc3RpY3ModGhpcy50cmFuc2xhdGUoYXN0LnJlY2VpdmVyKSk7XG4gICAgY29uc3QgbmFtZSA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHJlY2VpdmVyLCBhc3QubmFtZSk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhuYW1lLCBhc3QubmFtZVNwYW4pO1xuICAgIGNvbnN0IG5vZGUgPSB3cmFwRm9yRGlhZ25vc3RpY3MobmFtZSk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdFByb3BlcnR5V3JpdGUoYXN0OiBQcm9wZXJ0eVdyaXRlKTogdHMuRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgcmVjZWl2ZXIgPSB3cmFwRm9yRGlhZ25vc3RpY3ModGhpcy50cmFuc2xhdGUoYXN0LnJlY2VpdmVyKSk7XG4gICAgY29uc3QgbGVmdCA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHJlY2VpdmVyLCBhc3QubmFtZSk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhsZWZ0LCBhc3QubmFtZVNwYW4pO1xuICAgIC8vIFR5cGVTY3JpcHQgcmVwb3J0cyBhc3NpZ25tZW50IGVycm9ycyBvbiB0aGUgZW50aXJlIGx2YWx1ZSBleHByZXNzaW9uLiBBbm5vdGF0ZSB0aGUgbHZhbHVlIG9mXG4gICAgLy8gdGhlIGFzc2lnbm1lbnQgd2l0aCB0aGUgc291cmNlU3Bhbiwgd2hpY2ggaW5jbHVkZXMgcmVjZWl2ZXJzLCByYXRoZXIgdGhhbiBuYW1lU3BhbiBmb3JcbiAgICAvLyBjb25zaXN0ZW5jeSBvZiB0aGUgZGlhZ25vc3RpYyBsb2NhdGlvbi5cbiAgICAvLyBhLmIuYyA9IDFcbiAgICAvLyBeXl5eXl5eXl4gc291cmNlU3BhblxuICAgIC8vICAgICBeICAgICBuYW1lU3BhblxuICAgIGNvbnN0IGxlZnRXaXRoUGF0aCA9IHdyYXBGb3JEaWFnbm9zdGljcyhsZWZ0KTtcbiAgICBhZGRQYXJzZVNwYW5JbmZvKGxlZnRXaXRoUGF0aCwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIGNvbnN0IHJpZ2h0ID0gdGhpcy50cmFuc2xhdGUoYXN0LnZhbHVlKTtcbiAgICBjb25zdCBub2RlID1cbiAgICAgICAgd3JhcEZvckRpYWdub3N0aWNzKHRzLmNyZWF0ZUJpbmFyeShsZWZ0V2l0aFBhdGgsIHRzLlN5bnRheEtpbmQuRXF1YWxzVG9rZW4sIHJpZ2h0KSk7XG4gICAgYWRkUGFyc2VTcGFuSW5mbyhub2RlLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIG5vZGU7XG4gIH1cblxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUpOiB0cy5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gTlVMTF9BU19BTlk7XG4gIH1cblxuICB2aXNpdFNhZmVNZXRob2RDYWxsKGFzdDogU2FmZU1ldGhvZENhbGwpOiB0cy5FeHByZXNzaW9uIHtcbiAgICAvLyBTZWUgdGhlIGNvbW1lbnRzIGluIFNhZmVQcm9wZXJ0eVJlYWQgYWJvdmUgZm9yIGFuIGV4cGxhbmF0aW9uIG9mIHRoZSBjYXNlcyBoZXJlLlxuICAgIGxldCBub2RlOiB0cy5FeHByZXNzaW9uO1xuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5yZWNlaXZlcikpO1xuICAgIGNvbnN0IGFyZ3MgPSBhc3QuYXJncy5tYXAoZXhwciA9PiB0aGlzLnRyYW5zbGF0ZShleHByKSk7XG4gICAgaWYgKHRoaXMuY29uZmlnLnN0cmljdFNhZmVOYXZpZ2F0aW9uVHlwZXMpIHtcbiAgICAgIC8vIFwiYT8ubWV0aG9kKC4uLilcIiBiZWNvbWVzIChudWxsIGFzIGFueSA/IGEhLm1ldGhvZCguLi4pIDogdW5kZWZpbmVkKVxuICAgICAgY29uc3QgbWV0aG9kID0gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3ModHMuY3JlYXRlTm9uTnVsbEV4cHJlc3Npb24ocmVjZWl2ZXIpLCBhc3QubmFtZSk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKG1ldGhvZCwgYXN0Lm5hbWVTcGFuKTtcbiAgICAgIGNvbnN0IGNhbGwgPSB0cy5jcmVhdGVDYWxsKG1ldGhvZCwgdW5kZWZpbmVkLCBhcmdzKTtcbiAgICAgIG5vZGUgPSB0cy5jcmVhdGVQYXJlbih0cy5jcmVhdGVDb25kaXRpb25hbChOVUxMX0FTX0FOWSwgY2FsbCwgVU5ERUZJTkVEKSk7XG4gICAgfSBlbHNlIGlmIChWZVNhZmVMaHNJbmZlcmVuY2VCdWdEZXRlY3Rvci52ZVdpbGxJbmZlckFueUZvcihhc3QpKSB7XG4gICAgICAvLyBcImE/Lm1ldGhvZCguLi4pXCIgYmVjb21lcyAoYSBhcyBhbnkpLm1ldGhvZCguLi4pXG4gICAgICBjb25zdCBtZXRob2QgPSB0cy5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyh0c0Nhc3RUb0FueShyZWNlaXZlciksIGFzdC5uYW1lKTtcbiAgICAgIGFkZFBhcnNlU3BhbkluZm8obWV0aG9kLCBhc3QubmFtZVNwYW4pO1xuICAgICAgbm9kZSA9IHRzLmNyZWF0ZUNhbGwobWV0aG9kLCB1bmRlZmluZWQsIGFyZ3MpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBcImE/Lm1ldGhvZCguLi4pXCIgYmVjb21lcyAoYSEubWV0aG9kKC4uLikgYXMgYW55KVxuICAgICAgY29uc3QgbWV0aG9kID0gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3ModHMuY3JlYXRlTm9uTnVsbEV4cHJlc3Npb24ocmVjZWl2ZXIpLCBhc3QubmFtZSk7XG4gICAgICBhZGRQYXJzZVNwYW5JbmZvKG1ldGhvZCwgYXN0Lm5hbWVTcGFuKTtcbiAgICAgIG5vZGUgPSB0c0Nhc3RUb0FueSh0cy5jcmVhdGVDYWxsKG1ldGhvZCwgdW5kZWZpbmVkLCBhcmdzKSk7XG4gICAgfVxuICAgIGFkZFBhcnNlU3BhbkluZm8obm9kZSwgYXN0LnNvdXJjZVNwYW4pO1xuICAgIHJldHVybiBub2RlO1xuICB9XG5cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGxldCBub2RlOiB0cy5FeHByZXNzaW9uO1xuICAgIGNvbnN0IHJlY2VpdmVyID0gd3JhcEZvckRpYWdub3N0aWNzKHRoaXMudHJhbnNsYXRlKGFzdC5yZWNlaXZlcikpO1xuICAgIC8vIFRoZSBmb3JtIG9mIHNhZmUgcHJvcGVydHkgcmVhZHMgZGVwZW5kcyBvbiB3aGV0aGVyIHN0cmljdG5lc3MgaXMgaW4gdXNlLlxuICAgIGlmICh0aGlzLmNvbmZpZy5zdHJpY3RTYWZlTmF2aWdhdGlvblR5cGVzKSB7XG4gICAgICAvLyBCYXNpY2FsbHksIHRoZSByZXR1cm4gaGVyZSBpcyBlaXRoZXIgdGhlIHR5cGUgb2YgdGhlIGNvbXBsZXRlIGV4cHJlc3Npb24gd2l0aCBhIG51bGwtc2FmZVxuICAgICAgLy8gcHJvcGVydHkgcmVhZCwgb3IgYHVuZGVmaW5lZGAuIFNvIGEgdGVybmFyeSBpcyB1c2VkIHRvIGNyZWF0ZSBhbiBcIm9yXCIgdHlwZTpcbiAgICAgIC8vIFwiYT8uYlwiIGJlY29tZXMgKG51bGwgYXMgYW55ID8gYSEuYiA6IHVuZGVmaW5lZClcbiAgICAgIC8vIFRoZSB0eXBlIG9mIHRoaXMgZXhwcmVzc2lvbiBpcyAodHlwZW9mIGEhLmIpIHwgdW5kZWZpbmVkLCB3aGljaCBpcyBleGFjdGx5IGFzIGRlc2lyZWQuXG4gICAgICBjb25zdCBleHByID0gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3ModHMuY3JlYXRlTm9uTnVsbEV4cHJlc3Npb24ocmVjZWl2ZXIpLCBhc3QubmFtZSk7XG4gICAgICBub2RlID0gdHMuY3JlYXRlUGFyZW4odHMuY3JlYXRlQ29uZGl0aW9uYWwoTlVMTF9BU19BTlksIGV4cHIsIFVOREVGSU5FRCkpO1xuICAgIH0gZWxzZSBpZiAoVmVTYWZlTGhzSW5mZXJlbmNlQnVnRGV0ZWN0b3IudmVXaWxsSW5mZXJBbnlGb3IoYXN0KSkge1xuICAgICAgLy8gRW11bGF0ZSBhIFZpZXcgRW5naW5lIGJ1ZyB3aGVyZSAnYW55JyBpcyBpbmZlcnJlZCBmb3IgdGhlIGxlZnQtaGFuZCBzaWRlIG9mIHRoZSBzYWZlXG4gICAgICAvLyBuYXZpZ2F0aW9uIG9wZXJhdGlvbi4gV2l0aCB0aGlzIGJ1ZywgdGhlIHR5cGUgb2YgdGhlIGxlZnQtaGFuZCBzaWRlIGlzIHJlZ2FyZGVkIGFzIGFueS5cbiAgICAgIC8vIFRoZXJlZm9yZSwgdGhlIGxlZnQtaGFuZCBzaWRlIG9ubHkgbmVlZHMgcmVwZWF0aW5nIGluIHRoZSBvdXRwdXQgKHRvIHZhbGlkYXRlIGl0KSwgYW5kIHRoZW5cbiAgICAgIC8vICdhbnknIGlzIHVzZWQgZm9yIHRoZSByZXN0IG9mIHRoZSBleHByZXNzaW9uLiBUaGlzIGlzIGRvbmUgdXNpbmcgYSBjb21tYSBvcGVyYXRvcjpcbiAgICAgIC8vIFwiYT8uYlwiIGJlY29tZXMgKGEgYXMgYW55KS5iLCB3aGljaCB3aWxsIG9mIGNvdXJzZSBoYXZlIHR5cGUgJ2FueScuXG4gICAgICBub2RlID0gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3ModHNDYXN0VG9BbnkocmVjZWl2ZXIpLCBhc3QubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBWaWV3IEVuZ2luZSBidWcgaXNuJ3QgYWN0aXZlLCBzbyBjaGVjayB0aGUgZW50aXJlIHR5cGUgb2YgdGhlIGV4cHJlc3Npb24sIGJ1dCB0aGUgZmluYWxcbiAgICAgIC8vIHJlc3VsdCBpcyBzdGlsbCBpbmZlcnJlZCBhcyBgYW55YC5cbiAgICAgIC8vIFwiYT8uYlwiIGJlY29tZXMgKGEhLmIgYXMgYW55KVxuICAgICAgY29uc3QgZXhwciA9IHRzLmNyZWF0ZVByb3BlcnR5QWNjZXNzKHRzLmNyZWF0ZU5vbk51bGxFeHByZXNzaW9uKHJlY2VpdmVyKSwgYXN0Lm5hbWUpO1xuICAgICAgbm9kZSA9IHRzQ2FzdFRvQW55KGV4cHIpO1xuICAgIH1cbiAgICBhZGRQYXJzZVNwYW5JbmZvKG5vZGUsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gbm9kZTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrcyB3aGV0aGVyIFZpZXcgRW5naW5lIHdpbGwgaW5mZXIgYSB0eXBlIG9mICdhbnknIGZvciB0aGUgbGVmdC1oYW5kIHNpZGUgb2YgYSBzYWZlIG5hdmlnYXRpb25cbiAqIG9wZXJhdGlvbi5cbiAqXG4gKiBJbiBWaWV3IEVuZ2luZSdzIHRlbXBsYXRlIHR5cGUtY2hlY2tlciwgY2VydGFpbiByZWNlaXZlcnMgb2Ygc2FmZSBuYXZpZ2F0aW9uIG9wZXJhdGlvbnMgd2lsbFxuICogY2F1c2UgYSB0ZW1wb3JhcnkgdmFyaWFibGUgdG8gYmUgYWxsb2NhdGVkIGFzIHBhcnQgb2YgdGhlIGNoZWNraW5nIGV4cHJlc3Npb24sIHRvIHNhdmUgdGhlIHZhbHVlXG4gKiBvZiB0aGUgcmVjZWl2ZXIgYW5kIHVzZSBpdCBtb3JlIHRoYW4gb25jZSBpbiB0aGUgZXhwcmVzc2lvbi4gVGhpcyB0ZW1wb3JhcnkgdmFyaWFibGUgaGFzIHR5cGVcbiAqICdhbnknLiBJbiBwcmFjdGljZSwgdGhpcyBtZWFucyBjZXJ0YWluIHJlY2VpdmVycyBjYXVzZSBWaWV3IEVuZ2luZSB0byBub3QgY2hlY2sgdGhlIGZ1bGxcbiAqIGV4cHJlc3Npb24sIGFuZCBvdGhlciByZWNlaXZlcnMgd2lsbCByZWNlaXZlIG1vcmUgY29tcGxldGUgY2hlY2tpbmcuXG4gKlxuICogRm9yIGNvbXBhdGliaWxpdHksIHRoaXMgbG9naWMgaXMgYWRhcHRlZCBmcm9tIFZpZXcgRW5naW5lJ3MgZXhwcmVzc2lvbl9jb252ZXJ0ZXIudHMgc28gdGhhdCB0aGVcbiAqIEl2eSBjaGVja2VyIGNhbiBlbXVsYXRlIHRoaXMgYnVnIHdoZW4gbmVlZGVkLlxuICovXG5jbGFzcyBWZVNhZmVMaHNJbmZlcmVuY2VCdWdEZXRlY3RvciBpbXBsZW1lbnRzIEFzdFZpc2l0b3Ige1xuICBwcml2YXRlIHN0YXRpYyBTSU5HTEVUT04gPSBuZXcgVmVTYWZlTGhzSW5mZXJlbmNlQnVnRGV0ZWN0b3IoKTtcblxuICBzdGF0aWMgdmVXaWxsSW5mZXJBbnlGb3IoYXN0OiBTYWZlTWV0aG9kQ2FsbHxTYWZlUHJvcGVydHlSZWFkKSB7XG4gICAgcmV0dXJuIGFzdC5yZWNlaXZlci52aXNpdChWZVNhZmVMaHNJbmZlcmVuY2VCdWdEZXRlY3Rvci5TSU5HTEVUT04pO1xuICB9XG5cbiAgdmlzaXRVbmFyeShhc3Q6IFVuYXJ5KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGFzdC5leHByLnZpc2l0KHRoaXMpO1xuICB9XG4gIHZpc2l0QmluYXJ5KGFzdDogQmluYXJ5KTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGFzdC5sZWZ0LnZpc2l0KHRoaXMpIHx8IGFzdC5yaWdodC52aXNpdCh0aGlzKTtcbiAgfVxuICB2aXNpdENoYWluKGFzdDogQ2hhaW4pOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmlzaXRDb25kaXRpb25hbChhc3Q6IENvbmRpdGlvbmFsKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGFzdC5jb25kaXRpb24udmlzaXQodGhpcykgfHwgYXN0LnRydWVFeHAudmlzaXQodGhpcykgfHwgYXN0LmZhbHNlRXhwLnZpc2l0KHRoaXMpO1xuICB9XG4gIHZpc2l0RnVuY3Rpb25DYWxsKGFzdDogRnVuY3Rpb25DYWxsKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdmlzaXRJbXBsaWNpdFJlY2VpdmVyKGFzdDogSW1wbGljaXRSZWNlaXZlcik6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2aXNpdEludGVycG9sYXRpb24oYXN0OiBJbnRlcnBvbGF0aW9uKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGFzdC5leHByZXNzaW9ucy5zb21lKGV4cCA9PiBleHAudmlzaXQodGhpcykpO1xuICB9XG4gIHZpc2l0S2V5ZWRSZWFkKGFzdDogS2V5ZWRSZWFkKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHZpc2l0S2V5ZWRXcml0ZShhc3Q6IEtleWVkV3JpdGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmlzaXRMaXRlcmFsQXJyYXkoYXN0OiBMaXRlcmFsQXJyYXkpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB2aXNpdExpdGVyYWxNYXAoYXN0OiBMaXRlcmFsTWFwKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdmlzaXRMaXRlcmFsUHJpbWl0aXZlKGFzdDogTGl0ZXJhbFByaW1pdGl2ZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2aXNpdE1ldGhvZENhbGwoYXN0OiBNZXRob2RDYWxsKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdmlzaXRQaXBlKGFzdDogQmluZGluZ1BpcGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuICB2aXNpdFByZWZpeE5vdChhc3Q6IFByZWZpeE5vdCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBhc3QuZXhwcmVzc2lvbi52aXNpdCh0aGlzKTtcbiAgfVxuICB2aXNpdE5vbk51bGxBc3NlcnQoYXN0OiBQcmVmaXhOb3QpOiBib29sZWFuIHtcbiAgICByZXR1cm4gYXN0LmV4cHJlc3Npb24udmlzaXQodGhpcyk7XG4gIH1cbiAgdmlzaXRQcm9wZXJ0eVJlYWQoYXN0OiBQcm9wZXJ0eVJlYWQpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmlzaXRQcm9wZXJ0eVdyaXRlKGFzdDogUHJvcGVydHlXcml0ZSk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2aXNpdFF1b3RlKGFzdDogUXVvdGUpOiBib29sZWFuIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgdmlzaXRTYWZlTWV0aG9kQ2FsbChhc3Q6IFNhZmVNZXRob2RDYWxsKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbiAgdmlzaXRTYWZlUHJvcGVydHlSZWFkKGFzdDogU2FmZVByb3BlcnR5UmVhZCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuIl19