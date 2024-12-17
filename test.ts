import {
  merrymakeService,
  replyToOrigin,
  Envelope,
  postToRapids,
  ContentType,
} from "./index";
import fs from "fs";

async function foo(pb: Buffer, env: Envelope) {
  const p = pb.toString();
  const mid = env.messageId;
  const tid = env.traceId;
  const sid = env.sessionId;
  const headers = env.headers && env.headers["x-discord"];
  postToRapids("$reply", {
    content: "String",
    "content-type": ContentType.text,
  });
  postToRapids("custom");
  postToRapids("custom", "String");
  replyToOrigin({
    content: "String",
  });
  replyToOrigin({
    content: { msg: "Hello" },
    "status-code": 5,
    headers: { chr: "abc" },
  });
  replyToOrigin({
    content: fs.readFileSync("meme.png"),
    "content-type": ContentType.png,
    "status-code": 201,
    headers: { "custom-header": "is cool" },
  });

  // Should fail
  // replyToOrigin({
  //   content: fs.readFileSync("meme.png"),
  //   "status-code": 201,
  //   headers: { "custom-header": "is cool" },
  // });
}

merrymakeService(
  {
    foo,
  },
  async () => {
    console.log("Init");
  }
);
