import net from "net";

export class ContentType {
  // Images
  static readonly gif = new ContentType("image", "gif");
  static readonly jpeg = new ContentType("image", "jpeg");
  static readonly png = new ContentType("image", "png");
  static readonly svg = new ContentType("image", "svg+xml");
  static readonly webp = new ContentType("image", "webp");
  // Strings
  static readonly csv = new ContentType("text", "csv");
  static readonly html = new ContentType("text", "html");
  static readonly json = new ContentType("application", "json");
  static readonly text = new ContentType("text", "plain");
  static readonly xml = new ContentType("application", "xml");
  // Unknown
  static readonly raw = new ContentType("application", "octet-stream");

  constructor(public readonly kind: string, public readonly name: string) {}
  toString() {
    return this.kind + "/" + this.name;
  }
}

type ReplyPayload = {
  "status-code"?: number;
  headers?: { [key: string]: string };
} & (
  | {
      content: Buffer;
      "content-type": ContentType;
    }
  | {
      content: undefined | null | string | object;
      "content-type"?: ContentType;
    }
);

type Handler = (payloadBuffer: Buffer, envelope: Envelope) => void;

export type Envelope = {
  /**
   * Id of this particular message.
   * Note: it is _not_ unique, since multiple rivers can deliver the same message.
   * The combination of (river, messageId) is unique.
   */
  messageId: string;
  /**
   * Id shared by all messages in the current trace, ie. stemming from the same
   * origin.
   */
  traceId: string;
  /**
   * (Optional) Id corresponding to a specific originator. This id is rotated occasionally,
   * but in the short term it is unique and consistent. Same sessionId implies
   * the trace originated from the same device.
   */
  sessionId?: string;
  /**
   * (Optional) Any custom HTTP headers passed to trigger this event
   */
  headers?: { [key: string]: string };
};

function numberToBuffer(n: number) {
  return Buffer.from([n >> 16, n >> 8, n >> 0]);
}
function bufferToNumber(bufs: Buffer) {
  return (bufs.at(0)! << 16) | (bufs.at(1)! << 8) | bufs.at(2)!;
}
function pack(...bufs: Buffer[]) {
  const result: Buffer[] = [];
  bufs.forEach((x) => result.push(numberToBuffer(x.length), x));
  return Buffer.concat(result);
}
function parseValue(buffer: Buffer) {
  const len = bufferToNumber(buffer);
  return [buffer.subarray(3, len + 3), buffer.subarray(len + 3)];
}

interface ValueMapper<T> {
  isUndefined: () => T;
  isBuffer: (buf: Buffer) => T;
  isString: (buf: string) => T;
  isObject: (buf: object) => T;
}
function valueTo<T>(
  value: undefined | null | Buffer | string | object,
  map: ValueMapper<T>
): T {
  return value === null || value === undefined
    ? map.isUndefined()
    : Buffer.isBuffer(value)
    ? map.isBuffer(value)
    : typeof value === "string"
    ? map.isString(value)
    : map.isObject(value);
}

const to = {
  String: new (class implements ValueMapper<string> {
    isUndefined() {
      return "undefined";
    }
    isBuffer(val: Buffer) {
      return val.toString();
    }
    isString(val: string) {
      return val;
    }
    isObject(val: object) {
      return JSON.stringify(val);
    }
  })(),
  Buffer: new (class implements ValueMapper<Buffer> {
    isUndefined() {
      return Buffer.alloc(0);
    }
    isBuffer(val: Buffer) {
      return val;
    }
    isString(val: string) {
      return Buffer.from(val);
    }
    isObject(val: object) {
      return Buffer.from(JSON.stringify(val));
    }
  })(),
  ContentType: new (class implements ValueMapper<ContentType | undefined> {
    isUndefined() {
      return undefined;
    }
    isBuffer(val: Buffer) {
      return ContentType.raw;
    }
    isString(val: string) {
      return ContentType.text;
    }
    isObject(val: object) {
      return ContentType.json;
    }
  })(),
};
function both<A, B>(
  va: ValueMapper<A>,
  vb: ValueMapper<B>
): ValueMapper<[A, B]> {
  return {
    isUndefined: () => [va.isUndefined(), vb.isUndefined()],
    isBuffer: (val) => [va.isBuffer(val), vb.isBuffer(val)],
    isString: (val) => [va.isString(val), vb.isString(val)],
    isObject: (val) => [va.isObject(val), vb.isObject(val)],
  };
}

interface Environment<T> {
  readonly contentMapper: ValueMapper<T>;
  getInput(): Promise<[string, Envelope, Buffer]>;
  post(
    event: string,
    payload: undefined | null | Buffer | string | object
  ): Promise<void>;
}
class RunningLocally implements Environment<string> {
  public readonly contentMapper = to.String;
  async getInput(): Promise<[string, Envelope, Buffer]> {
    return [
      process.argv[2],
      process.argv[4] && JSON.parse(process.argv[4]),
      process.argv.length > 3 ? Buffer.from(process.argv[3]) : Buffer.alloc(0),
    ];
  }
  async post(
    event: string,
    payload: undefined | null | Buffer | string | object
  ) {
    console.log(event + ": " + valueTo(payload, to.String));
  }
}
class RunningInMerrymake implements Environment<Buffer> {
  public readonly contentMapper = to.Buffer;
  async getInput() {
    return new Promise<[string, Envelope, Buffer]>((resolve, reject) => {
      const bufs: Buffer[] = [];
      process.addListener("SIGINT", () => {
        if (bufs.length === 0) {
          console.log(
            `No input. If you want to run locally use:\n  node app handleHello "payload" '{ "messageId": "mId", "traceId": "tId", "sessionId": "sId", "headers": { "a": "1" } }'`
          );
          process.exit(0);
        }
      });
      process.stdin.on("data", (data: Buffer) => {
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
  post(event: string, payload: undefined | null | Buffer | string | object) {
    const packed = pack(Buffer.from(event), valueTo(payload, to.Buffer));
    const client = new net.Socket();
    const [host, port] = process.env.RAPIDS!.split(":");
    return new Promise<void>((resolve) => {
      client.connect(+port, host, async () => {
        client.write(packed);
        client.end();
        resolve();
      });
    });
  }
}

const environment: Environment<unknown> =
  process.argv.length > 2 ? new RunningLocally() : new RunningInMerrymake();

/**
 * This is the root call for a Merrymake service.
 *
 * @param handlers Used to link actions in the merrymake.json file to code.
 * @param init Used to define code to run after deployment but before release.
 * Useful for smoke tests or database consolidation. Similar to an 'init container'
 */
export async function merrymakeService(
  handlers: { [action: string]: Handler | undefined },
  init?: () => Promise<void>
) {
  try {
    const [action, envelope, payload] = await environment.getInput();
    const handler = handlers[action];
    if (handler !== undefined) handler(payload, envelope);
    else if (init !== undefined) await init().then();
  } catch (e) {
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
export function postToRapids(
  event: string,
  payload?: object | string | Buffer
) {
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
export function replyToOrigin(payload: ReplyPayload) {
  const [content, cType] = valueTo(
    payload["content"],
    both(environment.contentMapper, to.ContentType)
  );
  const postPayload = {
    ...payload,
    content,
    "content-type": (payload["content-type"] !== undefined
      ? payload["content-type"]
      : cType
    )?.toString(),
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
export function joinChannel(channel: string) {
  postToRapids("$join", channel);
}

/**
 * Broadcast a message (event and payload) to all listeners in a channel.
 *
 * @param msg the channel to broadcast to, event-type of the message, and payload of the message
 */
export function broadcastToChannel(msg: {
  to: string;
  event: string;
  payload: string;
}) {
  postToRapids("$broadcast", msg);
}
