import net from "net";

const LOG_INDENT = parseInt(process.env["LOG_INDENT"] || "2");
const JSON_PRINTER =
  LOG_INDENT === 0
    ? (o: any) => JSON.stringify(o)
    : (o: any) => JSON.stringify(o, null, LOG_INDENT);
enum LogLevel {
  Silly,
  Verbose,
  Debug,
  Info,
  Success,
  Warning,
  Failure,
  Silent,
}
const level: LogLevel =
  process.env.LOG_LEVEL !== undefined
    ? [
        "silly",
        "verbose",
        "debug",
        "info",
        "success",
        "warning",
        "error",
        "silent",
      ].indexOf(process.env.LOG_LEVEL.toLowerCase())
    : process.env.SILLY?.toLowerCase() === "true"
    ? LogLevel.Silly
    : process.env.VERBOSE?.toLowerCase() === "true"
    ? LogLevel.Verbose
    : process.env.DEBUG?.toLowerCase() === "true"
    ? LogLevel.Debug
    : process.env.INFO?.toLowerCase() === "true"
    ? LogLevel.Info
    : process.env.SUCCESS?.toLowerCase() === "true"
    ? LogLevel.Success
    : process.env.WARNING?.toLowerCase() === "true"
    ? LogLevel.Warning
    : process.env.FAILURE?.toLowerCase() === "true"
    ? LogLevel.Failure
    : process.env.SILENT?.toLowerCase() === "true"
    ? LogLevel.Silent
    : -1;
type LogInput = any;
class Logger {
  private print(st: NodeJS.WriteStream, obj: LogInput) {
    if (obj !== "")
      st.write(
        typeof obj === "string"
          ? obj
          : typeof obj === "number"
          ? obj.toString()
          : JSON_PRINTER(obj)
      );
    return this;
  }
  normal(obj: LogInput) {
    return this.print(process.stdout, obj);
  }
  newline(obj: LogInput = "") {
    return this.normal(obj).normal("\n");
  }
  private printCode(st: NodeJS.WriteStream, c: string) {
    return (obj: LogInput) =>
      this.print(st, c).print(st, obj).print(st, "\x1b[0m");
  }
  private printCodeNewline(st: NodeJS.WriteStream, c: string) {
    return (obj: LogInput) =>
      this.print(st, c).print(st, obj).print(st, "\x1b[0m\n");
  }
  readonly black = this.printCode(process.stdout, "\x1b[30m");
  readonly red = this.printCode(process.stdout, "\x1b[31m");
  readonly green = this.printCode(process.stdout, "\x1b[32m");
  readonly yellow = this.printCode(process.stdout, "\x1b[33m");
  readonly blue = this.printCode(process.stdout, "\x1b[34m");
  readonly purple = this.printCode(process.stdout, "\x1b[35m");
  readonly cyan = this.printCode(process.stdout, "\x1b[36m");
  readonly white = this.printCode(process.stdout, "\x1b[37m");
  readonly gray = this.printCode(process.stdout, "\x1b[90m");
  readonly silly =
    level <= LogLevel.Silly
      ? this.printCodeNewline(process.stdout, "\x1b[90m")
      : (o: LogInput) => this;
  readonly verbose =
    level <= LogLevel.Verbose
      ? this.printCodeNewline(process.stdout, "\x1b[37m")
      : (o: LogInput) => this;
  readonly debug =
    level <= LogLevel.Debug
      ? this.printCodeNewline(process.stdout, "\x1b[35m")
      : (o: LogInput) => this;
  readonly info =
    level <= LogLevel.Info
      ? this.printCodeNewline(process.stdout, "\x1b[34m")
      : (o: LogInput) => this;
  readonly succ =
    level <= LogLevel.Success
      ? this.printCodeNewline(process.stdout, "\x1b[32m")
      : (o: LogInput) => this;
  readonly warn =
    level <= LogLevel.Warning
      ? this.printCodeNewline(process.stderr, "\x1b[33m")
      : (o: LogInput) => this;
  readonly fail =
    level <= LogLevel.Failure
      ? this.printCodeNewline(process.stderr, "\x1b[31m")
      : (o: LogInput) => this;
}
export const Log = new Logger();

export class ContentType {
  // Videos
  static readonly avi = new ContentType("video", "x-msvideo");
  static readonly mp4 = new ContentType("video", "mp4");
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
  // Data
  static readonly gz = new ContentType("application", "gzip");
  static readonly tar = new ContentType("application", "x-tar");
  static readonly zip = new ContentType("application", "zip");
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
      content:
        | undefined
        | null
        | string
        | Record<symbol | number | string, unknown>
        | Array<unknown>;
      "content-type"?: ContentType;
    }
);
type Value = ReplyPayload["content"];

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
   * (Optional) Holds any unusual HTTP headers from the triggering HTTP call.
   *
   * _Note_: Always lowercase.
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
  toUndefined: () => T;
  toBuffer: (buf: Buffer) => T;
  toString: (buf: string) => T;
  toObject: (buf: Record<string | number | symbol, unknown>) => T;
  toArray: (buf: Array<unknown>) => T;
}
function valueTo<T>(value: Value, map: ValueMapper<T>): T {
  return value === null || value === undefined
    ? map.toUndefined()
    : Buffer.isBuffer(value)
    ? map.toBuffer(value)
    : typeof value === "string"
    ? map.toString(value)
    : Array.isArray(value)
    ? map.toArray(value)
    : map.toObject(value);
}

const to = {
  String: new (class implements ValueMapper<string> {
    toUndefined() {
      return "undefined";
    }
    toBuffer(val: Buffer) {
      return val.toString();
    }
    toString(val: string) {
      return val;
    }
    toObject(val: object) {
      return JSON.stringify(val);
    }
    toArray(val: Array<unknown>) {
      return JSON.stringify(val);
    }
  })(),
  Buffer: new (class implements ValueMapper<Buffer> {
    toUndefined() {
      return Buffer.alloc(0);
    }
    toBuffer(val: Buffer) {
      return val;
    }
    toString(val: string) {
      return Buffer.from(val);
    }
    toObject(val: object) {
      return Buffer.from(JSON.stringify(val));
    }
    toArray(val: Array<unknown>) {
      return Buffer.from(JSON.stringify(val));
    }
  })(),
  ContentType: new (class implements ValueMapper<ContentType | undefined> {
    toUndefined() {
      return undefined;
    }
    toBuffer(val: Buffer) {
      return ContentType.raw;
    }
    toString(val: string) {
      return ContentType.text;
    }
    toObject(val: object) {
      return ContentType.json;
    }
    toArray(val: Array<unknown>) {
      return ContentType.json;
    }
  })(),
};
function both<A, B>(
  va: ValueMapper<A>,
  vb: ValueMapper<B>
): ValueMapper<[A, B]> {
  return {
    toUndefined: () => [va.toUndefined(), vb.toUndefined()],
    toBuffer: (val) => [va.toBuffer(val), vb.toBuffer(val)],
    toString: (val) => [va.toString(val), vb.toString(val)],
    toObject: (val) => [va.toObject(val), vb.toObject(val)],
    toArray: (val) => [va.toArray(val), vb.toArray(val)],
  };
}

interface Environment<T> {
  readonly contentMapper: ValueMapper<T>;
  getInput(): Promise<[string, Envelope, Buffer]>;
  post(event: string, payload: Value): Promise<void>;
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
  async post(event: string, payload: Value) {
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
          Log.warn(
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
  post(event: string, payload: Value) {
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
    else if (action.length > 0)
      throw `Action '${action}' is not registered in merrymakeService`;
    else if (init !== undefined) await init().then();
  } catch (e) {
    Log.fail(e);
    process.exit(1);
  }
}

/**
 * Post an event to the central message queue (Rapids), with a payload and its content type.
 *
 * @param event       the event to post
 * @param payload     the payload with content type
 */
export function postToRapids(event: string, payload?: Value) {
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

export async function processFanIn(
  payloadBuffer: Buffer,
  handlers: {
    [key: string]: (payloadBuffer: Buffer) => unknown | Promise<unknown>;
  }
) {
  const toProcess: { event: string; payload: string }[] = JSON.parse(
    payloadBuffer.toString()
  );
  for (let i = 0; i < toProcess.length; i++) {
    const { event, payload } = toProcess[i];
    const handler = handlers[event];
    if (handler !== undefined) await handler(Buffer.from(payload));
  }
}
