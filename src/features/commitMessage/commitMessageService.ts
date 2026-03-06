import * as vscode from "vscode";
import { getCodexCommitConfig } from "../../config/codexCommitConfig";
import { CodexClient } from "../../infrastructure/codex/codexClient";
import { RepositoryResolver } from "../repositorySelection/repositoryResolver";
import { RepositoryResolutionContext } from "../../types/git";
import { truncate } from "../../shared/strings";
import { buildCommitPrompt } from "./prompt";

export class CommitMessageService {
  constructor(
    private readonly repositoryResolver: RepositoryResolver,
    private readonly codexClient: CodexClient
  ) {}

  async generate(context: RepositoryResolutionContext = {}): Promise<void> {
    const repository = await this.repositoryResolver.resolve(context);
    if (!repository) {
      return;
    }

    let diff = await repository.diff(true);
    if (!diff.trim()) {
      vscode.window.showInformationMessage("No staged changes. Stage files first.");
      return;
    }

    diff = truncate(diff, 12000);

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Generating commit message (codex)…" },
      async () => {
        const prompt = buildCommitPrompt(getCodexCommitConfig().promptTemplate, diff);

        try {
          const isAuthenticated = await this.codexClient.ensureAuthenticated(repository.rootUri.fsPath);
          if (!isAuthenticated) {
            return;
          }

          const message = await this.codexClient.run(prompt, repository.rootUri.fsPath);
          if (!message.trim()) {
            vscode.window.showErrorMessage("codex returned empty output.");
            return;
          }

          repository.inputBox.value = message.trim();
          await vscode.commands.executeCommand("workbench.view.scm");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`codex failed: ${message}`);
        }
      }
    );
  }
}
