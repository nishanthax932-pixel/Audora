import test from "node:test";
import assert from "node:assert/strict";
import { validateDataset, scoreResults } from "../scripts/eval.mjs";

const cases = [
  { id: "one", category: "qa", prompt: "Question?", expected_contains: ["correct phrase"], requires_citation: false },
  { id: "two", category: "grounding", prompt: "Find a source.", expected_contains: ["source-backed"], requires_citation: true }
];

test("validates a well-formed evaluation dataset", () => {
  assert.deepEqual(validateDataset(cases), []);
});

test("rejects duplicate IDs and malformed expected phrases", () => {
  const errors = validateDataset([cases[0], { ...cases[1], id: "one", expected_contains: [] }]);
  assert.ok(errors.some((error) => error.includes("duplicate id")));
  assert.ok(errors.some((error) => error.includes("expected_contains")));
});

test("scores answer keyphrases and required HTTP citations", () => {
  const report = scoreResults(cases, [
    { id: "one", answer: "This is the correct phrase." },
    { id: "two", answer: "This is source-backed.", citations: ["https://example.test/source"] }
  ]);
  assert.equal(report.keyphrasePassRate, 1);
  assert.equal(report.citationCoverage, 1);
  assert.ok(report.details.every((item) => item.pass));
});

test("fails citation coverage when a required citation is missing", () => {
  const report = scoreResults(cases, [
    { id: "one", answer: "correct phrase" },
    { id: "two", answer: "source-backed", citations: [] }
  ]);
  assert.equal(report.citationCoverage, 0);
  assert.equal(report.details[1].pass, false);
});

test("requires every expected phrase rather than passing on one match", () => {
  const multiPhraseCases = [{ id: "multi", prompt: "Limits?", expected_contains: ["5 MB", "20 pages", "10,000"], requires_citation: false }];
  const report = scoreResults(multiPhraseCases, [{ id: "multi", answer: "The limit is 5 MB and 20 pages." }]);
  assert.equal(report.keyphrasePassRate, 0);
  assert.equal(report.details[0].pass, false);
});
