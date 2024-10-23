"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
async function handleHello(payloadBuffer, envelope) {
    let payload = payloadBuffer.toString();
    (0, index_1.replyToOrigin)(`Hello, ${payload}!`, { contentType: index_1.MIME_TYPES.txt });
}
(0, index_1.merrymakeService)({
    handleHello,
});
async function foo(pb, env) {
    let p = pb.toString();
    let mid = env.messageId;
    let tid = env.traceId;
    let sid = env.sessionId;
    (0, index_1.postToRapids)("$reply", { content: "String", mime: index_1.MIME_TYPES.txt });
    (0, index_1.postToRapids)("custom");
    (0, index_1.postToRapids)("custom", "String");
    (0, index_1.replyToOrigin)("String", { contentType: index_1.MIME_TYPES.txt });
    (0, index_1.replyToOrigin)(JSON.stringify({ msg: "Hello" }), {
        contentType: index_1.MIME_TYPES.json,
    });
}
(0, index_1.merrymakeService)({
    foo,
}, async () => {
    console.log("Init");
});
