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
        define("@angular/compiler-cli/src/ngtsc/translator", ["require", "exports", "@angular/compiler-cli/src/ngtsc/translator/src/translator"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.translateType = exports.translateStatement = exports.translateExpression = exports.ImportManager = exports.attachComments = void 0;
    var translator_1 = require("@angular/compiler-cli/src/ngtsc/translator/src/translator");
    Object.defineProperty(exports, "attachComments", { enumerable: true, get: function () { return translator_1.attachComments; } });
    Object.defineProperty(exports, "ImportManager", { enumerable: true, get: function () { return translator_1.ImportManager; } });
    Object.defineProperty(exports, "translateExpression", { enumerable: true, get: function () { return translator_1.translateExpression; } });
    Object.defineProperty(exports, "translateStatement", { enumerable: true, get: function () { return translator_1.translateStatement; } });
    Object.defineProperty(exports, "translateType", { enumerable: true, get: function () { return translator_1.translateType; } });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3RyYW5zbGF0b3IvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBRUgsd0ZBQTRJO0lBQXBJLDRHQUFBLGNBQWMsT0FBQTtJQUFVLDJHQUFBLGFBQWEsT0FBQTtJQUFlLGlIQUFBLG1CQUFtQixPQUFBO0lBQUUsZ0hBQUEsa0JBQWtCLE9BQUE7SUFBRSwyR0FBQSxhQUFhLE9BQUEiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuZXhwb3J0IHthdHRhY2hDb21tZW50cywgSW1wb3J0LCBJbXBvcnRNYW5hZ2VyLCBOYW1lZEltcG9ydCwgdHJhbnNsYXRlRXhwcmVzc2lvbiwgdHJhbnNsYXRlU3RhdGVtZW50LCB0cmFuc2xhdGVUeXBlfSBmcm9tICcuL3NyYy90cmFuc2xhdG9yJztcbiJdfQ==