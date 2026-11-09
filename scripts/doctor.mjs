#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const env = { ...process.env };
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && env[match[1]] === undefined) env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

const checks = [];
const add = (level, title, detail) => checks.push({ level, title, detail });
const provider = env.AUDORA_PROVIDER || "compatible";
const model = env.AUDORA_MODEL || (provider === "ollama" ? "qwen3:8b" : "audora-local");
const apiUrl = env.AUDORA_API_URL || "http://127.0.0.1:8000/v1/chat/completions";
const key = env.AUDORA_API_KEY || "";

add(existsSync(envPath) ? "ok" : "warn", ".env file", existsSync(envPath) ? "Found local environment file." : "Not found. Copy .env.example to .env before starting a model-backed workspace.");
add(["compatible", "ollama"].includes(provider) ? "ok" : "error", "Provider", `Configured provider: ${provider}`);
add(model.trim() ? "ok" : "error", "Model ID", model || "No model ID configured.");
add(key.length >= 32 ? "ok" : "warn", "Inference API key", key.length >= 32 ? "A 32+ character key is configured." : "Set a strong 32+ character server-side key. Do not put it in browser code.");
try {
  const parsed = new URL(apiUrl);
  add(["http:", "https:"].includes(parsed.protocol) ? "ok" : "error", "Inference URL", parsed.origin);
} catch {
  add("error", "Inference URL", "AUDORA_API_URL is not a valid URL.");
}
add(env.AUDORA_SEARCH_URL ? "ok" : "warn", "Web search", env.AUDORA_SEARCH_URL ? "Configured. Confirm SearXNG JSON output is enabled and reachable from the app." : "Optional SearXNG is not configured.");
add(env.AUDORA_IMAGE_API_KEY && env.AUDORA_IMAGE_API_URL ? "ok" : "warn", "Image generation", env.AUDORA_IMAGE_API_KEY && env.AUDORA_IMAGE_API_URL ? "Proxy credentials and endpoint are configured; GPU/checkpoint still need a live test." : "Optional local Diffusers service is not configured.");
add("warn", "Authentication and persistence", "This repository currently has browser-local profile/chat storage; server-side accounts, cross-device sync, and durable multi-user storage are not implemented.");
add("warn", "Production exposure", "Before public multi-user launch, add HTTPS, real authentication, shared rate limiting, monitoring, backups, spend controls, and an abuse-response process.");

const symbols = { ok: "✓", warn: "!", error: "✗" };
console.log("\nAudora preflight report\n");
for (const check of checks) console.log(`[${symbols[check.level]}] ${check.title}: ${check.detail}`);
const errors = checks.filter((check) => check.level === "error").length;
const warnings = checks.filter((check) => check.level === "warn").length;
console.log(`\nResult: ${errors} error(s), ${warnings} warning(s). This checks configuration only; it does not prove that a model or GPU is online.\n`);
if (errors) process.exitCode = 1;
