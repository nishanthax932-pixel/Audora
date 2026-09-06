const form = document.querySelector("#chat-form");
const prompt = document.querySelector("#prompt");
const conversation = document.querySelector("#conversation");
const emptyState = document.querySelector("#empty-state");
const modelSelect = document.querySelector("#model-select");
const history = document.querySelector("#history");
const messages = [];
let config = { brandName: "Audora", welcomeMessage: "How can I help you today?", models: [{ id: "audora-core", label: "Audora Core" }] };
const storageKey = "audora-conversations-v1";

function addMessage(role, content) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  emptyState.hidden = true;
  const avatar = role === "assistant" ? config.brandName.slice(0, 1).toUpperCase() : "You";
  article.innerHTML = `<div class="avatar">${avatar}</div><div><p class="message-label">${role === "assistant" ? config.brandName : "You"}</p><p></p></div>`;
  article.querySelector("div:last-child p:last-child").textContent = content;
  conversation.append(article);
  article.scrollIntoView({ behavior: "smooth", block: "end" });
  return article;
}

function createHistoryItem(content) {
  const item = document.createElement("button");
  item.className = "history-item";
  item.textContent = content.slice(0, 36);
  history.append(item);
}

function saveConversation() { localStorage.setItem(storageKey, JSON.stringify(messages)); }

function loadConversation() {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(stored)) return;
    stored.forEach((message) => { if (["user", "assistant"].includes(message.role) && typeof message.content === "string") { messages.push(message); addMessage(message.role, message.content); } });
    if (messages[0]?.role === "user") createHistoryItem(messages[0].content);
  } catch { localStorage.removeItem(storageKey); }
}

async function loadConfig() {
  const response = await fetch("/api/config");
  config = await response.json();
  document.documentElement.style.setProperty("--accent", config.accentColor);
  document.title = `${config.brandName} — AI workspace`;
  document.querySelectorAll("[data-brand]").forEach((node) => { node.textContent = config.brandName; });
  document.querySelectorAll("[data-tagline]").forEach((node) => { node.textContent = config.tagline; });
  document.querySelector("[data-brand-initial]").textContent = config.brandName.slice(0, 1).toUpperCase();
  document.querySelector("#welcome-heading").textContent = config.welcomeMessage;
  prompt.placeholder = `Message ${config.brandName}`;
  modelSelect.replaceChildren(...config.models.map((model) => new Option(model.label, model.id)));
  loadConversation();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = prompt.value.trim();
  if (!content) return;
  messages.push({ role: "user", content });
  saveConversation();
  addMessage("user", content);
  if (messages.length === 1) createHistoryItem(content);
  prompt.value = "";
  const pending = addMessage("assistant", "Thinking…");
  const button = form.querySelector("button");
  button.disabled = true;

  try {
    const result = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, model: modelSelect.value })
    });
    const body = await result.json();
    if (!result.ok) throw new Error(body.error || "Audora could not respond.");
    pending.querySelector("div:last-child p:last-child").textContent = body.message;
    messages.push({ role: "assistant", content: body.message });
    saveConversation();
  } catch (error) {
    pending.querySelector("div:last-child p:last-child").textContent = error.message;
    pending.classList.add("error");
  } finally {
    button.disabled = false;
    prompt.focus();
  }
});

document.querySelectorAll(".suggestions button").forEach((button) => button.addEventListener("click", () => { prompt.value = button.textContent; prompt.focus(); }));
document.querySelector("#new-chat").addEventListener("click", () => { messages.length = 0; localStorage.removeItem(storageKey); conversation.replaceChildren(); emptyState.hidden = false; prompt.focus(); });
document.querySelector("#theme-toggle").addEventListener("click", () => document.documentElement.classList.toggle("light"));
document.querySelector("#open-sidebar").addEventListener("click", () => document.querySelector(".sidebar").classList.add("open"));
document.querySelector("#close-sidebar").addEventListener("click", () => document.querySelector(".sidebar").classList.remove("open"));
loadConfig().catch(() => addMessage("assistant", "The workspace configuration could not be loaded."));

prompt.addEventListener("input", () => {
  prompt.style.height = "auto";
  prompt.style.height = `${Math.min(prompt.scrollHeight, 180)}px`;
});
