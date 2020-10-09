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
        define("@angular/compiler-cli/src/ngtsc/translator/src/translator", ["require", "exports", "tslib", "@angular/compiler", "@angular/compiler/src/output/output_ast", "typescript", "@angular/compiler-cli/src/ngtsc/imports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.attachComments = exports.TypeTranslatorVisitor = exports.translateType = exports.translateStatement = exports.translateExpression = exports.ImportManager = exports.Context = void 0;
    var tslib_1 = require("tslib");
    var compiler_1 = require("@angular/compiler");
    var output_ast_1 = require("@angular/compiler/src/output/output_ast");
    var ts = require("typescript");
    var imports_1 = require("@angular/compiler-cli/src/ngtsc/imports");
    var Context = /** @class */ (function () {
        function Context(isStatement) {
            this.isStatement = isStatement;
        }
        Object.defineProperty(Context.prototype, "withExpressionMode", {
            get: function () {
                return this.isStatement ? new Context(false) : this;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(Context.prototype, "withStatementMode", {
            get: function () {
                return !this.isStatement ? new Context(true) : this;
            },
            enumerable: false,
            configurable: true
        });
        return Context;
    }());
    exports.Context = Context;
    var UNARY_OPERATORS = new Map([
        [output_ast_1.UnaryOperator.Minus, ts.SyntaxKind.MinusToken],
        [output_ast_1.UnaryOperator.Plus, ts.SyntaxKind.PlusToken],
    ]);
    var BINARY_OPERATORS = new Map([
        [compiler_1.BinaryOperator.And, ts.SyntaxKind.AmpersandAmpersandToken],
        [compiler_1.BinaryOperator.Bigger, ts.SyntaxKind.GreaterThanToken],
        [compiler_1.BinaryOperator.BiggerEquals, ts.SyntaxKind.GreaterThanEqualsToken],
        [compiler_1.BinaryOperator.BitwiseAnd, ts.SyntaxKind.AmpersandToken],
        [compiler_1.BinaryOperator.Divide, ts.SyntaxKind.SlashToken],
        [compiler_1.BinaryOperator.Equals, ts.SyntaxKind.EqualsEqualsToken],
        [compiler_1.BinaryOperator.Identical, ts.SyntaxKind.EqualsEqualsEqualsToken],
        [compiler_1.BinaryOperator.Lower, ts.SyntaxKind.LessThanToken],
        [compiler_1.BinaryOperator.LowerEquals, ts.SyntaxKind.LessThanEqualsToken],
        [compiler_1.BinaryOperator.Minus, ts.SyntaxKind.MinusToken],
        [compiler_1.BinaryOperator.Modulo, ts.SyntaxKind.PercentToken],
        [compiler_1.BinaryOperator.Multiply, ts.SyntaxKind.AsteriskToken],
        [compiler_1.BinaryOperator.NotEquals, ts.SyntaxKind.ExclamationEqualsToken],
        [compiler_1.BinaryOperator.NotIdentical, ts.SyntaxKind.ExclamationEqualsEqualsToken],
        [compiler_1.BinaryOperator.Or, ts.SyntaxKind.BarBarToken],
        [compiler_1.BinaryOperator.Plus, ts.SyntaxKind.PlusToken],
    ]);
    var ImportManager = /** @class */ (function () {
        function ImportManager(rewriter, prefix) {
            if (rewriter === void 0) { rewriter = new imports_1.NoopImportRewriter(); }
            if (prefix === void 0) { prefix = 'i'; }
            this.rewriter = rewriter;
            this.prefix = prefix;
            this.specifierToIdentifier = new Map();
            this.nextIndex = 0;
        }
        ImportManager.prototype.generateNamedImport = function (moduleName, originalSymbol) {
            // First, rewrite the symbol name.
            var symbol = this.rewriter.rewriteSymbol(originalSymbol, moduleName);
            // Ask the rewriter if this symbol should be imported at all. If not, it can be referenced
            // directly (moduleImport: null).
            if (!this.rewriter.shouldImportSymbol(symbol, moduleName)) {
                // The symbol should be referenced directly.
                return { moduleImport: null, symbol: symbol };
            }
            // If not, this symbol will be imported. Allocate a prefix for the imported module if needed.
            if (!this.specifierToIdentifier.has(moduleName)) {
                this.specifierToIdentifier.set(moduleName, "" + this.prefix + this.nextIndex++);
            }
            var moduleImport = this.specifierToIdentifier.get(moduleName);
            return { moduleImport: moduleImport, symbol: symbol };
        };
        ImportManager.prototype.getAllImports = function (contextPath) {
            var _this = this;
            var imports = [];
            this.specifierToIdentifier.forEach(function (qualifier, specifier) {
                specifier = _this.rewriter.rewriteSpecifier(specifier, contextPath);
                imports.push({ specifier: specifier, qualifier: qualifier });
            });
            return imports;
        };
        return ImportManager;
    }());
    exports.ImportManager = ImportManager;
    function translateExpression(expression, imports, defaultImportRecorder, scriptTarget) {
        return expression.visitExpression(new ExpressionTranslatorVisitor(imports, defaultImportRecorder, scriptTarget), new Context(false));
    }
    exports.translateExpression = translateExpression;
    function translateStatement(statement, imports, defaultImportRecorder, scriptTarget) {
        return statement.visitStatement(new ExpressionTranslatorVisitor(imports, defaultImportRecorder, scriptTarget), new Context(true));
    }
    exports.translateStatement = translateStatement;
    function translateType(type, imports) {
        return type.visitType(new TypeTranslatorVisitor(imports), new Context(false));
    }
    exports.translateType = translateType;
    var ExpressionTranslatorVisitor = /** @class */ (function () {
        function ExpressionTranslatorVisitor(imports, defaultImportRecorder, scriptTarget) {
            this.imports = imports;
            this.defaultImportRecorder = defaultImportRecorder;
            this.scriptTarget = scriptTarget;
            this.externalSourceFiles = new Map();
        }
        ExpressionTranslatorVisitor.prototype.visitDeclareVarStmt = function (stmt, context) {
            var _a;
            var isConst = this.scriptTarget >= ts.ScriptTarget.ES2015 && stmt.hasModifier(compiler_1.StmtModifier.Final);
            var varDeclaration = ts.createVariableDeclaration(
            /* name */ stmt.name, 
            /* type */ undefined, (_a = 
            /* initializer */ stmt.value) === null || _a === void 0 ? void 0 : _a.visitExpression(this, context.withExpressionMode));
            var declarationList = ts.createVariableDeclarationList(
            /* declarations */ [varDeclaration], 
            /* flags */ isConst ? ts.NodeFlags.Const : ts.NodeFlags.None);
            var varStatement = ts.createVariableStatement(undefined, declarationList);
            return attachComments(varStatement, stmt.leadingComments);
        };
        ExpressionTranslatorVisitor.prototype.visitDeclareFunctionStmt = function (stmt, context) {
            var _this = this;
            var fnDeclaration = ts.createFunctionDeclaration(
            /* decorators */ undefined, 
            /* modifiers */ undefined, 
            /* asterisk */ undefined, 
            /* name */ stmt.name, 
            /* typeParameters */ undefined, 
            /* parameters */
            stmt.params.map(function (param) { return ts.createParameter(undefined, undefined, undefined, param.name); }), 
            /* type */ undefined, 
            /* body */
            ts.createBlock(stmt.statements.map(function (child) { return child.visitStatement(_this, context.withStatementMode); })));
            return attachComments(fnDeclaration, stmt.leadingComments);
        };
        ExpressionTranslatorVisitor.prototype.visitExpressionStmt = function (stmt, context) {
            return attachComments(ts.createStatement(stmt.expr.visitExpression(this, context.withStatementMode)), stmt.leadingComments);
        };
        ExpressionTranslatorVisitor.prototype.visitReturnStmt = function (stmt, context) {
            return attachComments(ts.createReturn(stmt.value.visitExpression(this, context.withExpressionMode)), stmt.leadingComments);
        };
        ExpressionTranslatorVisitor.prototype.visitDeclareClassStmt = function (stmt, context) {
            if (this.scriptTarget < ts.ScriptTarget.ES2015) {
                throw new Error("Unsupported mode: Visiting a \"declare class\" statement (class " + stmt.name + ") while " +
                    ("targeting " + ts.ScriptTarget[this.scriptTarget] + "."));
            }
            throw new Error('Method not implemented.');
        };
        ExpressionTranslatorVisitor.prototype.visitIfStmt = function (stmt, context) {
            var _this = this;
            var thenBlock = ts.createBlock(stmt.trueCase.map(function (child) { return child.visitStatement(_this, context.withStatementMode); }));
            var elseBlock = stmt.falseCase.length > 0 ?
                ts.createBlock(stmt.falseCase.map(function (child) { return child.visitStatement(_this, context.withStatementMode); })) :
                undefined;
            var ifStatement = ts.createIf(stmt.condition.visitExpression(this, context), thenBlock, elseBlock);
            return attachComments(ifStatement, stmt.leadingComments);
        };
        ExpressionTranslatorVisitor.prototype.visitTryCatchStmt = function (stmt, context) {
            throw new Error('Method not implemented.');
        };
        ExpressionTranslatorVisitor.prototype.visitThrowStmt = function (stmt, context) {
            return attachComments(ts.createThrow(stmt.error.visitExpression(this, context.withExpressionMode)), stmt.leadingComments);
        };
        ExpressionTranslatorVisitor.prototype.visitReadVarExpr = function (ast, context) {
            var identifier = ts.createIdentifier(ast.name);
            this.setSourceMapRange(identifier, ast.sourceSpan);
            return identifier;
        };
        ExpressionTranslatorVisitor.prototype.visitWriteVarExpr = function (expr, context) {
            var result = ts.createBinary(ts.createIdentifier(expr.name), ts.SyntaxKind.EqualsToken, expr.value.visitExpression(this, context));
            return context.isStatement ? result : ts.createParen(result);
        };
        ExpressionTranslatorVisitor.prototype.visitWriteKeyExpr = function (expr, context) {
            var exprContext = context.withExpressionMode;
            var lhs = ts.createElementAccess(expr.receiver.visitExpression(this, exprContext), expr.index.visitExpression(this, exprContext));
            var rhs = expr.value.visitExpression(this, exprContext);
            var result = ts.createBinary(lhs, ts.SyntaxKind.EqualsToken, rhs);
            return context.isStatement ? result : ts.createParen(result);
        };
        ExpressionTranslatorVisitor.prototype.visitWritePropExpr = function (expr, context) {
            return ts.createBinary(ts.createPropertyAccess(expr.receiver.visitExpression(this, context), expr.name), ts.SyntaxKind.EqualsToken, expr.value.visitExpression(this, context));
        };
        ExpressionTranslatorVisitor.prototype.visitInvokeMethodExpr = function (ast, context) {
            var _this = this;
            var target = ast.receiver.visitExpression(this, context);
            var call = ts.createCall(ast.name !== null ? ts.createPropertyAccess(target, ast.name) : target, undefined, ast.args.map(function (arg) { return arg.visitExpression(_this, context); }));
            this.setSourceMapRange(call, ast.sourceSpan);
            return call;
        };
        ExpressionTranslatorVisitor.prototype.visitInvokeFunctionExpr = function (ast, context) {
            var _this = this;
            var expr = ts.createCall(ast.fn.visitExpression(this, context), undefined, ast.args.map(function (arg) { return arg.visitExpression(_this, context); }));
            if (ast.pure) {
                ts.addSyntheticLeadingComment(expr, ts.SyntaxKind.MultiLineCommentTrivia, '@__PURE__', false);
            }
            this.setSourceMapRange(expr, ast.sourceSpan);
            return expr;
        };
        ExpressionTranslatorVisitor.prototype.visitInstantiateExpr = function (ast, context) {
            var _this = this;
            return ts.createNew(ast.classExpr.visitExpression(this, context), undefined, ast.args.map(function (arg) { return arg.visitExpression(_this, context); }));
        };
        ExpressionTranslatorVisitor.prototype.visitLiteralExpr = function (ast, context) {
            var expr;
            if (ast.value === undefined) {
                expr = ts.createIdentifier('undefined');
            }
            else if (ast.value === null) {
                expr = ts.createNull();
            }
            else {
                expr = ts.createLiteral(ast.value);
            }
            this.setSourceMapRange(expr, ast.sourceSpan);
            return expr;
        };
        ExpressionTranslatorVisitor.prototype.visitLocalizedString = function (ast, context) {
            var localizedString = this.scriptTarget >= ts.ScriptTarget.ES2015 ?
                this.createLocalizedStringTaggedTemplate(ast, context) :
                this.createLocalizedStringFunctionCall(ast, context);
            this.setSourceMapRange(localizedString, ast.sourceSpan);
            return localizedString;
        };
        ExpressionTranslatorVisitor.prototype.visitExternalExpr = function (ast, context) {
            if (ast.value.name === null) {
                throw new Error("Import unknown module or symbol " + ast.value);
            }
            // If a moduleName is specified, this is a normal import. If there's no module name, it's a
            // reference to a global/ambient symbol.
            if (ast.value.moduleName !== null) {
                // This is a normal import. Find the imported module.
                var _a = this.imports.generateNamedImport(ast.value.moduleName, ast.value.name), moduleImport = _a.moduleImport, symbol = _a.symbol;
                if (moduleImport === null) {
                    // The symbol was ambient after all.
                    return ts.createIdentifier(symbol);
                }
                else {
                    return ts.createPropertyAccess(ts.createIdentifier(moduleImport), ts.createIdentifier(symbol));
                }
            }
            else {
                // The symbol is ambient, so just reference it.
                return ts.createIdentifier(ast.value.name);
            }
        };
        ExpressionTranslatorVisitor.prototype.visitConditionalExpr = function (ast, context) {
            var cond = ast.condition.visitExpression(this, context);
            // Ordinarily the ternary operator is right-associative. The following are equivalent:
            //   `a ? b : c ? d : e` => `a ? b : (c ? d : e)`
            //
            // However, occasionally Angular needs to produce a left-associative conditional, such as in
            // the case of a null-safe navigation production: `{{a?.b ? c : d}}`. This template produces
            // a ternary of the form:
            //   `a == null ? null : rest of expression`
            // If the rest of the expression is also a ternary though, this would produce the form:
            //   `a == null ? null : a.b ? c : d`
            // which, if left as right-associative, would be incorrectly associated as:
            //   `a == null ? null : (a.b ? c : d)`
            //
            // In such cases, the left-associativity needs to be enforced with parentheses:
            //   `(a == null ? null : a.b) ? c : d`
            //
            // Such parentheses could always be included in the condition (guaranteeing correct behavior) in
            // all cases, but this has a code size cost. Instead, parentheses are added only when a
            // conditional expression is directly used as the condition of another.
            //
            // TODO(alxhub): investigate better logic for precendence of conditional operators
            if (ast.condition instanceof compiler_1.ConditionalExpr) {
                // The condition of this ternary needs to be wrapped in parentheses to maintain
                // left-associativity.
                cond = ts.createParen(cond);
            }
            return ts.createConditional(cond, ast.trueCase.visitExpression(this, context), ast.falseCase.visitExpression(this, context));
        };
        ExpressionTranslatorVisitor.prototype.visitNotExpr = function (ast, context) {
            return ts.createPrefix(ts.SyntaxKind.ExclamationToken, ast.condition.visitExpression(this, context));
        };
        ExpressionTranslatorVisitor.prototype.visitAssertNotNullExpr = function (ast, context) {
            return ast.condition.visitExpression(this, context);
        };
        ExpressionTranslatorVisitor.prototype.visitCastExpr = function (ast, context) {
            return ast.value.visitExpression(this, context);
        };
        ExpressionTranslatorVisitor.prototype.visitFunctionExpr = function (ast, context) {
            var _this = this;
            return ts.createFunctionExpression(undefined, undefined, ast.name || undefined, undefined, ast.params.map(function (param) { return ts.createParameter(undefined, undefined, undefined, param.name, undefined, undefined, undefined); }), undefined, ts.createBlock(ast.statements.map(function (stmt) { return stmt.visitStatement(_this, context); })));
        };
        ExpressionTranslatorVisitor.prototype.visitUnaryOperatorExpr = function (ast, context) {
            if (!UNARY_OPERATORS.has(ast.operator)) {
                throw new Error("Unknown unary operator: " + output_ast_1.UnaryOperator[ast.operator]);
            }
            return ts.createPrefix(UNARY_OPERATORS.get(ast.operator), ast.expr.visitExpression(this, context));
        };
        ExpressionTranslatorVisitor.prototype.visitBinaryOperatorExpr = function (ast, context) {
            if (!BINARY_OPERATORS.has(ast.operator)) {
                throw new Error("Unknown binary operator: " + compiler_1.BinaryOperator[ast.operator]);
            }
            return ts.createBinary(ast.lhs.visitExpression(this, context), BINARY_OPERATORS.get(ast.operator), ast.rhs.visitExpression(this, context));
        };
        ExpressionTranslatorVisitor.prototype.visitReadPropExpr = function (ast, context) {
            return ts.createPropertyAccess(ast.receiver.visitExpression(this, context), ast.name);
        };
        ExpressionTranslatorVisitor.prototype.visitReadKeyExpr = function (ast, context) {
            return ts.createElementAccess(ast.receiver.visitExpression(this, context), ast.index.visitExpression(this, context));
        };
        ExpressionTranslatorVisitor.prototype.visitLiteralArrayExpr = function (ast, context) {
            var _this = this;
            var expr = ts.createArrayLiteral(ast.entries.map(function (expr) { return expr.visitExpression(_this, context); }));
            this.setSourceMapRange(expr, ast.sourceSpan);
            return expr;
        };
        ExpressionTranslatorVisitor.prototype.visitLiteralMapExpr = function (ast, context) {
            var _this = this;
            var entries = ast.entries.map(function (entry) { return ts.createPropertyAssignment(entry.quoted ? ts.createLiteral(entry.key) : ts.createIdentifier(entry.key), entry.value.visitExpression(_this, context)); });
            var expr = ts.createObjectLiteral(entries);
            this.setSourceMapRange(expr, ast.sourceSpan);
            return expr;
        };
        ExpressionTranslatorVisitor.prototype.visitCommaExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        ExpressionTranslatorVisitor.prototype.visitWrappedNodeExpr = function (ast, context) {
            if (ts.isIdentifier(ast.node)) {
                this.defaultImportRecorder.recordUsedIdentifier(ast.node);
            }
            return ast.node;
        };
        ExpressionTranslatorVisitor.prototype.visitTypeofExpr = function (ast, context) {
            return ts.createTypeOf(ast.expr.visitExpression(this, context));
        };
        /**
         * Translate the `LocalizedString` node into a `TaggedTemplateExpression` for ES2015 formatted
         * output.
         */
        ExpressionTranslatorVisitor.prototype.createLocalizedStringTaggedTemplate = function (ast, context) {
            var template;
            var length = ast.messageParts.length;
            var metaBlock = ast.serializeI18nHead();
            if (length === 1) {
                template = ts.createNoSubstitutionTemplateLiteral(metaBlock.cooked, metaBlock.raw);
                this.setSourceMapRange(template, ast.getMessagePartSourceSpan(0));
            }
            else {
                // Create the head part
                var head = ts.createTemplateHead(metaBlock.cooked, metaBlock.raw);
                this.setSourceMapRange(head, ast.getMessagePartSourceSpan(0));
                var spans = [];
                // Create the middle parts
                for (var i = 1; i < length - 1; i++) {
                    var resolvedExpression_1 = ast.expressions[i - 1].visitExpression(this, context);
                    this.setSourceMapRange(resolvedExpression_1, ast.getPlaceholderSourceSpan(i - 1));
                    var templatePart_1 = ast.serializeI18nTemplatePart(i);
                    var templateMiddle = createTemplateMiddle(templatePart_1.cooked, templatePart_1.raw);
                    this.setSourceMapRange(templateMiddle, ast.getMessagePartSourceSpan(i));
                    var templateSpan = ts.createTemplateSpan(resolvedExpression_1, templateMiddle);
                    spans.push(templateSpan);
                }
                // Create the tail part
                var resolvedExpression = ast.expressions[length - 2].visitExpression(this, context);
                this.setSourceMapRange(resolvedExpression, ast.getPlaceholderSourceSpan(length - 2));
                var templatePart = ast.serializeI18nTemplatePart(length - 1);
                var templateTail = createTemplateTail(templatePart.cooked, templatePart.raw);
                this.setSourceMapRange(templateTail, ast.getMessagePartSourceSpan(length - 1));
                spans.push(ts.createTemplateSpan(resolvedExpression, templateTail));
                // Put it all together
                template = ts.createTemplateExpression(head, spans);
            }
            var expression = ts.createTaggedTemplate(ts.createIdentifier('$localize'), template);
            this.setSourceMapRange(expression, ast.sourceSpan);
            return expression;
        };
        /**
         * Translate the `LocalizedString` node into a `$localize` call using the imported
         * `__makeTemplateObject` helper for ES5 formatted output.
         */
        ExpressionTranslatorVisitor.prototype.createLocalizedStringFunctionCall = function (ast, context) {
            // A `$localize` message consists `messageParts` and `expressions`, which get interleaved
            // together. The interleaved pieces look like:
            // `[messagePart0, expression0, messagePart1, expression1, messagePart2]`
            //
            // Note that there is always a message part at the start and end, and so therefore
            // `messageParts.length === expressions.length + 1`.
            //
            // Each message part may be prefixed with "metadata", which is wrapped in colons (:) delimiters.
            // The metadata is attached to the first and subsequent message parts by calls to
            // `serializeI18nHead()` and `serializeI18nTemplatePart()` respectively.
            var _this = this;
            // The first message part (i.e. `ast.messageParts[0]`) is used to initialize `messageParts`
            // array.
            var messageParts = [ast.serializeI18nHead()];
            var expressions = [];
            // The rest of the `ast.messageParts` and each of the expressions are `ast.expressions` pushed
            // into the arrays. Note that `ast.messagePart[i]` corresponds to `expressions[i-1]`
            for (var i = 1; i < ast.messageParts.length; i++) {
                expressions.push(ast.expressions[i - 1].visitExpression(this, context));
                messageParts.push(ast.serializeI18nTemplatePart(i));
            }
            // The resulting downlevelled tagged template string uses a call to the `__makeTemplateObject()`
            // helper, so we must ensure it has been imported.
            var _a = this.imports.generateNamedImport('tslib', '__makeTemplateObject'), moduleImport = _a.moduleImport, symbol = _a.symbol;
            var __makeTemplateObjectHelper = (moduleImport === null) ?
                ts.createIdentifier(symbol) :
                ts.createPropertyAccess(ts.createIdentifier(moduleImport), ts.createIdentifier(symbol));
            // Generate the call in the form:
            // `$localize(__makeTemplateObject(cookedMessageParts, rawMessageParts), ...expressions);`
            var cookedLiterals = messageParts.map(function (messagePart, i) {
                return _this.createLiteral(messagePart.cooked, ast.getMessagePartSourceSpan(i));
            });
            var rawLiterals = messageParts.map(function (messagePart, i) { return _this.createLiteral(messagePart.raw, ast.getMessagePartSourceSpan(i)); });
            return ts.createCall(
            /* expression */ ts.createIdentifier('$localize'), 
            /* typeArguments */ undefined, tslib_1.__spread([
                ts.createCall(
                /* expression */ __makeTemplateObjectHelper, 
                /* typeArguments */ undefined, 
                /* argumentsArray */
                [
                    ts.createArrayLiteral(cookedLiterals),
                    ts.createArrayLiteral(rawLiterals),
                ])
            ], expressions));
        };
        ExpressionTranslatorVisitor.prototype.setSourceMapRange = function (expr, sourceSpan) {
            if (sourceSpan) {
                var start = sourceSpan.start, end = sourceSpan.end;
                var _a = start.file, url = _a.url, content = _a.content;
                if (url) {
                    if (!this.externalSourceFiles.has(url)) {
                        this.externalSourceFiles.set(url, ts.createSourceMapSource(url, content, function (pos) { return pos; }));
                    }
                    var source = this.externalSourceFiles.get(url);
                    ts.setSourceMapRange(expr, { pos: start.offset, end: end.offset, source: source });
                }
            }
        };
        ExpressionTranslatorVisitor.prototype.createLiteral = function (text, span) {
            var literal = ts.createStringLiteral(text);
            this.setSourceMapRange(literal, span);
            return literal;
        };
        return ExpressionTranslatorVisitor;
    }());
    var TypeTranslatorVisitor = /** @class */ (function () {
        function TypeTranslatorVisitor(imports) {
            this.imports = imports;
        }
        TypeTranslatorVisitor.prototype.visitBuiltinType = function (type, context) {
            switch (type.name) {
                case compiler_1.BuiltinTypeName.Bool:
                    return ts.createKeywordTypeNode(ts.SyntaxKind.BooleanKeyword);
                case compiler_1.BuiltinTypeName.Dynamic:
                    return ts.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
                case compiler_1.BuiltinTypeName.Int:
                case compiler_1.BuiltinTypeName.Number:
                    return ts.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
                case compiler_1.BuiltinTypeName.String:
                    return ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
                case compiler_1.BuiltinTypeName.None:
                    return ts.createKeywordTypeNode(ts.SyntaxKind.NeverKeyword);
                default:
                    throw new Error("Unsupported builtin type: " + compiler_1.BuiltinTypeName[type.name]);
            }
        };
        TypeTranslatorVisitor.prototype.visitExpressionType = function (type, context) {
            var _this = this;
            var typeNode = this.translateExpression(type.value, context);
            if (type.typeParams === null) {
                return typeNode;
            }
            if (!ts.isTypeReferenceNode(typeNode)) {
                throw new Error('An ExpressionType with type arguments must translate into a TypeReferenceNode');
            }
            else if (typeNode.typeArguments !== undefined) {
                throw new Error("An ExpressionType with type arguments cannot have multiple levels of type arguments");
            }
            var typeArgs = type.typeParams.map(function (param) { return _this.translateType(param, context); });
            return ts.createTypeReferenceNode(typeNode.typeName, typeArgs);
        };
        TypeTranslatorVisitor.prototype.visitArrayType = function (type, context) {
            return ts.createArrayTypeNode(this.translateType(type.of, context));
        };
        TypeTranslatorVisitor.prototype.visitMapType = function (type, context) {
            var parameter = ts.createParameter(undefined, undefined, undefined, 'key', undefined, ts.createKeywordTypeNode(ts.SyntaxKind.StringKeyword));
            var typeArgs = type.valueType !== null ?
                this.translateType(type.valueType, context) :
                ts.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword);
            var indexSignature = ts.createIndexSignature(undefined, undefined, [parameter], typeArgs);
            return ts.createTypeLiteralNode([indexSignature]);
        };
        TypeTranslatorVisitor.prototype.visitReadVarExpr = function (ast, context) {
            if (ast.name === null) {
                throw new Error("ReadVarExpr with no variable name in type");
            }
            return ts.createTypeQueryNode(ts.createIdentifier(ast.name));
        };
        TypeTranslatorVisitor.prototype.visitWriteVarExpr = function (expr, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitWriteKeyExpr = function (expr, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitWritePropExpr = function (expr, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitInvokeMethodExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitInvokeFunctionExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitInstantiateExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitLiteralExpr = function (ast, context) {
            if (ast.value === null) {
                // TODO(alan-agius4): Remove when we no longer support TS 3.9
                // Use: return ts.createLiteralTypeNode(ts.createNull()) directly.
                return ts.versionMajorMinor.charAt(0) === '4' ?
                    ts.createLiteralTypeNode(ts.createNull()) :
                    ts.createKeywordTypeNode(ts.SyntaxKind.NullKeyword);
            }
            else if (ast.value === undefined) {
                return ts.createKeywordTypeNode(ts.SyntaxKind.UndefinedKeyword);
            }
            else if (typeof ast.value === 'boolean') {
                return ts.createLiteralTypeNode(ts.createLiteral(ast.value));
            }
            else if (typeof ast.value === 'number') {
                return ts.createLiteralTypeNode(ts.createLiteral(ast.value));
            }
            else {
                return ts.createLiteralTypeNode(ts.createLiteral(ast.value));
            }
        };
        TypeTranslatorVisitor.prototype.visitLocalizedString = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitExternalExpr = function (ast, context) {
            var _this = this;
            if (ast.value.moduleName === null || ast.value.name === null) {
                throw new Error("Import unknown module or symbol");
            }
            var _a = this.imports.generateNamedImport(ast.value.moduleName, ast.value.name), moduleImport = _a.moduleImport, symbol = _a.symbol;
            var symbolIdentifier = ts.createIdentifier(symbol);
            var typeName = moduleImport ?
                ts.createQualifiedName(ts.createIdentifier(moduleImport), symbolIdentifier) :
                symbolIdentifier;
            var typeArguments = ast.typeParams !== null ?
                ast.typeParams.map(function (type) { return _this.translateType(type, context); }) :
                undefined;
            return ts.createTypeReferenceNode(typeName, typeArguments);
        };
        TypeTranslatorVisitor.prototype.visitConditionalExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitNotExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitAssertNotNullExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitCastExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitFunctionExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitUnaryOperatorExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitBinaryOperatorExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitReadPropExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitReadKeyExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitLiteralArrayExpr = function (ast, context) {
            var _this = this;
            var values = ast.entries.map(function (expr) { return _this.translateExpression(expr, context); });
            return ts.createTupleTypeNode(values);
        };
        TypeTranslatorVisitor.prototype.visitLiteralMapExpr = function (ast, context) {
            var _this = this;
            var entries = ast.entries.map(function (entry) {
                var key = entry.key, quoted = entry.quoted;
                var type = _this.translateExpression(entry.value, context);
                return ts.createPropertySignature(
                /* modifiers */ undefined, 
                /* name */ quoted ? ts.createStringLiteral(key) : key, 
                /* questionToken */ undefined, 
                /* type */ type, 
                /* initializer */ undefined);
            });
            return ts.createTypeLiteralNode(entries);
        };
        TypeTranslatorVisitor.prototype.visitCommaExpr = function (ast, context) {
            throw new Error('Method not implemented.');
        };
        TypeTranslatorVisitor.prototype.visitWrappedNodeExpr = function (ast, context) {
            var node = ast.node;
            if (ts.isEntityName(node)) {
                return ts.createTypeReferenceNode(node, /* typeArguments */ undefined);
            }
            else if (ts.isTypeNode(node)) {
                return node;
            }
            else if (ts.isLiteralExpression(node)) {
                return ts.createLiteralTypeNode(node);
            }
            else {
                throw new Error("Unsupported WrappedNodeExpr in TypeTranslatorVisitor: " + ts.SyntaxKind[node.kind]);
            }
        };
        TypeTranslatorVisitor.prototype.visitTypeofExpr = function (ast, context) {
            var expr = translateExpression(ast.expr, this.imports, imports_1.NOOP_DEFAULT_IMPORT_RECORDER, ts.ScriptTarget.ES2015);
            return ts.createTypeQueryNode(expr);
        };
        TypeTranslatorVisitor.prototype.translateType = function (type, context) {
            var typeNode = type.visitType(this, context);
            if (!ts.isTypeNode(typeNode)) {
                throw new Error("A Type must translate to a TypeNode, but was " + ts.SyntaxKind[typeNode.kind]);
            }
            return typeNode;
        };
        TypeTranslatorVisitor.prototype.translateExpression = function (expr, context) {
            var typeNode = expr.visitExpression(this, context);
            if (!ts.isTypeNode(typeNode)) {
                throw new Error("An Expression must translate to a TypeNode, but was " + ts.SyntaxKind[typeNode.kind]);
            }
            return typeNode;
        };
        return TypeTranslatorVisitor;
    }());
    exports.TypeTranslatorVisitor = TypeTranslatorVisitor;
    // HACK: Use this in place of `ts.createTemplateMiddle()`.
    // Revert once https://github.com/microsoft/TypeScript/issues/35374 is fixed
    function createTemplateMiddle(cooked, raw) {
        var node = ts.createTemplateHead(cooked, raw);
        node.kind = ts.SyntaxKind.TemplateMiddle;
        return node;
    }
    // HACK: Use this in place of `ts.createTemplateTail()`.
    // Revert once https://github.com/microsoft/TypeScript/issues/35374 is fixed
    function createTemplateTail(cooked, raw) {
        var node = ts.createTemplateHead(cooked, raw);
        node.kind = ts.SyntaxKind.TemplateTail;
        return node;
    }
    /**
     * Attach the given `leadingComments` to the `statement` node.
     *
     * @param statement The statement that will have comments attached.
     * @param leadingComments The comments to attach to the statement.
     */
    function attachComments(statement, leadingComments) {
        var e_1, _a, e_2, _b;
        if (leadingComments === undefined) {
            return statement;
        }
        try {
            for (var leadingComments_1 = tslib_1.__values(leadingComments), leadingComments_1_1 = leadingComments_1.next(); !leadingComments_1_1.done; leadingComments_1_1 = leadingComments_1.next()) {
                var comment = leadingComments_1_1.value;
                var commentKind = comment.multiline ? ts.SyntaxKind.MultiLineCommentTrivia :
                    ts.SyntaxKind.SingleLineCommentTrivia;
                if (comment.multiline) {
                    ts.addSyntheticLeadingComment(statement, commentKind, comment.toString(), comment.trailingNewline);
                }
                else {
                    try {
                        for (var _c = (e_2 = void 0, tslib_1.__values(comment.text.split('\n'))), _d = _c.next(); !_d.done; _d = _c.next()) {
                            var line = _d.value;
                            ts.addSyntheticLeadingComment(statement, commentKind, line, comment.trailingNewline);
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (leadingComments_1_1 && !leadingComments_1_1.done && (_a = leadingComments_1.return)) _a.call(leadingComments_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return statement;
    }
    exports.attachComments = attachComments;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNsYXRvci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvdHJhbnNsYXRvci9zcmMvdHJhbnNsYXRvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7O0lBRUgsOENBQTRxQjtJQUM1cUIsc0VBQTBHO0lBQzFHLCtCQUFpQztJQUVqQyxtRUFBc0g7SUFFdEg7UUFDRSxpQkFBcUIsV0FBb0I7WUFBcEIsZ0JBQVcsR0FBWCxXQUFXLENBQVM7UUFBRyxDQUFDO1FBRTdDLHNCQUFJLHVDQUFrQjtpQkFBdEI7Z0JBQ0UsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ3RELENBQUM7OztXQUFBO1FBRUQsc0JBQUksc0NBQWlCO2lCQUFyQjtnQkFDRSxPQUFPLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUN0RCxDQUFDOzs7V0FBQTtRQUNILGNBQUM7SUFBRCxDQUFDLEFBVkQsSUFVQztJQVZZLDBCQUFPO0lBWXBCLElBQU0sZUFBZSxHQUFHLElBQUksR0FBRyxDQUF3QztRQUNyRSxDQUFDLDBCQUFhLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDO1FBQy9DLENBQUMsMEJBQWEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUM7S0FDOUMsQ0FBQyxDQUFDO0lBRUgsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsQ0FBb0M7UUFDbEUsQ0FBQyx5QkFBYyxDQUFDLEdBQUcsRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFD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QUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxDQUFDO3lCQUN0Rjs7Ozs7Ozs7O2lCQUNGO2FBQ0Y7Ozs7Ozs7OztRQUNELE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7SUFuQkQsd0NBbUJDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7QXJyYXlUeXBlLCBBc3NlcnROb3ROdWxsLCBCaW5hcnlPcGVyYXRvciwgQmluYXJ5T3BlcmF0b3JFeHByLCBCdWlsdGluVHlwZSwgQnVpbHRpblR5cGVOYW1lLCBDYXN0RXhwciwgQ2xhc3NTdG10LCBDb21tYUV4cHIsIENvbmRpdGlvbmFsRXhwciwgRGVjbGFyZUZ1bmN0aW9uU3RtdCwgRGVjbGFyZVZhclN0bXQsIEV4cHJlc3Npb24sIEV4cHJlc3Npb25TdGF0ZW1lbnQsIEV4cHJlc3Npb25UeXBlLCBFeHByZXNzaW9uVmlzaXRvciwgRXh0ZXJuYWxFeHByLCBGdW5jdGlvbkV4cHIsIElmU3RtdCwgSW5zdGFudGlhdGVFeHByLCBJbnZva2VGdW5jdGlvbkV4cHIsIEludm9rZU1ldGhvZEV4cHIsIExlYWRpbmdDb21tZW50LCBMaXRlcmFsQXJyYXlFeHByLCBMaXRlcmFsRXhwciwgTGl0ZXJhbE1hcEV4cHIsIE1hcFR5cGUsIE5vdEV4cHIsIFBhcnNlU291cmNlU3BhbiwgUmVhZEtleUV4cHIsIFJlYWRQcm9wRXhwciwgUmVhZFZhckV4cHIsIFJldHVyblN0YXRlbWVudCwgU3RhdGVtZW50LCBTdGF0ZW1lbnRWaXNpdG9yLCBTdG10TW9kaWZpZXIsIFRocm93U3RtdCwgVHJ5Q2F0Y2hTdG10LCBUeXBlLCBUeXBlb2ZFeHByLCBUeXBlVmlzaXRvciwgV3JhcHBlZE5vZGVFeHByLCBXcml0ZUtleUV4cHIsIFdyaXRlUHJvcEV4cHIsIFdyaXRlVmFyRXhwcn0gZnJvbSAnQGFuZ3VsYXIvY29tcGlsZXInO1xuaW1wb3J0IHtMb2NhbGl6ZWRTdHJpbmcsIFVuYXJ5T3BlcmF0b3IsIFVuYXJ5T3BlcmF0b3JFeHByfSBmcm9tICdAYW5ndWxhci9jb21waWxlci9zcmMvb3V0cHV0L291dHB1dF9hc3QnO1xuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7RGVmYXVsdEltcG9ydFJlY29yZGVyLCBJbXBvcnRSZXdyaXRlciwgTk9PUF9ERUZBVUxUX0lNUE9SVF9SRUNPUkRFUiwgTm9vcEltcG9ydFJld3JpdGVyfSBmcm9tICcuLi8uLi9pbXBvcnRzJztcblxuZXhwb3J0IGNsYXNzIENvbnRleHQge1xuICBjb25zdHJ1Y3RvcihyZWFkb25seSBpc1N0YXRlbWVudDogYm9vbGVhbikge31cblxuICBnZXQgd2l0aEV4cHJlc3Npb25Nb2RlKCk6IENvbnRleHQge1xuICAgIHJldHVybiB0aGlzLmlzU3RhdGVtZW50ID8gbmV3IENvbnRleHQoZmFsc2UpIDogdGhpcztcbiAgfVxuXG4gIGdldCB3aXRoU3RhdGVtZW50TW9kZSgpOiBDb250ZXh0IHtcbiAgICByZXR1cm4gIXRoaXMuaXNTdGF0ZW1lbnQgPyBuZXcgQ29udGV4dCh0cnVlKSA6IHRoaXM7XG4gIH1cbn1cblxuY29uc3QgVU5BUllfT1BFUkFUT1JTID0gbmV3IE1hcDxVbmFyeU9wZXJhdG9yLCB0cy5QcmVmaXhVbmFyeU9wZXJhdG9yPihbXG4gIFtVbmFyeU9wZXJhdG9yLk1pbnVzLCB0cy5TeW50YXhLaW5kLk1pbnVzVG9rZW5dLFxuICBbVW5hcnlPcGVyYXRvci5QbHVzLCB0cy5TeW50YXhLaW5kLlBsdXNUb2tlbl0sXG5dKTtcblxuY29uc3QgQklOQVJZX09QRVJBVE9SUyA9IG5ldyBNYXA8QmluYXJ5T3BlcmF0b3IsIHRzLkJpbmFyeU9wZXJhdG9yPihbXG4gIFtCaW5hcnlPcGVyYXRvci5BbmQsIHRzLlN5bnRheEtpbmQuQW1wZXJzYW5kQW1wZXJzYW5kVG9rZW5dLFxuICBbQmluYXJ5T3BlcmF0b3IuQmlnZ2VyLCB0cy5TeW50YXhLaW5kLkdyZWF0ZXJUaGFuVG9rZW5dLFxuICBbQmluYXJ5T3BlcmF0b3IuQmlnZ2VyRXF1YWxzLCB0cy5TeW50YXhLaW5kLkdyZWF0ZXJUaGFuRXF1YWxzVG9rZW5dLFxuICBbQmluYXJ5T3BlcmF0b3IuQml0d2lzZUFuZCwgdHMuU3ludGF4S2luZC5BbXBlcnNhbmRUb2tlbl0sXG4gIFtCaW5hcnlPcGVyYXRvci5EaXZpZGUsIHRzLlN5bnRheEtpbmQuU2xhc2hUb2tlbl0sXG4gIFtCaW5hcnlPcGVyYXRvci5FcXVhbHMsIHRzLlN5bnRheEtpbmQuRXF1YWxzRXF1YWxzVG9rZW5dLFxuICBbQmluYXJ5T3BlcmF0b3IuSWRlbnRpY2FsLCB0cy5TeW50YXhLaW5kLkVxdWFsc0VxdWFsc0VxdWFsc1Rva2VuXSxcbiAgW0JpbmFyeU9wZXJhdG9yLkxvd2VyLCB0cy5TeW50YXhLaW5kLkxlc3NUaGFuVG9rZW5dLFxuICBbQmluYXJ5T3BlcmF0b3IuTG93ZXJFcXVhbHMsIHRzLlN5bnRheEtpbmQuTGVzc1RoYW5FcXVhbHNUb2tlbl0sXG4gIFtCaW5hcnlPcGVyYXRvci5NaW51cywgdHMuU3ludGF4S2luZC5NaW51c1Rva2VuXSxcbiAgW0JpbmFyeU9wZXJhdG9yLk1vZHVsbywgdHMuU3ludGF4S2luZC5QZXJjZW50VG9rZW5dLFxuICBbQmluYXJ5T3BlcmF0b3IuTXVsdGlwbHksIHRzLlN5bnRheEtpbmQuQXN0ZXJpc2tUb2tlbl0sXG4gIFtCaW5hcnlPcGVyYXRvci5Ob3RFcXVhbHMsIHRzLlN5bnRheEtpbmQuRXhjbGFtYXRpb25FcXVhbHNUb2tlbl0sXG4gIFtCaW5hcnlPcGVyYXRvci5Ob3RJZGVudGljYWwsIHRzLlN5bnRheEtpbmQuRXhjbGFtYXRpb25FcXVhbHNFcXVhbHNUb2tlbl0sXG4gIFtCaW5hcnlPcGVyYXRvci5PciwgdHMuU3ludGF4S2luZC5CYXJCYXJUb2tlbl0sXG4gIFtCaW5hcnlPcGVyYXRvci5QbHVzLCB0cy5TeW50YXhLaW5kLlBsdXNUb2tlbl0sXG5dKTtcblxuLyoqXG4gKiBJbmZvcm1hdGlvbiBhYm91dCBhbiBpbXBvcnQgdGhhdCBoYXMgYmVlbiBhZGRlZCB0byBhIG1vZHVsZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJbXBvcnQge1xuICAvKiogVGhlIG5hbWUgb2YgdGhlIG1vZHVsZSB0aGF0IGhhcyBiZWVuIGltcG9ydGVkLiAqL1xuICBzcGVjaWZpZXI6IHN0cmluZztcbiAgLyoqIFRoZSBhbGlhcyBvZiB0aGUgaW1wb3J0ZWQgbW9kdWxlLiAqL1xuICBxdWFsaWZpZXI6IHN0cmluZztcbn1cblxuLyoqXG4gKiBUaGUgc3ltYm9sIG5hbWUgYW5kIGltcG9ydCBuYW1lc3BhY2Ugb2YgYW4gaW1wb3J0ZWQgc3ltYm9sLFxuICogd2hpY2ggaGFzIGJlZW4gcmVnaXN0ZXJlZCB0aHJvdWdoIHRoZSBJbXBvcnRNYW5hZ2VyLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIE5hbWVkSW1wb3J0IHtcbiAgLyoqIFRoZSBpbXBvcnQgbmFtZXNwYWNlIGNvbnRhaW5pbmcgdGhpcyBpbXBvcnRlZCBzeW1ib2wuICovXG4gIG1vZHVsZUltcG9ydDogc3RyaW5nfG51bGw7XG4gIC8qKiBUaGUgKHBvc3NpYmx5IHJld3JpdHRlbikgbmFtZSBvZiB0aGUgaW1wb3J0ZWQgc3ltYm9sLiAqL1xuICBzeW1ib2w6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEltcG9ydE1hbmFnZXIge1xuICBwcml2YXRlIHNwZWNpZmllclRvSWRlbnRpZmllciA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG4gIHByaXZhdGUgbmV4dEluZGV4ID0gMDtcblxuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgcmV3cml0ZXI6IEltcG9ydFJld3JpdGVyID0gbmV3IE5vb3BJbXBvcnRSZXdyaXRlcigpLCBwcml2YXRlIHByZWZpeCA9ICdpJykge1xuICB9XG5cbiAgZ2VuZXJhdGVOYW1lZEltcG9ydChtb2R1bGVOYW1lOiBzdHJpbmcsIG9yaWdpbmFsU3ltYm9sOiBzdHJpbmcpOiBOYW1lZEltcG9ydCB7XG4gICAgLy8gRmlyc3QsIHJld3JpdGUgdGhlIHN5bWJvbCBuYW1lLlxuICAgIGNvbnN0IHN5bWJvbCA9IHRoaXMucmV3cml0ZXIucmV3cml0ZVN5bWJvbChvcmlnaW5hbFN5bWJvbCwgbW9kdWxlTmFtZSk7XG5cbiAgICAvLyBBc2sgdGhlIHJld3JpdGVyIGlmIHRoaXMgc3ltYm9sIHNob3VsZCBiZSBpbXBvcnRlZCBhdCBhbGwuIElmIG5vdCwgaXQgY2FuIGJlIHJlZmVyZW5jZWRcbiAgICAvLyBkaXJlY3RseSAobW9kdWxlSW1wb3J0OiBudWxsKS5cbiAgICBpZiAoIXRoaXMucmV3cml0ZXIuc2hvdWxkSW1wb3J0U3ltYm9sKHN5bWJvbCwgbW9kdWxlTmFtZSkpIHtcbiAgICAgIC8vIFRoZSBzeW1ib2wgc2hvdWxkIGJlIHJlZmVyZW5jZWQgZGlyZWN0bHkuXG4gICAgICByZXR1cm4ge21vZHVsZUltcG9ydDogbnVsbCwgc3ltYm9sfTtcbiAgICB9XG5cbiAgICAvLyBJZiBub3QsIHRoaXMgc3ltYm9sIHdpbGwgYmUgaW1wb3J0ZWQuIEFsbG9jYXRlIGEgcHJlZml4IGZvciB0aGUgaW1wb3J0ZWQgbW9kdWxlIGlmIG5lZWRlZC5cblxuICAgIGlmICghdGhpcy5zcGVjaWZpZXJUb0lkZW50aWZpZXIuaGFzKG1vZHVsZU5hbWUpKSB7XG4gICAgICB0aGlzLnNwZWNpZmllclRvSWRlbnRpZmllci5zZXQobW9kdWxlTmFtZSwgYCR7dGhpcy5wcmVmaXh9JHt0aGlzLm5leHRJbmRleCsrfWApO1xuICAgIH1cbiAgICBjb25zdCBtb2R1bGVJbXBvcnQgPSB0aGlzLnNwZWNpZmllclRvSWRlbnRpZmllci5nZXQobW9kdWxlTmFtZSkhO1xuXG4gICAgcmV0dXJuIHttb2R1bGVJbXBvcnQsIHN5bWJvbH07XG4gIH1cblxuICBnZXRBbGxJbXBvcnRzKGNvbnRleHRQYXRoOiBzdHJpbmcpOiBJbXBvcnRbXSB7XG4gICAgY29uc3QgaW1wb3J0czoge3NwZWNpZmllcjogc3RyaW5nLCBxdWFsaWZpZXI6IHN0cmluZ31bXSA9IFtdO1xuICAgIHRoaXMuc3BlY2lmaWVyVG9JZGVudGlmaWVyLmZvckVhY2goKHF1YWxpZmllciwgc3BlY2lmaWVyKSA9PiB7XG4gICAgICBzcGVjaWZpZXIgPSB0aGlzLnJld3JpdGVyLnJld3JpdGVTcGVjaWZpZXIoc3BlY2lmaWVyLCBjb250ZXh0UGF0aCk7XG4gICAgICBpbXBvcnRzLnB1c2goe3NwZWNpZmllciwgcXVhbGlmaWVyfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGltcG9ydHM7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zbGF0ZUV4cHJlc3Npb24oXG4gICAgZXhwcmVzc2lvbjogRXhwcmVzc2lvbiwgaW1wb3J0czogSW1wb3J0TWFuYWdlciwgZGVmYXVsdEltcG9ydFJlY29yZGVyOiBEZWZhdWx0SW1wb3J0UmVjb3JkZXIsXG4gICAgc2NyaXB0VGFyZ2V0OiBFeGNsdWRlPHRzLlNjcmlwdFRhcmdldCwgdHMuU2NyaXB0VGFyZ2V0LkpTT04+KTogdHMuRXhwcmVzc2lvbiB7XG4gIHJldHVybiBleHByZXNzaW9uLnZpc2l0RXhwcmVzc2lvbihcbiAgICAgIG5ldyBFeHByZXNzaW9uVHJhbnNsYXRvclZpc2l0b3IoaW1wb3J0cywgZGVmYXVsdEltcG9ydFJlY29yZGVyLCBzY3JpcHRUYXJnZXQpLFxuICAgICAgbmV3IENvbnRleHQoZmFsc2UpKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zbGF0ZVN0YXRlbWVudChcbiAgICBzdGF0ZW1lbnQ6IFN0YXRlbWVudCwgaW1wb3J0czogSW1wb3J0TWFuYWdlciwgZGVmYXVsdEltcG9ydFJlY29yZGVyOiBEZWZhdWx0SW1wb3J0UmVjb3JkZXIsXG4gICAgc2NyaXB0VGFyZ2V0OiBFeGNsdWRlPHRzLlNjcmlwdFRhcmdldCwgdHMuU2NyaXB0VGFyZ2V0LkpTT04+KTogdHMuU3RhdGVtZW50IHtcbiAgcmV0dXJuIHN0YXRlbWVudC52aXNpdFN0YXRlbWVudChcbiAgICAgIG5ldyBFeHByZXNzaW9uVHJhbnNsYXRvclZpc2l0b3IoaW1wb3J0cywgZGVmYXVsdEltcG9ydFJlY29yZGVyLCBzY3JpcHRUYXJnZXQpLFxuICAgICAgbmV3IENvbnRleHQodHJ1ZSkpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNsYXRlVHlwZSh0eXBlOiBUeXBlLCBpbXBvcnRzOiBJbXBvcnRNYW5hZ2VyKTogdHMuVHlwZU5vZGUge1xuICByZXR1cm4gdHlwZS52aXNpdFR5cGUobmV3IFR5cGVUcmFuc2xhdG9yVmlzaXRvcihpbXBvcnRzKSwgbmV3IENvbnRleHQoZmFsc2UpKTtcbn1cblxuY2xhc3MgRXhwcmVzc2lvblRyYW5zbGF0b3JWaXNpdG9yIGltcGxlbWVudHMgRXhwcmVzc2lvblZpc2l0b3IsIFN0YXRlbWVudFZpc2l0b3Ige1xuICBwcml2YXRlIGV4dGVybmFsU291cmNlRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgdHMuU291cmNlTWFwU291cmNlPigpO1xuICBjb25zdHJ1Y3RvcihcbiAgICAgIHByaXZhdGUgaW1wb3J0czogSW1wb3J0TWFuYWdlciwgcHJpdmF0ZSBkZWZhdWx0SW1wb3J0UmVjb3JkZXI6IERlZmF1bHRJbXBvcnRSZWNvcmRlcixcbiAgICAgIHByaXZhdGUgc2NyaXB0VGFyZ2V0OiBFeGNsdWRlPHRzLlNjcmlwdFRhcmdldCwgdHMuU2NyaXB0VGFyZ2V0LkpTT04+KSB7fVxuXG4gIHZpc2l0RGVjbGFyZVZhclN0bXQoc3RtdDogRGVjbGFyZVZhclN0bXQsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5WYXJpYWJsZVN0YXRlbWVudCB7XG4gICAgY29uc3QgaXNDb25zdCA9XG4gICAgICAgIHRoaXMuc2NyaXB0VGFyZ2V0ID49IHRzLlNjcmlwdFRhcmdldC5FUzIwMTUgJiYgc3RtdC5oYXNNb2RpZmllcihTdG10TW9kaWZpZXIuRmluYWwpO1xuICAgIGNvbnN0IHZhckRlY2xhcmF0aW9uID0gdHMuY3JlYXRlVmFyaWFibGVEZWNsYXJhdGlvbihcbiAgICAgICAgLyogbmFtZSAqLyBzdG10Lm5hbWUsXG4gICAgICAgIC8qIHR5cGUgKi8gdW5kZWZpbmVkLFxuICAgICAgICAvKiBpbml0aWFsaXplciAqLyBzdG10LnZhbHVlPy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dC53aXRoRXhwcmVzc2lvbk1vZGUpKTtcbiAgICBjb25zdCBkZWNsYXJhdGlvbkxpc3QgPSB0cy5jcmVhdGVWYXJpYWJsZURlY2xhcmF0aW9uTGlzdChcbiAgICAgICAgLyogZGVjbGFyYXRpb25zICovW3ZhckRlY2xhcmF0aW9uXSxcbiAgICAgICAgLyogZmxhZ3MgKi8gaXNDb25zdCA/IHRzLk5vZGVGbGFncy5Db25zdCA6IHRzLk5vZGVGbGFncy5Ob25lKTtcbiAgICBjb25zdCB2YXJTdGF0ZW1lbnQgPSB0cy5jcmVhdGVWYXJpYWJsZVN0YXRlbWVudCh1bmRlZmluZWQsIGRlY2xhcmF0aW9uTGlzdCk7XG4gICAgcmV0dXJuIGF0dGFjaENvbW1lbnRzKHZhclN0YXRlbWVudCwgc3RtdC5sZWFkaW5nQ29tbWVudHMpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlRnVuY3Rpb25TdG10KHN0bXQ6IERlY2xhcmVGdW5jdGlvblN0bXQsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5GdW5jdGlvbkRlY2xhcmF0aW9uIHtcbiAgICBjb25zdCBmbkRlY2xhcmF0aW9uID0gdHMuY3JlYXRlRnVuY3Rpb25EZWNsYXJhdGlvbihcbiAgICAgICAgLyogZGVjb3JhdG9ycyAqLyB1bmRlZmluZWQsXG4gICAgICAgIC8qIG1vZGlmaWVycyAqLyB1bmRlZmluZWQsXG4gICAgICAgIC8qIGFzdGVyaXNrICovIHVuZGVmaW5lZCxcbiAgICAgICAgLyogbmFtZSAqLyBzdG10Lm5hbWUsXG4gICAgICAgIC8qIHR5cGVQYXJhbWV0ZXJzICovIHVuZGVmaW5lZCxcbiAgICAgICAgLyogcGFyYW1ldGVycyAqL1xuICAgICAgICBzdG10LnBhcmFtcy5tYXAocGFyYW0gPT4gdHMuY3JlYXRlUGFyYW1ldGVyKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHBhcmFtLm5hbWUpKSxcbiAgICAgICAgLyogdHlwZSAqLyB1bmRlZmluZWQsXG4gICAgICAgIC8qIGJvZHkgKi9cbiAgICAgICAgdHMuY3JlYXRlQmxvY2soXG4gICAgICAgICAgICBzdG10LnN0YXRlbWVudHMubWFwKGNoaWxkID0+IGNoaWxkLnZpc2l0U3RhdGVtZW50KHRoaXMsIGNvbnRleHQud2l0aFN0YXRlbWVudE1vZGUpKSkpO1xuICAgIHJldHVybiBhdHRhY2hDb21tZW50cyhmbkRlY2xhcmF0aW9uLCBzdG10LmxlYWRpbmdDb21tZW50cyk7XG4gIH1cblxuICB2aXNpdEV4cHJlc3Npb25TdG10KHN0bXQ6IEV4cHJlc3Npb25TdGF0ZW1lbnQsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5FeHByZXNzaW9uU3RhdGVtZW50IHtcbiAgICByZXR1cm4gYXR0YWNoQ29tbWVudHMoXG4gICAgICAgIHRzLmNyZWF0ZVN0YXRlbWVudChzdG10LmV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQud2l0aFN0YXRlbWVudE1vZGUpKSxcbiAgICAgICAgc3RtdC5sZWFkaW5nQ29tbWVudHMpO1xuICB9XG5cbiAgdmlzaXRSZXR1cm5TdG10KHN0bXQ6IFJldHVyblN0YXRlbWVudCwgY29udGV4dDogQ29udGV4dCk6IHRzLlJldHVyblN0YXRlbWVudCB7XG4gICAgcmV0dXJuIGF0dGFjaENvbW1lbnRzKFxuICAgICAgICB0cy5jcmVhdGVSZXR1cm4oc3RtdC52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dC53aXRoRXhwcmVzc2lvbk1vZGUpKSxcbiAgICAgICAgc3RtdC5sZWFkaW5nQ29tbWVudHMpO1xuICB9XG5cbiAgdmlzaXREZWNsYXJlQ2xhc3NTdG10KHN0bXQ6IENsYXNzU3RtdCwgY29udGV4dDogQ29udGV4dCkge1xuICAgIGlmICh0aGlzLnNjcmlwdFRhcmdldCA8IHRzLlNjcmlwdFRhcmdldC5FUzIwMTUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVW5zdXBwb3J0ZWQgbW9kZTogVmlzaXRpbmcgYSBcImRlY2xhcmUgY2xhc3NcIiBzdGF0ZW1lbnQgKGNsYXNzICR7c3RtdC5uYW1lfSkgd2hpbGUgYCArXG4gICAgICAgICAgYHRhcmdldGluZyAke3RzLlNjcmlwdFRhcmdldFt0aGlzLnNjcmlwdFRhcmdldF19LmApO1xuICAgIH1cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICB2aXNpdElmU3RtdChzdG10OiBJZlN0bXQsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5JZlN0YXRlbWVudCB7XG4gICAgY29uc3QgdGhlbkJsb2NrID0gdHMuY3JlYXRlQmxvY2soXG4gICAgICAgIHN0bXQudHJ1ZUNhc2UubWFwKGNoaWxkID0+IGNoaWxkLnZpc2l0U3RhdGVtZW50KHRoaXMsIGNvbnRleHQud2l0aFN0YXRlbWVudE1vZGUpKSk7XG4gICAgY29uc3QgZWxzZUJsb2NrID0gc3RtdC5mYWxzZUNhc2UubGVuZ3RoID4gMCA/XG4gICAgICAgIHRzLmNyZWF0ZUJsb2NrKFxuICAgICAgICAgICAgc3RtdC5mYWxzZUNhc2UubWFwKGNoaWxkID0+IGNoaWxkLnZpc2l0U3RhdGVtZW50KHRoaXMsIGNvbnRleHQud2l0aFN0YXRlbWVudE1vZGUpKSkgOlxuICAgICAgICB1bmRlZmluZWQ7XG4gICAgY29uc3QgaWZTdGF0ZW1lbnQgPVxuICAgICAgICB0cy5jcmVhdGVJZihzdG10LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIHRoZW5CbG9jaywgZWxzZUJsb2NrKTtcbiAgICByZXR1cm4gYXR0YWNoQ29tbWVudHMoaWZTdGF0ZW1lbnQsIHN0bXQubGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuXG4gIHZpc2l0VHJ5Q2F0Y2hTdG10KHN0bXQ6IFRyeUNhdGNoU3RtdCwgY29udGV4dDogQ29udGV4dCkge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0VGhyb3dTdG10KHN0bXQ6IFRocm93U3RtdCwgY29udGV4dDogQ29udGV4dCk6IHRzLlRocm93U3RhdGVtZW50IHtcbiAgICByZXR1cm4gYXR0YWNoQ29tbWVudHMoXG4gICAgICAgIHRzLmNyZWF0ZVRocm93KHN0bXQuZXJyb3IudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQud2l0aEV4cHJlc3Npb25Nb2RlKSksXG4gICAgICAgIHN0bXQubGVhZGluZ0NvbW1lbnRzKTtcbiAgfVxuXG4gIHZpc2l0UmVhZFZhckV4cHIoYXN0OiBSZWFkVmFyRXhwciwgY29udGV4dDogQ29udGV4dCk6IHRzLklkZW50aWZpZXIge1xuICAgIGNvbnN0IGlkZW50aWZpZXIgPSB0cy5jcmVhdGVJZGVudGlmaWVyKGFzdC5uYW1lISk7XG4gICAgdGhpcy5zZXRTb3VyY2VNYXBSYW5nZShpZGVudGlmaWVyLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGlkZW50aWZpZXI7XG4gIH1cblxuICB2aXNpdFdyaXRlVmFyRXhwcihleHByOiBXcml0ZVZhckV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5FeHByZXNzaW9uIHtcbiAgICBjb25zdCByZXN1bHQ6IHRzLkV4cHJlc3Npb24gPSB0cy5jcmVhdGVCaW5hcnkoXG4gICAgICAgIHRzLmNyZWF0ZUlkZW50aWZpZXIoZXhwci5uYW1lKSwgdHMuU3ludGF4S2luZC5FcXVhbHNUb2tlbixcbiAgICAgICAgZXhwci52YWx1ZS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICAgIHJldHVybiBjb250ZXh0LmlzU3RhdGVtZW50ID8gcmVzdWx0IDogdHMuY3JlYXRlUGFyZW4ocmVzdWx0KTtcbiAgfVxuXG4gIHZpc2l0V3JpdGVLZXlFeHByKGV4cHI6IFdyaXRlS2V5RXhwciwgY29udGV4dDogQ29udGV4dCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGV4cHJDb250ZXh0ID0gY29udGV4dC53aXRoRXhwcmVzc2lvbk1vZGU7XG4gICAgY29uc3QgbGhzID0gdHMuY3JlYXRlRWxlbWVudEFjY2VzcyhcbiAgICAgICAgZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgZXhwckNvbnRleHQpLFxuICAgICAgICBleHByLmluZGV4LnZpc2l0RXhwcmVzc2lvbih0aGlzLCBleHByQ29udGV4dCkpO1xuICAgIGNvbnN0IHJocyA9IGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGV4cHJDb250ZXh0KTtcbiAgICBjb25zdCByZXN1bHQ6IHRzLkV4cHJlc3Npb24gPSB0cy5jcmVhdGVCaW5hcnkobGhzLCB0cy5TeW50YXhLaW5kLkVxdWFsc1Rva2VuLCByaHMpO1xuICAgIHJldHVybiBjb250ZXh0LmlzU3RhdGVtZW50ID8gcmVzdWx0IDogdHMuY3JlYXRlUGFyZW4ocmVzdWx0KTtcbiAgfVxuXG4gIHZpc2l0V3JpdGVQcm9wRXhwcihleHByOiBXcml0ZVByb3BFeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuQmluYXJ5RXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZUJpbmFyeShcbiAgICAgICAgdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MoZXhwci5yZWNlaXZlci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIGV4cHIubmFtZSksXG4gICAgICAgIHRzLlN5bnRheEtpbmQuRXF1YWxzVG9rZW4sIGV4cHIudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0SW52b2tlTWV0aG9kRXhwcihhc3Q6IEludm9rZU1ldGhvZEV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5DYWxsRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgdGFyZ2V0ID0gYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICBjb25zdCBjYWxsID0gdHMuY3JlYXRlQ2FsbChcbiAgICAgICAgYXN0Lm5hbWUgIT09IG51bGwgPyB0cy5jcmVhdGVQcm9wZXJ0eUFjY2Vzcyh0YXJnZXQsIGFzdC5uYW1lKSA6IHRhcmdldCwgdW5kZWZpbmVkLFxuICAgICAgICBhc3QuYXJncy5tYXAoYXJnID0+IGFyZy52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpKTtcbiAgICB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKGNhbGwsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gY2FsbDtcbiAgfVxuXG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKGFzdDogSW52b2tlRnVuY3Rpb25FeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuQ2FsbEV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGV4cHIgPSB0cy5jcmVhdGVDYWxsKFxuICAgICAgICBhc3QuZm4udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCB1bmRlZmluZWQsXG4gICAgICAgIGFzdC5hcmdzLm1hcChhcmcgPT4gYXJnLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSkpO1xuICAgIGlmIChhc3QucHVyZSkge1xuICAgICAgdHMuYWRkU3ludGhldGljTGVhZGluZ0NvbW1lbnQoZXhwciwgdHMuU3ludGF4S2luZC5NdWx0aUxpbmVDb21tZW50VHJpdmlhLCAnQF9fUFVSRV9fJywgZmFsc2UpO1xuICAgIH1cbiAgICB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKGV4cHIsIGFzdC5zb3VyY2VTcGFuKTtcbiAgICByZXR1cm4gZXhwcjtcbiAgfVxuXG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogSW5zdGFudGlhdGVFeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuTmV3RXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZU5ldyhcbiAgICAgICAgYXN0LmNsYXNzRXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCksIHVuZGVmaW5lZCxcbiAgICAgICAgYXN0LmFyZ3MubWFwKGFyZyA9PiBhcmcudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKSk7XG4gIH1cblxuICB2aXNpdExpdGVyYWxFeHByKGFzdDogTGl0ZXJhbEV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5FeHByZXNzaW9uIHtcbiAgICBsZXQgZXhwcjogdHMuRXhwcmVzc2lvbjtcbiAgICBpZiAoYXN0LnZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIGV4cHIgPSB0cy5jcmVhdGVJZGVudGlmaWVyKCd1bmRlZmluZWQnKTtcbiAgICB9IGVsc2UgaWYgKGFzdC52YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgZXhwciA9IHRzLmNyZWF0ZU51bGwoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZXhwciA9IHRzLmNyZWF0ZUxpdGVyYWwoYXN0LnZhbHVlKTtcbiAgICB9XG4gICAgdGhpcy5zZXRTb3VyY2VNYXBSYW5nZShleHByLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cblxuICB2aXNpdExvY2FsaXplZFN0cmluZyhhc3Q6IExvY2FsaXplZFN0cmluZywgY29udGV4dDogQ29udGV4dCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGNvbnN0IGxvY2FsaXplZFN0cmluZyA9IHRoaXMuc2NyaXB0VGFyZ2V0ID49IHRzLlNjcmlwdFRhcmdldC5FUzIwMTUgP1xuICAgICAgICB0aGlzLmNyZWF0ZUxvY2FsaXplZFN0cmluZ1RhZ2dlZFRlbXBsYXRlKGFzdCwgY29udGV4dCkgOlxuICAgICAgICB0aGlzLmNyZWF0ZUxvY2FsaXplZFN0cmluZ0Z1bmN0aW9uQ2FsbChhc3QsIGNvbnRleHQpO1xuICAgIHRoaXMuc2V0U291cmNlTWFwUmFuZ2UobG9jYWxpemVkU3RyaW5nLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGxvY2FsaXplZFN0cmluZztcbiAgfVxuXG4gIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogRXh0ZXJuYWxFeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uXG4gICAgICB8dHMuSWRlbnRpZmllciB7XG4gICAgaWYgKGFzdC52YWx1ZS5uYW1lID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEltcG9ydCB1bmtub3duIG1vZHVsZSBvciBzeW1ib2wgJHthc3QudmFsdWV9YCk7XG4gICAgfVxuICAgIC8vIElmIGEgbW9kdWxlTmFtZSBpcyBzcGVjaWZpZWQsIHRoaXMgaXMgYSBub3JtYWwgaW1wb3J0LiBJZiB0aGVyZSdzIG5vIG1vZHVsZSBuYW1lLCBpdCdzIGFcbiAgICAvLyByZWZlcmVuY2UgdG8gYSBnbG9iYWwvYW1iaWVudCBzeW1ib2wuXG4gICAgaWYgKGFzdC52YWx1ZS5tb2R1bGVOYW1lICE9PSBudWxsKSB7XG4gICAgICAvLyBUaGlzIGlzIGEgbm9ybWFsIGltcG9ydC4gRmluZCB0aGUgaW1wb3J0ZWQgbW9kdWxlLlxuICAgICAgY29uc3Qge21vZHVsZUltcG9ydCwgc3ltYm9sfSA9XG4gICAgICAgICAgdGhpcy5pbXBvcnRzLmdlbmVyYXRlTmFtZWRJbXBvcnQoYXN0LnZhbHVlLm1vZHVsZU5hbWUsIGFzdC52YWx1ZS5uYW1lKTtcbiAgICAgIGlmIChtb2R1bGVJbXBvcnQgPT09IG51bGwpIHtcbiAgICAgICAgLy8gVGhlIHN5bWJvbCB3YXMgYW1iaWVudCBhZnRlciBhbGwuXG4gICAgICAgIHJldHVybiB0cy5jcmVhdGVJZGVudGlmaWVyKHN5bWJvbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MoXG4gICAgICAgICAgICB0cy5jcmVhdGVJZGVudGlmaWVyKG1vZHVsZUltcG9ydCksIHRzLmNyZWF0ZUlkZW50aWZpZXIoc3ltYm9sKSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIFRoZSBzeW1ib2wgaXMgYW1iaWVudCwgc28ganVzdCByZWZlcmVuY2UgaXQuXG4gICAgICByZXR1cm4gdHMuY3JlYXRlSWRlbnRpZmllcihhc3QudmFsdWUubmFtZSk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRDb25kaXRpb25hbEV4cHIoYXN0OiBDb25kaXRpb25hbEV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5Db25kaXRpb25hbEV4cHJlc3Npb24ge1xuICAgIGxldCBjb25kOiB0cy5FeHByZXNzaW9uID0gYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG5cbiAgICAvLyBPcmRpbmFyaWx5IHRoZSB0ZXJuYXJ5IG9wZXJhdG9yIGlzIHJpZ2h0LWFzc29jaWF0aXZlLiBUaGUgZm9sbG93aW5nIGFyZSBlcXVpdmFsZW50OlxuICAgIC8vICAgYGEgPyBiIDogYyA/IGQgOiBlYCA9PiBgYSA/IGIgOiAoYyA/IGQgOiBlKWBcbiAgICAvL1xuICAgIC8vIEhvd2V2ZXIsIG9jY2FzaW9uYWxseSBBbmd1bGFyIG5lZWRzIHRvIHByb2R1Y2UgYSBsZWZ0LWFzc29jaWF0aXZlIGNvbmRpdGlvbmFsLCBzdWNoIGFzIGluXG4gICAgLy8gdGhlIGNhc2Ugb2YgYSBudWxsLXNhZmUgbmF2aWdhdGlvbiBwcm9kdWN0aW9uOiBge3thPy5iID8gYyA6IGR9fWAuIFRoaXMgdGVtcGxhdGUgcHJvZHVjZXNcbiAgICAvLyBhIHRlcm5hcnkgb2YgdGhlIGZvcm06XG4gICAgLy8gICBgYSA9PSBudWxsID8gbnVsbCA6IHJlc3Qgb2YgZXhwcmVzc2lvbmBcbiAgICAvLyBJZiB0aGUgcmVzdCBvZiB0aGUgZXhwcmVzc2lvbiBpcyBhbHNvIGEgdGVybmFyeSB0aG91Z2gsIHRoaXMgd291bGQgcHJvZHVjZSB0aGUgZm9ybTpcbiAgICAvLyAgIGBhID09IG51bGwgPyBudWxsIDogYS5iID8gYyA6IGRgXG4gICAgLy8gd2hpY2gsIGlmIGxlZnQgYXMgcmlnaHQtYXNzb2NpYXRpdmUsIHdvdWxkIGJlIGluY29ycmVjdGx5IGFzc29jaWF0ZWQgYXM6XG4gICAgLy8gICBgYSA9PSBudWxsID8gbnVsbCA6IChhLmIgPyBjIDogZClgXG4gICAgLy9cbiAgICAvLyBJbiBzdWNoIGNhc2VzLCB0aGUgbGVmdC1hc3NvY2lhdGl2aXR5IG5lZWRzIHRvIGJlIGVuZm9yY2VkIHdpdGggcGFyZW50aGVzZXM6XG4gICAgLy8gICBgKGEgPT0gbnVsbCA/IG51bGwgOiBhLmIpID8gYyA6IGRgXG4gICAgLy9cbiAgICAvLyBTdWNoIHBhcmVudGhlc2VzIGNvdWxkIGFsd2F5cyBiZSBpbmNsdWRlZCBpbiB0aGUgY29uZGl0aW9uIChndWFyYW50ZWVpbmcgY29ycmVjdCBiZWhhdmlvcikgaW5cbiAgICAvLyBhbGwgY2FzZXMsIGJ1dCB0aGlzIGhhcyBhIGNvZGUgc2l6ZSBjb3N0LiBJbnN0ZWFkLCBwYXJlbnRoZXNlcyBhcmUgYWRkZWQgb25seSB3aGVuIGFcbiAgICAvLyBjb25kaXRpb25hbCBleHByZXNzaW9uIGlzIGRpcmVjdGx5IHVzZWQgYXMgdGhlIGNvbmRpdGlvbiBvZiBhbm90aGVyLlxuICAgIC8vXG4gICAgLy8gVE9ETyhhbHhodWIpOiBpbnZlc3RpZ2F0ZSBiZXR0ZXIgbG9naWMgZm9yIHByZWNlbmRlbmNlIG9mIGNvbmRpdGlvbmFsIG9wZXJhdG9yc1xuICAgIGlmIChhc3QuY29uZGl0aW9uIGluc3RhbmNlb2YgQ29uZGl0aW9uYWxFeHByKSB7XG4gICAgICAvLyBUaGUgY29uZGl0aW9uIG9mIHRoaXMgdGVybmFyeSBuZWVkcyB0byBiZSB3cmFwcGVkIGluIHBhcmVudGhlc2VzIHRvIG1haW50YWluXG4gICAgICAvLyBsZWZ0LWFzc29jaWF0aXZpdHkuXG4gICAgICBjb25kID0gdHMuY3JlYXRlUGFyZW4oY29uZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRzLmNyZWF0ZUNvbmRpdGlvbmFsKFxuICAgICAgICBjb25kLCBhc3QudHJ1ZUNhc2UudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLFxuICAgICAgICBhc3QuZmFsc2VDYXNlIS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogQ29udGV4dCk6IHRzLlByZWZpeFVuYXJ5RXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZVByZWZpeChcbiAgICAgICAgdHMuU3ludGF4S2luZC5FeGNsYW1hdGlvblRva2VuLCBhc3QuY29uZGl0aW9uLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdEFzc2VydE5vdE51bGxFeHByKGFzdDogQXNzZXJ0Tm90TnVsbCwgY29udGV4dDogQ29udGV4dCk6IHRzLk5vbk51bGxFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gYXN0LmNvbmRpdGlvbi52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gIH1cblxuICB2aXNpdENhc3RFeHByKGFzdDogQ2FzdEV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gYXN0LnZhbHVlLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgfVxuXG4gIHZpc2l0RnVuY3Rpb25FeHByKGFzdDogRnVuY3Rpb25FeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuRnVuY3Rpb25FeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdHMuY3JlYXRlRnVuY3Rpb25FeHByZXNzaW9uKFxuICAgICAgICB1bmRlZmluZWQsIHVuZGVmaW5lZCwgYXN0Lm5hbWUgfHwgdW5kZWZpbmVkLCB1bmRlZmluZWQsXG4gICAgICAgIGFzdC5wYXJhbXMubWFwKFxuICAgICAgICAgICAgcGFyYW0gPT4gdHMuY3JlYXRlUGFyYW1ldGVyKFxuICAgICAgICAgICAgICAgIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHBhcmFtLm5hbWUsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpKSxcbiAgICAgICAgdW5kZWZpbmVkLCB0cy5jcmVhdGVCbG9jayhhc3Quc3RhdGVtZW50cy5tYXAoc3RtdCA9PiBzdG10LnZpc2l0U3RhdGVtZW50KHRoaXMsIGNvbnRleHQpKSkpO1xuICB9XG5cbiAgdmlzaXRVbmFyeU9wZXJhdG9yRXhwcihhc3Q6IFVuYXJ5T3BlcmF0b3JFeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuRXhwcmVzc2lvbiB7XG4gICAgaWYgKCFVTkFSWV9PUEVSQVRPUlMuaGFzKGFzdC5vcGVyYXRvcikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biB1bmFyeSBvcGVyYXRvcjogJHtVbmFyeU9wZXJhdG9yW2FzdC5vcGVyYXRvcl19YCk7XG4gICAgfVxuICAgIHJldHVybiB0cy5jcmVhdGVQcmVmaXgoXG4gICAgICAgIFVOQVJZX09QRVJBVE9SUy5nZXQoYXN0Lm9wZXJhdG9yKSEsIGFzdC5leHByLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSk7XG4gIH1cblxuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IEJpbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogQ29udGV4dCk6IHRzLkV4cHJlc3Npb24ge1xuICAgIGlmICghQklOQVJZX09QRVJBVE9SUy5oYXMoYXN0Lm9wZXJhdG9yKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGJpbmFyeSBvcGVyYXRvcjogJHtCaW5hcnlPcGVyYXRvclthc3Qub3BlcmF0b3JdfWApO1xuICAgIH1cbiAgICByZXR1cm4gdHMuY3JlYXRlQmluYXJ5KFxuICAgICAgICBhc3QubGhzLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgQklOQVJZX09QRVJBVE9SUy5nZXQoYXN0Lm9wZXJhdG9yKSEsXG4gICAgICAgIGFzdC5yaHMudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogUmVhZFByb3BFeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuUHJvcGVydHlBY2Nlc3NFeHByZXNzaW9uIHtcbiAgICByZXR1cm4gdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3MoYXN0LnJlY2VpdmVyLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KSwgYXN0Lm5hbWUpO1xuICB9XG5cbiAgdmlzaXRSZWFkS2V5RXhwcihhc3Q6IFJlYWRLZXlFeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuRWxlbWVudEFjY2Vzc0V4cHJlc3Npb24ge1xuICAgIHJldHVybiB0cy5jcmVhdGVFbGVtZW50QWNjZXNzKFxuICAgICAgICBhc3QucmVjZWl2ZXIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpLCBhc3QuaW5kZXgudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEFycmF5RXhwcihhc3Q6IExpdGVyYWxBcnJheUV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5BcnJheUxpdGVyYWxFeHByZXNzaW9uIHtcbiAgICBjb25zdCBleHByID1cbiAgICAgICAgdHMuY3JlYXRlQXJyYXlMaXRlcmFsKGFzdC5lbnRyaWVzLm1hcChleHByID0+IGV4cHIudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKSk7XG4gICAgdGhpcy5zZXRTb3VyY2VNYXBSYW5nZShleHByLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cblxuICB2aXNpdExpdGVyYWxNYXBFeHByKGFzdDogTGl0ZXJhbE1hcEV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbiB7XG4gICAgY29uc3QgZW50cmllcyA9IGFzdC5lbnRyaWVzLm1hcChcbiAgICAgICAgZW50cnkgPT4gdHMuY3JlYXRlUHJvcGVydHlBc3NpZ25tZW50KFxuICAgICAgICAgICAgZW50cnkucXVvdGVkID8gdHMuY3JlYXRlTGl0ZXJhbChlbnRyeS5rZXkpIDogdHMuY3JlYXRlSWRlbnRpZmllcihlbnRyeS5rZXkpLFxuICAgICAgICAgICAgZW50cnkudmFsdWUudmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKSk7XG4gICAgY29uc3QgZXhwciA9IHRzLmNyZWF0ZU9iamVjdExpdGVyYWwoZW50cmllcyk7XG4gICAgdGhpcy5zZXRTb3VyY2VNYXBSYW5nZShleHByLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGV4cHI7XG4gIH1cblxuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogQ29udGV4dCk6IG5ldmVyIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICB2aXNpdFdyYXBwZWROb2RlRXhwcihhc3Q6IFdyYXBwZWROb2RlRXhwcjxhbnk+LCBjb250ZXh0OiBDb250ZXh0KTogYW55IHtcbiAgICBpZiAodHMuaXNJZGVudGlmaWVyKGFzdC5ub2RlKSkge1xuICAgICAgdGhpcy5kZWZhdWx0SW1wb3J0UmVjb3JkZXIucmVjb3JkVXNlZElkZW50aWZpZXIoYXN0Lm5vZGUpO1xuICAgIH1cbiAgICByZXR1cm4gYXN0Lm5vZGU7XG4gIH1cblxuICB2aXNpdFR5cGVvZkV4cHIoYXN0OiBUeXBlb2ZFeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuVHlwZU9mRXhwcmVzc2lvbiB7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZVR5cGVPZihhc3QuZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCkpO1xuICB9XG5cbiAgLyoqXG4gICAqIFRyYW5zbGF0ZSB0aGUgYExvY2FsaXplZFN0cmluZ2Agbm9kZSBpbnRvIGEgYFRhZ2dlZFRlbXBsYXRlRXhwcmVzc2lvbmAgZm9yIEVTMjAxNSBmb3JtYXR0ZWRcbiAgICogb3V0cHV0LlxuICAgKi9cbiAgcHJpdmF0ZSBjcmVhdGVMb2NhbGl6ZWRTdHJpbmdUYWdnZWRUZW1wbGF0ZShhc3Q6IExvY2FsaXplZFN0cmluZywgY29udGV4dDogQ29udGV4dCk6XG4gICAgICB0cy5UYWdnZWRUZW1wbGF0ZUV4cHJlc3Npb24ge1xuICAgIGxldCB0ZW1wbGF0ZTogdHMuVGVtcGxhdGVMaXRlcmFsO1xuICAgIGNvbnN0IGxlbmd0aCA9IGFzdC5tZXNzYWdlUGFydHMubGVuZ3RoO1xuICAgIGNvbnN0IG1ldGFCbG9jayA9IGFzdC5zZXJpYWxpemVJMThuSGVhZCgpO1xuICAgIGlmIChsZW5ndGggPT09IDEpIHtcbiAgICAgIHRlbXBsYXRlID0gdHMuY3JlYXRlTm9TdWJzdGl0dXRpb25UZW1wbGF0ZUxpdGVyYWwobWV0YUJsb2NrLmNvb2tlZCwgbWV0YUJsb2NrLnJhdyk7XG4gICAgICB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKHRlbXBsYXRlLCBhc3QuZ2V0TWVzc2FnZVBhcnRTb3VyY2VTcGFuKDApKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gQ3JlYXRlIHRoZSBoZWFkIHBhcnRcbiAgICAgIGNvbnN0IGhlYWQgPSB0cy5jcmVhdGVUZW1wbGF0ZUhlYWQobWV0YUJsb2NrLmNvb2tlZCwgbWV0YUJsb2NrLnJhdyk7XG4gICAgICB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKGhlYWQsIGFzdC5nZXRNZXNzYWdlUGFydFNvdXJjZVNwYW4oMCkpO1xuICAgICAgY29uc3Qgc3BhbnM6IHRzLlRlbXBsYXRlU3BhbltdID0gW107XG4gICAgICAvLyBDcmVhdGUgdGhlIG1pZGRsZSBwYXJ0c1xuICAgICAgZm9yIChsZXQgaSA9IDE7IGkgPCBsZW5ndGggLSAxOyBpKyspIHtcbiAgICAgICAgY29uc3QgcmVzb2x2ZWRFeHByZXNzaW9uID0gYXN0LmV4cHJlc3Npb25zW2kgLSAxXS52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgICAgIHRoaXMuc2V0U291cmNlTWFwUmFuZ2UocmVzb2x2ZWRFeHByZXNzaW9uLCBhc3QuZ2V0UGxhY2Vob2xkZXJTb3VyY2VTcGFuKGkgLSAxKSk7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlUGFydCA9IGFzdC5zZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KGkpO1xuICAgICAgICBjb25zdCB0ZW1wbGF0ZU1pZGRsZSA9IGNyZWF0ZVRlbXBsYXRlTWlkZGxlKHRlbXBsYXRlUGFydC5jb29rZWQsIHRlbXBsYXRlUGFydC5yYXcpO1xuICAgICAgICB0aGlzLnNldFNvdXJjZU1hcFJhbmdlKHRlbXBsYXRlTWlkZGxlLCBhc3QuZ2V0TWVzc2FnZVBhcnRTb3VyY2VTcGFuKGkpKTtcbiAgICAgICAgY29uc3QgdGVtcGxhdGVTcGFuID0gdHMuY3JlYXRlVGVtcGxhdGVTcGFuKHJlc29sdmVkRXhwcmVzc2lvbiwgdGVtcGxhdGVNaWRkbGUpO1xuICAgICAgICBzcGFucy5wdXNoKHRlbXBsYXRlU3Bhbik7XG4gICAgICB9XG4gICAgICAvLyBDcmVhdGUgdGhlIHRhaWwgcGFydFxuICAgICAgY29uc3QgcmVzb2x2ZWRFeHByZXNzaW9uID0gYXN0LmV4cHJlc3Npb25zW2xlbmd0aCAtIDJdLnZpc2l0RXhwcmVzc2lvbih0aGlzLCBjb250ZXh0KTtcbiAgICAgIHRoaXMuc2V0U291cmNlTWFwUmFuZ2UocmVzb2x2ZWRFeHByZXNzaW9uLCBhc3QuZ2V0UGxhY2Vob2xkZXJTb3VyY2VTcGFuKGxlbmd0aCAtIDIpKTtcbiAgICAgIGNvbnN0IHRlbXBsYXRlUGFydCA9IGFzdC5zZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KGxlbmd0aCAtIDEpO1xuICAgICAgY29uc3QgdGVtcGxhdGVUYWlsID0gY3JlYXRlVGVtcGxhdGVUYWlsKHRlbXBsYXRlUGFydC5jb29rZWQsIHRlbXBsYXRlUGFydC5yYXcpO1xuICAgICAgdGhpcy5zZXRTb3VyY2VNYXBSYW5nZSh0ZW1wbGF0ZVRhaWwsIGFzdC5nZXRNZXNzYWdlUGFydFNvdXJjZVNwYW4obGVuZ3RoIC0gMSkpO1xuICAgICAgc3BhbnMucHVzaCh0cy5jcmVhdGVUZW1wbGF0ZVNwYW4ocmVzb2x2ZWRFeHByZXNzaW9uLCB0ZW1wbGF0ZVRhaWwpKTtcbiAgICAgIC8vIFB1dCBpdCBhbGwgdG9nZXRoZXJcbiAgICAgIHRlbXBsYXRlID0gdHMuY3JlYXRlVGVtcGxhdGVFeHByZXNzaW9uKGhlYWQsIHNwYW5zKTtcbiAgICB9XG4gICAgY29uc3QgZXhwcmVzc2lvbiA9IHRzLmNyZWF0ZVRhZ2dlZFRlbXBsYXRlKHRzLmNyZWF0ZUlkZW50aWZpZXIoJyRsb2NhbGl6ZScpLCB0ZW1wbGF0ZSk7XG4gICAgdGhpcy5zZXRTb3VyY2VNYXBSYW5nZShleHByZXNzaW9uLCBhc3Quc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGV4cHJlc3Npb247XG4gIH1cblxuICAvKipcbiAgICogVHJhbnNsYXRlIHRoZSBgTG9jYWxpemVkU3RyaW5nYCBub2RlIGludG8gYSBgJGxvY2FsaXplYCBjYWxsIHVzaW5nIHRoZSBpbXBvcnRlZFxuICAgKiBgX19tYWtlVGVtcGxhdGVPYmplY3RgIGhlbHBlciBmb3IgRVM1IGZvcm1hdHRlZCBvdXRwdXQuXG4gICAqL1xuICBwcml2YXRlIGNyZWF0ZUxvY2FsaXplZFN0cmluZ0Z1bmN0aW9uQ2FsbChhc3Q6IExvY2FsaXplZFN0cmluZywgY29udGV4dDogQ29udGV4dCkge1xuICAgIC8vIEEgYCRsb2NhbGl6ZWAgbWVzc2FnZSBjb25zaXN0cyBgbWVzc2FnZVBhcnRzYCBhbmQgYGV4cHJlc3Npb25zYCwgd2hpY2ggZ2V0IGludGVybGVhdmVkXG4gICAgLy8gdG9nZXRoZXIuIFRoZSBpbnRlcmxlYXZlZCBwaWVjZXMgbG9vayBsaWtlOlxuICAgIC8vIGBbbWVzc2FnZVBhcnQwLCBleHByZXNzaW9uMCwgbWVzc2FnZVBhcnQxLCBleHByZXNzaW9uMSwgbWVzc2FnZVBhcnQyXWBcbiAgICAvL1xuICAgIC8vIE5vdGUgdGhhdCB0aGVyZSBpcyBhbHdheXMgYSBtZXNzYWdlIHBhcnQgYXQgdGhlIHN0YXJ0IGFuZCBlbmQsIGFuZCBzbyB0aGVyZWZvcmVcbiAgICAvLyBgbWVzc2FnZVBhcnRzLmxlbmd0aCA9PT0gZXhwcmVzc2lvbnMubGVuZ3RoICsgMWAuXG4gICAgLy9cbiAgICAvLyBFYWNoIG1lc3NhZ2UgcGFydCBtYXkgYmUgcHJlZml4ZWQgd2l0aCBcIm1ldGFkYXRhXCIsIHdoaWNoIGlzIHdyYXBwZWQgaW4gY29sb25zICg6KSBkZWxpbWl0ZXJzLlxuICAgIC8vIFRoZSBtZXRhZGF0YSBpcyBhdHRhY2hlZCB0byB0aGUgZmlyc3QgYW5kIHN1YnNlcXVlbnQgbWVzc2FnZSBwYXJ0cyBieSBjYWxscyB0b1xuICAgIC8vIGBzZXJpYWxpemVJMThuSGVhZCgpYCBhbmQgYHNlcmlhbGl6ZUkxOG5UZW1wbGF0ZVBhcnQoKWAgcmVzcGVjdGl2ZWx5LlxuXG4gICAgLy8gVGhlIGZpcnN0IG1lc3NhZ2UgcGFydCAoaS5lLiBgYXN0Lm1lc3NhZ2VQYXJ0c1swXWApIGlzIHVzZWQgdG8gaW5pdGlhbGl6ZSBgbWVzc2FnZVBhcnRzYFxuICAgIC8vIGFycmF5LlxuICAgIGNvbnN0IG1lc3NhZ2VQYXJ0cyA9IFthc3Quc2VyaWFsaXplSTE4bkhlYWQoKV07XG4gICAgY29uc3QgZXhwcmVzc2lvbnM6IGFueVtdID0gW107XG5cbiAgICAvLyBUaGUgcmVzdCBvZiB0aGUgYGFzdC5tZXNzYWdlUGFydHNgIGFuZCBlYWNoIG9mIHRoZSBleHByZXNzaW9ucyBhcmUgYGFzdC5leHByZXNzaW9uc2AgcHVzaGVkXG4gICAgLy8gaW50byB0aGUgYXJyYXlzLiBOb3RlIHRoYXQgYGFzdC5tZXNzYWdlUGFydFtpXWAgY29ycmVzcG9uZHMgdG8gYGV4cHJlc3Npb25zW2ktMV1gXG4gICAgZm9yIChsZXQgaSA9IDE7IGkgPCBhc3QubWVzc2FnZVBhcnRzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBleHByZXNzaW9ucy5wdXNoKGFzdC5leHByZXNzaW9uc1tpIC0gMV0udmlzaXRFeHByZXNzaW9uKHRoaXMsIGNvbnRleHQpKTtcbiAgICAgIG1lc3NhZ2VQYXJ0cy5wdXNoKGFzdC5zZXJpYWxpemVJMThuVGVtcGxhdGVQYXJ0KGkpKTtcbiAgICB9XG5cbiAgICAvLyBUaGUgcmVzdWx0aW5nIGRvd25sZXZlbGxlZCB0YWdnZWQgdGVtcGxhdGUgc3RyaW5nIHVzZXMgYSBjYWxsIHRvIHRoZSBgX19tYWtlVGVtcGxhdGVPYmplY3QoKWBcbiAgICAvLyBoZWxwZXIsIHNvIHdlIG11c3QgZW5zdXJlIGl0IGhhcyBiZWVuIGltcG9ydGVkLlxuICAgIGNvbnN0IHttb2R1bGVJbXBvcnQsIHN5bWJvbH0gPVxuICAgICAgICB0aGlzLmltcG9ydHMuZ2VuZXJhdGVOYW1lZEltcG9ydCgndHNsaWInLCAnX19tYWtlVGVtcGxhdGVPYmplY3QnKTtcbiAgICBjb25zdCBfX21ha2VUZW1wbGF0ZU9iamVjdEhlbHBlciA9IChtb2R1bGVJbXBvcnQgPT09IG51bGwpID9cbiAgICAgICAgdHMuY3JlYXRlSWRlbnRpZmllcihzeW1ib2wpIDpcbiAgICAgICAgdHMuY3JlYXRlUHJvcGVydHlBY2Nlc3ModHMuY3JlYXRlSWRlbnRpZmllcihtb2R1bGVJbXBvcnQpLCB0cy5jcmVhdGVJZGVudGlmaWVyKHN5bWJvbCkpO1xuXG4gICAgLy8gR2VuZXJhdGUgdGhlIGNhbGwgaW4gdGhlIGZvcm06XG4gICAgLy8gYCRsb2NhbGl6ZShfX21ha2VUZW1wbGF0ZU9iamVjdChjb29rZWRNZXNzYWdlUGFydHMsIHJhd01lc3NhZ2VQYXJ0cyksIC4uLmV4cHJlc3Npb25zKTtgXG4gICAgY29uc3QgY29va2VkTGl0ZXJhbHMgPSBtZXNzYWdlUGFydHMubWFwKFxuICAgICAgICAobWVzc2FnZVBhcnQsIGkpID0+XG4gICAgICAgICAgICB0aGlzLmNyZWF0ZUxpdGVyYWwobWVzc2FnZVBhcnQuY29va2VkLCBhc3QuZ2V0TWVzc2FnZVBhcnRTb3VyY2VTcGFuKGkpKSk7XG4gICAgY29uc3QgcmF3TGl0ZXJhbHMgPSBtZXNzYWdlUGFydHMubWFwKFxuICAgICAgICAobWVzc2FnZVBhcnQsIGkpID0+IHRoaXMuY3JlYXRlTGl0ZXJhbChtZXNzYWdlUGFydC5yYXcsIGFzdC5nZXRNZXNzYWdlUGFydFNvdXJjZVNwYW4oaSkpKTtcbiAgICByZXR1cm4gdHMuY3JlYXRlQ2FsbChcbiAgICAgICAgLyogZXhwcmVzc2lvbiAqLyB0cy5jcmVhdGVJZGVudGlmaWVyKCckbG9jYWxpemUnKSxcbiAgICAgICAgLyogdHlwZUFyZ3VtZW50cyAqLyB1bmRlZmluZWQsXG4gICAgICAgIC8qIGFyZ3VtZW50c0FycmF5ICovW1xuICAgICAgICAgIHRzLmNyZWF0ZUNhbGwoXG4gICAgICAgICAgICAgIC8qIGV4cHJlc3Npb24gKi8gX19tYWtlVGVtcGxhdGVPYmplY3RIZWxwZXIsXG4gICAgICAgICAgICAgIC8qIHR5cGVBcmd1bWVudHMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgICAgICAvKiBhcmd1bWVudHNBcnJheSAqL1xuICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgdHMuY3JlYXRlQXJyYXlMaXRlcmFsKGNvb2tlZExpdGVyYWxzKSxcbiAgICAgICAgICAgICAgICB0cy5jcmVhdGVBcnJheUxpdGVyYWwocmF3TGl0ZXJhbHMpLFxuICAgICAgICAgICAgICBdKSxcbiAgICAgICAgICAuLi5leHByZXNzaW9ucyxcbiAgICAgICAgXSk7XG4gIH1cblxuXG4gIHByaXZhdGUgc2V0U291cmNlTWFwUmFuZ2UoZXhwcjogdHMuTm9kZSwgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFufG51bGwpIHtcbiAgICBpZiAoc291cmNlU3Bhbikge1xuICAgICAgY29uc3Qge3N0YXJ0LCBlbmR9ID0gc291cmNlU3BhbjtcbiAgICAgIGNvbnN0IHt1cmwsIGNvbnRlbnR9ID0gc3RhcnQuZmlsZTtcbiAgICAgIGlmICh1cmwpIHtcbiAgICAgICAgaWYgKCF0aGlzLmV4dGVybmFsU291cmNlRmlsZXMuaGFzKHVybCkpIHtcbiAgICAgICAgICB0aGlzLmV4dGVybmFsU291cmNlRmlsZXMuc2V0KHVybCwgdHMuY3JlYXRlU291cmNlTWFwU291cmNlKHVybCwgY29udGVudCwgcG9zID0+IHBvcykpO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IHNvdXJjZSA9IHRoaXMuZXh0ZXJuYWxTb3VyY2VGaWxlcy5nZXQodXJsKTtcbiAgICAgICAgdHMuc2V0U291cmNlTWFwUmFuZ2UoZXhwciwge3Bvczogc3RhcnQub2Zmc2V0LCBlbmQ6IGVuZC5vZmZzZXQsIHNvdXJjZX0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgY3JlYXRlTGl0ZXJhbCh0ZXh0OiBzdHJpbmcsIHNwYW46IFBhcnNlU291cmNlU3BhbnxudWxsKSB7XG4gICAgY29uc3QgbGl0ZXJhbCA9IHRzLmNyZWF0ZVN0cmluZ0xpdGVyYWwodGV4dCk7XG4gICAgdGhpcy5zZXRTb3VyY2VNYXBSYW5nZShsaXRlcmFsLCBzcGFuKTtcbiAgICByZXR1cm4gbGl0ZXJhbDtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgVHlwZVRyYW5zbGF0b3JWaXNpdG9yIGltcGxlbWVudHMgRXhwcmVzc2lvblZpc2l0b3IsIFR5cGVWaXNpdG9yIHtcbiAgY29uc3RydWN0b3IocHJpdmF0ZSBpbXBvcnRzOiBJbXBvcnRNYW5hZ2VyKSB7fVxuXG4gIHZpc2l0QnVpbHRpblR5cGUodHlwZTogQnVpbHRpblR5cGUsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5LZXl3b3JkVHlwZU5vZGUge1xuICAgIHN3aXRjaCAodHlwZS5uYW1lKSB7XG4gICAgICBjYXNlIEJ1aWx0aW5UeXBlTmFtZS5Cb29sOlxuICAgICAgICByZXR1cm4gdHMuY3JlYXRlS2V5d29yZFR5cGVOb2RlKHRzLlN5bnRheEtpbmQuQm9vbGVhbktleXdvcmQpO1xuICAgICAgY2FzZSBCdWlsdGluVHlwZU5hbWUuRHluYW1pYzpcbiAgICAgICAgcmV0dXJuIHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLkFueUtleXdvcmQpO1xuICAgICAgY2FzZSBCdWlsdGluVHlwZU5hbWUuSW50OlxuICAgICAgY2FzZSBCdWlsdGluVHlwZU5hbWUuTnVtYmVyOlxuICAgICAgICByZXR1cm4gdHMuY3JlYXRlS2V5d29yZFR5cGVOb2RlKHRzLlN5bnRheEtpbmQuTnVtYmVyS2V5d29yZCk7XG4gICAgICBjYXNlIEJ1aWx0aW5UeXBlTmFtZS5TdHJpbmc6XG4gICAgICAgIHJldHVybiB0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5TdHJpbmdLZXl3b3JkKTtcbiAgICAgIGNhc2UgQnVpbHRpblR5cGVOYW1lLk5vbmU6XG4gICAgICAgIHJldHVybiB0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5OZXZlcktleXdvcmQpO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBVbnN1cHBvcnRlZCBidWlsdGluIHR5cGU6ICR7QnVpbHRpblR5cGVOYW1lW3R5cGUubmFtZV19YCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRFeHByZXNzaW9uVHlwZSh0eXBlOiBFeHByZXNzaW9uVHlwZSwgY29udGV4dDogQ29udGV4dCk6IHRzLlR5cGVOb2RlIHtcbiAgICBjb25zdCB0eXBlTm9kZSA9IHRoaXMudHJhbnNsYXRlRXhwcmVzc2lvbih0eXBlLnZhbHVlLCBjb250ZXh0KTtcbiAgICBpZiAodHlwZS50eXBlUGFyYW1zID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gdHlwZU5vZGU7XG4gICAgfVxuXG4gICAgaWYgKCF0cy5pc1R5cGVSZWZlcmVuY2VOb2RlKHR5cGVOb2RlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICdBbiBFeHByZXNzaW9uVHlwZSB3aXRoIHR5cGUgYXJndW1lbnRzIG11c3QgdHJhbnNsYXRlIGludG8gYSBUeXBlUmVmZXJlbmNlTm9kZScpO1xuICAgIH0gZWxzZSBpZiAodHlwZU5vZGUudHlwZUFyZ3VtZW50cyAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgYEFuIEV4cHJlc3Npb25UeXBlIHdpdGggdHlwZSBhcmd1bWVudHMgY2Fubm90IGhhdmUgbXVsdGlwbGUgbGV2ZWxzIG9mIHR5cGUgYXJndW1lbnRzYCk7XG4gICAgfVxuXG4gICAgY29uc3QgdHlwZUFyZ3MgPSB0eXBlLnR5cGVQYXJhbXMubWFwKHBhcmFtID0+IHRoaXMudHJhbnNsYXRlVHlwZShwYXJhbSwgY29udGV4dCkpO1xuICAgIHJldHVybiB0cy5jcmVhdGVUeXBlUmVmZXJlbmNlTm9kZSh0eXBlTm9kZS50eXBlTmFtZSwgdHlwZUFyZ3MpO1xuICB9XG5cbiAgdmlzaXRBcnJheVR5cGUodHlwZTogQXJyYXlUeXBlLCBjb250ZXh0OiBDb250ZXh0KTogdHMuQXJyYXlUeXBlTm9kZSB7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZUFycmF5VHlwZU5vZGUodGhpcy50cmFuc2xhdGVUeXBlKHR5cGUub2YsIGNvbnRleHQpKTtcbiAgfVxuXG4gIHZpc2l0TWFwVHlwZSh0eXBlOiBNYXBUeXBlLCBjb250ZXh0OiBDb250ZXh0KTogdHMuVHlwZUxpdGVyYWxOb2RlIHtcbiAgICBjb25zdCBwYXJhbWV0ZXIgPSB0cy5jcmVhdGVQYXJhbWV0ZXIoXG4gICAgICAgIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsICdrZXknLCB1bmRlZmluZWQsXG4gICAgICAgIHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLlN0cmluZ0tleXdvcmQpKTtcbiAgICBjb25zdCB0eXBlQXJncyA9IHR5cGUudmFsdWVUeXBlICE9PSBudWxsID9cbiAgICAgICAgdGhpcy50cmFuc2xhdGVUeXBlKHR5cGUudmFsdWVUeXBlLCBjb250ZXh0KSA6XG4gICAgICAgIHRzLmNyZWF0ZUtleXdvcmRUeXBlTm9kZSh0cy5TeW50YXhLaW5kLlVua25vd25LZXl3b3JkKTtcbiAgICBjb25zdCBpbmRleFNpZ25hdHVyZSA9IHRzLmNyZWF0ZUluZGV4U2lnbmF0dXJlKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBbcGFyYW1ldGVyXSwgdHlwZUFyZ3MpO1xuICAgIHJldHVybiB0cy5jcmVhdGVUeXBlTGl0ZXJhbE5vZGUoW2luZGV4U2lnbmF0dXJlXSk7XG4gIH1cblxuICB2aXNpdFJlYWRWYXJFeHByKGFzdDogUmVhZFZhckV4cHIsIGNvbnRleHQ6IENvbnRleHQpOiB0cy5UeXBlUXVlcnlOb2RlIHtcbiAgICBpZiAoYXN0Lm5hbWUgPT09IG51bGwpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgUmVhZFZhckV4cHIgd2l0aCBubyB2YXJpYWJsZSBuYW1lIGluIHR5cGVgKTtcbiAgICB9XG4gICAgcmV0dXJuIHRzLmNyZWF0ZVR5cGVRdWVyeU5vZGUodHMuY3JlYXRlSWRlbnRpZmllcihhc3QubmFtZSkpO1xuICB9XG5cbiAgdmlzaXRXcml0ZVZhckV4cHIoZXhwcjogV3JpdGVWYXJFeHByLCBjb250ZXh0OiBDb250ZXh0KTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0V3JpdGVLZXlFeHByKGV4cHI6IFdyaXRlS2V5RXhwciwgY29udGV4dDogQ29udGV4dCk6IG5ldmVyIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICB2aXNpdFdyaXRlUHJvcEV4cHIoZXhwcjogV3JpdGVQcm9wRXhwciwgY29udGV4dDogQ29udGV4dCk6IG5ldmVyIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICB2aXNpdEludm9rZU1ldGhvZEV4cHIoYXN0OiBJbnZva2VNZXRob2RFeHByLCBjb250ZXh0OiBDb250ZXh0KTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0SW52b2tlRnVuY3Rpb25FeHByKGFzdDogSW52b2tlRnVuY3Rpb25FeHByLCBjb250ZXh0OiBDb250ZXh0KTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0SW5zdGFudGlhdGVFeHByKGFzdDogSW5zdGFudGlhdGVFeHByLCBjb250ZXh0OiBDb250ZXh0KTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbEV4cHIoYXN0OiBMaXRlcmFsRXhwciwgY29udGV4dDogQ29udGV4dCk6IHRzLlR5cGVOb2RlIHtcbiAgICBpZiAoYXN0LnZhbHVlID09PSBudWxsKSB7XG4gICAgICAvLyBUT0RPKGFsYW4tYWdpdXM0KTogUmVtb3ZlIHdoZW4gd2Ugbm8gbG9uZ2VyIHN1cHBvcnQgVFMgMy45XG4gICAgICAvLyBVc2U6IHJldHVybiB0cy5jcmVhdGVMaXRlcmFsVHlwZU5vZGUodHMuY3JlYXRlTnVsbCgpKSBkaXJlY3RseS5cbiAgICAgIHJldHVybiB0cy52ZXJzaW9uTWFqb3JNaW5vci5jaGFyQXQoMCkgPT09ICc0JyA/XG4gICAgICAgICAgdHMuY3JlYXRlTGl0ZXJhbFR5cGVOb2RlKHRzLmNyZWF0ZU51bGwoKSBhcyBhbnkpIDpcbiAgICAgICAgICB0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5OdWxsS2V5d29yZCBhcyBhbnkpO1xuICAgIH0gZWxzZSBpZiAoYXN0LnZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB0cy5jcmVhdGVLZXl3b3JkVHlwZU5vZGUodHMuU3ludGF4S2luZC5VbmRlZmluZWRLZXl3b3JkKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBhc3QudmFsdWUgPT09ICdib29sZWFuJykge1xuICAgICAgcmV0dXJuIHRzLmNyZWF0ZUxpdGVyYWxUeXBlTm9kZSh0cy5jcmVhdGVMaXRlcmFsKGFzdC52YWx1ZSkpO1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGFzdC52YWx1ZSA9PT0gJ251bWJlcicpIHtcbiAgICAgIHJldHVybiB0cy5jcmVhdGVMaXRlcmFsVHlwZU5vZGUodHMuY3JlYXRlTGl0ZXJhbChhc3QudmFsdWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRzLmNyZWF0ZUxpdGVyYWxUeXBlTm9kZSh0cy5jcmVhdGVMaXRlcmFsKGFzdC52YWx1ZSkpO1xuICAgIH1cbiAgfVxuXG4gIHZpc2l0TG9jYWxpemVkU3RyaW5nKGFzdDogTG9jYWxpemVkU3RyaW5nLCBjb250ZXh0OiBDb250ZXh0KTogbmV2ZXIge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0RXh0ZXJuYWxFeHByKGFzdDogRXh0ZXJuYWxFeHByLCBjb250ZXh0OiBDb250ZXh0KTogdHMuRW50aXR5TmFtZXx0cy5UeXBlUmVmZXJlbmNlTm9kZSB7XG4gICAgaWYgKGFzdC52YWx1ZS5tb2R1bGVOYW1lID09PSBudWxsIHx8IGFzdC52YWx1ZS5uYW1lID09PSBudWxsKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEltcG9ydCB1bmtub3duIG1vZHVsZSBvciBzeW1ib2xgKTtcbiAgICB9XG4gICAgY29uc3Qge21vZHVsZUltcG9ydCwgc3ltYm9sfSA9XG4gICAgICAgIHRoaXMuaW1wb3J0cy5nZW5lcmF0ZU5hbWVkSW1wb3J0KGFzdC52YWx1ZS5tb2R1bGVOYW1lLCBhc3QudmFsdWUubmFtZSk7XG4gICAgY29uc3Qgc3ltYm9sSWRlbnRpZmllciA9IHRzLmNyZWF0ZUlkZW50aWZpZXIoc3ltYm9sKTtcblxuICAgIGNvbnN0IHR5cGVOYW1lID0gbW9kdWxlSW1wb3J0ID9cbiAgICAgICAgdHMuY3JlYXRlUXVhbGlmaWVkTmFtZSh0cy5jcmVhdGVJZGVudGlmaWVyKG1vZHVsZUltcG9ydCksIHN5bWJvbElkZW50aWZpZXIpIDpcbiAgICAgICAgc3ltYm9sSWRlbnRpZmllcjtcblxuICAgIGNvbnN0IHR5cGVBcmd1bWVudHMgPSBhc3QudHlwZVBhcmFtcyAhPT0gbnVsbCA/XG4gICAgICAgIGFzdC50eXBlUGFyYW1zLm1hcCh0eXBlID0+IHRoaXMudHJhbnNsYXRlVHlwZSh0eXBlLCBjb250ZXh0KSkgOlxuICAgICAgICB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZVR5cGVSZWZlcmVuY2VOb2RlKHR5cGVOYW1lLCB0eXBlQXJndW1lbnRzKTtcbiAgfVxuXG4gIHZpc2l0Q29uZGl0aW9uYWxFeHByKGFzdDogQ29uZGl0aW9uYWxFeHByLCBjb250ZXh0OiBDb250ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXROb3RFeHByKGFzdDogTm90RXhwciwgY29udGV4dDogQ29udGV4dCkge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0QXNzZXJ0Tm90TnVsbEV4cHIoYXN0OiBBc3NlcnROb3ROdWxsLCBjb250ZXh0OiBDb250ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXRDYXN0RXhwcihhc3Q6IENhc3RFeHByLCBjb250ZXh0OiBDb250ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXRGdW5jdGlvbkV4cHIoYXN0OiBGdW5jdGlvbkV4cHIsIGNvbnRleHQ6IENvbnRleHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICB2aXNpdFVuYXJ5T3BlcmF0b3JFeHByKGFzdDogVW5hcnlPcGVyYXRvckV4cHIsIGNvbnRleHQ6IENvbnRleHQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG4gIH1cblxuICB2aXNpdEJpbmFyeU9wZXJhdG9yRXhwcihhc3Q6IEJpbmFyeU9wZXJhdG9yRXhwciwgY29udGV4dDogQ29udGV4dCkge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0UmVhZFByb3BFeHByKGFzdDogUmVhZFByb3BFeHByLCBjb250ZXh0OiBDb250ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXRSZWFkS2V5RXhwcihhc3Q6IFJlYWRLZXlFeHByLCBjb250ZXh0OiBDb250ZXh0KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuICB9XG5cbiAgdmlzaXRMaXRlcmFsQXJyYXlFeHByKGFzdDogTGl0ZXJhbEFycmF5RXhwciwgY29udGV4dDogQ29udGV4dCk6IHRzLlR1cGxlVHlwZU5vZGUge1xuICAgIGNvbnN0IHZhbHVlcyA9IGFzdC5lbnRyaWVzLm1hcChleHByID0+IHRoaXMudHJhbnNsYXRlRXhwcmVzc2lvbihleHByLCBjb250ZXh0KSk7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZVR1cGxlVHlwZU5vZGUodmFsdWVzKTtcbiAgfVxuXG4gIHZpc2l0TGl0ZXJhbE1hcEV4cHIoYXN0OiBMaXRlcmFsTWFwRXhwciwgY29udGV4dDogQ29udGV4dCk6IHRzLlR5cGVMaXRlcmFsTm9kZSB7XG4gICAgY29uc3QgZW50cmllcyA9IGFzdC5lbnRyaWVzLm1hcChlbnRyeSA9PiB7XG4gICAgICBjb25zdCB7a2V5LCBxdW90ZWR9ID0gZW50cnk7XG4gICAgICBjb25zdCB0eXBlID0gdGhpcy50cmFuc2xhdGVFeHByZXNzaW9uKGVudHJ5LnZhbHVlLCBjb250ZXh0KTtcbiAgICAgIHJldHVybiB0cy5jcmVhdGVQcm9wZXJ0eVNpZ25hdHVyZShcbiAgICAgICAgICAvKiBtb2RpZmllcnMgKi8gdW5kZWZpbmVkLFxuICAgICAgICAgIC8qIG5hbWUgKi8gcXVvdGVkID8gdHMuY3JlYXRlU3RyaW5nTGl0ZXJhbChrZXkpIDoga2V5LFxuICAgICAgICAgIC8qIHF1ZXN0aW9uVG9rZW4gKi8gdW5kZWZpbmVkLFxuICAgICAgICAgIC8qIHR5cGUgKi8gdHlwZSxcbiAgICAgICAgICAvKiBpbml0aWFsaXplciAqLyB1bmRlZmluZWQpO1xuICAgIH0pO1xuICAgIHJldHVybiB0cy5jcmVhdGVUeXBlTGl0ZXJhbE5vZGUoZW50cmllcyk7XG4gIH1cblxuICB2aXNpdENvbW1hRXhwcihhc3Q6IENvbW1hRXhwciwgY29udGV4dDogQ29udGV4dCkge1xuICAgIHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcbiAgfVxuXG4gIHZpc2l0V3JhcHBlZE5vZGVFeHByKGFzdDogV3JhcHBlZE5vZGVFeHByPGFueT4sIGNvbnRleHQ6IENvbnRleHQpOiB0cy5UeXBlTm9kZSB7XG4gICAgY29uc3Qgbm9kZTogdHMuTm9kZSA9IGFzdC5ub2RlO1xuICAgIGlmICh0cy5pc0VudGl0eU5hbWUobm9kZSkpIHtcbiAgICAgIHJldHVybiB0cy5jcmVhdGVUeXBlUmVmZXJlbmNlTm9kZShub2RlLCAvKiB0eXBlQXJndW1lbnRzICovIHVuZGVmaW5lZCk7XG4gICAgfSBlbHNlIGlmICh0cy5pc1R5cGVOb2RlKG5vZGUpKSB7XG4gICAgICByZXR1cm4gbm9kZTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzTGl0ZXJhbEV4cHJlc3Npb24obm9kZSkpIHtcbiAgICAgIHJldHVybiB0cy5jcmVhdGVMaXRlcmFsVHlwZU5vZGUobm9kZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICBgVW5zdXBwb3J0ZWQgV3JhcHBlZE5vZGVFeHByIGluIFR5cGVUcmFuc2xhdG9yVmlzaXRvcjogJHt0cy5TeW50YXhLaW5kW25vZGUua2luZF19YCk7XG4gICAgfVxuICB9XG5cbiAgdmlzaXRUeXBlb2ZFeHByKGFzdDogVHlwZW9mRXhwciwgY29udGV4dDogQ29udGV4dCk6IHRzLlR5cGVRdWVyeU5vZGUge1xuICAgIGxldCBleHByID0gdHJhbnNsYXRlRXhwcmVzc2lvbihcbiAgICAgICAgYXN0LmV4cHIsIHRoaXMuaW1wb3J0cywgTk9PUF9ERUZBVUxUX0lNUE9SVF9SRUNPUkRFUiwgdHMuU2NyaXB0VGFyZ2V0LkVTMjAxNSk7XG4gICAgcmV0dXJuIHRzLmNyZWF0ZVR5cGVRdWVyeU5vZGUoZXhwciBhcyB0cy5JZGVudGlmaWVyKTtcbiAgfVxuXG4gIHByaXZhdGUgdHJhbnNsYXRlVHlwZSh0eXBlOiBUeXBlLCBjb250ZXh0OiBDb250ZXh0KTogdHMuVHlwZU5vZGUge1xuICAgIGNvbnN0IHR5cGVOb2RlID0gdHlwZS52aXNpdFR5cGUodGhpcywgY29udGV4dCk7XG4gICAgaWYgKCF0cy5pc1R5cGVOb2RlKHR5cGVOb2RlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBIFR5cGUgbXVzdCB0cmFuc2xhdGUgdG8gYSBUeXBlTm9kZSwgYnV0IHdhcyAke3RzLlN5bnRheEtpbmRbdHlwZU5vZGUua2luZF19YCk7XG4gICAgfVxuICAgIHJldHVybiB0eXBlTm9kZTtcbiAgfVxuXG4gIHByaXZhdGUgdHJhbnNsYXRlRXhwcmVzc2lvbihleHByOiBFeHByZXNzaW9uLCBjb250ZXh0OiBDb250ZXh0KTogdHMuVHlwZU5vZGUge1xuICAgIGNvbnN0IHR5cGVOb2RlID0gZXhwci52aXNpdEV4cHJlc3Npb24odGhpcywgY29udGV4dCk7XG4gICAgaWYgKCF0cy5pc1R5cGVOb2RlKHR5cGVOb2RlKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGBBbiBFeHByZXNzaW9uIG11c3QgdHJhbnNsYXRlIHRvIGEgVHlwZU5vZGUsIGJ1dCB3YXMgJHt0cy5TeW50YXhLaW5kW3R5cGVOb2RlLmtpbmRdfWApO1xuICAgIH1cbiAgICByZXR1cm4gdHlwZU5vZGU7XG4gIH1cbn1cblxuLy8gSEFDSzogVXNlIHRoaXMgaW4gcGxhY2Ugb2YgYHRzLmNyZWF0ZVRlbXBsYXRlTWlkZGxlKClgLlxuLy8gUmV2ZXJ0IG9uY2UgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC9UeXBlU2NyaXB0L2lzc3Vlcy8zNTM3NCBpcyBmaXhlZFxuZnVuY3Rpb24gY3JlYXRlVGVtcGxhdGVNaWRkbGUoY29va2VkOiBzdHJpbmcsIHJhdzogc3RyaW5nKTogdHMuVGVtcGxhdGVNaWRkbGUge1xuICBjb25zdCBub2RlOiB0cy5UZW1wbGF0ZUxpdGVyYWxMaWtlTm9kZSA9IHRzLmNyZWF0ZVRlbXBsYXRlSGVhZChjb29rZWQsIHJhdyk7XG4gIChub2RlLmtpbmQgYXMgdHMuU3ludGF4S2luZCkgPSB0cy5TeW50YXhLaW5kLlRlbXBsYXRlTWlkZGxlO1xuICByZXR1cm4gbm9kZSBhcyB0cy5UZW1wbGF0ZU1pZGRsZTtcbn1cblxuLy8gSEFDSzogVXNlIHRoaXMgaW4gcGxhY2Ugb2YgYHRzLmNyZWF0ZVRlbXBsYXRlVGFpbCgpYC5cbi8vIFJldmVydCBvbmNlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvVHlwZVNjcmlwdC9pc3N1ZXMvMzUzNzQgaXMgZml4ZWRcbmZ1bmN0aW9uIGNyZWF0ZVRlbXBsYXRlVGFpbChjb29rZWQ6IHN0cmluZywgcmF3OiBzdHJpbmcpOiB0cy5UZW1wbGF0ZVRhaWwge1xuICBjb25zdCBub2RlOiB0cy5UZW1wbGF0ZUxpdGVyYWxMaWtlTm9kZSA9IHRzLmNyZWF0ZVRlbXBsYXRlSGVhZChjb29rZWQsIHJhdyk7XG4gIChub2RlLmtpbmQgYXMgdHMuU3ludGF4S2luZCkgPSB0cy5TeW50YXhLaW5kLlRlbXBsYXRlVGFpbDtcbiAgcmV0dXJuIG5vZGUgYXMgdHMuVGVtcGxhdGVUYWlsO1xufVxuXG4vKipcbiAqIEF0dGFjaCB0aGUgZ2l2ZW4gYGxlYWRpbmdDb21tZW50c2AgdG8gdGhlIGBzdGF0ZW1lbnRgIG5vZGUuXG4gKlxuICogQHBhcmFtIHN0YXRlbWVudCBUaGUgc3RhdGVtZW50IHRoYXQgd2lsbCBoYXZlIGNvbW1lbnRzIGF0dGFjaGVkLlxuICogQHBhcmFtIGxlYWRpbmdDb21tZW50cyBUaGUgY29tbWVudHMgdG8gYXR0YWNoIHRvIHRoZSBzdGF0ZW1lbnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhdHRhY2hDb21tZW50czxUIGV4dGVuZHMgdHMuU3RhdGVtZW50PihcbiAgICBzdGF0ZW1lbnQ6IFQsIGxlYWRpbmdDb21tZW50cz86IExlYWRpbmdDb21tZW50W10pOiBUIHtcbiAgaWYgKGxlYWRpbmdDb21tZW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuIHN0YXRlbWVudDtcbiAgfVxuXG4gIGZvciAoY29uc3QgY29tbWVudCBvZiBsZWFkaW5nQ29tbWVudHMpIHtcbiAgICBjb25zdCBjb21tZW50S2luZCA9IGNvbW1lbnQubXVsdGlsaW5lID8gdHMuU3ludGF4S2luZC5NdWx0aUxpbmVDb21tZW50VHJpdmlhIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHMuU3ludGF4S2luZC5TaW5nbGVMaW5lQ29tbWVudFRyaXZpYTtcbiAgICBpZiAoY29tbWVudC5tdWx0aWxpbmUpIHtcbiAgICAgIHRzLmFkZFN5bnRoZXRpY0xlYWRpbmdDb21tZW50KFxuICAgICAgICAgIHN0YXRlbWVudCwgY29tbWVudEtpbmQsIGNvbW1lbnQudG9TdHJpbmcoKSwgY29tbWVudC50cmFpbGluZ05ld2xpbmUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBmb3IgKGNvbnN0IGxpbmUgb2YgY29tbWVudC50ZXh0LnNwbGl0KCdcXG4nKSkge1xuICAgICAgICB0cy5hZGRTeW50aGV0aWNMZWFkaW5nQ29tbWVudChzdGF0ZW1lbnQsIGNvbW1lbnRLaW5kLCBsaW5lLCBjb21tZW50LnRyYWlsaW5nTmV3bGluZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBzdGF0ZW1lbnQ7XG59XG4iXX0=