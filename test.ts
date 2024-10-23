import {
  merrymakeService,
  MIME_TYPES,
  replyToOrigin,
  Envelope,
  postToRapids,
} from "./index";

async function handleHello(payloadBuffer: Buffer, envelope: Envelope) {
  let payload = payloadBuffer.toString();
  replyToOrigin(`Hello, ${payload}!`, { contentType: MIME_TYPES.txt });
}

merrymakeService({
  handleHello,
});

async function foo(pb: Buffer, env: Envelope) {
  let p = pb.toString();
  let mid = env.messageId;
  let tid = env.traceId;
  let sid = env.sessionId;
  postToRapids("$reply", { content: "String", mime: MIME_TYPES.txt });
  postToRapids("custom");
  postToRapids("custom", "String");
  replyToOrigin("String", { contentType: MIME_TYPES.txt });
  replyToOrigin(JSON.stringify({ msg: "Hello" }), {
    contentType: MIME_TYPES.json,
  });
}

merrymakeService(
  {
    foo,
  },
  async () => {
    console.log("Init");
  }
);
