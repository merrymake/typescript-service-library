"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MIME_TYPES = exports.parseStoreFileContent = exports.parseRetrieveFileContent = exports.parseUploadFileInfo = exports.storeFilesThenEmit = exports.requestFileThenEmit = exports.sendToClient = exports.broadcastToChannel = exports.joinChannel = exports.replyFileToOrigin = exports.replyToOrigin = exports.postToRapids = exports.merrymakeService = void 0;
const ext2mime_1 = require("@merrymake/ext2mime");
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
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
function replyToOrigin(content, mime) {
    return postToRapids("$reply", { content, mime });
}
exports.replyToOrigin = replyToOrigin;
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
function joinChannel(channel) {
    return postToRapids("$join", {
        content: channel,
        mime: ext2mime_1.COMMON_MIME_TYPES.txt[0],
    });
}
exports.joinChannel = joinChannel;
function broadcastToChannel(to, event, payload) {
    return postToRapids("$broadcast", {
        content: { to, event, payload },
        mime: ext2mime_1.COMMON_MIME_TYPES.json[0],
    });
}
exports.broadcastToChannel = broadcastToChannel;
function sendToClient(to, event, payload) {
    return postToRapids("$send", {
        content: { to, event, payload },
        mime: ext2mime_1.COMMON_MIME_TYPES.json[0],
    });
}
exports.sendToClient = sendToClient;
function requestFileThenEmit(file, emitEvent, passthrough) {
    return postToRapids("$retrieve", {
        content: { file, emit: emitEvent, passthrough },
        mime: ext2mime_1.COMMON_MIME_TYPES.json[0],
    });
}
exports.requestFileThenEmit = requestFileThenEmit;
function storeFilesThenEmit(contents, emitEvent, passthrough) {
    return postToRapids("$store", {
        content: { contents, emit: emitEvent, passthrough },
        mime: ext2mime_1.COMMON_MIME_TYPES.json[0],
    });
}
exports.storeFilesThenEmit = storeFilesThenEmit;
async function parseUploadFileInfo(p) {
    let result = JSON.parse((await p).toString());
    return result;
}
exports.parseUploadFileInfo = parseUploadFileInfo;
async function parseRetrieveFileContent(p) {
    let result = JSON.parse((await p).toString());
    return { ...result, content: Buffer.from(result.content.data) };
}
exports.parseRetrieveFileContent = parseRetrieveFileContent;
async function parseStoreFileContent(p) {
    let result = JSON.parse((await p).toString());
    return result;
}
exports.parseStoreFileContent = parseStoreFileContent;
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
