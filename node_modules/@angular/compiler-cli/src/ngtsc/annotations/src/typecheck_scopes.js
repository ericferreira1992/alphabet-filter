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
        define("@angular/compiler-cli/src/ngtsc/annotations/src/typecheck_scopes", ["require", "exports", "tslib", "@angular/compiler", "typescript", "@angular/compiler-cli/src/ngtsc/metadata"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.TypeCheckScopes = void 0;
    var tslib_1 = require("tslib");
    var compiler_1 = require("@angular/compiler");
    var ts = require("typescript");
    var metadata_1 = require("@angular/compiler-cli/src/ngtsc/metadata");
    /**
     * Computes scope information to be used in template type checking.
     */
    var TypeCheckScopes = /** @class */ (function () {
        function TypeCheckScopes(scopeReader, metaReader) {
            this.scopeReader = scopeReader;
            this.metaReader = metaReader;
            /**
             * Cache of flattened directive metadata. Because flattened metadata is scope-invariant it's
             * cached individually, such that all scopes refer to the same flattened metadata.
             */
            this.flattenedDirectiveMetaCache = new Map();
            /**
             * Cache of the computed type check scope per NgModule declaration.
             */
            this.scopeCache = new Map();
        }
        /**
         * Computes the type-check scope information for the component declaration. If the NgModule
         * contains an error, then 'error' is returned. If the component is not declared in any NgModule,
         * an empty type-check scope is returned.
         */
        TypeCheckScopes.prototype.getTypeCheckScope = function (node) {
            var e_1, _a, e_2, _b;
            var matcher = new compiler_1.SelectorMatcher();
            var pipes = new Map();
            var scope = this.scopeReader.getScopeForComponent(node);
            if (scope === null) {
                return { matcher: matcher, pipes: pipes, schemas: [] };
            }
            else if (scope === 'error') {
                return scope;
            }
            if (this.scopeCache.has(scope.ngModule)) {
                return this.scopeCache.get(scope.ngModule);
            }
            try {
                for (var _c = tslib_1.__values(scope.compilation.directives), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var meta = _d.value;
                    if (meta.selector !== null) {
                        var extMeta = this.getInheritedDirectiveMetadata(meta.ref);
                        matcher.addSelectables(compiler_1.CssSelector.parse(meta.selector), extMeta);
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
            try {
                for (var _e = tslib_1.__values(scope.compilation.pipes), _f = _e.next(); !_f.done; _f = _e.next()) {
                    var _g = _f.value, name_1 = _g.name, ref = _g.ref;
                    if (!ts.isClassDeclaration(ref.node)) {
                        throw new Error("Unexpected non-class declaration " + ts.SyntaxKind[ref.node.kind] + " for pipe " + ref.debugName);
                    }
                    pipes.set(name_1, ref);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                }
                finally { if (e_2) throw e_2.error; }
            }
            var typeCheckScope = { matcher: matcher, pipes: pipes, schemas: scope.schemas };
            this.scopeCache.set(scope.ngModule, typeCheckScope);
            return typeCheckScope;
        };
        TypeCheckScopes.prototype.getInheritedDirectiveMetadata = function (ref) {
            var clazz = ref.node;
            if (this.flattenedDirectiveMetaCache.has(clazz)) {
                return this.flattenedDirectiveMetaCache.get(clazz);
            }
            var meta = metadata_1.flattenInheritedDirectiveMetadata(this.metaReader, ref);
            this.flattenedDirectiveMetaCache.set(clazz, meta);
            return meta;
        };
        return TypeCheckScopes;
    }());
    exports.TypeCheckScopes = TypeCheckScopes;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZWNoZWNrX3Njb3Blcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BhY2thZ2VzL2NvbXBpbGVyLWNsaS9zcmMvbmd0c2MvYW5ub3RhdGlvbnMvc3JjL3R5cGVjaGVja19zY29wZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7OztJQUVILDhDQUErRTtJQUMvRSwrQkFBaUM7SUFHakMscUVBQWdHO0lBeUJoRzs7T0FFRztJQUNIO1FBWUUseUJBQW9CLFdBQWlDLEVBQVUsVUFBMEI7WUFBckUsZ0JBQVcsR0FBWCxXQUFXLENBQXNCO1lBQVUsZUFBVSxHQUFWLFVBQVUsQ0FBZ0I7WUFYekY7OztlQUdHO1lBQ0ssZ0NBQTJCLEdBQUcsSUFBSSxHQUFHLEVBQW1DLENBQUM7WUFFakY7O2VBRUc7WUFDSyxlQUFVLEdBQUcsSUFBSSxHQUFHLEVBQW9DLENBQUM7UUFFMkIsQ0FBQztRQUU3Rjs7OztXQUlHO1FBQ0gsMkNBQWlCLEdBQWpCLFVBQWtCLElBQXNCOztZQUN0QyxJQUFNLE9BQU8sR0FBRyxJQUFJLDBCQUFlLEVBQWlCLENBQUM7WUFDckQsSUFBTSxLQUFLLEdBQUcsSUFBSSxHQUFHLEVBQTRELENBQUM7WUFFbEYsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUMxRCxJQUFJLEtBQUssS0FBSyxJQUFJLEVBQUU7Z0JBQ2xCLE9BQU8sRUFBQyxPQUFPLFNBQUEsRUFBRSxLQUFLLE9BQUEsRUFBRSxPQUFPLEVBQUUsRUFBRSxFQUFDLENBQUM7YUFDdEM7aUJBQU0sSUFBSSxLQUFLLEtBQUssT0FBTyxFQUFFO2dCQUM1QixPQUFPLEtBQUssQ0FBQzthQUNkO1lBRUQsSUFBSSxJQUFJLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLEVBQUU7Z0JBQ3ZDLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBRSxDQUFDO2FBQzdDOztnQkFFRCxLQUFtQixJQUFBLEtBQUEsaUJBQUEsS0FBSyxDQUFDLFdBQVcsQ0FBQyxVQUFVLENBQUEsZ0JBQUEsNEJBQUU7b0JBQTVDLElBQU0sSUFBSSxXQUFBO29CQUNiLElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7d0JBQzFCLElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7d0JBQzdELE9BQU8sQ0FBQyxjQUFjLENBQUMsc0JBQVcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxDQUFDO3FCQUNuRTtpQkFDRjs7Ozs7Ozs7OztnQkFFRCxLQUEwQixJQUFBLEtBQUEsaUJBQUEsS0FBSyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUEsZ0JBQUEsNEJBQUU7b0JBQXhDLElBQUEsYUFBVyxFQUFWLE1BQUksVUFBQSxFQUFFLEdBQUcsU0FBQTtvQkFDbkIsSUFBSSxDQUFDLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7d0JBQ3BDLE1BQU0sSUFBSSxLQUFLLENBQUMsc0NBQ1osRUFBRSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrQkFBYSxHQUFHLENBQUMsU0FBVyxDQUFDLENBQUM7cUJBQy9EO29CQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsTUFBSSxFQUFFLEdBQXVELENBQUMsQ0FBQztpQkFDMUU7Ozs7Ozs7OztZQUVELElBQU0sY0FBYyxHQUFtQixFQUFDLE9BQU8sU0FBQSxFQUFFLEtBQUssT0FBQSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTyxFQUFDLENBQUM7WUFDaEYsSUFBSSxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUNwRCxPQUFPLGNBQWMsQ0FBQztRQUN4QixDQUFDO1FBRU8sdURBQTZCLEdBQXJDLFVBQXNDLEdBQWdDO1lBQ3BFLElBQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxJQUFJLENBQUM7WUFDdkIsSUFBSSxJQUFJLENBQUMsMkJBQTJCLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxFQUFFO2dCQUMvQyxPQUFPLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFFLENBQUM7YUFDckQ7WUFFRCxJQUFNLElBQUksR0FBRyw0Q0FBaUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3JFLElBQUksQ0FBQywyQkFBMkIsQ0FBQyxHQUFHLENBQUMsS0FBSyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2xELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQztRQUNILHNCQUFDO0lBQUQsQ0FBQyxBQWhFRCxJQWdFQztJQWhFWSwwQ0FBZSIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQge0Nzc1NlbGVjdG9yLCBTY2hlbWFNZXRhZGF0YSwgU2VsZWN0b3JNYXRjaGVyfSBmcm9tICdAYW5ndWxhci9jb21waWxlcic7XG5pbXBvcnQgKiBhcyB0cyBmcm9tICd0eXBlc2NyaXB0JztcblxuaW1wb3J0IHtSZWZlcmVuY2V9IGZyb20gJy4uLy4uL2ltcG9ydHMnO1xuaW1wb3J0IHtEaXJlY3RpdmVNZXRhLCBmbGF0dGVuSW5oZXJpdGVkRGlyZWN0aXZlTWV0YWRhdGEsIE1ldGFkYXRhUmVhZGVyfSBmcm9tICcuLi8uLi9tZXRhZGF0YSc7XG5pbXBvcnQge0NsYXNzRGVjbGFyYXRpb259IGZyb20gJy4uLy4uL3JlZmxlY3Rpb24nO1xuaW1wb3J0IHtDb21wb25lbnRTY29wZVJlYWRlcn0gZnJvbSAnLi4vLi4vc2NvcGUnO1xuXG4vKipcbiAqIFRoZSBzY29wZSB0aGF0IGlzIHVzZWQgZm9yIHR5cGUtY2hlY2sgY29kZSBnZW5lcmF0aW9uIG9mIGEgY29tcG9uZW50IHRlbXBsYXRlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFR5cGVDaGVja1Njb3BlIHtcbiAgLyoqXG4gICAqIEEgYFNlbGVjdG9yTWF0Y2hlcmAgaW5zdGFuY2UgdGhhdCBjb250YWlucyB0aGUgZmxhdHRlbmVkIGRpcmVjdGl2ZSBtZXRhZGF0YSBvZiBhbGwgZGlyZWN0aXZlc1xuICAgKiB0aGF0IGFyZSBpbiB0aGUgY29tcGlsYXRpb24gc2NvcGUgb2YgdGhlIGRlY2xhcmluZyBOZ01vZHVsZS5cbiAgICovXG4gIG1hdGNoZXI6IFNlbGVjdG9yTWF0Y2hlcjxEaXJlY3RpdmVNZXRhPjtcblxuICAvKipcbiAgICogVGhlIHBpcGVzIHRoYXQgYXJlIGF2YWlsYWJsZSBpbiB0aGUgY29tcGlsYXRpb24gc2NvcGUuXG4gICAqL1xuICBwaXBlczogTWFwPHN0cmluZywgUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4+PjtcblxuICAvKipcbiAgICogVGhlIHNjaGVtYXMgdGhhdCBhcmUgdXNlZCBpbiB0aGlzIHNjb3BlLlxuICAgKi9cbiAgc2NoZW1hczogU2NoZW1hTWV0YWRhdGFbXTtcbn1cblxuLyoqXG4gKiBDb21wdXRlcyBzY29wZSBpbmZvcm1hdGlvbiB0byBiZSB1c2VkIGluIHRlbXBsYXRlIHR5cGUgY2hlY2tpbmcuXG4gKi9cbmV4cG9ydCBjbGFzcyBUeXBlQ2hlY2tTY29wZXMge1xuICAvKipcbiAgICogQ2FjaGUgb2YgZmxhdHRlbmVkIGRpcmVjdGl2ZSBtZXRhZGF0YS4gQmVjYXVzZSBmbGF0dGVuZWQgbWV0YWRhdGEgaXMgc2NvcGUtaW52YXJpYW50IGl0J3NcbiAgICogY2FjaGVkIGluZGl2aWR1YWxseSwgc3VjaCB0aGF0IGFsbCBzY29wZXMgcmVmZXIgdG8gdGhlIHNhbWUgZmxhdHRlbmVkIG1ldGFkYXRhLlxuICAgKi9cbiAgcHJpdmF0ZSBmbGF0dGVuZWREaXJlY3RpdmVNZXRhQ2FjaGUgPSBuZXcgTWFwPENsYXNzRGVjbGFyYXRpb24sIERpcmVjdGl2ZU1ldGE+KCk7XG5cbiAgLyoqXG4gICAqIENhY2hlIG9mIHRoZSBjb21wdXRlZCB0eXBlIGNoZWNrIHNjb3BlIHBlciBOZ01vZHVsZSBkZWNsYXJhdGlvbi5cbiAgICovXG4gIHByaXZhdGUgc2NvcGVDYWNoZSA9IG5ldyBNYXA8Q2xhc3NEZWNsYXJhdGlvbiwgVHlwZUNoZWNrU2NvcGU+KCk7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBzY29wZVJlYWRlcjogQ29tcG9uZW50U2NvcGVSZWFkZXIsIHByaXZhdGUgbWV0YVJlYWRlcjogTWV0YWRhdGFSZWFkZXIpIHt9XG5cbiAgLyoqXG4gICAqIENvbXB1dGVzIHRoZSB0eXBlLWNoZWNrIHNjb3BlIGluZm9ybWF0aW9uIGZvciB0aGUgY29tcG9uZW50IGRlY2xhcmF0aW9uLiBJZiB0aGUgTmdNb2R1bGVcbiAgICogY29udGFpbnMgYW4gZXJyb3IsIHRoZW4gJ2Vycm9yJyBpcyByZXR1cm5lZC4gSWYgdGhlIGNvbXBvbmVudCBpcyBub3QgZGVjbGFyZWQgaW4gYW55IE5nTW9kdWxlLFxuICAgKiBhbiBlbXB0eSB0eXBlLWNoZWNrIHNjb3BlIGlzIHJldHVybmVkLlxuICAgKi9cbiAgZ2V0VHlwZUNoZWNrU2NvcGUobm9kZTogQ2xhc3NEZWNsYXJhdGlvbik6IFR5cGVDaGVja1Njb3BlfCdlcnJvcicge1xuICAgIGNvbnN0IG1hdGNoZXIgPSBuZXcgU2VsZWN0b3JNYXRjaGVyPERpcmVjdGl2ZU1ldGE+KCk7XG4gICAgY29uc3QgcGlwZXMgPSBuZXcgTWFwPHN0cmluZywgUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4+PigpO1xuXG4gICAgY29uc3Qgc2NvcGUgPSB0aGlzLnNjb3BlUmVhZGVyLmdldFNjb3BlRm9yQ29tcG9uZW50KG5vZGUpO1xuICAgIGlmIChzY29wZSA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHttYXRjaGVyLCBwaXBlcywgc2NoZW1hczogW119O1xuICAgIH0gZWxzZSBpZiAoc2NvcGUgPT09ICdlcnJvcicpIHtcbiAgICAgIHJldHVybiBzY29wZTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zY29wZUNhY2hlLmhhcyhzY29wZS5uZ01vZHVsZSkpIHtcbiAgICAgIHJldHVybiB0aGlzLnNjb3BlQ2FjaGUuZ2V0KHNjb3BlLm5nTW9kdWxlKSE7XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCBtZXRhIG9mIHNjb3BlLmNvbXBpbGF0aW9uLmRpcmVjdGl2ZXMpIHtcbiAgICAgIGlmIChtZXRhLnNlbGVjdG9yICE9PSBudWxsKSB7XG4gICAgICAgIGNvbnN0IGV4dE1ldGEgPSB0aGlzLmdldEluaGVyaXRlZERpcmVjdGl2ZU1ldGFkYXRhKG1ldGEucmVmKTtcbiAgICAgICAgbWF0Y2hlci5hZGRTZWxlY3RhYmxlcyhDc3NTZWxlY3Rvci5wYXJzZShtZXRhLnNlbGVjdG9yKSwgZXh0TWV0YSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZm9yIChjb25zdCB7bmFtZSwgcmVmfSBvZiBzY29wZS5jb21waWxhdGlvbi5waXBlcykge1xuICAgICAgaWYgKCF0cy5pc0NsYXNzRGVjbGFyYXRpb24ocmVmLm5vZGUpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZCBub24tY2xhc3MgZGVjbGFyYXRpb24gJHtcbiAgICAgICAgICAgIHRzLlN5bnRheEtpbmRbcmVmLm5vZGUua2luZF19IGZvciBwaXBlICR7cmVmLmRlYnVnTmFtZX1gKTtcbiAgICAgIH1cbiAgICAgIHBpcGVzLnNldChuYW1lLCByZWYgYXMgUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb248dHMuQ2xhc3NEZWNsYXJhdGlvbj4+KTtcbiAgICB9XG5cbiAgICBjb25zdCB0eXBlQ2hlY2tTY29wZTogVHlwZUNoZWNrU2NvcGUgPSB7bWF0Y2hlciwgcGlwZXMsIHNjaGVtYXM6IHNjb3BlLnNjaGVtYXN9O1xuICAgIHRoaXMuc2NvcGVDYWNoZS5zZXQoc2NvcGUubmdNb2R1bGUsIHR5cGVDaGVja1Njb3BlKTtcbiAgICByZXR1cm4gdHlwZUNoZWNrU2NvcGU7XG4gIH1cblxuICBwcml2YXRlIGdldEluaGVyaXRlZERpcmVjdGl2ZU1ldGFkYXRhKHJlZjogUmVmZXJlbmNlPENsYXNzRGVjbGFyYXRpb24+KTogRGlyZWN0aXZlTWV0YSB7XG4gICAgY29uc3QgY2xhenogPSByZWYubm9kZTtcbiAgICBpZiAodGhpcy5mbGF0dGVuZWREaXJlY3RpdmVNZXRhQ2FjaGUuaGFzKGNsYXp6KSkge1xuICAgICAgcmV0dXJuIHRoaXMuZmxhdHRlbmVkRGlyZWN0aXZlTWV0YUNhY2hlLmdldChjbGF6eikhO1xuICAgIH1cblxuICAgIGNvbnN0IG1ldGEgPSBmbGF0dGVuSW5oZXJpdGVkRGlyZWN0aXZlTWV0YWRhdGEodGhpcy5tZXRhUmVhZGVyLCByZWYpO1xuICAgIHRoaXMuZmxhdHRlbmVkRGlyZWN0aXZlTWV0YUNhY2hlLnNldChjbGF6eiwgbWV0YSk7XG4gICAgcmV0dXJuIG1ldGE7XG4gIH1cbn1cbiJdfQ==