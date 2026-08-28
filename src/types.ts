export type RunStatus =
  | "running"
  | "waiting_for_user"
  | "waiting_for_permission"
  | "completed"
  | "failed"
  | "stale";

export interface ClaudeLogRow {
  timestamp: string;
  traceId: string;
  spanId: string;
  body: string;
  attributes: Record<string, string>;
  resources: Record<string, string>;
}

export interface ProjectedEvent {
  sessionId: string;
  runId: string;
  timestamp: Date;
  eventName: string;
  status: RunStatus;
  currentTool?: string;
  waitingReason?: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  promptIncrement: number;
  // Session name derived from a user prompt; only the first one to arrive is kept.
  title?: string;
  metadata: Record<string, unknown>;
}
