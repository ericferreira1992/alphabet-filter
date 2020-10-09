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
        define("@angular/compiler-cli/src/ngtsc/typecheck/diagnostics/src/id", ["require", "exports"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getTemplateId = void 0;
    var TEMPLATE_ID = Symbol('ngTemplateId');
    var NEXT_TEMPLATE_ID = Symbol('ngNextTemplateId');
    function getTemplateId(clazz) {
        var node = clazz;
        if (node[TEMPLATE_ID] === undefined) {
            node[TEMPLATE_ID] = allocateTemplateId(node.getSourceFile());
        }
        return node[TEMPLATE_ID];
    }
    exports.getTemplateId = getTemplateId;
    function allocateTemplateId(sf) {
        if (sf[NEXT_TEMPLATE_ID] === undefined) {
            sf[NEXT_TEMPLATE_ID] = 1;
        }
        return ("tcb" + sf[NEXT_TEMPLATE_ID]++);
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9jb21waWxlci1jbGkvc3JjL25ndHNjL3R5cGVjaGVjay9kaWFnbm9zdGljcy9zcmMvaWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HOzs7Ozs7Ozs7Ozs7O0lBT0gsSUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBQzNDLElBQU0sZ0JBQWdCLEdBQUcsTUFBTSxDQUFDLGtCQUFrQixDQUFDLENBQUM7SUFVcEQsU0FBZ0IsYUFBYSxDQUFDLEtBQXFCO1FBQ2pELElBQU0sSUFBSSxHQUFHLEtBQWdELENBQUM7UUFDOUQsSUFBSSxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssU0FBUyxFQUFFO1lBQ25DLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLENBQUMsQ0FBQztTQUM5RDtRQUNELE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBRSxDQUFDO0lBQzVCLENBQUM7SUFORCxzQ0FNQztJQUVELFNBQVMsa0JBQWtCLENBQUMsRUFBNEM7UUFDdEUsSUFBSSxFQUFFLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxTQUFTLEVBQUU7WUFDdEMsRUFBRSxDQUFDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQzFCO1FBQ0QsT0FBTyxDQUFDLFFBQU0sRUFBRSxDQUFDLGdCQUFnQixDQUFFLEVBQUksQ0FBZSxDQUFDO0lBQ3pELENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKi9cblxuaW1wb3J0ICogYXMgdHMgZnJvbSAndHlwZXNjcmlwdCc7XG5cbmltcG9ydCB7VGVtcGxhdGVJZH0gZnJvbSAnLi4vLi4vYXBpJztcblxuXG5jb25zdCBURU1QTEFURV9JRCA9IFN5bWJvbCgnbmdUZW1wbGF0ZUlkJyk7XG5jb25zdCBORVhUX1RFTVBMQVRFX0lEID0gU3ltYm9sKCduZ05leHRUZW1wbGF0ZUlkJyk7XG5cbmludGVyZmFjZSBIYXNUZW1wbGF0ZUlkIHtcbiAgW1RFTVBMQVRFX0lEXTogVGVtcGxhdGVJZDtcbn1cblxuaW50ZXJmYWNlIEhhc05leHRUZW1wbGF0ZUlkIHtcbiAgW05FWFRfVEVNUExBVEVfSURdOiBudW1iZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRUZW1wbGF0ZUlkKGNsYXp6OiB0cy5EZWNsYXJhdGlvbik6IFRlbXBsYXRlSWQge1xuICBjb25zdCBub2RlID0gY2xhenogYXMgdHMuRGVjbGFyYXRpb24gJiBQYXJ0aWFsPEhhc1RlbXBsYXRlSWQ+O1xuICBpZiAobm9kZVtURU1QTEFURV9JRF0gPT09IHVuZGVmaW5lZCkge1xuICAgIG5vZGVbVEVNUExBVEVfSURdID0gYWxsb2NhdGVUZW1wbGF0ZUlkKG5vZGUuZ2V0U291cmNlRmlsZSgpKTtcbiAgfVxuICByZXR1cm4gbm9kZVtURU1QTEFURV9JRF0hO1xufVxuXG5mdW5jdGlvbiBhbGxvY2F0ZVRlbXBsYXRlSWQoc2Y6IHRzLlNvdXJjZUZpbGUmUGFydGlhbDxIYXNOZXh0VGVtcGxhdGVJZD4pOiBUZW1wbGF0ZUlkIHtcbiAgaWYgKHNmW05FWFRfVEVNUExBVEVfSURdID09PSB1bmRlZmluZWQpIHtcbiAgICBzZltORVhUX1RFTVBMQVRFX0lEXSA9IDE7XG4gIH1cbiAgcmV0dXJuIChgdGNiJHtzZltORVhUX1RFTVBMQVRFX0lEXSErK31gKSBhcyBUZW1wbGF0ZUlkO1xufVxuIl19