"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
async function handleHello(payloadBuffer, envelope) {
    let payload = payloadBuffer.toString();
    (0, _1.replyToOrigin)(`Hello, ${payload}!`, { contentType: _1.MIME_TYPES.txt });
}
(0, _1.merrymakeService)({
    handleHello,
});
const _2 = require(".");
async function foo(pb, env) {
    let p = pb.toString();
    let mid = env.messageId;
    let tid = env.traceId;
    let sid = env.sessionId;
    (0, _2.postToRapids)("$reply", { content: "String", mime: _1.MIME_TYPES.txt });
    (0, _2.postToRapids)("custom");
    (0, _2.postToRapids)("custom", "String");
    (0, _1.replyToOrigin)("String", { contentType: _1.MIME_TYPES.txt });
    (0, _1.replyToOrigin)({ msg: "Hello" }, { contentType: _1.MIME_TYPES.json });
}
(0, _1.merrymakeService)({
    foo,
}, async () => {
    console.log("Init");
});
