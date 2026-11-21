import fs from "node:fs";

export function validateDataset(cases) {
  const errors = [];
  if (!Array.isArray(cases) || cases.length === 0) return ["Dataset must be a non-empty JSON array."];
  const ids = new Set();
  for (const [index, item] of cases.entries()) {
    const where = `case ${index + 1}`;
    if (!item || typeof item !== "object" || Array.isArray(item)) { errors.push(`${where}: expected an object.`); continue; }
    if (typeof item.id !== "string" || !item.id.trim()) errors.push(`${where}: id is required.`);
    else if (ids.has(item.id)) errors.push(`${where}: duplicate id ${item.id}.`);
    else ids.add(item.id);
    if (typeof item.prompt !== "string" || !item.prompt.trim()) errors.push(`${where}: prompt is required.`);
    if (!Array.isArray(item.expected_contains) || item.expected_contains.length === 0 || item.expected_contains.some((v) => typeof v !== "string" || !v.trim())) errors.push(`${where}: expected_contains must be a non-empty array of strings.`);
    if (typeof item.requires_citation !== "boolean") errors.push(`${where}: requires_citation must be boolean.`);
  }
  return errors;
}

export function scoreResults(cases, results) {
  const errors = validateDataset(cases);
  if (errors.length) throw new Error(errors.join("\n"));
  if (!Array.isArray(results)) throw new Error("Results must be a JSON array.");
  const byId = new Map();
  for (const result of results) {
    if (!result || typeof result.id !== "string" || byId.has(result.id)) throw new Error("Every result must have a unique string id.");
    byId.set(result.id, result);
  }
  let keyphrasePasses = 0, citationRequired = 0, citationPasses = 0, answered = 0;
  const details = cases.map((item) => {
    const result = byId.get(item.id);
    const answer = typeof result?.answer === "string" ? result.answer : "";
    const normalized = answer.toLocaleLowerCase();
    const keyphrasePass = item.expected_contains.some((phrase) => normalized.includes(phrase.toLocaleLowerCase()));
    const citations = Array.isArray(result?.citations) ? result.citations.filter((url) => typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) : [];
    const citationPass = !item.requires_citation || citations.length > 0;
    if (answer.trim()) answered++;
    if (keyphrasePass) keyphrasePasses++;
    if (item.requires_citation) { citationRequired++; if (citationPass) citationPasses++; }
    return { id: item.id, answered: Boolean(answer.trim()), keyphrasePass, citationRequired: item.requires_citation, citationPass, pass: Boolean(answer.trim()) && keyphrasePass && citationPass };
  });
  return {
    total: cases.length,
    answered,
    keyphrasePassRate: Number((keyphrasePasses / cases.length).toFixed(4)),
    citationCoverage: citationRequired ? Number((citationPasses / citationRequired).toFixed(4)) : null,
    note: "Keyword and citation-presence checks are smoke metrics, not semantic correctness or hallucination measurements.",
    details
  };
}

function readJson(path) { return JSON.parse(fs.readFileSync(path, "utf8")); }
function main() {
  const args = process.argv.slice(2);
  const datasetIndex = args.indexOf("--dataset");
  const datasetPath = datasetIndex >= 0 && args[datasetIndex + 1] ? args[datasetIndex + 1] : "evals/golden-set.json";
  const cases = readJson(datasetPath);
  const errors = validateDataset(cases);
  if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; return; }
  if (args.includes("--validate") || !args.includes("--results")) {
    console.log(JSON.stringify({ valid: true, cases: cases.length, categories: [...new Set(cases.map((item) => item.category))].length }, null, 2));
    return;
  }
  const resultsIndex = args.indexOf("--results");
  const resultsPath = resultsIndex >= 0 ? args[resultsIndex + 1] : null;
  if (!resultsPath || resultsPath.startsWith("--")) { console.error("Provide a JSON file path after --results."); process.exitCode = 1; return; }
  const report = scoreResults(cases, readJson(resultsPath));
  console.log(JSON.stringify(report, null, 2));
  if (report.details.some((item) => !item.pass)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
