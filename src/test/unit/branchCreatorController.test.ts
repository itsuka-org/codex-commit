import * as assert from "node:assert/strict";
import type * as vscode from "vscode";
import type { CodexCommitConfig } from "../../config/codexCommitConfig";
import { BranchCreatorController } from "../../features/branchCreator/branchCreatorController";
import type { BranchCreatorSessionPort } from "../../features/branchCreator/branchCreatorSession";
import type { CodexClientPort } from "../../infrastructure/codex/codexClient";
import type { UiAdapter } from "../../shared/ui";
import type { Repository } from "../../types/git";
import type { RepositoryResolverPort } from "../../features/repositorySelection/repositoryResolver";

suite("BranchCreatorController", () => {
  test("an older operation cannot overwrite a newer repository session", async () => {
    const repositoryA = repository("/repo-a");
    const repositoryB = repository("/repo-b");
    const resolver = new FakeResolver([repositoryA, repositoryB]);
    const codex = new DeferredCodex();
    const session = new FakeSession();
    const ui = new FakeUi();
    const controller = new BranchCreatorController(resolver, codex, session, ui, getConfig);

    const first = controller.generate();
    await waitFor(() => codex.calls.length === 1);
    const second = controller.generate();
    await waitFor(() => codex.calls.length === 2);

    codex.resolve("/repo-b", "feat/newer");
    await second;
    codex.resolve("/repo-a", "fix/older");
    await first;

    assert.equal(session.target?.fsPath, "/repo-b");
    assert.equal(session.value, "feat/newer");
    assert.equal(session.events.at(-1), "/repo-b:feat/newer");
    assert.equal(ui.information.filter(message => message.includes("generated")).length, 1);
  });

  test("a diff rejection is reported once and does not invoke Codex", async () => {
    const failing = repository("/repo", async () => {
      throw new Error("diff unavailable");
    });
    const codex = new DeferredCodex();
    const ui = new FakeUi();
    const controller = new BranchCreatorController(
      new FakeResolver([failing]),
      codex,
      new FakeSession(),
      ui,
      getConfig
    );
    await controller.generate();
    assert.equal(codex.calls.length, 0);
    assert.deepEqual(ui.errors, ["Unable to generate a branch name: diff unavailable"]);
  });

  test("creates and checks out a branch through the exact repository API", async () => {
    const target = repository("/repo");
    const resolver = new FakeResolver([]);
    resolver.exact = target;
    const session = new FakeSession();
    session.target = target.rootUri;
    session.value = "feat/api-branch";
    const ui = new FakeUi();
    const controller = new BranchCreatorController(resolver, new DeferredCodex(), session, ui, getConfig);

    await controller.createFromInput();
    assert.deepEqual(target.created, [["feat/api-branch", true]]);
    assert.equal(session.target, undefined);
    assert.match(ui.information[0], /Switched to new branch/u);
  });

  test("does not fall back when the generation repository was closed", async () => {
    const resolver = new FakeResolver([]);
    resolver.exact = undefined;
    const session = new FakeSession();
    session.target = uri("/closed");
    session.value = "feat/name";
    const ui = new FakeUi();
    const controller = new BranchCreatorController(resolver, new DeferredCodex(), session, ui, getConfig);
    await controller.createFromInput();
    assert.equal(resolver.resolveCalls, 0);
    assert.equal(resolver.exactCalls, 1);
  });
});

type TestRepository = Repository & { created: Array<[string, boolean]> };

function repository(root: string, diff?: (cached?: boolean) => Promise<string>): TestRepository {
  const created: Array<[string, boolean]> = [];
  return {
    rootUri: uri(root),
    inputBox: { value: "" },
    diff: diff ?? (async cached => (cached ? "staged" : "unstaged")),
    createBranch: async (name, checkout) => {
      created.push([name, checkout]);
    },
    created
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
  exact: Repository | undefined;
  resolveCalls = 0;
  exactCalls = 0;

  constructor(private readonly repositories: Repository[]) {}

  async resolve(): Promise<Repository | undefined> {
    this.resolveCalls += 1;
    return this.repositories.shift();
  }

  async resolveExact(): Promise<Repository | undefined> {
    this.exactCalls += 1;
    return this.exact;
  }
}

class DeferredCodex implements CodexClientPort {
  readonly calls: string[] = [];
  private readonly deferred = new Map<string, Deferred<string>>();

  run(_prompt: string, cwd: string): Promise<string> {
    this.calls.push(cwd);
    const deferred = createDeferred<string>();
    this.deferred.set(cwd, deferred);
    return deferred.promise;
  }

  resolve(cwd: string, value: string): void {
    this.deferred.get(cwd)?.resolve(value);
  }
}

class FakeSession implements BranchCreatorSessionPort {
  target: vscode.Uri | undefined;
  value = "";
  readonly events: string[] = [];

  show(_placeholder: string, value: string, targetRepoUri: vscode.Uri): void {
    this.target = targetRepoUri;
    this.value = value;
    this.events.push(`${targetRepoUri.fsPath}:${value}`);
  }

  hide(): void {
    this.target = undefined;
    this.value = "";
    this.events.push("hidden");
  }

  getInputValue(): string {
    return this.value;
  }

  getTargetRepoUri(): vscode.Uri | undefined {
    return this.target;
  }
}

class FakeUi implements UiAdapter {
  readonly information: string[] = [];
  readonly warnings: string[] = [];
  readonly errors: string[] = [];

  showInformationMessage(message: string): void {
    this.information.push(message);
  }

  showWarningMessage(message: string): void {
    this.warnings.push(message);
  }

  showErrorMessage(message: string): void {
    this.errors.push(message);
  }

  async executeCommand(): Promise<unknown> {
    return undefined;
  }

  withProgress<T>(_request: { title: string; cancellable?: boolean }, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return task(new AbortController().signal);
  }
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve(value: T): void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) {
      return;
    }
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  throw new Error("Timed out waiting for test condition.");
}

function getConfig(): CodexCommitConfig {
  return {
    commitMessagePromptTemplate: "{{diff}}",
    branchNamePromptTemplate: "{{diff}}",
    debugLog: false
  };
}
