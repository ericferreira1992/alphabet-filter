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
        define("@angular/compiler/src/render3/r3_template_transform", ["require", "exports", "tslib", "@angular/compiler/src/ml_parser/ast", "@angular/compiler/src/ml_parser/html_whitespaces", "@angular/compiler/src/ml_parser/tags", "@angular/compiler/src/parse_util", "@angular/compiler/src/style_url_resolver", "@angular/compiler/src/template_parser/template_preparser", "@angular/compiler/src/render3/r3_ast", "@angular/compiler/src/render3/view/i18n/util"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.htmlAstToRender3Ast = void 0;
    var tslib_1 = require("tslib");
    var html = require("@angular/compiler/src/ml_parser/ast");
    var html_whitespaces_1 = require("@angular/compiler/src/ml_parser/html_whitespaces");
    var tags_1 = require("@angular/compiler/src/ml_parser/tags");
    var parse_util_1 = require("@angular/compiler/src/parse_util");
    var style_url_resolver_1 = require("@angular/compiler/src/style_url_resolver");
    var template_preparser_1 = require("@angular/compiler/src/template_parser/template_preparser");
    var t = require("@angular/compiler/src/render3/r3_ast");
    var util_1 = require("@angular/compiler/src/render3/view/i18n/util");
    var BIND_NAME_REGEXP = /^(?:(?:(?:(bind-)|(let-)|(ref-|#)|(on-)|(bindon-)|(@))(.*))|\[\(([^\)]+)\)\]|\[([^\]]+)\]|\(([^\)]+)\))$/;
    // Group 1 = "bind-"
    var KW_BIND_IDX = 1;
    // Group 2 = "let-"
    var KW_LET_IDX = 2;
    // Group 3 = "ref-/#"
    var KW_REF_IDX = 3;
    // Group 4 = "on-"
    var KW_ON_IDX = 4;
    // Group 5 = "bindon-"
    var KW_BINDON_IDX = 5;
    // Group 6 = "@"
    var KW_AT_IDX = 6;
    // Group 7 = the identifier after "bind-", "let-", "ref-/#", "on-", "bindon-" or "@"
    var IDENT_KW_IDX = 7;
    // Group 8 = identifier inside [()]
    var IDENT_BANANA_BOX_IDX = 8;
    // Group 9 = identifier inside []
    var IDENT_PROPERTY_IDX = 9;
    // Group 10 = identifier inside ()
    var IDENT_EVENT_IDX = 10;
    var TEMPLATE_ATTR_PREFIX = '*';
    function htmlAstToRender3Ast(htmlNodes, bindingParser) {
        var transformer = new HtmlAstToIvyAst(bindingParser);
        var ivyNodes = html.visitAll(transformer, htmlNodes);
        // Errors might originate in either the binding parser or the html to ivy transformer
        var allErrors = bindingParser.errors.concat(transformer.errors);
        return {
            nodes: ivyNodes,
            errors: allErrors,
            styleUrls: transformer.styleUrls,
            styles: transformer.styles,
            ngContentSelectors: transformer.ngContentSelectors,
        };
    }
    exports.htmlAstToRender3Ast = htmlAstToRender3Ast;
    var HtmlAstToIvyAst = /** @class */ (function () {
        function HtmlAstToIvyAst(bindingParser) {
            this.bindingParser = bindingParser;
            this.errors = [];
            this.styles = [];
            this.styleUrls = [];
            this.ngContentSelectors = [];
            this.inI18nBlock = false;
        }
        // HTML visitor
        HtmlAstToIvyAst.prototype.visitElement = function (element) {
            var e_1, _a;
            var _this = this;
            var isI18nRootElement = util_1.isI18nRootNode(element.i18n);
            if (isI18nRootElement) {
                if (this.inI18nBlock) {
                    this.reportError('Cannot mark an element as translatable inside of a translatable section. Please remove the nested i18n marker.', element.sourceSpan);
                }
                this.inI18nBlock = true;
            }
            var preparsedElement = template_preparser_1.preparseElement(element);
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.SCRIPT) {
                return null;
            }
            else if (preparsedElement.type === template_preparser_1.PreparsedElementType.STYLE) {
                var contents = textContents(element);
                if (contents !== null) {
                    this.styles.push(contents);
                }
                return null;
            }
            else if (preparsedElement.type === template_preparser_1.PreparsedElementType.STYLESHEET &&
                style_url_resolver_1.isStyleUrlResolvable(preparsedElement.hrefAttr)) {
                this.styleUrls.push(preparsedElement.hrefAttr);
                return null;
            }
            // Whether the element is a `<ng-template>`
            var isTemplateElement = tags_1.isNgTemplate(element.name);
            var parsedProperties = [];
            var boundEvents = [];
            var variables = [];
            var references = [];
            var attributes = [];
            var i18nAttrsMeta = {};
            var templateParsedProperties = [];
            var templateVariables = [];
            // Whether the element has any *-attribute
            var elementHasInlineTemplate = false;
            try {
                for (var _b = tslib_1.__values(element.attrs), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var attribute = _c.value;
                    var hasBinding = false;
                    var normalizedName = normalizeAttributeName(attribute.name);
                    // `*attr` defines template bindings
                    var isTemplateBinding = false;
                    if (attribute.i18n) {
                        i18nAttrsMeta[attribute.name] = attribute.i18n;
                    }
                    if (normalizedName.startsWith(TEMPLATE_ATTR_PREFIX)) {
                        // *-attributes
                        if (elementHasInlineTemplate) {
                            this.reportError("Can't have multiple template bindings on one element. Use only one attribute prefixed with *", attribute.sourceSpan);
                        }
                        isTemplateBinding = true;
                        elementHasInlineTemplate = true;
                        var templateValue = attribute.value;
                        var templateKey = normalizedName.substring(TEMPLATE_ATTR_PREFIX.length);
                        var parsedVariables = [];
                        var absoluteValueOffset = attribute.valueSpan ?
                            attribute.valueSpan.start.offset :
                            // If there is no value span the attribute does not have a value, like `attr` in
                            //`<div attr></div>`. In this case, point to one character beyond the last character of
                            // the attribute name.
                            attribute.sourceSpan.start.offset + attribute.name.length;
                        this.bindingParser.parseInlineTemplateBinding(templateKey, templateValue, attribute.sourceSpan, absoluteValueOffset, [], templateParsedProperties, parsedVariables);
                        templateVariables.push.apply(templateVariables, tslib_1.__spread(parsedVariables.map(function (v) { return new t.Variable(v.name, v.value, v.sourceSpan, v.valueSpan); })));
                    }
                    else {
                        // Check for variables, events, property bindings, interpolation
                        hasBinding = this.parseAttribute(isTemplateElement, attribute, [], parsedProperties, boundEvents, variables, references);
                    }
                    if (!hasBinding && !isTemplateBinding) {
                        // don't include the bindings as attributes as well in the AST
                        attributes.push(this.visitAttribute(attribute));
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
            var children = html.visitAll(preparsedElement.nonBindable ? NON_BINDABLE_VISITOR : this, element.children);
            var parsedElement;
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.NG_CONTENT) {
                // `<ng-content>`
                if (element.children &&
                    !element.children.every(function (node) { return isEmptyTextNode(node) || isCommentNode(node); })) {
                    this.reportError("<ng-content> element cannot have content.", element.sourceSpan);
                }
                var selector = preparsedElement.selectAttr;
                var attrs = element.attrs.map(function (attr) { return _this.visitAttribute(attr); });
                parsedElement = new t.Content(selector, attrs, element.sourceSpan, element.i18n);
                this.ngContentSelectors.push(selector);
            }
            else if (isTemplateElement) {
                // `<ng-template>`
                var attrs = this.extractAttributes(element.name, parsedProperties, i18nAttrsMeta);
                parsedElement = new t.Template(element.name, attributes, attrs.bound, boundEvents, [ /* no template attributes */], children, references, variables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
            }
            else {
                var attrs = this.extractAttributes(element.name, parsedProperties, i18nAttrsMeta);
                parsedElement = new t.Element(element.name, attributes, attrs.bound, boundEvents, children, references, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, element.i18n);
            }
            if (elementHasInlineTemplate) {
                // If this node is an inline-template (e.g. has *ngFor) then we need to create a template
                // node that contains this node.
                // Moreover, if the node is an element, then we need to hoist its attributes to the template
                // node for matching against content projection selectors.
                var attrs = this.extractAttributes('ng-template', templateParsedProperties, i18nAttrsMeta);
                var templateAttrs_1 = [];
                attrs.literal.forEach(function (attr) { return templateAttrs_1.push(attr); });
                attrs.bound.forEach(function (attr) { return templateAttrs_1.push(attr); });
                var hoistedAttrs = parsedElement instanceof t.Element ?
                    {
                        attributes: parsedElement.attributes,
                        inputs: parsedElement.inputs,
                        outputs: parsedElement.outputs,
                    } :
                    { attributes: [], inputs: [], outputs: [] };
                // For <ng-template>s with structural directives on them, avoid passing i18n information to
                // the wrapping template to prevent unnecessary i18n instructions from being generated. The
                // necessary i18n meta information will be extracted from child elements.
                var i18n_1 = isTemplateElement && isI18nRootElement ? undefined : element.i18n;
                // TODO(pk): test for this case
                parsedElement = new t.Template(parsedElement.name, hoistedAttrs.attributes, hoistedAttrs.inputs, hoistedAttrs.outputs, templateAttrs_1, [parsedElement], [ /* no references */], templateVariables, element.sourceSpan, element.startSourceSpan, element.endSourceSpan, i18n_1);
            }
            if (isI18nRootElement) {
                this.inI18nBlock = false;
            }
            return parsedElement;
        };
        HtmlAstToIvyAst.prototype.visitAttribute = function (attribute) {
            return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, attribute.valueSpan, attribute.i18n);
        };
        HtmlAstToIvyAst.prototype.visitText = function (text) {
            return this._visitTextWithInterpolation(text.value, text.sourceSpan, text.i18n);
        };
        HtmlAstToIvyAst.prototype.visitExpansion = function (expansion) {
            var _this = this;
            if (!expansion.i18n) {
                // do not generate Icu in case it was created
                // outside of i18n block in a template
                return null;
            }
            if (!util_1.isI18nRootNode(expansion.i18n)) {
                throw new Error("Invalid type \"" + expansion.i18n.constructor + "\" for \"i18n\" property of " + expansion.sourceSpan.toString() + ". Expected a \"Message\"");
            }
            var message = expansion.i18n;
            var vars = {};
            var placeholders = {};
            // extract VARs from ICUs - we process them separately while
            // assembling resulting message via goog.getMsg function, since
            // we need to pass them to top-level goog.getMsg call
            Object.keys(message.placeholders).forEach(function (key) {
                var value = message.placeholders[key];
                if (key.startsWith(util_1.I18N_ICU_VAR_PREFIX)) {
                    var config = _this.bindingParser.interpolationConfig;
                    // ICU expression is a plain string, not wrapped into start
                    // and end tags, so we wrap it before passing to binding parser
                    var wrapped = "" + config.start + value + config.end;
                    // Currently when the `plural` or `select` keywords in an ICU contain trailing spaces (e.g.
                    // `{count, select , ...}`), these spaces are also included into the key names in ICU vars
                    // (e.g. "VAR_SELECT "). These trailing spaces are not desirable, since they will later be
                    // converted into `_` symbols while normalizing placeholder names, which might lead to
                    // mismatches at runtime (i.e. placeholder will not be replaced with the correct value).
                    var formattedKey = key.trim();
                    vars[formattedKey] =
                        _this._visitTextWithInterpolation(wrapped, expansion.sourceSpan);
                }
                else {
                    placeholders[key] = _this._visitTextWithInterpolation(value, expansion.sourceSpan);
                }
            });
            return new t.Icu(vars, placeholders, expansion.sourceSpan, message);
        };
        HtmlAstToIvyAst.prototype.visitExpansionCase = function (expansionCase) {
            return null;
        };
        HtmlAstToIvyAst.prototype.visitComment = function (comment) {
            return null;
        };
        // convert view engine `ParsedProperty` to a format suitable for IVY
        HtmlAstToIvyAst.prototype.extractAttributes = function (elementName, properties, i18nPropsMeta) {
            var _this = this;
            var bound = [];
            var literal = [];
            properties.forEach(function (prop) {
                var i18n = i18nPropsMeta[prop.name];
                if (prop.isLiteral) {
                    literal.push(new t.TextAttribute(prop.name, prop.expression.source || '', prop.sourceSpan, undefined, i18n));
                }
                else {
                    // Note that validation is skipped and property mapping is disabled
                    // due to the fact that we need to make sure a given prop is not an
                    // input of a directive and directive matching happens at runtime.
                    var bep = _this.bindingParser.createBoundElementProperty(elementName, prop, /* skipValidation */ true, /* mapPropertyName */ false);
                    bound.push(t.BoundAttribute.fromBoundElementProperty(bep, i18n));
                }
            });
            return { bound: bound, literal: literal };
        };
        HtmlAstToIvyAst.prototype.parseAttribute = function (isTemplateElement, attribute, matchableAttributes, parsedProperties, boundEvents, variables, references) {
            var name = normalizeAttributeName(attribute.name);
            var value = attribute.value;
            var srcSpan = attribute.sourceSpan;
            var absoluteOffset = attribute.valueSpan ? attribute.valueSpan.start.offset : srcSpan.start.offset;
            var bindParts = name.match(BIND_NAME_REGEXP);
            var hasBinding = false;
            if (bindParts) {
                hasBinding = true;
                if (bindParts[KW_BIND_IDX] != null) {
                    this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                }
                else if (bindParts[KW_LET_IDX]) {
                    if (isTemplateElement) {
                        var identifier = bindParts[IDENT_KW_IDX];
                        this.parseVariable(identifier, value, srcSpan, attribute.valueSpan, variables);
                    }
                    else {
                        this.reportError("\"let-\" is only supported on ng-template elements.", srcSpan);
                    }
                }
                else if (bindParts[KW_REF_IDX]) {
                    var identifier = bindParts[IDENT_KW_IDX];
                    this.parseReference(identifier, value, srcSpan, attribute.valueSpan, references);
                }
                else if (bindParts[KW_ON_IDX]) {
                    var events = [];
                    this.bindingParser.parseEvent(bindParts[IDENT_KW_IDX], value, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events);
                    addEvents(events, boundEvents);
                }
                else if (bindParts[KW_BINDON_IDX]) {
                    this.bindingParser.parsePropertyBinding(bindParts[IDENT_KW_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                    this.parseAssignmentEvent(bindParts[IDENT_KW_IDX], value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents);
                }
                else if (bindParts[KW_AT_IDX]) {
                    this.bindingParser.parseLiteralAttr(name, value, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                }
                else if (bindParts[IDENT_BANANA_BOX_IDX]) {
                    this.bindingParser.parsePropertyBinding(bindParts[IDENT_BANANA_BOX_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                    this.parseAssignmentEvent(bindParts[IDENT_BANANA_BOX_IDX], value, srcSpan, attribute.valueSpan, matchableAttributes, boundEvents);
                }
                else if (bindParts[IDENT_PROPERTY_IDX]) {
                    this.bindingParser.parsePropertyBinding(bindParts[IDENT_PROPERTY_IDX], value, false, srcSpan, absoluteOffset, attribute.valueSpan, matchableAttributes, parsedProperties);
                }
                else if (bindParts[IDENT_EVENT_IDX]) {
                    var events = [];
                    this.bindingParser.parseEvent(bindParts[IDENT_EVENT_IDX], value, srcSpan, attribute.valueSpan || srcSpan, matchableAttributes, events);
                    addEvents(events, boundEvents);
                }
            }
            else {
                hasBinding = this.bindingParser.parsePropertyInterpolation(name, value, srcSpan, attribute.valueSpan, matchableAttributes, parsedProperties);
            }
            return hasBinding;
        };
        HtmlAstToIvyAst.prototype._visitTextWithInterpolation = function (value, sourceSpan, i18n) {
            var valueNoNgsp = html_whitespaces_1.replaceNgsp(value);
            var expr = this.bindingParser.parseInterpolation(valueNoNgsp, sourceSpan);
            return expr ? new t.BoundText(expr, sourceSpan, i18n) : new t.Text(valueNoNgsp, sourceSpan);
        };
        HtmlAstToIvyAst.prototype.parseVariable = function (identifier, value, sourceSpan, valueSpan, variables) {
            if (identifier.indexOf('-') > -1) {
                this.reportError("\"-\" is not allowed in variable names", sourceSpan);
            }
            else if (identifier.length === 0) {
                this.reportError("Variable does not have a name", sourceSpan);
            }
            variables.push(new t.Variable(identifier, value, sourceSpan, valueSpan));
        };
        HtmlAstToIvyAst.prototype.parseReference = function (identifier, value, sourceSpan, valueSpan, references) {
            if (identifier.indexOf('-') > -1) {
                this.reportError("\"-\" is not allowed in reference names", sourceSpan);
            }
            else if (identifier.length === 0) {
                this.reportError("Reference does not have a name", sourceSpan);
            }
            references.push(new t.Reference(identifier, value, sourceSpan, valueSpan));
        };
        HtmlAstToIvyAst.prototype.parseAssignmentEvent = function (name, expression, sourceSpan, valueSpan, targetMatchableAttrs, boundEvents) {
            var events = [];
            this.bindingParser.parseEvent(name + "Change", expression + "=$event", sourceSpan, valueSpan || sourceSpan, targetMatchableAttrs, events);
            addEvents(events, boundEvents);
        };
        HtmlAstToIvyAst.prototype.reportError = function (message, sourceSpan, level) {
            if (level === void 0) { level = parse_util_1.ParseErrorLevel.ERROR; }
            this.errors.push(new parse_util_1.ParseError(sourceSpan, message, level));
        };
        return HtmlAstToIvyAst;
    }());
    var NonBindableVisitor = /** @class */ (function () {
        function NonBindableVisitor() {
        }
        NonBindableVisitor.prototype.visitElement = function (ast) {
            var preparsedElement = template_preparser_1.preparseElement(ast);
            if (preparsedElement.type === template_preparser_1.PreparsedElementType.SCRIPT ||
                preparsedElement.type === template_preparser_1.PreparsedElementType.STYLE ||
                preparsedElement.type === template_preparser_1.PreparsedElementType.STYLESHEET) {
                // Skipping <script> for security reasons
                // Skipping <style> and stylesheets as we already processed them
                // in the StyleCompiler
                return null;
            }
            var children = html.visitAll(this, ast.children, null);
            return new t.Element(ast.name, html.visitAll(this, ast.attrs), 
            /* inputs */ [], /* outputs */ [], children, /* references */ [], ast.sourceSpan, ast.startSourceSpan, ast.endSourceSpan);
        };
        NonBindableVisitor.prototype.visitComment = function (comment) {
            return null;
        };
        NonBindableVisitor.prototype.visitAttribute = function (attribute) {
            return new t.TextAttribute(attribute.name, attribute.value, attribute.sourceSpan, undefined, attribute.i18n);
        };
        NonBindableVisitor.prototype.visitText = function (text) {
            return new t.Text(text.value, text.sourceSpan);
        };
        NonBindableVisitor.prototype.visitExpansion = function (expansion) {
            return null;
        };
        NonBindableVisitor.prototype.visitExpansionCase = function (expansionCase) {
            return null;
        };
        return NonBindableVisitor;
    }());
    var NON_BINDABLE_VISITOR = new NonBindableVisitor();
    function normalizeAttributeName(attrName) {
        return /^data-/i.test(attrName) ? attrName.substring(5) : attrName;
    }
    function addEvents(events, boundEvents) {
        boundEvents.push.apply(boundEvents, tslib_1.__spread(events.map(function (e) { return t.BoundEvent.fromParsedEvent(e); })));
    }
    function isEmptyTextNode(node) {
        return node instanceof html.Text && node.value.trim().length == 0;
    }
    function isCommentNode(node) {
        return node instanceof html.Comment;
    }
    function textContents(node) {
        if (node.children.length !== 1 || !(node.children[0] instanceof html.Text)) {
            return null;
        }
        else {
            return node.children[0].value;
        }
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicjNfdGVtcGxhdGVfdHJhbnNmb3JtLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGFja2FnZXMvY29tcGlsZXIvc3JjL3JlbmRlcjMvcjNfdGVtcGxhdGVfdHJhbnNmb3JtLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7Ozs7R0FNRzs7Ozs7Ozs7Ozs7Ozs7SUFJSCwwREFBeUM7SUFDekMscUZBQTBEO0lBQzFELDZEQUErQztJQUMvQywrREFBMkU7SUFDM0UsK0VBQTJEO0lBRTNELCtGQUE0RjtJQUc1Rix3REFBOEI7SUFDOUIscUVBQXFFO0lBRXJFLElBQU0sZ0JBQWdCLEdBQ2xCLDBHQUEwRyxDQUFDO0lBRS9HLG9CQUFvQjtJQUNwQixJQUFNLFdBQVcsR0FBRyxDQUFDLENBQUM7SUFDdEIsbUJBQW1CO0lBQ25CLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQztJQUNyQixxQkFBcUI7SUFDckIsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0lBQ3JCLGtCQUFrQjtJQUNsQixJQUFNLFNBQVMsR0FBRyxDQUFDLENBQUM7SUFDcEIsc0JBQXNCO0lBQ3RCLElBQU0sYUFBYSxHQUFHLENBQUMsQ0FBQztJQUN4QixnQkFBZ0I7SUFDaEIsSUFBTSxTQUFTLEdBQUcsQ0FBQyxDQUFDO0lBQ3BCLG9GQUFvRjtJQUNwRixJQUFNLFlBQVksR0FBRyxDQUFDLENBQUM7SUFDdkIsbUNBQW1DO0lBQ25DLElBQU0sb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO0lBQy9CLGlDQUFpQztJQUNqQyxJQUFNLGtCQUFrQixHQUFHLENBQUMsQ0FBQztJQUM3QixrQ0FBa0M7SUFDbEMsSUFBTSxlQUFlLEdBQUcsRUFBRSxDQUFDO0lBRTNCLElBQU0sb0JBQW9CLEdBQUcsR0FBRyxDQUFDO0lBV2pDLFNBQWdCLG1CQUFtQixDQUMvQixTQUFzQixFQUFFLGFBQTRCO1FBQ3RELElBQU0sV0FBVyxHQUFHLElBQUksZUFBZSxDQUFDLGFB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QyxVQUFVLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxFQUEvQixDQUErQixDQUFDLEdBQUU7SUFDeEUsQ0FBQztJQUVELFNBQVMsZUFBZSxDQUFDLElBQWU7UUFDdEMsT0FBTyxJQUFJLFlBQVksSUFBSSxDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7SUFDcEUsQ0FBQztJQUVELFNBQVMsYUFBYSxDQUFDLElBQWU7UUFDcEMsT0FBTyxJQUFJLFlBQVksSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUN0QyxDQUFDO0lBRUQsU0FBUyxZQUFZLENBQUMsSUFBa0I7UUFDdEMsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFlBQVksSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFO1lBQzFFLE9BQU8sSUFBSSxDQUFDO1NBQ2I7YUFBTTtZQUNMLE9BQVEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQWUsQ0FBQyxLQUFLLENBQUM7U0FDOUM7SUFDSCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBMTEMgQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5cbmltcG9ydCB7UGFyc2VkRXZlbnQsIFBhcnNlZFByb3BlcnR5LCBQYXJzZWRWYXJpYWJsZX0gZnJvbSAnLi4vZXhwcmVzc2lvbl9wYXJzZXIvYXN0JztcbmltcG9ydCAqIGFzIGkxOG4gZnJvbSAnLi4vaTE4bi9pMThuX2FzdCc7XG5pbXBvcnQgKiBhcyBodG1sIGZyb20gJy4uL21sX3BhcnNlci9hc3QnO1xuaW1wb3J0IHtyZXBsYWNlTmdzcH0gZnJvbSAnLi4vbWxfcGFyc2VyL2h0bWxfd2hpdGVzcGFjZXMnO1xuaW1wb3J0IHtpc05nVGVtcGxhdGV9IGZyb20gJy4uL21sX3BhcnNlci90YWdzJztcbmltcG9ydCB7UGFyc2VFcnJvciwgUGFyc2VFcnJvckxldmVsLCBQYXJzZVNvdXJjZVNwYW59IGZyb20gJy4uL3BhcnNlX3V0aWwnO1xuaW1wb3J0IHtpc1N0eWxlVXJsUmVzb2x2YWJsZX0gZnJvbSAnLi4vc3R5bGVfdXJsX3Jlc29sdmVyJztcbmltcG9ydCB7QmluZGluZ1BhcnNlcn0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL2JpbmRpbmdfcGFyc2VyJztcbmltcG9ydCB7UHJlcGFyc2VkRWxlbWVudFR5cGUsIHByZXBhcnNlRWxlbWVudH0gZnJvbSAnLi4vdGVtcGxhdGVfcGFyc2VyL3RlbXBsYXRlX3ByZXBhcnNlcic7XG5pbXBvcnQge3N5bnRheEVycm9yfSBmcm9tICcuLi91dGlsJztcblxuaW1wb3J0ICogYXMgdCBmcm9tICcuL3IzX2FzdCc7XG5pbXBvcnQge0kxOE5fSUNVX1ZBUl9QUkVGSVgsIGlzSTE4blJvb3ROb2RlfSBmcm9tICcuL3ZpZXcvaTE4bi91dGlsJztcblxuY29uc3QgQklORF9OQU1FX1JFR0VYUCA9XG4gICAgL14oPzooPzooPzooYmluZC0pfChsZXQtKXwocmVmLXwjKXwob24tKXwoYmluZG9uLSl8KEApKSguKikpfFxcW1xcKChbXlxcKV0rKVxcKVxcXXxcXFsoW15cXF1dKylcXF18XFwoKFteXFwpXSspXFwpKSQvO1xuXG4vLyBHcm91cCAxID0gXCJiaW5kLVwiXG5jb25zdCBLV19CSU5EX0lEWCA9IDE7XG4vLyBHcm91cCAyID0gXCJsZXQtXCJcbmNvbnN0IEtXX0xFVF9JRFggPSAyO1xuLy8gR3JvdXAgMyA9IFwicmVmLS8jXCJcbmNvbnN0IEtXX1JFRl9JRFggPSAzO1xuLy8gR3JvdXAgNCA9IFwib24tXCJcbmNvbnN0IEtXX09OX0lEWCA9IDQ7XG4vLyBHcm91cCA1ID0gXCJiaW5kb24tXCJcbmNvbnN0IEtXX0JJTkRPTl9JRFggPSA1O1xuLy8gR3JvdXAgNiA9IFwiQFwiXG5jb25zdCBLV19BVF9JRFggPSA2O1xuLy8gR3JvdXAgNyA9IHRoZSBpZGVudGlmaWVyIGFmdGVyIFwiYmluZC1cIiwgXCJsZXQtXCIsIFwicmVmLS8jXCIsIFwib24tXCIsIFwiYmluZG9uLVwiIG9yIFwiQFwiXG5jb25zdCBJREVOVF9LV19JRFggPSA3O1xuLy8gR3JvdXAgOCA9IGlkZW50aWZpZXIgaW5zaWRlIFsoKV1cbmNvbnN0IElERU5UX0JBTkFOQV9CT1hfSURYID0gODtcbi8vIEdyb3VwIDkgPSBpZGVudGlmaWVyIGluc2lkZSBbXVxuY29uc3QgSURFTlRfUFJPUEVSVFlfSURYID0gOTtcbi8vIEdyb3VwIDEwID0gaWRlbnRpZmllciBpbnNpZGUgKClcbmNvbnN0IElERU5UX0VWRU5UX0lEWCA9IDEwO1xuXG5jb25zdCBURU1QTEFURV9BVFRSX1BSRUZJWCA9ICcqJztcblxuLy8gUmVzdWx0IG9mIHRoZSBodG1sIEFTVCB0byBJdnkgQVNUIHRyYW5zZm9ybWF0aW9uXG5leHBvcnQgaW50ZXJmYWNlIFJlbmRlcjNQYXJzZVJlc3VsdCB7XG4gIG5vZGVzOiB0Lk5vZGVbXTtcbiAgZXJyb3JzOiBQYXJzZUVycm9yW107XG4gIHN0eWxlczogc3RyaW5nW107XG4gIHN0eWxlVXJsczogc3RyaW5nW107XG4gIG5nQ29udGVudFNlbGVjdG9yczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBodG1sQXN0VG9SZW5kZXIzQXN0KFxuICAgIGh0bWxOb2RlczogaHRtbC5Ob2RlW10sIGJpbmRpbmdQYXJzZXI6IEJpbmRpbmdQYXJzZXIpOiBSZW5kZXIzUGFyc2VSZXN1bHQge1xuICBjb25zdCB0cmFuc2Zvcm1lciA9IG5ldyBIdG1sQXN0VG9JdnlBc3QoYmluZGluZ1BhcnNlcik7XG4gIGNvbnN0IGl2eU5vZGVzID0gaHRtbC52aXNpdEFsbCh0cmFuc2Zvcm1lciwgaHRtbE5vZGVzKTtcblxuICAvLyBFcnJvcnMgbWlnaHQgb3JpZ2luYXRlIGluIGVpdGhlciB0aGUgYmluZGluZyBwYXJzZXIgb3IgdGhlIGh0bWwgdG8gaXZ5IHRyYW5zZm9ybWVyXG4gIGNvbnN0IGFsbEVycm9ycyA9IGJpbmRpbmdQYXJzZXIuZXJyb3JzLmNvbmNhdCh0cmFuc2Zvcm1lci5lcnJvcnMpO1xuXG4gIHJldHVybiB7XG4gICAgbm9kZXM6IGl2eU5vZGVzLFxuICAgIGVycm9yczogYWxsRXJyb3JzLFxuICAgIHN0eWxlVXJsczogdHJhbnNmb3JtZXIuc3R5bGVVcmxzLFxuICAgIHN0eWxlczogdHJhbnNmb3JtZXIuc3R5bGVzLFxuICAgIG5nQ29udGVudFNlbGVjdG9yczogdHJhbnNmb3JtZXIubmdDb250ZW50U2VsZWN0b3JzLFxuICB9O1xufVxuXG5jbGFzcyBIdG1sQXN0VG9JdnlBc3QgaW1wbGVtZW50cyBodG1sLlZpc2l0b3Ige1xuICBlcnJvcnM6IFBhcnNlRXJyb3JbXSA9IFtdO1xuICBzdHlsZXM6IHN0cmluZ1tdID0gW107XG4gIHN0eWxlVXJsczogc3RyaW5nW10gPSBbXTtcbiAgbmdDb250ZW50U2VsZWN0b3JzOiBzdHJpbmdbXSA9IFtdO1xuICBwcml2YXRlIGluSTE4bkJsb2NrOiBib29sZWFuID0gZmFsc2U7XG5cbiAgY29uc3RydWN0b3IocHJpdmF0ZSBiaW5kaW5nUGFyc2VyOiBCaW5kaW5nUGFyc2VyKSB7fVxuXG4gIC8vIEhUTUwgdmlzaXRvclxuICB2aXNpdEVsZW1lbnQoZWxlbWVudDogaHRtbC5FbGVtZW50KTogdC5Ob2RlfG51bGwge1xuICAgIGNvbnN0IGlzSTE4blJvb3RFbGVtZW50ID0gaXNJMThuUm9vdE5vZGUoZWxlbWVudC5pMThuKTtcbiAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgIGlmICh0aGlzLmluSTE4bkJsb2NrKSB7XG4gICAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAnQ2Fubm90IG1hcmsgYW4gZWxlbWVudCBhcyB0cmFuc2xhdGFibGUgaW5zaWRlIG9mIGEgdHJhbnNsYXRhYmxlIHNlY3Rpb24uIFBsZWFzZSByZW1vdmUgdGhlIG5lc3RlZCBpMThuIG1hcmtlci4nLFxuICAgICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuaW5JMThuQmxvY2sgPSB0cnVlO1xuICAgIH1cbiAgICBjb25zdCBwcmVwYXJzZWRFbGVtZW50ID0gcHJlcGFyc2VFbGVtZW50KGVsZW1lbnQpO1xuICAgIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNDUklQVCkge1xuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfSBlbHNlIGlmIChwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFKSB7XG4gICAgICBjb25zdCBjb250ZW50cyA9IHRleHRDb250ZW50cyhlbGVtZW50KTtcbiAgICAgIGlmIChjb250ZW50cyAhPT0gbnVsbCkge1xuICAgICAgICB0aGlzLnN0eWxlcy5wdXNoKGNvbnRlbnRzKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH0gZWxzZSBpZiAoXG4gICAgICAgIHByZXBhcnNlZEVsZW1lbnQudHlwZSA9PT0gUHJlcGFyc2VkRWxlbWVudFR5cGUuU1RZTEVTSEVFVCAmJlxuICAgICAgICBpc1N0eWxlVXJsUmVzb2x2YWJsZShwcmVwYXJzZWRFbGVtZW50LmhyZWZBdHRyKSkge1xuICAgICAgdGhpcy5zdHlsZVVybHMucHVzaChwcmVwYXJzZWRFbGVtZW50LmhyZWZBdHRyKTtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIC8vIFdoZXRoZXIgdGhlIGVsZW1lbnQgaXMgYSBgPG5nLXRlbXBsYXRlPmBcbiAgICBjb25zdCBpc1RlbXBsYXRlRWxlbWVudCA9IGlzTmdUZW1wbGF0ZShlbGVtZW50Lm5hbWUpO1xuXG4gICAgY29uc3QgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSA9IFtdO1xuICAgIGNvbnN0IGJvdW5kRXZlbnRzOiB0LkJvdW5kRXZlbnRbXSA9IFtdO1xuICAgIGNvbnN0IHZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW107XG4gICAgY29uc3QgcmVmZXJlbmNlczogdC5SZWZlcmVuY2VbXSA9IFtdO1xuICAgIGNvbnN0IGF0dHJpYnV0ZXM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG4gICAgY29uc3QgaTE4bkF0dHJzTWV0YToge1trZXk6IHN0cmluZ106IGkxOG4uSTE4bk1ldGF9ID0ge307XG5cbiAgICBjb25zdCB0ZW1wbGF0ZVBhcnNlZFByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10gPSBbXTtcbiAgICBjb25zdCB0ZW1wbGF0ZVZhcmlhYmxlczogdC5WYXJpYWJsZVtdID0gW107XG5cbiAgICAvLyBXaGV0aGVyIHRoZSBlbGVtZW50IGhhcyBhbnkgKi1hdHRyaWJ1dGVcbiAgICBsZXQgZWxlbWVudEhhc0lubGluZVRlbXBsYXRlID0gZmFsc2U7XG5cbiAgICBmb3IgKGNvbnN0IGF0dHJpYnV0ZSBvZiBlbGVtZW50LmF0dHJzKSB7XG4gICAgICBsZXQgaGFzQmluZGluZyA9IGZhbHNlO1xuICAgICAgY29uc3Qgbm9ybWFsaXplZE5hbWUgPSBub3JtYWxpemVBdHRyaWJ1dGVOYW1lKGF0dHJpYnV0ZS5uYW1lKTtcblxuICAgICAgLy8gYCphdHRyYCBkZWZpbmVzIHRlbXBsYXRlIGJpbmRpbmdzXG4gICAgICBsZXQgaXNUZW1wbGF0ZUJpbmRpbmcgPSBmYWxzZTtcblxuICAgICAgaWYgKGF0dHJpYnV0ZS5pMThuKSB7XG4gICAgICAgIGkxOG5BdHRyc01ldGFbYXR0cmlidXRlLm5hbWVdID0gYXR0cmlidXRlLmkxOG47XG4gICAgICB9XG5cbiAgICAgIGlmIChub3JtYWxpemVkTmFtZS5zdGFydHNXaXRoKFRFTVBMQVRFX0FUVFJfUFJFRklYKSkge1xuICAgICAgICAvLyAqLWF0dHJpYnV0ZXNcbiAgICAgICAgaWYgKGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSkge1xuICAgICAgICAgIHRoaXMucmVwb3J0RXJyb3IoXG4gICAgICAgICAgICAgIGBDYW4ndCBoYXZlIG11bHRpcGxlIHRlbXBsYXRlIGJpbmRpbmdzIG9uIG9uZSBlbGVtZW50LiBVc2Ugb25seSBvbmUgYXR0cmlidXRlIHByZWZpeGVkIHdpdGggKmAsXG4gICAgICAgICAgICAgIGF0dHJpYnV0ZS5zb3VyY2VTcGFuKTtcbiAgICAgICAgfVxuICAgICAgICBpc1RlbXBsYXRlQmluZGluZyA9IHRydWU7XG4gICAgICAgIGVsZW1lbnRIYXNJbmxpbmVUZW1wbGF0ZSA9IHRydWU7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlVmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgICAgIGNvbnN0IHRlbXBsYXRlS2V5ID0gbm9ybWFsaXplZE5hbWUuc3Vic3RyaW5nKFRFTVBMQVRFX0FUVFJfUFJFRklYLmxlbmd0aCk7XG5cbiAgICAgICAgY29uc3QgcGFyc2VkVmFyaWFibGVzOiBQYXJzZWRWYXJpYWJsZVtdID0gW107XG4gICAgICAgIGNvbnN0IGFic29sdXRlVmFsdWVPZmZzZXQgPSBhdHRyaWJ1dGUudmFsdWVTcGFuID9cbiAgICAgICAgICAgIGF0dHJpYnV0ZS52YWx1ZVNwYW4uc3RhcnQub2Zmc2V0IDpcbiAgICAgICAgICAgIC8vIElmIHRoZXJlIGlzIG5vIHZhbHVlIHNwYW4gdGhlIGF0dHJpYnV0ZSBkb2VzIG5vdCBoYXZlIGEgdmFsdWUsIGxpa2UgYGF0dHJgIGluXG4gICAgICAgICAgICAvL2A8ZGl2IGF0dHI+PC9kaXY+YC4gSW4gdGhpcyBjYXNlLCBwb2ludCB0byBvbmUgY2hhcmFjdGVyIGJleW9uZCB0aGUgbGFzdCBjaGFyYWN0ZXIgb2ZcbiAgICAgICAgICAgIC8vIHRoZSBhdHRyaWJ1dGUgbmFtZS5cbiAgICAgICAgICAgIGF0dHJpYnV0ZS5zb3VyY2VTcGFuLnN0YXJ0Lm9mZnNldCArIGF0dHJpYnV0ZS5uYW1lLmxlbmd0aDtcblxuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VJbmxpbmVUZW1wbGF0ZUJpbmRpbmcoXG4gICAgICAgICAgICB0ZW1wbGF0ZUtleSwgdGVtcGxhdGVWYWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIGFic29sdXRlVmFsdWVPZmZzZXQsIFtdLFxuICAgICAgICAgICAgdGVtcGxhdGVQYXJzZWRQcm9wZXJ0aWVzLCBwYXJzZWRWYXJpYWJsZXMpO1xuICAgICAgICB0ZW1wbGF0ZVZhcmlhYmxlcy5wdXNoKC4uLnBhcnNlZFZhcmlhYmxlcy5tYXAoXG4gICAgICAgICAgICB2ID0+IG5ldyB0LlZhcmlhYmxlKHYubmFtZSwgdi52YWx1ZSwgdi5zb3VyY2VTcGFuLCB2LnZhbHVlU3BhbikpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIENoZWNrIGZvciB2YXJpYWJsZXMsIGV2ZW50cywgcHJvcGVydHkgYmluZGluZ3MsIGludGVycG9sYXRpb25cbiAgICAgICAgaGFzQmluZGluZyA9IHRoaXMucGFyc2VBdHRyaWJ1dGUoXG4gICAgICAgICAgICBpc1RlbXBsYXRlRWxlbWVudCwgYXR0cmlidXRlLCBbXSwgcGFyc2VkUHJvcGVydGllcywgYm91bmRFdmVudHMsIHZhcmlhYmxlcywgcmVmZXJlbmNlcyk7XG4gICAgICB9XG5cbiAgICAgIGlmICghaGFzQmluZGluZyAmJiAhaXNUZW1wbGF0ZUJpbmRpbmcpIHtcbiAgICAgICAgLy8gZG9uJ3QgaW5jbHVkZSB0aGUgYmluZGluZ3MgYXMgYXR0cmlidXRlcyBhcyB3ZWxsIGluIHRoZSBBU1RcbiAgICAgICAgYXR0cmlidXRlcy5wdXNoKHRoaXMudmlzaXRBdHRyaWJ1dGUoYXR0cmlidXRlKSBhcyB0LlRleHRBdHRyaWJ1dGUpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IGNoaWxkcmVuOiB0Lk5vZGVbXSA9XG4gICAgICAgIGh0bWwudmlzaXRBbGwocHJlcGFyc2VkRWxlbWVudC5ub25CaW5kYWJsZSA/IE5PTl9CSU5EQUJMRV9WSVNJVE9SIDogdGhpcywgZWxlbWVudC5jaGlsZHJlbik7XG5cbiAgICBsZXQgcGFyc2VkRWxlbWVudDogdC5Ob2RlfHVuZGVmaW5lZDtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5OR19DT05URU5UKSB7XG4gICAgICAvLyBgPG5nLWNvbnRlbnQ+YFxuICAgICAgaWYgKGVsZW1lbnQuY2hpbGRyZW4gJiZcbiAgICAgICAgICAhZWxlbWVudC5jaGlsZHJlbi5ldmVyeShcbiAgICAgICAgICAgICAgKG5vZGU6IGh0bWwuTm9kZSkgPT4gaXNFbXB0eVRleHROb2RlKG5vZGUpIHx8IGlzQ29tbWVudE5vZGUobm9kZSkpKSB7XG4gICAgICAgIHRoaXMucmVwb3J0RXJyb3IoYDxuZy1jb250ZW50PiBlbGVtZW50IGNhbm5vdCBoYXZlIGNvbnRlbnQuYCwgZWxlbWVudC5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHNlbGVjdG9yID0gcHJlcGFyc2VkRWxlbWVudC5zZWxlY3RBdHRyO1xuICAgICAgY29uc3QgYXR0cnM6IHQuVGV4dEF0dHJpYnV0ZVtdID0gZWxlbWVudC5hdHRycy5tYXAoYXR0ciA9PiB0aGlzLnZpc2l0QXR0cmlidXRlKGF0dHIpKTtcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5Db250ZW50KHNlbGVjdG9yLCBhdHRycywgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuXG4gICAgICB0aGlzLm5nQ29udGVudFNlbGVjdG9ycy5wdXNoKHNlbGVjdG9yKTtcbiAgICB9IGVsc2UgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAvLyBgPG5nLXRlbXBsYXRlPmBcbiAgICAgIGNvbnN0IGF0dHJzID0gdGhpcy5leHRyYWN0QXR0cmlidXRlcyhlbGVtZW50Lm5hbWUsIHBhcnNlZFByb3BlcnRpZXMsIGkxOG5BdHRyc01ldGEpO1xuXG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuVGVtcGxhdGUoXG4gICAgICAgICAgZWxlbWVudC5uYW1lLCBhdHRyaWJ1dGVzLCBhdHRycy5ib3VuZCwgYm91bmRFdmVudHMsIFsvKiBubyB0ZW1wbGF0ZSBhdHRyaWJ1dGVzICovXSxcbiAgICAgICAgICBjaGlsZHJlbiwgcmVmZXJlbmNlcywgdmFyaWFibGVzLCBlbGVtZW50LnNvdXJjZVNwYW4sIGVsZW1lbnQuc3RhcnRTb3VyY2VTcGFuLFxuICAgICAgICAgIGVsZW1lbnQuZW5kU291cmNlU3BhbiwgZWxlbWVudC5pMThuKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgYXR0cnMgPSB0aGlzLmV4dHJhY3RBdHRyaWJ1dGVzKGVsZW1lbnQubmFtZSwgcGFyc2VkUHJvcGVydGllcywgaTE4bkF0dHJzTWV0YSk7XG4gICAgICBwYXJzZWRFbGVtZW50ID0gbmV3IHQuRWxlbWVudChcbiAgICAgICAgICBlbGVtZW50Lm5hbWUsIGF0dHJpYnV0ZXMsIGF0dHJzLmJvdW5kLCBib3VuZEV2ZW50cywgY2hpbGRyZW4sIHJlZmVyZW5jZXMsXG4gICAgICAgICAgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbiwgZWxlbWVudC5lbmRTb3VyY2VTcGFuLCBlbGVtZW50LmkxOG4pO1xuICAgIH1cblxuICAgIGlmIChlbGVtZW50SGFzSW5saW5lVGVtcGxhdGUpIHtcbiAgICAgIC8vIElmIHRoaXMgbm9kZSBpcyBhbiBpbmxpbmUtdGVtcGxhdGUgKGUuZy4gaGFzICpuZ0ZvcikgdGhlbiB3ZSBuZWVkIHRvIGNyZWF0ZSBhIHRlbXBsYXRlXG4gICAgICAvLyBub2RlIHRoYXQgY29udGFpbnMgdGhpcyBub2RlLlxuICAgICAgLy8gTW9yZW92ZXIsIGlmIHRoZSBub2RlIGlzIGFuIGVsZW1lbnQsIHRoZW4gd2UgbmVlZCB0byBob2lzdCBpdHMgYXR0cmlidXRlcyB0byB0aGUgdGVtcGxhdGVcbiAgICAgIC8vIG5vZGUgZm9yIG1hdGNoaW5nIGFnYWluc3QgY29udGVudCBwcm9qZWN0aW9uIHNlbGVjdG9ycy5cbiAgICAgIGNvbnN0IGF0dHJzID0gdGhpcy5leHRyYWN0QXR0cmlidXRlcygnbmctdGVtcGxhdGUnLCB0ZW1wbGF0ZVBhcnNlZFByb3BlcnRpZXMsIGkxOG5BdHRyc01ldGEpO1xuICAgICAgY29uc3QgdGVtcGxhdGVBdHRyczogKHQuVGV4dEF0dHJpYnV0ZXx0LkJvdW5kQXR0cmlidXRlKVtdID0gW107XG4gICAgICBhdHRycy5saXRlcmFsLmZvckVhY2goYXR0ciA9PiB0ZW1wbGF0ZUF0dHJzLnB1c2goYXR0cikpO1xuICAgICAgYXR0cnMuYm91bmQuZm9yRWFjaChhdHRyID0+IHRlbXBsYXRlQXR0cnMucHVzaChhdHRyKSk7XG4gICAgICBjb25zdCBob2lzdGVkQXR0cnMgPSBwYXJzZWRFbGVtZW50IGluc3RhbmNlb2YgdC5FbGVtZW50ID9cbiAgICAgICAgICB7XG4gICAgICAgICAgICBhdHRyaWJ1dGVzOiBwYXJzZWRFbGVtZW50LmF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBpbnB1dHM6IHBhcnNlZEVsZW1lbnQuaW5wdXRzLFxuICAgICAgICAgICAgb3V0cHV0czogcGFyc2VkRWxlbWVudC5vdXRwdXRzLFxuICAgICAgICAgIH0gOlxuICAgICAgICAgIHthdHRyaWJ1dGVzOiBbXSwgaW5wdXRzOiBbXSwgb3V0cHV0czogW119O1xuXG4gICAgICAvLyBGb3IgPG5nLXRlbXBsYXRlPnMgd2l0aCBzdHJ1Y3R1cmFsIGRpcmVjdGl2ZXMgb24gdGhlbSwgYXZvaWQgcGFzc2luZyBpMThuIGluZm9ybWF0aW9uIHRvXG4gICAgICAvLyB0aGUgd3JhcHBpbmcgdGVtcGxhdGUgdG8gcHJldmVudCB1bm5lY2Vzc2FyeSBpMThuIGluc3RydWN0aW9ucyBmcm9tIGJlaW5nIGdlbmVyYXRlZC4gVGhlXG4gICAgICAvLyBuZWNlc3NhcnkgaTE4biBtZXRhIGluZm9ybWF0aW9uIHdpbGwgYmUgZXh0cmFjdGVkIGZyb20gY2hpbGQgZWxlbWVudHMuXG4gICAgICBjb25zdCBpMThuID0gaXNUZW1wbGF0ZUVsZW1lbnQgJiYgaXNJMThuUm9vdEVsZW1lbnQgPyB1bmRlZmluZWQgOiBlbGVtZW50LmkxOG47XG5cbiAgICAgIC8vIFRPRE8ocGspOiB0ZXN0IGZvciB0aGlzIGNhc2VcbiAgICAgIHBhcnNlZEVsZW1lbnQgPSBuZXcgdC5UZW1wbGF0ZShcbiAgICAgICAgICAocGFyc2VkRWxlbWVudCBhcyB0LkVsZW1lbnQgfCB0LkNvbnRlbnQpLm5hbWUsIGhvaXN0ZWRBdHRycy5hdHRyaWJ1dGVzLFxuICAgICAgICAgIGhvaXN0ZWRBdHRycy5pbnB1dHMsIGhvaXN0ZWRBdHRycy5vdXRwdXRzLCB0ZW1wbGF0ZUF0dHJzLCBbcGFyc2VkRWxlbWVudF0sXG4gICAgICAgICAgWy8qIG5vIHJlZmVyZW5jZXMgKi9dLCB0ZW1wbGF0ZVZhcmlhYmxlcywgZWxlbWVudC5zb3VyY2VTcGFuLCBlbGVtZW50LnN0YXJ0U291cmNlU3BhbixcbiAgICAgICAgICBlbGVtZW50LmVuZFNvdXJjZVNwYW4sIGkxOG4pO1xuICAgIH1cbiAgICBpZiAoaXNJMThuUm9vdEVsZW1lbnQpIHtcbiAgICAgIHRoaXMuaW5JMThuQmxvY2sgPSBmYWxzZTtcbiAgICB9XG4gICAgcmV0dXJuIHBhcnNlZEVsZW1lbnQ7XG4gIH1cblxuICB2aXNpdEF0dHJpYnV0ZShhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlKTogdC5UZXh0QXR0cmlidXRlIHtcbiAgICByZXR1cm4gbmV3IHQuVGV4dEF0dHJpYnV0ZShcbiAgICAgICAgYXR0cmlidXRlLm5hbWUsIGF0dHJpYnV0ZS52YWx1ZSwgYXR0cmlidXRlLnNvdXJjZVNwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIGF0dHJpYnV0ZS5pMThuKTtcbiAgfVxuXG4gIHZpc2l0VGV4dCh0ZXh0OiBodG1sLlRleHQpOiB0Lk5vZGUge1xuICAgIHJldHVybiB0aGlzLl92aXNpdFRleHRXaXRoSW50ZXJwb2xhdGlvbih0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4sIHRleHQuaTE4bik7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbihleHBhbnNpb246IGh0bWwuRXhwYW5zaW9uKTogdC5JY3V8bnVsbCB7XG4gICAgaWYgKCFleHBhbnNpb24uaTE4bikge1xuICAgICAgLy8gZG8gbm90IGdlbmVyYXRlIEljdSBpbiBjYXNlIGl0IHdhcyBjcmVhdGVkXG4gICAgICAvLyBvdXRzaWRlIG9mIGkxOG4gYmxvY2sgaW4gYSB0ZW1wbGF0ZVxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuICAgIGlmICghaXNJMThuUm9vdE5vZGUoZXhwYW5zaW9uLmkxOG4pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgdHlwZSBcIiR7ZXhwYW5zaW9uLmkxOG4uY29uc3RydWN0b3J9XCIgZm9yIFwiaTE4blwiIHByb3BlcnR5IG9mICR7XG4gICAgICAgICAgZXhwYW5zaW9uLnNvdXJjZVNwYW4udG9TdHJpbmcoKX0uIEV4cGVjdGVkIGEgXCJNZXNzYWdlXCJgKTtcbiAgICB9XG4gICAgY29uc3QgbWVzc2FnZSA9IGV4cGFuc2lvbi5pMThuO1xuICAgIGNvbnN0IHZhcnM6IHtbbmFtZTogc3RyaW5nXTogdC5Cb3VuZFRleHR9ID0ge307XG4gICAgY29uc3QgcGxhY2Vob2xkZXJzOiB7W25hbWU6IHN0cmluZ106IHQuVGV4dHx0LkJvdW5kVGV4dH0gPSB7fTtcbiAgICAvLyBleHRyYWN0IFZBUnMgZnJvbSBJQ1VzIC0gd2UgcHJvY2VzcyB0aGVtIHNlcGFyYXRlbHkgd2hpbGVcbiAgICAvLyBhc3NlbWJsaW5nIHJlc3VsdGluZyBtZXNzYWdlIHZpYSBnb29nLmdldE1zZyBmdW5jdGlvbiwgc2luY2VcbiAgICAvLyB3ZSBuZWVkIHRvIHBhc3MgdGhlbSB0byB0b3AtbGV2ZWwgZ29vZy5nZXRNc2cgY2FsbFxuICAgIE9iamVjdC5rZXlzKG1lc3NhZ2UucGxhY2Vob2xkZXJzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCB2YWx1ZSA9IG1lc3NhZ2UucGxhY2Vob2xkZXJzW2tleV07XG4gICAgICBpZiAoa2V5LnN0YXJ0c1dpdGgoSTE4Tl9JQ1VfVkFSX1BSRUZJWCkpIHtcbiAgICAgICAgY29uc3QgY29uZmlnID0gdGhpcy5iaW5kaW5nUGFyc2VyLmludGVycG9sYXRpb25Db25maWc7XG5cbiAgICAgICAgLy8gSUNVIGV4cHJlc3Npb24gaXMgYSBwbGFpbiBzdHJpbmcsIG5vdCB3cmFwcGVkIGludG8gc3RhcnRcbiAgICAgICAgLy8gYW5kIGVuZCB0YWdzLCBzbyB3ZSB3cmFwIGl0IGJlZm9yZSBwYXNzaW5nIHRvIGJpbmRpbmcgcGFyc2VyXG4gICAgICAgIGNvbnN0IHdyYXBwZWQgPSBgJHtjb25maWcuc3RhcnR9JHt2YWx1ZX0ke2NvbmZpZy5lbmR9YDtcblxuICAgICAgICAvLyBDdXJyZW50bHkgd2hlbiB0aGUgYHBsdXJhbGAgb3IgYHNlbGVjdGAga2V5d29yZHMgaW4gYW4gSUNVIGNvbnRhaW4gdHJhaWxpbmcgc3BhY2VzIChlLmcuXG4gICAgICAgIC8vIGB7Y291bnQsIHNlbGVjdCAsIC4uLn1gKSwgdGhlc2Ugc3BhY2VzIGFyZSBhbHNvIGluY2x1ZGVkIGludG8gdGhlIGtleSBuYW1lcyBpbiBJQ1UgdmFyc1xuICAgICAgICAvLyAoZS5nLiBcIlZBUl9TRUxFQ1QgXCIpLiBUaGVzZSB0cmFpbGluZyBzcGFjZXMgYXJlIG5vdCBkZXNpcmFibGUsIHNpbmNlIHRoZXkgd2lsbCBsYXRlciBiZVxuICAgICAgICAvLyBjb252ZXJ0ZWQgaW50byBgX2Agc3ltYm9scyB3aGlsZSBub3JtYWxpemluZyBwbGFjZWhvbGRlciBuYW1lcywgd2hpY2ggbWlnaHQgbGVhZCB0b1xuICAgICAgICAvLyBtaXNtYXRjaGVzIGF0IHJ1bnRpbWUgKGkuZS4gcGxhY2Vob2xkZXIgd2lsbCBub3QgYmUgcmVwbGFjZWQgd2l0aCB0aGUgY29ycmVjdCB2YWx1ZSkuXG4gICAgICAgIGNvbnN0IGZvcm1hdHRlZEtleSA9IGtleS50cmltKCk7XG5cbiAgICAgICAgdmFyc1tmb3JtYXR0ZWRLZXldID1cbiAgICAgICAgICAgIHRoaXMuX3Zpc2l0VGV4dFdpdGhJbnRlcnBvbGF0aW9uKHdyYXBwZWQsIGV4cGFuc2lvbi5zb3VyY2VTcGFuKSBhcyB0LkJvdW5kVGV4dDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHBsYWNlaG9sZGVyc1trZXldID0gdGhpcy5fdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24odmFsdWUsIGV4cGFuc2lvbi5zb3VyY2VTcGFuKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgICByZXR1cm4gbmV3IHQuSWN1KHZhcnMsIHBsYWNlaG9sZGVycywgZXhwYW5zaW9uLnNvdXJjZVNwYW4sIG1lc3NhZ2UpO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb25DYXNlKGV4cGFuc2lvbkNhc2U6IGh0bWwuRXhwYW5zaW9uQ2FzZSk6IG51bGwge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdmlzaXRDb21tZW50KGNvbW1lbnQ6IGh0bWwuQ29tbWVudCk6IG51bGwge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gY29udmVydCB2aWV3IGVuZ2luZSBgUGFyc2VkUHJvcGVydHlgIHRvIGEgZm9ybWF0IHN1aXRhYmxlIGZvciBJVllcbiAgcHJpdmF0ZSBleHRyYWN0QXR0cmlidXRlcyhcbiAgICAgIGVsZW1lbnROYW1lOiBzdHJpbmcsIHByb3BlcnRpZXM6IFBhcnNlZFByb3BlcnR5W10sXG4gICAgICBpMThuUHJvcHNNZXRhOiB7W2tleTogc3RyaW5nXTogaTE4bi5JMThuTWV0YX0pOlxuICAgICAge2JvdW5kOiB0LkJvdW5kQXR0cmlidXRlW10sIGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdfSB7XG4gICAgY29uc3QgYm91bmQ6IHQuQm91bmRBdHRyaWJ1dGVbXSA9IFtdO1xuICAgIGNvbnN0IGxpdGVyYWw6IHQuVGV4dEF0dHJpYnV0ZVtdID0gW107XG5cbiAgICBwcm9wZXJ0aWVzLmZvckVhY2gocHJvcCA9PiB7XG4gICAgICBjb25zdCBpMThuID0gaTE4blByb3BzTWV0YVtwcm9wLm5hbWVdO1xuICAgICAgaWYgKHByb3AuaXNMaXRlcmFsKSB7XG4gICAgICAgIGxpdGVyYWwucHVzaChuZXcgdC5UZXh0QXR0cmlidXRlKFxuICAgICAgICAgICAgcHJvcC5uYW1lLCBwcm9wLmV4cHJlc3Npb24uc291cmNlIHx8ICcnLCBwcm9wLnNvdXJjZVNwYW4sIHVuZGVmaW5lZCwgaTE4bikpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gTm90ZSB0aGF0IHZhbGlkYXRpb24gaXMgc2tpcHBlZCBhbmQgcHJvcGVydHkgbWFwcGluZyBpcyBkaXNhYmxlZFxuICAgICAgICAvLyBkdWUgdG8gdGhlIGZhY3QgdGhhdCB3ZSBuZWVkIHRvIG1ha2Ugc3VyZSBhIGdpdmVuIHByb3AgaXMgbm90IGFuXG4gICAgICAgIC8vIGlucHV0IG9mIGEgZGlyZWN0aXZlIGFuZCBkaXJlY3RpdmUgbWF0Y2hpbmcgaGFwcGVucyBhdCBydW50aW1lLlxuICAgICAgICBjb25zdCBiZXAgPSB0aGlzLmJpbmRpbmdQYXJzZXIuY3JlYXRlQm91bmRFbGVtZW50UHJvcGVydHkoXG4gICAgICAgICAgICBlbGVtZW50TmFtZSwgcHJvcCwgLyogc2tpcFZhbGlkYXRpb24gKi8gdHJ1ZSwgLyogbWFwUHJvcGVydHlOYW1lICovIGZhbHNlKTtcbiAgICAgICAgYm91bmQucHVzaCh0LkJvdW5kQXR0cmlidXRlLmZyb21Cb3VuZEVsZW1lbnRQcm9wZXJ0eShiZXAsIGkxOG4pKTtcbiAgICAgIH1cbiAgICB9KTtcblxuICAgIHJldHVybiB7Ym91bmQsIGxpdGVyYWx9O1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUF0dHJpYnV0ZShcbiAgICAgIGlzVGVtcGxhdGVFbGVtZW50OiBib29sZWFuLCBhdHRyaWJ1dGU6IGh0bWwuQXR0cmlidXRlLCBtYXRjaGFibGVBdHRyaWJ1dGVzOiBzdHJpbmdbXVtdLFxuICAgICAgcGFyc2VkUHJvcGVydGllczogUGFyc2VkUHJvcGVydHlbXSwgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSxcbiAgICAgIHJlZmVyZW5jZXM6IHQuUmVmZXJlbmNlW10pIHtcbiAgICBjb25zdCBuYW1lID0gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyaWJ1dGUubmFtZSk7XG4gICAgY29uc3QgdmFsdWUgPSBhdHRyaWJ1dGUudmFsdWU7XG4gICAgY29uc3Qgc3JjU3BhbiA9IGF0dHJpYnV0ZS5zb3VyY2VTcGFuO1xuICAgIGNvbnN0IGFic29sdXRlT2Zmc2V0ID1cbiAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiA/IGF0dHJpYnV0ZS52YWx1ZVNwYW4uc3RhcnQub2Zmc2V0IDogc3JjU3Bhbi5zdGFydC5vZmZzZXQ7XG5cbiAgICBjb25zdCBiaW5kUGFydHMgPSBuYW1lLm1hdGNoKEJJTkRfTkFNRV9SRUdFWFApO1xuICAgIGxldCBoYXNCaW5kaW5nID0gZmFsc2U7XG5cbiAgICBpZiAoYmluZFBhcnRzKSB7XG4gICAgICBoYXNCaW5kaW5nID0gdHJ1ZTtcbiAgICAgIGlmIChiaW5kUGFydHNbS1dfQklORF9JRFhdICE9IG51bGwpIHtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfTEVUX0lEWF0pIHtcbiAgICAgICAgaWYgKGlzVGVtcGxhdGVFbGVtZW50KSB7XG4gICAgICAgICAgY29uc3QgaWRlbnRpZmllciA9IGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdO1xuICAgICAgICAgIHRoaXMucGFyc2VWYXJpYWJsZShpZGVudGlmaWVyLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiwgdmFyaWFibGVzKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aGlzLnJlcG9ydEVycm9yKGBcImxldC1cIiBpcyBvbmx5IHN1cHBvcnRlZCBvbiBuZy10ZW1wbGF0ZSBlbGVtZW50cy5gLCBzcmNTcGFuKTtcbiAgICAgICAgfVxuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19SRUZfSURYXSkge1xuICAgICAgICBjb25zdCBpZGVudGlmaWVyID0gYmluZFBhcnRzW0lERU5UX0tXX0lEWF07XG4gICAgICAgIHRoaXMucGFyc2VSZWZlcmVuY2UoaWRlbnRpZmllciwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIHJlZmVyZW5jZXMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tLV19PTl9JRFhdKSB7XG4gICAgICAgIGNvbnN0IGV2ZW50czogUGFyc2VkRXZlbnRbXSA9IFtdO1xuICAgICAgICB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiB8fCBzcmNTcGFuLFxuICAgICAgICAgICAgbWF0Y2hhYmxlQXR0cmlidXRlcywgZXZlbnRzKTtcbiAgICAgICAgYWRkRXZlbnRzKGV2ZW50cywgYm91bmRFdmVudHMpO1xuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbS1dfQklORE9OX0lEWF0pIHtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlUHJvcGVydHlCaW5kaW5nKFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0tXX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9LV19JRFhdLCB2YWx1ZSwgc3JjU3BhbiwgYXR0cmlidXRlLnZhbHVlU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcyxcbiAgICAgICAgICAgIGJvdW5kRXZlbnRzKTtcbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0tXX0FUX0lEWF0pIHtcbiAgICAgICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlTGl0ZXJhbEF0dHIoXG4gICAgICAgICAgICBuYW1lLCB2YWx1ZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsXG4gICAgICAgICAgICBwYXJzZWRQcm9wZXJ0aWVzKTtcblxuICAgICAgfSBlbHNlIGlmIChiaW5kUGFydHNbSURFTlRfQkFOQU5BX0JPWF9JRFhdKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0sIHZhbHVlLCBmYWxzZSwgc3JjU3BhbiwgYWJzb2x1dGVPZmZzZXQsXG4gICAgICAgICAgICBhdHRyaWJ1dGUudmFsdWVTcGFuLCBtYXRjaGFibGVBdHRyaWJ1dGVzLCBwYXJzZWRQcm9wZXJ0aWVzKTtcbiAgICAgICAgdGhpcy5wYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9CQU5BTkFfQk9YX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuLFxuICAgICAgICAgICAgbWF0Y2hhYmxlQXR0cmlidXRlcywgYm91bmRFdmVudHMpO1xuXG4gICAgICB9IGVsc2UgaWYgKGJpbmRQYXJ0c1tJREVOVF9QUk9QRVJUWV9JRFhdKSB7XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZVByb3BlcnR5QmluZGluZyhcbiAgICAgICAgICAgIGJpbmRQYXJ0c1tJREVOVF9QUk9QRVJUWV9JRFhdLCB2YWx1ZSwgZmFsc2UsIHNyY1NwYW4sIGFic29sdXRlT2Zmc2V0LFxuICAgICAgICAgICAgYXR0cmlidXRlLnZhbHVlU3BhbiwgbWF0Y2hhYmxlQXR0cmlidXRlcywgcGFyc2VkUHJvcGVydGllcyk7XG5cbiAgICAgIH0gZWxzZSBpZiAoYmluZFBhcnRzW0lERU5UX0VWRU5UX0lEWF0pIHtcbiAgICAgICAgY29uc3QgZXZlbnRzOiBQYXJzZWRFdmVudFtdID0gW107XG4gICAgICAgIHRoaXMuYmluZGluZ1BhcnNlci5wYXJzZUV2ZW50KFxuICAgICAgICAgICAgYmluZFBhcnRzW0lERU5UX0VWRU5UX0lEWF0sIHZhbHVlLCBzcmNTcGFuLCBhdHRyaWJ1dGUudmFsdWVTcGFuIHx8IHNyY1NwYW4sXG4gICAgICAgICAgICBtYXRjaGFibGVBdHRyaWJ1dGVzLCBldmVudHMpO1xuICAgICAgICBhZGRFdmVudHMoZXZlbnRzLCBib3VuZEV2ZW50cyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhhc0JpbmRpbmcgPSB0aGlzLmJpbmRpbmdQYXJzZXIucGFyc2VQcm9wZXJ0eUludGVycG9sYXRpb24oXG4gICAgICAgICAgbmFtZSwgdmFsdWUsIHNyY1NwYW4sIGF0dHJpYnV0ZS52YWx1ZVNwYW4sIG1hdGNoYWJsZUF0dHJpYnV0ZXMsIHBhcnNlZFByb3BlcnRpZXMpO1xuICAgIH1cblxuICAgIHJldHVybiBoYXNCaW5kaW5nO1xuICB9XG5cbiAgcHJpdmF0ZSBfdmlzaXRUZXh0V2l0aEludGVycG9sYXRpb24oXG4gICAgICB2YWx1ZTogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sIGkxOG4/OiBpMThuLkkxOG5NZXRhKTogdC5UZXh0fHQuQm91bmRUZXh0IHtcbiAgICBjb25zdCB2YWx1ZU5vTmdzcCA9IHJlcGxhY2VOZ3NwKHZhbHVlKTtcbiAgICBjb25zdCBleHByID0gdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlSW50ZXJwb2xhdGlvbih2YWx1ZU5vTmdzcCwgc291cmNlU3Bhbik7XG4gICAgcmV0dXJuIGV4cHIgPyBuZXcgdC5Cb3VuZFRleHQoZXhwciwgc291cmNlU3BhbiwgaTE4bikgOiBuZXcgdC5UZXh0KHZhbHVlTm9OZ3NwLCBzb3VyY2VTcGFuKTtcbiAgfVxuXG4gIHByaXZhdGUgcGFyc2VWYXJpYWJsZShcbiAgICAgIGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCB2YXJpYWJsZXM6IHQuVmFyaWFibGVbXSkge1xuICAgIGlmIChpZGVudGlmaWVyLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICB0aGlzLnJlcG9ydEVycm9yKGBcIi1cIiBpcyBub3QgYWxsb3dlZCBpbiB2YXJpYWJsZSBuYW1lc2AsIHNvdXJjZVNwYW4pO1xuICAgIH0gZWxzZSBpZiAoaWRlbnRpZmllci5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFZhcmlhYmxlIGRvZXMgbm90IGhhdmUgYSBuYW1lYCwgc291cmNlU3Bhbik7XG4gICAgfVxuXG4gICAgdmFyaWFibGVzLnB1c2gobmV3IHQuVmFyaWFibGUoaWRlbnRpZmllciwgdmFsdWUsIHNvdXJjZVNwYW4sIHZhbHVlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZVJlZmVyZW5jZShcbiAgICAgIGlkZW50aWZpZXI6IHN0cmluZywgdmFsdWU6IHN0cmluZywgc291cmNlU3BhbjogUGFyc2VTb3VyY2VTcGFuLFxuICAgICAgdmFsdWVTcGFuOiBQYXJzZVNvdXJjZVNwYW58dW5kZWZpbmVkLCByZWZlcmVuY2VzOiB0LlJlZmVyZW5jZVtdKSB7XG4gICAgaWYgKGlkZW50aWZpZXIuaW5kZXhPZignLScpID4gLTEpIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFwiLVwiIGlzIG5vdCBhbGxvd2VkIGluIHJlZmVyZW5jZSBuYW1lc2AsIHNvdXJjZVNwYW4pO1xuICAgIH0gZWxzZSBpZiAoaWRlbnRpZmllci5sZW5ndGggPT09IDApIHtcbiAgICAgIHRoaXMucmVwb3J0RXJyb3IoYFJlZmVyZW5jZSBkb2VzIG5vdCBoYXZlIGEgbmFtZWAsIHNvdXJjZVNwYW4pO1xuICAgIH1cblxuICAgIHJlZmVyZW5jZXMucHVzaChuZXcgdC5SZWZlcmVuY2UoaWRlbnRpZmllciwgdmFsdWUsIHNvdXJjZVNwYW4sIHZhbHVlU3BhbikpO1xuICB9XG5cbiAgcHJpdmF0ZSBwYXJzZUFzc2lnbm1lbnRFdmVudChcbiAgICAgIG5hbWU6IHN0cmluZywgZXhwcmVzc2lvbjogc3RyaW5nLCBzb3VyY2VTcGFuOiBQYXJzZVNvdXJjZVNwYW4sXG4gICAgICB2YWx1ZVNwYW46IFBhcnNlU291cmNlU3Bhbnx1bmRlZmluZWQsIHRhcmdldE1hdGNoYWJsZUF0dHJzOiBzdHJpbmdbXVtdLFxuICAgICAgYm91bmRFdmVudHM6IHQuQm91bmRFdmVudFtdKSB7XG4gICAgY29uc3QgZXZlbnRzOiBQYXJzZWRFdmVudFtdID0gW107XG4gICAgdGhpcy5iaW5kaW5nUGFyc2VyLnBhcnNlRXZlbnQoXG4gICAgICAgIGAke25hbWV9Q2hhbmdlYCwgYCR7ZXhwcmVzc2lvbn09JGV2ZW50YCwgc291cmNlU3BhbiwgdmFsdWVTcGFuIHx8IHNvdXJjZVNwYW4sXG4gICAgICAgIHRhcmdldE1hdGNoYWJsZUF0dHJzLCBldmVudHMpO1xuICAgIGFkZEV2ZW50cyhldmVudHMsIGJvdW5kRXZlbnRzKTtcbiAgfVxuXG4gIHByaXZhdGUgcmVwb3J0RXJyb3IoXG4gICAgICBtZXNzYWdlOiBzdHJpbmcsIHNvdXJjZVNwYW46IFBhcnNlU291cmNlU3BhbixcbiAgICAgIGxldmVsOiBQYXJzZUVycm9yTGV2ZWwgPSBQYXJzZUVycm9yTGV2ZWwuRVJST1IpIHtcbiAgICB0aGlzLmVycm9ycy5wdXNoKG5ldyBQYXJzZUVycm9yKHNvdXJjZVNwYW4sIG1lc3NhZ2UsIGxldmVsKSk7XG4gIH1cbn1cblxuY2xhc3MgTm9uQmluZGFibGVWaXNpdG9yIGltcGxlbWVudHMgaHRtbC5WaXNpdG9yIHtcbiAgdmlzaXRFbGVtZW50KGFzdDogaHRtbC5FbGVtZW50KTogdC5FbGVtZW50fG51bGwge1xuICAgIGNvbnN0IHByZXBhcnNlZEVsZW1lbnQgPSBwcmVwYXJzZUVsZW1lbnQoYXN0KTtcbiAgICBpZiAocHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TQ1JJUFQgfHxcbiAgICAgICAgcHJlcGFyc2VkRWxlbWVudC50eXBlID09PSBQcmVwYXJzZWRFbGVtZW50VHlwZS5TVFlMRSB8fFxuICAgICAgICBwcmVwYXJzZWRFbGVtZW50LnR5cGUgPT09IFByZXBhcnNlZEVsZW1lbnRUeXBlLlNUWUxFU0hFRVQpIHtcbiAgICAgIC8vIFNraXBwaW5nIDxzY3JpcHQ+IGZvciBzZWN1cml0eSByZWFzb25zXG4gICAgICAvLyBTa2lwcGluZyA8c3R5bGU+IGFuZCBzdHlsZXNoZWV0cyBhcyB3ZSBhbHJlYWR5IHByb2Nlc3NlZCB0aGVtXG4gICAgICAvLyBpbiB0aGUgU3R5bGVDb21waWxlclxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgY29uc3QgY2hpbGRyZW46IHQuTm9kZVtdID0gaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuY2hpbGRyZW4sIG51bGwpO1xuICAgIHJldHVybiBuZXcgdC5FbGVtZW50KFxuICAgICAgICBhc3QubmFtZSwgaHRtbC52aXNpdEFsbCh0aGlzLCBhc3QuYXR0cnMpIGFzIHQuVGV4dEF0dHJpYnV0ZVtdLFxuICAgICAgICAvKiBpbnB1dHMgKi9bXSwgLyogb3V0cHV0cyAqL1tdLCBjaGlsZHJlbizCoCAvKiByZWZlcmVuY2VzICovW10sIGFzdC5zb3VyY2VTcGFuLFxuICAgICAgICBhc3Quc3RhcnRTb3VyY2VTcGFuLCBhc3QuZW5kU291cmNlU3Bhbik7XG4gIH1cblxuICB2aXNpdENvbW1lbnQoY29tbWVudDogaHRtbC5Db21tZW50KTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIHZpc2l0QXR0cmlidXRlKGF0dHJpYnV0ZTogaHRtbC5BdHRyaWJ1dGUpOiB0LlRleHRBdHRyaWJ1dGUge1xuICAgIHJldHVybiBuZXcgdC5UZXh0QXR0cmlidXRlKFxuICAgICAgICBhdHRyaWJ1dGUubmFtZSwgYXR0cmlidXRlLnZhbHVlLCBhdHRyaWJ1dGUuc291cmNlU3BhbiwgdW5kZWZpbmVkLCBhdHRyaWJ1dGUuaTE4bik7XG4gIH1cblxuICB2aXNpdFRleHQodGV4dDogaHRtbC5UZXh0KTogdC5UZXh0IHtcbiAgICByZXR1cm4gbmV3IHQuVGV4dCh0ZXh0LnZhbHVlLCB0ZXh0LnNvdXJjZVNwYW4pO1xuICB9XG5cbiAgdmlzaXRFeHBhbnNpb24oZXhwYW5zaW9uOiBodG1sLkV4cGFuc2lvbik6IGFueSB7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICB2aXNpdEV4cGFuc2lvbkNhc2UoZXhwYW5zaW9uQ2FzZTogaHRtbC5FeHBhbnNpb25DYXNlKTogYW55IHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG5jb25zdCBOT05fQklOREFCTEVfVklTSVRPUiA9IG5ldyBOb25CaW5kYWJsZVZpc2l0b3IoKTtcblxuZnVuY3Rpb24gbm9ybWFsaXplQXR0cmlidXRlTmFtZShhdHRyTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIC9eZGF0YS0vaS50ZXN0KGF0dHJOYW1lKSA/IGF0dHJOYW1lLnN1YnN0cmluZyg1KSA6IGF0dHJOYW1lO1xufVxuXG5mdW5jdGlvbiBhZGRFdmVudHMoZXZlbnRzOiBQYXJzZWRFdmVudFtdLCBib3VuZEV2ZW50czogdC5Cb3VuZEV2ZW50W10pIHtcbiAgYm91bmRFdmVudHMucHVzaCguLi5ldmVudHMubWFwKGUgPT4gdC5Cb3VuZEV2ZW50LmZyb21QYXJzZWRFdmVudChlKSkpO1xufVxuXG5mdW5jdGlvbiBpc0VtcHR5VGV4dE5vZGUobm9kZTogaHRtbC5Ob2RlKTogYm9vbGVhbiB7XG4gIHJldHVybiBub2RlIGluc3RhbmNlb2YgaHRtbC5UZXh0ICYmIG5vZGUudmFsdWUudHJpbSgpLmxlbmd0aCA9PSAwO1xufVxuXG5mdW5jdGlvbiBpc0NvbW1lbnROb2RlKG5vZGU6IGh0bWwuTm9kZSk6IGJvb2xlYW4ge1xuICByZXR1cm4gbm9kZSBpbnN0YW5jZW9mIGh0bWwuQ29tbWVudDtcbn1cblxuZnVuY3Rpb24gdGV4dENvbnRlbnRzKG5vZGU6IGh0bWwuRWxlbWVudCk6IHN0cmluZ3xudWxsIHtcbiAgaWYgKG5vZGUuY2hpbGRyZW4ubGVuZ3RoICE9PSAxIHx8ICEobm9kZS5jaGlsZHJlblswXSBpbnN0YW5jZW9mIGh0bWwuVGV4dCkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gKG5vZGUuY2hpbGRyZW5bMF0gYXMgaHRtbC5UZXh0KS52YWx1ZTtcbiAgfVxufVxuIl19