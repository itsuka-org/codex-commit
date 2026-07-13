import type { CodexCommitConfig } from "../../config/codexCommitConfig";
import type { CodexClient } from "../../infrastructure/codex/codexClient";
import type { GitExtensionGateway } from "../../infrastructure/git/gitExtensionGateway";
import { getErrorDetails } from "../../shared/errors";
import type { OutputLogger } from "../../shared/outputLogger";
import type { UiAdapter } from "../../shared/ui";

export type DiagnosticsEnvironment = {
  cwd: string;
  remoteName?: string;
  environment: NodeJS.ProcessEnv;
};

export class DiagnosticsService {
  constructor(
    private readonly codexClient: CodexClient,
    private readonly gitGateway: GitExtensionGateway,
    private readonly logger: OutputLogger,
    private readonly ui: UiAdapter,
    private readonly getConfig: (cwd?: string) => CodexCommitConfig,
    private readonly getEnvironment: () => DiagnosticsEnvironment
  ) {}

  async run(): Promise<void> {
    const environment = this.getEnvironment();
    const config = this.getConfig(environment.cwd);

    this.logger.clear();
    this.logger.appendLine("Codex Commit Diagnostics");
    this.logger.appendLine(`cwd: ${environment.cwd}`);
    this.logger.appendLine(`extension host: ${environment.remoteName ?? "local"}`);
    this.logger.appendLine(`codexPath setting: ${config.codexPath || "(not set)"}`);
    this.logger.appendLine(`model setting: ${config.model || "(not set)"}`);
    this.logger.appendLine(`effort setting: ${config.effort || "(not set: Codex CLI default)"}`);
    this.logger.appendLine(
      `CODEX_API_KEY: ${environment.environment.CODEX_API_KEY ? "set" : "not set"}, OPENAI_API_KEY: ${
        environment.environment.OPENAI_API_KEY ? "set" : "not set"
      }`
    );

    const [version, login, git] = await Promise.allSettled([
      this.codexClient.getVersionStatus(environment.cwd),
      this.codexClient.getLoginStatus(environment.cwd),
      this.gitGateway.getApi()
    ]);

    if (version.status === "fulfilled") {
      this.logger.appendLine(`codex executable: ${version.value.executable}`);
      this.logger.appendLine(`codex installed: ${version.value.installed ?? (version.value.raw || "unrecognized")}`);
      this.logger.appendLine(`codex minimum: ${version.value.minimum}`);
      this.logger.appendLine(`codex compatible: ${version.value.compatible ? "yes" : "no"}`);
    } else {
      this.logger.appendLine(`codex version: error (${getErrorDetails(version.reason).message})`);
    }

    if (login.status === "fulfilled") {
      this.logger.appendLine(
        `codex login status: ${
          login.value.ok
            ? "ok"
            : `${login.value.reason ?? "unknown"}${login.value.detail ? ` (${login.value.detail})` : ""}`
        }`
      );
    } else {
      this.logger.appendLine(`codex login status: error (${getErrorDetails(login.reason).message})`);
    }

    if (git.status === "fulfilled") {
      this.logger.appendLine(`Git extension: enabled (${git.value.repositories.length} repositories)`);
    } else {
      this.logger.appendLine(`Git extension: error (${getErrorDetails(git.reason).message})`);
    }

    this.logger.show(true);
    this.ui.showInformationMessage("Codex Commit diagnostics written to output.");
  }
}
