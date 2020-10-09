"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.camelize = void 0;
function camelize(str) {
    return str
        .replace(/(-|_|\.|\s)+(.)?/g, (_match, _separator, chr) => (chr ? chr.toUpperCase() : ''))
        .replace(/^([A-Z])/, match => match.toLowerCase());
}
exports.camelize = camelize;
//# sourceMappingURL=strings.js.map