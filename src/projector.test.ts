import assert from "node:assert/strict";
import test from "node:test";
import { projectClaudeEvent } from "./projector.js";

test("projects a Claude Code user prompt", () => {
  const event = projectClaudeEvent({
    timestamp: "2026-08-27T01:02:03.000Z",
    traceId: "trace",
    spanId: "span",
    body: "{}",
    resources: { "service.name": "claude-code" },
    attributes: {
      "session.id": "session-123",
      "event.name": "claude_code.user_prompt"
    }
  });

  assert.ok(event);
  assert.equal(event.sessionId, "session-123");
  assert.equal(event.status, "running");
  assert.equal(event.promptIncrement, 1);
});

test("projects a permission wait", () => {
  const event = projectClaudeEvent({
    timestamp: "2026-08-27T01:02:03.000Z",
    traceId: "trace",
    spanId: "span",
    body: "{}",
    resources: {},
    attributes: {
      "session.id": "session-123",
      "event.name": "claude_code.tool_decision",
      decision: "ask"
    }
  });

  assert.ok(event);
  assert.equal(event.status, "waiting_for_permission");
});
