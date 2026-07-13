import type * as vscode from "vscode";
import type { CodexCommitConfig } from "../../config/codexCommitConfig";
import type { CodexClientPort } from "../../infrastructure/codex/codexClient";
import { ProcessRunnerError } from "../../infrastructure/process/processRunner";
import { buildDiffInput } from "../../shared/diffInputBuilder";
import { getErrorDetails } from "../../shared/errors";
import { buildCommitPrompt } from "../../shared/promptTemplate";
import type { UiAdapter } from "../../shared/ui";
import type { RepositoryResolutionContext } from "../../types/git";
import type { RepositoryResolverPort } from "../repositorySelection/repositoryResolver";

const COMMIT_DIFF_MAX_CHARACTERS = 12_000;

export class CommitMessageService implements vscode.Disposable {
  private readonly operations = new Set<AbortController>();

  constructor(
    private readonly repositoryResolver: RepositoryResolverPort,
    private readonly codexClient: CodexClientPort,
    private readonly ui: UiAdapter,
    private readonly getConfig: (cwd?: string) => CodexCommitConfig
  ) {}

  async generate(context: RepositoryResolutionContext = {}): Promise<void> {
    const abortController = new AbortController();
    this.operations.add(abortController);
    try {
      await this.ui.withProgress(
        { title: "Generating commit message (codex)…", cancellable: true },
        async signal => {
          const abort = () => abortController.abort();
          if (signal.aborted) {
            abort();
          } else {
            signal.addEventListener("abort", abort, { once: true });
          }
          try {
            const repository = await this.repositoryResolver.resolve(context);
            if (!repository || abortController.signal.aborted) {
              return;
            }

            const rawDiff = await repository.diff(true);
            if (abortController.signal.aborted) {
              return;
            }
            if (!rawDiff.trim()) {
              this.ui.showInformationMessage("No staged changes. Stage files first.");
              return;
            }

            const diff = buildDiffInput([{ content: rawDiff }], COMMIT_DIFF_MAX_CHARACTERS);
            const prompt = buildCommitPrompt(
              this.getConfig(repository.rootUri.fsPath).commitMessagePromptTemplate,
              diff
            );
            const message = await this.codexClient.run(prompt, repository.rootUri.fsPath, abortController.signal);
            if (abortController.signal.aborted) {
              return;
            }

            repository.inputBox.value = message.trim();
            await this.ui.executeCommand("workbench.view.scm");
          } finally {
            signal.removeEventListener("abort", abort);
          }
        }
      );
    } catch (error) {
      if (!(error instanceof ProcessRunnerError && error.kind === "cancelled")) {
        this.ui.showErrorMessage(`Unable to generate a commit message: ${getErrorDetails(error).message}`);
      }
    } finally {
      this.operations.delete(abortController);
    }
  }

  dispose(): void {
    for (const operation of this.operations) {
      operation.abort();
    }
    this.operations.clear();
  }
}
