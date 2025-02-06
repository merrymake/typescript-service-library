import { Log, processFanIn } from ".";

const payloadBuffer = Buffer.from(
  JSON.stringify([
    { event: "hello", payload: Buffer.from("Christian") },
    { event: "hej", payload: Buffer.from("Hanni") },
  ])
);
(async () => {
  Log.newline(JSON.parse(payloadBuffer.toString()));
  await processFanIn(payloadBuffer, {
    hello: (payloadBuffer) => Log.info(`Hello ${payloadBuffer.toString()}`),
  });
})();
