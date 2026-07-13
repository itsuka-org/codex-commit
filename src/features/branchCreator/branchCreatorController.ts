import type * as vscode from "vscode";
import type { CodexCommitConfig } from "../../config/codexCommitConfig";
import type { CodexClientPort } from "../../infrastructure/codex/codexClient";
import { ProcessRunnerError } from "../../infrastructure/process/processRunner";
import { forwardAbortSignal } from "../../shared/abort";
import { getErrorDetails } from "../../shared/errors";
import { buildBranchPrompt } from "../../shared/promptTemplate";
import type { UiAdapter } from "../../shared/ui";
import type { RepositoryResolutionContext } from "../../types/git";
import type { RepositoryResolverPort } from "../repositorySelection/repositoryResolver";
import type { BranchCreatorSessionPort } from "./branchCreatorSession";
import { collectBranchDiff, sanitizeBranchNameCandidate } from "./branchName";
import {
  BRANCH_CREATOR_PLACEHOLDER_EDIT,
  BRANCH_CREATOR_PLACEHOLDER_GENERATING,
  BRANCH_CREATOR_PLACEHOLDER_MANUAL
} from "./constants";

type ActiveOperation = {
  id: number;
  abortController: AbortController;
};

export class BranchCreatorController implements vscode.Disposable {
  private nextOperationId = 0;
  private activeOperation: ActiveOperation | undefined;

  constructor(
    private readonly repositoryResolver: RepositoryResolverPort,
    private readonly codexClient: CodexClientPort,
    private readonly session: BranchCreatorSessionPort,
    private readonly ui: UiAdapter,
    private readonly getConfig: (cwd?: string) => CodexCommitConfig
  ) {}

  async generate(context: RepositoryResolutionContext = {}): Promise<void> {
    const operation: ActiveOperation = {
      id: ++this.nextOperationId,
      abortController: new AbortController()
    };
    this.activeOperation?.abortController.abort();
    this.activeOperation = operation;
    this.session.hide();
    let targetRepoUri: vscode.Uri | undefined;

    try {
      await this.ui.withProgress(
        { title: "Generating branch name (codex)…", cancellable: true },
        async cancellationSignal => {
          const stopForwarding = forwardAbortSignal(cancellationSignal, operation.abortController);
          try {
            const repository = await this.repositoryResolver.resolve(context);
            if (!repository || !this.isLatest(operation.id)) {
              return;
            }
            targetRepoUri = repository.rootUri;

            const diff = await collectBranchDiff(repository);
            if (!this.isLatest(operation.id)) {
              return;
            }
            if (!diff) {
              this.ui.showInformationMessage("No staged or unstaged tracked changes.");
              return;
            }

            this.session.show(BRANCH_CREATOR_PLACEHOLDER_GENERATING, "", repository.rootUri);
            await this.ui.executeCommand("workbench.view.scm");
            if (!this.isLatest(operation.id)) {
              return;
            }

            const prompt = buildBranchPrompt(
              this.getConfig(repository.rootUri.fsPath).branchNamePromptTemplate,
              diff
            );
            const response = await this.codexClient.run(
              prompt,
              repository.rootUri.fsPath,
              operation.abortController.signal
            );
            if (!this.isLatest(operation.id)) {
              return;
            }

            const candidate = sanitizeBranchNameCandidate(response);
            if (!candidate) {
              this.ui.showErrorMessage("Unable to derive a branch name from Codex output.");
              this.session.show(BRANCH_CREATOR_PLACEHOLDER_MANUAL, "", repository.rootUri);
              return;
            }

            this.session.show(BRANCH_CREATOR_PLACEHOLDER_EDIT, candidate, repository.rootUri);
            this.ui.showInformationMessage(
              "Branch name generated. Edit it if needed, then use the standard SCM accept action or click Create Branch."
            );
          } finally {
            stopForwarding();
          }
        }
      );
    } catch (error) {
      if (!this.isLatest(operation.id)) {
        return;
      }
      if (targetRepoUri) {
        this.session.show(BRANCH_CREATOR_PLACEHOLDER_MANUAL, "", targetRepoUri);
      }
      if (!isCancellation(error)) {
        this.ui.showErrorMessage(`Unable to generate a branch name: ${getErrorDetails(error).message}`);
      }
    } finally {
      if (this.isLatest(operation.id)) {
        this.activeOperation = undefined;
      }
    }
  }

  async createFromInput(): Promise<void> {
    const branchName = this.session.getInputValue();
    if (!branchName) {
      this.ui.showErrorMessage("Branch name is empty. Generate or type a branch name first.");
      return;
    }

    const targetRepoUri = this.session.getTargetRepoUri();
    if (!targetRepoUri) {
      this.ui.showErrorMessage("The target repository is unknown. Regenerate the branch name before creating it.");
      return;
    }

    const repository = await this.repositoryResolver.resolveExact(targetRepoUri);
    if (!repository) {
      return;
    }

    try {
      await repository.createBranch(branchName, true);
      this.session.hide();
      this.ui.showInformationMessage(`Switched to new branch: ${branchName}`);
    } catch (error) {
      this.ui.showErrorMessage(mapBranchCreationError(error, branchName));
    }
  }

  dispose(): void {
    this.activeOperation?.abortController.abort();
    this.activeOperation = undefined;
  }

  private isLatest(operationId: number): boolean {
    return this.activeOperation?.id === operationId;
  }
}

function isCancellation(error: unknown): boolean {
  return error instanceof ProcessRunnerError && error.kind === "cancelled";
}

function mapBranchCreationError(error: unknown, branchName: string): string {
  const message = getErrorDetails(error).message;
  const normalized = message.toLowerCase();
  if (normalized.includes("already exists")) {
    return `Branch already exists: ${branchName}`;
  }
  if (normalized.includes("invalid") || normalized.includes("not a valid")) {
    return `Invalid branch name: ${branchName}`;
  }
  return `Failed to create branch ${branchName}: ${message}`;
}
