"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIME_TYPES = exports.broadcastToChannel = exports.joinChannel = exports.replyFileToOrigin = exports.replyToOrigin = exports.postToRapids = exports.merrymakeService = void 0;
const ext2mime_1 = require("@merrymake/ext2mime");
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
/**
 * This is the root call for a Merrymake service.
 *
 * @param handlers Used to link actions in the Merrymake.json file to code.
 * @param init Used to define code to run after deployment but before release. Useful for smoke tests or database consolidation. Similar to an 'init container'
 */
async function merrymakeService(handlers, init) {
    const action = process.argv[process.argv.length - 2];
    const handler = handlers[action];
    if (handler !== undefined) {
        const envelope = JSON.parse(process.argv[process.argv.length - 1]);
        handler(getPayload(), envelope);
    }
    else if (init !== undefined)
        await init();
}
exports.merrymakeService = merrymakeService;
/**
 * Post an event to the central message queue (Rapids), with a payload and its content type.
 *
 * @param event       the event to post
 * @param payload     the payload with content type
 */
function postToRapids(event, payload) {
    if (payload !== undefined) {
        return axios_1.default.post(`${process.env.RAPIDS}/${event}`, payload.content, {
            headers: { "Content-Type": payload.mime.toString() },
        });
    }
    else {
        return axios_1.default.post(`${process.env.RAPIDS}/${event}`);
    }
}
exports.postToRapids = postToRapids;
/**
 * Post a reply back to the originator of the trace, with a payload and its content type.
 *
 * @param content        the payload
 * @param mime           the content type of the payload
 */
function replyToOrigin(content, mime) {
    return postToRapids("$reply", { content, mime });
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
        await postToRapids("$reply", {
            content: await promises_1.default.readFile(path),
            mime: realMime,
        });
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
    return postToRapids("$join", {
        content: channel,
        mime: ext2mime_1.COMMON_MIME_TYPES.txt[0],
    });
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
    return postToRapids("$broadcast", {
        content: { to, event, payload },
        mime: ext2mime_1.COMMON_MIME_TYPES.json[0],
    });
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
function mapValues(obj) {
    let result = {};
    Object.keys(obj).forEach((k) => (result[k] = obj[k][0]));
    return result;
}
exports.MIME_TYPES = mapValues(ext2mime_1.COMMON_MIME_TYPES);
