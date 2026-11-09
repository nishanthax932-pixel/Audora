const button = document.querySelector("#image-mode");
const output = document.querySelector("#image-output");
const promptInput = document.querySelector("#prompt");
const apiBaseUrl = String(window.AUDORA_RUNTIME_CONFIG?.apiBaseUrl || "").replace(/\\/$/, "");
button?.addEventListener("click", async () => {
  const prompt = promptInput.value.trim() || window.prompt("Describe the image Audora should create:");
  if (!prompt || prompt.trim().length < 4) return;
  button.disabled = true;
  output.hidden = false;
  output.replaceChildren(Object.assign(document.createElement("p"), { textContent: "Audora is generating with its self-hosted image model…" }));
  try {
    const response = await fetch(`${apiBaseUrl}/api/image`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.trim() }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Image generation failed.");
    const image = document.createElement("img");
    image.src = payload.image;
    image.alt = prompt.trim().slice(0, 180);
    const download = document.createElement("a");
    download.href = payload.image;
    download.download = "audora-image.png";
    const link = document.createElement("button");
    link.type = "button"; link.textContent = "Download image";
    link.addEventListener("click", () => download.click());
    output.replaceChildren(image, link);
  } catch (error) {
    output.replaceChildren(Object.assign(document.createElement("p"), { textContent: error.message }));
  } finally { button.disabled = false; }
});
