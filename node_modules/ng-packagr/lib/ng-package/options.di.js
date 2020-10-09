"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_OPTIONS_PROVIDER = exports.provideOptions = exports.OPTIONS_TOKEN = void 0;
const injection_js_1 = require("injection-js");
exports.OPTIONS_TOKEN = new injection_js_1.InjectionToken(`ng.v5.options`);
exports.provideOptions = (options = {}) => ({
    provide: exports.OPTIONS_TOKEN,
    useValue: options,
});
exports.DEFAULT_OPTIONS_PROVIDER = exports.provideOptions();
//# sourceMappingURL=options.di.js.map