import test from "node:test";
import assert from "node:assert/strict";
import { createAgentTools, executeAgentTool, parseCalculatorExpression, runAgentLoop } from "../agent.js";

test("calculator handles precedence, unary operators, decimals, and parentheses", () => {
  assert.equal(parseCalculatorExpression("(125 * 1.18) / 5"), 29.5);
  assert.equal(parseCalculatorExpression("-2 + 3 * 4"), 10);
  assert.equal(parseCalculatorExpression("8 % 3"), 2);
  assert.equal(parseCalculatorExpression(".5 + 1.25"), 1.75);
});

test("calculator rejects code, malformed syntax, division by zero, and huge results", () => {
  assert.throws(() => parseCalculatorExpression("process.exit()"), /Expected a number/);
  assert.throws(() => parseCalculatorExpression("2 / 0"), /Division by zero/);
  assert.throws(() => parseCalculatorExpression("1 + (2 * 3"), /Missing closing/);
  assert.throws(() => parseCalculatorExpression("999999999999999 * 999999999999999"), /numeric range/);
});

test("web search is not exposed unless configured", () => {
  const names = createAgentTools({ webSearchEnabled: false }).map((tool) => tool.function.name);
  assert.deepEqual(names, ["calculator", "get_current_time"]);
});

test("agent tool rejects unexpected properties and unknown tools", async () => {
  assert.equal((await executeAgentTool("calculator", { expression: "1+1", command: "whoami" })).ok, false);
  assert.equal((await executeAgentTool("run_shell", "{}")).ok, false);
});

test("agent loop runs tool calls then returns a final answer", async () => {
  let calls = 0;
  const result = await runAgentLoop({
    messages: [{ role: "system", content: "system" }, { role: "user", content: "Calculate 2 + 2" }],
    callModel: async (messages, options) => {
      calls++;
      if (calls === 1) {
        assert.ok(options.tools.some((tool) => tool.function.name === "calculator"));
        return { content: "I will calculate.", toolCalls: [{ id: "call-1", name: "calculator", arguments: { expression: "2 + 2" } }] };
      }
      assert.ok(Array.isArray(options.tools));
      assert.equal(messages.at(-1).role, "tool");
      assert.equal(messages.at(-2).role, "tool");
      return { content: "2 + 2 = 4.", toolCalls: [] };
    }
  });
  assert.equal(calls, 2);
  assert.equal(result.message, "2 + 2 = 4.");
  assert.equal(result.steps, 1);
  assert.deepEqual(result.toolCalls, [{ name: "calculator", ok: true }]);
});

test("agent loop enforces the maximum tool steps and synthesizes after the limit", async () => {
  let call = 0;
  const result = await runAgentLoop({
    messages: [{ role: "user", content: "Keep searching" }],
    maxSteps: 1,
    callModel: async (_messages, options) => {
      call++;
      return options.tools
        ? { content: "", toolCalls: [{ id: "again", name: "calculator", arguments: { expression: "6*7" } }] }
        : { content: "The calculation is 42.", toolCalls: [] };
    }
  });
  assert.equal(call, 2);
  assert.equal(result.stoppedReason, "tool_budget_reached");
  assert.equal(result.message, "The calculation is 42.");
});

test("search tool receives only a validated bounded query", async () => {
  let seen;
  const result = await executeAgentTool("web_search", { query: "Audora AI" }, {
    search: async (query) => { seen = query; return [{ title: "Docs", url: "https://example.test", content: "Snippet" }]; }
  });
  assert.equal(seen, "Audora AI");
  assert.equal(result.results[0].title, "Docs");
});
