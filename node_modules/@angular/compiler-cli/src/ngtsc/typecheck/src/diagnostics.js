(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("@angular/compiler-cli/src/ngtsc/typecheck/src/diagnostics", ["require", "exports", "tslib", "@angular/compiler", "typescript", "@angular/compiler-cli/src/ngtsc/util/src/typescript", "@angular/compiler-cli/src/ngtsc/typecheck/diagnostics"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.findTypeCheckBlock = exports.translateDiagnostic = exports.shouldReportDiagnostic = exports.addTemplateId = exports.addParseSpanInfo = exports.ignoreDiagnostics = exports.wrapForDiagnostics = void 0;
    var tslib_1 = require("tslib");
    /**
     * @license
     * Copyright Google LLC All Rights Reserved.
     *
     * Use of this source code is governed by an MIT-style license that can be
     * found in the LICENSE file at https://angular.io/license
     */
    var compiler_1 = require("@angular/compiler");
    var ts = require("typescript");
    var typescript_1 = require("@angular/compiler-cli/src/ngtsc/util/src/typescript");
    var diagnostics_1 = require("@angular/compiler-cli/src/ngtsc/typecheck/diagnostics");
    /**
     * Wraps the node in parenthesis such that inserted span comments become attached to the proper
     * node. This is an alias for `ts.createParen` with the benefit that it signifies that the
     * inserted parenthesis are for diagnostic purposes, not for correctness of the rendered TCB code.
     *
     * Note that it is important that nodes and its attached comment are not wrapped into parenthesis
     * by default, as it prevents correct translation of e.g. diagnostics produced for incorrect method
     * arguments. Such diagnostics would then be produced for the parenthesised node whereas the
     * positional comment would be located within that node, resulting in a mismatch.
     */
    function wrapForDiagnostics(expr) {
        return ts.createParen(expr);
    }
    exports.wrapForDiagnostics = wrapForDiagnostics;
    var IGNORE_MARKER = 'ignore';
    /**
     * Adds a marker to the node that signifies that any errors within the node should not be reported.
     */
    function ignoreDiagnostics(node) {
        ts.addSyntheticTrailingComment(node, ts.SyntaxKind.MultiLineCommentTrivia, IGNORE_MARKER, /* hasTrailingNewLine */ false);
    }
    exports.ignoreDiagnostics = ignoreDiagnostics;
    /**
     * Adds a synthetic comment to the expression that represents the parse span of the provided node.
     * This comment can later be retrieved as trivia of a node to recover original source locations.
     */
    function addParseSpanInfo(node, span) {
        var commentText;
        if (span instanceof compiler_1.AbsoluteSourceSpan) {
            commentText = span.start + "," + span.end;
        }
        else {
            commentText = span.start.offset + "," + span.end.offset;
        }
        ts.addSyntheticTrailingComment(node, ts.SyntaxKind.MultiLineCommentTrivia, commentText, /* hasTrailingNewLine */ false);
    }
    exports.addParseSpanInfo = addParseSpanInfo;
    /**
     * Adds a synthetic comment to the function declaration that contains the template id
     * of the class declaration.
     */
    function addTemplateId(tcb, id) {
        ts.addSyntheticLeadingComment(tcb, ts.SyntaxKind.MultiLineCommentTrivia, id, true);
    }
    exports.addTemplateId = addTemplateId;
    /**
     * Determines if the diagnostic should be reported. Some diagnostics are produced because of the
     * way TCBs are generated; those diagnostics should not be reported as type check errors of the
     * template.
     */
    function shouldReportDiagnostic(diagnostic) {
        var code = diagnostic.code;
        if (code === 6133 /* $var is declared but its value is never read. */) {
            return false;
        }
        else if (code === 6199 /* All variables are unused. */) {
            return false;
        }
        else if (code === 2695 /* Left side of comma operator is unused and has no side effects. */) {
            return false;
        }
        else if (code === 7006 /* Parameter '$event' implicitly has an 'any' type. */) {
            return false;
        }
        return true;
    }
    exports.shouldReportDiagnostic = shouldReportDiagnostic;
    /**
     * Attempts to translate a TypeScript diagnostic produced during template type-checking to their
     * location of origin, based on the comments that are emitted in the TCB code.
     *
     * If the diagnostic could not be translated, `null` is returned to indicate that the diagnostic
     * should not be reported at all. This prevents diagnostics from non-TCB code in a user's source
     * file from being reported as type-check errors.
     */
    function translateDiagnostic(diagnostic, resolver) {
        if (diagnostic.file === undefined || diagnostic.start === undefined) {
            return null;
        }
        // Locate the node that the diagnostic is reported on and determine its location in the source.
        var node = typescript_1.getTokenAtPosition(diagnostic.file, diagnostic.start);
        var sourceLocation = findSourceLocation(node, diagnostic.file);
        if (sourceLocation === null) {
            return null;
        }
        // Now use the external resolver to obtain the full `ParseSourceFile` of the template.
        var span = resolver.toParseSourceSpan(sourceLocation.id, sourceLocation.span);
        if (span === null) {
            return null;
        }
        var mapping = resolver.getSourceMapping(sourceLocation.id);
        return diagnostics_1.makeTemplateDiagnostic(sourceLocation.id, mapping, span, diagnostic.category, diagnostic.code, diagnostic.messageText);
    }
    exports.translateDiagnostic = translateDiagnostic;
    function findTypeCheckBlock(file, id) {
        var e_1, _a;
        try {
            for (var _b = tslib_1.__values(file.statements), _c = _b.next(); !_c.done; _c = _b.next()) {
                var stmt = _c.value;
                if (ts.isFunctionDeclaration(stmt) && getTemplateId(stmt, file) === id) {
                    return stmt;
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
        return null;
    }
    exports.findTypeCheckBlock = findTypeCheckBlock;
    /**
     * Traverses up the AST starting from the given node to extract the source location from comments
     * that have been emitted into the TCB. If the node does not exist within a TCB, or if an ignore
     * marker comment is found up the tree, this function returns null.
     */
    function findSourceLocation(node, sourceFile) {
        // Search for comments until the TCB's function declaration is encountered.
        while (node !== undefined && !ts.isFunctionDeclaration(node)) {
            if (hasIgnoreMarker(node, sourceFile)) {
                // There's an ignore marker on this node, so the diagnostic should not be reported.
                return null;
            }
            var span = readSpanComment(sourceFile, node);
            if (span !== null) {
                // Once the positional information has been extracted, search further up the TCB to extract
                // the unique id that is attached with the TCB's function declaration.
                var id = getTemplateId(node, sourceFile);
                if (id === null) {
                    return null;
                }
                return { id: id, span: span };
            }
            node = node.parent;
        }
        return null;
    }
    function getTemplateId(node, sourceFile) {
        // Walk up to the function declaration of the TCB, the file information is attached there.
        while (!ts.isFunctionDeclaration(node)) {
            if (hasIgnoreMarker(node, sourceFile)) {
                // There's an ignore marker on this node, so the diagnostic should not be reported.
                return null;
            }
            node = node.parent;
            // Bail once we have reached the root.
            if (node === undefined) {
                return null;
            }
        }
        var start = node.getFullStart();
        return ts.forEachLeadingCommentRange(sourceFile.text, start, function (pos, end, kind) {
            if (kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
                return null;
            }
            var commentText = sourceFile.text.substring(pos + 2, end - 2);
            return commentText;
        }) || null;
    }
    var parseSpanComment = /^(\d+),(\d+)$/;
    function readSpanComment(sourceFile, node) {
        return ts.forEachTrailingCommentRange(sourceFile.text, node.getEnd(), function (pos, end, kind) {
            if (kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
                return null;
            }
            var commentText = sourceFile.text.substring(pos + 2, end - 2);
            var match = commentText.match(parseSpanComment);
            if (match === null) {
                return null;
            }
            return new compiler_1.AbsoluteSourceSpan(+match[1], +match[2]);
        }) || null;
    }
    function hasIgnoreMarker(node, sourceFile) {
        return ts.forEachTrailingCommentRange(sourceFile.text, node.getEnd(), function (pos, end, kind) {
            if (kind !== ts.SyntaxKind.MultiLineCommentTrivia) {
                return null;
            }
            var commentText = sourceFile.text.substring(pos + 2, end - 2);
            return commentText === IGNORE_MARKER;
        }) === true;
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhZ25vc3RpY3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3R5cGVjaGVjay9zcmMvZGlhZ25vc3RpY3MudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7OztJQUFBOzs7Ozs7T0FNRztJQUNILDhDQUFzRTtJQUN0RSwrQkFBaUM7SUFFakMsa0ZBQTZEO0lBRTdELHFGQUEwRTtJQXVCMUU7Ozs7Ozs7OztPQVNHO0lBQ0gsU0FBZ0Isa0JBQWtCLENBQUMsSUFBbUI7UUFDcEQsT0FBTyxFQUFFLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBQzlCLENBQUM7SUFGRCxnREFFQztJQUVELElBQU0sYUFBYSxHQUFHLFFBQVEsQ0FBQztJQUUvQjs7T0FFRztJQUNILFNBQWdCLGlCQUFpQixDQUFDLElBQWE7UUFDN0MsRUFBRSxDQUFDLDJCQUEyQixDQUMxQixJQUFJLEVBQUUsRUFBRSxDQUFDLFVBQVUsQ0FBQyxzQkFBc0IsRUFBRSxhQUFhLEVBQUUsd0JBQXdCLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDakcsQ0FBQztJQUhELDhDQUdDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBZ0IsZ0JBQWdCLENBQUMsSUFBYSxFQUFFLElBQXdDO1FBQ3RGLElBQUksV0FBbUIsQ0FBQztRQUN4QixJQUFJLElBQUksWUFBWSw2QkFBa0IsRUFBRTtZQUN0QyxXQUFXLEdBQU0sSUFBSSxDQUFDLEtBQUssU0FBSSxJQUFJLENBQUMsR0FBSyxDQUFDO1NBQzNDO2FBQU07WUFDTCxXQUFXLEdBQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLFNBQUksSUFBSSxDQUFDLEdBQUcsQ0FBQyxNQUFRLENBQUM7U0FDekQ7UUFDRCxFQUFFLENBQUMsMkJBQTJCLENBQzFCLElBQUksRUFBRSxFQUFFLENBQUMsVUFBVSxDQUFDLHNCQUFzQixFQUFFLFdB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QUksRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsVUFBQyxHQUFHLEVBQUUsR0FBRyxFQUFFLElBQUk7WUFDbkYsSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDLFVBQVUsQ0FBQyxzQkFBc0IsRUFBRTtnQkFDakQsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQU0sV0FBVyxHQUFHLFVBQVUsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ2hFLE9BQU8sV0FBVyxLQUFLLGFBQWEsQ0FBQztRQUN2QyxDQUFDLENBQUMsS0FBSyxJQUFJLENBQUM7SUFDZCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQge0Fic29sdXRlU291cmNlU3BhbiwgUGFyc2VTb3VyY2VTcGFufSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtnZXRUb2tlbkF0UG9zaXRpb259IGZyb20gJy4uLy4uL3V0aWwvc3JjL3R5cGVzY3JpcHQnO1xuaW1wb3J0IHtFeHRlcm5hbFRlbXBsYXRlU291cmNlTWFwcGluZywgVGVtcGxhdGVJZCwgVGVtcGxhdGVTb3VyY2VNYXBwaW5nfSBmcm9tICcuLi9hcGknO1xuaW1wb3J0IHttYWtlVGVtcGxhdGVEaWFnbm9zdGljLCBUZW1wbGF0ZURpYWdub3N0aWN9IGZyb20gJy4uL2RpYWdub3N0aWNzJztcblxuLyoqXG4gKiBBZGFwdGVyIGludGVyZmFjZSB3aGljaCBhbGxvd3MgdGhlIHRlbXBsYXRlIHR5cGUtY2hlY2tpbmcgZGlhZ25vc3RpY3MgY29kZSB0byBpbnRlcnByZXQgb2Zmc2V0c1xuICogaW4gYSBUQ0IgYW5kIG1hcCB0aGVtIGJhY2sgdG8gb3JpZ2luYWwgbG9jYXRpb25zIGluIHRoZSB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUZW1wbGF0ZVNvdXJjZVJlc29sdmVyIHtcbiAgZ2V0VGVtcGxhdGVJZChub2RlOiB0cy5DbGFzc0RlY2xhcmF0aW9uKTogVGVtcGxhdGVJZDtcblxuICAvKipcbiAgICogRm9yIHRoZSBnaXZlbiB0ZW1wbGF0ZSBpZCwgcmV0cmlldmUgdGhlIG9yaWdpbmFsIHNvdXJjZSBtYXBwaW5nIHdoaWNoIGRlc2NyaWJlcyBob3cgdGhlIG9mZnNldHNcbiAgICogaW4gdGhlIHRlbXBsYXRlIHNob3VsZCBiZSBpbnRlcnByZXRlZC5cbiAgICovXG4gIGdldFNvdXJjZU1hcHBpbmcoaWQ6IFRlbXBsYXRlSWQpOiBUZW1wbGF0ZVNvdXJjZU1hcHBpbmc7XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgYW4gYWJzb2x1dGUgc291cmNlIHNwYW4gYXNzb2NpYXRlZCB3aXRoIHRoZSBnaXZlbiB0ZW1wbGF0ZSBpZCBpbnRvIGEgZnVsbFxuICAgKiBgUGFyc2VTb3VyY2VTcGFuYC4gVGhlIHJldHVybmVkIHBhcnNlIHNwYW4gaGFzIGxpbmUgYW5kIGNvbHVtbiBudW1iZXJzIGluIGFkZGl0aW9uIHRvIG9ubHlcbiAgICogYWJzb2x1dGUgb2Zmc2V0cyBhbmQgZ2l2ZXMgYWNjZXNzIHRvIHRoZSBvcmlnaW5hbCB0ZW1wbGF0ZSBzb3VyY2UuXG4gICAqL1xuICB0b1BhcnNlU291cmNlU3BhbihpZDogVGVtcGxhdGVJZCwgc3BhbjogQWJzb2x1dGVTb3VyY2VTcGFuKTogUGFyc2VTb3VyY2VTcGFufG51bGw7XG59XG5cbi8qKlxuICogV3JhcHMgdGhlIG5vZGUgaW4gcGFyZW50aGVzaXMgc3VjaCB0aGF0IGluc2VydGVkIHNwYW4gY29tbWVudHMgYmVjb21lIGF0dGFjaGVkIHRvIHRoZSBwcm9wZXJcbiAqIG5vZGUuIFRoaXMgaXMgYW4gYWxpYXMgZm9yIGB0cy5jcmVhdGVQYXJlbmAgd2l0aCB0aGUgYmVuZWZpdCB0aGF0IGl0IHNpZ25pZmllcyB0aGF0IHRoZVxuICogaW5zZXJ0ZWQgcGFyZW50aGVzaXMgYXJlIGZvciBkaWFnbm9zdGljIHB1cnBvc2VzLCBub3QgZm9yIGNvcnJlY3RuZXNzIG9mIHRoZSByZW5kZXJlZCBUQ0IgY29kZS5cbiAqXG4gKiBOb3RlIHRoYXQgaXQgaXMgaW1wb3J0YW50IHRoYXQgbm9kZXMgYW5kIGl0cyBhdHRhY2hlZCBjb21tZW50IGFyZSBub3Qgd3JhcHBlZCBpbnRvIHBhcmVudGhlc2lzXG4gKiBieSBkZWZhdWx0LCBhcyBpdCBwcmV2ZW50cyBjb3JyZWN0IHRyYW5zbGF0aW9uIG9mIGUuZy4gZGlhZ25vc3RpY3MgcHJvZHVjZWQgZm9yIGluY29ycmVjdCBtZXRob2RcbiAqIGFyZ3VtZW50cy4gU3VjaCBkaWFnbm9zdGljcyB3b3VsZCB0aGVuIGJlIHByb2R1Y2VkIGZvciB0aGUgcGFyZW50aGVzaXNlZCBub2RlIHdoZXJlYXMgdGhlXG4gKiBwb3NpdGlvbmFsIGNvbW1lbnQgd291bGQgYmUgbG9jYXRlZCB3aXRoaW4gdGhhdCBub2RlLCByZXN1bHRpbmcgaW4gYSBtaXNtYXRjaC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdyYXBGb3JEaWFnbm9zdGljcyhleHByOiB0cy5FeHByZXNzaW9uKTogdHMuRXhwcmVzc2lvbiB7XG4gIHJldHVybiB0cy5jcmVhdGVQYXJlbihleHByKTtcbn1cblxuY29uc3QgSUdOT1JFX01BUktFUiA9ICdpZ25vcmUnO1xuXG4vKipcbiAqIEFkZHMgYSBtYXJrZXIgdG8gdGhlIG5vZGUgdGhhdCBzaWduaWZpZXMgdGhhdCBhbnkgZXJyb3JzIHdpdGhpbiB0aGUgbm9kZSBzaG91bGQgbm90IGJlIHJlcG9ydGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaWdub3JlRGlhZ25vc3RpY3Mobm9kZTogdHMuTm9kZSk6IHZvaWQge1xuICB0cy5hZGRTeW50aGV0aWNUcmFpbGluZ0NvbW1lbnQoXG4gICAgICBub2RlLCB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEsIElHTk9SRV9NQVJLRVIsIC8qIGhhc1RyYWlsaW5nTmV3TGluZSAqLyBmYWxzZSk7XG59XG5cbi8qKlxuICogQWRkcyBhIHN5bnRoZXRpYyBjb21tZW50IHRvIHRoZSBleHByZXNzaW9uIHRoYXQgcmVwcmVzZW50cyB0aGUgcGFyc2Ugc3BhbiBvZiB0aGUgcHJvdmlkZWQgbm9kZS5cbiAqIFRoaXMgY29tbWVudCBjYW4gbGF0ZXIgYmUgcmV0cmlldmVkIGFzIHRyaXZpYSBvZiBhIG5vZGUgdG8gcmVjb3ZlciBvcmlnaW5hbCBzb3VyY2UgbG9jYXRpb25zLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYWRkUGFyc2VTcGFuSW5mbyhub2RlOiB0cy5Ob2RlLCBzcGFuOiBBYnNvbHV0ZVNvdXJjZVNwYW58UGFyc2VTb3VyY2VTcGFuKTogdm9pZCB7XG4gIGxldCBjb21tZW50VGV4dDogc3RyaW5nO1xuICBpZiAoc3BhbiBpbnN0YW5jZW9mIEFic29sdXRlU291cmNlU3Bhbikge1xuICAgIGNvbW1lbnRUZXh0ID0gYCR7c3Bhbi5zdGFydH0sJHtzcGFuLmVuZH1gO1xuICB9IGVsc2Uge1xuICAgIGNvbW1lbnRUZXh0ID0gYCR7c3Bhbi5zdGFydC5vZmZzZXR9LCR7c3Bhbi5lbmQub2Zmc2V0fWA7XG4gIH1cbiAgdHMuYWRkU3ludGhldGljVHJhaWxpbmdDb21tZW50KFxuICAgICAgbm9kZSwgdHMuU3ludGF4S2luZC5NdWx0aUxpbmVDb21tZW50VHJpdmlhLCBjb21tZW50VGV4dCwgLyogaGFzVHJhaWxpbmdOZXdMaW5lICovIGZhbHNlKTtcbn1cblxuLyoqXG4gKiBBZGRzIGEgc3ludGhldGljIGNvbW1lbnQgdG8gdGhlIGZ1bmN0aW9uIGRlY2xhcmF0aW9uIHRoYXQgY29udGFpbnMgdGhlIHRlbXBsYXRlIGlkXG4gKiBvZiB0aGUgY2xhc3MgZGVjbGFyYXRpb24uXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhZGRUZW1wbGF0ZUlkKHRjYjogdHMuRnVuY3Rpb25EZWNsYXJhdGlvbiwgaWQ6IFRlbXBsYXRlSWQpOiB2b2lkIHtcbiAgdHMuYWRkU3ludGhldGljTGVhZGluZ0NvbW1lbnQodGNiLCB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEsIGlkLCB0cnVlKTtcbn1cblxuLyoqXG4gKiBEZXRlcm1pbmVzIGlmIHRoZSBkaWFnbm9zdGljIHNob3VsZCBiZSByZXBvcnRlZC4gU29tZSBkaWFnbm9zdGljcyBhcmUgcHJvZHVjZWQgYmVjYXVzZSBvZiB0aGVcbiAqIHdheSBUQ0JzIGFyZSBnZW5lcmF0ZWQ7IHRob3NlIGRpYWdub3N0aWNzIHNob3VsZCBub3QgYmUgcmVwb3J0ZWQgYXMgdHlwZSBjaGVjayBlcnJvcnMgb2YgdGhlXG4gKiB0ZW1wbGF0ZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNob3VsZFJlcG9ydERpYWdub3N0aWMoZGlhZ25vc3RpYzogdHMuRGlhZ25vc3RpYyk6IGJvb2xlYW4ge1xuICBjb25zdCB7Y29kZX0gPSBkaWFnbm9zdGljO1xuICBpZiAoY29kZSA9PT0gNjEzMyAvKiAkdmFyIGlzIGRlY2xhcmVkIGJ1dCBpdHMgdmFsdWUgaXMgbmV2ZXIgcmVhZC4gKi8pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSBpZiAoY29kZSA9PT0gNjE5OSAvKiBBbGwgdmFyaWFibGVzIGFyZSB1bnVzZWQuICovKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9IGVsc2UgaWYgKGNvZGUgPT09IDI2OTUgLyogTGVmdCBzaWRlIG9mIGNvbW1hIG9wZXJhdG9yIGlzIHVudXNlZCBhbmQgaGFzIG5vIHNpZGUgZWZmZWN0cy4gKi8pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH0gZWxzZSBpZiAoY29kZSA9PT0gNzAwNiAvKiBQYXJhbWV0ZXIgJyRldmVudCcgaW1wbGljaXRseSBoYXMgYW4gJ2FueScgdHlwZS4gKi8pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbi8qKlxuICogQXR0ZW1wdHMgdG8gdHJhbnNsYXRlIGEgVHlwZVNjcmlwdCBkaWFnbm9zdGljIHByb2R1Y2VkIGR1cmluZyB0ZW1wbGF0ZSB0eXBlLWNoZWNraW5nIHRvIHRoZWlyXG4gKiBsb2NhdGlvbiBvZiBvcmlnaW4sIGJhc2VkIG9uIHRoZSBjb21tZW50cyB0aGF0IGFyZSBlbWl0dGVkIGluIHRoZSBUQ0IgY29kZS5cbiAqXG4gKiBJZiB0aGUgZGlhZ25vc3RpYyBjb3VsZCBub3QgYmUgdHJhbnNsYXRlZCwgYG51bGxgIGlzIHJldHVybmVkIHRvIGluZGljYXRlIHRoYXQgdGhlIGRpYWdub3N0aWNcbiAqIHNob3VsZCBub3QgYmUgcmVwb3J0ZWQgYXQgYWxsLiBUaGlzIHByZXZlbnRzIGRpYWdub3N0aWNzIGZyb20gbm9uLVRDQiBjb2RlIGluIGEgdXNlcidzIHNvdXJjZVxuICogZmlsZSBmcm9tIGJlaW5nIHJlcG9ydGVkIGFzIHR5cGUtY2hlY2sgZXJyb3JzLlxuICovXG5leHBvcnQgZnVuY3Rpb24gdHJhbnNsYXRlRGlhZ25vc3RpYyhcbiAgICBkaWFnbm9zdGljOiB0cy5EaWFnbm9zdGljLCByZXNvbHZlcjogVGVtcGxhdGVTb3VyY2VSZXNvbHZlcik6IFRlbXBsYXRlRGlhZ25vc3RpY3xudWxsIHtcbiAgaWYgKGRpYWdub3N0aWMuZmlsZSA9PT0gdW5kZWZpbmVkIHx8IGRpYWdub3N0aWMuc3RhcnQgPT09IHVuZGVmaW5lZCkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gTG9jYXRlIHRoZSBub2RlIHRoYXQgdGhlIGRpYWdub3N0aWMgaXMgcmVwb3J0ZWQgb24gYW5kIGRldGVybWluZSBpdHMgbG9jYXRpb24gaW4gdGhlIHNvdXJjZS5cbiAgY29uc3Qgbm9kZSA9IGdldFRva2VuQXRQb3NpdGlvbihkaWFnbm9zdGljLmZpbGUsIGRpYWdub3N0aWMuc3RhcnQpO1xuICBjb25zdCBzb3VyY2VMb2NhdGlvbiA9IGZpbmRTb3VyY2VMb2NhdGlvbihub2RlLCBkaWFnbm9zdGljLmZpbGUpO1xuICBpZiAoc291cmNlTG9jYXRpb24gPT09IG51bGwpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIE5vdyB1c2UgdGhlIGV4dGVybmFsIHJlc29sdmVyIHRvIG9idGFpbiB0aGUgZnVsbCBgUGFyc2VTb3VyY2VGaWxlYCBvZiB0aGUgdGVtcGxhdGUuXG4gIGNvbnN0IHNwYW4gPSByZXNvbHZlci50b1BhcnNlU291cmNlU3Bhbihzb3VyY2VMb2NhdGlvbi5pZCwgc291cmNlTG9jYXRpb24uc3Bhbik7XG4gIGlmIChzcGFuID09PSBudWxsKSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBjb25zdCBtYXBwaW5nID0gcmVzb2x2ZXIuZ2V0U291cmNlTWFwcGluZyhzb3VyY2VMb2NhdGlvbi5pZCk7XG4gIHJldHVybiBtYWtlVGVtcGxhdGVEaWFnbm9zdGljKFxuICAgICAgc291cmNlTG9jYXRpb24uaWQsIG1hcHBpbmcsIHNwYW4sIGRpYWdub3N0aWMuY2F0ZWdvcnksIGRpYWdub3N0aWMuY29kZSxcbiAgICAgIGRpYWdub3N0aWMubWVzc2FnZVRleHQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmluZFR5cGVDaGVja0Jsb2NrKGZpbGU6IHRzLlNvdXJjZUZpbGUsIGlkOiBUZW1wbGF0ZUlkKTogdHMuTm9kZXxudWxsIHtcbiAgZm9yIChjb25zdCBzdG10IG9mIGZpbGUuc3RhdGVtZW50cykge1xuICAgIGlmICh0cy5pc0Z1bmN0aW9uRGVjbGFyYXRpb24oc3RtdCkgJiYgZ2V0VGVtcGxhdGVJZChzdG10LCBmaWxlKSA9PT0gaWQpIHtcbiAgICAgIHJldHVybiBzdG10O1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuaW50ZXJmYWNlIFNvdXJjZUxvY2F0aW9uIHtcbiAgaWQ6IFRlbXBsYXRlSWQ7XG4gIHNwYW46IEFic29sdXRlU291cmNlU3Bhbjtcbn1cblxuLyoqXG4gKiBUcmF2ZXJzZXMgdXAgdGhlIEFTVCBzdGFydGluZyBmcm9tIHRoZSBnaXZlbiBub2RlIHRvIGV4dHJhY3QgdGhlIHNvdXJjZSBsb2NhdGlvbiBmcm9tIGNvbW1lbnRzXG4gKiB0aGF0IGhhdmUgYmVlbiBlbWl0dGVkIGludG8gdGhlIFRDQi4gSWYgdGhlIG5vZGUgZG9lcyBub3QgZXhpc3Qgd2l0aGluIGEgVENCLCBvciBpZiBhbiBpZ25vcmVcbiAqIG1hcmtlciBjb21tZW50IGlzIGZvdW5kIHVwIHRoZSB0cmVlLCB0aGlzIGZ1bmN0aW9uIHJldHVybnMgbnVsbC5cbiAqL1xuZnVuY3Rpb24gZmluZFNvdXJjZUxvY2F0aW9uKG5vZGU6IHRzLk5vZGUsIHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUpOiBTb3VyY2VMb2NhdGlvbnxudWxsIHtcbiAgLy8gU2VhcmNoIGZvciBjb21tZW50cyB1bnRpbCB0aGUgVENCJ3MgZnVuY3Rpb24gZGVjbGFyYXRpb24gaXMgZW5jb3VudGVyZWQuXG4gIHdoaWxlIChub2RlICE9PSB1bmRlZmluZWQgJiYgIXRzLmlzRnVuY3Rpb25EZWNsYXJhdGlvbihub2RlKSkge1xuICAgIGlmIChoYXNJZ25vcmVNYXJrZXIobm9kZSwgc291cmNlRmlsZSkpIHtcbiAgICAgIC8vIFRoZXJlJ3MgYW4gaWdub3JlIG1hcmtlciBvbiB0aGlzIG5vZGUsIHNvIHRoZSBkaWFnbm9zdGljIHNob3VsZCBub3QgYmUgcmVwb3J0ZWQuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBjb25zdCBzcGFuID0gcmVhZFNwYW5Db21tZW50KHNvdXJjZUZpbGUsIG5vZGUpO1xuICAgIGlmIChzcGFuICE9PSBudWxsKSB7XG4gICAgICAvLyBPbmNlIHRoZSBwb3NpdGlvbmFsIGluZm9ybWF0aW9uIGhhcyBiZWVuIGV4dHJhY3RlZCwgc2VhcmNoIGZ1cnRoZXIgdXAgdGhlIFRDQiB0byBleHRyYWN0XG4gICAgICAvLyB0aGUgdW5pcXVlIGlkIHRoYXQgaXMgYXR0YWNoZWQgd2l0aCB0aGUgVENCJ3MgZnVuY3Rpb24gZGVjbGFyYXRpb24uXG4gICAgICBjb25zdCBpZCA9IGdldFRlbXBsYXRlSWQobm9kZSwgc291cmNlRmlsZSk7XG4gICAgICBpZiAoaWQgPT09IG51bGwpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9XG4gICAgICByZXR1cm4ge2lkLCBzcGFufTtcbiAgICB9XG5cbiAgICBub2RlID0gbm9kZS5wYXJlbnQ7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuZnVuY3Rpb24gZ2V0VGVtcGxhdGVJZChub2RlOiB0cy5Ob2RlLCBzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKTogVGVtcGxhdGVJZHxudWxsIHtcbiAgLy8gV2FsayB1cCB0byB0aGUgZnVuY3Rpb24gZGVjbGFyYXRpb24gb2YgdGhlIFRDQiwgdGhlIGZpbGUgaW5mb3JtYXRpb24gaXMgYXR0YWNoZWQgdGhlcmUuXG4gIHdoaWxlICghdHMuaXNGdW5jdGlvbkRlY2xhcmF0aW9uKG5vZGUpKSB7XG4gICAgaWYgKGhhc0lnbm9yZU1hcmtlcihub2RlLCBzb3VyY2VGaWxlKSkge1xuICAgICAgLy8gVGhlcmUncyBhbiBpZ25vcmUgbWFya2VyIG9uIHRoaXMgbm9kZSwgc28gdGhlIGRpYWdub3N0aWMgc2hvdWxkIG5vdCBiZSByZXBvcnRlZC5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBub2RlID0gbm9kZS5wYXJlbnQ7XG5cbiAgICAvLyBCYWlsIG9uY2Ugd2UgaGF2ZSByZWFjaGVkIHRoZSByb290LlxuICAgIGlmIChub2RlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGNvbnN0IHN0YXJ0ID0gbm9kZS5nZXRGdWxsU3RhcnQoKTtcbiAgcmV0dXJuIHRzLmZvckVhY2hMZWFkaW5nQ29tbWVudFJhbmdlKHNvdXJjZUZpbGUudGV4dCwgc3RhcnQsIChwb3MsIGVuZCwga2luZCkgPT4ge1xuICAgIGlmIChraW5kICE9PSB0cy5TeW50YXhLaW5kLk11bHRpTGluZUNvbW1lbnRUcml2aWEpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBjb25zdCBjb21tZW50VGV4dCA9IHNvdXJjZUZpbGUudGV4dC5zdWJzdHJpbmcocG9zICsgMiwgZW5kIC0gMik7XG4gICAgcmV0dXJuIGNvbW1lbnRUZXh0O1xuICB9KSBhcyBUZW1wbGF0ZUlkIHx8IG51bGw7XG59XG5cbmNvbnN0IHBhcnNlU3BhbkNvbW1lbnQgPSAvXihcXGQrKSwoXFxkKykkLztcblxuZnVuY3Rpb24gcmVhZFNwYW5Db21tZW50KHNvdXJjZUZpbGU6IHRzLlNvdXJjZUZpbGUsIG5vZGU6IHRzLk5vZGUpOiBBYnNvbHV0ZVNvdXJjZVNwYW58bnVsbCB7XG4gIHJldHVybiB0cy5mb3JFYWNoVHJhaWxpbmdDb21tZW50UmFuZ2Uoc291cmNlRmlsZS50ZXh0LCBub2RlLmdldEVuZCgpLCAocG9zLCBlbmQsIGtpbmQpID0+IHtcbiAgICBpZiAoa2luZCAhPT0gdHMuU3ludGF4S2luZC5NdWx0aUxpbmVDb21tZW50VHJpdmlhKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY29tbWVudFRleHQgPSBzb3VyY2VGaWxlLnRleHQuc3Vic3RyaW5nKHBvcyArIDIsIGVuZCAtIDIpO1xuICAgIGNvbnN0IG1hdGNoID0gY29tbWVudFRleHQubWF0Y2gocGFyc2VTcGFuQ29tbWVudCk7XG4gICAgaWYgKG1hdGNoID09PSBudWxsKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IEFic29sdXRlU291cmNlU3BhbigrbWF0Y2hbMV0sICttYXRjaFsyXSk7XG4gIH0pIHx8IG51bGw7XG59XG5cbmZ1bmN0aW9uIGhhc0lnbm9yZU1hcmtlcihub2RlOiB0cy5Ob2RlLCBzb3VyY2VGaWxlOiB0cy5Tb3VyY2VGaWxlKTogYm9vbGVhbiB7XG4gIHJldHVybiB0cy5mb3JFYWNoVHJhaWxpbmdDb21tZW50UmFuZ2Uoc291cmNlRmlsZS50ZXh0LCBub2RlLmdldEVuZCgpLCAocG9zLCBlbmQsIGtpbmQpID0+IHtcbiAgICBpZiAoa2luZCAhPT0gdHMuU3ludGF4S2luZC5NdWx0aUxpbmVDb21tZW50VHJpdmlhKSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gICAgY29uc3QgY29tbWVudFRleHQgPSBzb3VyY2VGaWxlLnRleHQuc3Vic3RyaW5nKHBvcyArIDIsIGVuZCAtIDIpO1xuICAgIHJldHVybiBjb21tZW50VGV4dCA9PT0gSUdOT1JFX01BUktFUjtcbiAgfSkgPT09IHRydWU7XG59XG4iXX0=