const STORAGE_KEY = "audora-custom-assistants-v1";
const ACTIVE_KEY = "audora-active-assistant-v1";
const $ = (selector) => document.querySelector(selector);
let assistants = [];
let activeId = "";
let editingId = "";

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    assistants = Array.isArray(value) ? value.filter(validAssistant).slice(0, 50) : [];
  } catch { assistants = []; }
}
function validAssistant(item) {
  return item && typeof item.id === "string" && typeof item.name === "string" &&
    typeof item.instructions === "string" && item.name.length <= 60 &&
    item.instructions.length <= 3000;
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assistants));
    localStorage.setItem(ACTIVE_KEY, activeId);
    return true;
  } catch {
    notice("Browser storage is full. Your changes were not saved. Export or remove an assistant.");
    return false;
  }
}
function saveActive() {
  try { localStorage.setItem(ACTIVE_KEY, activeId); return true; }
  catch { notice("Your assistant selection could not be saved in this browser."); return false; }
}
function notice(message) {
  const node = $("#app-notice");
  if (node) { node.textContent = message; node.hidden = false; }
}
function id() { return crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2); }
function encode(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decode(value) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}
function renderSelect() {
  const select = $("#assistant-select");
  if (!select) return;
  select.replaceChildren(new Option("Audora Core", ""));
  assistants.forEach((assistant) => select.add(new Option(assistant.name, assistant.id)));
  select.value = activeId;
  window.AUDORA_ACTIVE_ASSISTANT = assistants.find((item) => item.id === activeId) || null;
}
function renderList() {
  const list = $("#assistant-list");
  list.replaceChildren();
  if (!assistants.length) {
    const empty = document.createElement("p");
    empty.className = "assistant-empty";
    empty.textContent = "Your custom assistants will appear here.";
    list.append(empty);
    return;
  }
  assistants.forEach((assistant) => {
    const card = document.createElement("article");
    card.className = "assistant-card";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = assistant.avatar + " " + assistant.name;
    const desc = document.createElement("p");
    desc.textContent = assistant.description || "Custom AI assistant";
    info.append(title, desc);
    const actions = document.createElement("div");
    actions.className = "assistant-card-actions";
    const use = document.createElement("button");
    use.textContent = activeId === assistant.id ? "Selected" : "Use";
    use.addEventListener("click", () => {
      const previousId = activeId;
      activeId = assistant.id;
      if (!saveActive()) { activeId = previousId; return; }
      renderSelect(); renderList(); $("#assistant-dialog").close();
      notice(assistant.name + " is now your active assistant.");
    });
    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.addEventListener("click", () => openEditor(assistant));
    const share = document.createElement("button");
    share.textContent = "Share";
    share.addEventListener("click", () => shareAssistant(assistant));
    const remove = document.createElement("button");
    remove.textContent = "Delete";
    remove.addEventListener("click", () => {
      if (!confirm("Delete " + assistant.name + " from this browser?")) return;
      const previousAssistants = assistants;
      const previousActiveId = activeId;
      assistants = assistants.filter((item) => item.id !== assistant.id);
      if (activeId === assistant.id) activeId = "";
      if (!save()) { assistants = previousAssistants; activeId = previousActiveId; return; }
      renderSelect(); renderList();
    });
    actions.append(use, edit, share, remove);
    card.append(info, actions); list.append(card);
  });
}
function openEditor(assistant = null) {
  editingId = assistant?.id || "";
  $("#assistant-editor-title").textContent = assistant ? "Edit assistant" : "Create your AI";
  $("#assistant-name").value = assistant?.name || "";
  $("#assistant-avatar").value = assistant?.avatar || "✦";
  $("#assistant-description").value = assistant?.description || "";
  $("#assistant-instructions").value = assistant?.instructions || "";
  $("#assistant-dialog").showModal();
}
async function shareAssistant(assistant) {
  const payload = { name: assistant.name, avatar: assistant.avatar, description: assistant.description, instructions: assistant.instructions };
  const url = new URL(location.href);
  url.hash = "assistant=" + encode(payload);
  if (url.href.length > 7000) return notice("This assistant is too large to share as a link. Shorten its instructions.");
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
    await navigator.clipboard.writeText(url.href);
    notice("Share link copied. Anyone with the link can import a copy.");
  } catch {
    const field = document.createElement("textarea");
    field.value = url.href;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    notice(copied ? "Share link copied. Anyone with the link can import a copy." : "Copy this assistant link from your browser address bar: " + url.href);
  }
}
function importSharedAssistant() {
  const match = location.hash.match(/(?:^#|&)assistant=([A-Za-z0-9_-]+)/);
  if (!match) return;
  try {
    const item = decode(match[1]);
    if (!item || typeof item.name !== "string" || typeof item.instructions !== "string" ||
        item.name.length > 60 || item.instructions.length > 3000) throw new Error("Invalid assistant");
    if (!confirm('Import "' + item.name + '" into your Audora assistants?')) return;
    const imported = { ...item, id: id(), name: item.name, avatar: String(item.avatar || "✦").slice(0, 8),
      description: String(item.description || "").slice(0, 180), instructions: item.instructions };
    const previousAssistants = assistants;
    const previousActiveId = activeId;
    assistants = [imported, ...assistants].slice(0, 50);
    activeId = imported.id;
    if (!save()) { assistants = previousAssistants; activeId = previousActiveId; return; }
    renderSelect(); renderList();
    history.replaceState(null, "", location.pathname + location.search);
    notice("Assistant imported. It is saved only in this browser.");
  } catch { notice("This assistant share link is invalid or incomplete."); }
}

const originalFetch = window.fetch.bind(window);
window.fetch = (input, init = {}) => {
  const url = typeof input === "string" ? input : input?.url || "";
  if (url.includes("/api/chat") && init.body && window.AUDORA_ACTIVE_ASSISTANT) {
    try {
      const body = JSON.parse(init.body);
      body.assistantInstructions = window.AUDORA_ACTIVE_ASSISTANT.instructions;
      init = { ...init, body: JSON.stringify(body) };
    } catch { /* Keep the original request if it is not JSON. */ }
  }
  return originalFetch(input, init);
};

load();
document.addEventListener("DOMContentLoaded", () => {
  const topbar = $(".topbar-actions");
  const select = document.createElement("select");
  select.id = "assistant-select";
  select.className = "assistant-select";
  select.setAttribute("aria-label", "Choose custom assistant");
  select.addEventListener("change", () => {
    activeId = select.value; saveActive(); renderSelect();
    const chosen = assistants.find((item) => item.id === activeId);
    notice(chosen ? chosen.name + " selected." : "Audora Core selected.");
  });
  const manage = document.createElement("button");
  manage.id = "manage-assistants"; manage.type = "button"; manage.textContent = "My AIs";
  manage.addEventListener("click", () => { renderList(); $("#assistant-dialog").showModal(); });
  topbar?.prepend(select, manage);
  const dialog = document.createElement("dialog");
  dialog.id = "assistant-dialog"; dialog.className = "assistant-dialog";
  dialog.innerHTML = '<div class="assistant-dialog-head"><div><p class="eyebrow">AUDORA CREATOR</p><h2>My AI assistants</h2></div><button type="button" class="assistant-close" aria-label="Close">×</button></div><p class="assistant-intro">Create a specialist AI with its own personality and instructions. Your assistants stay in this browser until you share a link.</p><div id="assistant-list"></div><button type="button" id="assistant-create" class="assistant-primary">＋ Create assistant</button>';
  document.body.append(dialog);
  dialog.querySelector(".assistant-close").addEventListener("click", () => dialog.close());
  $("#assistant-create").addEventListener("click", () => openEditor());
  const editor = document.createElement("dialog");
  editor.id = "assistant-dialog-editor"; editor.className = "assistant-dialog";
  editor.innerHTML = '<form id="assistant-form"><div class="assistant-dialog-head"><div><p class="eyebrow">CUSTOMIZE</p><h2 id="assistant-editor-title">Create your AI</h2></div><button type="button" class="assistant-close" aria-label="Close">×</button></div><label for="assistant-name">AI name</label><input id="assistant-name" maxlength="60" required placeholder="e.g. Study Mentor"><label for="assistant-avatar">Avatar (emoji)</label><input id="assistant-avatar" maxlength="8" value="✦"><label for="assistant-description">What does it do?</label><input id="assistant-description" maxlength="180" placeholder="A friendly science tutor"><label for="assistant-instructions">Personality and instructions</label><textarea id="assistant-instructions" maxlength="3000" rows="7" required placeholder="You are a patient science tutor. Explain concepts simply, give examples, and ask one question at a time."></textarea><p class="assistant-note">Do not include passwords, API keys, or private information. Instructions are included in share links.</p><div class="assistant-form-actions"><button type="button" class="assistant-secondary" id="assistant-cancel">Cancel</button><button class="assistant-primary" type="submit">Save assistant</button></div></form>';
  document.body.append(editor);
  editor.querySelector(".assistant-close").addEventListener("click", () => editor.close());
  $("#assistant-cancel").addEventListener("click", () => editor.close());
  $("#assistant-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const assistant = { id: editingId || id(), name: $("#assistant-name").value.trim(),
      avatar: ($("#assistant-avatar").value.trim() || "✦").slice(0, 8),
      description: $("#assistant-description").value.trim(), instructions: $("#assistant-instructions").value.trim() };
    if (!assistant.name || !assistant.instructions) return;
    const previousAssistants = assistants;
    const previousActiveId = activeId;
    assistants = editingId ? assistants.map((item) => item.id === editingId ? assistant : item) : [assistant, ...assistants];
    activeId = assistant.id;
    if (!save()) { assistants = previousAssistants; activeId = previousActiveId; return; }
    renderSelect(); renderList(); editor.close();
    notice(assistant.name + " saved and selected.");
  });
  const savedActiveId = (() => { try { return localStorage.getItem(ACTIVE_KEY) || ""; } catch { return ""; } })();
  activeId = assistants.some((item) => item.id === savedActiveId) ? savedActiveId : "";
  renderSelect(); renderList(); importSharedAssistant();
});
