"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIME_TYPES = exports.broadcastToChannel = exports.joinChannel = exports.replyFileToOrigin = exports.replyToOrigin = exports.postToRapids = exports.merrymakeService = void 0;
const ext2mime_1 = require("@merrymake/ext2mime");
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const net_1 = __importDefault(require("net"));
let tcp = false;
/**
 * This is the root call for a Merrymake service.
 *
 * @param handlers Used to link actions in the Merrymake.json file to code.
 * @param init Used to define code to run after deployment but before release. Useful for smoke tests or database consolidation. Similar to an 'init container'
 */
async function merrymakeService(handlers, init) {
    try {
        if (process.argv.length === 2) {
            tcp = true;
            const [action, envelope, payload] = await getActionAndPayload();
            const handler = handlers[action];
            if (handler !== undefined)
                await handler(payload, envelope);
            else if (init !== undefined)
                await init();
        }
        else {
            const action = process.argv[process.argv.length - 2];
            const handler = handlers[action];
            if (handler !== undefined) {
                const envelope = JSON.parse(process.argv[process.argv.length - 1]);
                handler(await getPayload(), envelope);
            }
            else if (init !== undefined)
                await init();
        }
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
    if (tcp === true) {
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
        client.connect(+port, host, async () => {
            client.write(packed);
            client.end();
        });
    }
    else {
        if (payload !== undefined) {
            if (payload.headers !== undefined)
                return axios_1.default.post(`${process.env.RAPIDS}/${event}`, payload.content, {
                    headers: { "Content-Type": payload.headers.contentType.toString() },
                });
            else
                return axios_1.default.post(`${process.env.RAPIDS}/${event}`, payload, {
                    headers: {
                        "Content-Type": payload instanceof Object ? "application/json" : "text/plain",
                    },
                });
        }
        else {
            return axios_1.default.post(`${process.env.RAPIDS}/${event}`);
        }
    }
}
exports.postToRapids = postToRapids;
/**
 * Post a reply back to the originator of the trace, with a payload and its content type.
 *
 * @param content        the payload
 * @param mime           the content type of the payload
 */
function replyToOrigin(content, contentType) {
    return postToRapids("$reply", { content, headers: { contentType } });
}
exports.replyToOrigin = replyToOrigin;
/**
 * Send a file back to the originator of the trace.
 *
 * @param path        the path to the file starting from the root of the service
 * @param mime        the content type of the file
 */
async function replyFileToOrigin(path, mime) {
    try {
        let realMime = mime !== undefined
            ? mime
            : (0, ext2mime_1.optimisticMimeTypeOf)(path.substring(path.lastIndexOf(".") + 1));
        if (realMime === null)
            throw "Unknown file type. Add mimeType argument.";
        await replyToOrigin(await promises_1.default.readFile(path), realMime);
    }
    catch (e) {
        throw e;
    }
}
exports.replyFileToOrigin = replyFileToOrigin;
/**
 * Subscribe to a channel, so events will stream back messages broadcast to that channel. You can join multiple channels. You stay in the channel until the request is terminated.
 *
 * Note: The origin-event has to be set as "streaming: true" in the event-catalogue.
 *
 * @param channel        the channel to join
 */
function joinChannel(channel) {
    return postToRapids("$join", channel);
}
exports.joinChannel = joinChannel;
/**
 * Broadcast a message (event and payload) to all listeners in a channel.
 *
 * @param to        the channel to broadcast to
 * @param event     the event-type of the message
 * @param payload   the payload of the message
 */
function broadcastToChannel(to, event, payload) {
    return postToRapids("$broadcast", { to, event, payload });
}
exports.broadcastToChannel = broadcastToChannel;
// export function sendToClient(to: string, event: string, payload: any) {
//   return postToRapids("$send", {
//     content: { to, event, payload },
//     mime: COMMON_MIME_TYPES.json[0],
//   });
// }
// export function requestFileThenEmit(
//   file: string,
//   emitEvent: string,
//   passthrough: any
// ) {
//   return postToRapids("$retrieve", {
//     content: { file, emit: emitEvent, passthrough },
//     mime: COMMON_MIME_TYPES.json[0],
//   });
// }
// export function storeFilesThenEmit(
//   contents: Buffer[],
//   emitEvent: string,
//   passthrough: any
// ) {
//   return postToRapids("$store", {
//     content: { contents, emit: emitEvent, passthrough },
//     mime: COMMON_MIME_TYPES.json[0],
//   });
// }
// export async function parseUploadFileInfo<T>(p: Promise<Buffer>) {
//   let result: PayloadTypes.UploadFileInfo<T> = JSON.parse((await p).toString());
//   return result;
// }
// export async function parseRetrieveFileContent<T>(p: Promise<Buffer>) {
//   let result: PayloadTypes.FileContent<T> = JSON.parse((await p).toString());
//   return { ...result, content: Buffer.from(result.content.data) };
// }
// export async function parseStoreFileContent<T>(p: Promise<Buffer>) {
//   let result: PayloadTypes.StoreFileInfo<T> = JSON.parse((await p).toString());
//   return result;
// }
function getPayload() {
    return new Promise((resolve, reject) => {
        let bufs = [];
        process.stdin.on("data", (data) => {
            bufs.push(data);
        });
        process.stdin.on("end", () => {
            resolve(Buffer.concat(bufs));
        });
    });
}
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
