# Typescript Service Library for Merrymake

This is the official Typescript service library for Merrymake. It defines all the basic functions needed to work with Merrymake.

## Usage

Here is the most basic example of how to use this library: 

```ts
import {
  merrymakeService,
  type PayloadBufferPromise,
  MIME_TYPES,
  replyToOrigin,
  Envelope,
} from "@merrymake/service";

async function handleHello(payloadBufferPromise: PayloadBufferPromise, envelope: Envelope) {
  let payloadBuffer = await payloadBufferPromise;
  let payload = payloadBuffer.toString();
  replyToOrigin(`Hello, ${payload}!`, MIME_TYPES.txt);
}

merrymakeService({
  handleHello,
});
```

## Tutorials and templates

For more information check out our tutorials at [merrymake.dev](https://merrymake.dev).

All templates are available through our CLI and on our [GitHub](https://github.com/merrymake).
