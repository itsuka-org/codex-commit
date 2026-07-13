import * as assert from "node:assert/strict";
import * as vscode from "vscode";
import { getCodexCommitConfig } from "../../config/codexCommitConfig";
import { BranchCreatorSession } from "../../features/branchCreator/branchCreatorSession";
import { COMMAND_IDS, COMMANDS } from "../../shared/commands";

suite("Extension Host smoke", () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension("itsukaorg.codex-commit");
    assert.ok(extension, "extension is discoverable by manifest ID");
    await extension.activate();
    assert.equal(extension.isActive, true);
  });

  test("registers all five manifest commands", async () => {
    const registered = await vscode.commands.getCommands(true);
    for (const command of COMMAND_IDS) {
      assert.ok(registered.includes(command), `${command} is registered`);
    }
  });

  test("creates and disposes a repository-rooted branch SourceControl", () => {
    const session = new BranchCreatorSession({ command: COMMANDS.createBranch, title: "Create branch" });
    const rootUri = vscode.Uri.file(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? process.cwd());
    session.show("placeholder", "feat/test", rootUri);
    assert.equal(session.getInputValue(), "feat/test");
    assert.equal(session.getTargetRepoUri()?.toString(), rootUri.toString());
    session.dispose();
    assert.equal(session.getTargetRepoUri(), undefined);
  });

  test("resolves migrated settings at User, Workspace, and Workspace Folder scopes", async () => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    assert.ok(folder, "the extension test workspace has a folder");
    const config = vscode.workspace.getConfiguration("codexCommit", folder.uri);
    const targets = [
      vscode.ConfigurationTarget.Global,
      vscode.ConfigurationTarget.Workspace,
      vscode.ConfigurationTarget.WorkspaceFolder
    ];

    try {
      assert.equal(getCodexCommitConfig(folder.uri).commitMessagePromptTemplate, "legacy-folder");

      await config.update("commitMessagePromptTemplate", "new-user", vscode.ConfigurationTarget.Global);
      assert.equal(getCodexCommitConfig(folder.uri).commitMessagePromptTemplate, "new-user");

      await config.update("commitMessagePromptTemplate", "new-workspace", vscode.ConfigurationTarget.Workspace);
      assert.equal(getCodexCommitConfig(folder.uri).commitMessagePromptTemplate, "new-workspace");

      await config.update("commitMessagePromptTemplate", "", vscode.ConfigurationTarget.WorkspaceFolder);
      assert.equal(getCodexCommitConfig(folder.uri).commitMessagePromptTemplate, "");
    } finally {
      for (const target of targets) {
        await config.update("commitMessagePromptTemplate", undefined, target);
      }
    }
  });
});
