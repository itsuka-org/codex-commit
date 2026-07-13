import * as assert from "node:assert/strict";
import type { CodexCommitConfig } from "../../config/codexCommitConfig";
import { DiagnosticsService } from "../../features/diagnostics/diagnosticsService";
import type { CodexClient } from "../../infrastructure/codex/codexClient";
import type { GitExtensionGateway } from "../../infrastructure/git/gitExtensionGateway";
import type { OutputLogger } from "../../shared/outputLogger";
import type { UiAdapter } from "../../shared/ui";
import type { Repository } from "../../types/git";

suite("DiagnosticsService", () => {
  test("reports installed, minimum, compatible, login, Git, and host environment", async () => {
    const logger = new FakeLogger();
    const ui = new FakeUi();
    const service = createService(
      {
        getVersionStatus: async () => ({
          executable: "/opt/codex",
          raw: "codex-cli 0.142.4",
          installed: "0.142.4",
          minimum: "0.142.3",
          compatible: true
        }),
        getLoginStatus: async () => ({ ok: true })
      },
      {
        getApi: async () => ({
          repositories: [{}, {}] as Repository[],
          getRepository: () => null
        })
      },
      logger,
      ui
    );

    await service.run();

    assert.match(logger.lines.join("\n"), /cwd: \/workspace\/repo/u);
    assert.match(logger.lines.join("\n"), /extension host: dev-container/u);
    assert.match(logger.lines.join("\n"), /codex executable: \/opt\/codex/u);
    assert.match(logger.lines.join("\n"), /codex installed: 0\.142\.4/u);
    assert.match(logger.lines.join("\n"), /codex minimum: 0\.142\.3/u);
    assert.match(logger.lines.join("\n"), /codex compatible: yes/u);
    assert.match(logger.lines.join("\n"), /codex login status: ok/u);
    assert.match(logger.lines.join("\n"), /Git extension: enabled \(2 repositories\)/u);
    assert.equal(logger.didClear, true);
    assert.equal(logger.didShow, true);
    assert.deepEqual(ui.informationMessages, ["Codex Commit diagnostics written to output."]);
  });

  test("settles independent failures and still writes every diagnostic section", async () => {
    let loginCalled = false;
    let gitCalled = false;
    const logger = new FakeLogger();
    const service = createService(
      {
        getVersionStatus: async () => {
          throw new Error("version failed");
        },
        getLoginStatus: async () => {
          loginCalled = true;
          return { ok: false, reason: "auth", detail: "not logged in" };
        }
      },
      {
        getApi: async () => {
          gitCalled = true;
          throw new Error("Git failed");
        }
      },
      logger,
      new FakeUi()
    );

    await service.run();

    assert.equal(loginCalled, true);
    assert.equal(gitCalled, true);
    assert.match(logger.lines.join("\n"), /codex version: error \(version failed\)/u);
    assert.match(logger.lines.join("\n"), /codex login status: auth \(not logged in\)/u);
    assert.match(logger.lines.join("\n"), /Git extension: error \(Git failed\)/u);
  });
});

function createService(
  codexClient: Pick<CodexClient, "getVersionStatus" | "getLoginStatus">,
  gitGateway: Pick<GitExtensionGateway, "getApi">,
  logger: FakeLogger,
  ui: FakeUi
): DiagnosticsService {
  const config: CodexCommitConfig = {
    codexPath: "/opt/codex",
    model: "gpt-test",
    effort: "low",
    commitMessagePromptTemplate: "{{diff}}",
    branchNamePromptTemplate: "{{diff}}",
    debugLog: false
  };
  return new DiagnosticsService(
    codexClient as CodexClient,
    gitGateway as GitExtensionGateway,
    logger as unknown as OutputLogger,
    ui,
    () => config,
    () => ({
      cwd: "/workspace/repo",
      remoteName: "dev-container",
      environment: { CODEX_API_KEY: "configured" }
    })
  );
}

class FakeLogger {
  readonly lines: string[] = [];
  didClear = false;
  didShow = false;

  appendLine(message: string): void {
    this.lines.push(message);
  }

  clear(): void {
    this.didClear = true;
    this.lines.length = 0;
  }

  show(): void {
    this.didShow = true;
  }
}

class FakeUi implements UiAdapter {
  readonly informationMessages: string[] = [];

  showInformationMessage(message: string): void {
    this.informationMessages.push(message);
  }

  showWarningMessage(): void {}

  showErrorMessage(): void {}

  executeCommand(): Promise<unknown> {
    return Promise.resolve(undefined);
  }

  withProgress<T>(_request: { title: string; cancellable?: boolean }, task: (signal: AbortSignal) => Promise<T>): Promise<T> {
    return task(new AbortController().signal);
  }
}
