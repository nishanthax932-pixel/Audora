import test from "node:test";
import assert from "node:assert/strict";
import { streamProviderResponse } from "../server.js";

function makeResponse() {
  const chunks = [];
  return {
    chunks,
    writableEnded: false,
    destroyed: false,
    statusCode: 0,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    set(headers) { Object.assign(this.headers, headers); return this; },
    flushHeaders() {},
    write(value) { chunks.push(value); return true; },
    end() { this.writableEnded = true; }
  };
}

function providerStream(lines) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    }
  });
}

function eventsFrom(response) {
  return response.chunks.map((chunk) => {
    const match = chunk.match(/^event: ([^\\n]+)\\ndata: (.+)\\n\\n$/);
    return match ? { event: match[1], data: JSON.parse(match[2]) } : null;
  }).filter(Boolean);
}

test("DeepSeek SSE streams text deltas and a final message", async () => {
  const response = makeResponse();
  const upstream = {
    body: providerStream([
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\\n',
      'data: {"choices":[{"delta":{"content":" Audora"}}]}\\n',
      "data: [DONE]\\n"
    ])
  };

  await streamProviderResponse(upstream, "deepseek", response, new AbortController().signal);

  const events = eventsFrom(response);
  assert.deepEqual(events.filter((item) => item.event === "delta").map((item) => item.data.text), ["Hello", " Audora"]);
  assert.equal(events.at(-1).event, "done");
  assert.equal(events.at(-1).data.message, "Hello Audora");
  assert.equal(response.writableEnded, true);
});

test("OpenAI-compatible SSE streaming remains supported", async () => {
  const response = makeResponse();
  const upstream = {
    body: providerStream(['data: {"choices":[{"delta":{"content":"Works"}}]}\\n', "data: [DONE]\\n"])
  };

  await streamProviderResponse(upstream, "compatible", response, new AbortController().signal);

  assert.equal(eventsFrom(response).at(-1).data.message, "Works");
});

test("Ollama newline-delimited JSON streaming remains supported", async () => {
  const response = makeResponse();
  const upstream = {
    body: providerStream(['{"message":{"content":"Local"}}\\n', '{"message":{"content":" model"}}\\n'])
  };

  await streamProviderResponse(upstream, "ollama", response, new AbortController().signal);

  assert.equal(eventsFrom(response).at(-1).data.message, "Local model");
});
