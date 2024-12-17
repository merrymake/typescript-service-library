"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_1 = require("./index");
const fs_1 = __importDefault(require("fs"));
async function foo(pb, env) {
    const p = pb.toString();
    const mid = env.messageId;
    const tid = env.traceId;
    const sid = env.sessionId;
    const headers = env.headers && env.headers["x-discord"];
    (0, index_1.postToRapids)("$reply", {
        content: "String",
        "content-type": index_1.ContentType.text,
    });
    (0, index_1.postToRapids)("custom");
    (0, index_1.postToRapids)("custom", "String");
    (0, index_1.replyToOrigin)({
        content: "String",
    });
    (0, index_1.replyToOrigin)({
        content: { msg: "Hello" },
        "status-code": 5,
        headers: { chr: "abc" },
    });
    (0, index_1.replyToOrigin)({
        content: fs_1.default.readFileSync("meme.png"),
        "content-type": index_1.ContentType.png,
        "status-code": 201,
        headers: { "custom-header": "is cool" },
    });
    // Should fail
    // replyToOrigin({
    //   content: fs.readFileSync("meme.png"),
    //   "status-code": 201,
    //   headers: { "custom-header": "is cool" },
    // });
}
(0, index_1.merrymakeService)({
    foo,
}, async () => {
    console.log("Init");
});
