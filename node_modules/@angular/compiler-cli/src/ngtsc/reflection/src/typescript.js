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
        define("@angular/compiler-cli/src/ngtsc/reflection/src/typescript", ["require", "exports", "typescript", "@angular/compiler-cli/src/ngtsc/reflection/src/host", "@angular/compiler-cli/src/ngtsc/reflection/src/type_to_value", "@angular/compiler-cli/src/ngtsc/reflection/src/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reflectObjectLiteral = exports.findMember = exports.filterToMembersWithDecorator = exports.reflectTypeEntityToDeclaration = exports.reflectIdentifierOfDeclaration = exports.reflectNameOfDeclaration = exports.TypeScriptReflectionHost = void 0;
    var ts = require("typescript");
    var host_1 = require("@angular/compiler-cli/src/ngtsc/reflection/src/host");
    var type_to_value_1 = require("@angular/compiler-cli/src/ngtsc/reflection/src/type_to_value");
    var util_1 = require("@angular/compiler-cli/src/ngtsc/reflection/src/util");
    /**
     * reflector.ts implements static reflection of declarations using the TypeScript `ts.TypeChecker`.
     */
    var TypeScriptReflectionHost = /** @class */ (function () {
        function TypeScriptReflectionHost(checker) {
            this.checker = checker;
        }
        TypeScriptReflectionHost.prototype.getDecoratorsOfDeclaration = function (declaration) {
            var _this = this;
            if (declaration.decorators === undefined || declaration.decorators.length === 0) {
                return null;
            }
            return declaration.decorators.map(function (decorator) { return _this._reflectDecorator(decorator); })
                .filter(function (dec) { return dec !== null; });
        };
        TypeScriptReflectionHost.prototype.getMembersOfClass = function (clazz) {
            var _this = this;
            var tsClazz = castDeclarationToClassOrDie(clazz);
            return tsClazz.members.map(function (member) { return _this._reflectMember(member); })
                .filter(function (member) { return member !== null; });
        };
        TypeScriptReflectionHost.prototype.getConstructorParameters = function (clazz) {
            var _this = this;
            var tsClazz = castDeclarationToClassOrDie(clazz);
            // First, find the constructor with a `body`. The constructors without a `body` are overloads
            // whereas we want the implementation since it's the one that'll be executed and which can
            // have decorators.
            var ctor = tsClazz.members.find(function (member) {
                return ts.isConstructorDeclaration(member) && member.body !== undefined;
            });
            if (ctor === undefined) {
                return null;
            }
            return ctor.parameters.map(function (node) {
                // The name of the parameter is easy.
                var name = parameterName(node.name);
                var decorators = _this.getDecoratorsOfDeclaration(node);
                // It may or may not be possible to write an expression that refers to the value side of the
                // type named for the parameter.
                var originalTypeNode = node.type || null;
                var typeNode = originalTypeNode;
                // Check if we are dealing with a simple nullable union type e.g. `foo: Foo|null`
                // and extract the type. More complex union types e.g. `foo: Foo|Bar` are not supported.
                // We also don't need to support `foo: Foo|undefined` because Angular's DI injects `null` for
                // optional tokes that don't have providers.
                if (typeNode && ts.isUnionTypeNode(typeNode)) {
                    var childTypeNodes = typeNode.types.filter(
                    // TODO(alan-agius4): remove `childTypeNode.kind !== ts.SyntaxKind.NullKeyword` when
                    // TS 3.9 support is dropped. In TS 4.0 NullKeyword is a child of LiteralType.
                    function (childTypeNode) { return childTypeNode.kind !== ts.SyntaxKind.NullKeyword &&
                        !(ts.isLiteralTypeNode(childTypeNode) &&
                            childTypeNode.literal.kind === ts.SyntaxKind.NullKeyword); });
                    if (childTypeNodes.length === 1) {
                        typeNode = childTypeNodes[0];
                    }
                }
                var typeValueReference = type_to_value_1.typeToValue(typeNode, _this.checker);
                return {
                    name: name,
                    nameNode: node.name,
                    typeValueReference: typeValueReference,
                    typeNode: originalTypeNode,
                    decorators: decorators,
                };
            });
        };
        TypeScriptReflectionHost.prototype.getImportOfIdentifier = function (id) {
            var directImport = this.getDirectImportOfIdentifier(id);
            if (directImport !== null) {
                return directImport;
            }
            else if (ts.isQualifiedName(id.parent) && id.parent.right === id) {
                return this.getImportOfNamespacedIdentifier(id, getQualifiedNameRoot(id.parent));
            }
            else if (ts.isPropertyAccessExpression(id.parent) && id.parent.name === id) {
                return this.getImportOfNamespacedIdentifier(id, getFarLeftIdentifier(id.parent));
            }
            else {
                return null;
            }
        };
        TypeScriptReflectionHost.prototype.getExportsOfModule = function (node) {
            var _this = this;
            // In TypeScript code, modules are only ts.SourceFiles. Throw if the node isn't a module.
            if (!ts.isSourceFile(node)) {
                throw new Error("getExportsOfModule() called on non-SourceFile in TS code");
            }
            var map = new Map();
            // Reflect the module to a Symbol, and use getExportsOfModule() to get a list of exported
            // Symbols.
            var symbol = this.checker.getSymbolAtLocation(node);
            if (symbol === undefined) {
                return null;
            }
            this.checker.getExportsOfModule(symbol).forEach(function (exportSymbol) {
                // Map each exported Symbol to a Declaration and add it to the map.
                var decl = _this.getDeclarationOfSymbol(exportSymbol, null);
                if (decl !== null) {
                    map.set(exportSymbol.name, decl);
                }
            });
            return map;
        };
        TypeScriptReflectionHost.prototype.isClass = function (node) {
            // For our purposes, classes are "named" ts.ClassDeclarations;
            // (`node.name` can be undefined in unnamed default exports: `default export class { ... }`).
            return util_1.isNamedClassDeclaration(node);
        };
        TypeScriptReflectionHost.prototype.hasBaseClass = function (clazz) {
            return this.getBaseClassExpression(clazz) !== null;
        };
        TypeScriptReflectionHost.prototype.getBaseClassExpression = function (clazz) {
            if (!(ts.isClassDeclaration(clazz) || ts.isClassExpression(clazz)) ||
                clazz.heritageClauses === undefined) {
                return null;
            }
            var extendsClause = clazz.heritageClauses.find(function (clause) { return clause.token === ts.SyntaxKind.ExtendsKeyword; });
            if (extendsClause === undefined) {
                return null;
            }
            var extendsType = extendsClause.types[0];
            if (extendsType === undefined) {
                return null;
            }
            return extendsType.expression;
        };
        TypeScriptReflectionHost.prototype.getDeclarationOfIdentifier = function (id) {
            // Resolve the identifier to a Symbol, and return the declaration of that.
            var symbol = this.checker.getSymbolAtLocation(id);
            if (symbol === undefined) {
                return null;
            }
            return this.getDeclarationOfSymbol(symbol, id);
        };
        TypeScriptReflectionHost.prototype.getDefinitionOfFunction = function (node) {
            if (!ts.isFunctionDeclaration(node) && !ts.isMethodDeclaration(node) &&
                !ts.isFunctionExpression(node)) {
                return null;
            }
            return {
                node: node,
                body: node.body !== undefined ? Array.from(node.body.statements) : null,
                parameters: node.parameters.map(function (param) {
                    var name = parameterName(param.name);
                    var initializer = param.initializer || null;
                    return { name: name, node: param, initializer: initializer };
                }),
            };
        };
        TypeScriptReflectionHost.prototype.getGenericArityOfClass = function (clazz) {
            if (!ts.isClassDeclaration(clazz)) {
                return null;
            }
            return clazz.typeParameters !== undefined ? clazz.typeParameters.length : 0;
        };
        TypeScriptReflectionHost.prototype.getVariableValue = function (declaration) {
            return declaration.initializer || null;
        };
        TypeScriptReflectionHost.prototype.getDtsDeclaration = function (_) {
            return null;
        };
        TypeScriptReflectionHost.prototype.getInternalNameOfClass = function (clazz) {
            return clazz.name;
        };
        TypeScriptReflectionHost.prototype.getAdjacentNameOfClass = function (clazz) {
            return clazz.name;
        };
        TypeScriptReflectionHost.prototype.getDirectImportOfIdentifier = function (id) {
            var symbol = this.checker.getSymbolAtLocation(id);
            if (symbol === undefined || symbol.declarations === undefined ||
                symbol.declarations.length !== 1) {
                return null;
            }
            var decl = symbol.declarations[0];
            var importDecl = getContainingImportDeclaration(decl);
            // Ignore declarations that are defined locally (not imported).
            if (importDecl === null) {
                return null;
            }
            // The module specifier is guaranteed to be a string literal, so this should always pass.
            if (!ts.isStringLiteral(importDecl.moduleSpecifier)) {
                // Not allowed to happen in TypeScript ASTs.
                return null;
            }
            return { from: importDecl.moduleSpecifier.text, name: getExportedName(decl, id) };
        };
        /**
         * Try to get the import info for this identifier as though it is a namespaced import.
         *
         * For example, if the identifier is the `Directive` part of a qualified type chain like:
         *
         * ```
         * core.Directive
         * ```
         *
         * then it might be that `core` is a namespace import such as:
         *
         * ```
         * import * as core from 'tslib';
         * ```
         *
         * @param id the TypeScript identifier to find the import info for.
         * @returns The import info if this is a namespaced import or `null`.
         */
        TypeScriptReflectionHost.prototype.getImportOfNamespacedIdentifier = function (id, namespaceIdentifier) {
            if (namespaceIdentifier === null) {
                return null;
            }
            var namespaceSymbol = this.checker.getSymbolAtLocation(namespaceIdentifier);
            if (!namespaceSymbol) {
                return null;
            }
            var declaration = namespaceSymbol.declarations.length === 1 ? namespaceSymbol.declarations[0] : null;
            if (!declaration) {
                return null;
            }
            var namespaceDeclaration = ts.isNamespaceImport(declaration) ? declaration : null;
            if (!namespaceDeclaration) {
                return null;
            }
            var importDeclaration = namespaceDeclaration.parent.parent;
            if (!ts.isStringLiteral(importDeclaration.moduleSpecifier)) {
                // Should not happen as this would be invalid TypesScript
                return null;
            }
            return {
                from: importDeclaration.moduleSpecifier.text,
                name: id.text,
            };
        };
        /**
         * Resolve a `ts.Symbol` to its declaration, keeping track of the `viaModule` along the way.
         */
        TypeScriptReflectionHost.prototype.getDeclarationOfSymbol = function (symbol, originalId) {
            // If the symbol points to a ShorthandPropertyAssignment, resolve it.
            var valueDeclaration = undefined;
            if (symbol.valueDeclaration !== undefined) {
                valueDeclaration = symbol.valueDeclaration;
            }
            else if (symbol.declarations !== undefined && symbol.declarations.length > 0) {
                valueDeclaration = symbol.declarations[0];
            }
            if (valueDeclaration !== undefined && ts.isShorthandPropertyAssignment(valueDeclaration)) {
                var shorthandSymbol = this.checker.getShorthandAssignmentValueSymbol(valueDeclaration);
                if (shorthandSymbol === undefined) {
                    return null;
                }
                return this.getDeclarationOfSymbol(shorthandSymbol, originalId);
            }
            else if (valueDeclaration !== undefined && ts.isExportSpecifier(valueDeclaration)) {
                var targetSymbol = this.checker.getExportSpecifierLocalTargetSymbol(valueDeclaration);
                if (targetSymbol === undefined) {
                    return null;
                }
                return this.getDeclarationOfSymbol(targetSymbol, originalId);
            }
            var importInfo = originalId && this.getImportOfIdentifier(originalId);
            var viaModule = importInfo !== null && importInfo.from !== null && !importInfo.from.startsWith('.') ?
                importInfo.from :
                null;
            // Now, resolve the Symbol to its declaration by following any and all aliases.
            while (symbol.flags & ts.SymbolFlags.Alias) {
                symbol = this.checker.getAliasedSymbol(symbol);
            }
            // Look at the resolved Symbol's declarations and pick one of them to return. Value declarations
            // are given precedence over type declarations.
            if (symbol.valueDeclaration !== undefined) {
                return {
                    node: symbol.valueDeclaration,
                    known: null,
                    viaModule: viaModule,
                    identity: null,
                };
            }
            else if (symbol.declarations !== undefined && symbol.declarations.length > 0) {
                return {
                    node: symbol.declarations[0],
                    known: null,
                    viaModule: viaModule,
                    identity: null,
                };
            }
            else {
                return null;
            }
        };
        TypeScriptReflectionHost.prototype._reflectDecorator = function (node) {
            // Attempt to resolve the decorator expression into a reference to a concrete Identifier. The
            // expression may contain a call to a function which returns the decorator function, in which
            // case we want to return the arguments.
            var decoratorExpr = node.expression;
            var args = null;
            // Check for call expressions.
            if (ts.isCallExpression(decoratorExpr)) {
                args = Array.from(decoratorExpr.arguments);
                decoratorExpr = decoratorExpr.expression;
            }
            // The final resolved decorator should be a `ts.Identifier` - if it's not, then something is
            // wrong and the decorator can't be resolved statically.
            if (!host_1.isDecoratorIdentifier(decoratorExpr)) {
                return null;
            }
            var decoratorIdentifier = ts.isIdentifier(decoratorExpr) ? decoratorExpr : decoratorExpr.name;
            var importDecl = this.getImportOfIdentifier(decoratorIdentifier);
            return {
                name: decoratorIdentifier.text,
                identifier: decoratorExpr,
                import: importDecl,
                node: node,
                args: args,
            };
        };
        TypeScriptReflectionHost.prototype._reflectMember = function (node) {
            var kind = null;
            var value = null;
            var name = null;
            var nameNode = null;
            if (ts.isPropertyDeclaration(node)) {
                kind = host_1.ClassMemberKind.Property;
                value = node.initializer || null;
            }
            else if (ts.isGetAccessorDeclaration(node)) {
                kind = host_1.ClassMemberKind.Getter;
            }
            else if (ts.isSetAccessorDeclaration(node)) {
                kind = host_1.ClassMemberKind.Setter;
            }
            else if (ts.isMethodDeclaration(node)) {
                kind = host_1.ClassMemberKind.Method;
            }
            else if (ts.isConstructorDeclaration(node)) {
                kind = host_1.ClassMemberKind.Constructor;
            }
            else {
                return null;
            }
            if (ts.isConstructorDeclaration(node)) {
                name = 'constructor';
            }
            else if (ts.isIdentifier(node.name)) {
                name = node.name.text;
                nameNode = node.name;
            }
            else if (ts.isStringLiteral(node.name)) {
                name = node.name.text;
                nameNode = node.name;
            }
            else {
                return null;
            }
            var decorators = this.getDecoratorsOfDeclaration(node);
            var isStatic = node.modifiers !== undefined &&
                node.modifiers.some(function (mod) { return mod.kind === ts.SyntaxKind.StaticKeyword; });
            return {
                node: node,
                implementation: node,
                kind: kind,
                type: node.type || null,
                name: name,
                nameNode: nameNode,
                decorators: decorators,
                value: value,
                isStatic: isStatic,
            };
        };
        return TypeScriptReflectionHost;
    }());
    exports.TypeScriptReflectionHost = TypeScriptReflectionHost;
    function reflectNameOfDeclaration(decl) {
        var id = reflectIdentifierOfDeclaration(decl);
        return id && id.text || null;
    }
    exports.reflectNameOfDeclaration = reflectNameOfDeclaration;
    function reflectIdentifierOfDeclaration(decl) {
        if (ts.isClassDeclaration(decl) || ts.isFunctionDeclaration(decl)) {
            return decl.name || null;
        }
        else if (ts.isVariableDeclaration(decl)) {
            if (ts.isIdentifier(decl.name)) {
                return decl.name;
            }
        }
        return null;
    }
    exports.reflectIdentifierOfDeclaration = reflectIdentifierOfDeclaration;
    function reflectTypeEntityToDeclaration(type, checker) {
        var realSymbol = checker.getSymbolAtLocation(type);
        if (realSymbol === undefined) {
            throw new Error("Cannot resolve type entity " + type.getText() + " to symbol");
        }
        while (realSymbol.flags & ts.SymbolFlags.Alias) {
            realSymbol = checker.getAliasedSymbol(realSymbol);
        }
        var node = null;
        if (realSymbol.valueDeclaration !== undefined) {
            node = realSymbol.valueDeclaration;
        }
        else if (realSymbol.declarations !== undefined && realSymbol.declarations.length === 1) {
            node = realSymbol.declarations[0];
        }
        else {
            throw new Error("Cannot resolve type entity symbol to declaration");
        }
        if (ts.isQualifiedName(type)) {
            if (!ts.isIdentifier(type.left)) {
                throw new Error("Cannot handle qualified name with non-identifier lhs");
            }
            var symbol = checker.getSymbolAtLocation(type.left);
            if (symbol === undefined || symbol.declarations === undefined ||
                symbol.declarations.length !== 1) {
                throw new Error("Cannot resolve qualified type entity lhs to symbol");
            }
            var decl = symbol.declarations[0];
            if (ts.isNamespaceImport(decl)) {
                var clause = decl.parent;
                var importDecl = clause.parent;
                if (!ts.isStringLiteral(importDecl.moduleSpecifier)) {
                    throw new Error("Module specifier is not a string");
                }
                return { node: node, from: importDecl.moduleSpecifier.text };
            }
            else {
                throw new Error("Unknown import type?");
            }
        }
        else {
            return { node: node, from: null };
        }
    }
    exports.reflectTypeEntityToDeclaration = reflectTypeEntityToDeclaration;
    function filterToMembersWithDecorator(members, name, module) {
        return members.filter(function (member) { return !member.isStatic; })
            .map(function (member) {
            if (member.decorators === null) {
                return null;
            }
            var decorators = member.decorators.filter(function (dec) {
                if (dec.import !== null) {
                    return dec.import.name === name && (module === undefined || dec.import.from === module);
                }
                else {
                    return dec.name === name && module === undefined;
                }
            });
            if (decorators.length === 0) {
                return null;
            }
            return { member: member, decorators: decorators };
        })
            .filter(function (value) { return value !== null; });
    }
    exports.filterToMembersWithDecorator = filterToMembersWithDecorator;
    function findMember(members, name, isStatic) {
        if (isStatic === void 0) { isStatic = false; }
        return members.find(function (member) { return member.isStatic === isStatic && member.name === name; }) || null;
    }
    exports.findMember = findMember;
    function reflectObjectLiteral(node) {
        var map = new Map();
        node.properties.forEach(function (prop) {
            if (ts.isPropertyAssignment(prop)) {
                var name_1 = propertyNameToString(prop.name);
                if (name_1 === null) {
                    return;
                }
                map.set(name_1, prop.initializer);
            }
            else if (ts.isShorthandPropertyAssignment(prop)) {
                map.set(prop.name.text, prop.name);
            }
            else {
                return;
            }
        });
        return map;
    }
    exports.reflectObjectLiteral = reflectObjectLiteral;
    function castDeclarationToClassOrDie(declaration) {
        if (!ts.isClassDeclaration(declaration)) {
            throw new Error("Reflecting on a " + ts.SyntaxKind[declaration.kind] + " instead of a ClassDeclaration.");
        }
        return declaration;
    }
    function parameterName(name) {
        if (ts.isIdentifier(name)) {
            return name.text;
        }
        else {
            return null;
        }
    }
    function propertyNameToString(node) {
        if (ts.isIdentifier(node) || ts.isStringLiteral(node) || ts.isNumericLiteral(node)) {
            return node.text;
        }
        else {
            return null;
        }
    }
    /**
     * Compute the left most identifier in a qualified type chain. E.g. the `a` of `a.b.c.SomeType`.
     * @param qualifiedName The starting property access expression from which we want to compute
     * the left most identifier.
     * @returns the left most identifier in the chain or `null` if it is not an identifier.
     */
    function getQualifiedNameRoot(qualifiedName) {
        while (ts.isQualifiedName(qualifiedName.left)) {
            qualifiedName = qualifiedName.left;
        }
        return ts.isIdentifier(qualifiedName.left) ? qualifiedName.left : null;
    }
    /**
     * Compute the left most identifier in a property access chain. E.g. the `a` of `a.b.c.d`.
     * @param propertyAccess The starting property access expression from which we want to compute
     * the left most identifier.
     * @returns the left most identifier in the chain or `null` if it is not an identifier.
     */
    function getFarLeftIdentifier(propertyAccess) {
        while (ts.isPropertyAccessExpression(propertyAccess.expression)) {
            propertyAccess = propertyAccess.expression;
        }
        return ts.isIdentifier(propertyAccess.expression) ? propertyAccess.expression : null;
    }
    /**
     * Return the ImportDeclaration for the given `node` if it is either an `ImportSpecifier` or a
     * `NamespaceImport`. If not return `null`.
     */
    function getContainingImportDeclaration(node) {
        return ts.isImportSpecifier(node) ? node.parent.parent.parent :
            ts.isNamespaceImport(node) ? node.parent.parent : null;
    }
    /**
     * Compute the name by which the `decl` was exported, not imported.
     * If no such declaration can be found (e.g. it is a namespace import)
     * then fallback to the `originalId`.
     */
    function getExportedName(decl, originalId) {
        return ts.isImportSpecifier(decl) ?
            (decl.propertyName !== undefined ? decl.propertyName : decl.name).text :
            originalId.text;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXNjcmlwdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvcmVmbGVjdGlvbi9zcmMvdHlwZXNjcmlwdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7O0dBTUc7Ozs7Ozs7Ozs7Ozs7SUFFSCwrQkFBaUM7SUFFakMsNEVBQWdMO0lBQ2hMLDhGQUE0QztJQUM1Qyw0RUFBK0M7SUFFL0M7O09BRUc7SUFFSDtRQUNFLGtDQUFzQixPQUF1QjtZQUF2QixZQUFPLEdBQVAsT0FBTyxDQUFnQjtRQUFHLENBQUM7UUFFakQsNkRBQTBCLEdBQTFCLFVBQTJCLFdBQTJCO1lBQXRELGlCQU1DO1lBTEMsSUFBSSxXQUFXLENBQUMsVUFBVSxLQUFLLFNBQVMsSUFBSSxXQUFXLENBQUMsVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Z0JBQy9FLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxPQUFPLFdBQVcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQUEsU0FBUyxJQUFJLE9BQUEsS0FBSSxDQUFDLGlCQUFpQixDQUFDLFNBQVMsQ0FBQyxFQUFqQyxDQUFpQyxDQUFDO2lCQUM1RSxNQUFNLENBQUMsVUFBQyxHQUFHLElBQXVCLE9BQUEsR0FBRyxLQUFLLElBQUksRUFBWixDQUFZLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBRUQsb0RBQWlCLEdBQWpCLFVBQWtCLEtBQXVCO1lBQXpDLGlCQUlDO1lBSEMsSUFBTSxPQUFPLEdBQUcsMkJBQTJCLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDbkQsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFBLE1BQU0sSUFBSSxPQUFBLEtBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLEVBQTNCLENBQTJCLENBQUM7aUJBQzVELE1BQU0sQ0FBQyxVQUFDLE1BQU0sSUFBNEIsT0FBQSxNQUFNLEtBQUssSUFBSSxFQUFmLENBQWUsQ0FBQyxDQUFDO1FBQ2xFLENBQUM7UUFFRCwyREFBd0IsR0FBeEIsVUFBeUIsS0FBdUI7WUFBaEQsaUJBb0RDO1lBbkRDLElBQU0sT0FBTyxHQUFHLDJCQUEyQixDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRW5ELDZGQUE2RjtZQUM3RiwwRkFBMEY7WUFDMUYsbUJBQW1CO1lBQ25CLElBQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUM3QixVQUFDLE1BQU07Z0JBQ0gsT0FBQSxFQUFFLENBQUMsd0JBQXdCLENBQUMsTUFBTSxDQUFDLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxTQUFTO1lBQWhFLENBQWdFLENBQUMsQ0FBQztZQUMxRSxJQUFJLElBQUksS0FBSyxTQUFTLEVBQUU7Z0JBQ3RCLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQUEsSUFBSTtnQkFDN0IscUNBQXFDO2dCQUNyQyxJQUFNLElBQUksR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUV0QyxJQUFNLFVBQVUsR0FBRyxLQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBRXpELDRGQUE0RjtnQkFDNUYsZ0NBQWdDO2dCQUVoQyxJQUFJLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDO2dCQUN6QyxJQUFJLFFBQVEsR0FBRyxnQkFBZ0IsQ0FBQztnQkFFaEMsaUZBQWlGO2dCQUNqRix3RkFBd0Y7Z0JBQ3hGLDZGQUE2RjtnQkFDN0YsNENBQTRDO2dCQUM1QyxJQUFJLFFBQVEsSUFBSSxFQUFFLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxFQUFFO29CQUM1QyxJQUFJLGNBQWMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLE1BQU07b0JBQ3RDLG9GQUFvRjtvQkFDcEYsOEVBQThFO29CQUM5RSxVQUFBLGFBQWEsSUFBSSxPQUFBLGFBQWEsQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXO3dCQUM3RCxDQUFDLENBQUMsRUFBRSxDQUFDLGlCQUFpQixDQUFDLGFBQWEsQ0FBQzs0QkFDbkMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxXQUFXLENBQUMsRUFGOUMsQ0FFOEMsQ0FBQyxDQUFDO29CQUVyRSxJQUFJLGNBQWMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO3dCQUMvQixRQUFRLEdBQUcsY0FBYyxDQUFDLENBQUMsQ0FBQyxDQUFDO3FCQUM5QjtpQkFDRjtnQkFFRCxJQUFNLGtCQUFrQixHQUFHLDJCQUFXLENBQUMsUUFBUSxFQUFFLEtBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFFL0QsT0FBTztvQkFDTCxJQUFJLE1BQUE7b0JBQ0osUUFBUSxFQUFFLElBQUksQ0FBQyxJQUFJO29CQUNuQixrQkFBa0Isb0JBQUE7b0JBQ2xCLFFBQVEsRUFBRSxnQkFBZ0I7b0JBQzFCLFVBQVUsWUFBQTtpQkFDWCxDQUFDO1lBQ0osQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO1FBRUQsd0RBQXFCLEdBQXJCLFVBQXNCLEVBQWlCO1lBQ3JDLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUMxRCxJQUFJLFlBQVksS0FBSyxJQUFJLEVBQUU7Z0JBQ3pCLE9BQU8sWUFBWSxDQUFDO2FBQ3JCO2lCQUFNLElBQUksRUFBRSxDQUFDLGVBQWUsQ0FBQyxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEtBQUssRUFBRSxFQUFFO2dCQUNsRSxPQUFPLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxFQUFFLEVBQUUsb0JBQW9CLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7YUFDbEY7aUJBQU0sSUFBSSxFQUFFLENBQUMsMEJBQTBCLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLEVBQUUsRUFBRTtnQkFDNUUsT0FBTyxJQUFJLENBQUMsK0JBQStCLENBQUMsRUFBRSxFQUFFLG9CQUFvQixDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO2FBQ2xGO2lCQUFNO2dCQUNMLE9BQU8sSUFBSSxDQUFDO2FBQ2I7UUFDSCxDQUFDO1FBRUQscURBQWtCLEdBQWxCLFVBQW1CLElBQWE7WUFBaEMsaUJBcUJDO1lBcEJDLHlGQUF5RjtZQUN6RixJQUFJLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDMUIsTUFBTSxJQUFJLEtBQUssQ0FBQywwREFBMEQsQ0FBQyxDQUFDO2FBQzdFO1lBQ0QsSUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQXVCLENBQUM7WUFFM0MseUZBQXlGO1lBQ3pGLFdBQVc7WUFDWCxJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3RELElBQUksTUFBTSxLQUFLLFNBQVMsRUFBRTtnQkFDeEIsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsTUFBTSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsWUFBWTtnQkFDMUQsbUVBQW1FO2dCQUNuRSxJQUFNLElBQUksR0FBRyxLQUFJLENBQUMsc0JBQXNCLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUM3RCxJQUFJLElBQUksS0FBSyxJQUFJLEVBQUU7b0JBQ2pCLEdBQUcsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztpQkFDbEM7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUNILE9BQU8sR0FBRyxDQUFDO1FBQ2IsQ0FBQztRQUVELDBDQUFPLEdBQVAsVUFBUSxJQUFhO1lBQ25CLDhEQUE4RDtZQUM5RCw2RkFBNkY7WUFDN0YsT0FBTyw4QkFBdUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN2QyxDQUFDO1FBRUQsK0NBQVksR0FBWixVQUFhLEtBQXVCO1lBQ2xDLE9BQU8sSUFBSSxDQUFDLHNCQUFzQixDQUFDLEtBQUssQ0FBQyxLQUFLLElBQUksQ0FBQztRQUNyRCxDQUFDO1FBRUQseURBQXNCLEdBQXRCLFVBQXVCLEtBQXVCO1lBQzVDLElBQUksQ0FBQyxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzlELEtBQUssQ0FBQyxlQUFlLEtBQUssU0FBUyxFQUFFO2dCQUN2QyxPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxhQUFhLEdBQ2YsS0FBSyxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsVUFBQSxNQUFNLElBQUksT0FBQSxNQUFNLENBQUMsS0FBSyxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsY0FBYyxFQUE3QyxDQUE2QyxDQUFDLENBQUM7WUFDeEYsSUFBSSxhQUFhLEtBQUssU0FBUyxFQUFFO2dCQUMvQixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxXQUFXLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUMzQyxJQUFJLFdBQVcsS0FBSyxTQUFTLEVBQUU7Z0JBQzdCLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxPQUFPLFdBQVcsQ0FBQyxVQUFVLENBQUM7UUFDaEMsQ0FBQztRQUVELDZEQUEwQixHQUExQixVQUEyQixFQUFpQjtZQUMxQywwRUFBMEU7WUFDMUUsSUFBSSxNQUFNLEdBQXdCLElBQUksQ0FBQyxPQUFPLENBQUMsbUJBQW1CLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDdkUsSUFBSSxNQUFNLEtBQUssU0FBUyxFQUFFO2dCQUN4QixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQ2pELENBQUM7UUFFRCwwREFBdUIsR0FBdkIsVUFBd0IsSUFBYTtZQUNuQyxJQUFJLENBQUMsRUFBRSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQztnQkFDaEUsQ0FBQyxFQUFFLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ2xDLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxPQUFPO2dCQUNMLElBQUksTUFBQTtnQkFDSixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksS0FBSyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSTtnQkFDdkUsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQUEsS0FBSztvQkFDbkMsSUFBTSxJQUFJLEdBQUcsYUFBYSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDdkMsSUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUM7b0JBQzlDLE9BQU8sRUFBQyxJQUFJLE1BQUEsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLFdBQVcsYUFBQSxFQUFDLENBQUM7Z0JBQzFDLENBQUMsQ0FBQzthQUNILENBQUM7UUFDSixDQUFDO1FBRUQseURBQXNCLEdBQXRCLFVBQXVCLEtBQXVCO1lBQzVDLElBQUksQ0FBQyxFQUFFLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDLEVBQUU7Z0JBQ2pDLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxPQUFPLEtBQUssQ0FBQyxjQUFjLEtBQUssU0FBUyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlFLENBQUM7UUFFRCxtREFBZ0IsR0FBaEIsVUFBaUIsV0FBbUM7WUFDbEQsT0FBTyxXQUFXLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQztRQUN6QyxDQUFDO1FBRUQsb0RBQWlCLEdBQWpCLFVBQWtCLENBQWlCO1lBQ2pDLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUVELHlEQUFzQixHQUF0QixVQUF1QixLQUF1QjtZQUM1QyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDcEIsQ0FBQztRQUVELHlEQUFzQixHQUF0QixVQUF1QixLQUF1QjtZQUM1QyxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUM7UUFDcEIsQ0FBQztRQUVTLDhEQUEyQixHQUFyQyxVQUFzQyxFQUFpQjtZQUNyRCxJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLG1CQUFtQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBRXBELElBQUksTUFBTSxLQUFLLFNBQVMsSUFBSSxNQUFNLENBQUMsWUFBWSxLQUFLLFNBQVM7Z0JBQ3pELE1BQU0sQ0FBQyxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDcEMsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELElBQU0sSUFBSSxHQUFtQixNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3BELElBQU0sVUFBVSxHQUFHLDhCQUE4QixDQUFDLElBQUksQ0FBQyxDQUFDO1lBRXhELCtEQUErRDtZQUMvRCxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7Z0JBQ3ZCLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCx5RkFBeUY7WUFDekYsSUFBSSxDQUFDLEVBQUUsQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLGVBQWUsQ0FBQyxFQUFFO2dCQUNuRCw0Q0FBNEM7Z0JBQzVDLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxPQUFPLEVBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxlQUFlLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxFQUFDLENBQUM7UUFDbEYsQ0FBQztRQUVEOzs7Ozs7Ozs7Ozs7Ozs7OztXQWlCRztRQUNPLGtFQUErQixHQUF6QyxVQUNJLEVBQWlCLEVBQUUsbUJBQXVDO1lBQzVELElBQUksbUJBQW1CLEtBQUssSUFBSSxFQUFFO2dCQUNoQyxPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO1lBQzlFLElBQUksQ0FBQyxlQUFlLEVBQUU7Z0JBQ3BCLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxJQUFNLFdBQVcsR0FDYixlQUFlLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLGVBQWUsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUN2RixJQUFJLENBQUMsV0FBVyxFQUFFO2dCQUNoQixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxvQkFBb0IsR0FBRyxFQUFFLENBQUMsaUJBQWlCLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1lBQ3BGLElBQUksQ0FBQyxvQkFBb0IsRUFBRTtnQkFDekIsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELElBQU0saUJBQWlCLEdBQUcsb0JBQW9CLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztZQUM3RCxJQUFJLENBQUMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQUMsRUFBRTtnQkFDMUQseURBQXlEO2dCQUN6RCxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsT0FBTztnQkFDTCxJQUFJLEVBQUUsaUJBQWlCLENBQUMsZUFBZSxDQUFDLElBQUk7Z0JBQzVDLElBQUksRUFBRSxFQUFFLENBQUMsSUFBSTthQUNkLENBQUM7UUFDSixDQUFDO1FBRUQ7O1dBRUc7UUFDTyx5REFBc0IsR0FBaEMsVUFBaUMsTUFBaUIsRUFBRSxVQUE4QjtZQUVoRixxRUFBcUU7WUFDckUsSUFBSSxnQkFBZ0IsR0FBNkIsU0FBUyxDQUFDO1lBQzNELElBQUksTUFBTSxDQUFDLGdCQUFnQixLQUFLLFNBQVMsRUFBRTtnQkFDekMsZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDO2FBQzVDO2lCQUFNLElBQUksTUFBTSxDQUFDLFlBQVksS0FBSyxTQUFTLElBQUksTUFBTSxDQUFDLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUM5RSxnQkFBZ0IsR0FBRyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzNDO1lBQ0QsSUFBSSxnQkFBZ0IsS0FBSyxTQUFTLElBQUksRUFBRSxDQUFDLDZCQUE2QixDQUFDLGdCQUFnQixDQUFDLEVBQUU7Z0JBQ3hGLElBQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsaUNBQWlDLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDekYsSUFBSSxlQUFlLEtBQUssU0FBUyxFQUFFO29CQUNqQyxPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFDRCxPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxlQUFlLEVBQUUsVUFBVSxDQUFDLENBQUM7YUFDakU7aUJBQU0sSUFBSSxnQkFBZ0IsS0FBSyxTQUFTLElBQUksRUFBRSxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixDQUFDLEVBQUU7Z0JBQ25GLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsbUNBQW1DLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztnQkFDeEYsSUFBSSxZQUFZLEtBQUssU0FBUyxFQUFFO29CQUM5QixPQUFPLElBQUksQ0FBQztpQkFDYjtnQkFDRCxPQUFPLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxZQUFZLEVBQUUsVUFBVSxDQUFDLENBQUM7YUFDOUQ7WUFFRCxJQUFNLFVBQVUsR0FBRyxVQUFVLElBQUksSUFBSSxDQUFDLHFCQUFxQixDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3hFLElBQU0sU0FBUyxHQUNYLFVBQVUsS0FBSyxJQUFJLElBQUksVUFBVSxDQUFDLElBQUksS0FBSyxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO2dCQUNyRixVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ2pCLElBQUksQ0FBQztZQUVULCtFQUErRTtZQUMvRSxPQUFPLE1BQU0sQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Z0JBQzFDLE1BQU0sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQ2hEO1lBRUQsZ0dBQWdHO1lBQ2hHLCtDQUErQztZQUMvQyxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsS0FBSyxTQUFTLEVBQUU7Z0JBQ3pDLE9BQU87b0JBQ0wsSUFBSSxFQUFFLE1BQU0sQ0FBQyxnQkFBZ0I7b0JBQzdCLEtBQUssRUFBRSxJQUFJO29CQUNYLFNBQVMsV0FBQTtvQkFDVCxRQUFRLEVBQUUsSUFBSTtpQkFDZixDQUFDO2FBQ0g7aUJBQU0sSUFBSSxNQUFNLENBQUMsWUFBWSxLQUFLLFNBQVMsSUFBSSxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7Z0JBQzlFLE9BQU87b0JBQ0wsSUFBSSxFQUFFLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO29CQUM1QixLQUFLLEVBQUUsSUFBSTtvQkFDWCxTQUFTLFdBQUE7b0JBQ1QsUUFBUSxFQUFFLElBQUk7aUJBQ2YsQ0FBQzthQUNIO2lCQUFNO2dCQUNMLE9BQU8sSUFBSSxDQUFDO2FBQ2I7UUFDSCxDQUFDO1FBRU8sb0RBQWlCLEdBQXpCLFVBQTBCLElBQWtCO1lBQzFDLDZGQUE2RjtZQUM3Riw2RkFBNkY7WUFDN0Ysd0NBQXdDO1lBQ3hDLElBQUksYUFBYSxHQUFrQixJQUFJLENBQUMsVUFBVSxDQUFDO1lBQ25ELElBQUksSUFBSSxHQUF5QixJQUFJLENBQUM7WUFFdEMsOEJBQThCO1lBQzlCLElBQUksRUFBRSxDQUFDLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxFQUFFO2dCQUN0QyxJQUFJLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzNDLGFBQWEsR0FBRyxhQUFhLENBQUMsVUFBVSxDQUFDO2FBQzFDO1lBRUQsNEZBQTRGO1lBQzVGLHdEQUF3RDtZQUN4RCxJQUFJLENBQUMsNEJBQXFCLENBQUMsYUFBYSxDQUFDLEVBQUU7Z0JBQ3pDLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxJQUFNLG1CQUFtQixHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztZQUNoRyxJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMscUJBQXFCLENBQUMsbUJBQW1CLENBQUMsQ0FBQztZQUVuRSxPQUFPO2dCQUNMLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxJQUFJO2dCQUM5QixVQUFVLEVBQUUsYUFBYTtnQkFDekIsTUFBTSxFQUFFLFVBQVU7Z0JBQ2xCLElBQUksTUFBQTtnQkFDSixJQUFJLE1BQUE7YUFDTCxDQUFDO1FBQ0osQ0FBQztRQUVPLGlEQUFjLEdBQXRCLFVBQXVCLElBQXFCO1lBQzFDLElBQUksSUFBSSxHQUF5QixJQUFJLENBQUM7WUFDdEMsSUFBSSxLQUFLLEdBQXVCLElBQUksQ0FBQztZQUNyQyxJQUFJLElBQUksR0FBZ0IsSUFBSSxDQUFDO1lBQzdCLElBQUksUUFBUSxHQUF3QyxJQUFJLENBQUM7WUFFekQsSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ2xDLElBQUksR0FBRyxzQkFBZSxDQUFDLFFBQVEsQ0FBQztnQkFDaEMsS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDO2FBQ2xDO2lCQUFNLElBQUksRUFBRSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM1QyxJQUFJLEdBQUcsc0JBQWUsQ0FBQyxNQUFNLENBQUM7YUFDL0I7aUJBQU0sSUFBSSxFQUFFLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzVDLElBQUksR0FBRyxzQkFBZSxDQUFDLE1BQU0sQ0FBQzthQUMvQjtpQkFBTSxJQUFJLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDdkMsSUFBSSxHQUFHLHNCQUFlLENBQUMsTUFBTSxDQUFDO2FBQy9CO2lCQUFNLElBQUksRUFBRSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM1QyxJQUFJLEdBQUcsc0JBQWUsQ0FBQyxXQUFXLENBQUM7YUFDcEM7aUJBQU07Z0JBQ0wsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUVELElBQUksRUFBRSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNyQyxJQUFJLEdBQUcsYUFBYSxDQUFDO2FBQ3RCO2lCQUFNLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ3JDLElBQUksR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDdEIsUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUM7YUFDdEI7aUJBQU0sSUFBSSxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDeEMsSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO2dCQUN0QixRQUFRLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQzthQUN0QjtpQkFBTTtnQkFDTCxPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsSUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLDBCQUEwQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3pELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTLEtBQUssU0FBUztnQkFDekMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsVUFBQSxHQUFHLElBQUksT0FBQSxHQUFHLENBQUMsSUFBSSxLQUFLLEVBQUUsQ0FBQyxVQUFVLENBQUMsYUFBYSxFQUF4QyxDQUF3QyxDQUFDLENBQUM7WUFFekUsT0FBTztnQkFDTCxJQUFJLE1BQUE7Z0JBQ0osY0FBYyxFQUFFLElBQUk7Z0JBQ3BCLElBQUksTUFBQTtnQkFDSixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJO2dCQUN2QixJQUFJLE1BQUE7Z0JBQ0osUUFBUSxVQUFBO2dCQUNSLFVBQVUsWUFBQTtnQkFDVixLQUFLLE9BQUE7Z0JBQ0wsUUFBUSxVQUFBO2FBQ1QsQ0FBQztRQUNKLENBQUM7UUFDSCwrQkFBQztJQUFELENBQUMsQUExWUQsSUEwWUM7SUExWVksNERBQXdCO0lBNFlyQyxTQUFnQix3QkFBd0IsQ0FBQyxJQUFvQjtRQUMzRCxJQUFNLEVBQUUsR0FBRyw4QkFBOEIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNoRCxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztJQUMvQixDQUFDO0lBSEQsNERBR0M7SUFFRCxTQUFnQiw4QkFBOEIsQ0FBQyxJQUFvQjtRQUNqRSxJQUFJLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDakUsT0FBTyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztTQUMxQjthQUFNLElBQUksRUFBRSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ3pDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzlCLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQzthQUNsQjtTQUNGO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBVEQsd0VBU0M7SUFFRCxTQUFnQiw4QkFBOEIsQ0FDMUMsSUFBbUIsRUFBRSxPQUF1QjtRQUM5QyxJQUFJLFVBQVUsR0FBRyxPQUFPLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDbkQsSUFBSSxVQUFVLEtBQUssU0FBUyxFQUFFO1lBQzVCLE1BQU0sSUFBSSxLQUFLLENBQUMsZ0NBQThCLElBQUksQ0FBQyxPQUFPLEVBQUUsZUFBWSxDQUFDLENBQUM7U0FDM0U7UUFDRCxPQUFPLFVBQVUsQ0FBQyxLQUFLLEdBQUcsRUFBRSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUU7WUFDOUMsVUFBVSxHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUNuRDtRQUVELElBQUksSUFBSSxHQUF3QixJQUFJLENBQUM7UUFDckMsSUFBSSxVQUFVLENBQUMsZ0JBQWdCLEtBQUssU0FBUyxFQUFFO1lBQzdDLElBQUksR0FBRyxVQUFVLENBQUMsZ0JBQWdCLENBQUM7U0FDcEM7YUFBTSxJQUFJLFVBQVUsQ0FBQyxZQUFZLEtBQUssU0FBUyxJQUFJLFVBQVUsQ0FBQyxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN4RixJQUFJLEdBQUcsVUFBVSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQztTQUNuQzthQUFNO1lBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyxrREFBa0QsQ0FBQyxDQUFDO1NBQ3JFO1FBRUQsSUFBSSxFQUFFLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzVCLElBQUksQ0FBQyxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDL0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO2FBQ3pFO1lBQ0QsSUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN0RCxJQUFJLE1BQU0sS0FBSyxTQUFTLElBQUksTUFBTSxDQUFDLFlBQVksS0FBSyxTQUFTO2dCQUN6RCxNQUFNLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Z0JBQ3BDLE1BQU0sSUFBSSxLQUFLLENBQUMsb0RBQW9ELENBQUMsQ0FBQzthQUN2RTtZQUNELElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEMsSUFBSSxFQUFFLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzlCLElBQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFPLENBQUM7Z0JBQzVCLElBQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxNQUFPLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxFQUFFLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxlQUFlLENBQUMsRUFBRTtvQkFDbkQsTUFBTSxJQUFJLEtBQUssQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO2lCQUNyRDtnQkFDRCxPQUFPLEVBQUMsSUFBSSxNQUFBLEVBQUUsSUFBSSxFQUFFLFVBQVUsQ0FBQyxlQUFlLENBQUMsSUFBSSxFQUFDLENBQUM7YUFDdEQ7aUJBQU07Z0JBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO2FBQ3pDO1NBQ0Y7YUFBTTtZQUNMLE9BQU8sRUFBQyxJQUFJLE1BQUEsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFDLENBQUM7U0FDM0I7SUFDSCxDQUFDO0lBMUNELHdFQTBDQztJQUVELFNBQWdCLDRCQUE0QixDQUFDLE9BQXNCLEVBQUUsSUFBWSxFQUFFLE1BQWU7UUFFaEcsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQUEsTUFBTSxJQUFJLE9BQUEsQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFoQixDQUFnQixDQUFDO2FBQzVDLEdBQUcsQ0FBQyxVQUFBLE1BQU07WUFDVCxJQUFJLE1BQU0sQ0FBQyxVQUFVLEtBQUssSUFBSSxFQUFFO2dCQUM5QixPQUFPLElBQUksQ0FBQzthQUNiO1lBRUQsSUFBTSxVQUFVLEdBQUcsTUFBTSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsVUFBQSxHQUFHO2dCQUM3QyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssSUFBSSxFQUFFO29CQUN2QixPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxTQUFTLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUM7aUJBQ3pGO3FCQUFNO29CQUNMLE9BQU8sR0FBRyxDQUFDLElBQUksS0FBSyxJQUFJLElBQUksTUFBTSxLQUFLLFNBQVMsQ0FBQztpQkFDbEQ7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7Z0JBQzNCLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFFRCxPQUFPLEVBQUMsTUFBTSxRQUFBLEVBQUUsVUFBVSxZQUFBLEVBQUMsQ0FBQztRQUM5QixDQUFDLENBQUM7YUFDRCxNQUFNLENBQUMsVUFBQyxLQUFLLElBQThELE9BQUEsS0FBSyxLQUFLLElBQUksRUFBZCxDQUFjLENBQUMsQ0FBQztJQUNsRyxDQUFDO0lBdkJELG9FQXVCQztJQUVELFNBQWdCLFVBQVUsQ0FDdEIsT0FBc0IsRUFBRSxJQUFZLEVBQUUsUUFBeUI7UUFBekIseUJBQUEsRUFBQSxnQkFBeUI7UUFDakUsT0FBTyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQUEsTUFBTSxJQUFJLE9BQUEsTUFBTSxDQUFDLFFBQVEsS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLElBQUksS0FBSyxJQUFJLEVBQXBELENBQW9ELENBQUMsSUFBSSxJQUFJLENBQUM7SUFDOUYsQ0FBQztJQUhELGdDQUdDO0lBRUQsU0FBZ0Isb0JBQW9CLENBQUMsSUFBZ0M7UUFDbkUsSUFBTSxHQUFHLEdBQUcsSUFBSSxHQUFHLEVBQXlCLENBQUM7UUFDN0MsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQSxJQUFJO1lBQzFCLElBQUksRUFBRSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNqQyxJQUFNLE1BQUksR0FBRyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzdDLElBQUksTUFBSSxLQUFLLElBQUksRUFBRTtvQkFDakIsT0FBTztpQkFDUjtnQkFDRCxHQUFHLENBQUMsR0FBRyxDQUFDLE1BQUksRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7YUFDakM7aUJBQU0sSUFBSSxFQUFFLENBQUMsNkJBQTZCLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ2pELEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ3BDO2lCQUFNO2dCQUNMLE9BQU87YUFDUjtRQUNILENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxHQUFHLENBQUM7SUFDYixDQUFDO0lBaEJELG9EQWdCQztJQUVELFNBQVMsMkJBQTJCLENBQUMsV0FBNkI7UUFFaEUsSUFBSSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUN2QyxNQUFNLElBQUksS0FBSyxDQUNYLHFCQUFtQixFQUFFLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsb0NBQWlDLENBQUMsQ0FBQztTQUMxRjtRQUNELE9BQU8sV0FBVyxDQUFDO0lBQ3JCLENBQUM7SUFFRCxTQUFTLGFBQWEsQ0FBQyxJQUFvQjtRQUN6QyxJQUFJLEVBQUUsQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDekIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO1NBQ2xCO2FBQU07WUFDTCxPQUFPLElBQUksQ0FBQztTQUNiO0lBQ0gsQ0FBQztJQUVELFNBQVMsb0JBQW9CLENBQUMsSUFBcUI7UUFDakQsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLGdCQUFnQixDQUFDLElBQUksQ0FBQyxFQUFFO1lBQ2xGLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztTQUNsQjthQUFNO1lBQ0wsT0FBTyxJQUFJLENBQUM7U0FDYjtJQUNILENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILFNBQVMsb0JBQW9CLENBQUMsYUFBK0I7UUFDM0QsT0FBTyxFQUFFLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM3QyxhQUFhLEdBQUcsYUFBYSxDQUFDLElBQUksQ0FBQztTQUNwQztRQUNELE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUN6RSxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxTQUFTLG9CQUFvQixDQUFDLGNBQTJDO1FBQ3ZFLE9BQU8sRUFBRSxDQUFDLDBCQUEwQixDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsRUFBRTtZQUMvRCxjQUFjLEdBQUcsY0FBYyxDQUFDLFVBQVUsQ0FBQztTQUM1QztRQUNELE9BQU8sRUFBRSxDQUFDLFlBQVksQ0FBQyxjQUFjLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztJQUN2RixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBUyw4QkFBOEIsQ0FBQyxJQUFhO1FBQ25ELE9BQU8sRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsTUFBTyxDQUFDLE1BQU8sQ0FBQyxNQUFPLENBQUMsQ0FBQztZQUM5QixFQUFFLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDN0YsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxTQUFTLGVBQWUsQ0FBQyxJQUFvQixFQUFFLFVBQXlCO1FBQ3RFLE9BQU8sRUFBRSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDL0IsQ0FBQyxJQUFJLENBQUMsWUFBWSxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3hFLFVBQVUsQ0FBQyxJQUFJLENBQUM7SUFDdEIsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtDbGFzc0RlY2xhcmF0aW9uLCBDbGFzc01lbWJlciwgQ2xhc3NNZW1iZXJLaW5kLCBDdG9yUGFyYW1ldGVyLCBEZWNsYXJhdGlvbiwgRGVjb3JhdG9yLCBGdW5jdGlvbkRlZmluaXRpb24sIEltcG9ydCwgaXNEZWNvcmF0b3JJZGVudGlmaWVyLCBSZWZsZWN0aW9uSG9zdH0gZnJvbSAnLi9ob3N0JztcbmltcG9ydCB7dHlwZVRvVmFsdWV9IGZyb20gJy4vdHlwZV90b192YWx1ZSc7XG5pbXBvcnQge2lzTmFtZWRDbGFzc0RlY2xhcmF0aW9ufSBmcm9tICcuL3V0aWwnO1xuXG4vKipcbiAqIHJlZmxlY3Rvci50cyBpbXBsZW1lbnRzIHN0YXRpYyByZWZsZWN0aW9uIG9mIGRlY2xhcmF0aW9ucyB1c2luZyB0aGUgVHlwZVNjcmlwdCBgdHMuVHlwZUNoZWNrZXJgLlxuICovXG5cbmV4cG9ydCBjbGFzcyBUeXBlU2NyaXB0UmVmbGVjdGlvbkhvc3QgaW1wbGVtZW50cyBSZWZsZWN0aW9uSG9zdCB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBjaGVja2VyOiB0cy5UeXBlQ2hlY2tlcikge31cblxuICBnZXREZWNvcmF0b3JzT2ZEZWNsYXJhdGlvbihkZWNsYXJhdGlvbjogdHMuRGVjbGFyYXRpb24pOiBEZWNvcmF0b3JbXXxudWxsIHtcbiAgICBpZiAoZGVjbGFyYXRpb24uZGVjb3JhdG9ycyA9PT0gdW5kZWZpbmVkIHx8IGRlY2xhcmF0aW9uLmRlY29yYXRvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGRlY2xhcmF0aW9uLmRlY29yYXRvcnMubWFwKGRlY29yYXRvciA9PiB0aGlzLl9yZWZsZWN0RGVjb3JhdG9yKGRlY29yYXRvcikpXG4gICAgICAgIC5maWx0ZXIoKGRlYyk6IGRlYyBpcyBEZWNvcmF0b3IgPT4gZGVjICE9PSBudWxsKTtcbiAgfVxuXG4gIGdldE1lbWJlcnNPZkNsYXNzKGNsYXp6OiBDbGFzc0RlY2xhcmF0aW9uKTogQ2xhc3NNZW1iZXJbXSB7XG4gICAgY29uc3QgdHNDbGF6eiA9IGNhc3REZWNsYXJhdGlvblRvQ2xhc3NPckRpZShjbGF6eik7XG4gICAgcmV0dXJuIHRzQ2xhenoubWVtYmVycy5tYXAobWVtYmVyID0+IHRoaXMuX3JlZmxlY3RNZW1iZXIobWVtYmVyKSlcbiAgICAgICAgLmZpbHRlcigobWVtYmVyKTogbWVtYmVyIGlzIENsYXNzTWVtYmVyID0+IG1lbWJlciAhPT0gbnVsbCk7XG4gIH1cblxuICBnZXRDb25zdHJ1Y3RvclBhcmFtZXRlcnMoY2xheno6IENsYXNzRGVjbGFyYXRpb24pOiBDdG9yUGFyYW1ldGVyW118bnVsbCB7XG4gICAgY29uc3QgdHNDbGF6eiA9IGNhc3REZWNsYXJhdGlvblRvQ2xhc3NPckRpZShjbGF6eik7XG5cbiAgICAvLyBGaXJzdCwgZmluZCB0aGUgY29uc3RydWN0b3Igd2l0aCBhIGBib2R5YC4gVGhlIGNvbnN0cnVjdG9ycyB3aXRob3V0IGEgYGJvZHlgIGFyZSBvdmVybG9hZHNcbiAgICAvLyB3aGVyZWFzIHdlIHdhbnQgdGhlIGltcGxlbWVudGF0aW9uIHNpbmNlIGl0J3MgdGhlIG9uZSB0aGF0J2xsIGJlIGV4ZWN1dGVkIGFuZCB3aGljaCBjYW5cbiAgICAvLyBoYXZlIGRlY29yYXRvcnMuXG4gICAgY29uc3QgY3RvciA9IHRzQ2xhenoubWVtYmVycy5maW5kKFxuICAgICAgICAobWVtYmVyKTogbWVtYmVyIGlzIHRzLkNvbnN0cnVjdG9yRGVjbGFyYXRpb24gPT5cbiAgICAgICAgICAgIHRzLmlzQ29uc3RydWN0b3JEZWNsYXJhdGlvbihtZW1iZXIpICYmIG1lbWJlci5ib2R5ICE9PSB1bmRlZmluZWQpO1xuICAgIGlmIChjdG9yID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiBjdG9yLnBhcmFtZXRlcnMubWFwKG5vZGUgPT4ge1xuICAgICAgLy8gVGhlIG5hbWUgb2YgdGhlIHBhcmFtZXRlciBpcyBlYXN5LlxuICAgICAgY29uc3QgbmFtZSA9IHBhcmFtZXRlck5hbWUobm9kZS5uYW1lKTtcblxuICAgICAgY29uc3QgZGVjb3JhdG9ycyA9IHRoaXMuZ2V0RGVjb3JhdG9yc09mRGVjbGFyYXRpb24obm9kZSk7XG5cbiAgICAgIC8vIEl0IG1heSBvciBtYXkgbm90IGJlIHBvc3NpYmxlIHRvIHdyaXRlIGFuIGV4cHJlc3Npb24gdGhhdCByZWZlcnMgdG8gdGhlIHZhbHVlIHNpZGUgb2YgdGhlXG4gICAgICAvLyB0eXBlIG5hbWVkIGZvciB0aGUgcGFyYW1ldGVyLlxuXG4gICAgICBsZXQgb3JpZ2luYWxUeXBlTm9kZSA9IG5vZGUudHlwZSB8fCBudWxsO1xuICAgICAgbGV0IHR5cGVOb2RlID0gb3JpZ2luYWxUeXBlTm9kZTtcblxuICAgICAgLy8gQ2hlY2sgaWYgd2UgYXJlIGRlYWxpbmcgd2l0aCBhIHNpbXBsZSBudWxsYWJsZSB1bmlvbiB0eXBlIGUuZy4gYGZvbzogRm9vfG51bGxgXG4gICAgICAvLyBhbmQgZXh0cmFjdCB0aGUgdHlwZS4gTW9yZSBjb21wbGV4IHVuaW9uIHR5cGVzIGUuZy4gYGZvbzogRm9vfEJhcmAgYXJlIG5vdCBzdXBwb3J0ZWQuXG4gICAgICAvLyBXZSBhbHNvIGRvbid0IG5lZWQgdG8gc3VwcG9ydCBgZm9vOiBGb298dW5kZWZpbmVkYCBiZWNhdXNlIEFuZ3VsYXIncyBESSBpbmplY3RzIGBudWxsYCBmb3JcbiAgICAgIC8vIG9wdGlvbmFsIHRva2VzIHRoYXQgZG9uJ3QgaGF2ZSBwcm92aWRlcnMuXG4gICAgICBpZiAodHlwZU5vZGUgJiYgdHMuaXNVbmlvblR5cGVOb2RlKHR5cGVOb2RlKSkge1xuICAgICAgICBsZXQgY2hpbGRUeXBlTm9kZXMgPSB0eXBlTm9kZS50eXBlcy5maWx0ZXIoXG4gICAgICAgICAgICAvLyBUT0RPKGFsYW4tYWdpdXM0KTogcmVtb3ZlIGBjaGlsZFR5cGVOb2RlLmtpbmQgIT09IHRzLlN5bnRheEtpbmQuTnVsbEtleXdvcmRgIHdoZW5cbiAgICAgICAgICAgIC8vIFRTIDMuOSBzdXBwb3J0IGlzIGRyb3BwZWQuIEluIFRTIDQuMCBOdWxsS2V5d29yZCBpcyBhIGNoaWxkIG9mIExpdGVyYWxUeXBlLlxuICAgICAgICAgICAgY2hpbGRUeXBlTm9kZSA9PiBjaGlsZFR5cGVOb2RlLmtpbmQgIT09IHRzLlN5bnRheEtpbmQuTnVsbEtleXdvcmQgJiZcbiAgICAgICAgICAgICAgICAhKHRzLmlzTGl0ZXJhbFR5cGVOb2RlKGNoaWxkVHlwZU5vZGUpICYmXG4gICAgICAgICAgICAgICAgICBjaGlsZFR5cGVOb2RlLmxpdGVyYWwua2luZCA9PT0gdHMuU3ludGF4S2luZC5OdWxsS2V5d29yZCkpO1xuXG4gICAgICAgIGlmIChjaGlsZFR5cGVOb2Rlcy5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICB0eXBlTm9kZSA9IGNoaWxkVHlwZU5vZGVzWzBdO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHR5cGVWYWx1ZVJlZmVyZW5jZSA9IHR5cGVUb1ZhbHVlKHR5cGVOb2RlLCB0aGlzLmNoZWNrZXIpO1xuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBuYW1lLFxuICAgICAgICBuYW1lTm9kZTogbm9kZS5uYW1lLFxuICAgICAgICB0eXBlVmFsdWVSZWZlcmVuY2UsXG4gICAgICAgIHR5cGVOb2RlOiBvcmlnaW5hbFR5cGVOb2RlLFxuICAgICAgICBkZWNvcmF0b3JzLFxuICAgICAgfTtcbiAgICB9KTtcbiAgfVxuXG4gIGdldEltcG9ydE9mSWRlbnRpZmllcihpZDogdHMuSWRlbnRpZmllcik6IEltcG9ydHxudWxsIHtcbiAgICBjb25zdCBkaXJlY3RJbXBvcnQgPSB0aGlzLmdldERpcmVjdEltcG9ydE9mSWRlbnRpZmllcihpZCk7XG4gICAgaWYgKGRpcmVjdEltcG9ydCAhPT0gbnVsbCkge1xuICAgICAgcmV0dXJuIGRpcmVjdEltcG9ydDtcbiAgICB9IGVsc2UgaWYgKHRzLmlzUXVhbGlmaWVkTmFtZShpZC5wYXJlbnQpICYmIGlkLnBhcmVudC5yaWdodCA9PT0gaWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldEltcG9ydE9mTmFtZXNwYWNlZElkZW50aWZpZXIoaWQsIGdldFF1YWxpZmllZE5hbWVSb290KGlkLnBhcmVudCkpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNQcm9wZXJ0eUFjY2Vzc0V4cHJlc3Npb24oaWQucGFyZW50KSAmJiBpZC5wYXJlbnQubmFtZSA9PT0gaWQpIHtcbiAgICAgIHJldHVybiB0aGlzLmdldEltcG9ydE9mTmFtZXNwYWNlZElkZW50aWZpZXIoaWQsIGdldEZhckxlZnRJZGVudGlmaWVyKGlkLnBhcmVudCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBnZXRFeHBvcnRzT2ZNb2R1bGUobm9kZTogdHMuTm9kZSk6IE1hcDxzdHJpbmcsIERlY2xhcmF0aW9uPnxudWxsIHtcbiAgICAvLyBJbiBUeXBlU2NyaXB0IGNvZGUsIG1vZHVsZXMgYXJlIG9ubHkgdHMuU291cmNlRmlsZXMuIFRocm93IGlmIHRoZSBub2RlIGlzbid0IGEgbW9kdWxlLlxuICAgIGlmICghdHMuaXNTb3VyY2VGaWxlKG5vZGUpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYGdldEV4cG9ydHNPZk1vZHVsZSgpIGNhbGxlZCBvbiBub24tU291cmNlRmlsZSBpbiBUUyBjb2RlYCk7XG4gICAgfVxuICAgIGNvbnN0IG1hcCA9IG5ldyBNYXA8c3RyaW5nLCBEZWNsYXJhdGlvbj4oKTtcblxuICAgIC8vIFJlZmxlY3QgdGhlIG1vZHVsZSB0byBhIFN5bWJvbCwgYW5kIHVzZSBnZXRFeHBvcnRzT2ZNb2R1bGUoKSB0byBnZXQgYSBsaXN0IG9mIGV4cG9ydGVkXG4gICAgLy8gU3ltYm9scy5cbiAgICBjb25zdCBzeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihub2RlKTtcbiAgICBpZiAoc3ltYm9sID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICB0aGlzLmNoZWNrZXIuZ2V0RXhwb3J0c09mTW9kdWxlKHN5bWJvbCkuZm9yRWFjaChleHBvcnRTeW1ib2wgPT4ge1xuICAgICAgLy8gTWFwIGVhY2ggZXhwb3J0ZWQgU3ltYm9sIHRvIGEgRGVjbGFyYXRpb24gYW5kIGFkZCBpdCB0byB0aGUgbWFwLlxuICAgICAgY29uc3QgZGVjbCA9IHRoaXMuZ2V0RGVjbGFyYXRpb25PZlN5bWJvbChleHBvcnRTeW1ib2wsIG51bGwpO1xuICAgICAgaWYgKGRlY2wgIT09IG51bGwpIHtcbiAgICAgICAgbWFwLnNldChleHBvcnRTeW1ib2wubmFtZSwgZGVjbCk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgcmV0dXJuIG1hcDtcbiAgfVxuXG4gIGlzQ2xhc3Mobm9kZTogdHMuTm9kZSk6IG5vZGUgaXMgQ2xhc3NEZWNsYXJhdGlvbiB7XG4gICAgLy8gRm9yIG91ciBwdXJwb3NlcywgY2xhc3NlcyBhcmUgXCJuYW1lZFwiIHRzLkNsYXNzRGVjbGFyYXRpb25zO1xuICAgIC8vIChgbm9kZS5uYW1lYCBjYW4gYmUgdW5kZWZpbmVkIGluIHVubmFtZWQgZGVmYXVsdCBleHBvcnRzOiBgZGVmYXVsdCBleHBvcnQgY2xhc3MgeyAuLi4gfWApLlxuICAgIHJldHVybiBpc05hbWVkQ2xhc3NEZWNsYXJhdGlvbihub2RlKTtcbiAgfVxuXG4gIGhhc0Jhc2VDbGFzcyhjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLmdldEJhc2VDbGFzc0V4cHJlc3Npb24oY2xhenopICE9PSBudWxsO1xuICB9XG5cbiAgZ2V0QmFzZUNsYXNzRXhwcmVzc2lvbihjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IHRzLkV4cHJlc3Npb258bnVsbCB7XG4gICAgaWYgKCEodHMuaXNDbGFzc0RlY2xhcmF0aW9uKGNsYXp6KSB8fCB0cy5pc0NsYXNzRXhwcmVzc2lvbihjbGF6eikpIHx8XG4gICAgICAgIGNsYXp6Lmhlcml0YWdlQ2xhdXNlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgZXh0ZW5kc0NsYXVzZSA9XG4gICAgICAgIGNsYXp6Lmhlcml0YWdlQ2xhdXNlcy5maW5kKGNsYXVzZSA9PiBjbGF1c2UudG9rZW4gPT09IHRzLlN5bnRheEtpbmQuRXh0ZW5kc0tleXdvcmQpO1xuICAgIGlmIChleHRlbmRzQ2xhdXNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBleHRlbmRzVHlwZSA9IGV4dGVuZHNDbGF1c2UudHlwZXNbMF07XG4gICAgaWYgKGV4dGVuZHNUeXBlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICByZXR1cm4gZXh0ZW5kc1R5cGUuZXhwcmVzc2lvbjtcbiAgfVxuXG4gIGdldERlY2xhcmF0aW9uT2ZJZGVudGlmaWVyKGlkOiB0cy5JZGVudGlmaWVyKTogRGVjbGFyYXRpb258bnVsbCB7XG4gICAgLy8gUmVzb2x2ZSB0aGUgaWRlbnRpZmllciB0byBhIFN5bWJvbCwgYW5kIHJldHVybiB0aGUgZGVjbGFyYXRpb24gb2YgdGhhdC5cbiAgICBsZXQgc3ltYm9sOiB0cy5TeW1ib2x8dW5kZWZpbmVkID0gdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24oaWQpO1xuICAgIGlmIChzeW1ib2wgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLmdldERlY2xhcmF0aW9uT2ZTeW1ib2woc3ltYm9sLCBpZCk7XG4gIH1cblxuICBnZXREZWZpbml0aW9uT2ZGdW5jdGlvbihub2RlOiB0cy5Ob2RlKTogRnVuY3Rpb25EZWZpbml0aW9ufG51bGwge1xuICAgIGlmICghdHMuaXNGdW5jdGlvbkRlY2xhcmF0aW9uKG5vZGUpICYmICF0cy5pc01ldGhvZERlY2xhcmF0aW9uKG5vZGUpICYmXG4gICAgICAgICF0cy5pc0Z1bmN0aW9uRXhwcmVzc2lvbihub2RlKSkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIHJldHVybiB7XG4gICAgICBub2RlLFxuICAgICAgYm9keTogbm9kZS5ib2R5ICE9PSB1bmRlZmluZWQgPyBBcnJheS5mcm9tKG5vZGUuYm9keS5zdGF0ZW1lbnRzKSA6IG51bGwsXG4gICAgICBwYXJhbWV0ZXJzOiBub2RlLnBhcmFtZXRlcnMubWFwKHBhcmFtID0+IHtcbiAgICAgICAgY29uc3QgbmFtZSA9IHBhcmFtZXRlck5hbWUocGFyYW0ubmFtZSk7XG4gICAgICAgIGNvbnN0IGluaXRpYWxpemVyID0gcGFyYW0uaW5pdGlhbGl6ZXIgfHwgbnVsbDtcbiAgICAgICAgcmV0dXJuIHtuYW1lLCBub2RlOiBwYXJhbSwgaW5pdGlhbGl6ZXJ9O1xuICAgICAgfSksXG4gICAgfTtcbiAgfVxuXG4gIGdldEdlbmVyaWNBcml0eU9mQ2xhc3MoY2xheno6IENsYXNzRGVjbGFyYXRpb24pOiBudW1iZXJ8bnVsbCB7XG4gICAgaWYgKCF0cy5pc0NsYXNzRGVjbGFyYXRpb24oY2xhenopKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgcmV0dXJuIGNsYXp6LnR5cGVQYXJhbWV0ZXJzICE9PSB1bmRlZmluZWQgPyBjbGF6ei50eXBlUGFyYW1ldGVycy5sZW5ndGggOiAwO1xuICB9XG5cbiAgZ2V0VmFyaWFibGVWYWx1ZShkZWNsYXJhdGlvbjogdHMuVmFyaWFibGVEZWNsYXJhdGlvbik6IHRzLkV4cHJlc3Npb258bnVsbCB7XG4gICAgcmV0dXJuIGRlY2xhcmF0aW9uLmluaXRpYWxpemVyIHx8IG51bGw7XG4gIH1cblxuICBnZXREdHNEZWNsYXJhdGlvbihfOiB0cy5EZWNsYXJhdGlvbik6IHRzLkRlY2xhcmF0aW9ufG51bGwge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgZ2V0SW50ZXJuYWxOYW1lT2ZDbGFzcyhjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IHRzLklkZW50aWZpZXIge1xuICAgIHJldHVybiBjbGF6ei5uYW1lO1xuICB9XG5cbiAgZ2V0QWRqYWNlbnROYW1lT2ZDbGFzcyhjbGF6ejogQ2xhc3NEZWNsYXJhdGlvbik6IHRzLklkZW50aWZpZXIge1xuICAgIHJldHVybiBjbGF6ei5uYW1lO1xuICB9XG5cbiAgcHJvdGVjdGVkIGdldERpcmVjdEltcG9ydE9mSWRlbnRpZmllcihpZDogdHMuSWRlbnRpZmllcik6IEltcG9ydHxudWxsIHtcbiAgICBjb25zdCBzeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbihpZCk7XG5cbiAgICBpZiAoc3ltYm9sID09PSB1bmRlZmluZWQgfHwgc3ltYm9sLmRlY2xhcmF0aW9ucyA9PT0gdW5kZWZpbmVkIHx8XG4gICAgICAgIHN5bWJvbC5kZWNsYXJhdGlvbnMubGVuZ3RoICE9PSAxKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkZWNsOiB0cy5EZWNsYXJhdGlvbiA9IHN5bWJvbC5kZWNsYXJhdGlvbnNbMF07XG4gICAgY29uc3QgaW1wb3J0RGVjbCA9IGdldENvbnRhaW5pbmdJbXBvcnREZWNsYXJhdGlvbihkZWNsKTtcblxuICAgIC8vIElnbm9yZSBkZWNsYXJhdGlvbnMgdGhhdCBhcmUgZGVmaW5lZCBsb2NhbGx5IChub3QgaW1wb3J0ZWQpLlxuICAgIGlmIChpbXBvcnREZWNsID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICAvLyBUaGUgbW9kdWxlIHNwZWNpZmllciBpcyBndWFyYW50ZWVkIHRvIGJlIGEgc3RyaW5nIGxpdGVyYWwsIHNvIHRoaXMgc2hvdWxkIGFsd2F5cyBwYXNzLlxuICAgIGlmICghdHMuaXNTdHJpbmdMaXRlcmFsKGltcG9ydERlY2wubW9kdWxlU3BlY2lmaWVyKSkge1xuICAgICAgLy8gTm90IGFsbG93ZWQgdG8gaGFwcGVuIGluIFR5cGVTY3JpcHQgQVNUcy5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7ZnJvbTogaW1wb3J0RGVjbC5tb2R1bGVTcGVjaWZpZXIudGV4dCwgbmFtZTogZ2V0RXhwb3J0ZWROYW1lKGRlY2wsIGlkKX07XG4gIH1cblxuICAvKipcbiAgICogVHJ5IHRvIGdldCB0aGUgaW1wb3J0IGluZm8gZm9yIHRoaXMgaWRlbnRpZmllciBhcyB0aG91Z2ggaXQgaXMgYSBuYW1lc3BhY2VkIGltcG9ydC5cbiAgICpcbiAgICogRm9yIGV4YW1wbGUsIGlmIHRoZSBpZGVudGlmaWVyIGlzIHRoZSBgRGlyZWN0aXZlYCBwYXJ0IG9mIGEgcXVhbGlmaWVkIHR5cGUgY2hhaW4gbGlrZTpcbiAgICpcbiAgICogYGBgXG4gICAqIGNvcmUuRGlyZWN0aXZlXG4gICAqIGBgYFxuICAgKlxuICAgKiB0aGVuIGl0IG1pZ2h0IGJlIHRoYXQgYGNvcmVgIGlzIGEgbmFtZXNwYWNlIGltcG9ydCBzdWNoIGFzOlxuICAgKlxuICAgKiBgYGBcbiAgICogaW1wb3J0ICogYXMgY29yZSBmcm9tICd0c2xpYic7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAcGFyYW0gaWQgdGhlIFR5cGVTY3JpcHQgaWRlbnRpZmllciB0byBmaW5kIHRoZSBpbXBvcnQgaW5mbyBmb3IuXG4gICAqIEByZXR1cm5zIFRoZSBpbXBvcnQgaW5mbyBpZiB0aGlzIGlzIGEgbmFtZXNwYWNlZCBpbXBvcnQgb3IgYG51bGxgLlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldEltcG9ydE9mTmFtZXNwYWNlZElkZW50aWZpZXIoXG4gICAgICBpZDogdHMuSWRlbnRpZmllciwgbmFtZXNwYWNlSWRlbnRpZmllcjogdHMuSWRlbnRpZmllcnxudWxsKTogSW1wb3J0fG51bGwge1xuICAgIGlmIChuYW1lc3BhY2VJZGVudGlmaWVyID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgbmFtZXNwYWNlU3ltYm9sID0gdGhpcy5jaGVja2VyLmdldFN5bWJvbEF0TG9jYXRpb24obmFtZXNwYWNlSWRlbnRpZmllcik7XG4gICAgaWYgKCFuYW1lc3BhY2VTeW1ib2wpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBkZWNsYXJhdGlvbiA9XG4gICAgICAgIG5hbWVzcGFjZVN5bWJvbC5kZWNsYXJhdGlvbnMubGVuZ3RoID09PSAxID8gbmFtZXNwYWNlU3ltYm9sLmRlY2xhcmF0aW9uc1swXSA6IG51bGw7XG4gICAgaWYgKCFkZWNsYXJhdGlvbikge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGNvbnN0IG5hbWVzcGFjZURlY2xhcmF0aW9uID0gdHMuaXNOYW1lc3BhY2VJbXBvcnQoZGVjbGFyYXRpb24pID8gZGVjbGFyYXRpb24gOiBudWxsO1xuICAgIGlmICghbmFtZXNwYWNlRGVjbGFyYXRpb24pIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIGNvbnN0IGltcG9ydERlY2xhcmF0aW9uID0gbmFtZXNwYWNlRGVjbGFyYXRpb24ucGFyZW50LnBhcmVudDtcbiAgICBpZiAoIXRzLmlzU3RyaW5nTGl0ZXJhbChpbXBvcnREZWNsYXJhdGlvbi5tb2R1bGVTcGVjaWZpZXIpKSB7XG4gICAgICAvLyBTaG91bGQgbm90IGhhcHBlbiBhcyB0aGlzIHdvdWxkIGJlIGludmFsaWQgVHlwZXNTY3JpcHRcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBmcm9tOiBpbXBvcnREZWNsYXJhdGlvbi5tb2R1bGVTcGVjaWZpZXIudGV4dCxcbiAgICAgIG5hbWU6IGlkLnRleHQsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZXNvbHZlIGEgYHRzLlN5bWJvbGAgdG8gaXRzIGRlY2xhcmF0aW9uLCBrZWVwaW5nIHRyYWNrIG9mIHRoZSBgdmlhTW9kdWxlYCBhbG9uZyB0aGUgd2F5LlxuICAgKi9cbiAgcHJvdGVjdGVkIGdldERlY2xhcmF0aW9uT2ZTeW1ib2woc3ltYm9sOiB0cy5TeW1ib2wsIG9yaWdpbmFsSWQ6IHRzLklkZW50aWZpZXJ8bnVsbCk6IERlY2xhcmF0aW9uXG4gICAgICB8bnVsbCB7XG4gICAgLy8gSWYgdGhlIHN5bWJvbCBwb2ludHMgdG8gYSBTaG9ydGhhbmRQcm9wZXJ0eUFzc2lnbm1lbnQsIHJlc29sdmUgaXQuXG4gICAgbGV0IHZhbHVlRGVjbGFyYXRpb246IHRzLkRlY2xhcmF0aW9ufHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbiAgICBpZiAoc3ltYm9sLnZhbHVlRGVjbGFyYXRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgICAgdmFsdWVEZWNsYXJhdGlvbiA9IHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uO1xuICAgIH0gZWxzZSBpZiAoc3ltYm9sLmRlY2xhcmF0aW9ucyAhPT0gdW5kZWZpbmVkICYmIHN5bWJvbC5kZWNsYXJhdGlvbnMubGVuZ3RoID4gMCkge1xuICAgICAgdmFsdWVEZWNsYXJhdGlvbiA9IHN5bWJvbC5kZWNsYXJhdGlvbnNbMF07XG4gICAgfVxuICAgIGlmICh2YWx1ZURlY2xhcmF0aW9uICE9PSB1bmRlZmluZWQgJiYgdHMuaXNTaG9ydGhhbmRQcm9wZXJ0eUFzc2lnbm1lbnQodmFsdWVEZWNsYXJhdGlvbikpIHtcbiAgICAgIGNvbnN0IHNob3J0aGFuZFN5bWJvbCA9IHRoaXMuY2hlY2tlci5nZXRTaG9ydGhhbmRBc3NpZ25tZW50VmFsdWVTeW1ib2wodmFsdWVEZWNsYXJhdGlvbik7XG4gICAgICBpZiAoc2hvcnRoYW5kU3ltYm9sID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5nZXREZWNsYXJhdGlvbk9mU3ltYm9sKHNob3J0aGFuZFN5bWJvbCwgb3JpZ2luYWxJZCk7XG4gICAgfSBlbHNlIGlmICh2YWx1ZURlY2xhcmF0aW9uICE9PSB1bmRlZmluZWQgJiYgdHMuaXNFeHBvcnRTcGVjaWZpZXIodmFsdWVEZWNsYXJhdGlvbikpIHtcbiAgICAgIGNvbnN0IHRhcmdldFN5bWJvbCA9IHRoaXMuY2hlY2tlci5nZXRFeHBvcnRTcGVjaWZpZXJMb2NhbFRhcmdldFN5bWJvbCh2YWx1ZURlY2xhcmF0aW9uKTtcbiAgICAgIGlmICh0YXJnZXRTeW1ib2wgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLmdldERlY2xhcmF0aW9uT2ZTeW1ib2wodGFyZ2V0U3ltYm9sLCBvcmlnaW5hbElkKTtcbiAgICB9XG5cbiAgICBjb25zdCBpbXBvcnRJbmZvID0gb3JpZ2luYWxJZCAmJiB0aGlzLmdldEltcG9ydE9mSWRlbnRpZmllcihvcmlnaW5hbElkKTtcbiAgICBjb25zdCB2aWFNb2R1bGUgPVxuICAgICAgICBpbXBvcnRJbmZvICE9PSBudWxsICYmIGltcG9ydEluZm8uZnJvbSAhPT0gbnVsbCAmJiAhaW1wb3J0SW5mby5mcm9tLnN0YXJ0c1dpdGgoJy4nKSA/XG4gICAgICAgIGltcG9ydEluZm8uZnJvbSA6XG4gICAgICAgIG51bGw7XG5cbiAgICAvLyBOb3csIHJlc29sdmUgdGhlIFN5bWJvbCB0byBpdHMgZGVjbGFyYXRpb24gYnkgZm9sbG93aW5nIGFueSBhbmQgYWxsIGFsaWFzZXMuXG4gICAgd2hpbGUgKHN5bWJvbC5mbGFncyAmIHRzLlN5bWJvbEZsYWdzLkFsaWFzKSB7XG4gICAgICBzeW1ib2wgPSB0aGlzLmNoZWNrZXIuZ2V0QWxpYXNlZFN5bWJvbChzeW1ib2wpO1xuICAgIH1cblxuICAgIC8vIExvb2sgYXQgdGhlIHJlc29sdmVkIFN5bWJvbCdzIGRlY2xhcmF0aW9ucyBhbmQgcGljayBvbmUgb2YgdGhlbSB0byByZXR1cm4uIFZhbHVlIGRlY2xhcmF0aW9uc1xuICAgIC8vIGFyZSBnaXZlbiBwcmVjZWRlbmNlIG92ZXIgdHlwZSBkZWNsYXJhdGlvbnMuXG4gICAgaWYgKHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG5vZGU6IHN5bWJvbC52YWx1ZURlY2xhcmF0aW9uLFxuICAgICAgICBrbm93bjogbnVsbCxcbiAgICAgICAgdmlhTW9kdWxlLFxuICAgICAgICBpZGVudGl0eTogbnVsbCxcbiAgICAgIH07XG4gICAgfSBlbHNlIGlmIChzeW1ib2wuZGVjbGFyYXRpb25zICE9PSB1bmRlZmluZWQgJiYgc3ltYm9sLmRlY2xhcmF0aW9ucy5sZW5ndGggPiAwKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBub2RlOiBzeW1ib2wuZGVjbGFyYXRpb25zWzBdLFxuICAgICAgICBrbm93bjogbnVsbCxcbiAgICAgICAgdmlhTW9kdWxlLFxuICAgICAgICBpZGVudGl0eTogbnVsbCxcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgX3JlZmxlY3REZWNvcmF0b3Iobm9kZTogdHMuRGVjb3JhdG9yKTogRGVjb3JhdG9yfG51bGwge1xuICAgIC8vIEF0dGVtcHQgdG8gcmVzb2x2ZSB0aGUgZGVjb3JhdG9yIGV4cHJlc3Npb24gaW50byBhIHJlZmVyZW5jZSB0byBhIGNvbmNyZXRlIElkZW50aWZpZXIuIFRoZVxuICAgIC8vIGV4cHJlc3Npb24gbWF5IGNvbnRhaW4gYSBjYWxsIHRvIGEgZnVuY3Rpb24gd2hpY2ggcmV0dXJucyB0aGUgZGVjb3JhdG9yIGZ1bmN0aW9uLCBpbiB3aGljaFxuICAgIC8vIGNhc2Ugd2Ugd2FudCB0byByZXR1cm4gdGhlIGFyZ3VtZW50cy5cbiAgICBsZXQgZGVjb3JhdG9yRXhwcjogdHMuRXhwcmVzc2lvbiA9IG5vZGUuZXhwcmVzc2lvbjtcbiAgICBsZXQgYXJnczogdHMuRXhwcmVzc2lvbltdfG51bGwgPSBudWxsO1xuXG4gICAgLy8gQ2hlY2sgZm9yIGNhbGwgZXhwcmVzc2lvbnMuXG4gICAgaWYgKHRzLmlzQ2FsbEV4cHJlc3Npb24oZGVjb3JhdG9yRXhwcikpIHtcbiAgICAgIGFyZ3MgPSBBcnJheS5mcm9tKGRlY29yYXRvckV4cHIuYXJndW1lbnRzKTtcbiAgICAgIGRlY29yYXRvckV4cHIgPSBkZWNvcmF0b3JFeHByLmV4cHJlc3Npb247XG4gICAgfVxuXG4gICAgLy8gVGhlIGZpbmFsIHJlc29sdmVkIGRlY29yYXRvciBzaG91bGQgYmUgYSBgdHMuSWRlbnRpZmllcmAgLSBpZiBpdCdzIG5vdCwgdGhlbiBzb21ldGhpbmcgaXNcbiAgICAvLyB3cm9uZyBhbmQgdGhlIGRlY29yYXRvciBjYW4ndCBiZSByZXNvbHZlZCBzdGF0aWNhbGx5LlxuICAgIGlmICghaXNEZWNvcmF0b3JJZGVudGlmaWVyKGRlY29yYXRvckV4cHIpKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBkZWNvcmF0b3JJZGVudGlmaWVyID0gdHMuaXNJZGVudGlmaWVyKGRlY29yYXRvckV4cHIpID8gZGVjb3JhdG9yRXhwciA6IGRlY29yYXRvckV4cHIubmFtZTtcbiAgICBjb25zdCBpbXBvcnREZWNsID0gdGhpcy5nZXRJbXBvcnRPZklkZW50aWZpZXIoZGVjb3JhdG9ySWRlbnRpZmllcik7XG5cbiAgICByZXR1cm4ge1xuICAgICAgbmFtZTogZGVjb3JhdG9ySWRlbnRpZmllci50ZXh0LFxuICAgICAgaWRlbnRpZmllcjogZGVjb3JhdG9yRXhwcixcbiAgICAgIGltcG9ydDogaW1wb3J0RGVjbCxcbiAgICAgIG5vZGUsXG4gICAgICBhcmdzLFxuICAgIH07XG4gIH1cblxuICBwcml2YXRlIF9yZWZsZWN0TWVtYmVyKG5vZGU6IHRzLkNsYXNzRWxlbWVudCk6IENsYXNzTWVtYmVyfG51bGwge1xuICAgIGxldCBraW5kOiBDbGFzc01lbWJlcktpbmR8bnVsbCA9IG51bGw7XG4gICAgbGV0IHZhbHVlOiB0cy5FeHByZXNzaW9ufG51bGwgPSBudWxsO1xuICAgIGxldCBuYW1lOiBzdHJpbmd8bnVsbCA9IG51bGw7XG4gICAgbGV0IG5hbWVOb2RlOiB0cy5JZGVudGlmaWVyfHRzLlN0cmluZ0xpdGVyYWx8bnVsbCA9IG51bGw7XG5cbiAgICBpZiAodHMuaXNQcm9wZXJ0eURlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICBraW5kID0gQ2xhc3NNZW1iZXJLaW5kLlByb3BlcnR5O1xuICAgICAgdmFsdWUgPSBub2RlLmluaXRpYWxpemVyIHx8IG51bGw7XG4gICAgfSBlbHNlIGlmICh0cy5pc0dldEFjY2Vzc29yRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgIGtpbmQgPSBDbGFzc01lbWJlcktpbmQuR2V0dGVyO1xuICAgIH0gZWxzZSBpZiAodHMuaXNTZXRBY2Nlc3NvckRlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICBraW5kID0gQ2xhc3NNZW1iZXJLaW5kLlNldHRlcjtcbiAgICB9IGVsc2UgaWYgKHRzLmlzTWV0aG9kRGVjbGFyYXRpb24obm9kZSkpIHtcbiAgICAgIGtpbmQgPSBDbGFzc01lbWJlcktpbmQuTWV0aG9kO1xuICAgIH0gZWxzZSBpZiAodHMuaXNDb25zdHJ1Y3RvckRlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICBraW5kID0gQ2xhc3NNZW1iZXJLaW5kLkNvbnN0cnVjdG9yO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBpZiAodHMuaXNDb25zdHJ1Y3RvckRlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgICBuYW1lID0gJ2NvbnN0cnVjdG9yJztcbiAgICB9IGVsc2UgaWYgKHRzLmlzSWRlbnRpZmllcihub2RlLm5hbWUpKSB7XG4gICAgICBuYW1lID0gbm9kZS5uYW1lLnRleHQ7XG4gICAgICBuYW1lTm9kZSA9IG5vZGUubmFtZTtcbiAgICB9IGVsc2UgaWYgKHRzLmlzU3RyaW5nTGl0ZXJhbChub2RlLm5hbWUpKSB7XG4gICAgICBuYW1lID0gbm9kZS5uYW1lLnRleHQ7XG4gICAgICBuYW1lTm9kZSA9IG5vZGUubmFtZTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgZGVjb3JhdG9ycyA9IHRoaXMuZ2V0RGVjb3JhdG9yc09mRGVjbGFyYXRpb24obm9kZSk7XG4gICAgY29uc3QgaXNTdGF0aWMgPSBub2RlLm1vZGlmaWVycyAhPT0gdW5kZWZpbmVkICYmXG4gICAgICAgIG5vZGUubW9kaWZpZXJzLnNvbWUobW9kID0+IG1vZC5raW5kID09PSB0cy5TeW50YXhLaW5kLlN0YXRpY0tleXdvcmQpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIG5vZGUsXG4gICAgICBpbXBsZW1lbnRhdGlvbjogbm9kZSxcbiAgICAgIGtpbmQsXG4gICAgICB0eXBlOiBub2RlLnR5cGUgfHwgbnVsbCxcbiAgICAgIG5hbWUsXG4gICAgICBuYW1lTm9kZSxcbiAgICAgIGRlY29yYXRvcnMsXG4gICAgICB2YWx1ZSxcbiAgICAgIGlzU3RhdGljLFxuICAgIH07XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZmxlY3ROYW1lT2ZEZWNsYXJhdGlvbihkZWNsOiB0cy5EZWNsYXJhdGlvbik6IHN0cmluZ3xudWxsIHtcbiAgY29uc3QgaWQgPSByZWZsZWN0SWRlbnRpZmllck9mRGVjbGFyYXRpb24oZGVjbCk7XG4gIHJldHVybiBpZCAmJiBpZC50ZXh0IHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWZsZWN0SWRlbnRpZmllck9mRGVjbGFyYXRpb24oZGVjbDogdHMuRGVjbGFyYXRpb24pOiB0cy5JZGVudGlmaWVyfG51bGwge1xuICBpZiAodHMuaXNDbGFzc0RlY2xhcmF0aW9uKGRlY2wpIHx8IHRzLmlzRnVuY3Rpb25EZWNsYXJhdGlvbihkZWNsKSkge1xuICAgIHJldHVybiBkZWNsLm5hbWUgfHwgbnVsbDtcbiAgfSBlbHNlIGlmICh0cy5pc1ZhcmlhYmxlRGVjbGFyYXRpb24oZGVjbCkpIHtcbiAgICBpZiAodHMuaXNJZGVudGlmaWVyKGRlY2wubmFtZSkpIHtcbiAgICAgIHJldHVybiBkZWNsLm5hbWU7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVmbGVjdFR5cGVFbnRpdHlUb0RlY2xhcmF0aW9uKFxuICAgIHR5cGU6IHRzLkVudGl0eU5hbWUsIGNoZWNrZXI6IHRzLlR5cGVDaGVja2VyKToge25vZGU6IHRzLkRlY2xhcmF0aW9uLCBmcm9tOiBzdHJpbmd8bnVsbH0ge1xuICBsZXQgcmVhbFN5bWJvbCA9IGNoZWNrZXIuZ2V0U3ltYm9sQXRMb2NhdGlvbih0eXBlKTtcbiAgaWYgKHJlYWxTeW1ib2wgPT09IHVuZGVmaW5lZCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgQ2Fubm90IHJlc29sdmUgdHlwZSBlbnRpdHkgJHt0eXBlLmdldFRleHQoKX0gdG8gc3ltYm9sYCk7XG4gIH1cbiAgd2hpbGUgKHJlYWxTeW1ib2wuZmxhZ3MgJiB0cy5TeW1ib2xGbGFncy5BbGlhcykge1xuICAgIHJlYWxTeW1ib2wgPSBjaGVja2VyLmdldEFsaWFzZWRTeW1ib2wocmVhbFN5bWJvbCk7XG4gIH1cblxuICBsZXQgbm9kZTogdHMuRGVjbGFyYXRpb258bnVsbCA9IG51bGw7XG4gIGlmIChyZWFsU3ltYm9sLnZhbHVlRGVjbGFyYXRpb24gIT09IHVuZGVmaW5lZCkge1xuICAgIG5vZGUgPSByZWFsU3ltYm9sLnZhbHVlRGVjbGFyYXRpb247XG4gIH0gZWxzZSBpZiAocmVhbFN5bWJvbC5kZWNsYXJhdGlvbnMgIT09IHVuZGVmaW5lZCAmJiByZWFsU3ltYm9sLmRlY2xhcmF0aW9ucy5sZW5ndGggPT09IDEpIHtcbiAgICBub2RlID0gcmVhbFN5bWJvbC5kZWNsYXJhdGlvbnNbMF07XG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgcmVzb2x2ZSB0eXBlIGVudGl0eSBzeW1ib2wgdG8gZGVjbGFyYXRpb25gKTtcbiAgfVxuXG4gIGlmICh0cy5pc1F1YWxpZmllZE5hbWUodHlwZSkpIHtcbiAgICBpZiAoIXRzLmlzSWRlbnRpZmllcih0eXBlLmxlZnQpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBoYW5kbGUgcXVhbGlmaWVkIG5hbWUgd2l0aCBub24taWRlbnRpZmllciBsaHNgKTtcbiAgICB9XG4gICAgY29uc3Qgc3ltYm9sID0gY2hlY2tlci5nZXRTeW1ib2xBdExvY2F0aW9uKHR5cGUubGVmdCk7XG4gICAgaWYgKHN5bWJvbCA9PT0gdW5kZWZpbmVkIHx8IHN5bWJvbC5kZWNsYXJhdGlvbnMgPT09IHVuZGVmaW5lZCB8fFxuICAgICAgICBzeW1ib2wuZGVjbGFyYXRpb25zLmxlbmd0aCAhPT0gMSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgcmVzb2x2ZSBxdWFsaWZpZWQgdHlwZSBlbnRpdHkgbGhzIHRvIHN5bWJvbGApO1xuICAgIH1cbiAgICBjb25zdCBkZWNsID0gc3ltYm9sLmRlY2xhcmF0aW9uc1swXTtcbiAgICBpZiAodHMuaXNOYW1lc3BhY2VJbXBvcnQoZGVjbCkpIHtcbiAgICAgIGNvbnN0IGNsYXVzZSA9IGRlY2wucGFyZW50ITtcbiAgICAgIGNvbnN0IGltcG9ydERlY2wgPSBjbGF1c2UucGFyZW50ITtcbiAgICAgIGlmICghdHMuaXNTdHJpbmdMaXRlcmFsKGltcG9ydERlY2wubW9kdWxlU3BlY2lmaWVyKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYE1vZHVsZSBzcGVjaWZpZXIgaXMgbm90IGEgc3RyaW5nYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4ge25vZGUsIGZyb206IGltcG9ydERlY2wubW9kdWxlU3BlY2lmaWVyLnRleHR9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gaW1wb3J0IHR5cGU/YCk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIHJldHVybiB7bm9kZSwgZnJvbTogbnVsbH07XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbHRlclRvTWVtYmVyc1dpdGhEZWNvcmF0b3IobWVtYmVyczogQ2xhc3NNZW1iZXJbXSwgbmFtZTogc3RyaW5nLCBtb2R1bGU/OiBzdHJpbmcpOlxuICAgIHttZW1iZXI6IENsYXNzTWVtYmVyLCBkZWNvcmF0b3JzOiBEZWNvcmF0b3JbXX1bXSB7XG4gIHJldHVybiBtZW1iZXJzLmZpbHRlcihtZW1iZXIgPT4gIW1lbWJlci5pc1N0YXRpYylcbiAgICAgIC5tYXAobWVtYmVyID0+IHtcbiAgICAgICAgaWYgKG1lbWJlci5kZWNvcmF0b3JzID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBkZWNvcmF0b3JzID0gbWVtYmVyLmRlY29yYXRvcnMuZmlsdGVyKGRlYyA9PiB7XG4gICAgICAgICAgaWYgKGRlYy5pbXBvcnQgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHJldHVybiBkZWMuaW1wb3J0Lm5hbWUgPT09IG5hbWUgJiYgKG1vZHVsZSA9PT0gdW5kZWZpbmVkIHx8IGRlYy5pbXBvcnQuZnJvbSA9PT0gbW9kdWxlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIGRlYy5uYW1lID09PSBuYW1lICYmIG1vZHVsZSA9PT0gdW5kZWZpbmVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKGRlY29yYXRvcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge21lbWJlciwgZGVjb3JhdG9yc307XG4gICAgICB9KVxuICAgICAgLmZpbHRlcigodmFsdWUpOiB2YWx1ZSBpcyB7bWVtYmVyOiBDbGFzc01lbWJlciwgZGVjb3JhdG9yczogRGVjb3JhdG9yW119ID0+IHZhbHVlICE9PSBudWxsKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbmRNZW1iZXIoXG4gICAgbWVtYmVyczogQ2xhc3NNZW1iZXJbXSwgbmFtZTogc3RyaW5nLCBpc1N0YXRpYzogYm9vbGVhbiA9IGZhbHNlKTogQ2xhc3NNZW1iZXJ8bnVsbCB7XG4gIHJldHVybiBtZW1iZXJzLmZpbmQobWVtYmVyID0+IG1lbWJlci5pc1N0YXRpYyA9PT0gaXNTdGF0aWMgJiYgbWVtYmVyLm5hbWUgPT09IG5hbWUpIHx8IG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWZsZWN0T2JqZWN0TGl0ZXJhbChub2RlOiB0cy5PYmplY3RMaXRlcmFsRXhwcmVzc2lvbik6IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+IHtcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIHRzLkV4cHJlc3Npb24+KCk7XG4gIG5vZGUucHJvcGVydGllcy5mb3JFYWNoKHByb3AgPT4ge1xuICAgIGlmICh0cy5pc1Byb3BlcnR5QXNzaWdubWVudChwcm9wKSkge1xuICAgICAgY29uc3QgbmFtZSA9IHByb3BlcnR5TmFtZVRvU3RyaW5nKHByb3AubmFtZSk7XG4gICAgICBpZiAobmFtZSA9PT0gbnVsbCkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBtYXAuc2V0KG5hbWUsIHByb3AuaW5pdGlhbGl6ZXIpO1xuICAgIH0gZWxzZSBpZiAodHMuaXNTaG9ydGhhbmRQcm9wZXJ0eUFzc2lnbm1lbnQocHJvcCkpIHtcbiAgICAgIG1hcC5zZXQocHJvcC5uYW1lLnRleHQsIHByb3AubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gIH0pO1xuICByZXR1cm4gbWFwO1xufVxuXG5mdW5jdGlvbiBjYXN0RGVjbGFyYXRpb25Ub0NsYXNzT3JEaWUoZGVjbGFyYXRpb246IENsYXNzRGVjbGFyYXRpb24pOlxuICAgIENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4ge1xuICBpZiAoIXRzLmlzQ2xhc3NEZWNsYXJhdGlvbihkZWNsYXJhdGlvbikpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgIGBSZWZsZWN0aW5nIG9uIGEgJHt0cy5TeW50YXhLaW5kW2RlY2xhcmF0aW9uLmtpbmRdfSBpbnN0ZWFkIG9mIGEgQ2xhc3NEZWNsYXJhdGlvbi5gKTtcbiAgfVxuICByZXR1cm4gZGVjbGFyYXRpb247XG59XG5cbmZ1bmN0aW9uIHBhcmFtZXRlck5hbWUobmFtZTogdHMuQmluZGluZ05hbWUpOiBzdHJpbmd8bnVsbCB7XG4gIGlmICh0cy5pc0lkZW50aWZpZXIobmFtZSkpIHtcbiAgICByZXR1cm4gbmFtZS50ZXh0O1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByb3BlcnR5TmFtZVRvU3RyaW5nKG5vZGU6IHRzLlByb3BlcnR5TmFtZSk6IHN0cmluZ3xudWxsIHtcbiAgaWYgKHRzLmlzSWRlbnRpZmllcihub2RlKSB8fCB0cy5pc1N0cmluZ0xpdGVyYWwobm9kZSkgfHwgdHMuaXNOdW1lcmljTGl0ZXJhbChub2RlKSkge1xuICAgIHJldHVybiBub2RlLnRleHQ7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cbn1cblxuLyoqXG4gKiBDb21wdXRlIHRoZSBsZWZ0IG1vc3QgaWRlbnRpZmllciBpbiBhIHF1YWxpZmllZCB0eXBlIGNoYWluLiBFLmcuIHRoZSBgYWAgb2YgYGEuYi5jLlNvbWVUeXBlYC5cbiAqIEBwYXJhbSBxdWFsaWZpZWROYW1lIFRoZSBzdGFydGluZyBwcm9wZXJ0eSBhY2Nlc3MgZXhwcmVzc2lvbiBmcm9tIHdoaWNoIHdlIHdhbnQgdG8gY29tcHV0ZVxuICogdGhlIGxlZnQgbW9zdCBpZGVudGlmaWVyLlxuICogQHJldHVybnMgdGhlIGxlZnQgbW9zdCBpZGVudGlmaWVyIGluIHRoZSBjaGFpbiBvciBgbnVsbGAgaWYgaXQgaXMgbm90IGFuIGlkZW50aWZpZXIuXG4gKi9cbmZ1bmN0aW9uIGdldFF1YWxpZmllZE5hbWVSb290KHF1YWxpZmllZE5hbWU6IHRzLlF1YWxpZmllZE5hbWUpOiB0cy5JZGVudGlmaWVyfG51bGwge1xuICB3aGlsZSAodHMuaXNRdWFsaWZpZWROYW1lKHF1YWxpZmllZE5hbWUubGVmdCkpIHtcbiAgICBxdWFsaWZpZWROYW1lID0gcXVhbGlmaWVkTmFtZS5sZWZ0O1xuICB9XG4gIHJldHVybiB0cy5pc0lkZW50aWZpZXIocXVhbGlmaWVkTmFtZS5sZWZ0KSA/IHF1YWxpZmllZE5hbWUubGVmdCA6IG51bGw7XG59XG5cbi8qKlxuICogQ29tcHV0ZSB0aGUgbGVmdCBtb3N0IGlkZW50aWZpZXIgaW4gYSBwcm9wZXJ0eSBhY2Nlc3MgY2hhaW4uIEUuZy4gdGhlIGBhYCBvZiBgYS5iLmMuZGAuXG4gKiBAcGFyYW0gcHJvcGVydHlBY2Nlc3MgVGhlIHN0YXJ0aW5nIHByb3BlcnR5IGFjY2VzcyBleHByZXNzaW9uIGZyb20gd2hpY2ggd2Ugd2FudCB0byBjb21wdXRlXG4gKiB0aGUgbGVmdCBtb3N0IGlkZW50aWZpZXIuXG4gKiBAcmV0dXJucyB0aGUgbGVmdCBtb3N0IGlkZW50aWZpZXIgaW4gdGhlIGNoYWluIG9yIGBudWxsYCBpZiBpdCBpcyBub3QgYW4gaWRlbnRpZmllci5cbiAqL1xuZnVuY3Rpb24gZ2V0RmFyTGVmdElkZW50aWZpZXIocHJvcGVydHlBY2Nlc3M6IHRzLlByb3BlcnR5QWNjZXNzRXhwcmVzc2lvbik6IHRzLklkZW50aWZpZXJ8bnVsbCB7XG4gIHdoaWxlICh0cy5pc1Byb3BlcnR5QWNjZXNzRXhwcmVzc2lvbihwcm9wZXJ0eUFjY2Vzcy5leHByZXNzaW9uKSkge1xuICAgIHByb3BlcnR5QWNjZXNzID0gcHJvcGVydHlBY2Nlc3MuZXhwcmVzc2lvbjtcbiAgfVxuICByZXR1cm4gdHMuaXNJZGVudGlmaWVyKHByb3BlcnR5QWNjZXNzLmV4cHJlc3Npb24pID8gcHJvcGVydHlBY2Nlc3MuZXhwcmVzc2lvbiA6IG51bGw7XG59XG5cbi8qKlxuICogUmV0dXJuIHRoZSBJbXBvcnREZWNsYXJhdGlvbiBmb3IgdGhlIGdpdmVuIGBub2RlYCBpZiBpdCBpcyBlaXRoZXIgYW4gYEltcG9ydFNwZWNpZmllcmAgb3IgYVxuICogYE5hbWVzcGFjZUltcG9ydGAuIElmIG5vdCByZXR1cm4gYG51bGxgLlxuICovXG5mdW5jdGlvbiBnZXRDb250YWluaW5nSW1wb3J0RGVjbGFyYXRpb24obm9kZTogdHMuTm9kZSk6IHRzLkltcG9ydERlY2xhcmF0aW9ufG51bGwge1xuICByZXR1cm4gdHMuaXNJbXBvcnRTcGVjaWZpZXIobm9kZSkgPyBub2RlLnBhcmVudCEucGFyZW50IS5wYXJlbnQhIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHMuaXNOYW1lc3BhY2VJbXBvcnQobm9kZSkgPyBub2RlLnBhcmVudC5wYXJlbnQgOiBudWxsO1xufVxuXG4vKipcbiAqIENvbXB1dGUgdGhlIG5hbWUgYnkgd2hpY2ggdGhlIGBkZWNsYCB3YXMgZXhwb3J0ZWQsIG5vdCBpbXBvcnRlZC5cbiAqIElmIG5vIHN1Y2ggZGVjbGFyYXRpb24gY2FuIGJlIGZvdW5kIChlLmcuIGl0IGlzIGEgbmFtZXNwYWNlIGltcG9ydClcbiAqIHRoZW4gZmFsbGJhY2sgdG8gdGhlIGBvcmlnaW5hbElkYC5cbiAqL1xuZnVuY3Rpb24gZ2V0RXhwb3J0ZWROYW1lKGRlY2w6IHRzLkRlY2xhcmF0aW9uLCBvcmlnaW5hbElkOiB0cy5JZGVudGlmaWVyKTogc3RyaW5nIHtcbiAgcmV0dXJuIHRzLmlzSW1wb3J0U3BlY2lmaWVyKGRlY2wpID9cbiAgICAgIChkZWNsLnByb3BlcnR5TmFtZSAhPT0gdW5kZWZpbmVkID8gZGVjbC5wcm9wZXJ0eU5hbWUgOiBkZWNsLm5hbWUpLnRleHQgOlxuICAgICAgb3JpZ2luYWxJZC50ZXh0O1xufVxuIl19