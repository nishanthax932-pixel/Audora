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
    assert.deepEqual(await response.json(), { brandName: "Northstar", tagline: "Your intelligent workspace", accentColor: "#e85d75", welcomeMessage: "How can I help you today?", searchEnabled: false, models: [{ id: "provider-model", label: "Research" }] });
  });
});

test("defaults to local self-hosted inference and never falls back to a third-party free model", async () => {
  await withServer({}, async (url) => {
    const health = await (await fetch(`${url}/api/health`)).json();
    assert.equal(health.provider, "compatible");
    assert.equal(health.providerConfigured, false);
    const response = await fetch(`${url}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] })
    });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /local inference server/i);
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

test("returns JSON rather than an HTML page for unknown API routes", async () => {
  await withServer({}, async (url) => {
    const response = await fetch(`${url}/api/not-real`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Audora API route not found." });
  });
});


test("rate limits each client independently", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://provider.invalid/")) {
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };
  try {
    await withServer({ AUDORA_PROVIDER: "compatible", AUDORA_API_URL: "https://provider.invalid/chat", AUDORA_API_KEY: "test-only", AUDORA_RATE_LIMIT_MAX: "1", AUDORA_TRUST_PROXY: "1" }, async (url) => {
      const send = (ip) => originalFetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) });
      assert.equal((await send("198.51.100.10")).status, 200);
      assert.equal((await send("198.51.100.10")).status, 429);
      assert.equal((await send("198.51.100.11")).status, 200);
    });
  } finally { globalThis.fetch = originalFetch; }
});

test("returns safe JSON for malformed request bodies", async () => {
  await withServer({}, async (url) => {
    const response = await fetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Request body must contain valid JSON." });
  });
});

test("does not expose raw hosted-provider error details", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://provider.invalid/")) {
      return new Response(JSON.stringify({ error: { message: "secret account token and internal endpoint" } }), { status: 401, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };
  try {
    await withServer({ AUDORA_PROVIDER: "compatible", AUDORA_API_URL: "https://provider.invalid/chat", AUDORA_API_KEY: "test-only" }, async (url) => {
      const response = await originalFetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) });
      assert.equal(response.status, 401);
      const body = await response.json();
      assert.doesNotMatch(body.error, /secret account token|internal endpoint/);
    });
  } finally { globalThis.fetch = originalFetch; }
});


test("does not trust spoofed forwarded IP headers by default", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://provider.invalid/")) {
      return new Response(JSON.stringify({ choices: [{ message: { content: "OK" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };
  try {
    await withServer({ AUDORA_PROVIDER: "compatible", AUDORA_API_URL: "https://provider.invalid/chat", AUDORA_API_KEY: "test-only", AUDORA_RATE_LIMIT_MAX: "1" }, async (url) => {
      const send = (ip) => originalFetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": ip }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }] }) });
      assert.equal((await send("198.51.100.10")).status, 200);
      assert.equal((await send("198.51.100.11")).status, 429);
    });
  } finally { globalThis.fetch = originalFetch; }
});


test("sets baseline browser security headers", async () => {
  await withServer({}, async (url) => {
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("x-frame-options"), "DENY");
    assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("allows only explicitly configured browser origins", async () => {
  await withServer({ AUDORA_ALLOWED_ORIGINS: "https://app.example.test" }, async (url) => {
    const allowed = await fetch(`${url}/api/config`, { headers: { Origin: "https://app.example.test" } });
    const denied = await fetch(`${url}/api/config`, { headers: { Origin: "https://evil.example.test" } });
    assert.equal(allowed.headers.get("access-control-allow-origin"), "https://app.example.test");
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
  });
});


test("enables detailed visible explanations when Brain mode is selected", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://provider.invalid/")) {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: "Detailed answer" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };
  try {
    await withServer({ AUDORA_PROVIDER: "compatible", AUDORA_API_URL: "https://provider.invalid/chat", AUDORA_API_KEY: "test-only" }, async (url) => {
      const response = await originalFetch(`${url}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Solve this carefully" }], reasoning: true })
      });
      assert.equal(response.status, 200);
      assert.match(requestBody.messages[0].content, /detailed explanation mode/i);
      assert.match(requestBody.messages[0].content, /intermediate calculations/i);
      assert.match(requestBody.messages[0].content, /Do not reveal private internal chain-of-thought/i);
    });
  } finally { globalThis.fetch = originalFetch; }
});

test("passes bounded user memory to the hosted model system context", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let requestBody;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://provider.invalid/")) {
      requestBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ choices: [{ message: { content: "Remembered answer" } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };
  try {
    await withServer({ AUDORA_PROVIDER: "compatible", AUDORA_API_URL: "https://provider.invalid/chat", AUDORA_API_KEY: "test-only" }, async (url) => {
      const response = await originalFetch(`${url}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ role: "user", content: "Hello" }], memory: "User is building Audora" }) });
      assert.equal(response.status, 200);
      assert.match(requestBody.messages[0].content, /User is building Audora/);
    });
  } finally { globalThis.fetch = originalFetch; }
});


test("keeps image generation disabled until the self-hosted model is configured", async () => {
  await withServer({}, async (url) => {
    const response = await fetch(`${url}/api/image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "A blue futuristic city" }) });
    assert.equal(response.status, 503);
    assert.match((await response.json()).error, /self-hosted image model is not configured/i);
  });
});

test("proxies image generation only to the configured self-hosted engine", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let upstreamOptions;
  globalThis.fetch = async (url, options) => {
    if (String(url) === "http://image.local/generate") {
      upstreamOptions = options;
      return new Response(JSON.stringify({ image: "aGVsbG8=" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };
  try {
    await withServer({ AUDORA_IMAGE_API_URL: "http://image.local/generate", AUDORA_IMAGE_API_KEY: "local-test-key" }, async (url) => {
      const response = await originalFetch(`${url}/api/image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: "A blue futuristic city" }) });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).image, "data:image/png;base64,aGVsbG8=");
      assert.equal(upstreamOptions.headers.Authorization, "Bearer local-test-key");
      assert.equal(JSON.parse(upstreamOptions.body).prompt, "A blue futuristic city");
    });
  } finally { globalThis.fetch = originalFetch; }
});


test("streams compatible-provider tokens as server-sent events", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (String(url) === "https://provider.invalid/stream") {
      assert.equal(JSON.parse(options.body).stream, true);
      return new Response('data: {"choices":[{"delta":{"content":"Hello "}}]}\n\ndata: {"choices":[{"delta":{"content":"Audora"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { "Content-Type": "text/event-stream" }
      });
    }
    return originalFetch(url, options);
  };
  try {
    await withServer({
      AUDORA_PROVIDER: "compatible",
      AUDORA_API_URL: "https://provider.invalid/stream",
      AUDORA_API_KEY: "test-only"
    }, async (url) => {
      const response = await originalFetch(`${url}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "Say hello" }], stream: true })
      });
      assert.equal(response.status, 200);
      assert.ok(response.headers.get("content-type").includes("text/event-stream"));
      const body = await response.text();
      assert.match(body, /event: delta/);
      assert.match(body, /Hello /);
      assert.match(body, /Audora/);
      assert.match(body, /event: done/);
      assert.match(body, /"message":"Hello Audora"/);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});


test("uses configured SearXNG search and filters unsafe result URLs", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  let upstreamUrl;
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("http://search.local/search")) {
      upstreamUrl = new URL(String(url));
      return new Response(JSON.stringify({ results: [
        { title: "Audora docs", url: "https://example.test/audora", content: "Official documentation" },
        { title: "Unsafe result", url: "javascript:alert(1)", content: "Must be removed" }
      ] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };
  try {
    await withServer({ AUDORA_SEARCH_URL: "http://search.local/search" }, async (url) => {
      const response = await originalFetch(`${url}/api/search?q=Audora%20AI`);
      assert.equal(response.status, 200);
      assert.equal(upstreamUrl.searchParams.get("q"), "Audora AI");
      assert.equal(upstreamUrl.searchParams.get("format"), "json");
      const payload = await response.json();
      assert.equal(payload.results.length, 1);
      assert.equal(payload.results[0].url, "https://example.test/audora");
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
