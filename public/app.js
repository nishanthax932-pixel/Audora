const form = document.querySelector("#chat-form");
const promptInput = document.querySelector("#prompt");
const conversationView = document.querySelector("#conversation");
const emptyState = document.querySelector("#empty-state");
const modelSelect = document.querySelector("#model-select");
const historyView = document.querySelector("#history");
const historySearch = document.querySelector("#history-search");
const sendButton = document.querySelector("#send-button");
const stopButton = document.querySelector("#stop-button");

const STORAGE_KEY = "audora-workspace-v2";
const THEME_KEY = "audora-theme-v1";
const MAX_LOCAL_CHATS = 60;
const MAX_LOCAL_MESSAGES = 160;
const apiBaseUrl = String(window.AUDORA_RUNTIME_CONFIG?.apiBaseUrl || "").replace(/\/$/, "");
const apiUrl = (path) => `${apiBaseUrl}${path}`;

let config = {
  brandName: "Audora",
  tagline: "Your intelligent workspace",
  accentColor: "#805ad5",
  welcomeMessage: "How can I help you today?",
  models: [{ id: "openai", label: "Audora Core" }]
};
let chats = [];
let activeChatId = null;
let controller = null;
let isGenerating = false;

const createId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const currentChat = () => chats.find((chat) => chat.id === activeChatId);

function safeSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(0, MAX_LOCAL_CHATS)));
  } catch {
    showNotice("Local storage is full. Export or delete older chats to save more.");
  }
}

function showNotice(message) {
  const node = document.querySelector("#app-notice");
  if (node) {
    node.textContent = message;
    node.hidden = false;
  }
}

function makeChat() {
  const chat = { id: createId(), title: "New chat", createdAt: Date.now(), updatedAt: Date.now(), model: modelSelect.value || config.models[0]?.id, messages: [] };
  chats.unshift(chat);
  chats = chats.slice(0, MAX_LOCAL_CHATS);
  activeChatId = chat.id;
  safeSave();
  renderHistory();
  renderChat();
  promptInput.focus();
}

function titleFrom(messages) {
  const first = messages.find((message) => message.role === "user")?.content || "New chat";
  return first.replace(/\s+/g, " ").slice(0, 52);
}

function normalizeChats(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_LOCAL_CHATS).map((chat) => ({
    id: typeof chat.id === "string" ? chat.id : createId(),
    title: typeof chat.title === "string" ? chat.title.slice(0, 80) : "New chat",
    createdAt: Number(chat.createdAt) || Date.now(),
    updatedAt: Number(chat.updatedAt) || Date.now(),
    model: typeof chat.model === "string" ? chat.model : "",
    messages: Array.isArray(chat.messages) ? chat.messages.slice(-MAX_LOCAL_MESSAGES).filter((message) =>
      ["user", "assistant"].includes(message?.role) && typeof message.content === "string" && message.content.length <= 24000
    ) : []
  }));
}

function renderHistory() {
  const query = (historySearch?.value || "").trim().toLowerCase();
  historyView.replaceChildren();
  const label = document.createElement("p");
  label.className = "nav-label";
  label.textContent = "YOUR CHATS";
  historyView.append(label);

  const visibleChats = chats.filter((chat) => !query || chat.title.toLowerCase().includes(query) || chat.messages.some((message) => message.content.toLowerCase().includes(query)));
  if (!visibleChats.length) {
    const empty = document.createElement("p");
    empty.className = "history-empty";
    empty.textContent = query ? "No matching chats" : "Your conversations will appear here";
    historyView.append(empty);
    return;
  }

  for (const chat of visibleChats) {
    const row = document.createElement("div");
    row.className = `history-row${chat.id === activeChatId ? " active" : ""}`;
    const open = document.createElement("button");
    open.className = "history-item";
    open.type = "button";
    open.textContent = chat.title;
    open.title = chat.title;
    open.addEventListener("click", () => {
      if (isGenerating) return;
      activeChatId = chat.id;
      modelSelect.value = chat.model || config.models[0]?.id;
      renderHistory();
      renderChat();
      document.querySelector(".sidebar").classList.remove("open");
    });
    const remove = document.createElement("button");
    remove.className = "history-delete";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Delete ${chat.title}`);
    remove.addEventListener("click", () => deleteChat(chat.id));
    row.append(open, remove);
    historyView.append(row);
  }
}

function deleteChat(id) {
  if (isGenerating && id === activeChatId) stopGeneration();
  chats = chats.filter((chat) => chat.id !== id);
  if (activeChatId === id) activeChatId = chats[0]?.id || null;
  safeSave();
  renderHistory();
  renderChat();
}

function renderChat() {
  conversationView.replaceChildren();
  const chat = currentChat();
  const hasMessages = Boolean(chat?.messages.length);
  emptyState.hidden = hasMessages;
  if (!chat) return;
  for (const message of chat.messages) renderMessage(message.role, message.content);
  conversationView.scrollTop = conversationView.scrollHeight;
}

function renderMessage(role, content, { pending = false, error = false } = {}) {
  const article = document.createElement("article");
  article.className = `message ${role}${error ? " error" : ""}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "assistant" ? config.brandName.slice(0, 1).toUpperCase() : "You";
  const body = document.createElement("div");
  const label = document.createElement("p");
  label.className = "message-label";
  label.textContent = role === "assistant" ? config.brandName : "You";
  const text = document.createElement("p");
  text.className = "message-content";
  text.textContent = content;
  body.append(label, text);

  if (role === "assistant" && !pending && !error) {
    const actions = document.createElement("div");
    actions.className = "message-actions";
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "message-action";
    copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(content);
        copy.textContent = "Copied";
        setTimeout(() => { copy.textContent = "Copy"; }, 1200);
      } catch { showNotice("Clipboard access is unavailable in this browser."); }
    });
    actions.append(copy);
    body.append(actions);
  }

  article.append(avatar, body);
  conversationView.append(article);
  article.scrollIntoView({ behavior: "smooth", block: "end" });
  return { article, text };
}

function setGenerating(value) {
  isGenerating = value;
  sendButton.disabled = value;
  stopButton.hidden = !value;
  promptInput.disabled = value;
  modelSelect.disabled = value;
}

function stopGeneration() {
  if (controller) controller.abort();
}

async function sendMessage(content) {
  const chat = currentChat();
  if (!chat || isGenerating || !content.trim()) return;
  chat.model = modelSelect.value;
  chat.messages.push({ role: "user", content: content.trim() });
  chat.title = titleFrom(chat.messages);
  chat.updatedAt = Date.now();
  chats = [chat, ...chats.filter((item) => item.id !== chat.id)].slice(0, MAX_LOCAL_CHATS);
  safeSave();
  renderHistory();
  renderMessage("user", content.trim());
  const pending = renderMessage("assistant", "Thinking…", { pending: true });
  promptInput.value = "";
  promptInput.style.height = "auto";
  controller = new AbortController();
  setGenerating(true);

  try {
    const response = await fetch(apiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      // The API accepts at most 40 context messages. Keep the longer local
      // transcript for history, but send only the newest supported context.
      body: JSON.stringify({ messages: chat.messages.slice(-40), model: chat.model })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Audora request failed (${response.status}).`);
    if (typeof result.message !== "string" || !result.message.trim()) throw new Error("The model returned an empty response.");
    pending.text.textContent = result.message;
    const assistantMessage = { role: "assistant", content: result.message };
    chat.messages.push(assistantMessage);
    chat.updatedAt = Date.now();
    chats = [chat, ...chats.filter((item) => item.id !== chat.id)].slice(0, MAX_LOCAL_CHATS);
    safeSave();
    renderHistory();
    // Replace the pending row so the copy action is available.
    pending.article.remove();
    renderMessage("assistant", result.message);
  } catch (error) {
    const message = error.name === "AbortError" ? "Generation stopped." : error.message;
    pending.text.textContent = message;
    pending.article.classList.add("error");
  } finally {
    controller = null;
    setGenerating(false);
    promptInput.focus();
  }
}

async function loadConfig() {
  const response = await fetch(apiUrl("/api/config"));
  if (!response.ok) throw new Error(`The Audora API returned ${response.status}.`);
  const data = await response.json();
  config = { ...config, ...data, models: Array.isArray(data.models) && data.models.length ? data.models : config.models };
  document.documentElement.style.setProperty("--accent", config.accentColor);
  document.title = `${config.brandName} — AI workspace`;
  document.querySelectorAll("[data-brand]").forEach((node) => { node.textContent = config.brandName; });
  document.querySelectorAll("[data-tagline]").forEach((node) => { node.textContent = config.tagline; });
  document.querySelector("[data-brand-initial]").textContent = config.brandName.slice(0, 1).toUpperCase();
  document.querySelector("#welcome-heading").textContent = config.welcomeMessage;
  promptInput.placeholder = `Message ${config.brandName}`;
  modelSelect.replaceChildren(...config.models.map((model) => new Option(model.label, model.id)));

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (Array.isArray(saved)) {
      chats = normalizeChats(saved);
    } else {
      // Migrate the previous single-thread local history without losing it.
      const legacy = JSON.parse(localStorage.getItem("audora-conversations-v1") || "null");
      if (Array.isArray(legacy) && legacy.length) {
        const messages = legacy.filter((message) => ["user", "assistant"].includes(message?.role) && typeof message.content === "string");
        if (messages.length) {
          chats = [{ id: createId(), title: titleFrom(messages), createdAt: Date.now(), updatedAt: Date.now(), model: config.models[0]?.id || "", messages: messages.slice(-MAX_LOCAL_MESSAGES) }];
          safeSave();
        }
      }
    }
  } catch { chats = []; }
  activeChatId = chats[0]?.id || null;
  renderHistory();
  renderChat();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const content = promptInput.value.trim();
  if (!content || isGenerating) return;
  if (!currentChat()) makeChat();
  sendMessage(content);
});

document.querySelector("#export-chats").addEventListener("click", () => {
  if (!chats.length) {
    showNotice("There are no conversations to export yet.");
    return;
  }
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), format: "audora-local-chats-v1", conversations: chats }, null, 2);
  const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `audora-chats-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.querySelector("#new-chat").addEventListener("click", () => {
  if (isGenerating) return;
  makeChat();
  document.querySelector(".sidebar").classList.remove("open");
});
document.querySelector("#theme-toggle").addEventListener("click", () => {
  document.documentElement.classList.toggle("light");
  try { localStorage.setItem(THEME_KEY, document.documentElement.classList.contains("light") ? "light" : "dark"); }
  catch { showNotice("Theme changed for this session; browser storage is unavailable."); }
});
document.querySelector("#open-sidebar").addEventListener("click", () => document.querySelector(".sidebar").classList.add("open"));
document.querySelector("#close-sidebar").addEventListener("click", () => document.querySelector(".sidebar").classList.remove("open"));
stopButton.addEventListener("click", stopGeneration);
historySearch?.addEventListener("input", renderHistory);

document.querySelectorAll(".suggestions button").forEach((button) => button.addEventListener("click", () => {
  promptInput.value = button.textContent;
  promptInput.focus();
}));
promptInput.addEventListener("input", () => {
  promptInput.style.height = "auto";
  promptInput.style.height = `${Math.min(promptInput.scrollHeight, 180)}px`;
});
promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
    event.preventDefault();
    form.requestSubmit();
  }
});

try {
  if (localStorage.getItem(THEME_KEY) === "light") document.documentElement.classList.add("light");
} catch { /* Private browsing may disable local storage. */ }
loadConfig().catch((error) => showNotice(`Connection problem: ${error.message} Configure runtime-config.js with the URL of your Audora API, or host the UI and API together.`));
