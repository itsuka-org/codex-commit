import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CodexCommitConfig } from "../../config/codexCommitConfig";
import { getErrorDetails, summarizeErrorOutput } from "../../shared/errors";
import { renderCommand, truncateForLog } from "../../shared/strings";
import {
  ProcessRunnerError,
  type ProcessResult,
  type ProcessRunOptions
} from "../process/processRunner";
import { buildNonZeroExitError, buildVersionError, CodexError } from "./codexErrors";
import {
  formatNumericVersion,
  isSupportedCodexVersion,
  MIN_SUPPORTED_CODEX_VERSION,
  parseCodexVersion,
  type CodexVersionStatus
} from "./version";

const CODEX_TIMEOUT_MS = 120_000;
const CODEX_OUTPUT_LIMIT_BYTES = 1024 * 1024;

export type LoginStatus = {
  ok: boolean;
  reason?: "not_found" | "auth" | "unknown";
  detail?: string;
};

export interface DebugLogger {
  debug(message: string, enabled?: boolean): void;
}

export interface ProcessRunnerPort {
  run(options: ProcessRunOptions): Promise<ProcessResult>;
}

export interface CodexClientPort {
  run(prompt: string, cwd: string, signal?: AbortSignal): Promise<string>;
}

export type CodexClientOptions = {
  getConfig: (cwd?: string) => CodexCommitConfig;
  getRemoteName?: () => string | undefined;
  environment?: NodeJS.ProcessEnv;
};

export class CodexClient implements CodexClientPort {
  private readonly versionChecks = new Map<string, Promise<CodexVersionStatus>>();

  constructor(
    private readonly logger: DebugLogger,
    private readonly processRunner: ProcessRunnerPort,
    private readonly options: CodexClientOptions
  ) {}

  async run(prompt: string, cwd: string, signal?: AbortSignal): Promise<string> {
    const config = this.options.getConfig(cwd);
    const executable = config.codexPath || "codex";
    const version = await this.getVersionStatus(cwd, executable);
    if (!version.compatible) {
      throw buildVersionError(version);
    }

    const temporaryDirectory = await mkdtemp(join(tmpdir(), "codex-commit-"));
    const outputPath = join(temporaryDirectory, `${randomBytes(16).toString("hex")}.txt`);
    await writeFile(outputPath, "", { encoding: "utf8", mode: 0o600 });

    const args = buildCodexExecArgs(config, outputPath);
    const env = buildCodexEnvironment(this.options.environment ?? process.env);
    this.logger.debug(`spawn: ${renderCommand(executable, args)} (cwd=${cwd})`, config.debugLog);
    this.logger.debug(`model argument: ${config.model || "(none: Codex CLI default)"}`, config.debugLog);
    this.logger.debug(`effort argument: ${config.effort || "(none: Codex CLI default)"}`, config.debugLog);

    try {
      const result = await this.processRunner.run({
        command: executable,
        args,
        cwd,
        env,
        stdin: prompt,
        signal,
        timeoutMs: CODEX_TIMEOUT_MS,
        maxOutputBytes: CODEX_OUTPUT_LIMIT_BYTES
      });
      this.logResult(result, config.debugLog);
      if (result.code !== 0) {
        throw buildNonZeroExitError(result.stderr, result.stdout, result.code, this.options.getRemoteName?.() === "wsl");
      }

      let message: string;
      try {
        message = await readFile(outputPath, "utf8");
      } catch (error) {
        const details = getErrorDetails(error);
        if (details.code === "ENOENT") {
          throw new CodexError("missing_output", "Codex CLI did not create its final-message output file.", {
            cause: error
          });
        }
        throw new CodexError("read_output", `Failed to read the Codex final-message output: ${details.message}`, {
          cause: error
        });
      }

      if (!message.trim()) {
        throw new CodexError("empty_output", "Codex CLI returned an empty final message.");
      }
      this.logger.debug(`final message:\n${truncateForLog(message.trim(), 500)}`, config.debugLog);
      return message.trim();
    } catch (error) {
      if (error instanceof ProcessRunnerError && error.kind === "spawn" && error.code === "ENOENT") {
        throw new CodexError("not_found", this.notFoundMessage(executable), { cause: error });
      }
      throw error;
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  getVersionStatus(cwd: string, executable = this.options.getConfig(cwd).codexPath || "codex"): Promise<CodexVersionStatus> {
    const cached = this.versionChecks.get(executable);
    if (cached) {
      return cached;
    }

    const check = this.checkVersion(cwd, executable);
    this.versionChecks.set(executable, check);
    return check;
  }

  async getLoginStatus(cwd: string): Promise<LoginStatus> {
    const executable = this.options.getConfig(cwd).codexPath || "codex";
    try {
      const result = await this.processRunner.run({
        command: executable,
        args: ["login", "status"],
        cwd,
        timeoutMs: 15_000,
        maxOutputBytes: 64 * 1024
      });
      if (result.code === 0) {
        return { ok: true };
      }
      const combined = (result.stderr || result.stdout).trim();
      return {
        ok: false,
        reason: combined.toLowerCase().includes("auth") || combined.toLowerCase().includes("logged in") ? "auth" : "unknown",
        detail: summarizeErrorOutput(combined)
      };
    } catch (error) {
      if (error instanceof ProcessRunnerError && error.kind === "spawn" && error.code === "ENOENT") {
        return { ok: false, reason: "not_found" };
      }
      return { ok: false, reason: "unknown", detail: getErrorDetails(error).message };
    }
  }

  private async checkVersion(cwd: string, executable: string): Promise<CodexVersionStatus> {
    try {
      const result = await this.processRunner.run({
        command: executable,
        args: ["--version"],
        cwd,
        timeoutMs: 15_000,
        maxOutputBytes: 64 * 1024
      });
      const raw = (result.stdout || result.stderr).trim();
      const parsed = result.code === 0 ? parseCodexVersion(raw) : undefined;
      return {
        executable,
        raw,
        installed: parsed ? formatNumericVersion(parsed) : undefined,
        minimum: MIN_SUPPORTED_CODEX_VERSION,
        compatible: Boolean(parsed && isSupportedCodexVersion(parsed))
      };
    } catch (error) {
      if (error instanceof ProcessRunnerError && error.kind === "spawn" && error.code === "ENOENT") {
        throw new CodexError("not_found", this.notFoundMessage(executable), { cause: error });
      }
      throw error;
    }
  }

  private notFoundMessage(executable: string): string {
    if (executable !== "codex") {
      return `Codex CLI was not found at the configured path: ${executable}`;
    }
    const wslHint = this.options.getRemoteName?.() === "wsl" ? " Install it in WSL or expose it to the WSL extension host PATH." : "";
    return `Codex CLI was not found in PATH for the extension host environment.${wslHint}`;
  }

  private logResult(result: ProcessResult, debugEnabled: boolean): void {
    this.logger.debug(`codex exit code: ${result.code ?? "unknown"}`, debugEnabled);
    if (result.stderr.trim()) {
      this.logger.debug(`codex stderr:\n${truncateForLog(result.stderr.trim(), 1200)}`, debugEnabled);
    }
    if (result.stdout.trim()) {
      this.logger.debug(`codex stdout:\n${truncateForLog(result.stdout.trim(), 1200)}`, debugEnabled);
    }
  }
}

export function buildCodexExecArgs(config: CodexCommitConfig, outputPath: string): string[] {
  const args = ["exec"];
  if (config.model) {
    args.push("--model", config.model);
  }
  if (config.effort) {
    args.push("-c", `model_reasoning_effort=\"${config.effort}\"`);
  }
  args.push(
    "--sandbox",
    "read-only",
    "--ephemeral",
    "--output-last-message",
    outputPath,
    "--color",
    "never",
    "-"
  );
  return args;
}

export function buildCodexEnvironment(environment: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const result = { ...environment };
  if (!result.CODEX_API_KEY && result.OPENAI_API_KEY) {
    result.CODEX_API_KEY = result.OPENAI_API_KEY;
  }
  return result;
}
