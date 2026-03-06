import * as vscode from "vscode";
import { spawn } from "child_process";
import { getCodexCommitConfig } from "../../config/codexCommitConfig";
import { OutputLogger } from "../../shared/outputLogger";
import { CommandResult } from "../../shared/process";
import { renderCommand, truncateForLog } from "../../shared/strings";
import { buildCodexErrorMessage, isAuthError, LoginStatus, parseCodexJsonl } from "./parsing";
import { summarizeErrorOutput } from "../../shared/errorOutput";

export class CodexClient {
  constructor(private readonly logger: OutputLogger) {}

  async run(prompt: string, cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const env = { ...process.env };
      if (!env.CODEX_API_KEY && env.OPENAI_API_KEY) {
        env.CODEX_API_KEY = env.OPENAI_API_KEY;
      }

      const config = getCodexCommitConfig();
      const codexPath = config.codexPath || "codex";
      const args = ["exec"];
      if (config.model) {
        args.push("--model", config.model);
      }
      if (config.effort) {
        args.push("-c", `model_reasoning_effort=\"${config.effort}\"`);
      }
      args.push("--json", "--color", "never", "--skip-git-repo-check", "-");

      this.logger.debug(`spawn: ${renderCommand(codexPath, args)} (cwd=${cwd})`);
      this.logger.debug(`model argument: ${config.model || "(none: codex CLI default)"}`);
      this.logger.debug(`effort argument: ${config.effort || "(none: codex CLI default)"}`);

      const child = spawn(codexPath, args, { stdio: "pipe", cwd, env });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", chunk => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", chunk => {
        stderr += chunk.toString();
      });
      child.on("error", err => {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          reject(
            new Error(
              codexPath === "codex"
                ? "codex CLI not found in PATH for the extension host. Install it in WSL or add it to PATH via ~/.vscode-server/server-env-setup."
                : `codex CLI not found at configured path: ${codexPath}`
            )
          );
          return;
        }

        reject(err);
      });
      child.on("close", code => {
        this.logger.debug(`codex exit code: ${code ?? "unknown"}`);
        if (stderr.trim()) {
          this.logger.debug(`codex stderr:\n${truncateForLog(stderr.trim(), 1200)}`);
        }
        if (stdout.trim()) {
          this.logger.debug(`codex stdout (jsonl):\n${truncateForLog(stdout.trim(), 1200)}`);
        }

        if (code === 0) {
          const message = parseCodexJsonl(stdout);
          if (message) {
            this.logger.debug(`parsed message:\n${truncateForLog(message, 500)}`);
            resolve(message);
            return;
          }

          reject(new Error("codex returned no agent message in JSON output."));
          return;
        }

        reject(new Error(buildCodexErrorMessage(stderr, stdout, code)));
      });

      if (!child.stdin) {
        reject(new Error("Failed to open stdin for codex process."));
        return;
      }

      child.stdin.write(prompt);
      child.stdin.end();
    });
  }

  async ensureAuthenticated(cwd: string): Promise<boolean> {
    if (process.env.CODEX_API_KEY || process.env.OPENAI_API_KEY) {
      return true;
    }

    const status = await this.getLoginStatus(cwd);
    const config = getCodexCommitConfig();
    if (status.ok) {
      return true;
    }

    if (status.reason === "not_found") {
      vscode.window.showErrorMessage(
        config.codexPath
          ? `codex CLI not found at configured path: ${config.codexPath}`
          : "codex CLI not found in PATH for the extension host. Install it in WSL or add it to PATH via ~/.vscode-server/server-env-setup."
      );
      return false;
    }

    if (status.reason === "auth") {
      const detail = status.detail ? ` Details: ${status.detail}` : "";
      vscode.window.showErrorMessage(
        "Codex CLI is not authenticated for the extension host. Run `codex login` in WSL or set CODEX_API_KEY in ~/.vscode-server/server-env-setup." +
          detail
      );
      return false;
    }

    const detail = status.detail ? ` Details: ${status.detail}` : "";
    vscode.window.showErrorMessage(`Codex CLI failed to verify login status.${detail}`);
    return false;
  }

  getVersion(cwd: string): Promise<CommandResult> {
    return this.runCommand(["--version"], cwd);
  }

  getLoginStatus(cwd: string): Promise<LoginStatus> {
    const config = getCodexCommitConfig();
    return new Promise(resolve => {
      const command = config.codexPath || "codex";
      const child = spawn(command, ["login", "status"], { stdio: "pipe", cwd });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", chunk => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", chunk => {
        stderr += chunk.toString();
      });
      child.on("error", err => {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === "ENOENT") {
          resolve({ ok: false, reason: "not_found" });
          return;
        }

        resolve({ ok: false, reason: "unknown", detail: err.message });
      });
      child.on("close", code => {
        if (code === 0) {
          resolve({ ok: true });
          return;
        }

        const combined = (stderr || stdout).trim();
        resolve({
          ok: false,
          reason: isAuthError(combined) ? "auth" : "unknown",
          detail: summarizeErrorOutput(combined)
        });
      });
    });
  }

  private runCommand(args: string[], cwd: string): Promise<CommandResult> {
    return new Promise(resolve => {
      const command = getCodexCommitConfig().codexPath || "codex";
      const child = spawn(command, args, { stdio: "pipe", cwd });
      let stdout = "";
      let stderr = "";

      child.stdout.on("data", chunk => {
        stdout += chunk.toString();
      });
      child.stderr.on("data", chunk => {
        stderr += chunk.toString();
      });
      child.on("error", err => {
        resolve({ code: null, stdout: "", stderr: "", error: err.message });
      });
      child.on("close", code => {
        resolve({ code, stdout, stderr });
      });
    });
  }
}
