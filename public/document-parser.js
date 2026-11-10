const MAX_PAGES = 20;
const MAX_TEXT = 10000;

let pdfModulePromise;
let mammothModulePromise;

async function loadPdfModule() {
  pdfModulePromise ||= import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs");
  return pdfModulePromise;
}

async function loadMammothModule() {
  mammothModulePromise ||= import("https://esm.sh/mammoth@1.9.0");
  return mammothModulePromise;
}

export async function extractDocumentText(file) {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "pdf") {
    const pdfjs = await loadPdfModule();
    pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjs.getDocument({ data: bytes, isEvalSupported: false }).promise;
    const pages = Math.min(pdf.numPages, MAX_PAGES);
    const chunks = [];
    for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      chunks.push(content.items.map((item) => typeof item.str === "string" ? item.str : "").join(" "));
      if (chunks.join("\n").length >= MAX_TEXT) break;
    }
    const result = chunks.join("\n").slice(0, MAX_TEXT);
    return pdf.numPages > MAX_PAGES ? `[Only the first ${MAX_PAGES} of ${pdf.numPages} PDF pages were extracted.]\n${result}` : result;
  }
  if (extension === "docx") {
    const mammoth = await loadMammothModule();
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return String(result.value || "").slice(0, MAX_TEXT);
  }
  throw new Error("Unsupported document. Attach a PDF or DOCX file.");
}
