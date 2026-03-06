import * as vscode from "vscode";
import { getCodexCommitConfig } from "../../config/codexCommitConfig";
import { CodexClient } from "../../infrastructure/codex/codexClient";
import { OutputLogger } from "../../shared/outputLogger";
import { formatCommandResult } from "../../shared/process";

export class DiagnosticsService {
  constructor(
    private readonly codexClient: CodexClient,
    private readonly logger: OutputLogger
  ) {}

  async run(): Promise<void> {
    const cwd = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd();
    const config = getCodexCommitConfig();

    this.logger.clear();
    this.logger.appendLine("Codex Commit Diagnostics");
    this.logger.appendLine(`cwd: ${cwd}`);
    this.logger.appendLine(`codexPath setting: ${config.codexPath || "(not set)"}`);
    this.logger.appendLine(`model setting: ${config.model || "(not set)"}`);
    this.logger.appendLine(`effort setting: ${config.effort || "(not set: codex CLI default)"}`);
    this.logger.appendLine(
      `CODEX_API_KEY: ${process.env.CODEX_API_KEY ? "set" : "not set"}, OPENAI_API_KEY: ${
        process.env.OPENAI_API_KEY ? "set" : "not set"
      }`
    );

    const version = await this.codexClient.getVersion(cwd);
    this.logger.appendLine(`codex --version: ${formatCommandResult(version)}`);

    const status = await this.codexClient.getLoginStatus(cwd);
    this.logger.appendLine(
      `codex login status: ${status.ok ? "ok" : `${status.reason ?? "unknown"}${status.detail ? ` (${status.detail})` : ""}`}`
    );

    this.logger.show(true);
    vscode.window.showInformationMessage("Codex Commit diagnostics written to output.");
  }
}
