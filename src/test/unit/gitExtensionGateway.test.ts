import * as assert from "node:assert/strict";
import type * as vscode from "vscode";
import {
  GitExtensionGateway,
  RepositoryUnavailableError
} from "../../infrastructure/git/gitExtensionGateway";
import type { GitAPI, GitExtensionExports } from "../../types/git";

suite("GitExtensionGateway", () => {
  const api = { repositories: [], getRepository: () => null } satisfies GitAPI;

  test("distinguishes a missing extension", async () => {
    await assertReason(new GitExtensionGateway(() => undefined).getApi(), "not_found");
  });

  test("distinguishes a disabled extension", async () => {
    const exports = { enabled: false, getAPI: () => api } satisfies GitExtensionExports;
    await assertReason(new GitExtensionGateway(() => extension(exports)).getApi(), "disabled");
  });

  test("distinguishes activation failure", async () => {
    const value = extension({ enabled: true, getAPI: () => api }, false);
    value.activate = async () => {
      throw new Error("activation failed");
    };
    await assertReason(new GitExtensionGateway(() => value).getApi(), "activation");
  });

  test("distinguishes API failure", async () => {
    const exports = {
      enabled: true,
      getAPI: () => {
        throw new Error("API failed");
      }
    } satisfies GitExtensionExports;
    await assertReason(new GitExtensionGateway(() => extension(exports)).getApi(), "api");
  });

  test("returns API v1", async () => {
    const gateway = new GitExtensionGateway(() => extension({ enabled: true, getAPI: () => api }));
    assert.equal(await gateway.getApi(), api);
  });
});

async function assertReason(promise: Promise<GitAPI>, reason: RepositoryUnavailableError["reason"]): Promise<void> {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof RepositoryUnavailableError);
    assert.equal(error.reason, reason);
    return true;
  });
}

function extension(exports: GitExtensionExports, isActive = true): vscode.Extension<GitExtensionExports> {
  return {
    isActive,
    exports,
    activate: async () => exports
  } as unknown as vscode.Extension<GitExtensionExports>;
}
