"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
async function foo(pbp, env) {
    let pb = await pbp.then((x) => x);
    let p = pb.toString();
    let mid = env.messageId;
    let tid = env.traceId;
    let sid = env.sessionId;
    (0, _1.postToRapids)("$reply", { content: "String", mime: _1.MIME_TYPES.txt });
    (0, _1.postToRapids)("custom");
    (0, _1.postToRapids)("custom", { content: "String", mime: _1.MIME_TYPES.txt });
    (0, _1.replyToOrigin)("String", _1.MIME_TYPES.txt);
    (0, _1.replyToOrigin)({ msg: "Hello" }, _1.MIME_TYPES.json);
    (0, _1.replyFileToOrigin)("index.html");
}
(0, _1.merrymakeService)({
    foo,
}, async () => {
    console.log("Init");
});
