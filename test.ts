import {
  Envelope,
  MIME_TYPES,
  merrymakeService,
  postToRapids,
  replyFileToOrigin,
  replyToOrigin,
} from ".";

async function foo(pb: Buffer, env: Envelope) {
  let p = pb.toString();
  let mid = env.messageId;
  let tid = env.traceId;
  let sid = env.sessionId;
  postToRapids("$reply", { content: "String", mime: MIME_TYPES.txt });
  postToRapids("custom");
  postToRapids("custom", "String");
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
