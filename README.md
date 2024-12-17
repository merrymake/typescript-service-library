# Typescript Service Library for Merrymake

This is the official Typescript service library for [Merrymake](https://www.merrymake.eu). It defines all the basic functions needed to work with Merrymake.

## Usage

Here is the most basic example of how to use this library:

```ts
import {
  ContentType,
  merrymakeService,
  replyToOrigin,
} from "@merrymake/service";

async function handleHello(payloadBuffer: Buffer) {
  const payload = payloadBuffer.toString();
  replyToOrigin({
    content: `Hello, ${payload}!`,
    "content-type": ContentType.text,
  });
}

merrymakeService({
  handleHello,
});
```

## Tutorials and templates

For more information check out our tutorials at [merrymake.dev](https://merrymake.dev).

All templates are available through our CLI and on our [GitHub](https://github.com/merrymake).
