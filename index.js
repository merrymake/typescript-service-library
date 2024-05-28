"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIME_TYPES = exports.replyToOrigin = exports.postToRapids = exports.merrymakeService = void 0;
const ext2mime_1 = require("@merrymake/ext2mime");
const net_1 = __importDefault(require("net"));
/**
 * This is the root call for a Merrymake service.
 *
 * @param handlers Used to link actions in the Merrymake.json file to code.
 * @param init Used to define code to run after deployment but before release. Useful for smoke tests or database consolidation. Similar to an 'init container'
 */
async function merrymakeService(handlers, init) {
    try {
        const [action, envelope, payload] = await getActionAndPayload();
        const handler = handlers[action];
        if (handler !== undefined)
            await handler(payload, envelope);
        else if (init !== undefined)
            await init();
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
}
exports.merrymakeService = merrymakeService;
/**
 * Post an event to the central message queue (Rapids), with a payload and its content type.
 *
 * @param event       the event to post
 * @param payload     the payload with content type
 */
function postToRapids(event, payload) {
    if (event === "$reply") {
        payload.headers.contentType = payload.headers.contentType.toString();
    }
    const packed = pack(Buffer.from(event), Buffer.from(Buffer.isBuffer(payload)
        ? payload
        : payload instanceof Object
            ? JSON.stringify(payload)
            : payload || ""));
    const client = new net_1.default.Socket();
    const [host, port] = process.env.RAPIDS.split(":");
    return new Promise((resolve) => {
        client.connect(+port, host, async () => {
            client.write(packed);
            client.end();
            resolve();
        });
    });
}
exports.postToRapids = postToRapids;
/**
 * Post a reply back to the originator of the trace, with a payload and its content type.
 *
 * @param content        the payload
 * @param mime           the content type of the payload
 */
function replyToOrigin(content, headers) {
    return postToRapids("$reply", { content, headers });
}
exports.replyToOrigin = replyToOrigin;
function numberToBuffer(n) {
    return Buffer.from([n >> 16, n >> 8, n >> 0]);
}
function bufferToNumber(bufs) {
    return (bufs.at(0) << 16) | (bufs.at(1) << 8) | bufs.at(2);
}
function pack(...bufs) {
    const result = [];
    bufs.forEach((x) => result.push(numberToBuffer(x.length), x));
    return Buffer.concat(result);
}
function parseValue(buffer) {
    const len = bufferToNumber(buffer);
    return [buffer.subarray(3, len + 3), buffer.subarray(len + 3)];
}
function getActionAndPayload() {
    return new Promise((resolve, reject) => {
        const bufs = [];
        process.stdin.on("data", (data) => {
            bufs.push(data);
        });
        process.stdin.on("end", () => {
            const buffer1 = Buffer.concat(bufs);
            const [action, buffer2] = parseValue(buffer1);
            const [envelope, buffer3] = parseValue(buffer2);
            const [payload, buffer4] = parseValue(buffer3);
            resolve([action.toString(), JSON.parse(envelope.toString()), payload]);
        });
    });
}
function mapValues(obj) {
    let result = {};
    Object.keys(obj).forEach((k) => (result[k] = obj[k][0]));
    return result;
}
exports.MIME_TYPES = mapValues(ext2mime_1.COMMON_MIME_TYPES);
