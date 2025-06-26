"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
async function foo(pb, env) {
    throw "Crash";
}
(0, index_1.merrymakeService)({
    foo,
});
