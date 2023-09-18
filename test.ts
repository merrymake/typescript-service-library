import {
  Envelope,
  MIME_TYPES,
  PayloadBufferPromise,
  merrymakeService,
  postToRapids,
  replyFileToOrigin,
  replyToOrigin,
} from ".";

async function foo(pbp: PayloadBufferPromise, env: Envelope) {
  let pb = await pbp.then((x) => x);
  let p = pb.toString();
  let mid = env.messageId;
  let tid = env.traceId;
  postToRapids("$reply", { content: "String", mime: MIME_TYPES.txt });
  postToRapids("custom");
  postToRapids("custom", { content: "String", mime: MIME_TYPES.txt });
  replyToOrigin("String", MIME_TYPES.txt);
  replyToOrigin({ msg: "Hello" }, MIME_TYPES.json);
  replyFileToOrigin("index.html");
}

merrymakeService(
  {
    foo,
  },
  async () => {
    console.log("Init");
  }
);
