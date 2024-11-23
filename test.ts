import {
  merrymakeService,
  replyToOrigin,
  Envelope,
  postToRapids,
  ContentType,
} from "./index";
import fs from "fs";

async function foo(pb: Buffer, env: Envelope) {
  let p = pb.toString();
  let mid = env.messageId;
  let tid = env.traceId;
  let sid = env.sessionId;
  let headers = env.headers && env.headers["x-discord"];
  postToRapids("$reply", {
    content: "String",
    "content-type": ContentType.text,
  });
  postToRapids("custom");
  postToRapids("custom", "String");
  replyToOrigin({
    content: "String",
    "content-type": ContentType.text,
  });
  replyToOrigin({
    content: JSON.stringify({ msg: "Hello" }),
    "content-type": ContentType.text,
    "status-code": 5,
    headers: { chr: "abc" },
  });
  replyToOrigin({
    content: fs.readFileSync("meme.png"),
    "content-type": ContentType.png,
    "status-code": 201,
    headers: { "custom-header": "is cool" },
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
