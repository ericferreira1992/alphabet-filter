"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.provideProject = exports.PROJECT_TOKEN = void 0;
const injection_js_1 = require("injection-js");
exports.PROJECT_TOKEN = new injection_js_1.InjectionToken(`ng.v5.project`);
exports.provideProject = (project) => ({
    provide: exports.PROJECT_TOKEN,
    useValue: project,
});
//# sourceMappingURL=project.di.js.map