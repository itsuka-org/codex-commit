import * as vscode from "vscode";
import { getCodexCommitConfig } from "./config/codexCommitConfig";
import { BranchCreatorController } from "./features/branchCreator/branchCreatorController";
import { BranchCreatorSession } from "./features/branchCreator/branchCreatorSession";
import { CommitMessageService } from "./features/commitMessage/commitMessageService";
import { DiagnosticsService } from "./features/diagnostics/diagnosticsService";
import { RepositoryResolver } from "./features/repositorySelection/repositoryResolver";
import { CodexClient } from "./infrastructure/codex/codexClient";
import { GitExtensionGateway } from "./infrastructure/git/gitExtensionGateway";
import { ProcessRunner } from "./infrastructure/process/processRunner";
import { COMMANDS } from "./shared/commands";
import { OutputLogger } from "./shared/outputLogger";
import { VscodeUiAdapter } from "./shared/ui";

const OUTPUT_CHANNEL_NAME = "Codex Commit";

export function activate(context: vscode.ExtensionContext): void {
  const disposables: vscode.Disposable[] = [];
  try {
    const getConfig = (cwd?: string) => getCodexCommitConfig(cwd ? vscode.Uri.file(cwd) : undefined);
    const ui = new VscodeUiAdapter();
    const logger = new OutputLogger(OUTPUT_CHANNEL_NAME, () => getConfig().debugLog);
    const processRunner = new ProcessRunner();
    const gitGateway = new GitExtensionGateway(() =>
      vscode.extensions.getExtension<import("./types/git").GitExtensionExports>("vscode.git")
    );
    const repositoryResolver = new RepositoryResolver(gitGateway, ui);
    const codexClient = new CodexClient(logger, processRunner, {
      getConfig,
      getRemoteName: () => vscode.env.remoteName,
      environment: process.env
    });
    const branchCreatorSession = new BranchCreatorSession({
      command: COMMANDS.createBranch,
      title: "Create branch"
    });
    const commitMessageService = new CommitMessageService(
      repositoryResolver,
      codexClient,
      ui,
      getConfig
    );
    const branchCreatorController = new BranchCreatorController(
      repositoryResolver,
      codexClient,
      branchCreatorSession,
      ui,
      getConfig
    );
    const diagnosticsService = new DiagnosticsService(
      codexClient,
      gitGateway,
      logger,
      ui,
      getConfig,
      () => ({
        cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd(),
        remoteName: vscode.env.remoteName,
        environment: process.env
      })
    );

    disposables.push(
      logger,
      processRunner,
      branchCreatorSession,
      commitMessageService,
      branchCreatorController,
      vscode.commands.registerCommand(COMMANDS.generateCommitMessage, async (sourceControl?: unknown) =>
        commitMessageService.generate({ hint: sourceControl })
      ),
      vscode.commands.registerCommand(COMMANDS.generateBranchName, async (sourceControl?: unknown) =>
        branchCreatorController.generate({ hint: sourceControl })
      ),
      vscode.commands.registerCommand(COMMANDS.regenerateBranchName, async (sourceControl?: unknown) =>
        branchCreatorController.generate({
          hint: sourceControl,
          preferredRoot: branchCreatorSession.getTargetRepoUri()
        })
      ),
      vscode.commands.registerCommand(COMMANDS.createBranch, async () => branchCreatorController.createFromInput()),
      vscode.commands.registerCommand(COMMANDS.diagnostics, async () => diagnosticsService.run())
    );
    context.subscriptions.push(...disposables);
  } catch (error) {
    for (const disposable of disposables.reverse()) {
      disposable.dispose();
    }
    throw error;
  }
}
