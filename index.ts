import { MimeType, COMMON_MIME_TYPES } from "@merrymake/ext2mime";
import net from "net";

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
};

/**
 * This is the root call for a Merrymake service.
 *
 * @param handlers Used to link actions in the Merrymake.json file to code.
 * @param init Used to define code to run after deployment but before release. Useful for smoke tests or database consolidation. Similar to an 'init container'
 */
export async function merrymakeService(
  handlers: { [action: string]: Handler | undefined },
  init?: () => Promise<void>
) {
  try {
    const [action, envelope, payload] = await getActionAndPayload();
    const handler = handlers[action];
    if (handler !== undefined) await handler(payload, envelope);
    else if (init !== undefined) await init();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

export function postToRapids(
  event: "$reply",
  payload: { content: any; headers: { contentType: MimeType<string, string> } }
): Promise<void>;
export function postToRapids(
  event: string,
  payload?: object | string | Buffer
): Promise<void>;
/**
 * Post an event to the central message queue (Rapids), with a payload and its content type.
 *
 * @param event       the event to post
 * @param payload     the payload with content type
 */
export function postToRapids(event: string, payload?: any) {
  if (event === "$reply") {
    payload.headers.contentType = payload.headers.contentType.toString();
  }
  const packed = pack(
    Buffer.from(event),
    Buffer.from(
      Buffer.isBuffer(payload)
        ? payload
        : payload instanceof Object
        ? JSON.stringify(payload)
        : payload || ""
    )
  );
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

/**
 * Post a reply back to the originator of the trace, with a payload and its content type.
 *
 * @param content        the payload
 * @param mime           the content type of the payload
 */
export function replyToOrigin(
  content: any,
  headers: { contentType: MimeType<string, string> }
) {
  return postToRapids("$reply", { content, headers });
}

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

function getActionAndPayload() {
  return new Promise<[string, Envelope, Buffer]>((resolve, reject) => {
    const bufs: Buffer[] = [];
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

function mapValues<T extends { [key: string]: any }>(
  obj: T
): { [key in keyof T]: T[key][0] } {
  let result: { [key: string]: any } = {};
  Object.keys(obj).forEach((k) => (result[k] = obj[k][0]));
  return result as { [key in keyof T]: T[key] };
}

export const MIME_TYPES = mapValues(COMMON_MIME_TYPES);
