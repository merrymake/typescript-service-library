import { Envelope, merrymakeService } from "./index";

async function foo(pb: Buffer, env: Envelope) {
  throw "Crash";
}

merrymakeService({
  foo,
});
