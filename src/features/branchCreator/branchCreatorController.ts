import * as vscode from "vscode";
import { getCodexCommitConfig } from "../../config/codexCommitConfig";
import { CodexClient } from "../../infrastructure/codex/codexClient";
import { GitClient } from "../../infrastructure/git/gitClient";
import { RepositoryResolutionContext } from "../../types/git";
import { buildBranchPrompt } from "../commitMessage/prompt";
import { RepositoryResolver } from "../repositorySelection/repositoryResolver";
import { collectBranchDiff, sanitizeBranchNameCandidate } from "./branchName";
import { BranchCreatorSession } from "./branchCreatorSession";
import {
  BRANCH_CREATOR_PLACEHOLDER_EDIT,
  BRANCH_CREATOR_PLACEHOLDER_GENERATING,
  BRANCH_CREATOR_PLACEHOLDER_MANUAL
} from "./constants";

export class BranchCreatorController {
  constructor(
    private readonly repositoryResolver: RepositoryResolver,
    private readonly codexClient: CodexClient,
    private readonly gitClient: GitClient,
    private readonly session: BranchCreatorSession
  ) {}

  async generate(context: RepositoryResolutionContext = {}): Promise<void> {
    const repository = await this.repositoryResolver.resolve(context);
    if (!repository) {
      return;
    }

    const diff = await collectBranchDiff(repository);
    if (!diff) {
      vscode.window.showInformationMessage("No staged or unstaged tracked changes.");
      return;
    }

    this.session.show(BRANCH_CREATOR_PLACEHOLDER_GENERATING, "", repository.rootUri.fsPath);
    await vscode.commands.executeCommand("workbench.view.scm");

    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: "Generating branch name (codex)…" },
      async () => {
        const prompt = buildBranchPrompt(getCodexCommitConfig().branchPromptTemplate, diff);

        try {
          const isAuthenticated = await this.codexClient.ensureAuthenticated(repository.rootUri.fsPath);
          if (!isAuthenticated) {
            this.session.show(BRANCH_CREATOR_PLACEHOLDER_MANUAL, "", repository.rootUri.fsPath);
            return;
          }

          const response = await this.codexClient.run(prompt, repository.rootUri.fsPath);
          if (!response.trim()) {
            vscode.window.showErrorMessage("codex returned empty output.");
            this.session.show(BRANCH_CREATOR_PLACEHOLDER_MANUAL, "", repository.rootUri.fsPath);
            return;
          }

          const candidate = sanitizeBranchNameCandidate(response);
          if (!candidate) {
            vscode.window.showErrorMessage("Unable to derive a branch name from codex output.");
            this.session.show(BRANCH_CREATOR_PLACEHOLDER_MANUAL, "", repository.rootUri.fsPath);
            return;
          }

          this.session.show(BRANCH_CREATOR_PLACEHOLDER_EDIT, candidate, repository.rootUri.fsPath);
          vscode.window.showInformationMessage(
            "Branch name generated. Edit it if needed, then press Ctrl+Enter / Cmd+Enter or click Create Branch."
          );
        } catch (error) {
          this.session.show(BRANCH_CREATOR_PLACEHOLDER_MANUAL, "", repository.rootUri.fsPath);
          const message = error instanceof Error ? error.message : String(error);
          vscode.window.showErrorMessage(`codex failed: ${message}`);
        }
      }
    );
  }

  async createFromInput(): Promise<void> {
    const branchName = this.session.getInputValue();
    if (!branchName) {
      vscode.window.showErrorMessage("Branch name is empty. Generate or type a branch name first.");
      return;
    }

    let repoRoot = this.session.getTargetRepoRoot();
    if (!repoRoot) {
      const repository = await this.repositoryResolver.resolve();
      if (!repository) {
        return;
      }
      repoRoot = repository.rootUri.fsPath;
    }

    try {
      await this.gitClient.createBranch(branchName, repoRoot);
      this.session.hide();
      vscode.window.showInformationMessage(`Switched to new branch: ${branchName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(message);
    }
  }
}
