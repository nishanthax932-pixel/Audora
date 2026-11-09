const form = document.querySelector("#chat-form");
const promptInput = document.querySelector("#prompt");
const conversationView = document.querySelector("#conversation");
const emptyState = document.querySelector("#empty-state");
const modelSelect = document.querySelector("#model-select");
const historyView = document.querySelector("#history");
const historySearch = document.querySelector("#history-search");
const sendButton = document.querySelector("#send-button");
const stopButton = document.querySelector("#stop-button");
const profileButton = document.querySelector("#profile-button");
const profileDialog = document.querySelector("#profile-dialog");
const profileName = document.querySelector("#profile-name");
const profileEmail = document.querySelector("#profile-email");
const profileMemory = document.querySelector("#profile-memory");
const PROFILE_KEY = "audora-profile-v1";
const fileInput = document.querySelector("#file-input");
const thinkingModeButton = document.querySelector("#thinking-mode");
const searchModeButton = document.querySelector("#search-mode");
let thinkingMode = false;
let searchMode = false;
const attachmentList = document.querySelector("#attachment-list");
let attachments = [];
let profile = { name: "", email: "" };

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
  models: [{ id: "openai", label: "Audora Core" }],
  searchEnabled: false
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

function saveProfile() {
  profile = { name: profileName.value.trim().slice(0, 60), email: profileEmail.value.trim().slice(0, 120), memory: profileMemory.value.trim().slice(0, 1200) };
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); }
  catch { showNotice("Profile could not be saved in this browser."); }
  renderProfile();
  profileDialog.close();
}

function renderProfile() {
  const initial = (profile.name || profile.email || "N").trim().slice(0, 1).toUpperCase();
  profileButton.textContent = initial;
  profileButton.title = profile.name || profile.email || "Audora profile";
  document.querySelector("#profile-avatar").textContent = initial;
}

function openProfile() {
  profileName.value = profile.name;
  profileEmail.value = profile.email;
  profileMemory.value = profile.memory || "";
  renderProfile();
  profileDialog.showModal();
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

function renderInline(parent, value) {
  const pattern = /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    if (match.index > cursor) parent.append(document.createTextNode(value.slice(cursor, match.index)));
    const token = match[0];
    if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
      if (linkMatch) {
        try {
          const url = new URL(linkMatch[2]);
          if (["http:", "https:"].includes(url.protocol)) {
            const link = document.createElement("a"); link.href = url.href; link.textContent = linkMatch[1];
            link.target = "_blank"; link.rel = "noopener noreferrer"; parent.append(link);
          }
        } catch { parent.append(document.createTextNode(linkMatch[1])); }
      }
    } else {
      const node = document.createElement(token.startsWith("`") ? "code" : "strong");
      node.textContent = token.startsWith("`") ? token.slice(1, -1) : token.slice(2, -2);
      parent.append(node);
    }
    cursor = match.index + token.length;
  }
  if (cursor < value.length) parent.append(document.createTextNode(value.slice(cursor)));
}

function renderRichText(parent, content) {
  parent.replaceChildren();
  const lines = content.split("\n");
  let list = null;
  let code = null;
  for (const line of lines) {
    if (line.startsWith("```")) {
      if (code) { parent.append(code); code = null; }
      else { code = document.createElement("pre"); const block = document.createElement("code"); code.append(block); code._block = block; }
      list = null;
      continue;
    }
    if (code) { code._block.append(document.createTextNode(`${line}\n`)); continue; }
    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (item) {
      if (!list) { list = document.createElement("ul"); parent.append(list); }
      const li = document.createElement("li"); renderInline(li, item[1]); list.append(li); continue;
    }
    list = null;
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    const node = document.createElement(heading ? `h${heading[1].length + 2}` : "p");
    renderInline(node, heading ? heading[2] : line);
    parent.append(node);
  }
  if (code) parent.append(code);
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
  if (role === "assistant" && !pending && !error) renderRichText(text, content);
  else text.textContent = content;
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
  thinkingModeButton.disabled = value;
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
  const fileContext = attachments.map((file) => `\n\n[Attached file: ${file.name}]\n${file.content}`).join("");
  const fullContent = `${content.trim()}${fileContext}`.slice(0, 12000);
  chat.messages.push({ role: "user", content: fullContent });
  attachments = [];
  renderAttachments();
  chat.title = titleFrom(chat.messages);
  chat.updatedAt = Date.now();
  chats = [chat, ...chats.filter((item) => item.id !== chat.id)].slice(0, MAX_LOCAL_CHATS);
  safeSave();
  renderHistory();
  renderMessage("user", fullContent);
  const pending = renderMessage("assistant", "Thinking…", { pending: true });
  promptInput.value = "";
  promptInput.style.height = "auto";
  controller = new AbortController();
  setGenerating(true);

  try {
    let searchContext = "";
    if (searchMode) {
      pending.text.textContent = "Searching the web…";
      const searchResponse = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(content.trim())}`), { signal: controller.signal });
      const searchPayload = await searchResponse.json().catch(() => ({}));
      if (!searchResponse.ok) throw new Error(searchPayload.error || "Web search failed.");
      if (!Array.isArray(searchPayload.results) || !searchPayload.results.length) throw new Error("No web search results were found. Try a more specific query.");
      searchContext = searchPayload.results.map((item, index) => `[Source ${index + 1}] ${item.title}\nURL: ${item.url}\nSnippet: ${item.content}`).join("\n\n");
      pending.text.textContent = "Reading sources and preparing an answer…";
    }
    const response = await fetch(apiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      // The API accepts at most 40 context messages. Keep the longer local
      // transcript for history, but send only the newest supported context.
      body: JSON.stringify({ messages: chat.messages.slice(-40), model: chat.model, memory: profile.memory || "", reasoning: thinkingMode, searchContext, stream: true })
    });
    if (!response.ok) {
      const failure = await response.json().catch(() => ({}));
      throw new Error(failure.error || `Audora request failed (${response.status}).`);
    }
    let answer = "";
    if (response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\n\n/);
        buffer = events.pop() || "";
        for (const eventText of events) {
          const dataLine = eventText.split(/\r?\n/).find((line) => line.startsWith("data:"));
          if (!dataLine) continue;
          let event;
          try { event = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
          if (eventText.includes("event: delta") && typeof event.text === "string") {
            answer += event.text;
            pending.text.textContent = answer;
            conversationView.scrollTop = conversationView.scrollHeight;
          } else if (eventText.includes("event: error")) {
            throw new Error(event.error || "The model stream failed.");
          } else if (eventText.includes("event: done") && typeof event.message === "string") {
            answer = event.message;
          }
        }
      }
    } else {
      const result = await response.json().catch(() => ({}));
      if (typeof result.message === "string") answer = result.message;
    }
    if (!answer.trim()) throw new Error("The model returned an empty response.");
    const assistantMessage = { role: "assistant", content: answer };
    chat.messages.push(assistantMessage);
    chat.updatedAt = Date.now();
    chats = [chat, ...chats.filter((item) => item.id !== chat.id)].slice(0, MAX_LOCAL_CHATS);
    safeSave();
    renderHistory();
    // Replace the pending row so the copy action is available.
    pending.article.remove();
    renderMessage("assistant", answer);
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

async function loadEngineStatus() {
  const badge = document.querySelector("#engine-status");
  if (!badge) return;
  try {
    const response = await fetch(apiUrl("/api/health"), { cache: "no-store" });
    if (!response.ok) throw new Error(`Status check returned ${response.status}.`);
    const status = await response.json();
    const services = [];
    if (status.searchEnabled) services.push("search");
    if (status.imageConfigured) services.push("image generation");
    if (!status.providerConfigured) {
      badge.textContent = "AI engine setup required";
      badge.dataset.state = "warning";
      badge.title = "The workspace is open, but no model API key/provider configuration was found. Configure the server before chatting.";
    } else {
      badge.textContent = "AI settings found · live model not verified";
      badge.dataset.state = "configured";
      badge.title = `Provider settings are present. This status does not test live inference.${services.length ? ` Optional services configured: ${services.join(", ")}.` : ""}`;
    }
  } catch (error) {
    badge.textContent = "API connection unavailable";
    badge.dataset.state = "error";
    badge.title = error.message;
  }
}

async function loadConfig() {
  const response = await fetch(apiUrl("/api/config"));
  if (!response.ok) throw new Error(`The Audora API returned ${response.status}.`);
  const data = await response.json();
  config = { ...config, ...data, models: Array.isArray(data.models) && data.models.length ? data.models : config.models };
  if (searchModeButton) searchModeButton.hidden = !config.searchEnabled;
  document.documentElement.style.setProperty("--accent", config.accentColor);
  document.title = `${config.brandName} — AI workspace`;
  document.querySelectorAll("[data-brand]").forEach((node) => { node.textContent = config.brandName; });
  document.querySelectorAll("[data-tagline]").forEach((node) => { node.textContent = config.tagline; });
  document.querySelector("[data-brand-initial]").textContent = config.brandName.slice(0, 1).toUpperCase();
  document.querySelector("#welcome-heading").textContent = config.welcomeMessage;
  promptInput.placeholder = `Message ${config.brandName}`;
  modelSelect.replaceChildren(...config.models.map((model) => new Option(model.label, model.id)));
  loadEngineStatus();

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

function renderAttachments() {
  attachmentList.replaceChildren();
  for (const file of attachments) {
    const chip = document.createElement("span");
    chip.className = "attachment-chip";
    chip.textContent = `${file.name} · ${Math.ceil(file.content.length / 1024)} KB`;
    attachmentList.append(chip);
  }
}

document.querySelector("#attach-files").addEventListener("click", () => fileInput.click());
searchModeButton?.addEventListener("click", () => {
  searchMode = !searchMode;
  searchModeButton.setAttribute("aria-pressed", String(searchMode));
  searchModeButton.classList.toggle("active", searchMode);
  searchModeButton.title = searchMode ? "Web search is on for the next answer" : "Search the web before answering";
  showNotice(searchMode ? "Web search enabled: Audora will retrieve live results and use source links." : "Web search disabled.");
});
thinkingModeButton.addEventListener("click", () => {
  thinkingMode = !thinkingMode;
  thinkingModeButton.setAttribute("aria-pressed", String(thinkingMode));
  thinkingModeButton.classList.toggle("active", thinkingMode);
  thinkingModeButton.title = thinkingMode ? "Detailed explanation mode is on" : "Detailed explanation mode";
  showNotice(thinkingMode ? "Detailed explanation mode enabled: Audora will show more solution steps and checks." : "Detailed explanation mode disabled.");
});
fileInput.addEventListener("change", async () => {
  const selected = Array.from(fileInput.files || []).slice(0, 4 - attachments.length);
  for (const file of selected) {
    if (file.size > 200000) { showNotice(`${file.name} is too large. Text attachments are limited to 200 KB each.`); continue; }
    try {
      const content = await file.text();
      if (attachments.reduce((sum, item) => sum + item.content.length, 0) + content.length > 10000) { showNotice("Combined attachment text is limited to 10,000 characters."); break; }
      attachments.push({ name: file.name.slice(0, 120), content });
    } catch { showNotice(`Could not read ${file.name}.`); }
  }
  fileInput.value = "";
  renderAttachments();
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
  promptInput.value = button.dataset.prompt || button.textContent;
  promptInput.focus();
  promptInput.dispatchEvent(new Event("input", { bubbles: true }));
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
  const savedProfile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
  if (savedProfile && typeof savedProfile === "object") profile = { name: typeof savedProfile.name === "string" ? savedProfile.name.slice(0, 60) : "", email: typeof savedProfile.email === "string" ? savedProfile.email.slice(0, 120) : "", memory: typeof savedProfile.memory === "string" ? savedProfile.memory.slice(0, 1200) : "" };
} catch { /* Private browsing may disable local storage. */ }
profileButton.addEventListener("click", openProfile);
document.querySelector("#profile-workspace")?.addEventListener("click", openProfile);
document.querySelector("#profile-save").addEventListener("click", (event) => { event.preventDefault(); if (!profileEmail.validity.valid) { profileEmail.reportValidity(); return; } saveProfile(); });
renderProfile();
loadConfig().catch((error) => showNotice(`Connection problem: ${error.message} Configure runtime-config.js with the URL of your Audora API, or host the UI and API together.`));
