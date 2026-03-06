import { summarizeErrorOutput } from "../../shared/errorOutput";

export type LoginStatus = {
  ok: boolean;
  reason?: "not_found" | "auth" | "unknown";
  detail?: string;
};

export function parseCodexJsonl(stdout: string): string | null {
  let lastMessage = "";

  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let event: unknown;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (isCompletedAgentMessage(event)) {
      const text = extractText(event.item);
      if (text) {
        lastMessage = text;
      }
      continue;
    }

    if (isAssistantMessage(event)) {
      const text = extractText(event);
      if (text) {
        lastMessage = text;
      }
    }
  }

  return lastMessage.trim() ? lastMessage.trim() : null;
}

export function buildCodexErrorMessage(stderr: string, stdout: string, code: number | null): string {
  const combined = (stderr || stdout).trim();
  if (!combined) {
    return `codex exited with code ${code ?? "unknown"}`;
  }

  const summary = summarizeErrorOutput(combined);
  if (isAuthError(combined)) {
    return `Authentication failed for codex CLI. Run \`codex login\` in WSL or set CODEX_API_KEY. Details: ${summary}`;
  }

  if (isTuiError(combined)) {
    return `Codex CLI launched an interactive UI and failed (non-TTY). Ensure it is logged in and not prompting. Details: ${summary}`;
  }

  return summary;
}

export function isAuthError(text: string): boolean {
  const normalized = text.toLowerCase();
  return (
    normalized.includes("missing credentials") ||
    normalized.includes("authentication") ||
    normalized.includes("api_key") ||
    normalized.includes("openai_api_key") ||
    normalized.includes("codex_api_key") ||
    normalized.includes("unauthorized")
  );
}

export function isTuiError(text: string): boolean {
  const normalized = text.toLowerCase();
  return normalized.includes("raw mode is not supported") || normalized.includes("ink") || normalized.includes("tui");
}

type AgentMessageEvent = {
  type: "message";
  role: "assistant";
  text?: unknown;
  content?: unknown;
};

type CompletedAgentMessageEvent = {
  type: "item.completed";
  item?: {
    type?: string;
    text?: unknown;
    content?: unknown;
  };
};

function extractText(item: { text?: unknown; content?: unknown } | null | undefined): string | null {
  if (!item) {
    return null;
  }

  if (typeof item.text === "string") {
    return item.text;
  }

  if (typeof item.content === "string") {
    return item.content;
  }

  if (!Array.isArray(item.content)) {
    return null;
  }

  const parts = item.content
    .map(part => {
      if (typeof part === "string") {
        return part;
      }

      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }

      return "";
    })
    .filter(Boolean);

  return parts.length ? parts.join("") : null;
}

function isAssistantMessage(value: unknown): value is AgentMessageEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      "role" in value &&
      (value as Record<string, unknown>).type === "message" &&
      (value as Record<string, unknown>).role === "assistant"
  );
}

function isCompletedAgentMessage(value: unknown): value is CompletedAgentMessageEvent {
  return Boolean(
    value &&
      typeof value === "object" &&
      "type" in value &&
      (value as Record<string, unknown>).type === "item.completed" &&
      "item" in value &&
      (value as Record<string, unknown>).item &&
      typeof (value as Record<string, unknown>).item === "object" &&
      ((value as Record<string, unknown>).item as Record<string, unknown>).type === "agent_message"
  );
}
