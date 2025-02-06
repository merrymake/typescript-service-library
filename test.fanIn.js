"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
const payloadBuffer = Buffer.from(JSON.stringify([
    { event: "hello", payload: Buffer.from("Christian") },
    { event: "hej", payload: Buffer.from("Hanni") },
]));
(async () => {
    _1.Log.newline(JSON.parse(payloadBuffer.toString()));
    await (0, _1.processFanIn)(payloadBuffer, {
        hello: (payloadBuffer) => _1.Log.info(`Hello ${payloadBuffer.toString()}`),
    });
})();
