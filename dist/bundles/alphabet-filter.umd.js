(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('@angular/core'), require('@angular/common'), require('@angular/forms')) :
    typeof define === 'function' && define.amd ? define('alphabet-filter', ['exports', '@angular/core', '@angular/common', '@angular/forms'], factory) :
    (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global['alphabet-filter'] = {}, global.ng.core, global.ng.common, global.ng.forms));
}(this, (function (exports, core, common, forms) { 'use strict';

    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b)
                if (Object.prototype.hasOwnProperty.call(b, p))
                    d[p] = b[p]; };
        return extendStatics(d, b);
    };
    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }
    var __assign = function () {
        __assign = Object.assign || function __assign(t) {
            for (var s, i = 1, n = arguments.length; i < n; i++) {
                s = arguments[i];
                for (var p in s)
                    if (Object.prototype.hasOwnProperty.call(s, p))
                        t[p] = s[p];
            }
            return t;
        };
        return __assign.apply(this, arguments);
    };
    function __rest(s, e) {
        var t = {};
        for (var p in s)
            if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
                t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    }
    function __decorate(decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
            r = Reflect.decorate(decorators, target, key, desc);
        else
            for (var i = decorators.length - 1; i >= 0; i--)
                if (d = decorators[i])
                    r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    }
    function __param(paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); };
    }
    function __metadata(metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
            return Reflect.metadata(metadataKey, metadataValue);
    }
    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try {
                step(generator.next(value));
            }
            catch (e) {
                reject(e);
            } }
            function rejected(value) { try {
                step(generator["throw"](value));
            }
            catch (e) {
                reject(e);
            } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }
    function __generator(thisArg, body) {
        var _ = { label: 0, sent: function () { if (t[0] & 1)
                throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f)
                throw new TypeError("Generator is already executing.");
            while (_)
                try {
                    if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
                        return t;
                    if (y = 0, t)
                        op = [op[0] & 2, t.value];
                    switch (op[0]) {
                        case 0:
                        case 1:
                            t = op;
                            break;
                        case 4:
                            _.label++;
                            return { value: op[1], done: false };
                        case 5:
                            _.label++;
                            y = op[1];
                            op = [0];
                            continue;
                        case 7:
                            op = _.ops.pop();
                            _.trys.pop();
                            continue;
                        default:
                            if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                                _ = 0;
                                continue;
                            }
                            if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                                _.label = op[1];
                                break;
                            }
                            if (op[0] === 6 && _.label < t[1]) {
                                _.label = t[1];
                                t = op;
                                break;
                            }
                            if (t && _.label < t[2]) {
                                _.label = t[2];
                                _.ops.push(op);
                                break;
                            }
                            if (t[2])
                                _.ops.pop();
                            _.trys.pop();
                            continue;
                    }
                    op = body.call(thisArg, _);
                }
                catch (e) {
                    op = [6, e];
                    y = 0;
                }
                finally {
                    f = t = 0;
                }
            if (op[0] & 5)
                throw op[1];
            return { value: op[0] ? op[1] : void 0, done: true };
        }
    }
    var __createBinding = Object.create ? (function (o, m, k, k2) {
        if (k2 === undefined)
            k2 = k;
        Object.defineProperty(o, k2, { enumerable: true, get: function () { return m[k]; } });
    }) : (function (o, m, k, k2) {
        if (k2 === undefined)
            k2 = k;
        o[k2] = m[k];
    });
    function __exportStar(m, o) {
        for (var p in m)
            if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p))
                __createBinding(o, m, p);
    }
    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m)
            return m.call(o);
        if (o && typeof o.length === "number")
            return {
                next: function () {
                    if (o && i >= o.length)
                        o = void 0;
                    return { value: o && o[i++], done: !o };
                }
            };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }
    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m)
            return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done)
                ar.push(r.value);
        }
        catch (error) {
            e = { error: error };
        }
        finally {
            try {
                if (r && !r.done && (m = i["return"]))
                    m.call(i);
            }
            finally {
                if (e)
                    throw e.error;
            }
        }
        return ar;
    }
    function __spread() {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    }
    function __spreadArrays() {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++)
            s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    }
    ;
    function __await(v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    }
    function __asyncGenerator(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator)
            throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n])
            i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try {
            step(g[n](v));
        }
        catch (e) {
            settle(q[0][3], e);
        } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length)
            resume(q[0][0], q[0][1]); }
    }
    function __asyncDelegator(o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: n === "return" } : f ? f(v) : v; } : f; }
    }
    function __asyncValues(o) {
        if (!Symbol.asyncIterator)
            throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function (v) { resolve({ value: v, done: d }); }, reject); }
    }
    function __makeTemplateObject(cooked, raw) {
        if (Object.defineProperty) {
            Object.defineProperty(cooked, "raw", { value: raw });
        }
        else {
            cooked.raw = raw;
        }
        return cooked;
    }
    ;
    var __setModuleDefault = Object.create ? (function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function (o, v) {
        o["default"] = v;
    };
    function __importStar(mod) {
        if (mod && mod.__esModule)
            return mod;
        var result = {};
        if (mod != null)
            for (var k in mod)
                if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k))
                    __createBinding(result, mod, k);
        __setModuleDefault(result, mod);
        return result;
    }
    function __importDefault(mod) {
        return (mod && mod.__esModule) ? mod : { default: mod };
    }
    function __classPrivateFieldGet(receiver, privateMap) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to get private field on non-instance");
        }
        return privateMap.get(receiver);
    }
    function __classPrivateFieldSet(receiver, privateMap, value) {
        if (!privateMap.has(receiver)) {
            throw new TypeError("attempted to set private field on non-instance");
        }
        privateMap.set(receiver, value);
        return value;
    }

    var FilterPipe = /** @class */ (function () {
        function FilterPipe() {
        }
        FilterPipe.prototype.transform = function (list, obj, startsWith) {
            if (startsWith === void 0) { startsWith = false; }
            if ((list && Array.isArray(list)) && (obj && typeof obj === 'object')) {
                var newList = list.filter(function (item) {
                    var ok = true;
                    for (var key in obj) {
                        if ((obj[key] != null) && (item[key] != null) && obj.hasOwnProperty(key)) {
                            var valueObj = obj[key];
                            var valueList = item[key];
                            if (!Array.isArray(obj[key]) && Object.prototype.toString.call(obj[key]) !== '[object Object]') {
                                valueList = valueList.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                valueObj = valueObj.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                                if ((!startsWith && valueList.indexOf(valueObj) < 0) || (startsWith && !(valueList.startsWith(valueObj)))) {
                                    ok = false;
                                    return;
                                }
                            }
                        }
                    }
                    return ok;
                });
                return newList;
            }
            return list;
        };
        return FilterPipe;
    }());
    FilterPipe.decorators = [
        { type: core.Pipe, args: [{
                    name: 'filter'
                },] }
    ];

    var AlphabetFilterComponent = /** @class */ (function () {
        function AlphabetFilterComponent(filter, renderer, formBuilder) {
            this.filter = filter;
            this.renderer = renderer;
            this.formBuilder = formBuilder;
            this.height = '300px';
            this.propAlphaOrder = '';
            this.propsSearch = [];
            this.data = [];
            this.placeholder = 'digite sua busca';
            this.listClass = null;
            this.withTemplate = false;
            this.noSmoothScroll = false;
            this.onCancel = new core.EventEmitter();
            this.onClick = new core.EventEmitter();
            this.closed = false;
            this.inputFocused = false;
            this.heightContent = 0;
            this.alphabet = [];
            this.currentAlpha = '';
            this.currentLetterElement = null;
            this.hiddenTitle = false;
            this.lettersListHeight = 0;
            this.indicatorClicked = false;
            this.goingToLetter = false;
            for (var i = 0; i < 26; i++) {
                this.alphabet.push(String.fromCharCode(97 + i).toUpperCase());
            }
            this.form = this.formBuilder.group({
                search: [null]
            });
            this.form.get('search').valueChanges.subscribe(this.setFilter.bind(this));
        }
        AlphabetFilterComponent.prototype.ngOnInit = function () {
            var _this = this;
            setTimeout(function () {
                _this.renderer.listen(_this.searchListEl.nativeElement, 'scroll', _this.onScrollList.bind(_this));
                _this.renderer.listen(_this.contentEl.nativeElement, 'mouseup', _this.onMouseUpContent.bind(_this));
                _this.renderer.listen(_this.contentEl.nativeElement, 'mousemove', _this.onMouseMoveContent.bind(_this));
                _this.renderer.listen(_this.indicatorEl.nativeElement, 'mousedown', _this.onMouseDownIndicator.bind(_this));
                _this.renderer.listen(_this.indicatorEl.nativeElement, 'mouseup', _this.onMouseUpIndicator.bind(_this));
                _this.heightContent = _this.contentEl.nativeElement.clientHeight + (_this.onCancel ? 20 : 37);
                _this.lettersListHeight = _this.letterList.nativeElement.children[0].clientHeight;
                _this.focusInput();
            }, 100);
        };
        AlphabetFilterComponent.prototype.ngOnChanges = function (changes) {
            var e_1, _b;
            var _this = this;
            if ('data' in changes) {
                this.data = this.orderBy();
                if (this.data && this.propAlphaOrder) {
                    this.data.forEach(function (item) {
                        var letter = item[_this.propAlphaOrder].substr(0, 1);
                        item['$letter'] = letter.toUpperCase();
                        item['$class'] = 'let-' + letter.toLowerCase();
                    });
                    setTimeout(function () { return _this.defineCurrentLetterElement(); }, 100);
                }
            }
            if ('propsSearch' in changes && this.propsSearch) {
                if (typeof this.propsSearch === 'string')
                    this.propsSearch = [this.propsSearch];
                this.objFilter = {};
                try {
                    for (var _c = __values(this.propsSearch), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var prop = _d.value;
                        this.objFilter[prop] = null;
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                this.setFilter();
            }
        };
        AlphabetFilterComponent.prototype.defineCurrentLetterElement = function () {
            var e_2, _b;
            if (!this.goingToLetter) {
                var ulPosition = this.searchListEl.nativeElement.getBoundingClientRect();
                var ulTop = ulPosition.top;
                var elementsLetters = [];
                var current = null;
                var _loop_1 = function (liElement) {
                    var e_3, _b;
                    var letterClass = '';
                    try {
                        for (var _c = (e_3 = void 0, __values(liElement.classList)), _d = _c.next(); !_d.done; _d = _c.next()) {
                            var className = _d.value;
                            if (className.startsWith('let-')) {
                                letterClass = className;
                                break;
                            }
                        }
                    }
                    catch (e_3_1) { e_3 = { error: e_3_1 }; }
                    finally {
                        try {
                            if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                        }
                        finally { if (e_3) throw e_3.error; }
                    }
                    if (elementsLetters.filter(function (x) { return x.classList.contains(letterClass); }).length === 0) {
                        elementsLetters.push(liElement);
                        var liPosition = liElement.getBoundingClientRect();
                        var liTop = liPosition.top - 20;
                        if (liTop < ulTop)
                            current = liElement;
                    }
                };
                try {
                    for (var _c = __values(this.searchListEl.nativeElement.children), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var liElement = _d.value;
                        _loop_1(liElement);
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
                if (current && current !== this.currentLetterElement) {
                    current.children[0]['position'] = current.children[0].innerHTML.charCodeAt(0) - 65;
                    this.currentLetterElement = current;
                    this.currentAlpha = current.children[0].innerHTML;
                }
                else if (!current) {
                    this.currentLetterElement = null;
                    this.currentAlpha = '';
                }
            }
        };
        AlphabetFilterComponent.prototype.goLetter = function (letter) {
            var _this = this;
            this.currentAlpha = letter;
            var lettersElList = this.searchListEl.nativeElement.children;
            var letterElement = __spread(lettersElList).find(function (el) {
                var _a;
                var letterClass = ((_a = el.classList.value.split(' ').find(function (x) { return x.startsWith('let-'); })) !== null && _a !== void 0 ? _a : '').replace('let-', '');
                return letterClass.toUpperCase() === letter.toUpperCase();
            });
            if (letterElement) {
                letterElement.children[0]['position'] = letterElement.children[0].innerHTML.charCodeAt(0) - 65;
                this.currentLetterElement = letterElement;
                var scrollHeight = this.searchListEl.nativeElement.scrollHeight - this.searchListEl.nativeElement.clientHeight;
                var scrollTop_1 = Math.min(scrollHeight, letterElement.offsetTop);
                this.searchListEl.nativeElement.scrollTo({
                    left: 0,
                    top: scrollTop_1,
                    behavior: 'smooth'
                });
                this.goingToLetter = true;
                var checkIfScrollToIsFinished_1 = setInterval(function () {
                    if (scrollTop_1 === _this.searchListEl.nativeElement.scrollTop) {
                        clearInterval(checkIfScrollToIsFinished_1);
                        _this.goingToLetter = false;
                    }
                }, 60);
            }
        };
        AlphabetFilterComponent.prototype.onMouseMoveContent = function (event) {
            var e_4, _b;
            if (!this.form.get('search').value && this.indicatorClicked) {
                try {
                    for (var _c = __values(this.letterList.nativeElement.children), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var letter = _d.value;
                        if (letter.classList.contains('contains')) {
                            var position = letter.getBoundingClientRect();
                            var bounds = { top: position.y, bottom: (position.y + letter.clientHeight) };
                            if (event.clientY >= bounds.top && event.clientY <= bounds.bottom) {
                                if (this.currentAlpha !== letter.children[0].innerHTML)
                                    this.goLetter(letter.children[0].innerHTML);
                                break;
                            }
                        }
                    }
                }
                catch (e_4_1) { e_4 = { error: e_4_1 }; }
                finally {
                    try {
                        if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                    }
                    finally { if (e_4) throw e_4.error; }
                }
            }
        };
        AlphabetFilterComponent.prototype.onMouseDownIndicator = function (event) {
            if (event.button === 0)
                this.indicatorClicked = true;
        };
        AlphabetFilterComponent.prototype.onMouseUpIndicator = function () { this.indicatorClicked = false; };
        AlphabetFilterComponent.prototype.onMouseUpContent = function () { this.indicatorClicked = false; };
        AlphabetFilterComponent.prototype.onScrollList = function (e) {
            if (!this.goingToLetter) {
                if (!this.indicatorClicked)
                    this.defineCurrentLetterElement();
            }
        };
        AlphabetFilterComponent.prototype.onMouseWheelContent = function (event) {
        };
        AlphabetFilterComponent.prototype.onKeyDownContent = function (event) {
            var e = event;
            var key = (e.key || e.keyIdentifier || e.keyCode);
            if (key === 27 || key === 'Escape')
                this.close();
        };
        AlphabetFilterComponent.prototype.click = function (data) {
            if (data === void 0) { data = null; }
            this.onClick.emit(data);
        };
        AlphabetFilterComponent.prototype.close = function () {
            if (this.onCancel.observers.length > 0)
                this.onCancel.emit();
        };
        AlphabetFilterComponent.prototype.focusInput = function () {
            this.inputSearchEl.nativeElement.focus();
        };
        AlphabetFilterComponent.prototype.startsWithLetter = function (_letter) {
            var _this = this;
            var letter = _letter.toUpperCase();
            return this.filter.transform(this.data, this.objFilter, true)
                .filter(function (x) { return x[_this.propAlphaOrder].toUpperCase().startsWith(letter); })
                .length > 0;
        };
        AlphabetFilterComponent.prototype.setFilter = function () {
            var _this = this;
            if (this.objFilter) {
                Object.keys(this.objFilter).forEach(function (prop) {
                    _this.objFilter[prop] = _this.form.get('search').value;
                });
                this.objFilter = Object.assign({}, this.objFilter);
                setTimeout(function () { return _this.defineCurrentLetterElement(); }, 100);
            }
        };
        AlphabetFilterComponent.prototype.clearFilter = function () {
            this.form.get('search').setValue(null);
            this.setFilter();
        };
        AlphabetFilterComponent.prototype.orderBy = function () {
            var _this = this;
            return this.data.sort(function (a, b) {
                if (a[_this.propAlphaOrder].toUpperCase() < b[_this.propAlphaOrder].toUpperCase())
                    return -1;
                if (a[_this.propAlphaOrder].toUpperCase() > b[_this.propAlphaOrder].toUpperCase())
                    return 1;
                return 0;
            });
        };
        AlphabetFilterComponent.prototype.ngOnDestroy = function () {
        };
        return AlphabetFilterComponent;
    }());
    AlphabetFilterComponent.decorators = [
        { type: core.Component, args: [{
                    selector: 'alphabet-filter',
                    template: "<div class=\"alpha-search\" [ngStyle]=\"{'height': height}\">\n  <div #content class=\"alpha-search-content\" [ngClass]=\"{'hidden-title': hiddenTitle}\">\n\n    <button class=\"close-button\" *ngIf=\"onCancel.observers.length > 0\" (click)=\"close()\" [ngClass]=\"{'fadeEnter': !closed, 'fadeExit': closed}\" title=\"Fechar\">\n      <svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" viewBox=\"0 0 212.982 212.982\" xml:space=\"preserve\">\n        <g>\n          <path style=\"fill-rule:evenodd;clip-rule:evenodd;\" d=\"M131.804,106.491l75.936-75.936c6.99-6.99,6.99-18.323,0-25.312\n            c-6.99-6.99-18.322-6.99-25.312,0l-75.937,75.937L30.554,5.242c-6.99-6.99-18.322-6.99-25.312,0c-6.989,6.99-6.989,18.323,0,25.312\n            l75.937,75.936L5.242,182.427c-6.989,6.99-6.989,18.323,0,25.312c6.99,6.99,18.322,6.99,25.312,0l75.937-75.937l75.937,75.937\n            c6.989,6.99,18.322,6.99,25.312,0c6.99-6.99,6.99-18.322,0-25.312L131.804,106.491z\"/>\n        </g>\n      </svg> \n    </button>\n\n    <div #inputBody class=\"alpha-search-input\" (click)=\"focusInput()\" [ngClass]=\"{'fadeEnter': !closed, 'fadeExit': closed}\">\n      <div class=\"icon\">\n        <svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n          <g>\n            <path d=\"M495,466.2L377.2,348.4c29.2-35.6,46.8-81.2,46.8-130.9C424,103.5,331.5,11,217.5,11C103.4,11,11,103.5,11,217.5   S103.4,424,217.5,424c49.7,0,95.2-17.5,130.8-46.7L466.1,495c8,8,20.9,8,28.9,0C503,487.1,503,474.1,495,466.2z M217.5,382.9   C126.2,382.9,52,308.7,52,217.5S126.2,52,217.5,52C308.7,52,383,126.3,383,217.5S308.7,382.9,217.5,382.9z\"/>\n          </g>\n        </svg>        \n      </div>\n      <form [formGroup]=\"form\">\n\t\t<input #inputSearch type=\"text\" formControlName=\"search\" [placeholder]=\"placeholder\" autofocus/>\n\t  </form>\n      <div class=\"icon\" (click)=\"clearFilter()\" *ngIf=\"form.controls.search.value\">\n        <svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0px\" y=\"0px\" viewBox=\"0 0 212.982 212.982\" xml:space=\"preserve\">\n          <g>\n            <path style=\"fill-rule:evenodd;clip-rule:evenodd;\" d=\"M131.804,106.491l75.936-75.936c6.99-6.99,6.99-18.323,0-25.312\n              c-6.99-6.99-18.322-6.99-25.312,0l-75.937,75.937L30.554,5.242c-6.99-6.99-18.322-6.99-25.312,0c-6.989,6.99-6.989,18.323,0,25.312\n              l75.937,75.936L5.242,182.427c-6.989,6.99-6.989,18.323,0,25.312c6.99,6.99,18.322,6.99,25.312,0l75.937-75.937l75.937,75.937\n              c6.989,6.99,18.322,6.99,25.312,0c6.99-6.99,6.99-18.322,0-25.312L131.804,106.491z\"/>\n          </g>\n        </svg>      \n      </div>\n    </div>\n\n    <div class=\"alpha-search-area\" [ngClass]=\"{'fadeEnter': !closed, 'fadeExit': closed}\">\n      <ul #searchList class=\"search-list\" [ngClass]=\"listClass\" [ngStyle]=\"indicatorClicked ? {'overflow': 'hidden'} : {}\">\n        <li *ngFor=\"let item of data | filter:objFilter:true\" [ngClass]=\"item.$class\" class=\"fadeEnter\">\n          <span [innerHtml]=\"item.$letter\"></span>\n          <div class=\"search-item-data\" (click)=\"click(item)\">\n            <ng-container *ngIf=\"withTemplate\" [ngTemplateOutlet]=\"templateRef\" [ngTemplateOutletContext]=\"{ $implicit: item }\"></ng-container>\n            <span *ngIf=\"!withTemplate\">{{item.name}}</span>\n          </div>\n        </li>\n      </ul>\n    </div>\n\n    <div #indicator class=\"alpha-indicator no-select\" [ngClass]=\"{'fadeEnter': currentLetterElement, 'fadeExit': !currentLetterElement}\" [ngStyle]=\"{'top': ((currentLetterElement?.children[0].position * lettersListHeight) + 77) + 'px'}\">\n      <div>\n        <div>\n          <span>{{currentLetterElement?.children[0].innerHTML}}</span>\n        </div>\n      </div>\n      <div>\n        <span>{{currentLetterElement?.children[0].innerHTML}}</span>\n        <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 55.69 122.242\">\n          <g id=\"guia\" transform=\"translate(-1288 -436.211)\">\n              <path id=\"Path_4084\" d=\"M-13643.358-21865.281l-55.629-.09a4.4 4.4 0 0 0 0 .711c.035.008-.083 10.844 17.217 22.045 19.523 12.643 38.459 38.025 38.459 38.025z\" data-name=\"Path 4084\" transform=\"translate(14986.999 22362.5)\"/>\n              <path id=\"Path_4085\" d=\"M-13643.354-21803.814l-55.632-.094c.035-.008-.083-12.236 17.218-23.437 19.524-12.643 38.461-38.023 38.461-38.023z\" data-name=\"Path 4085\" transform=\"translate(14986.998 22301.55)\"/>\n          </g>\n        </svg>\n      </div>\n    </div>\n\n    <section #letterList>\n      <div class=\"alpha-letters-list\" *ngFor=\"let letter of alphabet\" (click)=\"goLetter(letter)\" [ngClass]=\"{'contains': currentLetterElement?.children[0].innerHTML !== letter && startsWithLetter(letter), 'actived': currentLetterElement?.children[0].innerHTML === letter}\">\n        <span>{{letter}}</span>\n        <i></i>\n      </div>\n    </section>\n\n  </div>\n</div>\n",
                    host: {
                        '(document:mousewheel)': 'onMouseWheelContent($event)',
                        '(document:keydown)': 'onKeyDownContent($event)'
                    }
                },] }
    ];
    AlphabetFilterComponent.ctorParameters = function () { return [
        { type: FilterPipe },
        { type: core.Renderer2 },
        { type: forms.FormBuilder }
    ]; };
    AlphabetFilterComponent.propDecorators = {
        templateRef: [{ type: core.ContentChild, args: [core.TemplateRef,] }],
        inputBodyEl: [{ type: core.ViewChild, args: ['inputBody',] }],
        inputSearchEl: [{ type: core.ViewChild, args: ['inputSearch',] }],
        searchListEl: [{ type: core.ViewChild, args: ['searchList',] }],
        letterList: [{ type: core.ViewChild, args: ['letterList',] }],
        indicatorEl: [{ type: core.ViewChild, args: ['indicator',] }],
        contentEl: [{ type: core.ViewChild, args: ['content',] }],
        height: [{ type: core.Input }],
        propAlphaOrder: [{ type: core.Input }],
        propsSearch: [{ type: core.Input }],
        data: [{ type: core.Input }],
        placeholder: [{ type: core.Input }],
        listClass: [{ type: core.Input }],
        withTemplate: [{ type: core.Input }],
        noSmoothScroll: [{ type: core.Input }],
        onCancel: [{ type: core.Output }],
        onClick: [{ type: core.Output }]
    };

    var AlphabetFilterModule = /** @class */ (function () {
        function AlphabetFilterModule() {
        }
        return AlphabetFilterModule;
    }());
    AlphabetFilterModule.decorators = [
        { type: core.NgModule, args: [{
                    imports: [
                        common.CommonModule,
                        forms.ReactiveFormsModule,
                    ],
                    exports: [
                        AlphabetFilterComponent
                    ],
                    declarations: [
                        AlphabetFilterComponent,
                        FilterPipe,
                    ],
                    providers: [
                        FilterPipe
                    ]
                },] }
    ];

    /**
     * Generated bundle index. Do not edit.
     */

    exports.AlphabetFilterComponent = AlphabetFilterComponent;
    exports.AlphabetFilterModule = AlphabetFilterModule;
    exports.ɵa = FilterPipe;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=alphabet-filter.umd.js.map
