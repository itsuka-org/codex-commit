import * as assert from "node:assert/strict";
import type * as vscode from "vscode";
import type { CodexCommitConfig } from "../../config/codexCommitConfig";
import { CommitMessageService } from "../../features/commitMessage/commitMessageService";
import type { RepositoryResolverPort } from "../../features/repositorySelection/repositoryResolver";
import type { CodexClientPort } from "../../infrastructure/codex/codexClient";
import type { UiAdapter } from "../../shared/ui";
import type { Repository } from "../../types/git";

suite("CommitMessageService", () => {
  test("writes the generated message to the selected repository input", async () => {
    const target = repository("/repo", async () => "diff --git a/file b/file\n+after");
    const codex = new FakeCodex("feat: generated message");
    const ui = new FakeUi();
    const service = new CommitMessageService(new FakeResolver(target), codex, ui, getConfig);

    await service.generate();

    assert.equal(target.inputBox.value, "feat: generated message");
    assert.equal(codex.calls.length, 1);
    assert.match(codex.calls[0].prompt, /diff --git a\/file b\/file/u);
    assert.equal(codex.calls[0].cwd, "/repo");
    assert.deepEqual(ui.commands, ["workbench.view.scm"]);
    assert.deepEqual(ui.errors, []);
  });

  test("stops before Codex when there are no staged changes", async () => {
    const codex = new FakeCodex("unused");
    const ui = new FakeUi();
    const service = new CommitMessageService(
      new FakeResolver(repository("/repo", async () => " \n")),
      codex,
      ui,
      getConfig
    );

    await service.generate();

    assert.equal(codex.calls.length, 0);
    assert.deepEqual(ui.information, ["No staged changes. Stage files first."]);
  });

  test("reports a staged diff failure once", async () => {
    const ui = new FakeUi();
    const service = new CommitMessageService(
      new FakeResolver(
        repository("/repo", async () => {
          throw new Error("diff unavailable");
        })
      ),
      new FakeCodex("unused"),
      ui,
      getConfig
    );

    await service.generate();

    assert.deepEqual(ui.errors, ["Unable to generate a commit message: diff unavailable"]);
  });

  test("reports a Codex failure without changing the SCM input", async () => {
    const target = repository("/repo", async () => "staged diff");
    target.inputBox.value = "keep me";
    const ui = new FakeUi();
    const service = new CommitMessageService(
      new FakeResolver(target),
      new FakeCodex(new Error("Codex unavailable")),
      ui,
      getConfig
    );

    await service.generate();

    assert.equal(target.inputBox.value, "keep me");
    assert.deepEqual(ui.errors, ["Unable to generate a commit message: Codex unavailable"]);
  });
});

type TestRepository = Repository & { inputBox: { value: string } };

function repository(root: string, diff: (cached?: boolean) => Promise<string>): TestRepository {
  return {
    rootUri: uri(root),
    inputBox: { value: "" },
    diff,
    createBranch: async () => undefined
  };
}

function uri(fsPath: string): vscode.Uri {
  return {
    scheme: "file",
    path: fsPath,
    fsPath,
    toString: () => `file://${fsPath}`
  } as vscode.Uri;
}

class FakeResolver implements RepositoryResolverPort {
  constructor(private readonly target: Repository | undefined) {}

  async resolve(): Promise<Repository | undefined> {
    return this.target;
  }

  async resolveExact(): Promise<Repository | undefined> {
    return this.target;
  }
}

class FakeCodex implements CodexClientPort {
  readonly calls: Array<{ prompt: string; cwd: string }> = [];

  constructor(private readonly result: string | Error) {}

  async run(prompt: string, cwd: string): Promise<string> {
    this.calls.push({ prompt, cwd });
    if (this.result instanceof Error) {
      throw this.result;
    }
    return this.result;
  }
}

class FakeUi implements UiAdapter {
  readonly information: string[] = [];
  readonly warnings: string[] = [];
  readonly errors: string[] = [];
  readonly commands: string[] = [];

  showInformationMessage(message: string): void {
    this.information.push(message);
  }

  showWarningMessage(message: string): void {
    this.warnings.push(message);
  }

  showErrorMessage(message: string): void {
    this.errors.push(message);
  }

  async executeCommand(command: string): Promise<unknown> {
    this.commands.push(command);
    return undefined;
  }

  withProgress<T>(_request: { title: string; cancellable?: boolean }, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return task(new AbortController().signal);
  }
}

function getConfig(): CodexCommitConfig {
  return {
    commitMessagePromptTemplate: "Commit from this diff:\n{{diff}}",
    branchNamePromptTemplate: "{{diff}}",
    debugLog: false
  };
}
