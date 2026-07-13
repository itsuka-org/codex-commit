import * as assert from "node:assert/strict";
import {
  collectBranchDiff,
  sanitizeBranchNameCandidate
} from "../../features/branchCreator/branchName";
import type { Repository } from "../../types/git";

suite("branch name", () => {
  test("strips code fences", () => {
    assert.equal(sanitizeBranchNameCandidate("```text\nFix login flow\n```"), "fix-login-flow");
  });

  test("strips an explanatory prefix", () => {
    assert.equal(sanitizeBranchNameCandidate("Branch name: `feat/add-api`"), "feat/add-api");
  });

  test("skips generic placeholder lines", () => {
    assert.equal(sanitizeBranchNameCandidate("branch-name\nfix/real-name"), "fix/real-name");
  });

  test("returns empty for empty or punctuation-only output", () => {
    assert.equal(sanitizeBranchNameCandidate(""), "");
    assert.equal(sanitizeBranchNameCandidate("```\n///\n```"), "");
  });

  test("normalizes invalid characters and Unicode", () => {
    assert.equal(sanitizeBranchNameCandidate("Feat/My Feature: 追加"), "feat/my-feature");
    assert.equal(sanitizeBranchNameCandidate("機能追加"), "");
  });

  test("collects staged changes only", async () => {
    const value = await collectBranchDiff(repositoryWithDiff("staged", ""));
    assert.equal(value, "Staged diff:\nstaged");
  });

  test("collects unstaged changes only", async () => {
    const value = await collectBranchDiff(repositoryWithDiff("", "unstaged"));
    assert.equal(value, "Unstaged diff:\nunstaged");
  });

  test("collects staged and unstaged changes in parallel", async () => {
    const value = await collectBranchDiff(repositoryWithDiff("staged", "unstaged"));
    assert.equal(value, "Staged diff:\nstaged\n\nUnstaged diff:\nunstaged");
  });

  test("returns null when both diffs are empty", async () => {
    assert.equal(await collectBranchDiff(repositoryWithDiff("  ", "\n")), null);
  });
});

function repositoryWithDiff(staged: string, unstaged: string): Repository {
  return {
    rootUri: { fsPath: "/repo" } as Repository["rootUri"],
    inputBox: { value: "" },
    diff: async cached => (cached ? staged : unstaged),
    createBranch: async () => undefined
  };
}
