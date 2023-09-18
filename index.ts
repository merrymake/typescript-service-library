import {
  MimeType,
  COMMON_MIME_TYPES,
  optimisticMimeTypeOf,
} from "@merrymake/ext2mime";
import axios, { AxiosResponse } from "axios";
import fs from "fs/promises";

export module PayloadTypes {
  export interface UploadFileInfo<T> {
    files: { originalname: string; name: string; type: string; size: number }[];
    passthrough: T;
  }
  export interface StoreFileInfo<T> {
    files: string[];
    passthrough: T;
  }
  export interface FileContent<T> {
    content: { data: number[] };
    passthrough: T;
  }
}
export type PayloadBufferPromise = Promise<Buffer>;

type Handler = (
  payloadBuffer: PayloadBufferPromise,
  envelope: Envelope
) => void;

export type Envelope = { messageId: string; traceId: string };
export async function merrymakeService(
  handlers: { [action: string]: Handler | undefined },
  init?: () => Promise<void>
) {
  const action = process.argv[process.argv.length - 2];
  const handler = handlers[action];
  if (handler !== undefined) {
    const envelope: Envelope = JSON.parse(
      process.argv[process.argv.length - 1]
    );
    handler(getPayload(), envelope);
  } else if (init !== undefined) await init();
}

type RapidsResponse = AxiosResponse<any, any>;
export function postToRapids(
  event: "$reply",
  payload: { content: any; mime: MimeType<string, string> }
): Promise<RapidsResponse>;
export function postToRapids(
  event: "$join",
  payload: {
    content: string;
    mime: MimeType<"text", "plain">;
  }
): Promise<RapidsResponse>;
export function postToRapids(
  event: "$broadcast",
  payload: {
    content: { to: string; event: string; payload: any };
    mime: MimeType<"application", "json">;
  }
): Promise<RapidsResponse>;
export function postToRapids(
  event: "$send",
  payload: {
    content: { to: string; event: string; payload: any };
    mime: MimeType<"application", "json">;
  }
): Promise<RapidsResponse>;
export function postToRapids(
  event: "$retrieve",
  payload: {
    content: {
      file: string;
      emit: string;
      passthrough: any;
    };
    mime: MimeType<"application", "json">;
  }
): Promise<RapidsResponse>;
export function postToRapids(
  event: "$store",
  payload: {
    content: {
      contents: Buffer[];
      emit: string;
      passthrough: any;
    };
    mime: MimeType<"application", "json">;
  }
): Promise<RapidsResponse>;
export function postToRapids(
  event: string,
  payload?: { content: any; mime: MimeType<string, string> }
): Promise<RapidsResponse>;
export function postToRapids(
  event: string,
  payload?: { content: any; mime: MimeType<string, string> }
) {
  if (payload !== undefined) {
    return axios.post(`${process.env.RAPIDS}/${event}`, payload.content, {
      headers: { "Content-Type": payload.mime.toString() },
    });
  } else {
    return axios.post(`${process.env.RAPIDS}/${event}`);
  }
}
export function replyToOrigin(content: any, mime: MimeType<string, string>) {
  return postToRapids("$reply", { content, mime });
}
export async function replyFileToOrigin(
  path: string,
  mime?: MimeType<string, string>
) {
  try {
    let realMime =
      mime !== undefined
        ? mime
        : optimisticMimeTypeOf(path.substring(path.lastIndexOf(".") + 1));
    if (realMime === null) throw "Unknown file type. Add mimeType argument.";
    await postToRapids("$reply", {
      content: await fs.readFile(path),
      mime: realMime,
    });
  } catch (e) {
    throw e;
  }
}
export function joinChannel(channel: string) {
  return postToRapids("$join", {
    content: channel,
    mime: COMMON_MIME_TYPES.txt[0],
  });
}
export function broadcastToChannel(to: string, event: string, payload: any) {
  return postToRapids("$broadcast", {
    content: { to, event, payload },
    mime: COMMON_MIME_TYPES.json[0],
  });
}
export function sendToClient(to: string, event: string, payload: any) {
  return postToRapids("$send", {
    content: { to, event, payload },
    mime: COMMON_MIME_TYPES.json[0],
  });
}
export function requestFileThenEmit(
  file: string,
  emitEvent: string,
  passthrough: any
) {
  return postToRapids("$retrieve", {
    content: { file, emit: emitEvent, passthrough },
    mime: COMMON_MIME_TYPES.json[0],
  });
}
export function storeFilesThenEmit(
  contents: Buffer[],
  emitEvent: string,
  passthrough: any
) {
  return postToRapids("$store", {
    content: { contents, emit: emitEvent, passthrough },
    mime: COMMON_MIME_TYPES.json[0],
  });
}

export async function parseUploadFileInfo<T>(p: Promise<Buffer>) {
  let result: PayloadTypes.UploadFileInfo<T> = JSON.parse((await p).toString());
  return result;
}
export async function parseRetrieveFileContent<T>(p: Promise<Buffer>) {
  let result: PayloadTypes.FileContent<T> = JSON.parse((await p).toString());
  return { ...result, content: Buffer.from(result.content.data) };
}
export async function parseStoreFileContent<T>(p: Promise<Buffer>) {
  let result: PayloadTypes.StoreFileInfo<T> = JSON.parse((await p).toString());
  return result;
}

function getPayload() {
  return new Promise<Buffer>((resolve, reject) => {
    let bufs: Buffer[] = [];
    process.stdin.on("data", (data: Buffer) => {
      bufs.push(data);
    });
    process.stdin.on("end", () => {
      resolve(Buffer.concat(bufs));
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
