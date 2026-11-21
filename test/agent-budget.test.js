import test from "node:test";
import assert from "node:assert/strict";
import { runAgentLoop } from "../agent.js";

test("agent enforces the total tool-call budget even when a model returns a batch", async () => {
  const modelCalls = [];
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Do several calculations." }],
    maxSteps: 4,
    maxToolCalls: 2,
    callModel: async (_messages, options) => {
      modelCalls.push(options);
      if (options.tools) {
        return {
          content: "I will calculate.",
          toolCalls: [
            { id: "one", name: "calculator", arguments: { expression: "1 + 1" } },
            { id: "two", name: "calculator", arguments: { expression: "2 + 2" } },
            { id: "three", name: "calculator", arguments: { expression: "3 + 3" } }
          ]
        };
      }
      return { content: "The permitted calculations are complete.", toolCalls: [] };
    }
  });

  assert.equal(result.toolCalls.length, 2);
  assert.deepEqual(result.toolCalls.map((item) => item.ok), [true, true]);
  assert.equal(result.stoppedReason, "tool_budget_reached");
  assert.equal(modelCalls.length, 2);
  assert.equal(modelCalls[1].toolChoice, "none");
});

test("agent safely records malformed tool arguments without executing a tool", async () => {
  let searchCalls = 0;
  let call = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Search for something." }],
    webSearchEnabled: true,
    search: async () => { searchCalls++; return []; },
    callModel: async () => {
      call++;
      if (call === 1) {
        return {
          content: "",
          toolCalls: [{ id: "bad-json", name: "web_search", arguments: "{not-json" }]
        };
      }
      return { content: "The search arguments were invalid, so no search was run.", toolCalls: [] };
    }
  });

  assert.equal(searchCalls, 0);
  assert.deepEqual(result.toolCalls, [{ name: "web_search", ok: false }]);
  assert.match(result.message, /invalid/);
});

test("agent normalizes duplicate provider tool-call IDs before building tool history", async () => {
  let finalHistory;
  let call = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Calculate two values." }],
    callModel: async (history, options) => {
      call++;
      if (options.tools) {
        return {
          content: "",
          toolCalls: [
            { id: "duplicate", name: "calculator", arguments: { expression: "10 + 1" } },
            { id: "duplicate", name: "calculator", arguments: { expression: "10 + 2" } }
          ]
        };
      }
      finalHistory = history;
      return { content: "Both calculations are complete.", toolCalls: [] };
    }
  });

  const assistantTurn = finalHistory.find((message) => message.role === "assistant" && message.tool_calls);
  const toolTurnIds = finalHistory.filter((message) => message.role === "tool").map((message) => message.tool_call_id);
  assert.equal(new Set(assistantTurn.tool_calls.map((item) => item.id)).size, 2);
  assert.equal(new Set(toolTurnIds).size, 2);
  assert.equal(result.toolCalls.length, 2);
});
