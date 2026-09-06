import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
function readModels(value, fallbackModel) {
  if (!value) return [{ id: fallbackModel, label: "Audora Core" }];
  try {
    const models = JSON.parse(value);
    if (Array.isArray(models) && models.every((model) => typeof model?.id === "string" && typeof model?.label === "string")) {
      return models.map((model) => ({ id: model.id.slice(0, 120), label: model.label.slice(0, 80) }));
    }
  } catch { /* Legacy comma-separated values are supported below. */ }
  return value.split(",").map((id) => id.trim()).filter(Boolean).map((id) => ({ id, label: id }));
}

function getSettings(environment = process.env) {
  const fallbackModel = environment.AUDORA_MODEL || "gpt-4.1-mini";
  const models = readModels(environment.AUDORA_MODELS, fallbackModel);
  return {
    brandName: (environment.AUDORA_BRAND_NAME || "Audora").slice(0, 80),
    tagline: (environment.AUDORA_BRAND_TAGLINE || "Your intelligent workspace").slice(0, 160),
    accentColor: /^#[0-9a-fA-F]{6}$/.test(environment.AUDORA_ACCENT_COLOR || "") ? environment.AUDORA_ACCENT_COLOR : "#10a37f",
    welcomeMessage: (environment.AUDORA_WELCOME_MESSAGE || "How can I help you today?").slice(0, 160),
    models: models.length ? models : [{ id: fallbackModel, label: "Audora Core" }],
    provider: environment.AUDORA_PROVIDER === "ollama" ? "ollama" : "compatible",
    apiKey: environment.AUDORA_API_KEY,
    apiUrl: environment.AUDORA_PROVIDER === "ollama" ? (environment.AUDORA_OLLAMA_URL || "http://127.0.0.1:11434/api/chat") : environment.AUDORA_API_URL,
    timeoutMs: Math.min(Math.max(Number(environment.AUDORA_REQUEST_TIMEOUT_MS || 60000), 1000), 120000),
    rateLimitMax: Math.min(Math.max(Number(environment.AUDORA_RATE_LIMIT_MAX || 30), 1), 10000),
    rateLimitWindowMs: Math.min(Math.max(Number(environment.AUDORA_RATE_LIMIT_WINDOW_MS || 60000), 1000), 3600000)
  };
}

function createRateLimiter(settings) {
  const visitors = new Map();
  return (request, response, next) => {
    const key = request.ip || request.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = visitors.get(key) || { count: 0, startedAt: now };
    if (now - record.startedAt >= settings.rateLimitWindowMs) Object.assign(record, { count: 0, startedAt: now });
    record.count += 1;
    visitors.set(key, record);
    response.setHeader("RateLimit-Limit", settings.rateLimitMax);
    response.setHeader("RateLimit-Remaining", Math.max(0, settings.rateLimitMax - record.count));
    if (record.count > settings.rateLimitMax) return response.status(429).json({ error: "Too many requests. Please try again shortly." });
    next();
  };
}

function validMessages(messages) {
  return Array.isArray(messages) && messages.length > 0 && messages.length <= 40 && messages.every((message) =>
    ["user", "assistant"].includes(message?.role) && typeof message.content === "string" && message.content.length <= 12000
  );
}

export function createApp(environment = process.env) {
  const settings = getSettings(environment);
  const app = express();
  const instructions = `You are ${settings.brandName}, a capable AI assistant. Be accurate, practical, clear, and direct. Do not reveal private chain-of-thought. State uncertainty plainly, ask a focused follow-up when it is needed, and maintain essential safety boundaries.`;

  app.set("trust proxy", 1);
  app.use(express.json({ limit: "1mb" }));
  app.use((_request, response, next) => {
    response.set({ "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "strict-origin-when-cross-origin", "Cache-Control": "no-store" });
    next();
  });
  app.use(express.static(path.join(dirname, "public")));

  app.get("/api/config", (_request, response) => response.json({ brandName: settings.brandName, tagline: settings.tagline, accentColor: settings.accentColor, welcomeMessage: settings.welcomeMessage, models: settings.models.map(({ id, label }) => ({ id, label })) }));
  app.get("/api/health", (_request, response) => response.json({ name: settings.brandName, status: "ready", provider: settings.provider, providerConfigured: settings.provider === "ollama" || Boolean(settings.apiKey), models: settings.models.length }));

  app.post("/api/chat", createRateLimiter(settings), async (request, response) => {
    const { messages, model: requestedModel } = request.body || {};
    const model = settings.models.find((candidate) => candidate.id === requestedModel) || settings.models[0];
    if (!validMessages(messages) || messages.at(-1)?.role !== "user" || !messages.at(-1).content.trim()) return response.status(400).json({ error: "Provide 1–40 user or assistant messages, each up to 12,000 characters." });
    if (requestedModel && !settings.models.some((candidate) => candidate.id === requestedModel)) return response.status(400).json({ error: "The selected model is not available for this workspace." });
    if (settings.provider === "compatible" && (!settings.apiKey || !settings.apiUrl)) return response.status(503).json({ error: "Audora needs AUDORA_API_URL and AUDORA_API_KEY for the configured hosted provider. Or set AUDORA_PROVIDER=ollama to run a local model without a cloud API key." });

    const aborter = new AbortController();
    const timer = setTimeout(() => aborter.abort(), settings.timeoutMs);
    try {
      const headers = { "Content-Type": "application/json" };
      if (settings.provider === "compatible") headers.Authorization = `Bearer ${settings.apiKey}`;
      const providerBody = settings.provider === "ollama"
        ? { model: model.id, messages: [{ role: "system", content: instructions }, ...messages], stream: false, options: { temperature: 0.7 } }
        : { model: model.id, messages: [{ role: "system", content: instructions }, ...messages], temperature: 0.7 };
      const providerResponse = await fetch(settings.apiUrl, { method: "POST", signal: aborter.signal, headers, body: JSON.stringify(providerBody) });
      const payload = await providerResponse.json().catch(() => ({}));
      if (!providerResponse.ok) return response.status(providerResponse.status >= 400 && providerResponse.status < 600 ? providerResponse.status : 502).json({ error: payload.error?.message || "The inference provider could not complete this request." });
      return response.json({ message: settings.provider === "ollama" ? (payload.message?.content || "The local model returned an empty response.") : (payload.choices?.[0]?.message?.content || "The model returned an empty response."), model: model.label });
    } catch (error) {
      return response.status(error.name === "AbortError" ? 504 : 502).json({ error: error.name === "AbortError" ? "The model took too long to respond. Please try again." : settings.provider === "ollama" ? "Audora could not reach Ollama. Start Ollama and pull the model named in .env." : "Audora could not reach its inference provider." });
    } finally { clearTimeout(timer); }
  });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, () => console.log(`Audora is listening at http://localhost:${port}`));
}
