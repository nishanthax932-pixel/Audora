import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../server.js";

async function withServer(environment, callback) {
  const server = createApp(environment).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); } finally { await new Promise((resolve) => server.close(resolve)); }
}

test("publishes safe white-label configuration", async () => {
  await withServer({ AUDORA_BRAND_NAME: "Northstar", AUDORA_ACCENT_COLOR: "#e85d75", AUDORA_MODELS: '[{"id":"provider-model","label":"Research"}]' }, async (url) => {
    const response = await fetch(`${url}/api/config`);
    assert.deepEqual(await response.json(), { brandName: "Northstar", tagline: "Your intelligent workspace", accentColor: "#e85d75", welcomeMessage: "How can I help you today?", models: [{ id: "provider-model", label: "Research" }] });
  });
});

test("rejects invalid messages before contacting a provider", async () => {
  await withServer({}, async (url) => {
    const response = await fetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [] }) });
    assert.equal(response.status, 400);
  });
});

test("reports a missing provider key without exposing one", async () => {
  await withServer({}, async (url) => {
    const response = await fetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /AUDORA_API_KEY/);
  });
});

test("uses a local Ollama model without a cloud API key", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (_url, options) => {
    upstreamRequest = options;
    return new Response(JSON.stringify({ message: { content: "Local answer" } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await withServer({ AUDORA_PROVIDER: "ollama", AUDORA_MODEL: "local-model" }, async (url) => {
      const response = await originalFetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: "local-model", messages: [{ role: "user", content: "Hello" }] }) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).message, "Local answer");
      assert.equal(JSON.parse(upstreamRequest.body).stream, false);
      assert.equal(upstreamRequest.headers.Authorization, undefined);
    });
  } finally { globalThis.fetch = originalFetch; }
});
