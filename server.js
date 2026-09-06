import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 3000);
const dirname = path.dirname(fileURLToPath(import.meta.url));

const audoraInstructions = `You are Audora, a thoughtful, capable AI assistant. Be accurate, practical, and clear.
Reason carefully before responding, but do not reveal private chain-of-thought. State uncertainty plainly,
ask a focused follow-up question when needed, and prioritize safe, helpful answers.`;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(dirname, "public")));

app.get("/api/health", (_request, response) => {
  response.json({
    name: "Audora",
    status: "ready",
    providerConfigured: Boolean(process.env.AUDORA_API_KEY),
    model: process.env.AUDORA_MODEL || "audora-core"
  });
});

app.post("/api/chat", async (request, response) => {
  const messages = Array.isArray(request.body?.messages) ? request.body.messages : [];
  const latest = messages.at(-1);

  if (!latest || latest.role !== "user" || typeof latest.content !== "string" || !latest.content.trim()) {
    return response.status(400).json({ error: "A user message is required." });
  }

  if (!process.env.AUDORA_API_KEY) {
    return response.status(503).json({
      error: "Audora is not connected to an inference provider yet. Set AUDORA_API_KEY and AUDORA_API_URL to enable live responses."
    });
  }

  try {
    const providerResponse = await fetch(process.env.AUDORA_API_URL || "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.AUDORA_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.AUDORA_MODEL || "gpt-4.1-mini",
        messages: [{ role: "system", content: audoraInstructions }, ...messages],
        temperature: 0.7
      })
    });
    const payload = await providerResponse.json();

    if (!providerResponse.ok) {
      return response.status(providerResponse.status).json({ error: payload.error?.message || "Inference provider request failed." });
    }

    return response.json({ message: payload.choices?.[0]?.message?.content || "Audora did not return a response." });
  } catch (error) {
    return response.status(502).json({ error: "Audora could not reach its inference provider.", detail: error.message });
  }
});

app.listen(port, () => console.log(`Audora is listening at http://localhost:${port}`));
