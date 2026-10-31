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
  await withServer({ AUDORA_PROVIDER: "compatible" }, async (url) => {
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

test("answers out of the box through the free provider without any API key", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let upstreamRequest;
  globalThis.fetch = async (_url, options) => {
    upstreamRequest = options;
    return new Response(JSON.stringify({ choices: [{ message: { content: "Free tier answer" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    await withServer({}, async (url) => {
      const health = await (await originalFetch(`${url}/api/health`)).json();
      assert.equal(health.provider, "free");
      assert.equal(health.providerConfigured, true);
      const response = await originalFetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).message, "Free tier answer");
      assert.equal(upstreamRequest.headers.Authorization, undefined);
    });
  } finally { globalThis.fetch = originalFetch; }
});

test("explains when the free tier is busy instead of looping", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ error: { message: "Free limit reached: get a key at https://example.invalid/upsell" } }), { status: 402, headers: { "Content-Type": "application/json" } }); };
  try {
    await withServer({}, async (url) => {
      const response = await originalFetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) });
      assert.equal(response.status, 502);
      const body = await response.json();
      assert.doesNotMatch(body.error, /example\.invalid|key|limit/i);
      assert.match(body.error, /try again/);
      assert.equal(calls, 1);
    });
  } finally { globalThis.fetch = originalFetch; }
});

test("spaces free-tier calls instead of hammering the provider", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response(JSON.stringify({ choices: [{ message: { content: "Answer" } }] }), { status: 200, headers: { "Content-Type": "application/json" } }); };
  try {
    await withServer({}, async (url) => {
      const first = await originalFetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "One" }] }) });
      assert.equal(first.status, 200);
      const second = await originalFetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Two" }] }) });
      assert.equal(second.status, 429);
      assert.match((await second.json()).error, /one reply per minute/);
      assert.equal(calls, 1);
    });
  } finally { globalThis.fetch = originalFetch; }
});

test("returns JSON rather than an HTML page for unknown API routes", async () => {
  await withServer({}, async (url) => {
    const response = await fetch(`${url}/api/not-real`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Audora API route not found." });
  });
});
