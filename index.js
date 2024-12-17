"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentType = void 0;
exports.merrymakeService = merrymakeService;
exports.postToRapids = postToRapids;
exports.replyToOrigin = replyToOrigin;
exports.joinChannel = joinChannel;
exports.broadcastToChannel = broadcastToChannel;
const net_1 = __importDefault(require("net"));
class ContentType {
    kind;
    name;
    // Videos
    static avi = new ContentType("video", "x-msvideo");
    static mp4 = new ContentType("video", "mp4");
    // Images
    static gif = new ContentType("image", "gif");
    static jpeg = new ContentType("image", "jpeg");
    static png = new ContentType("image", "png");
    static svg = new ContentType("image", "svg+xml");
    static webp = new ContentType("image", "webp");
    // Strings
    static csv = new ContentType("text", "csv");
    static html = new ContentType("text", "html");
    static json = new ContentType("application", "json");
    static text = new ContentType("text", "plain");
    static xml = new ContentType("application", "xml");
    // Data
    static gz = new ContentType("application", "gzip");
    static tar = new ContentType("application", "x-tar");
    static zip = new ContentType("application", "zip");
    // Unknown
    static raw = new ContentType("application", "octet-stream");
    constructor(kind, name) {
        this.kind = kind;
        this.name = name;
    }
    toString() {
        return this.kind + "/" + this.name;
    }
}
exports.ContentType = ContentType;
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
function valueTo(value, map) {
    return value === null || value === undefined
        ? map.isUndefined()
        : Buffer.isBuffer(value)
            ? map.isBuffer(value)
            : typeof value === "string"
                ? map.isString(value)
                : map.isObject(value);
}
const to = {
    String: new (class {
        isUndefined() {
            return "undefined";
        }
        isBuffer(val) {
            return val.toString();
        }
        isString(val) {
            return val;
        }
        isObject(val) {
            return JSON.stringify(val);
        }
    })(),
    Buffer: new (class {
        isUndefined() {
            return Buffer.alloc(0);
        }
        isBuffer(val) {
            return val;
        }
        isString(val) {
            return Buffer.from(val);
        }
        isObject(val) {
            return Buffer.from(JSON.stringify(val));
        }
    })(),
    ContentType: new (class {
        isUndefined() {
            return undefined;
        }
        isBuffer(val) {
            return ContentType.raw;
        }
        isString(val) {
            return ContentType.text;
        }
        isObject(val) {
            return ContentType.json;
        }
    })(),
};
function both(va, vb) {
    return {
        isUndefined: () => [va.isUndefined(), vb.isUndefined()],
        isBuffer: (val) => [va.isBuffer(val), vb.isBuffer(val)],
        isString: (val) => [va.isString(val), vb.isString(val)],
        isObject: (val) => [va.isObject(val), vb.isObject(val)],
    };
}
class RunningLocally {
    contentMapper = to.String;
    async getInput() {
        return [
            process.argv[2],
            process.argv[4] && JSON.parse(process.argv[4]),
            process.argv.length > 3 ? Buffer.from(process.argv[3]) : Buffer.alloc(0),
        ];
    }
    async post(event, payload) {
        console.log(event + ": " + valueTo(payload, to.String));
    }
}
class RunningInMerrymake {
    contentMapper = to.Buffer;
    async getInput() {
        return new Promise((resolve, reject) => {
            const bufs = [];
            process.addListener("SIGINT", () => {
                if (bufs.length === 0) {
                    console.log(`No input. If you want to run locally use:\n  node app handleHello "payload" '{ "messageId": "mId", "traceId": "tId", "sessionId": "sId", "headers": { "a": "1" } }'`);
                    process.exit(0);
                }
            });
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
    post(event, payload) {
        const packed = pack(Buffer.from(event), valueTo(payload, to.Buffer));
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
}
const environment = process.argv.length > 2 ? new RunningLocally() : new RunningInMerrymake();
/**
 * This is the root call for a Merrymake service.
 *
 * @param handlers Used to link actions in the merrymake.json file to code.
 * @param init Used to define code to run after deployment but before release.
 * Useful for smoke tests or database consolidation. Similar to an 'init container'
 */
async function merrymakeService(handlers, init) {
    try {
        const [action, envelope, payload] = await environment.getInput();
        const handler = handlers[action];
        if (handler !== undefined)
            handler(payload, envelope);
        else if (init !== undefined)
            await init().then();
    }
    catch (e) {
        console.error(e);
        process.exit(1);
    }
}
/**
 * Post an event to the central message queue (Rapids), with a payload and its content type.
 *
 * @param event       the event to post
 * @param payload     the payload with content type
 */
function postToRapids(event, payload) {
    return environment.post(event, payload);
}
/**
 * Post a reply back to the user who triggered this trace. The payload is sent
 * back using HTTP and therefore requires a content-type. For strings and json
 * objects the content-type can be omitted. You can optionally supply custom
 * headers and status-code if needed. Unless a status-code is supplied the
 * platform always returns code "200 Ok", even if the trace has failing
 * services.
 *
 * Example:
 * ```
 * replyToOrigin({
 *   content: fs.readFileSync("meme.png"),
 *   "content-type": ContentType.png,
 *   "status-code": 201,
 *   headers: { "custom-header": "is cool" }
 * });
 * ```
 *
 * @param payload content, content-type, status-code, and headers
 */
function replyToOrigin(payload) {
    const [content, cType] = valueTo(payload["content"], both(environment.contentMapper, to.ContentType));
    const postPayload = {
        ...payload,
        content,
        "content-type": (payload["content-type"] !== undefined
            ? payload["content-type"]
            : cType)?.toString(),
    };
    return postToRapids("$reply", postPayload);
}
/**
 * Subscribe to a channel, so events will stream back messages broadcast to that
 * channel. You can join multiple channels. You stay in the channel until the
 * request is terminated.
 *
 * Note: The origin-event has to be set as "streaming: true" in the
 * event-catalogue.
 *
 * @param channel the channel to join
 */
function joinChannel(channel) {
    postToRapids("$join", channel);
}
/**
 * Broadcast a message (event and payload) to all listeners in a channel.
 *
 * @param msg the channel to broadcast to, event-type of the message, and payload of the message
 */
function broadcastToChannel(msg) {
    postToRapids("$broadcast", msg);
}
