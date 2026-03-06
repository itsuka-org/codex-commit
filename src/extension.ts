import * as vscode from "vscode";
import { getCodexCommitConfig } from "./config/codexCommitConfig";
import { BranchCreatorController } from "./features/branchCreator/branchCreatorController";
import { BranchCreatorSession } from "./features/branchCreator/branchCreatorSession";
import { CommitMessageService } from "./features/commitMessage/commitMessageService";
import { DiagnosticsService } from "./features/diagnostics/diagnosticsService";
import { findBestMatchingRepositoryRoot } from "./features/repositorySelection/pathUtils";
import { selectRepositoryRoot } from "./features/repositorySelection/selection";
import { RepositoryResolver } from "./features/repositorySelection/repositoryResolver";
import { CodexClient } from "./infrastructure/codex/codexClient";
import { buildCodexErrorMessage, isAuthError, isTuiError, parseCodexJsonl } from "./infrastructure/codex/parsing";
import { GitClient } from "./infrastructure/git/gitClient";
import { OutputLogger } from "./shared/outputLogger";
import { sanitizeBranchNameCandidate } from "./features/branchCreator/branchName";

const OUTPUT_CHANNEL_NAME = "Codex Commit";

export function activate(context: vscode.ExtensionContext) {
  const logger = new OutputLogger(OUTPUT_CHANNEL_NAME, () => getCodexCommitConfig().debugLog);
  const repositoryResolver = new RepositoryResolver();
  const codexClient = new CodexClient(logger);
  const gitClient = new GitClient();
  const branchCreatorSession = new BranchCreatorSession({
    command: "codexCommit.createBranchFromGeneratedInput",
    title: "Create branch"
  });
  const commitMessageService = new CommitMessageService(repositoryResolver, codexClient);
  const branchCreatorController = new BranchCreatorController(repositoryResolver, codexClient, gitClient, branchCreatorSession);
  const diagnosticsService = new DiagnosticsService(codexClient, logger);

  const generateCommit = vscode.commands.registerCommand("codexCommit.generate", async (sourceControl?: unknown) =>
    commitMessageService.generate({ hint: sourceControl })
  );
  const generateBranchName = vscode.commands.registerCommand("codexCommit.generateBranchName", async (sourceControl?: unknown) =>
    branchCreatorController.generate({ hint: sourceControl })
  );
  const regenerateBranchName = vscode.commands.registerCommand(
    "codexCommit.regenerateBranchName",
    async (sourceControl?: unknown) =>
      branchCreatorController.generate({
        hint: sourceControl,
        preferredRoot: branchCreatorSession.getTargetRepoRoot()
      })
  );
  const createBranchFromGeneratedInput = vscode.commands.registerCommand(
    "codexCommit.createBranchFromGeneratedInput",
    async () => branchCreatorController.createFromInput()
  );
  const diagnostics = vscode.commands.registerCommand("codexCommit.diagnostics", async () => diagnosticsService.run());

  context.subscriptions.push(
    logger,
    branchCreatorSession,
    generateCommit,
    generateBranchName,
    regenerateBranchName,
    createBranchFromGeneratedInput,
    diagnostics
  );
}

export function deactivate() {}

export {
  buildCodexErrorMessage,
  findBestMatchingRepositoryRoot,
  isAuthError,
  isTuiError,
  parseCodexJsonl,
  sanitizeBranchNameCandidate,
  selectRepositoryRoot
};
