const form = document.querySelector("#chat-form");
const prompt = document.querySelector("#prompt");
const conversation = document.querySelector("#conversation");
const messages = [];

function addMessage(role, content) {
  const article = document.createElement("article");
  article.className = `message ${role}`;
  const avatar = role === "assistant" ? "A" : "YOU";
  article.innerHTML = `<div class="avatar">${avatar}</div><div><p class="message-label">${role === "assistant" ? "AUDORA" : "YOU"}</p><p></p></div>`;
  article.querySelector("div:last-child p:last-child").textContent = content;
  conversation.append(article);
  article.scrollIntoView({ behavior: "smooth", block: "end" });
  return article;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = prompt.value.trim();
  if (!content) return;
  messages.push({ role: "user", content });
  addMessage("user", content);
  prompt.value = "";
  const pending = addMessage("assistant", "Thinking…");
  const button = form.querySelector("button");
  button.disabled = true;

  try {
    const result = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages })
    });
    const body = await result.json();
    if (!result.ok) throw new Error(body.error || "Audora could not respond.");
    pending.querySelector("div:last-child p:last-child").textContent = body.message;
    messages.push({ role: "assistant", content: body.message });
  } catch (error) {
    pending.querySelector("div:last-child p:last-child").textContent = error.message;
    pending.classList.add("error");
  } finally {
    button.disabled = false;
    prompt.focus();
  }
});

prompt.addEventListener("input", () => {
  prompt.style.height = "auto";
  prompt.style.height = `${Math.min(prompt.scrollHeight, 180)}px`;
});
