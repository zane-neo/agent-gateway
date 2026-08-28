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

test("derives a session title from the prompt, truncating long ones", () => {
  const short = projectClaudeEvent({
    timestamp: "2026-08-27T01:02:03.000Z",
    traceId: "t",
    spanId: "s",
    body: "{}",
    resources: {},
    attributes: {
      "session.id": "s1",
      "event.name": "claude_code.user_prompt",
      prompt: "  build\n  a  todo app  "
    }
  });
  assert.equal(short?.title, "build a todo app");

  const long = projectClaudeEvent({
    timestamp: "2026-08-27T01:02:03.000Z",
    traceId: "t",
    spanId: "s",
    body: "{}",
    resources: {},
    attributes: {
      "session.id": "s2",
      "event.name": "claude_code.user_prompt",
      prompt: "x".repeat(200)
    }
  });
  assert.equal(long?.title?.length, 80);
  assert.ok(long?.title?.endsWith("…"));

  // Redacted or absent prompts must not produce a placeholder title.
  const redacted = projectClaudeEvent({
    timestamp: "2026-08-27T01:02:03.000Z",
    traceId: "t",
    spanId: "s",
    body: "{}",
    resources: {},
    attributes: {
      "session.id": "s3",
      "event.name": "claude_code.user_prompt",
      prompt: "<REDACTED>"
    }
  });
  assert.equal(redacted?.title, undefined);

  // Non-prompt events never carry a title.
  const nonPrompt = projectClaudeEvent({
    timestamp: "2026-08-27T01:02:03.000Z",
    traceId: "t",
    spanId: "s",
    body: "{}",
    resources: {},
    attributes: { "session.id": "s4", "event.name": "claude_code.tool_result" }
  });
  assert.equal(nonPrompt?.title, undefined);
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
