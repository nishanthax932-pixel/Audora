import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const doctorPath = resolve(root, "scripts/doctor.mjs");

test("configuration doctor accepts the documented DeepSeek provider defaults", () => {
  const output = execFileSync(process.execPath, [doctorPath], {
    cwd: root, encoding: "utf8",
    env: { ...process.env, AUDORA_PROVIDER: "deepseek", AUDORA_API_URL: "", AUDORA_API_KEY: "x".repeat(40), AUDORA_MODEL: "" }
  });
  assert.match(output, /\[✓\] Provider: Configured provider: deepseek/);
  assert.match(output, /\[✓\] Model ID: deepseek-flash/);
  assert.match(output, /\[✓\] Inference URL: https:\/\/api\.deepseek\.com/);
  assert.doesNotMatch(output, /\[✗\] Provider:/);
});

test("configuration doctor still accepts the local Ollama provider", () => {
  const output = execFileSync(process.execPath, [doctorPath], {
    cwd: root, encoding: "utf8",
    env: { ...process.env, AUDORA_PROVIDER: "ollama", AUDORA_MODEL: "", AUDORA_OLLAMA_URL: "" }
  });
  assert.match(output, /\[✓\] Provider: Configured provider: ollama/);
  assert.match(output, /\[✓\] Model ID: qwen3:8b/);
});
