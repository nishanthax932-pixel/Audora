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
const attachmentList = document.querySelector("#attachment-list");
const imageModeButton = document.querySelector("#image-mode");
let imageMode = false;
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
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    if (match.index > cursor) parent.append(document.createTextNode(value.slice(cursor, match.index)));
    const token = match[0];
    const node = document.createElement(token.startsWith("`") ? "code" : "strong");
    node.textContent = token.startsWith("`") ? token.slice(1, -1) : token.slice(2, -2);
    parent.append(node);
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
  const pending = renderMessage("assistant", imageMode ? "Creating your image…" : "Thinking…", { pending: true });
  promptInput.value = "";
  promptInput.style.height = "auto";
  controller = new AbortController();
  setGenerating(true);

  try {
    if (imageMode) {
      const response = await fetch(apiUrl("/api/image"), { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ prompt: content.trim() }) });
      if (!response.ok) { const failure = await response.json().catch(() => ({})); throw new Error(failure.error || `Image generation failed (${response.status}).`); }
      const imageUrl = URL.createObjectURL(await response.blob());
      pending.text.textContent = "";
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = `Generated image: ${content.trim()}`;
      image.loading = "lazy";
      image.className = "generated-image";
      pending.text.append(image);
      const download = document.createElement("a");
      download.href = imageUrl;
      download.download = `audora-image-${Date.now()}.jpg`;
      download.textContent = "Download image";
      download.className = "image-download";
      pending.text.append(download);
      chat.messages.push({ role: "assistant", content: `[Image generated for prompt: ${content.trim()}]` });
      chat.updatedAt = Date.now();
      safeSave();
      return;
    }
    const response = await fetch(apiUrl("/api/chat"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      // The API accepts at most 40 context messages. Keep the longer local
      // transcript for history, but send only the newest supported context.
      body: JSON.stringify({ messages: chat.messages.slice(-40), model: chat.model, memory: profile.memory || "" })
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
imageModeButton.addEventListener("click", () => {
  imageMode = !imageMode;
  imageModeButton.setAttribute("aria-pressed", String(imageMode));
  imageModeButton.classList.toggle("active", imageMode);
  promptInput.placeholder = imageMode ? "Describe the image you want to create…" : `Message ${config.brandName}`;
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
  const savedProfile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "null");
  if (savedProfile && typeof savedProfile === "object") profile = { name: typeof savedProfile.name === "string" ? savedProfile.name.slice(0, 60) : "", email: typeof savedProfile.email === "string" ? savedProfile.email.slice(0, 120) : "", memory: typeof savedProfile.memory === "string" ? savedProfile.memory.slice(0, 1200) : "" };
} catch { /* Private browsing may disable local storage. */ }
profileButton.addEventListener("click", openProfile);
document.querySelector("#profile-save").addEventListener("click", (event) => { event.preventDefault(); if (!profileEmail.validity.valid) { profileEmail.reportValidity(); return; } saveProfile(); });
renderProfile();
loadConfig().catch((error) => showNotice(`Connection problem: ${error.message} Configure runtime-config.js with the URL of your Audora API, or host the UI and API together.`));
